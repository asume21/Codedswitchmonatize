import { create } from "zustand";
import { useEffect } from "react";

interface User {
  id: string;
  email: string;
  username: string;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      set({ user: null, isAuthenticated: false });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  },
  
  checkAuth: async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        set({ user: data.user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

export function useAuth() {
  const store = useAuthStore();
  
  useEffect(() => {
    store.checkAuth();
  }, []);
  
  return store;
}
