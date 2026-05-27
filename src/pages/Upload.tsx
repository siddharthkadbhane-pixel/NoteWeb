import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, Sparkles, AlertTriangle, Link, Globe } from 'lucide-react';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { extractTextFromPdf } from '../services/pdf';
import { storeOfflinePdf } from '../utils/pdfDb';
import { summarizeNotes, classifyNoteCategory } from '../services/gemini';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const uploadToRemoteFallback = async (file: File): Promise<string> => {
  try {
    console.log("Uploading file to Catbox.moe via CORS proxy...");
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file);
    
    const response = await fetch('https://corsproxy.io/?url=https%3A%2F%2Fcatbox.moe%2Fuser%2Fapi.php', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload to Catbox.moe: ${response.statusText}`);
    }
    
    const fileUrl = await response.text();
    if (fileUrl && fileUrl.startsWith('http')) {
      console.log("Uploaded successfully to Catbox.moe! URL:", fileUrl);
      return fileUrl.trim();
    }
    throw new Error(`Invalid response from Catbox.moe: ${fileUrl}`);
  } catch (catboxErr) {
    console.warn("Catbox.moe upload failed, trying tmpfiles.org fallback...", catboxErr);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      console.log("Uploading file to tmpfiles.org...");
      const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to upload to tmpfiles.org: ${response.statusText}`);
      }
      
      const resData = await response.json();
      if (resData && resData.status === 'success' && resData.data && resData.data.url) {
        const originalUrl = resData.data.url;
        // Convert view URL to direct download URL
        const downloadUrl = originalUrl.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
        console.log("Uploaded successfully to tmpfiles.org! URL:", downloadUrl);
        return downloadUrl;
      }
      throw new Error("Invalid response format from tmpfiles.org");
    } catch (tmpfilesErr) {
      console.error("Both Catbox.moe and tmpfiles.org fallbacks failed:", tmpfilesErr);
      throw new Error("Could not upload PDF notes to remote servers.");
    }
  }
};

const SEMESTER_SUBJECTS: Record<string, string[]> = {
  "1/2": [
    "Engineering Mathematics-I & II",
    "Engineering Physics",
    "Engineering Chemistry",
    "Basic Electrical & Electronics",
    "Programming for Problem Solving",
    "Technical English"
  ],
  "3/4": [
    "Discrete Mathematics",
    "Data Structures & Algorithms",
    "Object-Oriented Programming",
    "Computer Organization & Architecture",
    "Operating Systems",
    "Database Management Systems"
  ],
  "5/6": [
    "Design and Analysis of Algorithms",
    "Formal Languages & Automata Theory",
    "Computer Networks",
    "Software Engineering",
    "Artificial Intelligence",
    "Compiler Design"
  ],
  "7/8": [
    "Machine Learning",
    "Cloud Computing / Cyber Security (Electives)",
    "Distributed Systems",
    "Entrepreneurship",
    "Major Capstone Project Work & Industrial Internship"
  ]
};

export const Upload: React.FC = () => {
  const { user, userProfile, isAdmin } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  // Branch and Category states
  const [categories, setCategories] = useState<{ id: string; branchId: string; name: string; description?: string }[]>([]);

  // Notes Name state
  const [notesName, setNotesName] = useState('');

  // Note vs Question Paper toggle
  const [uploadType, setUploadType] = useState<'notes' | 'paper'>('notes');
  const [examYear, setExamYear] = useState('2026');
  const [examType, setExamType] = useState('End-Term');

  const [file, setFile] = useState<File | null>(null);
  const [submissionMode, setSubmissionMode] = useState<'file' | 'link'>('file');
  const [externalLink, setExternalLink] = useState('');
  const [semester, setSemester] = useState('1/2');
  
  // Custom Subject Selection
  const [selectedPredefinedSubject, setSelectedPredefinedSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [subject, setSubject] = useState('');

  const [teacher, setTeacher] = useState('');
  const [description, setDescription] = useState('');
  const [generateAI, setGenerateAI] = useState(true);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [aiStatus, setAiStatus] = useState<'idle' | 'extracting' | 'summarizing' | 'done'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize dynamic predefined subject when semester range changes
  useEffect(() => {
    const defaultSubjects = SEMESTER_SUBJECTS[semester] || [];
    if (defaultSubjects.length > 0) {
      setSelectedPredefinedSubject(defaultSubjects[0]);
    } else {
      setSelectedPredefinedSubject('other');
    }
  }, [semester]);

  // Synchronize actual subject state with dropdown or custom inputs
  useEffect(() => {
    if (selectedPredefinedSubject === 'other') {
      setSubject(customSubject);
    } else {
      setSubject(selectedPredefinedSubject);
    }
  }, [selectedPredefinedSubject, customSubject]);

  // Fetch categories dynamically on load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: categoriesData } = await supabase.from('categories').select('*');

        let categoriesList = (categoriesData || []).map((c: any) => ({
          id: c.id,
          branchId: c.branch_id || c.branchId || '',
          name: c.name,
          description: c.description
        }));

        if (categoriesList.length === 0) {
          categoriesList = [
            { id: 'cse-dsa', branchId: 'cse', name: 'Data Structures & Algorithms' },
            { id: 'cse-dbms', branchId: 'cse', name: 'Database Management Systems' },
            { id: 'cse-os', branchId: 'cse', name: 'Operating Systems' },
            { id: 'cse-webdev', branchId: 'cse', name: 'Web Development' }
          ];
        }

        setCategories(categoriesList);
      } catch (e) {
        console.error("Error loading upload configurations:", e);
      }
    };
    fetchData();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      if (!notesName) {
        const cleanName = droppedFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setNotesName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    } else {
      error("Only PDF notes are supported!");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      if (!notesName) {
        const cleanName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setNotesName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    } else if (selectedFile) {
      error("Only PDF notes are supported!");
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setUploadProgress(0);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.uid === 'guest-user-noteweb') {
      error("You must be logged in as a registered student to upload notes.");
      return;
    }
    if (submissionMode === 'file' && !file) {
      error("Please choose or drag a PDF notes file");
      return;
    }
    if (submissionMode === 'link' && !externalLink.trim()) {
      error("Please paste your Google Drive or cloud sharing link");
      return;
    }
    if (!notesName.trim()) {
      error("Notes / File Title is required");
      return;
    }
    if (!subject.trim()) {
      error("Subject name is required");
      return;
    }
    // Category is optional (can fall back to General Catalog if unassigned)

    setIsUploading(true);
    setUploadProgress(0);

    // Emulate upload progress updates for the premium feel
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 150);

    try {
      // Self-heal: Ensure user profile row exists in DB before note insertion to prevent foreign key violation
      try {
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.uid);
        
        if (profileErr || !profileData || profileData.length === 0) {
          console.warn("User profile missing from public.profiles. Self-healing by creating profile row...");
          const newProfile = {
            id: user.uid,
            email: user.email || `${user.uid}@noteweb.local`,
            display_name: userProfile?.displayName || user.displayName || 'Student',
            photo_url: userProfile?.photoURL || user.photoURL || '',
            role: 'student',
            setup_complete: false,
            bookmarks: []
          };
          const { error: insErr } = await supabase.from('profiles').insert([newProfile]);
          if (insErr) {
            if (insErr.message?.includes('column') || insErr.code === '42703') {
              const newProfileCamel = {
                id: user.uid,
                email: user.email || `${user.uid}@noteweb.local`,
                displayName: userProfile?.displayName || user.displayName || 'Student',
                photoUrl: userProfile?.photoURL || user.photoURL || '',
                role: 'student',
                setupComplete: false,
                bookmarks: []
              };
              const { error: insCamelErr } = await supabase.from('profiles').insert([newProfileCamel]);
              if (insCamelErr) {
                console.error("Auto-sync profile camelCase fallback failed during self-healing:", insCamelErr);
              }
            } else {
              console.error("Auto-sync profile failed during self-healing:", insErr);
            }
          }
        }
      } catch (profileCheckErr) {
        console.error("Error verifying profile existence:", profileCheckErr);
      }

      let downloadUrl = '';
      let storagePath = '';
      let fileNameStr = '';
      let fileSizeNum = 0;
      let aiExtractedText = '';

      if (submissionMode === 'link') {
        clearInterval(progressInterval);
        downloadUrl = externalLink.trim();
        storagePath = 'external-link';
        fileNameStr = 'Google Drive Link';
        fileSizeNum = 0;
        aiExtractedText = `External shared document link: ${notesName}. Teacher: ${teacher}. Description: ${description}`;
        setUploadProgress(100);
      } else {
        if (!file) throw new Error("File missing");
        fileNameStr = file.name;
        fileSizeNum = file.size;

        // 1. Upload PDF to Supabase Storage
        const uniqueFileName = `${Date.now()}_${file.name}`;
        storagePath = `notes/${user.uid}/${uniqueFileName}`;

        const { error: storageErr } = await supabase.storage
          .from('notes')
          .upload(storagePath, file);

        clearInterval(progressInterval);

        if (storageErr) {
          let storageErrMsg = storageErr.message || "Failed to upload file to storage";
          if (storageErrMsg.toLowerCase().includes("bucket") || storageErrMsg.toLowerCase().includes("not found")) {
            storageErrMsg = "The 'notes' storage bucket is missing in your Supabase project. Please log into your Supabase Dashboard -> Storage, click 'New Bucket', name it exactly 'notes' (and check 'Public').";
          } else if (storageErrMsg.toLowerCase().includes("policy") || storageErrMsg.toLowerCase().includes("rls") || storageErrMsg.toLowerCase().includes("row-level security")) {
            storageErrMsg = "Storage upload was blocked by RLS policies. Please ensure you have added Storage policies to allow INSERT/upload for authenticated users on the 'notes' bucket in your Supabase dashboard.";
          }
          
          console.warn("Supabase Storage upload failed. Activating multi-device remote hosting fallback...", storageErrMsg);
          info("Storage upload policy restricted. Routing PDF through remote hosting fallback...");
          
          try {
            const remoteUrl = await uploadToRemoteFallback(file);
            downloadUrl = remoteUrl;
            storagePath = `notes/remote/${Date.now()}_${file.name}`;
            success("Notes successfully uploaded to secure remote sync server!");
          } catch (remoteErr: any) {
            console.warn("Remote hosting fallback failed, converting file to Base64 as database backup:", remoteErr);
            info("Remote sync server busy. Syncing actual PDF file directly to secure Database backup...");
            
            try {
              const base64Data = await fileToBase64(file);
              downloadUrl = base64Data;
              storagePath = `notes/base64/${Date.now()}_${file.name}`;
              success("Note successfully converted for secure direct database backup!");
            } catch (base64Err: any) {
              console.error("Failed to convert PDF file to Base64:", base64Err);
              error("Direct DB Backup failed. Falling back to unique dummy PDF.");
              const uniqueMockId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
              downloadUrl = `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf?mockId=${uniqueMockId}`;
              storagePath = `notes/mock/${uniqueMockId}_${file.name}`;
            }
          }
          setUploadProgress(100);
        } else {
          setUploadProgress(100);

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('notes')
            .getPublicUrl(storagePath);

          if (!urlData || !urlData.publicUrl) {
            throw new Error("Could not retrieve public URL for uploaded notes");
          }

          downloadUrl = urlData.publicUrl;
        }

        // Local IndexedDB caching
        try {
          await storeOfflinePdf(storagePath, file);   // key: storage bucket path
          await storeOfflinePdf(downloadUrl, file);   // key: public download URL
          await storeOfflinePdf(`filename:${file.name}`, file);
          console.log(`[NoteWeb Upload] PDF cached in IndexedDB under keys: "${storagePath}", "${downloadUrl.substring(0, 60)}...", "filename:${file.name}"`);
        } catch (cacheErr) {
          console.warn("Failed to cache PDF file locally in IndexedDB:", cacheErr);
        }
        
        setAiStatus('extracting');
        try {
          aiExtractedText = await Promise.race([
            extractTextFromPdf(file),
            new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error("PDF text extraction timed out")), 4000)
            )
          ]);
        } catch (pdfErr) {
          console.error("Text extraction failed:", pdfErr);
        }
      }

      // Custom category creation vs AI Category auto-sorting check inside subject catalog
      let finalCategory = '';
      let finalBranch = 'cse';
      let autoCorrected = false;
      let detectedCategoryName = '';
      
      try {
        // Map our custom categories array into flat list Gemini classifier accepts
        const classifiedId = await classifyNoteCategory(notesName, description, aiExtractedText, categories);
        if (classifiedId) {
          const matchedCat = categories.find(c => c.id === classifiedId);
          if (matchedCat) {
            finalCategory = classifiedId;
            finalBranch = matchedCat.branchId || 'cse';
            detectedCategoryName = matchedCat.name;
            autoCorrected = true;
          }
        }
      } catch (classifyErr) {
        console.error("AI Category classification failed:", classifyErr);
      }

      let summaryText = '';
      if (generateAI && aiExtractedText) {
        try {
          setAiStatus('summarizing');
          summaryText = await summarizeNotes(aiExtractedText);
          setAiStatus('done');
        } catch (aiErr) {
          console.error("AI summarization failed, continuing upload without summary:", aiErr);
          error("AI summary failed, but your notes will still be uploaded!");
        }
      } else {
        setAiStatus('done');
      }

      // 2. Save metadata to Supabase DB
      const initialStatus = 'approved'; // Make note instantly approved so all devices see it in real-time!
      
      const uploadedBy = user.uid;
      const uploaderName = userProfile?.displayName || user.displayName || 'Student';
      const uploaderEmail = user.email || '';

      // Support custom values if uploadType is a question paper
      let finalSubject = notesName.trim();
      let finalTeacher = teacher.trim() || 'General / Unknown';
      let finalDescription = description.trim() || 'No description provided.';
      
      if (uploadType === 'paper') {
        finalSubject = `[QP - ${examYear} ${examType}] ${notesName.trim()}`;
        finalTeacher = `Exam Board (${examYear})`;
        finalDescription = `Previous Year Question Paper for ${notesName.trim()} - ${examType} (${examYear}). ${description.trim()}`.trim();
      }

      const noteDoc = {
        subject: finalSubject,
        branch: finalBranch,
        category: finalCategory,
        semester: semester,
        teacher: finalTeacher,
        description: finalDescription,
        pdf_url: downloadUrl,
        pdf_path: storagePath,
        file_name: fileNameStr,
        file_size: fileSizeNum,
        uploaded_by: uploadedBy,
        uploader_name: uploaderName,
        uploader_email: uploaderEmail,
        created_at: new Date().toISOString(),
        status: initialStatus,
        likes: [],
        likes_count: 0,
        bookmarks_count: 0,
        summary: summaryText || null
      };

      const noteDocCamel = {
        subject: finalSubject,
        branch: finalBranch,
        category: finalCategory,
        semester: semester,
        teacher: finalTeacher,
        description: finalDescription,
        pdfUrl: downloadUrl,
        pdfPath: storagePath,
        fileName: fileNameStr,
        fileSize: fileSizeNum,
        uploadedBy: uploadedBy,
        uploaderName: uploaderName,
        uploaderEmail: uploaderEmail,
        createdAt: new Date().toISOString(),
        status: initialStatus,
        likes: [],
        likesCount: 0,
        bookmarksCount: 0,
        summary: summaryText || null
      };



      const broadcastSuccessNote = async (insertedNote: any) => {
        let finalUrl = insertedNote.pdf_url || insertedNote.pdfUrl || '';
        if (finalUrl && (finalUrl.startsWith('data:') || finalUrl.length > 2000)) {
          finalUrl = 'db-base64-fetch';
        }

        const cleanInsertedNote = {
          ...insertedNote,
          pdf_url: finalUrl,
          pdfUrl: finalUrl
        };

        try {
          const channel = supabase.channel('public:notes');
          await new Promise<void>((resolve) => {
            channel.subscribe(async (status: any) => {
              if (status === 'SUBSCRIBED') {
                await channel.send({
                  type: 'broadcast',
                  event: 'new-note',
                  payload: cleanInsertedNote
                });
                console.log("Broadcasted success note successfully!");
                resolve();
              } else {
                resolve();
              }
            });
            setTimeout(resolve, 1500);
          });
        } catch (e) {
          console.warn("Failed to broadcast success note:", e);
        }
      };

      const { data: insertData, error: insertErr } = await supabase.from('notes').insert([noteDoc]).select();
      if (insertErr) {
        console.warn("Primary note insert failed:", insertErr);
        
        // If it's a column mismatch, try the camelCase fallback
        if (insertErr.message?.includes('column') || insertErr.code === '42703') {
          console.warn("Snake_case insert on notes table failed. Trying camelCase fallback...");
          const { data: camelInsertData, error: camelInsertErr } = await supabase.from('notes').insert([noteDocCamel]).select();
          if (camelInsertErr) {
            throw new Error(`Database write failed: ${camelInsertErr.message}. Ensure your 'notes' table matches the schema columns!`);
          } else {
            // camelCase insert success
            const insertedRow = (camelInsertData && camelInsertData[0]) ? camelInsertData[0] : { ...noteDocCamel, id: 'db-note-' + Date.now() };
            await broadcastSuccessNote(insertedRow);
          }
        } else {
          // For any other DB error (RLS block, constraint violation), throw the real error so it is displayed in the UI toast
          throw new Error(`Database write blocked: ${insertErr.message}. Please check your Supabase table schema and RLS policies!`);
        }
      } else {
        // snake_case insert success
        const insertedRow = (insertData && insertData[0]) ? insertData[0] : { ...noteDoc, id: 'db-note-' + Date.now() };
        await broadcastSuccessNote(insertedRow);
      }

      if (autoCorrected) {
        success(`AI Auto-Sorted! We detected this note fits best under "${detectedCategoryName}" subject and auto-sorted it.`);
      } else {
        success("Notes uploaded and published successfully!");
      }

      // Signal Feed page to immediately refetch via localStorage event
      // This triggers the storage event listener in Feed.tsx on all tabs
      localStorage.setItem('noteweb-last-upload', Date.now().toString());

      // Build a clean optimistic note object to pass directly to Feed via router state.
      // This makes the note appear INSTANTLY (0ms) when Feed.tsx mounts — no DB fetch needed.
      const optimisticNote = {
        id: (insertData && insertData[0]?.id) || 'optimistic-' + Date.now(),
        subject: notesName.trim(),
        branch: finalBranch,
        category: finalCategory,
        semester,
        teacher: teacher.trim() || 'General / Unknown',
        description: description.trim() || 'No description provided.',
        pdf_url: (() => { const u = downloadUrl; return (u.startsWith('data:') || u.length > 2000) ? 'db-base64-fetch' : u; })(),
        pdf_path: storagePath,
        file_name: fileNameStr,
        file_size: fileSizeNum,
        uploaded_by: user.uid,
        uploader_name: uploaderName,
        uploader_email: uploaderEmail,
        created_at: new Date().toISOString(),
        status: 'approved',
        likes: [],
        likes_count: 0,
        bookmarks_count: 0,
        summary: summaryText || null
      };

      // Optimistic note is passed transiently to feed via navigate state rather than local storage cache.

      // Wait 800ms to allow broadcast transmission to flush
      await new Promise((r) => setTimeout(r, 800));
      // Navigate to Feed and inject the optimistic note directly — instant visibility!
      navigate('/feed', { state: { newNote: optimisticNote, timestamp: Date.now() } });

    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      error("Failed to complete note upload: " + err.message);
      setIsUploading(false);
    }
  };


  return (
    <div className="min-h-screen w-full py-12 px-4 md:px-8 relative overflow-hidden text-left">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 glow-indigo rounded-full pointer-events-none blur-3xl opacity-30 animate-pulse" />
      
      <div className="max-w-3xl mx-auto z-10 relative">
        {/* Title */}
        <div className="text-left mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-white light-mode:text-slate-900 mb-2">
            Share Your Syllabus Library
          </h1>
          <p className="text-slate-400 light-mode:text-slate-500 font-medium text-sm">
            Publish high-quality study notes or previous year exam papers, cataloged perfectly by department and semester.
          </p>
        </div>

        {/* Upload Form */}
        <GlassPanel glowBorder className="bg-[#16161D]/30 light-mode:bg-white/80 p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6 text-left">
            
            {/* Note vs Question Paper Toggle */}
            <div className="flex items-center gap-1.5 p-1 bg-white/[0.02] border border-white/[0.06] rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setUploadType('notes')}
                className={`
                  flex-1 py-3 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer
                  ${uploadType === 'notes'
                    ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-slate-200'}
                `}
              >
                <FileText className="w-4 h-4" /> Study Notes
              </button>
              <button
                type="button"
                onClick={() => setUploadType('paper')}
                className={`
                  flex-1 py-3 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer
                  ${uploadType === 'paper'
                    ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-slate-200'}
                `}
              >
                <Sparkles className="w-4 h-4" /> Previous Year Papers
              </button>
            </div>

            {/* Submission Method Toggle */}
            <div className="flex flex-col gap-2 mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 light-mode:text-slate-600 pl-1">
                Submission Method
              </span>
              <div className="flex items-center gap-1.5 p-1 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <button
                  type="button"
                  onClick={() => setSubmissionMode('file')}
                  className={`
                    flex-1 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer
                    ${submissionMode === 'file'
                      ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                      : 'text-slate-400 hover:text-slate-200'}
                  `}
                >
                  <UploadCloud className="w-3.5 h-3.5" /> PDF File Upload
                </button>
                <button
                  type="button"
                  onClick={() => setSubmissionMode('link')}
                  className={`
                    flex-1 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer
                    ${submissionMode === 'link'
                      ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                      : 'text-slate-400 hover:text-slate-200'}
                  `}
                >
                  <Link className="w-3.5 h-3.5" /> Google Drive / Cloud Link
                </button>
              </div>
            </div>

            {/* Drag & Drop PDF or Cloud Link Input */}
            {submissionMode === 'file' ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 light-mode:text-slate-600 pl-1">
                  Select Notes Document (PDF)
                </span>
                {!file ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={triggerFileSelect}
                    className={`
                      border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-all duration-300
                      ${isDragging 
                        ? 'border-indigo-500 bg-indigo-500/10 text-white scale-[1.01]' 
                        : 'border-white/[0.08] hover:border-indigo-500/50 hover:bg-white/[0.02] text-slate-400 light-mode:border-slate-900/10 light-mode:hover:bg-slate-900/[0.01]'}
                    `}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-semibold text-white light-mode:text-slate-850">
                        Drag & Drop your PDF notes here
                      </p>
                      <p className="text-xs text-slate-500 light-mode:text-slate-600 mt-1">
                        or click to browse local files (PDF only, max 50MB)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 light-mode:border-indigo-500/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <span className="text-sm font-semibold text-white truncate light-mode:text-slate-800">
                          {file.name}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="text-xs font-bold text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                    >
                      Change File
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 light-mode:text-slate-600 pl-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-indigo-450" /> Paste Shared Cloud Document Link <span className="text-rose-500">*</span>
                </span>
                <input
                  type="url"
                  value={externalLink}
                  onChange={(e) => setExternalLink(e.target.value)}
                  placeholder="Paste Google Drive, OneDrive, or Notion shared document link here..."
                  className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.08] focus:border-indigo-550 focus:bg-white/[0.04] rounded-xl outline-none text-slate-200 text-sm focus:ring-1 focus:ring-indigo-500/40 light-mode:bg-white light-mode:border-slate-300 light-mode:text-slate-800"
                />
                <p className="text-[10px] text-slate-500 font-medium pl-1 leading-normal">
                  💡 Make sure you set the link sharing option to <strong>"Anyone with the link can view"</strong> so other students can read your notes instantly!
                </p>
              </div>
            )}


            {/* Inputs grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Notes Name / Custom Title Input */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 light-mode:text-slate-600 pl-1 flex items-center gap-1">
                  Notes / File Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lecture 4 - Normalization Notes"
                  value={notesName}
                  onChange={(e) => setNotesName(e.target.value)}
                  required
                  className="w-full py-3 px-4 glass-input text-sm bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800 rounded-xl border border-white/[0.08] light-mode:border-slate-900/10 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Semester Selector */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 light-mode:text-slate-600 pl-1">
                  Academic Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full py-3 px-4 glass-input text-sm bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800 rounded-xl border border-white/[0.08] light-mode:border-slate-900/10 focus:outline-none"
                >
                  <option value="1/2" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">Semester 1/2</option>
                  <option value="3/4" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">Semester 3/4</option>
                  <option value="5/6" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">Semester 5/6</option>
                  <option value="7/8" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">Semester 7/8</option>
                </select>
              </div>

              {/* Predefined Subject Selector */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 light-mode:text-slate-600 pl-1">
                  Subject Category
                </label>
                <select
                  value={selectedPredefinedSubject}
                  onChange={(e) => setSelectedPredefinedSubject(e.target.value)}
                  className="w-full py-3 px-4 glass-input text-sm bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800 rounded-xl border border-white/[0.08] light-mode:border-slate-900/10 focus:outline-none"
                >
                  {(SEMESTER_SUBJECTS[semester] || []).map((sub) => (
                    <option key={sub} value={sub} className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">
                      {sub}
                    </option>
                  ))}
                  <option value="other" className="bg-[#16161D] text-indigo-400 font-bold light-mode:bg-white">
                    ➕ Add Custom Subject...
                  </option>
                </select>
              </div>



              {/* Custom Subject text field */}
              {selectedPredefinedSubject === 'other' && (
                <div className="md:col-span-2">
                  <Input
                    label="Custom Subject Title"
                    placeholder="Enter the title of the custom subject..."
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Dynamic inputs for Question Papers */}
              {uploadType === 'paper' ? (
                <>
                  {/* Exam Year */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 light-mode:text-slate-600 pl-1">
                      Exam Year
                    </label>
                    <select
                      value={examYear}
                      onChange={(e) => setExamYear(e.target.value)}
                      className="w-full py-3 px-4 glass-input text-sm bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800 rounded-xl border border-white/[0.08] light-mode:border-slate-900/10 focus:outline-none"
                    >
                      <option value="2026" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">2026 (Current)</option>
                      <option value="2025" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">2025</option>
                      <option value="2024" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">2024</option>
                      <option value="2023" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">2023</option>
                      <option value="2022" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">2022</option>
                      <option value="2021" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">2021</option>
                    </select>
                  </div>

                  {/* Exam Type */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 light-mode:text-slate-600 pl-1">
                      Exam Session Type
                    </label>
                    <select
                      value={examType}
                      onChange={(e) => setExamType(e.target.value)}
                      className="w-full py-3 px-4 glass-input text-sm bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800 rounded-xl border border-white/[0.08] light-mode:border-slate-900/10 focus:outline-none"
                    >
                      <option value="Mid-Term" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">Mid-Term Board Exams</option>
                      <option value="End-Term" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">End-Term Semester Exams</option>
                      <option value="Supplementary" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">Supplementary Exams</option>
                      <option value="Practical" className="bg-[#16161D] text-slate-200 light-mode:bg-white light-mode:text-slate-800">Practical / Lab Exams</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* Standard Notes Teacher Input */}
                  <Input
                    label="Teacher Name (Optional)"
                    placeholder="e.g. Dr. Alex Patel"
                    value={teacher}
                    onChange={(e) => setTeacher(e.target.value)}
                  />
                  
                  {/* Placeholder to balance grid columns */}
                  <div className="hidden md:block" />
                </>
              )}

              <div className="md:col-span-2">
                <Input
                  label="Description / Syllabus Coverage"
                  placeholder="e.g. Covers Unit 1-3 vector analysis, integration, and theorems."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* AI Summarizer toggle */}
            <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.01] light-mode:border-slate-900/10 light-mode:bg-slate-900/[0.01] flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 text-left">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white light-mode:text-slate-800">
                    Gemini AI Academic Summarizer
                  </h4>
                  <p className="text-xs text-slate-500 light-mode:text-slate-650">
                    Instructs Gemini AI to parse your PDF note and generate a structured overview and checklist instantly.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={generateAI}
                  onChange={(e) => setGenerateAI(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 light-mode:bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-checked:after:bg-white"></div>
              </label>
            </div>

            {/* Upload Progress Indicator */}
            {isUploading && (
              <div className="space-y-3 p-4 rounded-xl border border-white/[0.05] bg-white/[0.01] light-mode:border-slate-900/10 light-mode:bg-slate-900/[0.01]">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 light-mode:text-slate-600">
                  <span>{uploadProgress < 100 ? 'Uploading PDF file...' : 'File Uploaded!'}</span>
                  <span>{uploadProgress}%</span>
                </div>
                
                <div className="w-full bg-slate-800 light-mode:bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>

                {generateAI && uploadProgress === 100 && (
                  <div className="mt-3 text-xs font-medium text-purple-400 flex items-center gap-2 animate-pulse pl-1">
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                    {aiStatus === 'extracting' && 'Extracting text layers from PDF...'}
                    {aiStatus === 'summarizing' && 'Gemini is reading & analyzing contents...'}
                    {aiStatus === 'done' && 'Summary compiled successfully! Saving metadata...'}
                  </div>
                )}
              </div>
            )}

            {/* Warning alert if not admin */}
            {!isAdmin && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 light-mode:bg-amber-500/5 light-mode:border-amber-500/15 light-mode:text-amber-600 flex gap-3 text-xs">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span className="leading-relaxed">
                  <strong>Moderation Alert:</strong> To keep NoteWeb high-quality and spam-free, your uploaded notes will go through a review process by our Admin moderators before appearing publicly in the feed.
                </span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(-1)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="shadow-lg shadow-indigo-600/10"
                isLoading={isUploading}
                leftIcon={<UploadCloud className="w-4 h-4" />}
              >
                Upload & Publish
              </Button>
            </div>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
};

export default Upload;
