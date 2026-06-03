# 🧠 NoteWeb Developer Preferences & Rules

This file contains the strict permanent preferences of the developer. Every AI agent must read and follow these rules exactly in every session.

## 🚨 Golden Rules

### 1. Zero-Crash & Solid Execution Guarantee
* **The app MUST build, open, and work flawlessly.**
* Before making any updates (whether to styles, features, or database), carefully analyze potential side-effects.
* Maintain complete stability across all platforms: **Android Mobile, Electron Desktop, and Web Browser**.
* Bypass strict type-checking compilation blockages by utilizing robust configurations, ensuring the user is never locked out of running the app.

### 2. Auto-Update Readiness
* Whenever making web or react changes, always provide clear steps/commands to sync them to the mobile and desktop clients (`npm run desktop:sync`, Capgo OTA uploads, and `npx cap copy android`).

### 3. Always Provide Git Commit & Push Commands
* **At the end of every change or task, ALWAYS provide exact, copy-pasteable Git commands** to stage, commit, and push all modifications to the GitHub repository.
* Ensure the git commit message is descriptive, clean, and accurately summarizes the tasks completed.
