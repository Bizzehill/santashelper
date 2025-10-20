## Parent PIN + Role-based Access

This app restricts the Parent Dashboard to users with the `role=parent` custom claim. A Firebase Callable Function verifies a Parent PIN and sets the custom claim. Firestore Security Rules enforce parent-only writes.

### Setup

1. Deploy Firebase Functions and set environment secrets:
  - `PIN_HASH_SECRET`: HMAC secret for hashing the PIN input.
  - `PIN_HASH`: Precomputed HMAC-SHA256 hash of your chosen numeric PIN using the same secret.

2. Deploy rules from `FIRESTORE_RULES.txt`.

3. Client flow:
  - Non-parent users are prompted for the Parent PIN on `/parent`.
  - Callable function `verifyParentPin` validates the PIN and sets the `role` custom claim.
  - The client refreshes ID token and grants access.

### Lightweight audit events

Anonymous, PII-safe audit events are written to `families/{familyId}/audit`:

- `parentGate.open` — when the keypad is shown (client best-effort)
- `parentGate.verify.success` — successful PIN verification (server authoritative)
- `parentGate.verify.failure` — failed attempt with `reason` in meta: `INVALID_PIN`, `LOCKED`, or `SERVER_MISCONFIGURED` (server authoritative)
- `lockout.started` — when max attempts is reached and a lockout begins (server authoritative)

Event document schema:

```
{
  event: string,
  meta: object,              // PII-safe only; e.g., remainingAttempts, ttlMinutes, lockedUntilEpochMs
  createdAt: Timestamp,      // serverTimestamp
  expireAt: Timestamp,       // 30d retention marker
  source: 'client' | 'callable'
}
```

PII policy: Do not store emails, display names, or raw PINs. Family identity is implicit in the collection path.

Retention: Configure a Firestore TTL policy on the `expireAt` field for the `families/{familyId}/audit/*` collection group to automatically purge events after 30 days.

### Promote a parent (admin-only)

Deploy the callable `setParentRole` and then call it once per promoted parent. Only callers with `role=admin` (or `admin=true`) custom claim can invoke it. The function:

- Sets the user's auth custom claim `{ role: 'parent' }` (preserving other claims),
- Mirrors `role: 'parent'` into `users/{uid}` (clients cannot write this field),
- Revokes refresh tokens so the client must refresh to receive new claims.

Example (Node/CLI) using Firebase Admin SDK or by creating a temporary admin user/session:

1) Ensure your caller has an admin custom claim.
2) Call the function `setParentRole` with `{ uid: '<TARGET_USER_UID>' }`.
3) Ask the parent to sign out/in (or refresh) to pick up the claim.

# Santa's Helper - Good List App

A joyful, family-friendly Christmas list app that helps kids build their wish list while earning goodness points for real-world deeds. Parents can guide with thoughtful budgets and approvals.

## Features

- **Goodness Points System**: Kids earn points for good deeds that unlock gift slots
- **Family Authentication**: Secure Firebase-based user management
- **Real-time Updates**: Live synchronization between family members
- **AI-Powered Suggestions**: OpenAI integration for age-appropriate deed ideas
- **Parent Dashboard**: Approve deeds, manage budgets, and track wish lists
- **Santa View**: Kid-friendly interface for adding wishes and logging deeds

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Firebase** for authentication and Firestore database
- **OpenAI API** for generating deed suggestions
- **Responsive CSS** with custom design system

## Setup Instructions

### 1. Clone and Install

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd santashelper-app
npm install
```

### 2. Environment Setup

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your:
- Firebase project credentials
- OpenAI API key
- ElevenLabs API key (stored as `ELEVENLABS_API_KEY`)

### ElevenLabs Santa TTS Example

Once the ElevenLabs key and Santa voice ID are in place, you can call the new API route and play the generated audio from any React component:

```tsx
async function playSantaLine(text: string) {
  const response = await fetch('/api/santa-elevenlabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    throw new Error('Santa was busy and could not read the message.')
  }

  const audioBlob = await response.blob()
  const audioUrl = URL.createObjectURL(audioBlob)
  const player = new Audio(audioUrl)
  await player.play()
  URL.revokeObjectURL(audioUrl)
}
```

### 3. Firebase Setup

1. Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Copy the provided Firestore rules from `FIRESTORE_RULES.txt` to your Firebase console

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Available Scripts

### `npm run dev`

Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm run build`

Builds the app for production to the `.next` folder.

### `npm start`

Runs the built app in production mode.

### `npm run lint`

Runs ESLint to check for code quality issues.

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── api/            # API routes
│   ├── login/          # Login page
│   ├── parent/         # Parent dashboard
│   ├── santa/          # Santa view (kids)
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # Reusable components
├── context/           # React context providers
└── lib/               # Utility functions
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Access Model

- Parents create families and set per-child PINs.
  - On signup/onboarding, a family is created and `families/{fid}/settings` is seeded with `pinStatus: 'unset'`.
  - Parents set a Parent PIN and can add child profiles with per-child PINs.
  - Firestore rules allow parents to read/write their family and all child documents; protected fields (role, familyCode, parentUIDs) cannot be changed by clients.

- Children can use Santa anonymously at first.
  - Anonymous users write to their own `anon_workspaces/{uid}/santa/*` or `users/{anonUid}/anonSanta/*` (depending on feature).
  - When ready, they link to a parent family using a family code, their name, and child PIN.
  - Linking migrates anon data to `users/{familyId}/children/{childId}` and starts a short-lived child session.

- Linking flow location
  - Visit `/santa/link-family` to link an anonymous session to a family using `familyCode + name + PIN`.
