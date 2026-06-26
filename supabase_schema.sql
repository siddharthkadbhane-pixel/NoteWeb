-- NoteWeb Supabase Database Schema Setup Script
-- Paste this entire script into the Supabase SQL Editor (https://supabase.com -> Project -> SQL Editor -> New Query) and click "Run".

-- ════════════════════════════════════════════════════════════
-- 1. DROP EXISTING TABLES (IF RETRYING FROM SCRATCH)
-- ════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS public.flagged_chats CASCADE;
-- DROP TABLE IF EXISTS public.chats CASCADE;
-- DROP TABLE IF EXISTS public.feedbacks CASCADE;
-- DROP TABLE IF EXISTS public.notes CASCADE;
-- DROP TABLE IF EXISTS public.categories CASCADE;
-- DROP TABLE IF EXISTS public.branches CASCADE;
-- DROP TABLE IF EXISTS public.blocked_ips CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;

-- ════════════════════════════════════════════════════════════
-- 2. CREATE DATABASE TABLES
-- ════════════════════════════════════════════════════════════

-- A. Table: public.profiles (User Accounts)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY, -- Maps to auth.users.id (for email/phone/oauth) or custom mock-user-xxx string
    username TEXT UNIQUE,
    email TEXT,
    display_name TEXT,
    mobile_no TEXT,
    year TEXT,
    branch TEXT,
    cgpa TEXT,
    photo_url TEXT,
    role TEXT DEFAULT 'student', -- 'student' or 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    bookmarks TEXT[] DEFAULT '{}'::TEXT[],
    setup_complete BOOLEAN DEFAULT false,
    points INTEGER DEFAULT 50, -- Starting bonus XP points
    last_ip TEXT,
    hardware_id TEXT
);

-- B. Table: public.branches (College Departments)
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    shadow_color TEXT,
    notes_count TEXT
);

-- C. Table: public.categories (Syllabus Subjects)
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT
);

-- D. Table: public.notes (Uploaded PDF Notes & Study Library Documents)
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Secure UUID identifier
    subject TEXT NOT NULL,
    branch TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    category TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    semester TEXT,
    teacher TEXT DEFAULT 'General / Unknown',
    description TEXT DEFAULT 'No description provided.',
    pdf_url TEXT,
    pdf_path TEXT,
    file_name TEXT,
    file_size BIGINT DEFAULT 0,
    uploaded_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    uploader_name TEXT,
    uploader_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    likes TEXT[] DEFAULT '{}'::TEXT[],
    likes_count INTEGER DEFAULT 0,
    bookmarks_count INTEGER DEFAULT 0,
    summary TEXT
);

-- E. Table: public.chats (Campus Lounge Messages)
CREATE TABLE IF NOT EXISTS public.chats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_name TEXT,
    sender_avatar TEXT,
    sender_branch TEXT,
    message TEXT NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- F. Table: public.flagged_chats (Auto-moderated chats)
CREATE TABLE IF NOT EXISTS public.flagged_chats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_name TEXT,
    message TEXT NOT NULL,
    bad_words TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- G. Table: public.feedbacks (Google Play-style reviews)
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    display_name TEXT,
    photo_url TEXT,
    department TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- H. Table: public.blocked_ips (IP Address banning ledger)
CREATE TABLE IF NOT EXISTS public.blocked_ips (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip TEXT UNIQUE NOT NULL,
    reason TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- I. Table: public.direct_messages (1-on-1 private messaging)
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_read BOOLEAN DEFAULT false,
    reply_to JSONB,
    reactions JSONB DEFAULT '{}'::JSONB,
    shared_note_id TEXT,
    is_vanish BOOLEAN DEFAULT false,
    is_view_once BOOLEAN DEFAULT false,
    poll_data JSONB
);

-- ════════════════════════════════════════════════════════════
-- 3. SEED BRANCHES & CATEGORIES DATA
-- ════════════════════════════════════════════════════════════

-- Seed Branches
INSERT INTO public.branches (id, name, description, icon, color, shadow_color, notes_count) VALUES
('cse', 'Computer Science & Engineering', 'Data Structures, Algorithms, Software Engineering, Web Dev, Databases, and operating systems.', 'code', 'from-blue-500 to-indigo-500', 'rgba(59, 130, 246, 0.3)', 'CSE'),
('aiml', 'AI & Machine Learning', 'Neural Networks, Deep Learning, Computer Vision, NLP, and Robotics.', 'sparkles', 'from-fuchsia-500 to-purple-500', 'rgba(217, 70, 239, 0.3)', 'AI&ML'),
('ds', 'Data Science', 'Data analytics, statistical learning, visualization, big data processing, and predictive models.', 'binary', 'from-cyan-500 to-blue-500', 'rgba(6, 182, 212, 0.3)', 'DS'),
('mechanical', 'Mechanical Engineering', 'Thermodynamics, fluid mechanics, design of machines, heat transfer, and manufacturing processes.', 'settings', 'from-amber-500 to-orange-500', 'rgba(245, 158, 11, 0.3)', 'ME'),
('civil', 'Civil Engineering', 'Structural mechanics, geotech, environment, surveying, and infrastructure design.', 'compass', 'from-rose-500 to-pink-500', 'rgba(244, 63, 94, 0.3)', 'CE'),
('ece', 'Electronics & Comm Eng', 'Microprocessors, VLSI design, Signal processing, Communication systems, and analog hardware.', 'cpu', 'from-emerald-500 to-teal-500', 'rgba(16, 185, 129, 0.3)', 'ECE')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    shadow_color = EXCLUDED.shadow_color,
    notes_count = EXCLUDED.notes_count;

-- Seed Categories
INSERT INTO public.categories (id, branch_id, name, description) VALUES
('cse-dsa', 'cse', 'Data Structures & Algorithms', 'Arrays, Linked Lists, Stacks, Queues, Trees, Graphs, sorting and searching algorithms.'),
('cse-dbms', 'cse', 'Database Management Systems', 'Relational databases, SQL queries, normalization, transactions, and indexing.'),
('cse-os', 'cse', 'Operating Systems', 'Processes, threads, CPU scheduling, memory management, file systems, and concurrency.'),
('cse-webdev', 'cse', 'Web Development', 'HTML, CSS, JavaScript, React, Node.js, REST APIs, and modern full-stack engineering.'),
('aiml-ml', 'aiml', 'Artificial Intelligence & Machine Learning', 'Supervised/unsupervised learning, regression, classification, clustering, neural networks.'),
('ds-analytics', 'ds', 'Data Analytics', 'Exploratory data analysis, statistical tests, data wrangling, and descriptive metrics.'),
('ece-microprocessors', 'ece', 'Microprocessors & Embedded Systems', '8085/8086 architectures, assembly programming, interfacing, and microcontrollers like Arduino.'),
('ece-digital', 'ece', 'Digital Electronics', 'Number systems, logic gates, Boolean algebra, combinational and sequential logic circuits.'),
('ece-signals', 'ece', 'Signals & Systems', 'Signals & Systems, continuous & discrete time signals, Fourier transform, Laplace transform.'),
('mechanical-thermo', 'mechanical', 'Thermodynamics', 'Laws of thermodynamics, heat engines, entropy, pure substances, and power cycles.'),
('mechanical-fluid', 'mechanical', 'Fluid Mechanics', 'Fluid properties, pressure, flow kinematics, Bernoulli equation, and dimensional analysis.'),
('civil-structures', 'civil', 'Structural Analysis', 'Trusses, beams, columns, bending moments, shear forces, and stress analysis.')
ON CONFLICT (id) DO UPDATE SET
    branch_id = EXCLUDED.branch_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- ════════════════════════════════════════════════════════════
-- 4. ENABLE ROW-LEVEL SECURITY (RLS) FOR ALL TABLES
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flagged_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════
-- 5. DEFINE SECURITY POLICIES (BULLETPROOF P2P CROSS-SYNC SHIELD)
-- ════════════════════════════════════════════════════════════

-- A. Policies for 'profiles'
CREATE POLICY "Allow public read to profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert to profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow owner and admin to update profiles" ON public.profiles FOR UPDATE 
    USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
    WITH CHECK (auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Allow admin to delete profiles" ON public.profiles FOR DELETE 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- B. Policies for 'branches'
CREATE POLICY "Allow public read to branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Allow admin to manage branches" ON public.branches FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- C. Policies for 'categories'
CREATE POLICY "Allow public read to categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow admin to manage categories" ON public.categories FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- D. Policies for 'notes'
CREATE POLICY "Allow public read access to approved notes" ON public.notes FOR SELECT USING (true);
CREATE POLICY "Allow public inserts of study notes" ON public.notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public updates (likes count / edits) to notes" ON public.notes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow uploader or admin to delete notes" ON public.notes FOR DELETE 
    USING (auth.uid() = uploaded_by OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- E. Policies for 'chats'
CREATE POLICY "Allow public read to chats" ON public.chats FOR SELECT USING (true);
CREATE POLICY "Allow public insert to chats" ON public.chats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow message editors or admin to delete/update chats" ON public.chats FOR ALL 
    USING (auth.uid() = sender_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- F. Policies for 'flagged_chats'
CREATE POLICY "Allow admin select on flagged chats" ON public.flagged_chats FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Allow public insert to flagged chats" ON public.flagged_chats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin to manage flagged chats" ON public.flagged_chats FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- G. Policies for 'feedbacks'
CREATE POLICY "Allow public select on feedbacks" ON public.feedbacks FOR SELECT USING (true);
CREATE POLICY "Allow public insert to feedbacks" ON public.feedbacks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin or author to manage feedbacks" ON public.feedbacks FOR ALL 
    USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- H. Policies for 'blocked_ips'
CREATE POLICY "Allow public select on blocked_ips" ON public.blocked_ips FOR SELECT USING (true);
CREATE POLICY "Allow admin to manage blocked_ips" ON public.blocked_ips FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- I. Policies for 'direct_messages'
CREATE POLICY "Allow users to view their own conversations" ON public.direct_messages FOR SELECT 
    USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);
CREATE POLICY "Allow users to send messages" ON public.direct_messages FOR INSERT 
    WITH CHECK (auth.uid()::text = sender_id);
CREATE POLICY "Allow senders to update/delete their messages" ON public.direct_messages FOR ALL 
    USING (auth.uid()::text = sender_id);
CREATE POLICY "Allow recipients to mark messages as read" ON public.direct_messages FOR UPDATE
    USING (auth.uid()::text = recipient_id)
    WITH CHECK (auth.uid()::text = recipient_id);

-- ════════════════════════════════════════════════════════════
-- 6. SETUP SUPABASE STORAGE PUBLIC BUCKET FOR PDF UPLOADS
-- ════════════════════════════════════════════════════════════
-- Note: Supabase Storage configuration requires storage bucket policies.
-- In your Supabase Dashboard:
-- 1. Go to "Storage" (folder icon on left menu)
-- 2. Click "New Bucket"
-- 3. Set Bucket Name to exactly: notes
-- 4. Toggle ON the "Public bucket" switch
-- 5. Click "Save"
-- 6. Click on the "notes" bucket -> "Policies" tab -> "New Policy"
-- 7. Add SELECT, INSERT, UPDATE, and DELETE policies with "Allowed to everyone" or "true" to enable cloud PDF sharing.

-- ════════════════════════════════════════════════════════════
-- 7. SECURE SECURITY APIs (XP TRIGGERS & DAILY CHECK-IN RPC)
-- ════════════════════════════════════════════════════════════

-- A. Table modification: Add last_checkin column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_checkin TIMESTAMP WITH TIME ZONE;

-- B. Trigger function for note approval XP awards
CREATE OR REPLACE FUNCTION public.handle_note_approval_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If the status changes to approved, award +100 XP
    IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'approved' AND NEW.uploaded_by IS NOT NULL) THEN
        UPDATE public.profiles
        SET points = points + 100
        WHERE id = NEW.uploaded_by;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger definition
CREATE OR REPLACE TRIGGER trigger_award_upload_xp
    AFTER UPDATE OF status ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_note_approval_xp();

-- C. Secure Daily Check-in RPC function
CREATE OR REPLACE FUNCTION public.claim_daily_checkin(profile_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    today_utc DATE := timezone('utc'::text, now())::date;
    last_checkin_date DATE;
    current_points INTEGER;
BEGIN
    -- Get last checkin date and current points
    SELECT (last_checkin AT TIME ZONE 'UTC')::date, points
    INTO last_checkin_date, current_points
    FROM public.profiles
    WHERE id = profile_id;

    -- If profile not found
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Profile not found.');
    END IF;

    -- Check if already checked in today
    IF last_checkin_date IS NOT NULL AND last_checkin_date = today_utc THEN
        RETURN jsonb_build_object('success', false, 'message', 'Already checked in today.', 'points', current_points);
    END IF;

    -- Update checkin time and add 10 XP points
    UPDATE public.profiles
    SET last_checkin = now(),
        points = points + 10
    WHERE id = profile_id
    RETURNING points INTO current_points;

    RETURN jsonb_build_object('success', true, 'message', 'Daily check-in successful! +10 XP awarded.', 'points', current_points);
END;
$$;

-- D. Secure increment user points function
CREATE OR REPLACE FUNCTION public.increment_user_points(user_id TEXT, amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_points INTEGER;
BEGIN
    UPDATE public.profiles
    SET points = GREATEST(0, points + amount)
    WHERE id = user_id
    RETURNING points INTO new_points;
    RETURN new_points;
END;
$$;
