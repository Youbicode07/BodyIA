import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { STORAGE_KEYS, loadJson, removeKey, saveJson } from '../services/storage';

/** Comment le compte a été créé. Sert à afficher la bonne mention et la bonne icône. */
export type AuthProvider = 'google' | 'apple' | 'email';

export type UserProfile = {
  id: string;
  name: string;
  email?: string;
  /** Photo de profil renvoyée par Google, le cas échéant. */
  photoUrl?: string;
  provider: AuthProvider;
  createdAt: number;
};

type UserContextType = {
  user: UserProfile | null;
  /** false tant que la sauvegarde locale n'a pas été relue : évite d'afficher
   * « non connecté » une fraction de seconde à chaque démarrage. */
  isReady: boolean;
  signIn: (profile: Omit<UserProfile, 'id' | 'createdAt'>) => Promise<UserProfile>;
  updateUser: (patch: Partial<Omit<UserProfile, 'id' | 'createdAt'>>) => Promise<void>;
  signOut: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

const newId = () => `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isReady, setReady] = useState(false);

  // Restauration du compte au lancement.
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await loadJson<UserProfile>(STORAGE_KEYS.user);
      if (!alive) return;
      if (saved?.id && saved?.name) setUser(saved);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const signIn = async (profile: Omit<UserProfile, 'id' | 'createdAt'>) => {
    // Une reconnexion avec le même fournisseur conserve l'identifiant et la
    // date de création : ce n'est pas un nouveau compte.
    const next: UserProfile = {
      ...profile,
      id: user?.provider === profile.provider ? user.id : newId(),
      createdAt: user?.provider === profile.provider ? user.createdAt : Date.now(),
    };
    setUser(next);
    await saveJson(STORAGE_KEYS.user, next);
    return next;
  };

  const updateUser = async (patch: Partial<Omit<UserProfile, 'id' | 'createdAt'>>) => {
    if (!user) return;
    const next = { ...user, ...patch };
    setUser(next);
    await saveJson(STORAGE_KEYS.user, next);
  };

  const signOut = async () => {
    setUser(null);
    await removeKey(STORAGE_KEYS.user);
  };

  return (
    <UserContext.Provider value={{ user, isReady, signIn, updateUser, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser doit être utilisé dans UserProvider');
  return ctx;
}
