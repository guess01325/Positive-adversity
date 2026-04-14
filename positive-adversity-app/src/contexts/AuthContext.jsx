import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { auth, googleProvider } from '../lib/firebase';
import { isAdminEmail } from '../lib/utils';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initNativeGoogle() {
      try {
        if (Capacitor.isNativePlatform()) {
          await GoogleSignIn.initialize({
            clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,
          });
        }
      } catch (error) {
        console.error('Google sign-in initialization failed:', error);
      }
    }

    initNativeGoogle();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setRole('user');
        setLoading(false);
        return;
      }

      const adminByEmail = isAdminEmail(currentUser.email);
      setUser(currentUser);
      setRole(adminByEmail ? 'admin' : 'user');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function signInWithGoogle() {
    try {
      setLoading(true);

      if (Capacitor.isNativePlatform()) {
        const result = await GoogleSignIn.signIn();
        const idToken = result.authentication?.idToken || result.idToken;

        if (!idToken) {
          throw new Error('Missing Google ID token from native sign-in.');
        }

        const credential = GoogleAuthProvider.credential(idToken);
        const firebaseResult = await signInWithCredential(auth, credential);
        return firebaseResult.user;
      }

      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await signOut(auth);
  }

  const value = useMemo(
    () => ({
      user,
      role,
      isAdmin: role === 'admin',
      loading,
      signInWithGoogle,
      logout,
    }),
    [user, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
