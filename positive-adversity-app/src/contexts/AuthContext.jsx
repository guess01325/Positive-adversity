import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';

import { auth, googleProvider, GOOGLE_WEB_CLIENT_ID } from '../lib/firebase';
import { getUserRole, upsertUserProfile } from '../lib/firestore';
import { isAdminEmail } from '../lib/utils';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initGoogle = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          console.log('Init GOOGLE_WEB_CLIENT_ID:', GOOGLE_WEB_CLIENT_ID);

          await GoogleSignIn.initialize({
            clientId: GOOGLE_WEB_CLIENT_ID,
          });
        }
      } catch (error) {
        console.error('Google Sign-In initialize error:', error);
      }
    };

    initGoogle();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
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
        setRole(admin ? 'admin' : storedRole || 'user');
      } catch (error) {
        console.error('AuthContext error:', error);
        setUser(currentUser || null);
        setRole('user');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function signInWithGoogle() {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await GoogleSignIn.signIn();

        console.log('Native Google sign-in result:', result);
        console.log('Native Google sign-in JSON:', JSON.stringify(result, null, 2));
        console.log('GOOGLE_WEB_CLIENT_ID:', GOOGLE_WEB_CLIENT_ID);

        const idToken =
          result?.authentication?.idToken ||
          result?.idToken ||
          null;

        if (!idToken) {
          throw new Error('Missing Google ID token.');
        }

        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        return;
      }

      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  }

  async function signUpWithEmail(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);

    const admin = isAdminEmail(cleanEmail);
    await upsertUserProfile(result.user, admin);

    return result.user;
  }

  async function signInWithEmail(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return result.user;
  }

  async function logout() {
    if (Capacitor.isNativePlatform()) {
      try {
        await GoogleSignIn.signOut();
      } catch (error) {
        console.error('Native Google sign-out error:', error);
      }
    }

    await signOut(auth);
  }

  const value = useMemo(
    () => ({
      user,
      role,
      isAdmin: role === 'admin',
      loading,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
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