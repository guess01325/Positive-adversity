import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Smoke test timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export default function FirestoreSmokeTest() {
  async function runTest() {
    try {
      console.log('SMOKE TEST START');

      const ref = await withTimeout(
        addDoc(collection(db, 'entries'), {
          userId: 'smoke-test',
          userEmail: 'smoke@test.com',
          userName: 'Smoke Test',
          serviceType: 'DCF',
          date: '2026-04-10',
          startTime: '09:00',
          endTime: '10:00',
          note: 'smoke test',
          student: 'test',
          monthKey: '2026-04',
          hours: 1,
          hourlyRate: 25,
          totalPay: 25,
          internalRate: 45,
          internalTotal: 45,
          createdAt: serverTimestamp(),
        }),
        10000
      );

      console.log('SMOKE TEST SUCCESS', ref.id);
      alert(`Smoke test success: ${ref.id}`);
    } catch (error) {
      console.error('SMOKE TEST ERROR', error);
      alert(error?.message || 'Smoke test failed');
    }
  }

  return (
    <div className="rounded-2xl border-4 border-red-500 bg-yellow-100 p-4 shadow">
      <p className="mb-3 text-lg font-bold text-red-700">
        FIRESTORE SMOKE TEST
      </p>

      <button
        type="button"
        onClick={runTest}
        className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white"
      >
        Run Firestore Smoke Test
      </button>
    </div>
  );
}