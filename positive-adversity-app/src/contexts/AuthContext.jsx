import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";

import { auth } from "../lib/firebase";
import { getUserRole, upsertUserProfile } from "../lib/firestore";
import { isAdminEmail } from "../lib/utils";

const AuthContext = createContext(null);

const GOOGLE_WEB_CLIENT_ID =
  "224541354644-41o3c3730drbbagg79sinln18kbrnnnb.apps.googleusercontent.com";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initGoogle = async () => {
      try {
        if (!Capacitor.isNativePlatform()) return;

        const platform = Capacitor.getPlatform();
        if (platform !== "ios" && platform !== "android") return;

        await GoogleSignIn.initialize({
          clientId: GOOGLE_WEB_CLIENT_ID,
        });
      } catch (error) {
        console.error("Google Sign-In initialize error:", error);
      }
    };

    initGoogle();

    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        clearTimeout(fallbackTimer);

        try {
          if (!currentUser) {
            if (!isMounted) return;
            setUser(null);
            setRole("user");
            setLoading(false);
            return;
          }

          const admin = isAdminEmail(currentUser.email);

          if (!isMounted) return;
          setUser(currentUser);
          setRole(admin ? "admin" : "user");
          setLoading(false);

          try {
            await upsertUserProfile(currentUser, admin);
            const storedRole = await getUserRole(currentUser.uid);

            if (!isMounted) return;
            setRole(admin ? "admin" : storedRole || "user");
          } catch (profileError) {
            console.error("Profile bootstrap error:", profileError);
          }
        } catch (error) {
          console.error("AuthContext error:", error);

          if (!isMounted) return;
          setUser(currentUser || null);
          setRole("user");
          setLoading(false);
        }
      },
      (error) => {
        clearTimeout(fallbackTimer);
        console.error("onAuthStateChanged listener error:", error);

        if (!isMounted) return;
        setUser(null);
        setRole("user");
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await GoogleSignIn.signIn();

        const idToken =
          result?.idToken ||
          result?.authentication?.idToken ||
          result?.authentication?.accessToken ||
          null;

        const accessToken =
          result?.accessToken ||
          result?.authentication?.accessToken ||
          null;

        if (!idToken && !accessToken) {
          throw new Error("Missing Google auth token.");
        }

        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const authResult = await signInWithCredential(auth, credential);
        return authResult.user;
      }

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const authResult = await signInWithPopup(auth, provider);
      return authResult.user;
    } catch (error) {
      console.error("Google sign-in failed:", error);
      throw error;
    }
  }

  async function signInWithApple() {
    throw new Error(
      "Apple Sign-In UI can be added now, but native Apple sign-in still needs Apple Developer account setup before it can be wired."
    );
  }

  async function signUpWithEmail(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);

    const admin = isAdminEmail(cleanEmail);

    try {
      await upsertUserProfile(result.user, admin);
    } catch (error) {
      console.error("Sign up profile write error:", error);
    }

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
        console.error("Native Google sign-out error:", error);
      }
    }

    await signOut(auth);
  }

  const value = useMemo(
    () => ({
      user,
      role,
      isAdmin: role === "admin",
      loading,
      signInWithGoogle,
      signInWithApple,
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
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}