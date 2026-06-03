import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { MotionConfig } from 'framer-motion';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

// Runtime detection without @capacitor/core to avoid laptop/web/electron bundler compilation errors
const isNative = typeof window !== 'undefined' && (
  typeof (window as any).Capacitor !== 'undefined' || 
  /android|iphone|ipad|ipod|capacitor/i.test(navigator.userAgent)
);

// Inform Capgo that the React bundle has loaded successfully.
// This confirms the update on the device and prevents auto-rollback.
if (typeof window !== 'undefined') {
  try {
    CapacitorUpdater.notifyAppReady();
    console.log('[NoteWeb OTA] notifyAppReady called successfully.');
  } catch (e) {
    // Gracefully ignore on Web or Electron desktop environments
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion={isNative ? "always" : "user"}>
      <App />
    </MotionConfig>
  </StrictMode>,
);
