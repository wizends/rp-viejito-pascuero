import { create } from 'zustand';
import type { User } from '@/lib/types';

interface SessionState {
  user: User | null;
  checked: boolean;
  setUser: (u: User | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  checked: false,
  setUser: (user) => set({ user, checked: true }),
}));
