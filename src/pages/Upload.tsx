import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, Sparkles, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { extractTextFromPdf } from '../services/pdf';
import { summarizeNotes, classifyNoteCategory } from '../services/gemini';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';

export const Upload: React.FC = () => {
  const { user, userProfile, isAdmin } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  // Branch and Category states
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [categories, setCategories] = useState<{ id: string; branchId: string; name: string; description?: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [semester, setSemester] = useState('1');
  const [teacher, setTeacher] = useState('');
  const [description, setDescription] = useState('');
  const [generateAI, setGenerateAI] = useState(true);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [aiStatus, setAiStatus] = useState<'idle' | 'extracting' | 'summarizing' | 'done'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch branches and categories dynamically on load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: branchesData } = await supabase.from('branches').select('*');
        const { data: categoriesData } = await supabase.from('categories').select('*');

        let branchesList = (branchesData || []).map((b: any) => ({
          id: b.id,
          name: b.name
        }));

        let categoriesList = (categoriesData || []).map((c: any) => ({
          id: c.id,
          branchId: c.branch_id || c.branchId || '',
          name: c.name,
          description: c.description
        }));

        if (branchesList.length === 0) {
          branchesList = [
            { id: 'computers', name: 'Computer Science' },
            { id: 'maths', name: 'Mathematics' },
            { id: 'science', name: 'Basic Science & Eng' },
            { id: 'electronics', name: 'Electronics & Comm' },
            { id: 'mechanical', name: 'Mechanical & Civil' },
            { id: 'management', name: 'Management & Humanities' }
          ];
        }

        if (categoriesList.length === 0) {
          categoriesList = [
            { id: 'computers-dsa', branchId: 'computers', name: 'Data Structures & Algorithms' },
            { id: 'computers-dbms', branchId: 'computers', name: 'Database Management Systems' },
            { id: 'computers-os', branchId: 'computers', name: 'Operating Systems' },
            { id: 'computers-webdev', branchId: 'computers', name: 'Web Development' }
          ];
        }

        setBranches(branchesList);
        setCategories(categoriesList);

        if (branchesList.length > 0) {
          setSelectedBranch(branchesList[0].id);
          const firstBranchCats = categoriesList.filter((c: any) => c.branchId === branchesList[0].id);
          if (firstBranchCats.length > 0) {
            setSelectedCategory(firstBranchCats[0].id);
          }
        }
      } catch (e) {
        console.error("Error loading upload configurations:", e);
      }
    };
    fetchData();
  }, []);

  // Sync selected Category when selected Branch changes
  useEffect(() => {
    if (selectedBranch && categories.length > 0) {
      const filtered = categories.filter(c => c.branchId === selectedBranch);
      if (filtered.length > 0) {
        setSelectedCategory(filtered[0].id);
      } else {
        setSelectedCategory('');
      }
    }
  }, [selectedBranch, categories]);

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
    } else {
      error("Only PDF notes are supported!");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
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
    if (!file) {
      error("Please choose or drag a PDF notes file");
      return;
    }
    if (!subject.trim()) {
      error("Subject name is required");
      return;
    }
    if (!selectedBranch) {
      error("Academic branch is required");
      return;
    }
    if (!selectedCategory) {
      error("Subject category is required");
      return;
    }

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
      // 1. Upload PDF to Supabase Storage
      const uniqueFileName = `${Date.now()}_${file.name}`;
      const uid = user ? user.uid : 'anonymous';
      const storagePath = `notes/${uid}/${uniqueFileName}`;

      const { error: storageErr } = await supabase.storage
        .from('notes')
        .upload(storagePath, file);

      clearInterval(progressInterval);

      if (storageErr) {
        throw new Error(storageErr.message || "Failed to upload file to storage");
      }

      setUploadProgress(100);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('notes')
        .getPublicUrl(storagePath);

      if (!urlData || !urlData.publicUrl) {
        throw new Error("Could not retrieve public URL for uploaded notes");
      }

      const downloadUrl = urlData.publicUrl;
      
      let aiExtractedText = '';
      setAiStatus('extracting');
      try {
        aiExtractedText = await extractTextFromPdf(file);
      } catch (pdfErr) {
        console.error("Text extraction failed:", pdfErr);
      }

      // AI Category auto-sorting check inside subject catalog
      let finalCategory = selectedCategory;
      let finalBranch = selectedBranch;
      let autoCorrected = false;
      let detectedCategoryName = '';
      
      try {
        // Map our custom categories array into flat list Gemini classifier accepts
        const classifiedId = await classifyNoteCategory(subject, description, aiExtractedText, categories);
        if (classifiedId && classifiedId !== selectedCategory) {
          const matchedCat = categories.find(c => c.id === classifiedId);
          if (matchedCat) {
            finalCategory = classifiedId;
            finalBranch = matchedCat.branchId || selectedBranch;
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
      const initialStatus = isAdmin ? 'approved' : 'pending';
      
      const uploadedBy = user ? user.uid : 'anonymous-uploader';
      const uploaderName = user ? (userProfile?.displayName || user.displayName || 'Student') : 'Anonymous Student';
      const uploaderEmail = user ? (user.email || '') : 'anonymous@noteweb.local';

      const noteDoc = {
        subject: subject.trim(),
        branch: finalBranch,
        category: finalCategory,
        semester: semester,
        teacher: teacher.trim() || 'General / Unknown',
        description: description.trim() || 'No description provided.',
        pdf_url: downloadUrl,
        pdf_path: storagePath,
        file_name: file.name,
        file_size: file.size,
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

      const { error: insertErr } = await supabase.from('notes').insert([noteDoc]);
      if (insertErr) throw insertErr;

      if (autoCorrected) {
        success(`AI Auto-Sorted! We detected this note fits best under "${detectedCategoryName}" subject and auto-sorted it.`);
      } else {
        success(isAdmin 
          ? "Notes uploaded and published successfully!" 
          : "Notes uploaded successfully! Sent to Admin moderation board."
        );
      }

      navigate('/feed');

    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      error("Failed to complete note upload: " + err.message);
      setIsUploading(false);
    }
  };

  // Filter categories dynamically based on selected branch
  const activeBranchCategories = categories.filter(c => c.branchId === selectedBranch);

  return (
    <div className="min-h-screen w-full py-12 px-4 md:px-8 relative overflow-hidden text-left">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 glow-indigo rounded-full pointer-events-none blur-3xl opacity-30 animate-pulse" />
      
      <div className="max-w-3xl mx-auto z-10 relative">
        {/* Title */}
        <div className="text-left mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-white light-mode:text-slate-900 mb-2">
            Share Your Study Notes
          </h1>
          <p className="text-slate-400 light-mode:text-slate-500 font-medium text-sm">
            Upload PDF notes, choose categories, and enrich them with automatic Gemini AI summaries.
          </p>
        </div>

        {/* Upload Form */}
        <GlassPanel glowBorder className="bg-[#16161D]/30 light-mode:bg-white/80 p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6 text-left">
            {/* Drag & Drop PDF */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-1">
                Select Notes Document
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
                    <p className="font-semibold text-white light-mode:text-slate-800">
                      Drag & Drop your PDF notes here
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
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

            {/* Inputs grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <Input
                  label="Subject Title"
                  placeholder="e.g. Analysis of Algorithms"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              {/* Branch Selector */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-1">
                  Curriculum Branch
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full py-3 px-4 glass-input text-sm bg-slate-900 text-slate-200 light-mode:bg-white light-mode:text-slate-800 rounded-xl border border-white/[0.08]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Selector */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-1">
                  Subject Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={activeBranchCategories.length === 0}
                  className="w-full py-3 px-4 glass-input text-sm bg-slate-900 text-slate-200 light-mode:bg-white light-mode:text-slate-800 rounded-xl border border-white/[0.08] disabled:opacity-50"
                >
                  {activeBranchCategories.length > 0 ? (
                    activeBranchCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No subjects registered</option>
                  )}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-1">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full py-3 px-4 glass-input text-sm bg-slate-900 text-slate-200 light-mode:bg-white light-mode:text-slate-800 rounded-xl border border-white/[0.08]"
                >
                  <option value="1">1st Semester</option>
                  <option value="2">2nd Semester</option>
                  <option value="3">3rd Semester</option>
                  <option value="4">4th Semester</option>
                  <option value="5">5th Semester</option>
                  <option value="6">6th Semester</option>
                  <option value="7">7th Semester</option>
                  <option value="8">8th Semester</option>
                </select>
              </div>

              <Input
                label="Teacher Name (Optional)"
                placeholder="e.g. Dr. Ramesh Kumar"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
              />

              <div className="md:col-span-2">
                <Input
                  label="Description"
                  placeholder="Describe what these notes cover..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* AI Summarizer toggle */}
            <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.01] flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 text-left text-left">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white light-mode:text-slate-800">
                    Gemini AI Academic Summarizer
                  </h4>
                  <p className="text-xs text-slate-500">
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
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-checked:after:bg-white"></div>
              </label>
            </div>

            {/* Upload Progress Indicator */}
            {isUploading && (
              <div className="space-y-3 p-4 rounded-xl border border-white/[0.05] bg-white/[0.01]">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>{uploadProgress < 100 ? 'Uploading PDF file...' : 'File Uploaded!'}</span>
                  <span>{uploadProgress}%</span>
                </div>
                
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
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
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex gap-3 text-xs">
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
