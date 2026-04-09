import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";
import { auth, googleProvider } from "../lib/firebase";
import { isAdminEmail } from "../lib/utils";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initGoogle = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          console.log(
            "WEB CLIENT ID EXISTS?",
            !!import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
          );
          console.log(
            "WEB CLIENT ID:",
            import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
          );

          await GoogleSignIn.initialize({
            clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,
          });

          console.log("GoogleSignIn initialized");
        }
      } catch (error) {
        console.error("GoogleSignIn init failed:", error);
      }
    };

    initGoogle();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        console.log("onAuthStateChanged fired", currentUser);

        if (!currentUser) {
          console.log("No current user, clearing auth state");
          setUser(null);
          setRole("user");
          setLoading(false);
          return;
        }

        const admin = isAdminEmail(currentUser.email);

        // render app immediately
        setUser(currentUser);
        setRole(admin ? "admin" : "user");
        setLoading(false);

        // TEMPORARILY skip Firestore profile sync
        console.log("AuthContext skipping Firestore profile sync temporarily");
      } catch (error) {
        console.error("AuthContext error FULL:", error);
        setUser(currentUser || null);
        setRole("user");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function signInWithGoogle() {
    try {
      console.log("signInWithGoogle START");

      if (Capacitor.isNativePlatform()) {
        console.log("Native platform detected");

        const result = await GoogleSignIn.signIn();
        console.log("Native Google result:", result);

        const idToken = result?.authentication?.idToken || result?.idToken;
        console.log("Native Google idToken exists?", !!idToken);

        if (!idToken) {
          throw new Error("No Google ID token returned from plugin.");
        }

        const credential = GoogleAuthProvider.credential(idToken);
        console.log("Firebase credential created");

        await signInWithCredential(auth, credential);
        console.log("Firebase native sign-in success");
        return;
      }

      console.log("Using web popup sign-in");
      await signInWithPopup(auth, googleProvider);
      console.log("Firebase web popup success");
    } catch (error) {
      console.error("Google sign-in failed:", error);
      alert(error?.message || "Google sign-in failed");
    }
  }

  async function logOut() {
    try {
      console.log("logOut START");

      if (Capacitor.isNativePlatform()) {
        try {
          await GoogleSignIn.signOut();
          console.log("Native Google signOut success");
        } catch (error) {
          console.warn("Native Google signOut warning:", error);
        }
      }

      await signOut(auth);
      console.log("Firebase signOut success");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const value = useMemo(
    () => ({ user, role, loading, signInWithGoogle, logOut }),
    [user, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}