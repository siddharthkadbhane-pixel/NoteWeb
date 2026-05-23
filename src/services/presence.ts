/**
 * NoteWeb Presence Service
 * Tracks which users are online across all browsers and devices
 * using Supabase Realtime Presence API.
 */

// Use the raw Supabase client for Realtime (imported directly)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uyqegcuithhbnvviujbv.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_I8b9i3SCxfnLBOMxrfrL6Q_0KV9SFiY';

// Dedicated realtime client instance (bypasses mock wrappers)
let realtimeClient: any = null;
try {
  realtimeClient = createClient(supabaseUrl, supabaseKey);
} catch (e) {
  console.warn('[Presence] Failed to create realtime client:', e);
}

export interface OnlineUser {
  uid: string;
  displayName: string;
  email: string;
  role: 'student' | 'admin';
  photoURL?: string;
  deviceId: string;
  deviceInfo: string;
  onlineSince: string;
  lastSeen: string;
}

// Generate a unique device ID for this browser session
const getDeviceId = (): string => {
  let id = sessionStorage.getItem('noteweb-device-id');
  if (!id) {
    id = `device-${Math.random().toString(36).substr(2, 12)}-${Date.now()}`;
    sessionStorage.setItem('noteweb-device-id', id);
  }
  return id;
};

// Get human-readable device info
const getDeviceInfo = (): string => {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  
  let browser = 'Unknown Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  let device = 'Desktop';
  if (isTablet) device = 'Tablet';
  else if (isMobile) device = 'Mobile';

  return `${browser} on ${device}`;
};

const PRESENCE_CHANNEL = 'noteweb:online-users';

let presenceChannel: any = null;
let currentUserPayload: OnlineUser | null = null;

// Callbacks for external consumers
type PresenceChangeCallback = (users: OnlineUser[]) => void;
const presenceListeners: PresenceChangeCallback[] = [];

export const subscribeToPresenceChanges = (cb: PresenceChangeCallback): (() => void) => {
  presenceListeners.push(cb);
  // Immediately deliver current state if available
  if (currentOnlineUsers.size > 0) {
    cb(getAllOnlineUsers());
  }
  return () => {
    const idx = presenceListeners.indexOf(cb);
    if (idx !== -1) presenceListeners.splice(idx, 1);
  };
};

// In-memory store of online users (keyed by deviceId)
const currentOnlineUsers = new Map<string, OnlineUser>();

const getAllOnlineUsers = (): OnlineUser[] => {
  return Array.from(currentOnlineUsers.values());
};

const notifyListeners = () => {
  const users = getAllOnlineUsers();
  presenceListeners.forEach(cb => cb(users));
};

/**
 * Join the presence channel — call this when user logs in
 */
export const joinPresence = async (userInfo: {
  uid: string;
  displayName: string;
  email: string;
  role: 'student' | 'admin';
  photoURL?: string;
}): Promise<void> => {
  if (!realtimeClient) {
    console.warn('[Presence] No realtime client available');
    return;
  }

  // Leave any existing channel first
  await leavePresence();

  const deviceId = getDeviceId();
  const now = new Date().toISOString();

  currentUserPayload = {
    uid: userInfo.uid,
    displayName: userInfo.displayName,
    email: userInfo.email,
    role: userInfo.role,
    photoURL: userInfo.photoURL || '',
    deviceId,
    deviceInfo: getDeviceInfo(),
    onlineSince: now,
    lastSeen: now,
  };

  try {
    presenceChannel = realtimeClient.channel(PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: deviceId,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        currentOnlineUsers.clear();
        
        for (const key of Object.keys(state)) {
          const presences = state[key];
          if (presences && presences.length > 0) {
            const p = presences[presences.length - 1]; // latest presence
            if (p && p.uid) {
              currentOnlineUsers.set(p.deviceId || key, p as OnlineUser);
            }
          }
        }
        notifyListeners();
      })
      .on('presence', { event: 'join' }, ({ newPresences }: any) => {
        for (const p of newPresences) {
          if (p && p.uid) {
            currentOnlineUsers.set(p.deviceId || p.uid, p as OnlineUser);
          }
        }
        notifyListeners();
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
        for (const p of leftPresences) {
          const key = p.deviceId || p.uid;
          currentOnlineUsers.delete(key);
        }
        notifyListeners();
      })
      .subscribe(async (status: string) => {
        console.log('[Presence] Channel status:', status);
        if (status === 'SUBSCRIBED' && currentUserPayload) {
          await presenceChannel.track(currentUserPayload);
          console.log('[Presence] Tracking user:', currentUserPayload.displayName, 'on', currentUserPayload.deviceInfo);
        }
      });

  } catch (e) {
    console.warn('[Presence] Failed to join presence channel:', e);
  }
};

/**
 * Leave the presence channel — call this when user logs out or tab closes
 */
export const leavePresence = async (): Promise<void> => {
  if (presenceChannel) {
    try {
      await presenceChannel.untrack();
      await realtimeClient?.removeChannel(presenceChannel);
    } catch (e) {
      console.warn('[Presence] Error leaving channel:', e);
    }
    presenceChannel = null;
  }
  currentUserPayload = null;
};

/**
 * Update the last-seen timestamp (call periodically to show activity)
 */
export const heartbeat = async (): Promise<void> => {
  if (!presenceChannel || !currentUserPayload) return;
  try {
    currentUserPayload = {
      ...currentUserPayload,
      lastSeen: new Date().toISOString(),
    };
    await presenceChannel.track(currentUserPayload);
  } catch (e) {
    // Silent — heartbeat failures are non-critical
  }
};

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    leavePresence();
  });
  
  // Heartbeat every 30 seconds
  setInterval(() => {
    if (currentUserPayload) {
      heartbeat();
    }
  }, 30000);
}
