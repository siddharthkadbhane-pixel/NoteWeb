export interface Quest {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  progress: number;
  maxProgress: number;
  completed: boolean;
  claimed: boolean;
  category: string;
}

export const getActiveUserUid = (): string | null => {
  if (typeof window === 'undefined') return null;
  const uid = localStorage.getItem('noteweb-mock-uid');
  if (uid && uid !== 'guest-user-noteweb') {
    return uid;
  }
  return null;
};

const getTodayDateString = (): string => {
  return new Date().toDateString(); // e.g., "Thu Jun 04 2026"
};

const generateDefaultQuests = (): Quest[] => [
  {
    id: 'daily-login',
    title: 'Daily Check-in',
    description: 'Claim your attendance check-in bonus!',
    xpReward: 10,
    progress: 1,
    maxProgress: 1,
    completed: true, // check-in is instantly ready to claim
    claimed: false,
    category: 'daily'
  },
  {
    id: 'read-notes',
    title: 'Library Explorer',
    description: 'Read or study 2 note documents in the library.',
    xpReward: 15,
    progress: 0,
    maxProgress: 2,
    completed: false,
    claimed: false,
    category: 'daily'
  },
  {
    id: 'send-chat',
    title: 'Lounge Connector',
    description: 'Send 1 message in the Campus Lounge Chat.',
    xpReward: 15,
    progress: 0,
    maxProgress: 1,
    completed: false,
    claimed: false,
    category: 'daily'
  },
  {
    id: 'like-note',
    title: 'Content Appreciator',
    description: 'Like 1 study note in the library.',
    xpReward: 10,
    progress: 0,
    maxProgress: 1,
    completed: false,
    claimed: false,
    category: 'daily'
  },
  {
    id: 'ask-ai',
    title: 'AI Academic Scholar',
    description: 'Ask NoteWeb AI a question on any note.',
    xpReward: 20,
    progress: 0,
    maxProgress: 1,
    completed: false,
    claimed: false,
    category: 'daily'
  },
  {
    id: 'upload-note',
    title: 'Knowledge Contributor',
    description: 'Upload 1 PDF note to the library.',
    xpReward: 50,
    progress: 0,
    maxProgress: 1,
    completed: false,
    claimed: false,
    category: 'daily'
  }
];

export const getDailyQuests = (uid: string): Quest[] => {
  if (!uid) return [];
  
  const questsKey = `noteweb-quests-${uid}`;
  const resetKey = `noteweb-quests-reset-${uid}`;
  
  const todayStr = getTodayDateString();
  const lastReset = localStorage.getItem(resetKey);
  const cachedQuestsStr = localStorage.getItem(questsKey);
  
  // If calendar day changed, reset and generate new quests automatically
  if (lastReset !== todayStr || !cachedQuestsStr) {
    const defaultQuests = generateDefaultQuests();
    localStorage.setItem(questsKey, JSON.stringify(defaultQuests));
    localStorage.setItem(resetKey, todayStr);
    return defaultQuests;
  }
  
  try {
    return JSON.parse(cachedQuestsStr);
  } catch {
    const defaultQuests = generateDefaultQuests();
    localStorage.setItem(questsKey, JSON.stringify(defaultQuests));
    localStorage.setItem(resetKey, todayStr);
    return defaultQuests;
  }
};

export const saveQuests = (uid: string, quests: Quest[]): void => {
  if (!uid) return;
  localStorage.setItem(`noteweb-quests-${uid}`, JSON.stringify(quests));
};

export const incrementQuestProgress = (questId: string, amount: number): void => {
  const uid = getActiveUserUid();
  if (!uid) return;
  
  const quests = getDailyQuests(uid);
  const quest = quests.find(q => q.id === questId);
  
  if (quest && !quest.completed && !quest.claimed) {
    quest.progress = Math.min(quest.maxProgress, quest.progress + amount);
    if (quest.progress === quest.maxProgress) {
      quest.completed = true;
      // Trigger instant success banner or alert inside the app
      window.dispatchEvent(new CustomEvent('noteweb-quest-completed', { detail: { quest } }));
    }
    
    saveQuests(uid, quests);
    window.dispatchEvent(new CustomEvent('noteweb-quests-updated', { detail: { quests } }));
  }
};

export const claimQuestReward = async (
  questId: string, 
  updatePointsFn: (pts: number) => Promise<void>
): Promise<void> => {
  const uid = getActiveUserUid();
  if (!uid) throw new Error('User not logged in');
  
  const quests = getDailyQuests(uid);
  const quest = quests.find(q => q.id === questId);
  
  if (!quest) throw new Error('Quest not found');
  if (!quest.completed) throw new Error('Quest is not completed yet');
  if (quest.claimed) throw new Error('Reward has already been claimed');
  
  // Award XP Points to remote DB/Context
  await updatePointsFn(quest.xpReward);
  
  // Mark as claimed locally
  quest.claimed = true;
  saveQuests(uid, quests);
  
  window.dispatchEvent(new CustomEvent('noteweb-quests-updated', { detail: { quests } }));
};

export const restartQuests = (uid: string): Quest[] => {
  if (!uid) return [];
  
  const defaultQuests = generateDefaultQuests();
  localStorage.setItem(`noteweb-quests-${uid}`, JSON.stringify(defaultQuests));
  localStorage.setItem(`noteweb-quests-reset-${uid}`, getTodayDateString());
  
  window.dispatchEvent(new CustomEvent('noteweb-quests-updated', { detail: { quests: defaultQuests } }));
  return defaultQuests;
};
