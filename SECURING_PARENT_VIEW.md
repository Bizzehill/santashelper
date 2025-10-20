# Securing the Parent View

This document explains how the parent-only experience is protected end-to-end: roles, PIN, session gating, rules, and tests.

## Architecture (ASCII)

```
+----------------+          +-----------------+          +--------------------+
|    Browser     |  HTTPS   |  Next.js (App)  |  HTTPS   | Firebase Functions |
|  (React/Next)  +--------->+  API + Pages    +--------->+  verify/set PIN     |
+--------+-------+          +---------+-------+          +---------+----------+
         |                            |                             |
         | Firestore (SDK)            | Callable (SDK)              | Admin SDK
         v                            v                             v
+------------------------+    +---------------------+       +-------------------+
|   Cloud Firestore      |    | families/{id}/audit |       | families/{id}/... |
| users, families, etc.  |    |  (PII-safe events)  |       | settings/private  |
+------------------------+    +---------------------+       +-------------------+
```

## Data model (relevant paths)

- users/{uid}
  - role: 'parent' | 'child' | 'admin' (client cannot write role)
- families/{familyId}/settings
  - parentPinHash: string (bcrypt hash)
  - parentSessionTTLMinutes: number
  - updatedAt, updatedBy
- families/{familyId}/private/pinGuard
  - attemptCount: number
  - lockedUntil: Timestamp | null
  - lastAttemptAt, lastSuccessAt
- families/{familyId}/audit/{docId}
  - event: string (e.g., parentGate.verify.success)
  - meta: object (PII-safe only)
  - createdAt: serverTimestamp
  - expireAt: Timestamp (30d TTL)
  - source: 'client' | 'callable'

## Auth flow (role + re-auth)

1. Sign-in (email/password) via Firebase Auth.
2. Admin may promote a user: callable `setParentRole` sets custom claim role='parent' and mirrors to users/{uid}.
3. Sensitive actions (e.g., set PIN, affiliate keys) use a re-auth flow: UI prompts if action returns requires-recent-login and retries on success.

## Gate flow (PIN + session)

1. User navigates to /parent.
2. Route guard checks: signed in, claims.role === 'parent', and a short-lived local session is valid.
3. If session missing/expired, user sees the Parent Gate:
   - Long-press “Continue” → keypad opens (audit: parentGate.open).
   - Enter 4–6 digit PIN; callable `verifyParentPin` compares bcrypt hash in Firestore settings.
   - Transactionally rate-limited with attempts and lockout; audit logs for success/failure/lockout.
   - On success, client stores an expiry timestamp in localStorage and proceeds to /parent.

## Rules summary (FIRESTORE_RULES.txt)

- families/{familyId}/settings: read/write only if role=='parent'.
- families/{familyId}/parentData/**: read/write only if role=='parent'.
- families/{familyId}/audit/{docId}: parent write (and optionally read) allowed; PII-safe payloads only.
- users/{userId}:
  - read: self
  - write: parent role AND cannot write `role` field
  - update (admin mirror): allowed when request.auth.token.admin == true

## Common pitfalls

- Storing PIN in plaintext: always bcrypt hash (never log raw values).
- Revealing security details in UI: avoid showing remaining attempts, exact lockout windows, or error specifics.
- Forgetting TTL on audit events: set `expireAt` and configure Firestore TTL to auto-purge.
- Client role tampering: ensure rules reject writes when `role` is in the payload.
- Cross-tab session drift: consider listening to `storage` events if you need immediate cross-tab revocation.
- Missing re-auth: protect PIN changes and keys with a requires-recent-login flow.

## Testing locally (Emulators)

1. Start emulators
   - Firestore + Auth + Functions.
2. Seed data
   - Create a test user; set `role='parent'` via callable or admin emulator.
   - Write families/{uid}/settings with a bcrypt parentPinHash (use a small script).
3. Exercise flows
   - Visit /parent-gate, enter wrong PIN repeatedly → expect INVALID_PIN then LOCKED; audit docs should appear.
   - Enter correct PIN → expect success and session start.
   - Attempt reads/writes to settings/parentData as a non-parent → expect DENY.
4. TTL simulation
   - Confirm audit docs include `expireAt`; TTL purge occurs in production—optionally run a maintenance script during local tests.

Tips
- Keep audit metadata minimal and PII-safe.
- Treat audit writes as best-effort; don’t block the user on logging failures.
- Prefer server-side authoritative events (verification, lockout) and use client logs for UX milestones only (e.g., open).
