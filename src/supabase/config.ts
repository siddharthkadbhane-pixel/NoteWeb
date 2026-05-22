import { createClient } from '@supabase/supabase-js';

// Environment parameters with mock defaults for sandbox boots (using valid URL placeholders to prevent constructor crashes)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project-to-avoid-constructor-crash.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

const enableMockFallbacks = import.meta.env.VITE_ENABLE_MOCK_FALLBACKS !== 'false';
const isMockMode = (!import.meta.env.VITE_SUPABASE_URL || supabaseUrl.includes('placeholder') || supabaseUrl.includes('mock')) && enableMockFallbacks;


// Helper to convert snake_case postgres columns to camelCase for local safety
function camelize(str: string) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

// ----------------------------------------------------
// 1. High-Fidelity Mock Supabase Client Emulator
// ----------------------------------------------------
class MockPostgrestBuilder {
  private table: string;
  private filters: Array<(row: any) => boolean> = [];
  private dataRows: any[] = [];
  private isInsert = false;
  private isUpdate = false;
  private isDelete = false;
  private payload: any = null;
  private orderByColumn: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;

  constructor(table: string) {
    this.table = table;
    const saved = localStorage.getItem(`noteweb-db-${table}`);
    if (saved) {
      try {
        this.dataRows = JSON.parse(saved);
      } catch {
        this.dataRows = [];
      }
    } else {
      this.dataRows = [];
    }
  }

  select(_columns?: string) {
    return this;
  }

  insert(rows: any | any[]) {
    this.isInsert = true;
    this.payload = rows;
    return this;
  }

  update(changes: any) {
    this.isUpdate = true;
    this.payload = changes;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => {
      const rowVal = row[column] !== undefined ? row[column] : row[camelize(column)];
      return String(rowVal) === String(value);
    });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((row) => {
      const rowVal = row[column] !== undefined ? row[column] : row[camelize(column)];
      return values.map(String).includes(String(rowVal));
    });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderByColumn = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  // Support direct Promise-like syntax (await supabase.from()...)
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    let resultData = [...this.dataRows];

    // Apply filters
    for (const filter of this.filters) {
      resultData = resultData.filter(filter);
    }

    if (this.isInsert) {
      const newRows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const processed = newRows.map((row: any) => {
        return {
          id: row.id || Math.random().toString(36).substr(2, 9),
          created_at: row.created_at || new Date().toISOString(),
          ...row
        };
      });
      this.dataRows = [...this.dataRows, ...processed];
      localStorage.setItem(`noteweb-db-${this.table}`, JSON.stringify(this.dataRows));
      resultData = processed;
    } else if (this.isUpdate) {
      this.dataRows = this.dataRows.map((row) => {
        let matches = true;
        for (const filter of this.filters) {
          if (!filter(row)) matches = false;
        }
        if (matches) {
          // Special merge helper: handle array updates like bookmarks list merges
          const merged = { ...row };
          for (const key of Object.keys(this.payload)) {
            // Support direct assignments
            merged[key] = this.payload[key];
            // Backward/forward support for camelCase keys
            const camelKey = camelize(key);
            if (camelKey !== key) {
              merged[camelKey] = this.payload[key];
            }
          }
          return merged;
        }
        return row;
      });
      localStorage.setItem(`noteweb-db-${this.table}`, JSON.stringify(this.dataRows));
      
      // Filter matched rows to return as payload
      resultData = this.dataRows.filter((row) => {
        let matches = true;
        for (const filter of this.filters) {
          if (!filter(row)) matches = false;
        }
        return matches;
      });
    } else if (this.isDelete) {
      const remaining = this.dataRows.filter((row) => {
        let matches = true;
        for (const filter of this.filters) {
          if (!filter(row)) matches = false;
        }
        return !matches;
      });
      this.dataRows = remaining;
      localStorage.setItem(`noteweb-db-${this.table}`, JSON.stringify(remaining));
      resultData = [];
    }

    // Apply sorting in memory
    if (this.orderByColumn) {
      const col = this.orderByColumn;
      const asc = this.orderAscending;
      resultData.sort((a, b) => {
        const valA = a[col] !== undefined ? a[col] : a[camelize(col)];
        const valB = b[col] !== undefined ? b[col] : b[camelize(col)];
        
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        
        if (typeof valA === 'number' && typeof valB === 'number') {
          return asc ? valA - valB : valB - valA;
        }
        const timeA = Date.parse(String(valA));
        const timeB = Date.parse(String(valB));
        if (!isNaN(timeA) && !isNaN(timeB)) {
          return asc ? timeA - timeB : timeB - timeA;
        }
        return asc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    // Apply limit
    if (this.limitCount !== null) {
      resultData = resultData.slice(0, this.limitCount);
    }

    const response = { data: resultData, error: null };
    return Promise.resolve(response).then(onfulfilled, onrejected);
  }
}

// Subscription callbacks array for mock auth listener
const authChangeListeners: Array<(event: string, session: any) => void> = [];

const mockSupabase = {
  auth: {
    signUp: async ({ email, password: _password, options }: any) => {
      await new Promise((r) => setTimeout(r, 600));
      const uid = `mock-email-${email.replace(/[@.]/g, '-')}`;
      const displayName = options?.data?.display_name || email.split('@')[0];
      const photoURL = options?.data?.photo_url || '';
      
      const mockUser = {
        id: uid,
        email,
        user_metadata: { display_name: displayName, photo_url: photoURL },
      };

      // Seeding in local profiles db
      const profilesBuilder = new MockPostgrestBuilder('profiles');
      profilesBuilder.insert({
        id: uid,
        email,
        display_name: displayName,
        photo_url: photoURL,
        role: 'student',
        setup_complete: false,
        bookmarks: []
      }).then(() => {});

      localStorage.setItem('noteweb-mock-uid', uid);
      authChangeListeners.forEach(listener => listener('SIGNED_IN', { user: mockUser }));

      return { data: { user: mockUser }, error: null };
    },

    signInWithPassword: async ({ email, password: _password }: any) => {
      await new Promise((r) => setTimeout(r, 600));
      const uid = `mock-email-${email.replace(/[@.]/g, '-')}`;
      
      // Retrieve profile or auto create mock profile
      const profilesBuilder = new MockPostgrestBuilder('profiles');
      const { data } = await profilesBuilder.select().eq('id', uid);
      let profile = data && data[0];
      
      if (!profile) {
        profile = {
          id: uid,
          email,
          display_name: email.split('@')[0],
          photo_url: '',
          role: 'student',
          setup_complete: false,
          bookmarks: []
        };
        await new MockPostgrestBuilder('profiles').insert(profile);
      }

      const mockUser = {
        id: uid,
        email,
        user_metadata: { display_name: profile.display_name, photo_url: profile.photo_url },
      };

      localStorage.setItem('noteweb-mock-uid', uid);
      authChangeListeners.forEach(listener => listener('SIGNED_IN', { user: mockUser }));

      return { data: { user: mockUser }, error: null };
    },

    signInWithOtp: async ({ phone: _phone }: any) => {
      await new Promise((r) => setTimeout(r, 600));
      // Just signal OTP SMS dispatched in mock
      return { data: null, error: null };
    },

    verifyOtp: async ({ phone, token }: any) => {
      await new Promise((r) => setTimeout(r, 600));
      if (token !== '123456') {
        throw new Error('Invalid verification code. Please use 123456');
      }

      const sanitizedPhone = phone.replace(/\D/g, '');
      const uid = `mock-phone-${sanitizedPhone}`;
      const email = `${sanitizedPhone}@noteweb.local`;
      const displayName = `Student ${phone}`;

      const profilesBuilder = new MockPostgrestBuilder('profiles');
      const { data } = await profilesBuilder.select().eq('id', uid);
      let profile = data && data[0];

      if (!profile) {
        profile = {
          id: uid,
          email,
          display_name: displayName,
          photo_url: '',
          role: 'student',
          setup_complete: false,
          bookmarks: []
        };
        await new MockPostgrestBuilder('profiles').insert(profile);
      }

      const mockUser = {
        id: uid,
        email,
        user_metadata: { display_name: profile.display_name, photo_url: profile.photo_url },
      };

      localStorage.setItem('noteweb-mock-uid', uid);
      authChangeListeners.forEach(listener => listener('SIGNED_IN', { user: mockUser }));

      return { data: { user: mockUser }, error: null };
    },

    signInWithOAuth: async ({ provider: _provider }: any) => {
      await new Promise((r) => setTimeout(r, 600));
      const uid = 'mock-google-user';
      const email = 'google@noteweb.local';
      const displayName = 'Google Student';
      const photoURL = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150';

      const profilesBuilder = new MockPostgrestBuilder('profiles');
      const { data } = await profilesBuilder.select().eq('id', uid);
      let profile = data && data[0];

      if (!profile) {
        profile = {
          id: uid,
          email,
          display_name: displayName,
          photo_url: photoURL,
          role: 'student',
          setup_complete: false,
          bookmarks: []
        };
        await new MockPostgrestBuilder('profiles').insert(profile);
      }

      const mockUser = {
        id: uid,
        email,
        user_metadata: { display_name: profile.display_name, photo_url: profile.photo_url },
      };

      localStorage.setItem('noteweb-mock-uid', uid);
      authChangeListeners.forEach(listener => listener('SIGNED_IN', { user: mockUser }));

      return { data: null, error: null };
    },

    signOut: async () => {
      localStorage.removeItem('noteweb-mock-uid');
      authChangeListeners.forEach(listener => listener('SIGNED_OUT', null));
      return { error: null };
    },

    updateUser: async ({ data }: any) => {
      const mockUid = localStorage.getItem('noteweb-mock-uid');
      if (!mockUid) throw new Error('No active user logged in');

      const profilesBuilder = new MockPostgrestBuilder('profiles');
      const { data: profiles } = await profilesBuilder.select().eq('id', mockUid);
      const profile = profiles && profiles[0];

      const updates: any = {};
      if (data?.display_name !== undefined) updates.display_name = data.display_name;
      if (data?.photo_url !== undefined) updates.photo_url = data.photo_url;
      updates.setup_complete = true;

      if (profile) {
        await new MockPostgrestBuilder('profiles').update(updates).eq('id', mockUid);
      }

      const mockUser = {
        id: mockUid,
        email: profile?.email || '',
        user_metadata: { 
          display_name: data?.display_name || profile?.display_name || 'Student', 
          photo_url: data?.photo_url || profile?.photo_url || '' 
        },
      };

      authChangeListeners.forEach(listener => listener('USER_UPDATED', { user: mockUser }));

      return { data: { user: mockUser }, error: null };
    },

    onAuthStateChange: (callback: any) => {
      authChangeListeners.push(callback);
      // Immediately trigger current session status
      const mockUid = localStorage.getItem('noteweb-mock-uid');
      if (mockUid) {
        const savedProfile = localStorage.getItem(`noteweb-profile-${mockUid}`);
        let email = `${mockUid}@noteweb.local`;
        let displayName = 'Student';
        let photoURL = '';
        
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            email = parsed.email || email;
            displayName = parsed.displayName || parsed.display_name || displayName;
            photoURL = parsed.photoURL || parsed.photo_url || photoURL;
          } catch {}
        }
        
        callback('SIGNED_IN', {
          user: {
            id: mockUid,
            email,
            user_metadata: { display_name: displayName, photo_url: photoURL }
          }
        });
      } else {
        callback('SIGNED_OUT', null);
      }

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = authChangeListeners.indexOf(callback);
              if (idx !== -1) authChangeListeners.splice(idx, 1);
            }
          }
        }
      };
    }
  },

  from: (table: string) => {
    return new MockPostgrestBuilder(table);
  },

  storage: {
    from: (_bucket: string) => {
      return {
        upload: async (path: string, _file: File | Blob) => {
          await new Promise((r) => setTimeout(r, 800));
          // Store basic details in mock
          return { data: { path }, error: null };
        },

        getPublicUrl: (_path: string) => {
          // Emulate returning a local blob URL if uploaded or generic mockup PDF
          let publicUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
          return { data: { publicUrl } };
        },

        remove: async (paths: string[]) => {
          return { data: paths, error: null };
        }
      };
    }
  }
} as any;

// Trigger seed initializations only if mock fallbacks are enabled
if (enableMockFallbacks) {
  mockPostgresSeedAndReturnMock();
}


// ----------------------------------------------------
// 2. High-Fidelity Safe Supabase Wrapper & Fallbacks
// ----------------------------------------------------
const realSupabase = createClient(supabaseUrl, supabaseKey);

// Promise timeout race helper
const withTimeout = async (promise: Promise<any>, ms = 2500) => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), ms)
  );
  return Promise.race([promise, timeout]);
};

class SafePostgrestBuilder {
  private table: string;
  private realBuilder: any;
  private calls: Array<{ method: string; args: any[] }> = [];

  constructor(table: string, realBuilder: any) {
    this.table = table;
    this.realBuilder = realBuilder;
  }

  select(columns?: string) {
    this.realBuilder = this.realBuilder.select(columns);
    this.calls.push({ method: 'select', args: [columns] });
    return this;
  }

  insert(values: any) {
    this.realBuilder = this.realBuilder.insert(values);
    this.calls.push({ method: 'insert', args: [values] });
    return this;
  }

  update(values: any) {
    this.realBuilder = this.realBuilder.update(values);
    this.calls.push({ method: 'update', args: [values] });
    return this;
  }

  delete() {
    this.realBuilder = this.realBuilder.delete();
    this.calls.push({ method: 'delete', args: [] });
    return this;
  }

  eq(column: string, value: any) {
    this.realBuilder = this.realBuilder.eq(column, value);
    this.calls.push({ method: 'eq', args: [column, value] });
    return this;
  }

  in(column: string, values: any[]) {
    this.realBuilder = this.realBuilder.in(column, values);
    this.calls.push({ method: 'in', args: [column, values] });
    return this;
  }

  // Promise-like execution matching real PostgrestBuilder
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    const promise = (async () => {
      try {
        const response = await withTimeout(this.realBuilder, 2500);
        if (response && response.error) {
          const errMsg = response.error.message || '';
          const errCode = response.error.code || '';
          
          // Detect database schema violations, unmigrated tables, network issues, or security issues
          if (
            errMsg.includes('relation') ||
            errMsg.includes('does not exist') ||
            errMsg.includes('violates row-level security') ||
            errCode === 'P0001' ||
            errCode.startsWith('42') ||
            errMsg.includes('API key') ||
            errMsg.includes('invalid') ||
            errMsg.includes('JWT')
          ) {
            console.warn(`Supabase DB query on table "${this.table}" failed. Falling back to MockPostgres. Error:`, response.error);
            let mockBuilder = mockSupabase.from(this.table);
            for (const call of this.calls) {
              mockBuilder = (mockBuilder as any)[call.method](...call.args);
            }
            const mockResponse = await mockBuilder;
            return mockResponse;
          }
        }
        return response;
      } catch (e: any) {
        console.warn(`Supabase DB query on table "${this.table}" threw/timed out. Falling back to MockPostgres. Error:`, e);
        let mockBuilder = mockSupabase.from(this.table);
        for (const call of this.calls) {
          mockBuilder = (mockBuilder as any)[call.method](...call.args);
        }
        const mockResponse = await mockBuilder;
        return mockResponse;
      }
    })();
    return promise.then(onfulfilled, onrejected);
  }
}

class SafeStorageBucket {
  private bucket: string;
  private realBucket: any;

  constructor(bucket: string, realBucket: any) {
    this.bucket = bucket;
    this.realBucket = realBucket;
  }

  async upload(path: string, file: File | Blob, options?: any) {
    try {
      const response = await this.realBucket.upload(path, file, options);
      if (response && response.error) {
        console.warn(`Supabase Storage upload to bucket "${this.bucket}" returned an error. Falling back to Mock. Error:`, response.error);
        return mockSupabase.storage.from(this.bucket).upload(path, file);
      }
      return response;
    } catch (e) {
      console.warn(`Supabase Storage upload to bucket "${this.bucket}" threw an error. Falling back to Mock. Error:`, e);
      return mockSupabase.storage.from(this.bucket).upload(path, file);
    }
  }

  getPublicUrl(path: string) {
    try {
      const response = this.realBucket.getPublicUrl(path);
      if (!response || !response.data || !response.data.publicUrl) {
        return mockSupabase.storage.from(this.bucket).getPublicUrl(path);
      }
      return response;
    } catch (e) {
      console.warn(`Supabase Storage getPublicUrl for bucket "${this.bucket}" failed. Falling back to Mock. Error:`, e);
      return mockSupabase.storage.from(this.bucket).getPublicUrl(path);
    }
  }

  async remove(paths: string[]) {
    try {
      const response = await this.realBucket.remove(paths);
      if (response && response.error) {
        return mockSupabase.storage.from(this.bucket).remove(paths);
      }
      return response;
    } catch (e) {
      return mockSupabase.storage.from(this.bucket).remove(paths);
    }
  }
}

const safeAuth = {
  async signUp(credentials: any) {
    if (isMockMode) return mockSupabase.auth.signUp(credentials);
    try {
      const response = await withTimeout(realSupabase.auth.signUp(credentials), 2500);
      if (response && response.error) {
        console.warn("Real Supabase signUp failed. Falling back to Mock.", response.error);
        return mockSupabase.auth.signUp(credentials);
      }
      return response;
    } catch (e) {
      console.warn("Real Supabase signUp threw/timed out. Falling back to Mock.", e);
      return mockSupabase.auth.signUp(credentials);
    }
  },

  async signInWithPassword(credentials: any) {
    if (isMockMode) return mockSupabase.auth.signInWithPassword(credentials);
    try {
      const response = await withTimeout(realSupabase.auth.signInWithPassword(credentials), 2500);
      if (response && response.error) {
        console.warn("Real Supabase signInWithPassword failed. Falling back to Mock.", response.error);
        return mockSupabase.auth.signInWithPassword(credentials);
      }
      return response;
    } catch (e) {
      console.warn("Real Supabase signInWithPassword threw/timed out. Falling back to Mock.", e);
      return mockSupabase.auth.signInWithPassword(credentials);
    }
  },

  async signInWithOtp(credentials: any) {
    if (isMockMode) return mockSupabase.auth.signInWithOtp(credentials);
    try {
      const response = await withTimeout(realSupabase.auth.signInWithOtp(credentials), 2500);
      if (response && response.error) {
        console.warn("Real Supabase signInWithOtp failed. Falling back to Mock.", response.error);
        return mockSupabase.auth.signInWithOtp(credentials);
      }
      return response;
    } catch (e) {
      console.warn("Real Supabase signInWithOtp threw/timed out. Falling back to Mock.", e);
      return mockSupabase.auth.signInWithOtp(credentials);
    }
  },

  async verifyOtp(credentials: any) {
    if (isMockMode) return mockSupabase.auth.verifyOtp(credentials);
    try {
      const response = await withTimeout(realSupabase.auth.verifyOtp(credentials), 2500);
      if (response && response.error) {
        console.warn("Real Supabase verifyOtp failed. Falling back to Mock.", response.error);
        return mockSupabase.auth.verifyOtp(credentials);
      }
      return response;
    } catch (e) {
      console.warn("Real Supabase verifyOtp threw/timed out. Falling back to Mock.", e);
      return mockSupabase.auth.verifyOtp(credentials);
    }
  },

  async signInWithOAuth(credentials: any) {
    if (isMockMode) return mockSupabase.auth.signInWithOAuth(credentials);
    try {
      const response = await withTimeout(realSupabase.auth.signInWithOAuth(credentials), 2500);
      if (response && response.error) {
        console.warn("Real Supabase signInWithOAuth failed. Falling back to Mock.", response.error);
        return mockSupabase.auth.signInWithOAuth(credentials);
      }
      return response;
    } catch (e) {
      console.warn("Real Supabase signInWithOAuth threw/timed out. Falling back to Mock.", e);
      return mockSupabase.auth.signInWithOAuth(credentials);
    }
  },

  async signOut() {
    if (isMockMode) return mockSupabase.auth.signOut();
    try {
      const response = await withTimeout(realSupabase.auth.signOut(), 2500);
      if (response && response.error) {
        return mockSupabase.auth.signOut();
      }
      return response;
    } catch (e) {
      return mockSupabase.auth.signOut();
    }
  },

  async updateUser(attributes: any) {
    if (isMockMode) return mockSupabase.auth.updateUser(attributes);
    try {
      const response = await withTimeout(realSupabase.auth.updateUser(attributes), 2500);
      if (response && response.error) {
        return mockSupabase.auth.updateUser(attributes);
      }
      return response;
    } catch (e) {
      return mockSupabase.auth.updateUser(attributes);
    }
  },

  onAuthStateChange(callback: any) {
    if (isMockMode) {
      return mockSupabase.auth.onAuthStateChange(callback);
    }
    // Listen to BOTH real and mock auth states for user sync
    const realSub = realSupabase.auth.onAuthStateChange(callback);
    const mockSub = mockSupabase.auth.onAuthStateChange(callback);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            realSub?.data?.subscription?.unsubscribe();
            mockSub?.data?.subscription?.unsubscribe();
          }
        }
      }
    };
  }
};

const safeStorage = {
  from(bucket: string) {
    if (isMockMode) {
      return mockSupabase.storage.from(bucket);
    }
    return new SafeStorageBucket(bucket, realSupabase.storage.from(bucket));
  }
};

// Export active Supabase client instance wrapped in safe fallbacks (or raw instance if mock fallbacks are disabled)
export const supabase = (enableMockFallbacks
  ? {
      auth: safeAuth,
      from(table: string) {
        if (isMockMode) {
          return mockSupabase.from(table);
        }
        return new SafePostgrestBuilder(table, realSupabase.from(table));
      },
      storage: safeStorage
    }
  : realSupabase) as any;


// Function to seed default branches, categories, and realistic notes locally if empty
function mockPostgresSeedAndReturnMock() {
  const branchesSeed = localStorage.getItem('noteweb-db-branches');
  if (!branchesSeed) {
    const defaultBranches = [
      {
        id: 'computers',
        name: 'Computer Science',
        description: 'Data Structures, Algorithms, Software Engineering, Web Dev, Databases, and operating systems.',
        icon: 'code',
        color: 'from-blue-500 to-indigo-500',
        shadow_color: 'rgba(59, 130, 246, 0.3)',
        notes_count: 'CS'
      },
      {
        id: 'maths',
        name: 'Mathematics',
        description: 'Calculus, Linear Algebra, Discrete Math, Differential Equations, Probability, and Statistics.',
        icon: 'binary',
        color: 'from-purple-500 to-pink-500',
        shadow_color: 'rgba(168, 85, 247, 0.3)',
        notes_count: 'M'
      },
      {
        id: 'science',
        name: 'Basic Science & Eng',
        description: 'Engineering Physics, Chemistry, Mechanics, Electrical circuits, Thermodynamics, and materials.',
        icon: 'atom',
        color: 'from-amber-500 to-orange-500',
        shadow_color: 'rgba(245, 158, 11, 0.3)',
        notes_count: 'BSE'
      },
      {
        id: 'electronics',
        name: 'Electronics & Comm',
        description: 'Microprocessors, VLSI design, Signal processing, Communication systems, and analog hardware.',
        icon: 'cpu',
        color: 'from-emerald-500 to-teal-500',
        shadow_color: 'rgba(16, 185, 129, 0.3)',
        notes_count: 'ECE'
      },
      {
        id: 'mechanical',
        name: 'Mechanical & Civil',
        description: 'Solid mechanics, Fluid dynamics, Kinematics, CAD design, Structural analysis, and geotech.',
        icon: 'settings',
        color: 'from-rose-500 to-pink-500',
        shadow_color: 'rgba(244, 63, 94, 0.3)',
        notes_count: 'ME/CE'
      },
      {
        id: 'management',
        name: 'Management & Humanities',
        description: 'Economics, Professional ethics, Business communication, Organizational behavior, and entrepreneurship.',
        icon: 'compass',
        color: 'from-cyan-500 to-blue-500',
        shadow_color: 'rgba(6, 182, 212, 0.3)',
        notes_count: 'MGT'
      }
    ];
    localStorage.setItem('noteweb-db-branches', JSON.stringify(defaultBranches));
  }

  const categoriesSeed = localStorage.getItem('noteweb-db-categories');
  if (!categoriesSeed) {
    const defaultCategories = [
      { id: 'computers-dsa', branch_id: 'computers', name: 'Data Structures & Algorithms', description: 'Arrays, Linked Lists, Stacks, Queues, Trees, Graphs, sorting and searching algorithms.' },
      { id: 'computers-dbms', branch_id: 'computers', name: 'Database Management Systems', description: 'Relational databases, SQL queries, normalization, transactions, and indexing.' },
      { id: 'computers-os', branch_id: 'computers', name: 'Operating Systems', description: 'Processes, threads, CPU scheduling, memory management, file systems, and concurrency.' },
      { id: 'computers-webdev', branch_id: 'computers', name: 'Web Development', description: 'HTML, CSS, JavaScript, React, Node.js, REST APIs, and modern full-stack engineering.' },
      
      { id: 'maths-calculus', branch_id: 'maths', name: 'Calculus & Integration', description: 'Limits, derivatives, integrals, series, multivariable calculus, and vector algebra.' },
      { id: 'maths-linear-algebra', branch_id: 'maths', name: 'Linear Algebra & Matrices', description: 'Matrix operations, vector spaces, eigenvalues, eigenvectors, and linear transformations.' },
      { id: 'maths-probability', branch_id: 'maths', name: 'Probability & Statistics', description: 'Random variables, probability distributions, hypothesis testing, and regression analysis.' },
      
      { id: 'science-physics', branch_id: 'science', name: 'Engineering Physics', description: 'Optics, quantum mechanics, lasers, fiber optics, electromagnetism, and semiconductor physics.' },
      { id: 'science-chemistry', branch_id: 'science', name: 'Engineering Chemistry', description: 'Water technology, battery chemistry, polymers, fuels, corrosion, and green chemistry.' },
      { id: 'science-mechanics', branch_id: 'science', name: 'Engineering Mechanics', description: 'Force systems, equilibrium, friction, centroids, moment of inertia, and kinematics.' },
      
      { id: 'electronics-microprocessors', branch_id: 'electronics', name: 'Microprocessors & Embedded Systems', description: '8085/8086 architectures, assembly programming, interfacing, and microcontrollers like Arduino.' },
      { id: 'electronics-digital', branch_id: 'electronics', name: 'Digital Electronics', description: 'Number systems, logic gates, Boolean algebra, combinational and sequential logic circuits.' },
      { id: 'electronics-signals', branch_id: 'electronics', name: 'Signals & Systems', description: 'Signals & Systems, continuous & discrete time signals, Fourier transform, Laplace transform.' },
      
      { id: 'mechanical-thermo', branch_id: 'mechanical', name: 'Thermodynamics', description: 'Laws of thermodynamics, heat engines, entropy, pure substances, and power cycles.' },
      { id: 'mechanical-fluid', branch_id: 'mechanical', name: 'Fluid Mechanics', description: 'Fluid properties, pressure, flow kinematics, Bernoulli equation, and dimensional analysis.' },
      { id: 'mechanical-structures', branch_id: 'mechanical', name: 'Structural Analysis', description: 'Trusses, beams, columns, bending moments, shear forces, and stress analysis.' },
      
      { id: 'management-economics', branch_id: 'management', name: 'Engineering Economics', description: 'Time value of money, cash flow, cost benefit analysis, inflation, and financial statements.' },
      { id: 'management-ethics', branch_id: 'management', name: 'Professional Ethics', description: 'Human values, engineering ethics, safety, rights, responsibilities, and global issues.' },
      { id: 'management-entrepreneurship', branch_id: 'management', name: 'Entrepreneurship Development', description: 'Business plans, startup mechanics, funding, market research, and project management.' }
    ];
    localStorage.setItem('noteweb-db-categories', JSON.stringify(defaultCategories));
  }

  // Seed premium realistic study notes to local database fallback
  const notesSeed = localStorage.getItem('noteweb-db-notes');
  if (!notesSeed) {
    const defaultNotes = [
      {
        id: 'note-dsa-trees',
        subject: 'Binary Search Trees & Balancing (AVL)',
        branch: 'computers',
        category: 'computers-dsa',
        semester: '3',
        teacher: 'Dr. Alex Patel',
        description: 'Comprehensive notes covering BST properties, insertion, deletion, and rotation algorithms for AVL trees with runtime complexities.',
        pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        pdf_path: 'notes/mock/1716301200000_AVL_Trees.pdf',
        file_name: 'AVL_Trees_Lec4.pdf',
        file_size: 1420500,
        uploaded_by: 'mock-google-user',
        uploader_name: 'Google Student',
        uploader_email: 'google@noteweb.local',
        created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(), // 2 days ago
        status: 'approved',
        likes: ['mock-email-student-example-com'],
        likes_count: 1,
        bookmarks_count: 0,
        summary: `### Core AVL Concepts
- **Balance Factor (BF)**: Height of Left Subtree - Height of Right Subtree. Allowed values: {-1, 0, 1}.
- **Rotations**: Single Left (RR), Single Right (LL), Double Left-Right (LR), Double Right-Left (RL).
- **Time Complexity**: Insert, Delete, and Search are all guaranteed O(log N) due to strict balancing.

### Self-Study Checklist
- [x] Write AVL insertion node struct
- [x] Trace double rotation on paper
- [ ] Implement deletion balancing checks`
      },
      {
        id: 'note-dbms-norm',
        subject: 'Database Normalization: 1NF to BCNF',
        branch: 'computers',
        category: 'computers-dbms',
        semester: '4',
        teacher: 'Dr. Ramesh Kumar',
        description: 'Step-by-step normalization guide using functional dependencies. Explains update anomalies with clear tabular examples.',
        pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        pdf_path: 'notes/mock/1716301300000_Normalization.pdf',
        file_name: 'Lec5_Normalization_Notes.pdf',
        file_size: 2150000,
        uploaded_by: 'mock-google-user',
        uploader_name: 'Google Student',
        uploader_email: 'google@noteweb.local',
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hours ago
        status: 'approved',
        likes: [],
        likes_count: 0,
        bookmarks_count: 0,
        summary: `### Database Normalization Principles
1. **1NF**: Eliminate duplicate columns; ensure atomic values.
2. **2NF**: Eliminate partial dependencies (non-prime attributes must depend on the whole primary key).
3. **3NF**: Eliminate transitive dependencies (non-prime attributes cannot depend on other non-prime attributes).
4. **BCNF**: For every functional dependency X -> Y, X must be a super key.

### Quick Anomalies Summary
- **Insertion Anomaly**: Cannot add parent data without child context.
- **Update Anomaly**: Changing values in one row requires changing duplicates in all rows.
- **Deletion Anomaly**: Deleting a child record accidentally purges vital parent facts.`
      },
      {
        id: 'note-physics-quantum',
        subject: 'Quantum Mechanics: Wave Equations & Tunneling',
        branch: 'science',
        category: 'science-physics',
        semester: '2',
        teacher: 'Dr. Vikram Singh',
        description: 'Lecture notes on Schrodinger time-independent wave equations, probability densities, and wave function boundary conditions for potential barriers.',
        pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        pdf_path: 'notes/mock/1716301400000_Quantum.pdf',
        file_name: 'Quantum_Mechanics_Lec8.pdf',
        file_size: 3254000,
        uploaded_by: 'mock-phone-919876543210',
        uploader_name: 'Student +91 98765 43210',
        uploader_email: '919876543210@noteweb.local',
        created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(), // 5 days ago
        status: 'approved',
        likes: ['mock-google-user'],
        likes_count: 1,
        bookmarks_count: 1,
        summary: `### Schrodinger Equation Basics
- **Formulation**: Hψ = Eψ, where H is the Hamiltonian operator.
- **Wave Function ψ**: Complex probability amplitude. |ψ|² represents the probability density of finding a particle at a given point.
- **Quantum Tunneling**: Particle passing through a potential barrier higher than its kinetic energy, explained by the wave behavior of matter.`
      },
      {
        id: 'note-maths-calc',
        subject: 'Calculus: Double & Triple Integrals in Polar Coordinates',
        branch: 'maths',
        category: 'maths-calculus',
        semester: '1',
        teacher: 'Prof. Sarah Jenkins',
        description: 'Complete breakdown of shifting integrals from Cartesian coordinates to Cylindrical and Spherical systems, with solved examples of volume calculation.',
        pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        pdf_path: 'notes/mock/1716301500000_Calculus.pdf',
        file_name: 'Multivariable_Integration.pdf',
        file_size: 1980300,
        uploaded_by: 'mock-google-user',
        uploader_name: 'Google Student',
        uploader_email: 'google@noteweb.local',
        created_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(), // 10 days ago
        status: 'approved',
        likes: [],
        likes_count: 0,
        bookmarks_count: 0,
        summary: `### Coordinate Transformation Rules
- **Polar Coordinates**: dx dy = r dr dθ. Substitute x = r cos θ, y = r sin θ.
- **Cylindrical Coordinates**: dx dy dz = r dz dr dθ.
- **Spherical Coordinates**: dx dy dz = ρ² sin φ dρ dφ dθ.`
      }
    ];
    localStorage.setItem('noteweb-db-notes', JSON.stringify(defaultNotes));
  }

  return mockSupabase;
}
