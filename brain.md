# 🧠 NoteWeb — Project Brain

> Complete knowledge base for the NoteWeb app. Every AI agent and developer must read this before making any changes.

---

## 📌 Project Identity

| Field | Value |
|-------|-------|
| **App Name** | NoteWeb |
| **Package ID** | `com.noteweb.app` |
| **Version** | `0.0.0` (Early Development) |
| **Repository** | `siddharthkadbhane-pixel/NoteWeb` |
| **Live URL** | https://siddharthkadbhane-pixel.github.io/NoteWeb/ |
| **Primary Purpose** | Academic Hub — share, study, and collaborate on college notes |

---

## 🏗️ Architecture Overview

NoteWeb is a **multi-platform** application built on a single React/TypeScript codebase:

- 🌐 **Web Browser** → GitHub Pages (gh-pages deploy)
- 📱 **Android** → Capacitor 6 + Capgo OTA updates
- 🖥️ **Desktop** → Electron 34

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 + TypeScript 6 |
| **Build Tool** | Vite 8 |
| **Styling** | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| **Routing** | React Router DOM v7 (`HashRouter`) |
| **Animation** | Framer Motion v12 |
| **Icons** | Lucide React v1 |
| **Backend/DB** | Supabase (Auth + PostgreSQL + Realtime) |
| **AI** | Google Gemini 2.5 Flash (via OpenRouter, direct API, or Custom server) |
| **AI API Server** | Node.js + Express + `pdf-parse` (`server.js`) |
| **PDF Handling** | `pdfjs-dist` v5 + IndexedDB (`pdfDb.ts`) |
| **Media Storage** | Cloudinary (image/file uploads) |
| **Mobile** | Capacitor 6 (`@capacitor/android`, `@capacitor/ios`) |
| **OTA Updates** | Capgo (`@capgo/capacitor-updater`) — autoUpdate enabled |
| **Desktop** | Electron 34 (`electron/main.cjs`) |
| **Notifications** | `@capacitor/local-notifications` (native) + Web Notifications API |

---

## 📁 Project Structure

```
note app/
├── src/
│   ├── App.tsx                    # Root app, routing, providers, global listeners
│   ├── main.tsx                   # React entry point
│   ├── index.css                  # Global styles + Tailwind base
│   ├── App.css                    # App-level styles
│   │
│   ├── pages/                     # Full-page route components
│   │   ├── Home.tsx               # Landing/dashboard page
│   │   ├── Login.tsx              # Auth (login + register combined)
│   │   ├── Register.tsx           # Redirect stub to Login
│   │   ├── Categories.tsx         # Note categories browser
│   │   ├── Feed.tsx               # Notes library/feed
│   │   ├── Upload.tsx             # PDF upload and management
│   │   ├── Profile.tsx            # User profile (own + others via /profile/:uid)
│   │   ├── Chat.tsx               # Campus Lounge real-time chat
│   │   ├── Leaderboard.tsx        # XP-based leaderboard
│   │   ├── Quests.tsx             # Daily quest system
│   │   ├── Feedback.tsx           # User feedback/bug reporting
│   │   ├── Admin.tsx              # Admin control panel (admin-only route)
│   │   ├── About.tsx              # About page
│   │   └── DetailsSetup.tsx       # Post-registration details setup
│   │
│   ├── components/
│   │   ├── Navigation/
│   │   │   ├── Sidebar.tsx        # Unified nav (desktop dock + mobile bottom bar)
│   │   │   └── FloatingThemeToggle.tsx  # Dark/light mode toggle button
│   │   ├── ui/
│   │   │   ├── InteractiveBackground.tsx # Animated particle network background
│   │   │   ├── AppSkeleton.tsx    # Full-page loading skeleton
│   │   │   ├── Button.tsx         # Reusable button component
│   │   │   ├── Input.tsx          # Styled input component
│   │   │   ├── GlassPanel.tsx     # Glassmorphism panel wrapper
│   │   │   ├── PageWrapper.tsx    # Page transition wrapper
│   │   │   ├── Skeleton.tsx       # Generic content skeleton
│   │   │   ├── SparkleBurst.tsx   # Sparkle animation effect
│   │   │   └── TiltCard.tsx       # 3D tilt hover card
│   │   ├── LocalErrorBoundary.tsx # Per-component error boundary
│   │   ├── ProtectedRoute.tsx     # Auth guard HOC (supports adminOnly prop)
│   │   └── ScreenshotProtection.tsx # Screenshot prevention (mobile)
│   │
│   ├── context/
│   │   ├── AuthContext.tsx        # Global auth state, user profile, XP/points logic
│   │   ├── ThemeContext.tsx       # Dark/light theme state + localStorage persistence
│   │   └── ToastContext.tsx       # Global toast notification system
│   │
│   ├── services/
│   │   ├── gemini.ts              # AI service: OpenRouter + direct Gemini 2.5 Flash
│   │   ├── pdf.ts                 # PDF text extraction using pdfjs-dist
│   │   └── presence.ts            # Real-time user presence (Supabase Realtime)
│   │
│   ├── supabase/
│   │   └── config.ts              # Supabase client initialization + all DB helpers
│   │
│   └── utils/
│       ├── quests.ts              # Daily quest system logic (localStorage-based)
│       ├── pdfDb.ts               # IndexedDB wrapper for offline PDF caching
│       ├── sounds.ts              # UI sound effects
│       └── avatar.tsx             # Avatar generation utility
│
├── electron/
│   └── main.cjs                   # Electron main process
├── android/                       # Capacitor Android project
├── public/                        # Static assets
├── dist/                          # Web build output
├── dist-desktop/                  # Electron packaged app
├── supabase_schema.sql            # Full database schema
├── capacitor.config.json          # Capacitor/OTA configuration
├── tailwind.config.js             # Tailwind theme config
├── vite.config.ts                 # Vite build configuration
├── server.js                      # Custom Node.js/Express AI Summarization API server
├── DEVELOPER_PREFERENCES.md       # Golden rules — read first!
└── brain.md                       # This file
```

---

## 🔐 Environment Variables

Located in `.env` (copy from `.env.example`):

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |
| `VITE_GEMINI_API_KEY` | Direct Google Gemini API key (fallback) |
| `VITE_OPENROUTER_API_KEY` | OpenRouter key (preferred, enables premium AI) |
| `VITE_ADMIN_EMAILS` | Comma-separated list of admin usernames/emails |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name for media uploads |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |
| `VITE_AI_API_URL` | Custom AI API server url (bypasses Supabase load & secures keys) |

---

## 🗺️ Routing

Uses **HashRouter** (required for GitHub Pages + Electron compatibility).

| Path | Page | Auth Required |
|------|------|:---:|
| `/` | Home | No |
| `/about` | About | No |
| `/login` | Login / Register | No |
| `/categories` | Categories | No |
| `/feed` | Notes Feed | No |
| `/upload` | Upload Notes | Yes |
| `/profile` | Own Profile | Yes |
| `/profile/:uid` | Any User Profile | Yes |
| `/chat` | Campus Lounge Chat | Yes |
| `/leaderboard` | Leaderboard | Yes |
| `/quests` | Daily Quests | Yes |
| `/feedback` | Feedback | Yes |
| `/admin` | Admin Panel | Yes + Admin only |

---

## 🧩 Key Systems

### 1. Authentication & Security RPCs (`AuthContext.tsx` & `supabase/config.ts`)
- Supabase Auth (email/password)
- Stores extended user profile in a `profiles` table
- Manages XP points, user role (`admin` / `user`), avatar, display name
- **Secure XP Increment RPC**: Dynamic points updates are routed securely through the Supabase RPC function `increment_user_points` to prevent client-side DB manipulation. A mock RPC fallback handles local/offline points addition.
- `VITE_ADMIN_EMAILS` env var whitelists admin accounts

### 2. AI Service (`services/gemini.ts` & `server.js`)
- **Primary**: Custom Backend API Server (`server.js` at `VITE_AI_API_URL`) — processes summaries off-client, securely holds API keys, and creates zero storage/load on Supabase.
- **Secondary**: OpenRouter → `google/gemini-2.5-flash` (if `VITE_OPENROUTER_API_KEY` is set)
- **Fallback**: Direct Google Gemini beta API (if only `VITE_GEMINI_API_KEY` is set)
- **Local Summary Caching**: Generated summaries are cached locally in the browser's IndexedDB to prevent repetitive API requests and eliminate Supabase database writes.
- Used for: note summarization, AI Q&A on PDFs, study assistant chat

### 3. Daily Quests & Study Badges (`utils/quests.ts` & `utils/achievements.ts`)
- **Daily Quests**: Fully **localStorage-based** (no DB dependency), auto-resets daily (keyed by `toDateString()`). Tracked via `incrementQuestProgress()` and custom DOM events.
- **Achievements & Badges Showcase**: Tracks user stats (points, uploads, chats, PDF reads) and awards badges (**Note Pioneer**, **XP Sovereign**, **Lounge VIP**, **Scholar**). Rendered in a sleek glassmorphic grid with custom progress bars on `Profile.tsx`.

### 4. PDF System & In-App PDF Viewer
- **Upload**: Cloudinary for file storage
- **Extraction**: `pdfjs-dist` in `services/pdf.ts`
- **Offline Cache**: IndexedDB via `utils/pdfDb.ts` to cache downloaded PDFs locally.
- **In-App PDF Viewer Modal**: An overlay modal (`PdfViewerModal.tsx`) triggered via custom DOM event `noteweb-open-pdf` allowing inline reading of documents. Tapping or clicking anywhere on note cards in the Feed immediately launches the reader (event propagation is blocked on interactive controls like Like, Bookmark, and AI Companion).

### 5. True Offline Mode & Cache Persistence (`pages/Feed.tsx` & `Categories.tsx`)
- Detects network connectivity changes in real-time.
- Caches loaded branches, categories, and notes locally in `localStorage` as a fallback.
- Renders a prominent **vibrant red glassmorphic banner** when offline: *"Offline Mode Active — Browsing Cached Library"*.

### 6. Real-time Chat, Typing Indicators & E2EE Security (`pages/Chat.tsx`)
- Supabase Realtime subscriptions for Campus Lounge chat and private messages.
- User presence tracked via `services/presence.ts`.
- **Typing Indicators**: Emits and listens to `typing` events on channels, displaying an animated bouncing dots indicator (*"Classmate is typing..."*) for a dynamic feel.
- **Client-Side End-to-End Encryption (E2EE)**: Secure zero-trust message encryption using standard browser Web Crypto Subtle API (AES-GCM-256 with 256-bit PBKDF2 keys derived client-side). Encrypted payloads are stored as hexadecimal ciphertext blocks. Decryption keys are stored in tab-only `sessionStorage` and never leak to servers.
- **Adaptive Wallpaper Contrast System**: Automatically classifies solid hex background colors (using standard HSP equation with threshold 180), preset assets (e.g. bubblegum, autumn, pastel), and custom URLs to dynamically adjust text styles, glow, borders, logo overlays (`NoteWebLogo`), and mobile input templates (`MobileInputBar`) for high legibility on any light, dark, or textured background.
- Notifications: native (`@capacitor/local-notifications`) on Android; Web Notifications API on browser.

### 7. Navigation (`components/Navigation/Sidebar.tsx`)
- **Desktop (>=1024px)**: Left icon dock sidebar.
- **Mobile / Native**: Bottom navigation bar.
- Platform detection: `Capacitor.getPlatform()` + `window.innerWidth`.

### 8. Theme System (`context/ThemeContext.tsx`)
- Dark / light mode toggle, persisted in `localStorage`.
- Applied as a `.dark` class on the root HTML element.

---

## 🚀 Scripts & Deployment

On Windows systems, command execution may block standard `.ps1` shell scripts. Always run scripts using `npm.cmd` wrappers.

| Command | Description |
|---------|-------------|
| `npm.cmd run dev` | Start Vite dev server |
| `npm.cmd run build` | TypeScript compile + Vite production build |
| `npm.cmd run deploy` | Build + deploy to GitHub Pages (`gh-pages`) |
| `npm.cmd run electron:start` | Build + launch Electron desktop app |
| `npm.cmd run desktop:sync` | Sync web dist into packaged Electron app |
| `npm.cmd run mobile:build` | Build + sync to Capacitor (Android/iOS) |

---

## 🔄 Platform Update & Sync Architecture

Here is how each platform target receives updates and compiles:

### 🖥️ Desktop App (Electron)
* **Update Source**: Local filesystem build (`dist/index.html`).
* **Workflow**: 
  1. Developers compile the code and copy assets to the Electron resource directory:
     ```powershell
     npm.cmd run desktop:build
     ```
     *(This runs `npm run build && npm run desktop:sync` which builds Vite and copies `dist/` directly into the Electron directory).*
  2. The packaged Electron app (`electron/main.cjs`) is configured to load the local `dist/index.html` file first.

### 📱 Mobile App (Capacitor)
* **Update Source**: Live Git link (GitHub Pages) over-the-air.
* **Workflow**:
  1. The Capacitor configuration (`capacitor.config.json`) sets the server URL to the live GitHub Pages link:
     `"url": "https://siddharthkadbhane-pixel.github.io/NoteWeb/"`
  2. Pushing updates live to GitHub Pages using the deploy command:
     ```powershell
     npm.cmd run deploy
     ```
     automatically updates the webview inside the mobile app instantly for all users.

---

## 🚨 Developer Golden Rules (Sync & Release Flow)

Every developer or AI agent modifying this codebase MUST strictly execute the Sync & Release workflow below after **any code change** to ensure zero-crash multi-platform updates:

### 1. Rebuild & Update Local Targets
Close any active Electron instances, then compile the code and copy assets to destination platforms:
```powershell
# 1. Compile the React/Vite source code
npm.cmd run build

# 2. Sync changes into the packaged Electron Desktop app
npm.cmd run desktop:sync

# 3. Copy changes to the Android Capacitor app for OTA/Native builds
npx cap copy android
```

### 2. Live Git Link & Remote Update Commands
To push the changes live to GitHub Pages (Web) and deploy Capacitor OTA updates (Mobile/Capgo), copy and paste these commands in the terminal:

```powershell
git add .
git commit -m "feat: implement latest features and sync across all platforms"
git push origin main
```

---

## 🗄️ Database

- Backend: **Supabase (PostgreSQL)**
- Full schema: [`supabase_schema.sql`](./supabase_schema.sql)
- Client + all query helpers: [`src/supabase/config.ts`](./src/supabase/config.ts)
- **Row Level Security (RLS)** is enabled on all tables.
- Custom functions & security triggers (e.g., daily check-in points updates, user profiles management) are executed via database-level SQL scripts.

Key tables:
- `profiles` — user accounts, XP, role, display name, avatar
- `notes` — uploaded PDF notes metadata
- `messages` — Campus Lounge chat messages
- `feedback` — user-submitted feedback

---

## 🎨 Design System

- **CSS Framework**: Tailwind CSS v4
- **Theme**: Dark-first design with glassmorphism panels
- **Background**: Animated particle/network canvas (`InteractiveBackground.tsx`)
- **Animations**: Framer Motion throughout
- **Color Tokens**: Defined in `tailwind.config.js`
- **Font**: System defaults + Tailwind typography
- **Dark Mode**: Class-based (`.dark` on `<html>`)

---

## 🔗 Key File References

| File | Purpose |
|------|---------|
| [`src/App.tsx`](./src/App.tsx) | Root app, all providers, routing |
| [`src/context/AuthContext.tsx`](./src/context/AuthContext.tsx) | Auth state, user profile, XP |
| [`src/supabase/config.ts`](./src/supabase/config.ts) | DB client + all queries |
| [`src/services/gemini.ts`](./src/services/gemini.ts) | AI (OpenRouter / Gemini) |
| [`src/utils/quests.ts`](./src/utils/quests.ts) | Daily quest engine |
| [`src/utils/achievements.ts`](./src/utils/achievements.ts) | Badges and milestones |
| [`src/utils/pdfDb.ts`](./src/utils/pdfDb.ts) | IndexedDB PDF cache |
| [`DEVELOPER_PREFERENCES.md`](./DEVELOPER_PREFERENCES.md) | Golden rules |
| [`supabase_schema.sql`](./supabase_schema.sql) | Full DB schema |
| [`capacitor.config.json`](./capacitor.config.json) | Mobile/OTA config |

---

*Last updated: 2026-06-30*
