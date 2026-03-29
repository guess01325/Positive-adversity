import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { isAdminEmail } from './utils';

export async function upsertUserProfile(user) {
  const userRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userRef);

  const admin = isAdminEmail(user.email);
  const role = admin ? 'admin' : 'user';

  if (!existing.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await setDoc(
    userRef,
    {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      role: existing.data().role || role,
      updatedAt: serverTimestamp(),
      createdAt: existing.data().createdAt || serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getUserRole(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return 'user';
  return snap.data().role || 'user';
}

export async function createEntry(entry) {
  return addDoc(collection(db, 'entries'), {
    ...entry,
    createdAt: serverTimestamp(),
  });
}

export async function fetchEntriesByUser(uid) {
  const q = query(
    collection(db, 'entries'),
    where('userId', '==', uid),
    orderBy('date', 'desc'),
    orderBy('createdAt', 'desc'),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function fetchAllEntries() {
  const q = query(
    collection(db, 'entries'),
    orderBy('date', 'desc'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}