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
