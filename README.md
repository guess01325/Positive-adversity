# Positive Adversity App

A React + Vite + Tailwind + Firebase MVP for:

- Google login
- per-user entry tracking
- DCF / Mashantucket rate selection
- note logging
- automatic hours and pay calculations
- monthly grouping
- admin overview for all users

## 1) Install

```bash
npm install
```

## 2) Create your Firebase project

Enable:
- Authentication -> Google provider
- Firestore Database

Copy `.env.example` to `.env` and fill in your Firebase config.

## 3) Start the app

```bash
npm run dev
```

## 4) Make Allan an admin

Add Allan's login email to `VITE_ADMIN_EMAILS` in `.env`.
You can include multiple emails separated by commas.

## Suggested Firestore collections

### `users`
```json
{
  "uid": "abc123",
  "email": "allan@example.com",
  "displayName": "Allan Chaney",
  "role": "admin"
}
```

### `entries`
```json
{
  "uid": "abc123",
  "userEmail": "allan@example.com",
  "userName": "Allan Chaney",
  "serviceType": "DCF",
  "date": "2026-03-27",
  "startTime": "09:00",
  "endTime": "17:00",
  "hours": 8,
  "hourlyRate": 50,
  "totalPay": 400,
  "monthKey": "2026-03",
  "note": "Worked on reports"
}
```

## Suggested Firestore rules

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /entries/{entryId} {
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow read: if request.auth != null && (
        resource.data.uid == request.auth.uid ||
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }
  }
}
```

## Remaining steps you still need to do

- Replace placeholder rates in `src/lib/constants.js` with real rates.
- Confirm whether the client wants editable rates later.
- Create the Firebase project and paste its config into `.env`.
- Test the admin login with Allan's Google account.
- Add polish like edit/delete entries if needed.
