import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { isAdminEmail } from './utils';

export async function upsertUserProfile(user) {
  if (!user?.uid) {
    throw new Error('Missing user uid for profile sync.');
  }

  const userRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userRef);

  const admin = isAdminEmail(user.email);
  const role = admin ? 'admin' : 'user';

  const baseData = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    role,
    isAdmin: admin,
    updatedAt: serverTimestamp(),
  };

  if (!existing.exists()) {
    await setDoc(userRef, {
      ...baseData,
      createdAt: serverTimestamp(),
    });
    return;
  }

  const existingData = existing.data();

  await setDoc(
    userRef,
    {
      ...baseData,
      role: existingData.role || role,
      isAdmin:
        typeof existingData.isAdmin === 'boolean'
          ? existingData.isAdmin
          : admin,
      createdAt: existingData.createdAt || serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getUserRole(uid) {
  if (!uid) return 'user';

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return 'user';

  const data = snap.data();
  if (data?.isAdmin === true) return 'admin';
  return data?.role || 'user';
}

export async function createEntry(entry) {
  if (!entry?.userId) {
    throw new Error('Entry is missing userId.');
  }

  const payload = {
    userId: entry.userId,
    userEmail: entry.userEmail || '',
    userName: entry.userName || '',
    serviceType: entry.serviceType || '',
    date: entry.date || '',
    startTime: entry.startTime || '',
    endTime: entry.endTime || '',
    note: entry.note || '',
    student: entry.student || '',
    monthKey: entry.monthKey || '',
    hours: Number(entry.hours) || 0,
    hourlyRate: Number(entry.hourlyRate) || 0,
    totalPay: Number(entry.totalPay) || 0,
    internalRate: Number(entry.internalRate) || 0,
    internalTotal: Number(entry.internalTotal) || 0,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'entries'), payload);
  return { id: docRef.id };
}

export async function fetchEntryById(entryId) {
  if (!entryId) return null;

  const snap = await getDoc(doc(db, 'entries', entryId));

  if (!snap.exists()) {
    return null;
  }

  return { id: snap.id, ...snap.data() };
}

export async function fetchEntriesByUser(uid) {
  if (!uid) return [];

  const q = query(collection(db, 'entries'), where('userId', '==', uid));
  const snapshot = await getDocs(q);

  const results = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  results.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';

    if (dateA !== dateB) {
      return dateA < dateB ? 1 : -1;
    }

    const createdA =
      a.createdAt?.seconds != null
        ? a.createdAt.seconds * 1000 +
          Math.floor((a.createdAt.nanoseconds || 0) / 1e6)
        : 0;

    const createdB =
      b.createdAt?.seconds != null
        ? b.createdAt.seconds * 1000 +
          Math.floor((b.createdAt.nanoseconds || 0) / 1e6)
        : 0;

    return createdB - createdA;
  });

  return results;
}

export async function fetchAllEntries() {
  const q = query(collection(db, 'entries'));
  const snapshot = await getDocs(q);

  const results = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  results.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';

    if (dateA !== dateB) {
      return dateA < dateB ? 1 : -1;
    }

    const createdA =
      a.createdAt?.seconds != null
        ? a.createdAt.seconds * 1000 +
          Math.floor((a.createdAt.nanoseconds || 0) / 1e6)
        : 0;

    const createdB =
      b.createdAt?.seconds != null
        ? b.createdAt.seconds * 1000 +
          Math.floor((b.createdAt.nanoseconds || 0) / 1e6)
        : 0;

    return createdB - createdA;
  });

  return results;
}

export async function updateEntry(entryId, updates) {
  if (!entryId) {
    throw new Error('Missing entryId for update.');
  }

  const entryRef = doc(db, 'entries', entryId);
  await updateDoc(entryRef, updates);
}

export async function deleteEntry(entryId) {
  if (!entryId) {
    throw new Error('Missing entryId for delete.');
  }

  const entryRef = doc(db, 'entries', entryId);
  await deleteDoc(entryRef);
}