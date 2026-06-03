import { createClient } from '@supabase/supabase-js';

// Environment parameters with mock defaults (using actual publishable fallback keys to ensure multi-device cloud builds connect correctly)
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawSupabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseUrl = (rawSupabaseUrl && !rawSupabaseUrl.includes('placeholder') && !rawSupabaseUrl.includes('mock'))
  ? rawSupabaseUrl
  : 'https://uyqegcuithhbnvviujbv.supabase.co';

const supabaseKey = (rawSupabaseKey && !rawSupabaseKey.includes('placeholder') && !rawSupabaseKey.includes('mock'))
  ? rawSupabaseKey
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5cWVnY3VpdGhoYm52dml1amJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzA4NTIsImV4cCI6MjA5NDk0Njg1Mn0.BZSRDkbB9DyXo53xpYajPMUcG3GeYYwEes1mI5_vQCs';

export let realSupabase: any = null;
try {
  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder') && !supabaseUrl.includes('mock')) {
    realSupabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.warn("Failed to initialize real Supabase client:", e);
}

// Strict Live Mode enforcement: Turn off mock mode completely and connect directly to the real Supabase database.
export const isMockMode = false;
const enableMockFallbacks = false;



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
  private isUpsert = false;
  private isSingle = false;
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

  upsert(rows: any | any[]) {
    this.isUpsert = true;
    this.payload = rows;
    return this;
  }

  single() {
    this.isSingle = true;
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

  // Basic .or() support — parses simple `col.eq.val` and `col.ilike.%val%` clauses
  or(filterStr: string) {
    this.filters.push((row) => {
      const clauses = filterStr.split(',');
      return clauses.some((clause) => {
        const parts = clause.trim().split('.');
        if (parts.length >= 3) {
          const col = parts[0];
          const op = parts[1];
          const val = parts.slice(2).join('.');
          const rowVal = row[col] !== undefined ? row[col] : row[camelize(col)];
          if (op === 'eq') return String(rowVal) === String(val);
          if (op === 'neq') return String(rowVal) !== String(val);
          if (op === 'ilike' || op === 'like') {
            const cleanVal = val.replace(/%/g, '');
            return String(rowVal || '').toLowerCase().includes(cleanVal.toLowerCase());
          }
        }
        return false;
      });
    });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row) => {
      const rowVal = row[column] !== undefined ? row[column] : row[camelize(column)];
      return String(rowVal) !== String(value);
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
    } else if (this.isUpsert) {
      const rowsToUpsert = Array.isArray(this.payload) ? this.payload : [this.payload];
      const processed = rowsToUpsert.map((row: any) => {
        const idVal = row.id || row.key || Math.random().toString(36).substr(2, 9);
        return {
          id: idVal,
          created_at: row.created_at || new Date().toISOString(),
          ...row
        };
      });
      
      for (const pRow of processed) {
        const existingIdx = this.dataRows.findIndex(r => String(r.id) === String(pRow.id) || (r.key && String(r.key) === String(pRow.id)));
        if (existingIdx !== -1) {
          this.dataRows[existingIdx] = { ...this.dataRows[existingIdx], ...pRow };
        } else {
          this.dataRows.push(pRow);
        }
      }
      localStorage.setItem(`noteweb-db-${this.table}`, JSON.stringify(this.dataRows));
      resultData = processed;
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

    const response = { data: this.isSingle ? (resultData[0] || null) : resultData, error: null };
    return Promise.resolve(response).then(onfulfilled, onrejected);
  }
}

// Subscription callbacks array for mock auth listener
const authChangeListeners: Array<(event: string, session: any) => void> = [];

// Session-based + persisted in-memory store for mock uploaded binary files
// Using localStorage to persist blob URLs across page refreshes within the same session
const MOCK_STORAGE_KEY = 'noteweb-mock-storage-urls';
const mockStorageFiles = new Map<string, string>();

// Local IndexedDB helpers to store and retrieve files in Mock Mode without circular dependencies
const OFFLINE_DB_NAME = 'NoteWebOfflineCache';
const OFFLINE_STORE_NAME = 'offline-pdfs';
const OFFLINE_DB_VERSION = 1;

const getOfflineDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
        db.createObjectStore(OFFLINE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const storeOfflinePdfLocal = async (key: string, blob: Blob): Promise<void> => {
  try {
    const db = await getOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(OFFLINE_STORE_NAME);
      const request = store.put(blob, key);
      request.onsuccess = () => {
        console.log(`[Mock Storage] Stored raw file in IndexedDB under key: ${key}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to store PDF locally in IndexedDB:", err);
  }
};

// Restore any previously saved URLs from localStorage on module load.
// We also clear out any giant Base64 strings to prevent QuotaExceededError and free up browser memory!
try {
  const saved = localStorage.getItem(MOCK_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    let hasBase64 = false;
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') {
        if (v.startsWith('data:')) {
          hasBase64 = true;
        } else {
          mockStorageFiles.set(k, v);
        }
      }
    }
    if (hasBase64) {
      console.log("[Mock Storage] Wiped legacy Base64 files from localStorage to free up space!");
      // Overwrite with lightweight keys
      const obj: Record<string, string> = {};
      mockStorageFiles.forEach((val, key) => {
        obj[key] = val;
      });
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(obj));
    }
  }
} catch {}

const persistMockStorageFiles = () => {
  try {
    const obj: Record<string, string> = {};
    mockStorageFiles.forEach((v, k) => {
      // Only store a lightweight marker in localStorage if the URL is a temporary Object URL
      if (v.startsWith('blob:')) {
        obj[k] = 'indexeddb';
      } else {
        obj[k] = v;
      }
    });
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(obj));
  } catch (err) {
    console.warn("Failed to persist mock storage metadata:", err);
  }
};

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
      // Asynchronously trigger current session status to prevent synchronous state updates during React's render phase
      setTimeout(() => {
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
      }, 0);

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
        upload: async (path: string, file: File | Blob) => {
          await new Promise((r) => setTimeout(r, 800));
          try {
            if (file) {
              // Store the raw file directly in IndexedDB instead of Base64 string to prevent QuotaExceededError!
              await storeOfflinePdfLocal(path, file);
              
              // Store a temporary object URL in-memory for instant active session previews
              const objectUrl = URL.createObjectURL(file);
              mockStorageFiles.set(path, objectUrl);
              persistMockStorageFiles();
              console.log(`[Mock Storage] Successfully uploaded and cached file in IndexedDB under path: ${path}`);
            }
          } catch (e) {
            console.warn("Failed to save mock file upload to IndexedDB:", e);
          }
          return { data: { path }, error: null };
        },

        getPublicUrl: (path: string) => {
          const storedUrl = mockStorageFiles.get(path);
          if (storedUrl) {
            // If it is a temporary blob URL from the active session, return it
            if (storedUrl.startsWith('blob:')) {
              return { data: { publicUrl: storedUrl } };
            }
            // Otherwise return a standard URL containing the path, which pdfDb.ts will resolve via IndexedDB
            return { data: { publicUrl: `https://mock-supabase.local/storage/v1/object/public/notes/${path}` } };
          }
          // No URL found for this path — the file was not uploaded in this session/device.
          // Return dummy.pdf as absolute last resort and log a clear warning for debugging.
          console.error(
            `[NoteWeb Debug] getPublicUrl: No stored URL found for path "${path}".`,
            `This means the PDF was uploaded in a different session/device and the storage URL is not in mock cache.`,
            `Opening dummy.pdf as fallback. FIX: Ensure your Supabase Storage bucket 'notes' is public, or check RLS policies.`
          );
          return { data: { publicUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' } };
        },

        remove: async (paths: string[]) => {
          paths.forEach(path => mockStorageFiles.delete(path));
          persistMockStorageFiles();
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
// Promise timeout race helper
const withTimeout = async (promise: any, ms = 2500): Promise<any> => {
  const safePromise = new Promise<any>((resolve, reject) => {
    if (promise && typeof promise.then === 'function') {
      promise.then(resolve, reject);
    } else {
      resolve(promise);
    }
  });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), ms)
  );
  return Promise.race([safePromise, timeout]);
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

  or(filterStr: string) {
    this.realBuilder = this.realBuilder.or(filterStr);
    this.calls.push({ method: 'or', args: [filterStr] });
    return this;
  }

  neq(column: string, value: any) {
    this.realBuilder = this.realBuilder.neq(column, value);
    this.calls.push({ method: 'neq', args: [column, value] });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.realBuilder = this.realBuilder.order(column, options);
    this.calls.push({ method: 'order', args: [column, options] });
    return this;
  }

  limit(count: number) {
    this.realBuilder = this.realBuilder.limit(count);
    this.calls.push({ method: 'limit', args: [count] });
    return this;
  }

  single() {
    this.realBuilder = this.realBuilder.single();
    this.calls.push({ method: 'single', args: [] });
    return this;
  }

  upsert(values: any) {
    this.realBuilder = this.realBuilder.upsert(values);
    this.calls.push({ method: 'upsert', args: [values] });
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
          const isColumnMismatch = errCode === '42703' || 
                                   errMsg.toLowerCase().includes('column') || 
                                   errMsg.toLowerCase().includes('schema cache');

          // Detect database schema violations, unmigrated tables, network issues, or security issues
          const isRls = errMsg.toLowerCase().includes('row-level security') || 
                        errMsg.toLowerCase().includes('policy') ||
                        errCode === '42501';

          // For direct_messages RLS errors on INSERT, use realSupabase client directly
          // This works when the RLS policy allows anon role inserts
          if (isRls && this.table === 'direct_messages') {
            console.warn('[RLS] direct_messages insert blocked by RLS. Retrying with realSupabase client...');
            try {
              let retryBuilder = realSupabase.from(this.table);
              for (const call of this.calls) {
                retryBuilder = (retryBuilder as any)[call.method](...call.args);
              }
              const retryResponse = await retryBuilder;
              if (!retryResponse?.error) {
                return retryResponse;
              }
              console.error('[RLS] Retry also failed:', retryResponse.error.message);
              console.error('[RLS FIX] Run this SQL in Supabase Dashboard > SQL Editor:\n' +
                'DROP POLICY IF EXISTS "Allow users to send messages" ON public.direct_messages;\n' +
                'CREATE POLICY "anon_insert_dm" ON public.direct_messages FOR INSERT TO anon WITH CHECK (true);\n' +
                'CREATE POLICY "auth_insert_dm" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (true);');
            } catch (retryErr) {
              console.error('[RLS] Retry threw error:', retryErr);
            }
          }

          if (
            !isRls && (
              isColumnMismatch ||
              errMsg.includes('relation') ||
              errMsg.includes('does not exist') ||
              errCode === 'P0001' ||
              errCode.startsWith('42') ||
              errMsg.includes('API key') ||
              errMsg.includes('invalid') ||
              errMsg.includes('JWT')
            )
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
      if (response?.data?.publicUrl) {
        // Validate: if the real URL is a proper http URL, always use it
        const url = response.data.publicUrl;
        if (url.startsWith('http')) {
          return response;
        }
      }
      // Fall back to mock only if real returned nothing or a non-HTTP URL
      console.warn(`[NoteWeb Debug] SafeStorageBucket.getPublicUrl: Real Supabase returned invalid URL for "${path}". Falling back to mock.`);
      return mockSupabase.storage.from(this.bucket).getPublicUrl(path);
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
    if (isMockMode || !realSupabase) return mockSupabase.auth.signUp(credentials);
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
    if (isMockMode || !realSupabase) return mockSupabase.auth.signInWithPassword(credentials);
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
    if (isMockMode || !realSupabase) return mockSupabase.auth.signInWithOtp(credentials);
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
    if (isMockMode || !realSupabase) return mockSupabase.auth.verifyOtp(credentials);
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
    if (isMockMode || !realSupabase) return mockSupabase.auth.signInWithOAuth(credentials);
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
    if (isMockMode || !realSupabase) return mockSupabase.auth.signOut();
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
    if (isMockMode || !realSupabase) return mockSupabase.auth.updateUser(attributes);
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
    if (isMockMode || !realSupabase) {
      return mockSupabase.auth.onAuthStateChange(callback);
    }
    // Listen to BOTH real and mock auth states for user sync
    let realSub: any = null;
    let mockSub: any = null;

    try {
      realSub = realSupabase.auth.onAuthStateChange(callback);
    } catch (e) {
      console.warn("realSupabase.auth.onAuthStateChange failed:", e);
    }

    try {
      mockSub = mockSupabase.auth.onAuthStateChange(callback);
    } catch (e) {
      console.warn("mockSupabase.auth.onAuthStateChange failed:", e);
    }

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            try {
              if (realSub?.data?.subscription?.unsubscribe) {
                realSub.data.subscription.unsubscribe();
              } else if (realSub?.unsubscribe) {
                realSub.unsubscribe();
              }
            } catch (err) {
              console.warn("realSub unsubscribe failed:", err);
            }
            try {
              if (mockSub?.data?.subscription?.unsubscribe) {
                mockSub.data.subscription.unsubscribe();
              } else if (mockSub?.unsubscribe) {
                mockSub.unsubscribe();
              }
            } catch (err) {
              console.warn("mockSub unsubscribe failed:", err);
            }
          }
        }
      }
    };
  }
};

const safeStorage = {
  from(bucket: string) {
    if (isMockMode || !realSupabase) {
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
        const isMockUser = !!localStorage.getItem('noteweb-mock-uid');
        if (isMockMode || !realSupabase || isMockUser) {
          return mockSupabase.from(table);
        }
        return new SafePostgrestBuilder(table, realSupabase.from(table));
      },
      get storage() {
        const isMockUser = !!localStorage.getItem('noteweb-mock-uid');
        if (isMockMode || !realSupabase || isMockUser) {
          return mockSupabase.storage;
        }
        return safeStorage;
      },
      channel(name: string, opts?: any) {
        const isMockUser = !!localStorage.getItem('noteweb-mock-uid');
        if (isMockMode || !realSupabase || isMockUser || typeof realSupabase.channel !== 'function') {
          return {
            on: function() { return this; },
            send: () => { return Promise.resolve({ error: null }); },
            subscribe: () => {
              return {
                unsubscribe: () => {}
              };
            },
            unsubscribe: () => {}
          } as any;
        }
        return realSupabase.channel(name, opts);
      },
      removeChannel(channel: any) {
        const isMockUser = !!localStorage.getItem('noteweb-mock-uid');
        if (isMockMode || !realSupabase || isMockUser || typeof realSupabase.removeChannel !== 'function') {
          return Promise.resolve();
        }
        return realSupabase.removeChannel(channel);
      }
    }
  : realSupabase) as any;


// Function to seed default branches, categories, and realistic notes locally if empty
function mockPostgresSeedAndReturnMock() {
  const profilesSeed = localStorage.getItem('noteweb-db-profiles');
  if (!profilesSeed) {
    const defaultProfiles = [
      {
        id: 'mock-google-user',
        username: 'google_student',
        email: 'google@noteweb.local',
        display_name: 'Google Student',
        mobile_no: '+919999999999',
        year: '3',
        branch: 'cse',
        cgpa: '9.2',
        photo_url: '🧙‍♂️|from-purple-600 via-pink-500 to-indigo-600',
        role: 'student',
        setup_complete: true,
        points: 420
      },
      {
        id: 'mock-phone-919876543210',
        username: 'phone_student',
        email: '919876543210@noteweb.local',
        display_name: 'Student +91 98765 43210',
        mobile_no: '+919876543210',
        year: '2',
        branch: 'ece',
        cgpa: '8.5',
        photo_url: '🦊|from-amber-500 via-orange-500 to-rose-600',
        role: 'student',
        setup_complete: true,
        points: 280
      }
    ];
    localStorage.setItem('noteweb-db-profiles', JSON.stringify(defaultProfiles));
  }

  const branchesSeed = localStorage.getItem('noteweb-db-branches');
  if (!branchesSeed) {
    const defaultBranches = [
      {
        id: 'cse',
        name: 'Computer Science & Engineering',
        description: 'Data Structures, Algorithms, Software Engineering, Web Dev, Databases, and operating systems.',
        icon: 'code',
        color: 'from-blue-500 to-indigo-500',
        shadow_color: 'rgba(59, 130, 246, 0.3)',
        notes_count: 'CSE'
      },
      {
        id: 'aiml',
        name: 'AI & Machine Learning',
        description: 'Neural Networks, Deep Learning, Computer Vision, NLP, and Robotics.',
        icon: 'sparkles',
        color: 'from-fuchsia-500 to-purple-500',
        shadow_color: 'rgba(217, 70, 239, 0.3)',
        notes_count: 'AI&ML'
      },
      {
        id: 'ds',
        name: 'Data Science',
        description: 'Data analytics, statistical learning, visualization, big data processing, and predictive models.',
        icon: 'binary',
        color: 'from-cyan-500 to-blue-500',
        shadow_color: 'rgba(6, 182, 212, 0.3)',
        notes_count: 'DS'
      },
      {
        id: 'mechanical',
        name: 'Mechanical Engineering',
        description: 'Thermodynamics, fluid mechanics, design of machines, heat transfer, and manufacturing processes.',
        icon: 'settings',
        color: 'from-amber-500 to-orange-500',
        shadow_color: 'rgba(245, 158, 11, 0.3)',
        notes_count: 'ME'
      },
      {
        id: 'civil',
        name: 'Civil Engineering',
        description: 'Structural mechanics, geotech, environment, surveying, and infrastructure design.',
        icon: 'compass',
        color: 'from-rose-500 to-pink-500',
        shadow_color: 'rgba(244, 63, 94, 0.3)',
        notes_count: 'CE'
      },
      {
        id: 'ece',
        name: 'Electronics & Comm Eng',
        description: 'Microprocessors, VLSI design, Signal processing, Communication systems, and analog hardware.',
        icon: 'cpu',
        color: 'from-emerald-500 to-teal-500',
        shadow_color: 'rgba(16, 185, 129, 0.3)',
        notes_count: 'ECE'
      }
    ];
    localStorage.setItem('noteweb-db-branches', JSON.stringify(defaultBranches));
  }

  const categoriesSeed = localStorage.getItem('noteweb-db-categories');
  if (!categoriesSeed) {
    const defaultCategories = [
      { id: 'cse-dsa', branch_id: 'cse', name: 'Data Structures & Algorithms', description: 'Arrays, Linked Lists, Stacks, Queues, Trees, Graphs, sorting and searching algorithms.' },
      { id: 'cse-dbms', branch_id: 'cse', name: 'Database Management Systems', description: 'Relational databases, SQL queries, normalization, transactions, and indexing.' },
      { id: 'cse-os', branch_id: 'cse', name: 'Operating Systems', description: 'Processes, threads, CPU scheduling, memory management, file systems, and concurrency.' },
      { id: 'cse-webdev', branch_id: 'cse', name: 'Web Development', description: 'HTML, CSS, JavaScript, React, Node.js, REST APIs, and modern full-stack engineering.' },
      
      { id: 'aiml-ml', branch_id: 'aiml', name: 'Artificial Intelligence & Machine Learning', description: 'Supervised/unsupervised learning, regression, classification, clustering, neural networks.' },
      
      { id: 'ds-analytics', branch_id: 'ds', name: 'Data Analytics', description: 'Exploratory data analysis, statistical tests, data wrangling, and descriptive metrics.' },
      
      { id: 'ece-microprocessors', branch_id: 'ece', name: 'Microprocessors & Embedded Systems', description: '8085/8086 architectures, assembly programming, interfacing, and microcontrollers like Arduino.' },
      { id: 'ece-digital', branch_id: 'ece', name: 'Digital Electronics', description: 'Number systems, logic gates, Boolean algebra, combinational and sequential logic circuits.' },
      { id: 'ece-signals', branch_id: 'ece', name: 'Signals & Systems', description: 'Signals & Systems, continuous & discrete time signals, Fourier transform, Laplace transform.' },
      
      { id: 'mechanical-thermo', branch_id: 'mechanical', name: 'Thermodynamics', description: 'Laws of thermodynamics, heat engines, entropy, pure substances, and power cycles.' },
      { id: 'mechanical-fluid', branch_id: 'mechanical', name: 'Fluid Mechanics', description: 'Fluid properties, pressure, flow kinematics, Bernoulli equation, and dimensional analysis.' },
      
      { id: 'civil-structures', branch_id: 'civil', name: 'Structural Analysis', description: 'Trusses, beams, columns, bending moments, shear forces, and stress analysis.' }
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
        branch: 'cse',
        category: 'cse-dsa',
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
        branch: 'cse',
        category: 'cse-dbms',
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
        id: 'note-ece-microprocessors',
        subject: 'Microprocessors and Interfacing: 8086',
        branch: 'ece',
        category: 'ece-microprocessors',
        semester: '4',
        teacher: 'Dr. Vikram Singh',
        description: 'Lecture notes on 8086 microprocessor internal architecture, register organization, memory segmentation, and addressing modes.',
        pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        pdf_path: 'notes/mock/1716301400000_Quantum.pdf',
        file_name: 'Microprocessors_8086_Lec8.pdf',
        file_size: 3254000,
        uploaded_by: 'mock-phone-919876543210',
        uploader_name: 'Student +91 98765 43210',
        uploader_email: '919876543210@noteweb.local',
        created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(), // 5 days ago
        status: 'approved',
        likes: ['mock-google-user'],
        likes_count: 1,
        bookmarks_count: 1,
        summary: `### 8086 Microprocessor Basics
- **Architecture**: Contains BIU (Bus Interface Unit) and EU (Execution Unit) working in parallel.
- **Pipelining**: BIU fetches up to 6 instruction bytes into a queue, enabling instruction prefetching.
- **Memory Segmentation**: 1 MB address space divided into segments (CS, DS, SS, ES) of 64 KB each.`
      },
      {
        id: 'note-ds-analytics',
        subject: 'Probability and Linear Algebra for Data Science',
        branch: 'ds',
        category: 'ds-analytics',
        semester: '3',
        teacher: 'Prof. Sarah Jenkins',
        description: 'Complete breakdown of vector spaces, matrix factorization, and probability distributions used in statistical modeling.',
        pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        pdf_path: 'notes/mock/1716301500000_Calculus.pdf',
        file_name: 'DS_Maths_LinearAlgebra.pdf',
        file_size: 1980300,
        uploaded_by: 'mock-google-user',
        uploader_name: 'Google Student',
        uploader_email: 'google@noteweb.local',
        created_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(), // 10 days ago
        status: 'approved',
        likes: [],
        likes_count: 0,
        bookmarks_count: 0,
        summary: `### Essential DS Math Topics
- **Matrices**: SVD (Singular Value Decomposition) and Principal Component Analysis (PCA) foundations.
- **Probability**: Bayes Theorem, continuous distributions (Gaussian/Normal), and maximum likelihood estimation.`
      }
    ];
    localStorage.setItem('noteweb-db-notes', JSON.stringify(defaultNotes));
  }

  return mockSupabase;
}
