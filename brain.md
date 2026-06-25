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
| **AI** | Google Gemini 2.5 Flash (via OpenRouter or direct API) |
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

### 1. Authentication (`AuthContext.tsx`)
- Supabase Auth (email/password)
- Stores extended user profile in a `profiles` table
- Manages XP points, user role (`admin` / `user`), avatar, display name
- `VITE_ADMIN_EMAILS` env var whitelists admin accounts

### 2. AI Service (`services/gemini.ts`)
- **Primary:** OpenRouter → `google/gemini-2.5-flash` (if `VITE_OPENROUTER_API_KEY` is set)
- **Fallback:** Direct Google Gemini beta API (if only `VITE_GEMINI_API_KEY` is set)
- Used for: note summarization, AI Q&A on PDFs, study assistant chat

### 3. Daily Quests (`utils/quests.ts`)
- Fully **localStorage-based** (no DB dependency)
- Auto-resets daily (keyed by `toDateString()`)
- 6 default quests: Daily Check-in, Library Explorer, Lounge Connector, Content Appreciator, AI Academic Scholar, Knowledge Contributor
- XP rewards claimed via `claimQuestReward()` → updates remote DB via AuthContext
- Progress tracked via `incrementQuestProgress()` + custom DOM events:
  - `noteweb-quest-completed` — fires when a quest hits its goal
  - `noteweb-quests-updated` — fires on any quest state change

### 4. PDF System
- **Upload:** Cloudinary for file storage
- **Extraction:** `pdfjs-dist` in `services/pdf.ts`
- **Offline Cache:** IndexedDB via `utils/pdfDb.ts`

### 5. Real-time Chat (`pages/Chat.tsx`)
- Supabase Realtime subscriptions
- User presence tracked via `services/presence.ts`
- Notifications: native (`@capacitor/local-notifications`) on Android; Web Notifications API on browser

### 6. Navigation (`components/Navigation/Sidebar.tsx`)
- **Desktop (>=1024px):** Left icon dock sidebar
- **Mobile / Native:** Bottom navigation bar
- Platform detection: `Capacitor.getPlatform()` + `window.innerWidth`

### 7. Theme System (`context/ThemeContext.tsx`)
- Dark / light mode toggle
- Persisted in `localStorage`
- Applied as a `.dark` class on the root HTML element (Tailwind dark mode)

---

## 🚀 Scripts & Deployment

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run deploy` | Build + deploy to GitHub Pages (`gh-pages`) |
| `npm run electron:start` | Build + launch Electron desktop app |
| `npm run desktop:sync` | Sync web dist into packaged Electron app |
| `npm run mobile:build` | Build + sync to Capacitor (Android/iOS) |

### Mobile OTA Update Flow (Capgo)
1. `npm run build` — build the web assets
2. `npx cap copy android` — copy to Android project
3. Upload via Capgo CLI — delivers OTA to devices automatically (`autoUpdate: true`)

### Desktop Sync Flow
```powershell
npm run desktop:sync
# Copies dist/* → dist-desktop/NoteWeb-win32-x64/resources/app/dist
# Copies electron/main.cjs → dist-desktop/.../electron/main.cjs
```

---

## 🚨 Developer Golden Rules

From [`DEVELOPER_PREFERENCES.md`](./DEVELOPER_PREFERENCES.md):

1. **Zero-Crash Guarantee** — App must build and work on all 3 platforms (Android, Electron, Web) before any change is shipped. Analyze side-effects carefully.
2. **Auto-Update Readiness** — After web/React changes, always provide sync commands: `npm run desktop:sync`, Capgo OTA upload, `npx cap copy android`.
3. **Git Commit & Push** — End every task with exact, copy-pasteable git commands with a descriptive commit message.

---

## 🗄️ Database

- Backend: **Supabase (PostgreSQL)**
- Full schema: [`supabase_schema.sql`](./supabase_schema.sql)
- Client + all query helpers: [`src/supabase/config.ts`](./src/supabase/config.ts)
- **Row Level Security (RLS)** is enabled on all tables

Key tables (inferred from codebase):
- `profiles` — user accounts, XP, role, display name, avatar
- `notes` / `documents` — uploaded PDF notes metadata
- `messages` — Campus Lounge chat messages
- `feedback` — user-submitted feedback

---

## 🎨 Design System

- **CSS Framework:** Tailwind CSS v4
- **Theme:** Dark-first design with glassmorphism panels
- **Background:** Animated particle/network canvas (`InteractiveBackground.tsx`)
- **Animations:** Framer Motion throughout
- **Color Tokens:** Defined in `tailwind.config.js`
- **Font:** System defaults + Tailwind typography
- **Dark Mode:** Class-based (`.dark` on `<html>`)

---

## 🔗 Key File References

| File | Purpose |
|------|---------|
| [`src/App.tsx`](./src/App.tsx) | Root app, all providers, routing |
| [`src/context/AuthContext.tsx`](./src/context/AuthContext.tsx) | Auth state, user profile, XP |
| [`src/supabase/config.ts`](./src/supabase/config.ts) | DB client + all queries |
| [`src/services/gemini.ts`](./src/services/gemini.ts) | AI (OpenRouter / Gemini) |
| [`src/utils/quests.ts`](./src/utils/quests.ts) | Daily quest engine |
| [`src/utils/pdfDb.ts`](./src/utils/pdfDb.ts) | IndexedDB PDF cache |
| [`DEVELOPER_PREFERENCES.md`](./DEVELOPER_PREFERENCES.md) | Golden rules |
| [`supabase_schema.sql`](./supabase_schema.sql) | Full DB schema |
| [`capacitor.config.json`](./capacitor.config.json) | Mobile/OTA config |

---

*Last updated: 2026-06-25*
