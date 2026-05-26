import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isMockMode } from '../supabase/config';
import { joinPresence, leavePresence } from '../services/presence';

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  mobileNo: string;
  year: string;
  branch: string;
  cgpa?: string;
  photoURL: string;
  role: 'student' | 'admin';
  createdAt: any;
  bookmarks: string[];
  setupComplete?: boolean;
  points: number;
  lastIp?: string;
  hardwareId?: string;
}

export interface CustomUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber?: string | null;
}

interface AuthContextType {
  user: CustomUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isGuest: boolean;
  isMockMode: boolean;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signInWithPhone: (phoneNumber: string, appVerifier?: any) => Promise<any>;
  confirmPhoneOtp: (confirmationResult: any, code: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  updateProfileDetails: (displayName: string, photoURL?: string) => Promise<void>;
  toggleBookmark: (noteId: string) => Promise<void>;
  loginWithUsername: (username: string) => Promise<UserProfile>;
  registerUser: (profileData: Omit<UserProfile, 'uid' | 'createdAt' | 'bookmarks' | 'points'>) => Promise<UserProfile>;
  updatePoints: (additionalPoints: number) => Promise<void>;
  updateFullProfile: (profile: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


const dbToProfile = (dbRow: any): UserProfile => {
  const rawRole = dbRow.role || 'student';
  let role: 'student' | 'admin' = 'student';

  if (rawRole === 'admin') {
    role = 'admin';
  }

  return {
    uid: dbRow.id || dbRow.uid,
    username: dbRow.username || '',
    email: dbRow.email || '',
    displayName: dbRow.display_name || dbRow.displayName || '',
    mobileNo: dbRow.mobile_no || dbRow.mobileNo || '',
    year: dbRow.year || '',
    branch: dbRow.branch || '',
    cgpa: dbRow.cgpa || '',
    photoURL: dbRow.photo_url || dbRow.photoURL || '',
    role,
    createdAt: dbRow.created_at || dbRow.createdAt || new Date(),
    bookmarks: dbRow.bookmarks || [],
    setupComplete: dbRow.setup_complete !== undefined ? dbRow.setup_complete : dbRow.setupComplete,
    points: dbRow.points !== undefined ? Number(dbRow.points) : 0,
    lastIp: dbRow.last_ip || dbRow.lastIp || '',
    hardwareId: dbRow.hardware_id || dbRow.hardwareId || ''
  };
};

const profileToDb = (profile: UserProfile): any => {
  return {
    id: profile.uid,
    username: profile.username,
    email: profile.email,
    display_name: profile.displayName,
    mobile_no: profile.mobileNo,
    year: profile.year,
    branch: profile.branch,
    cgpa: profile.cgpa,
    photo_url: profile.photoURL,
    role: profile.role,
    created_at: profile.createdAt instanceof Date ? profile.createdAt.toISOString() : profile.createdAt,
    bookmarks: profile.bookmarks,
    setup_complete: profile.setupComplete,
    points: profile.points,
    last_ip: profile.lastIp,
    hardware_id: profile.hardwareId
  };
};

const profileToDbCamel = (profile: UserProfile): any => {
  return {
    id: profile.uid,
    username: profile.username,
    email: profile.email,
    displayName: profile.displayName,
    mobileNo: profile.mobileNo,
    year: profile.year,
    branch: profile.branch,
    cgpa: profile.cgpa,
    photoUrl: profile.photoURL,
    role: profile.role,
    createdAt: profile.createdAt instanceof Date ? profile.createdAt.toISOString() : profile.createdAt,
    bookmarks: profile.bookmarks,
    setupComplete: profile.setupComplete,
    points: profile.points,
    lastIp: profile.lastIp,
    hardwareId: profile.hardwareId
  };
};

const getHardwareId = (): string => {
  if (typeof window === 'undefined') return '';
  let hwId = localStorage.getItem('noteweb-hardware-id');
  if (!hwId) {
    const randStr = () => Math.random().toString(36).substring(2, 15);
    const canvasFp = typeof HTMLCanvasElement !== 'undefined' ? 'canvas' : 'no-canvas';
    hwId = `hw-${randStr()}-${randStr()}-${Date.now().toString(36)}-${canvasFp}`;
    localStorage.setItem('noteweb-hardware-id', hwId);
  }
  return hwId;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return localStorage.getItem('noteweb-is-guest') === 'true';
  });
  const [loading, setLoading] = useState(true);

  // Sync Auth profile details from Database with LocalStorage cache fallback
  const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid);
      
      if (error) throw error;

      if (data && data.length > 0) {
        const profile = dbToProfile(data[0]);
        localStorage.setItem(`noteweb-profile-${uid}`, JSON.stringify(profile));
        return profile;
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
    }

    // Local storage fallback for offline/mock boots
    const saved = localStorage.getItem(`noteweb-profile-${uid}`);
    if (saved) {
      try {
        return JSON.parse(saved) as UserProfile;
      } catch {
        return null;
      }
    }
    return null;
  };

  // Helper to save user profile in profiles table + LocalStorage cache
  const saveUserProfile = async (profile: UserProfile) => {
    try {
      const dbProfile = profileToDb(profile);
      const { error } = await supabase
        .from('profiles')
        .insert([dbProfile]);
      
      if (error) {
        if (error.message?.includes('column') || error.code === '42703') {
          const dbProfileCamel = profileToDbCamel(profile);
          const { error: camelErr } = await supabase
            .from('profiles')
            .insert([dbProfileCamel]);
          
          if (camelErr) {
            await supabase
              .from('profiles')
              .update(dbProfileCamel)
              .eq('id', profile.uid);
          }
        } else {
          // If profile already exists, perform update
          const { error: updateErr } = await supabase
            .from('profiles')
            .update(dbProfile)
            .eq('id', profile.uid);
          
          if (updateErr && (updateErr.message?.includes('column') || updateErr.code === '42703')) {
            const dbProfileCamel = profileToDbCamel(profile);
            await supabase
              .from('profiles')
              .update(dbProfileCamel)
              .eq('id', profile.uid);
          }
        }
      }
    } catch (e) {
      console.warn("Database profiles save failed, saving locally:", e);
    }
    localStorage.setItem(`noteweb-profile-${profile.uid}`, JSON.stringify(profile));
  };

  useEffect(() => {
    if (isGuest) {
      const guestProfile: UserProfile = {
        uid: 'guest-user-noteweb',
        username: 'guest',
        email: 'guest@noteweb.local',
        displayName: 'Guest Student',
        mobileNo: '',
        year: '1',
        branch: 'cse',
        photoURL: '',
        role: 'student',
        createdAt: new Date(),
        bookmarks: [],
        points: 0
      };
      setUser(null);
      setUserProfile(guestProfile);
      setLoading(false);
      return;
    }

    // Listen to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      const sessionUser = session?.user || null;
      if (sessionUser) {
        let profile = await fetchUserProfile(sessionUser.id);
        
        if (!profile) {
          const initialProfile: UserProfile = {
            uid: sessionUser.id,
            username: sessionUser.email ? sessionUser.email.split('@')[0] : `user_${sessionUser.id.slice(0, 5)}`,
            email: sessionUser.email || '',
            displayName: sessionUser.user_metadata?.display_name || 'Student',
            mobileNo: '',
            year: '1',
            branch: 'cse',
            photoURL: sessionUser.user_metadata?.photo_url || '',
            role: 'student',
            createdAt: new Date(),
            bookmarks: [],
            setupComplete: false,
            points: 0
          };
          await saveUserProfile(initialProfile);
          profile = initialProfile;
        }

        setUser({
          uid: sessionUser.id,
          email: profile.email,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
        });
        setUserProfile(profile);

        // Register online presence across all devices/browsers
        try {
          await joinPresence({
            uid: profile.uid,
            displayName: profile.displayName,
            email: profile.email,
            role: profile.role,
            photoURL: profile.photoURL,
          });
        } catch (presenceErr) {
          console.warn('[AuthContext] Presence join failed (non-critical):', presenceErr);
        }
      } else {
        // Double check if a mock user is logged in
        const mockUid = localStorage.getItem('noteweb-mock-uid');
        if (mockUid) {
          const profile = await fetchUserProfile(mockUid);
          if (profile) {
            setUser({
              uid: profile.uid,
              displayName: profile.displayName,
              email: profile.email,
              photoURL: profile.photoURL
            });
            setUserProfile(profile);
            // Register mock user presence
            try {
              await joinPresence({
                uid: profile.uid,
                displayName: profile.displayName,
                email: profile.email,
                role: profile.role,
                photoURL: profile.photoURL,
              });
            } catch (presenceErr) {
              console.warn('[AuthContext] Mock presence join failed (non-critical):', presenceErr);
            }
            setLoading(false);
            return;
          }
        }
        // Clear presence on sign-out
        try { await leavePresence(); } catch (_) {}
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [isGuest]);

  // 1. Background profile healing & notes migration to cloud database
  useEffect(() => {
    if (!user || isGuest || isMockMode) return;

    const migrateLocalDataToCloud = async () => {
      console.log("[Auth Sync] Initiating background cloud migration for user:", user.uid);

      // A. Profile Self-Healing
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.uid);

        if (!error && (!data || data.length === 0)) {
          console.log("[Auth Sync] Profile missing from remote database. Restoring profile to cloud...");
          if (userProfile) {
            await saveUserProfile(userProfile);
            console.log("[Auth Sync] Profile successfully restored online!");
          }
        }
      } catch (err) {
        console.warn("[Auth Sync] Failed to verify/restore profile:", err);
      }

      // B. Notes Local-to-Cloud Migration
      try {
        // Retrieve old notes from local storage lists
        const storedNotesStr = localStorage.getItem('noteweb-broadcasted-notes');
        const myUploadsStr = localStorage.getItem('noteweb-my-uploads');
        
        let localNotes: any[] = [];
        if (storedNotesStr) {
          try { localNotes = [...localNotes, ...JSON.parse(storedNotesStr)]; } catch {}
        }
        if (myUploadsStr) {
          try { localNotes = [...localNotes, ...JSON.parse(myUploadsStr)]; } catch {}
        }

        // De-duplicate local notes by subject/filename
        const uniqueLocalNotes = localNotes.filter((note, index, self) => 
          index === self.findIndex((n) => n.subject === note.subject && n.file_name === note.file_name)
        );

        if (uniqueLocalNotes.length === 0) return;

        console.log(`[Auth Sync] Found ${uniqueLocalNotes.length} local notes. Checking database sync status...`);

        for (const note of uniqueLocalNotes) {
          // Check if already in remote DB
          const subjectTitle = note.subject || note.subjectName || '';
          const { data: dbNotes, error: dbErr } = await supabase
            .from('notes')
            .select('id')
            .eq('subject', subjectTitle)
            .eq('uploaded_by', user.uid);

          if (!dbErr && (!dbNotes || dbNotes.length === 0)) {
            console.log(`[Auth Sync] Migrating note "${subjectTitle}" to cloud database...`);
            
            const noteDoc = {
              subject: subjectTitle,
              branch: note.branch || 'cse',
              category: note.category || '',
              semester: note.semester || '1/2',
              teacher: note.teacher || 'General / Unknown',
              description: note.description || 'No description provided.',
              pdf_url: note.pdf_url || note.pdfUrl || '',
              pdf_path: note.pdf_path || note.pdfPath || '',
              file_name: note.file_name || note.fileName || 'document.pdf',
              file_size: note.file_size || note.fileSize || 0,
              uploaded_by: user.uid,
              uploader_name: note.uploader_name || note.uploaderName || 'Student',
              uploader_email: note.uploader_email || note.uploaderEmail || '',
              created_at: note.created_at || note.createdAt || new Date().toISOString(),
              status: 'approved',
              likes: note.likes || [],
              likes_count: note.likes_count || note.likesCount || 0,
              bookmarks_count: note.bookmarks_count || note.bookmarksCount || 0,
              summary: note.summary || null
            };

            const { error: insErr } = await supabase.from('notes').insert([noteDoc]);
            if (insErr) {
              console.warn(`[Auth Sync] Failed to migrate note "${subjectTitle}":`, insErr.message);
            } else {
              console.log(`[Auth Sync] Note "${subjectTitle}" successfully migrated to cloud!`);
            }
          }
        }
      } catch (migrateErr) {
        console.warn("[Auth Sync] Notes migration error:", migrateErr);
      }
    };

    // Run migration in the background 3 seconds after mounting
    const timer = setTimeout(migrateLocalDataToCloud, 3000);
    return () => clearTimeout(timer);
  }, [user, userProfile]);

  // 2. Periodic active student session validity guard (Prune protection)
  useEffect(() => {
    if (!user || isGuest) return;

    const checkProfileValidity = async () => {
      // 1. Local caching guard check
      const cachedProfile = localStorage.getItem(`noteweb-profile-${user.uid}`);
      if (!cachedProfile) {
        console.log("[AuthContext] Profile cache not found, logging out...");
        await logout();
        return;
      }

      // 2. Real-time active Supabase profile verification
      // If we are running in local Mock Mode, query mockSupabase (which reads local storage safely)
      if (isMockMode) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.uid);
            
          if (!error && (!data || data.length === 0)) {
            console.log("[AuthContext] Profile deleted in database by administrator, signing out...");
            await logout();
          }
        } catch (err) {
          console.warn("Database profile validity check failed:", err);
        }
      } else if (!user.uid.startsWith('mock-')) {
        // In Live Mode, only query the remote database for real authenticated users (email/phone/oauth)
        // This prevents anonymous custom username accounts from getting logged out by RLS SELECT blocks
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.uid);
            
          if (!error && (!data || data.length === 0)) {
            console.log("[AuthContext] Profile deleted in database by administrator, signing out...");
            await logout();
          }
        } catch (err) {
          console.warn("Database profile validity check failed:", err);
        }
      }
    };

    const interval = setInterval(checkProfileValidity, 8000); // Check user existence every 8 seconds
    return () => clearInterval(interval);
  }, [user, isGuest]);

  const signup = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    setIsGuest(false);
    localStorage.removeItem('noteweb-is-guest');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            photo_url: ''
          }
        }
      });

      if (error) throw error;

      const sessionUser = data.user;
      if (!sessionUser) {
        throw new Error("This email is already registered. If you already have an account, please log in.");
      }

      // If identities is returned but empty, the user already exists (user enumeration prevention)
      if (sessionUser.identities && sessionUser.identities.length === 0) {
        throw new Error("This email is already registered. If you already have an account, please log in.");
      }

      const hasSession = !!data.session;
      const role = 'student';

      const userProfileData: UserProfile = {
        uid: sessionUser.id,
        username: email.split('@')[0],
        email: email,
        displayName: displayName,
        mobileNo: '',
        year: '1',
        branch: 'cse',
        photoURL: '',
        role: role,
        createdAt: new Date(),
        bookmarks: [],
        setupComplete: false,
        points: 0
      };

      await saveUserProfile(userProfileData);

      if (hasSession) {
        setUser({
          uid: sessionUser.id,
          email: email,
          displayName: displayName,
          photoURL: ''
        });
        setUserProfile(userProfileData);
      } else {
        // No session means they must confirm email first
        setUser(null);
        setUserProfile(null);
        throw {
          code: 'auth/email-confirmation-required',
          message: "Confirmation email sent! Please check your inbox and verify your email address before logging in."
        };
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    setIsGuest(false);
    localStorage.removeItem('noteweb-is-guest');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const sessionUser = data.user;
      if (!sessionUser) throw new Error('Login succeeded but no user was returned');

      const profile = await fetchUserProfile(sessionUser.id);
      if (!profile) {
        const fallbackProfile: UserProfile = {
          uid: sessionUser.id,
          username: email.split('@')[0],
          email: sessionUser.email || email,
          displayName: sessionUser.user_metadata?.display_name || email.split('@')[0],
          mobileNo: '',
          year: '1',
          branch: 'cse',
          photoURL: sessionUser.user_metadata?.photo_url || '',
          role: 'student',
          createdAt: new Date(),
          bookmarks: [],
          setupComplete: false,
          points: 0
        };
        await saveUserProfile(fallbackProfile);
        setUser({
          uid: sessionUser.id,
          email: fallbackProfile.email,
          displayName: fallbackProfile.displayName,
          photoURL: fallbackProfile.photoURL
        });
        setUserProfile(fallbackProfile);
      } else {
        setUser({
          uid: sessionUser.id,
          email: profile.email,
          displayName: profile.displayName,
          photoURL: profile.photoURL
        });
        setUserProfile(profile);
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signInWithPhone = async (phoneNumber: string, _appVerifier?: any) => {
    setLoading(true);
    setIsGuest(false);
    localStorage.removeItem('noteweb-is-guest');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber
      });

      if (error) throw error;
      setLoading(false);

      // Return compatibility ConfirmationResult object
      return {
        confirm: async (code: string) => {
          setLoading(true);
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            phone: phoneNumber,
            token: code,
            type: 'sms'
          });

          if (verifyError) {
            setLoading(false);
            throw verifyError;
          }

          const sessionUser = verifyData.user;
          if (!sessionUser) throw new Error('SMS Verification succeeded but no user was returned');

          let profile = await fetchUserProfile(sessionUser.id);
          let activeProfile: UserProfile;
          if (!profile) {
            const newProfile: UserProfile = {
              uid: sessionUser.id,
              username: `user_${sessionUser.id.slice(0, 5)}`,
              email: sessionUser.email || `${phoneNumber.replace(/\D/g, '')}@noteweb.local`,
              displayName: sessionUser.user_metadata?.display_name || `Student ${phoneNumber}`,
              mobileNo: phoneNumber,
              year: '1',
              branch: 'cse',
              photoURL: sessionUser.user_metadata?.photo_url || '',
              role: 'student',
              createdAt: new Date(),
              bookmarks: [],
              setupComplete: false,
              points: 0
            };
            await saveUserProfile(newProfile);
            activeProfile = newProfile;
          } else {
            activeProfile = profile;
          }

          setUser({
            uid: sessionUser.id,
            email: activeProfile.email,
            displayName: activeProfile.displayName,
            photoURL: activeProfile.photoURL,
            phoneNumber: phoneNumber
          });
          setUserProfile(activeProfile);
          setLoading(false);
          return { user: sessionUser };
        }
      };
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const confirmPhoneOtp = async (confirmationResult: any, code: string) => {
    setLoading(true);
    setIsGuest(false);
    localStorage.removeItem('noteweb-is-guest');
    try {
      // Execute the confirm method on confirmationResult
      await confirmationResult.confirm(code);
    } catch (error) {
      setLoading(false);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginAsGuest = () => {
    setIsGuest(true);
    localStorage.setItem('noteweb-is-guest', 'true');
    localStorage.removeItem('noteweb-mock-uid');

    const guestProfile: UserProfile = {
      uid: 'guest-user-noteweb',
      username: 'guest',
      email: 'guest@noteweb.local',
      displayName: 'Guest Student',
      mobileNo: '',
      year: '1',
      branch: 'cse',
      photoURL: '',
      role: 'student',
      createdAt: new Date(),
      bookmarks: [],
      points: 0
    };
    setUser(null);
    setUserProfile(guestProfile);
  };

  const logout = async () => {
    setLoading(true);
    setIsGuest(false);

    // Remove presence before sign-out
    try { await leavePresence(); } catch (_) {}
    
    // Clear all cached local storage keys for profiles to avoid session/role contamination
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('noteweb-profile-') || key === 'noteweb-mock-uid' || key === 'noteweb-is-guest')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn("Failed to clear profile cache from localStorage:", e);
    }

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Supabase signout failed:", e);
    }
    setUser(null);
    setUserProfile(null);
    setLoading(false);
  };

  const updateProfileDetails = async (displayName: string, photoURL?: string) => {
    if (isGuest) throw new Error('Guests cannot update profiles');
    if (!user) throw new Error('No authenticated user');

    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          photo_url: photoURL || ''
        }
      });
      if (authError) throw authError;

      const updates: Partial<UserProfile> = {
        displayName,
        setupComplete: true
      };
      if (photoURL !== undefined) updates.photoURL = photoURL;

      if (userProfile) {
        const updatedProfile = { ...userProfile, ...updates };
        await saveUserProfile(updatedProfile);
        setUserProfile(updatedProfile);
      }

      setUser((prev) => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error("Failed to update profile", error);
      throw error;
    }
  };

  const toggleBookmark = async (noteId: string) => {
    if (isGuest) throw new Error('Guests cannot bookmark notes');
    if (!user || !userProfile) throw new Error('User not logged in');

    const isBookmarked = userProfile.bookmarks.includes(noteId);
    const nextBookmarks = isBookmarked
      ? userProfile.bookmarks.filter(id => id !== noteId)
      : [...userProfile.bookmarks, noteId];

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          bookmarks: nextBookmarks
        })
        .eq('id', user.uid);

      if (error) throw error;

      const updatedProfile = {
        ...userProfile,
        bookmarks: nextBookmarks
      };
      localStorage.setItem(`noteweb-profile-${user.uid}`, JSON.stringify(updatedProfile));
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      throw error;
    }
  };

  const loginWithUsername = async (username: string): Promise<UserProfile> => {
    setLoading(true);
    setIsGuest(false);
    localStorage.removeItem('noteweb-is-guest');

    try {
      const sanitizedUsername = username.trim().toLowerCase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', sanitizedUsername);

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('Username not found. Please register first.');
      }

      const profile = dbToProfile(data[0]);
      
      // Capture and update IP address on login
      let userIp = '';
      try {
        const fetchIpRes = await fetch('https://api.seeip.org/jsonip', { signal: AbortSignal.timeout(1500) }).then(r => r.json());
        userIp = fetchIpRes.ip || '';
      } catch {
        try {
          const fetchIpRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(1500) }).then(r => r.json());
          userIp = fetchIpRes.ip || '';
        } catch {}
      }

      const userHwId = getHardwareId();
      profile.hardwareId = userHwId;
      if (userIp) {
        profile.lastIp = userIp;
      }
      
      // Update database with latest IP address and hardware fingerprint silently
      try {
        await supabase.from('profiles').update({ 
          last_ip: userIp || profile.lastIp || '',
          hardware_id: userHwId 
        }).eq('id', profile.uid);
      } catch (dbErr) {
        console.warn("Failed silently stashing login IP/HW identifiers:", dbErr);
      }

      localStorage.setItem('noteweb-mock-uid', profile.uid);
      localStorage.setItem(`noteweb-profile-${profile.uid}`, JSON.stringify(profile));
      
      setUser({
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
      });
      setUserProfile(profile);
      setLoading(false);
      return profile;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const registerUser = async (
    profileData: Omit<UserProfile, 'uid' | 'createdAt' | 'bookmarks' | 'points'>
  ): Promise<UserProfile> => {
    setLoading(true);
    setIsGuest(false);
    localStorage.removeItem('noteweb-is-guest');

    try {
      const sanitizedUsername = profileData.username.trim().toLowerCase();
      
      // Check if username exists
      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', sanitizedUsername);

      if (checkError) throw checkError;

      if (existing && existing.length > 0) {
        throw new Error('Username is already taken.');
      }

      const uid = `mock-user-${Math.random().toString(36).substr(2, 9)}`;
      // Role is set by the caller. Admin role is already gated behind the secret
      // password ("Whantom") in the Login page UI before registerUser is called.
      const role: 'student' | 'admin' = profileData.role === 'admin' ? 'admin' : 'student';

      // Fetch latest IP address for registration
      let userIp = '';
      try {
        const fetchIpRes = await fetch('https://api.seeip.org/jsonip', { signal: AbortSignal.timeout(1500) }).then(r => r.json());
        userIp = fetchIpRes.ip || '';
      } catch {
        try {
          const fetchIpRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(1500) }).then(r => r.json());
          userIp = fetchIpRes.ip || '';
        } catch {}
      }

      const newProfile: UserProfile = {
        uid,
        username: sanitizedUsername,
        email: profileData.email || `${sanitizedUsername}@noteweb.local`,
        displayName: profileData.displayName,
        mobileNo: profileData.mobileNo,
        year: profileData.year,
        branch: profileData.branch,
        cgpa: profileData.cgpa || '',
        photoURL: profileData.photoURL,
        role: role,
        createdAt: new Date(),
        bookmarks: [],
        setupComplete: true,
        points: role === 'admin' ? 0 : 50, // 50 XP startup bonus for new students!
        lastIp: userIp,
        hardwareId: getHardwareId()
      };

      await saveUserProfile(newProfile);
      localStorage.setItem('noteweb-mock-uid', uid);

      setUser({
        uid,
        email: newProfile.email,
        displayName: newProfile.displayName,
        photoURL: newProfile.photoURL,
      });
      setUserProfile(newProfile);
      setLoading(false);
      return newProfile;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const updatePoints = async (additionalPoints: number) => {
    if (isGuest) return;
    if (!user || !userProfile) throw new Error('User not logged in');

    const nextPoints = Math.max(0, (userProfile.points || 0) + additionalPoints);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          points: nextPoints
        })
        .eq('id', user.uid);

      if (error) throw error;

      const updatedProfile = {
        ...userProfile,
        points: nextPoints
      };
      localStorage.setItem(`noteweb-profile-${user.uid}`, JSON.stringify(updatedProfile));
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error('Error updating points:', error);
      throw error;
    }
  };

  const updateFullProfile = async (profileUpdates: Partial<UserProfile>) => {
    if (isGuest) throw new Error('Guests cannot edit profiles');
    if (!user || !userProfile) throw new Error('User not logged in');

    try {
      const updatedProfile = {
        ...userProfile,
        ...profileUpdates
      };
      const dbProfile = profileToDb(updatedProfile);
      
      const { error } = await supabase
        .from('profiles')
        .update(dbProfile)
        .eq('id', user.uid);

      if (error) {
        if (error.message?.includes('column') || error.code === '42703') {
          const dbProfileCamel = profileToDbCamel(updatedProfile);
          const { error: camelErr } = await supabase
            .from('profiles')
            .update(dbProfileCamel)
            .eq('id', user.uid);
          
          if (camelErr) throw camelErr;
        } else {
          throw error;
        }
      }

      localStorage.setItem(`noteweb-profile-${user.uid}`, JSON.stringify(updatedProfile));
      setUserProfile(updatedProfile);
      
      setUser((prev) => prev ? {
        ...prev,
        displayName: updatedProfile.displayName,
        photoURL: updatedProfile.photoURL,
        email: updatedProfile.email
      } : null);
    } catch (error) {
      console.error('Error updating full profile:', error);
      throw error;
    }
  };

  const isAdmin = userProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      isAdmin,
      isGuest,
      isMockMode,
      signup,
      login,
      signInWithPhone,
      confirmPhoneOtp,
      loginAsGuest,
      logout,
      updateProfileDetails,
      toggleBookmark,
      loginWithUsername,
      registerUser,
      updatePoints,
      updateFullProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
