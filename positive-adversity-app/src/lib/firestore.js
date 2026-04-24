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
  writeBatch,
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

  const serviceType = entry.serviceType || '';
  const baseTotalPay = Number(entry.totalPay) || 0;
  const baseInternalTotal = Number(entry.internalTotal) || 0;

  const payload = {
    userId: entry.userId,
    userEmail: entry.userEmail || '',
    userName: entry.userName || '',
    serviceType,
    date: entry.date || '',
    startTime: entry.startTime || '',
    endTime: entry.endTime || '',
    note: entry.note || '',
    student: entry.student || '',
    monthKey: entry.monthKey || '',
    hours: Number(entry.hours) || 0,
    hourlyRate: Number(entry.hourlyRate) || 0,
    totalPay: baseTotalPay,
    internalRate: Number(entry.internalRate) || 0,
    internalTotal: baseInternalTotal,
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

export async function addDCFAdjustment({ monthKey, student, createdBy }) {
  if (!monthKey || !student?.trim()) {
    throw new Error('Missing month or student for DCF adjustment.');
  }

  const payload = {
    type: 'dcf_supervision',
    serviceType: 'DCF',
    student: student.trim(),
    monthKey,
    amount: 11.25,
    createdBy: createdBy || '',
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'invoiceAdjustments'), payload);
  return { id: docRef.id };
}

export async function fetchAdjustments() {
  const snapshot = await getDocs(collection(db, 'invoiceAdjustments'));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function fetchDCFAdjustmentsByMonth(monthKey) {
  if (!monthKey || monthKey === 'all') return [];

  const q = query(
    collection(db, 'invoiceAdjustments'),
    where('type', '==', 'dcf_supervision'),
    where('serviceType', '==', 'DCF'),
    where('monthKey', '==', monthKey)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function findDCFAdjustment(monthKey, student) {
  if (!monthKey || !student?.trim()) return null;

  const normalizedStudent = student.trim().toLowerCase();

  const q = query(
    collection(db, 'invoiceAdjustments'),
    where('type', '==', 'dcf_supervision'),
    where('serviceType', '==', 'DCF'),
    where('monthKey', '==', monthKey)
  );

  const snapshot = await getDocs(q);

  const match = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .find(
      (item) =>
        String(item.student || '').trim().toLowerCase() === normalizedStudent
    );

  return match || null;
}

export async function deleteAdjustment(adjustmentId) {
  if (!adjustmentId) {
    throw new Error('Missing adjustment id for delete.');
  }

  const adjustmentRef = doc(db, 'invoiceAdjustments', adjustmentId);
  await deleteDoc(adjustmentRef);
}

export async function anonymizeEntriesForDeletedUser(uid) {
  if (!uid) {
    throw new Error('Missing uid for entry anonymization.');
  }

  const q = query(collection(db, 'entries'), where('userId', '==', uid));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return 0;
  }

  const docs = snapshot.docs;
  const batchSize = 400;
  let updatedCount = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const batch = writeBatch(db);

    chunk.forEach((entryDoc) => {
      batch.update(entryDoc.ref, {
        userEmail: '',
        userName: 'Deleted User',
        accountDeleted: true,
        deletedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    updatedCount += chunk.length;
  }

  return updatedCount;
}

export async function deleteUserProfile(uid) {
  if (!uid) {
    throw new Error('Missing uid for profile delete.');
  }

  await deleteDoc(doc(db, 'users', uid));
}


export async function updateUserDisplayName(uid, displayName) {
  if (!uid) throw new Error("Missing user id");

  const cleanName = displayName.trim();

  if (!cleanName) {
    throw new Error("Display name cannot be empty");
  }

  await updateDoc(doc(db, "users", uid), {
    displayName: cleanName,
    updatedAt: serverTimestamp(),
  });

  return cleanName;
}