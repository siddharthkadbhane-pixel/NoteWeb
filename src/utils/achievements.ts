// NoteWeb Achievements & Milestones Engine

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconName: 'Trophy' | 'Shield' | 'Zap' | 'BookOpen' | 'MessageSquare';
  color: string;
  unlocked: boolean;
  progress: number; // 0 to 100
  reqText: string;
}

export const getBadges = (
  points: number,
  uploadsCount: number,
  _bookmarksCount: number,
  chatsCount: number,
  readsCount: number
): Badge[] => {
  return [
    {
      id: 'pioneer',
      name: 'Note Pioneer',
      description: 'Upload your first study document and get it approved.',
      iconName: 'Shield',
      color: 'from-amber-400 via-orange-500 to-rose-600',
      unlocked: uploadsCount >= 1,
      progress: Math.min(100, (uploadsCount / 1) * 100),
      reqText: '1 Upload'
    },
    {
      id: 'sovereign',
      name: 'XP Sovereign',
      description: 'Reach a total cumulative XP of 1000+ points.',
      iconName: 'Trophy',
      color: 'from-yellow-400 via-amber-500 to-yellow-600',
      unlocked: points >= 1000,
      progress: Math.min(100, (points / 1000) * 100),
      reqText: '1000 XP'
    },
    {
      id: 'lounge_vip',
      name: 'Lounge VIP',
      description: 'Send at least 50 chats in the Campus Lounge.',
      iconName: 'MessageSquare',
      color: 'from-purple-500 via-fuchsia-500 to-pink-500',
      unlocked: chatsCount >= 50,
      progress: Math.min(100, (chatsCount / 50) * 100),
      reqText: '50 chats'
    },
    {
      id: 'scholar',
      name: 'Scholar',
      description: 'Open 10+ study notes in the PDF viewer.',
      iconName: 'BookOpen',
      color: 'from-cyan-400 via-blue-500 to-indigo-600',
      unlocked: readsCount >= 10,
      progress: Math.min(100, (readsCount / 10) * 100),
      reqText: '10 reads'
    }
  ];
};
