import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase/config';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'student' | 'admin';
  createdAt: any;
  bookmarks: string[];
  setupComplete?: boolean;
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
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signInWithPhone: (phoneNumber: string, appVerifier?: any) => Promise<any>;
  confirmPhoneOtp: (confirmationResult: any, code: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  updateProfileDetails: (displayName: string, photoURL?: string) => Promise<void>;
  toggleBookmark: (noteId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


const dbToProfile = (dbRow: any): UserProfile => {
  return {
    uid: dbRow.id || dbRow.uid,
    email: dbRow.email || '',
    displayName: dbRow.display_name || dbRow.displayName || '',
    photoURL: dbRow.photo_url || dbRow.photoURL || '',
    role: dbRow.role || 'student',
    createdAt: dbRow.created_at || dbRow.createdAt || new Date(),
    bookmarks: dbRow.bookmarks || [],
    setupComplete: dbRow.setup_complete !== undefined ? dbRow.setup_complete : dbRow.setupComplete
  };
};

const profileToDb = (profile: UserProfile): any => {
  return {
    id: profile.uid,
    email: profile.email,
    display_name: profile.displayName,
    photo_url: profile.photoURL,
    role: profile.role,
    created_at: profile.createdAt instanceof Date ? profile.createdAt.toISOString() : profile.createdAt,
    bookmarks: profile.bookmarks,
    setup_complete: profile.setupComplete
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
        // If profile already exists, perform update
        await supabase
          .from('profiles')
          .update(dbProfile)
          .eq('id', profile.uid);
      }
    } catch (e) {
      console.warn("Database profiles save failed, saving locally:", e);
    }
    localStorage.setItem(`noteweb-profile-${profile.uid}`, JSON.stringify(profile));
  };

  // Helper to check if this is the very first user in the database to seed Admin role
  const checkIsFirstUser = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id');
      
      if (error) throw error;
      return !data || data.length === 0;
    } catch (e) {
      console.warn("Could not query profiles count, defaulting to false admin seeding:", e);
      return false;
    }
  };

  useEffect(() => {
    if (isGuest) {
      const guestProfile: UserProfile = {
        uid: 'guest-user-noteweb',
        email: 'guest@noteweb.local',
        displayName: 'Guest Student',
        photoURL: '',
        role: 'student',
        createdAt: new Date(),
        bookmarks: []
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
          const isFirstUser = await checkIsFirstUser();
          const initialProfile: UserProfile = {
            uid: sessionUser.id,
            email: sessionUser.email || '',
            displayName: sessionUser.user_metadata?.display_name || 'Student',
            photoURL: sessionUser.user_metadata?.photo_url || '',
            role: isFirstUser ? 'admin' : 'student',
            createdAt: new Date(),
            bookmarks: [],
            setupComplete: false
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
            setLoading(false);
            return;
          }
        }
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
      const isFirst = await checkIsFirstUser();
      const role = isFirst ? 'admin' : 'student';

      const userProfileData: UserProfile = {
        uid: sessionUser.id,
        email: email,
        displayName: displayName,
        photoURL: '',
        role: role,
        createdAt: new Date(),
        bookmarks: [],
        setupComplete: false
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
        const isFirst = await checkIsFirstUser();
        const fallbackProfile: UserProfile = {
          uid: sessionUser.id,
          email: sessionUser.email || email,
          displayName: sessionUser.user_metadata?.display_name || email.split('@')[0],
          photoURL: sessionUser.user_metadata?.photo_url || '',
          role: isFirst ? 'admin' : 'student',
          createdAt: new Date(),
          bookmarks: [],
          setupComplete: false
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
          if (!profile) {
            const isFirst = await checkIsFirstUser();
            const role = isFirst ? 'admin' : 'student';
            profile = {
              uid: sessionUser.id,
              email: sessionUser.email || `${phoneNumber.replace(/\D/g, '')}@noteweb.local`,
              displayName: sessionUser.user_metadata?.display_name || `Student ${phoneNumber}`,
              photoURL: sessionUser.user_metadata?.photo_url || '',
              role: role,
              createdAt: new Date(),
              bookmarks: [],
              setupComplete: false
            };
            await saveUserProfile(profile);
          }

          setUser({
            uid: sessionUser.id,
            email: profile.email,
            displayName: profile.displayName,
            photoURL: profile.photoURL,
            phoneNumber: phoneNumber
          });
          setUserProfile(profile);
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
      email: 'guest@noteweb.local',
      displayName: 'Guest Student',
      photoURL: '',
      role: 'student',
      createdAt: new Date(),
      bookmarks: []
    };
    setUser(null);
    setUserProfile(guestProfile);
  };

  const logout = async () => {
    setLoading(true);
    setIsGuest(false);
    localStorage.removeItem('noteweb-is-guest');
    localStorage.removeItem('noteweb-mock-uid');
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

  const isAdmin = userProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      isAdmin,
      isGuest,
      signup,
      login,
      signInWithPhone,
      confirmPhoneOtp,
      loginAsGuest,
      logout,
      updateProfileDetails,
      toggleBookmark
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
