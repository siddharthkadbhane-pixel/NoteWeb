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
    const email = (dbRow.email || '').toLowerCase().trim();
    const username = (dbRow.username || '').toLowerCase().trim();
    
    // 1. Read admin whitelists from env
    const envAdminEmails = import.meta.env.VITE_ADMIN_EMAILS
      ? import.meta.env.VITE_ADMIN_EMAILS.split(',').map((e: string) => e.trim().toLowerCase())
      : [];
      
    // 2. Predefined legitimate patterns & mock admin account checks
    const isMockGoogleAdmin = username === 'google' || email === 'google@noteweb.local';
    const hasAdminEmailPattern = email.startsWith('admin@') || 
                                 email.includes('admin.noteweb') ||
                                 username === 'admin' ||
                                 username === 'siddharth' ||
                                 username === 'sid_phantom' ||
                                 email === 'siddharth@noteweb.local';
                                 
    const isExplicitAdmin = envAdminEmails.includes(email) || envAdminEmails.includes(username);

    if (isMockGoogleAdmin || hasAdminEmailPattern || isExplicitAdmin) {
      role = 'admin';
    } else {
      console.warn(
        `[NoteWeb Security Guard] Prevented unauthorized admin access elevation for user: "${username}" (${email}). ` +
        `Downgrading role to "student". To whitelist this user as admin, add their email/username to VITE_ADMIN_EMAILS in .env.`
      );
      role = 'student';
    }
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
    points: dbRow.points !== undefined ? Number(dbRow.points) : 0
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
    points: profile.points
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
    points: profile.points
  };
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
        branch: 'computers',
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
            branch: 'computers',
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
        branch: 'computers',
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
          branch: 'computers',
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
              branch: 'computers',
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
      branch: 'computers',
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
      // SECURITY: Always force 'student' role on self-registration.
      // Admin accounts must be created directly in the Supabase database by a real admin.
      const role: 'student' | 'admin' = 'student';

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
        points: profileData.role === 'admin' ? 0 : 50, // 50 XP startup bonus!
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
