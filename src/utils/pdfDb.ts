import { supabase } from '../supabase/config';

const DB_NAME = 'NoteWebOfflineCache';
const STORE_NAME = 'offline-pdfs';
const DB_VERSION = 1;

// Initialize IndexedDB natively without any dependencies
const getDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Stores a PDF file or Blob in the local IndexedDB cache.
 * This allows the uploader (or any client that receives the file)
 * to open, view, or download the actual file, even if central storage uploads are blocked by RLS policies.
 * 
 * @param key The pdfUrl, pdfPath, or filename to use as the unique key
 * @param blob The File or Blob containing the PDF binary
 */
export const storeOfflinePdf = async (key: string, blob: Blob): Promise<void> => {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, key);

      request.onsuccess = () => {
        console.log(`Stored PDF file locally in IndexedDB under key: ${key}`);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn("Failed to store PDF locally in IndexedDB:", err);
  }
};

/**
 * Retrieves a locally cached PDF Blob from IndexedDB.
 * 
 * @param key The pdfUrl, pdfPath, or filename used when storing
 * @returns Promise<Blob | null> The cached PDF Blob, or null if not found
 */
export const getOfflinePdf = async (key: string): Promise<Blob | null> => {
  try {
    const db = await getDb();
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn("Failed to retrieve PDF from IndexedDB:", err);
    return null;
  }
};

/**
 * Helper to convert a Base64 data URL to a binary Blob.
 */
export const base64ToBlob = (base64: string, type = 'application/pdf'): Blob => {
  const parts = base64.split(',');
  const byteString = atob(parts[1] || parts[0]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type });
};

/**
 * Checks if a PDF is cached locally (by checking both url and path),
 * or is a Base64 string, and returns a local Object URL (blob:...) for the file if found.
 * If not found, returns null.
 * 
 * @param pdfUrl The remote PDF URL
 * @param pdfPath The remote PDF path
 * @returns Promise<string | null> A temporary local object URL, or null
 */
export const getLocalPdfUrl = async (pdfUrl: string, pdfPath: string): Promise<string | null> => {
  if (!pdfUrl) return null;
  
  // 1. Handle Base64 directly
  let isBase64 = false;
  let base64Data = pdfUrl;
  if (pdfUrl.startsWith('data:application/pdf;base64,')) {
    isBase64 = true;
  } else if (/^[a-zA-Z0-9+/=]+$/.test(pdfUrl) && (pdfUrl.startsWith('JVBERi') || pdfUrl.length > 100)) {
    isBase64 = true;
    base64Data = 'data:application/pdf;base64,' + pdfUrl;
  }

  if (isBase64) {
    try {
      const blob = base64ToBlob(base64Data);
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error("Failed to parse base64 PDF string:", err);
    }
  }

  // 2. Try matching by pdfUrl in IndexedDB
  let blob = await getOfflinePdf(pdfUrl);
  
  // 3. If not found, try matching by pdfPath in IndexedDB
  if (!blob && pdfPath) {
    blob = await getOfflinePdf(pdfPath);
  }

  // 4. If found, create a local object URL
  if (blob) {
    try {
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error("Failed to create Object URL for offline PDF:", err);
    }
  }
  
  return null;
};

/**
 * Resolves the note's PDF source and opens it in a new browser tab.
 * Resolution order:
 *   1. DB on-demand fetch (if pdfUrl is 'db-base64-fetch', empty, or an expired blob:)
 *   2. Base64 data URL → Blob → ObjectURL
 *   3. IndexedDB local cache (by pdfUrl, pdfPath, noteId)
 *   4. Remote HTTP URL directly
 *   5. DB on-demand fetch as ultimate fallback
 */
export const openPdfDocument = async (pdfUrl: string, pdfPath: string, noteId?: string): Promise<void> => {
  // ─── DEBUG LOG: Always print exactly what data arrived at the viewer ───
  console.group('[NoteWeb PDF Debug] openPdfDocument called');
  console.log('pdfUrl:', pdfUrl);
  console.log('pdfPath:', pdfPath);
  console.log('noteId:', noteId);
  console.groupEnd();

  try {
    let resolvedUrl = pdfUrl;

    // Helper: detect whether a URL is unusable before trying to open it
    const isDeadUrl = (url: string): boolean => {
      if (!url) return true;
      if (url === 'db-base64-fetch') return true;
      // blob: URLs are session-scoped and expire on page refresh
      if (url.startsWith('blob:')) return true;
      // dummy.pdf fallback — explicitly detected to trigger a real fetch
      if (url.includes('dummy.pdf')) {
        console.warn('[NoteWeb PDF Debug] Detected dummy.pdf URL — will attempt live DB fetch instead.');
        return true;
      }
      return false;
    };

    // STEP 0: If url is dead/placeholder, try fetching real URL from Supabase DB
    if (isDeadUrl(resolvedUrl) && noteId) {
      console.log(`[NoteWeb PDF Debug] URL is dead/placeholder. Fetching live url from DB for note ID: ${noteId}`);
      try {
        let dbUrl: string | null = null;
        let dbPath: string | null = null;

        // Try snake_case query first
        const { data: snakeData, error: snakeErr } = await supabase
          .from('notes')
          .select('pdf_url, pdf_path')
          .eq('id', noteId)
          .single();

        if (snakeErr || !snakeData) {
          console.warn('[NoteWeb PDF Debug] Snake_case query failed or empty, trying camelCase fallback...', snakeErr);
          const { data: camelData, error: camelErr } = await supabase
            .from('notes')
            .select('pdfUrl, pdfPath')
            .eq('id', noteId)
            .single();

          if (camelErr) {
            console.error('[NoteWeb PDF Debug] CamelCase query also failed:', camelErr);
          } else if (camelData) {
            dbUrl = (camelData as any).pdfUrl;
            dbPath = (camelData as any).pdfPath;
          }
        } else {
          dbUrl = snakeData.pdf_url;
          dbPath = snakeData.pdf_path;
        }

        console.log('[NoteWeb PDF Debug] DB query returned:', { dbUrl, dbPath });

        if (dbUrl && !isDeadUrl(dbUrl)) {
          resolvedUrl = dbUrl;
        } else if (dbPath) {
          // Try generating a fresh public URL from the stored path
          const { data: urlData } = supabase.storage.from('notes').getPublicUrl(dbPath);
          if (urlData?.publicUrl && urlData.publicUrl.startsWith('http') && !urlData.publicUrl.includes('dummy.pdf')) {
            resolvedUrl = urlData.publicUrl;
            console.log('[NoteWeb PDF Debug] Resolved via storage.getPublicUrl:', resolvedUrl);
          }
        }
      } catch (dbErr) {
        console.error('[NoteWeb PDF Debug] Error during DB on-demand fetch:', dbErr);
      }
    }

    // STEP 1: Handle Base64 data URL or raw Base64 string
    if (resolvedUrl) {
      let isBase64 = false;
      let base64Data = resolvedUrl;

      if (resolvedUrl.startsWith('data:application/pdf;base64,')) {
        isBase64 = true;
      } else if (/^[a-zA-Z0-9+/=]+$/.test(resolvedUrl) && (resolvedUrl.startsWith('JVBERi') || resolvedUrl.length > 100)) {
        isBase64 = true;
        base64Data = 'data:application/pdf;base64,' + resolvedUrl;
        console.log('[NoteWeb PDF Debug] Raw Base64 PDF string detected without prefix, prepended prefix.');
      }

      if (isBase64) {
        console.log('[NoteWeb PDF Debug] Resolving as Base64 data URL');
        const blob = base64ToBlob(base64Data);
        if (pdfPath) await storeOfflinePdf(pdfPath, blob);
        if (noteId) await storeOfflinePdf(noteId, blob);
        window.open(URL.createObjectURL(blob), '_blank');
        return;
      }
    }

    // STEP 2: Check IndexedDB local cache (survives page refreshes)
    let localUrl = await getLocalPdfUrl(resolvedUrl, pdfPath);
    if (!localUrl && noteId) {
      const cachedBlob = await getOfflinePdf(noteId);
      if (cachedBlob) {
        try { localUrl = URL.createObjectURL(cachedBlob); } catch {}
      }
    }

    if (localUrl) {
      console.log('[NoteWeb PDF Debug] Opening from IndexedDB cache:', localUrl.substring(0, 60));
      window.open(localUrl, '_blank');
      return;
    }

    // STEP 3: Open the resolved remote URL
    if (resolvedUrl && resolvedUrl.startsWith('http') && !resolvedUrl.includes('dummy.pdf')) {
      console.log('[NoteWeb PDF Debug] Opening remote URL:', resolvedUrl);
      window.open(resolvedUrl, '_blank');
      return;
    }

    // STEP 4: Ultimate fallback \u2014 try pdfPath to generate fresh storage URL
    if (pdfPath && pdfPath !== '' && !pdfPath.startsWith('notes/mock') && !pdfPath.startsWith('notes/base64')) {
      console.log('[NoteWeb PDF Debug] Trying to generate public URL from pdfPath:', pdfPath);
      const { data: freshUrlData } = supabase.storage.from('notes').getPublicUrl(pdfPath);
      if (freshUrlData?.publicUrl && freshUrlData.publicUrl.startsWith('http') && !freshUrlData.publicUrl.includes('dummy.pdf')) {
        console.log('[NoteWeb PDF Debug] Got fresh URL from pdfPath:', freshUrlData.publicUrl);
        window.open(freshUrlData.publicUrl, '_blank');
        return;
      }
    }

    // All resolution methods exhausted
    console.error(
      '[NoteWeb PDF Debug] Could not resolve a valid PDF URL.',
      'Final state \u2014 resolvedUrl:', resolvedUrl,
      '| pdfPath:', pdfPath,
      '| noteId:', noteId,
      '\nThis note may have been uploaded in a different browser/device without a public storage URL.',
      '\nFIX: Ensure your Supabase Storage bucket "notes" is public and has correct RLS policies.'
    );

    // Last-resort open \u2014 if somehow resolvedUrl is a valid URL, try it anyway
    if (resolvedUrl && resolvedUrl.startsWith('http')) {
      window.open(resolvedUrl, '_blank');
    } else {
      alert('Could not open PDF: the file URL could not be resolved. Please check the browser console for details (F12 \u2192 Console).');
    }

  } catch (err) {
    console.error('[NoteWeb PDF Debug] Unexpected error in openPdfDocument:', err);
    // Attempt raw open as last resort
    if (pdfUrl && pdfUrl.startsWith('http') && !pdfUrl.includes('dummy.pdf')) {
      window.open(pdfUrl, '_blank');
    }
  }
};
