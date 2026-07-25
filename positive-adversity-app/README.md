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
  "userId": "abc123",
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

### `orders`
```json
{
  "customer": {
    "fullName": "Otis Owens",
    "email": "owens@example.com",
    "phone": "800-303-0127"
  },
  "shippingAddress": {
    "streetAddress": "303 Main St",
    "apartment": "303",
    "city": "Worcester",
    "state": "MA",
    "zip": "01604"
  },
  "payment": {
    "option": "stripe",
    "referenceId": "ABC123"
  },
  "items": [],
  "total": 115,
  "status": "pending",
  "paymentConfirmed": false
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
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }

    match /orders/{orderId} {
      allow create: if request.resource.data.customer.email is string
        && request.resource.data.customer.fullName is string
        && request.resource.data.items is list
        && request.resource.data.total is number
        && request.resource.data.status == 'pending'
        && request.resource.data.paymentConfirmed == false;
      allow read, update, delete: if request.auth != null
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
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
