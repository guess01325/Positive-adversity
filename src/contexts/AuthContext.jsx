import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { getUserRole, upsertUserProfile } from '../lib/firestore';
import { isAdminEmail } from '../lib/utils';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setRole('user');
        setLoading(false);
        return;
      }

      const admin = isAdminEmail(currentUser.email);
      await upsertUserProfile(currentUser, admin);
      const storedRole = await getUserRole(currentUser.uid);
      setUser(currentUser);
      setRole(admin ? 'admin' : storedRole);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function logOut() {
    await signOut(auth);
  }

  const value = useMemo(
    () => ({ user, role, loading, signInWithGoogle, logOut }),
    [user, role, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
