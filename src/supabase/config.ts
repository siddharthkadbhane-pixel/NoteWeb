import { createClient } from '@supabase/supabase-js';

// Environment parameters with mock defaults for sandbox boots
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'mock-supabase-url';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-supabase-anon-key';

const isMockMode = supabaseUrl.includes('mock') || !import.meta.env.VITE_SUPABASE_URL;

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

  // Support direct Promise-like syntax (await supabase.from()...)
  async then(onfulfilled?: (value: any) => any) {
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

    const response = { data: resultData, error: null };
    return onfulfilled ? onfulfilled(response) : response;
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

// Export active Supabase client instance
export const supabase = isMockMode 
  ? mockPostgresSeedAndReturnMock() 
  : createClient(supabaseUrl, supabaseKey);

// Function to seed default branches and categories locally if empty
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

  return mockSupabase;
}
