import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Business } from '../types';

interface AuthState {
  user: User | null;
  business: Business | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (user: User, business: Business) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      business: null,
      isAuthenticated: false,
      
      login: (user, business) => set({ user, business, isAuthenticated: true }),
      logout: () => set({ user: null, business: null, isAuthenticated: false }),
    }),
    {
      name: 'tradeflow-auth-storage', // The name of the key in browser Local Storage
    }
  )
);