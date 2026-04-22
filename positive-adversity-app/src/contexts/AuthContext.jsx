import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";
import { AppleSignIn, SignInScope } from "@capawesome/capacitor-apple-sign-in";

import { auth } from "../lib/firebase";
import { getUserRole, upsertUserProfile } from "../lib/firestore";
import { isAdminEmail } from "../lib/utils";

const AuthContext = createContext(null);

const GOOGLE_WEB_CLIENT_ID =
  "224541354644-41o3c3730drbbagg79sinln18kbrnnnb.apps.googleusercontent.com";

const APPLE_SERVICE_ID = "com.positiveadversity.mobile.auth";

const ALLOWED_EMAILS = [
  "client@email.com",
  "admin@email.com",
  "oguess01325@yahoo.com",
  "guess01325@gmail.com"
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function applyUserState(incomingUser) {
      try {
        if (!incomingUser) {
          if (!isMounted) return;
          setUser(null);
          setRole("user");
          setLoading(false);
          return;
        }

        const normalizedUser = normalizeUser(incomingUser);
        const userEmail = (normalizedUser.email || "").trim().toLowerCase();

        if (!ALLOWED_EMAILS.includes(userEmail)) {
          console.warn("Unauthorized email:", normalizedUser.email);

          await signOut(auth);

          if (!isMounted) return;
          setUser(null);
          setRole("user");
          setLoading(false);
          return;
        }

        const admin = isAdminEmail(userEmail);

        if (!isMounted) return;
        setUser(normalizedUser);
        setRole(admin ? "admin" : "user");
        setLoading(false);

        try {
          await upsertUserProfile(normalizedUser, admin);
          const storedRole = await getUserRole(normalizedUser.uid);

          if (!isMounted) return;
          setRole(admin ? "admin" : storedRole || "user");
        } catch (profileError) {
          console.error("Profile bootstrap error:", profileError);
        }
      } catch (error) {
        console.error("applyUserState error:", error);

        if (!isMounted) return;
        setUser(incomingUser ? normalizeUser(incomingUser) : null);
        setRole("user");
        setLoading(false);
      }
    }

    async function initProviders() {
      try {
        const platform = Capacitor.getPlatform();
        const isNative = Capacitor.isNativePlatform();

        if (isNative && (platform === "ios" || platform === "android")) {
          try {
            await GoogleSignIn.initialize({
              clientId: GOOGLE_WEB_CLIENT_ID,
            });
          } catch (error) {
            console.error("Google Sign-In initialize error:", error);
          }
        }

        if (platform === "ios") {
          try {
            await AppleSignIn.initialize({
              clientId: APPLE_SERVICE_ID,
            });
          } catch (error) {
            console.error("Apple Sign-In initialize error:", error);
          }
        }
      } catch (error) {
        console.error("Provider initialization error:", error);
      }
    }

    initProviders();

    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        clearTimeout(fallbackTimer);
        await applyUserState(currentUser);
      },
      (error) => {
        clearTimeout(fallbackTimer);
        console.error("onAuthStateChanged listener error:", error);

        if (!isMounted) return;
        setUser(null);
        setRole("user");
        setLoading(false);
      },
    );

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    try {
      const platform = Capacitor.getPlatform();

      if (platform === "ios" || platform === "android") {
        const result = await GoogleSignIn.signIn();

        const idToken =
          result?.idToken ||
          result?.authentication?.idToken ||
          result?.authentication?.accessToken ||
          null;

        const accessToken =
          result?.accessToken || result?.authentication?.accessToken || null;

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
    const platform = Capacitor.getPlatform();

    if (platform !== "ios") {
      throw new Error("Apple sign-in is only available on iPhone in this app.");
    }

    try {
      const provider = new OAuthProvider("apple.com");
      const rawNonce = generateNonce();
      const hashedNonce = await sha256(rawNonce);

      await AppleSignIn.initialize({
        clientId: APPLE_SERVICE_ID,
      });

      const result = await AppleSignIn.signIn({
        scopes: [SignInScope.Email, SignInScope.FullName],
        nonce: hashedNonce,
      });

      const idToken = result?.idToken || result?.identityToken || null;

      if (!idToken) {
        throw new Error("Missing Apple ID token");
      }

      const credential = provider.credential({
        idToken,
        rawNonce,
      });

      const authResult = await signInWithCredential(auth, credential);

      if (authResult?.user) {
        const normalizedUser = normalizeUser(authResult.user);
        setUser(normalizedUser);

        const admin = isAdminEmail(normalizedUser.email);
        setRole(admin ? "admin" : "user");

        try {
          await upsertUserProfile(normalizedUser, admin);
          const storedRole = await getUserRole(normalizedUser.uid);
          setRole(admin ? "admin" : storedRole || "user");
        } catch (profileError) {
          console.error(
            "Profile bootstrap error after Apple sign-in:",
            profileError,
          );
        }
      }

      return authResult.user;
    } catch (error) {
      console.error("APPLE SIGN-IN ERROR:", error);
      throw error;
    }
  }

  async function signUpWithEmail(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    const result = await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      password,
    );

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

  async function resetPassword(email) {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      throw new Error("Please enter your email first.");
    }

    await sendPasswordResetEmail(auth, cleanEmail);
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
    setUser(null);
    setRole("user");
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
      resetPassword,
      logout,
    }),
    [user, role, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function normalizeUser(user) {
  return {
    uid: user?.uid || user?.userId || user?.user || "",
    email: user?.email || "",
    displayName: user?.displayName || user?.name || user?.email || "",
    photoURL: user?.photoURL || user?.imageUrl || null,
  };
}

function generateNonce(length = 32) {
  const charset =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  let nonce = "";
  for (let i = 0; i < randomValues.length; i += 1) {
    nonce += charset[randomValues[i] % charset.length];
  }
  return nonce;
}

async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
