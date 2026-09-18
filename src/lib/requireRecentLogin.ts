import { FirebaseError } from 'firebase/app'
import { useReauth } from '@/context/ReauthContext'

// React hook helper that returns a function. When invoked around a protected action,
// it will attempt the action and catch auth/requires-recent-login to trigger reauth modal,
// then retry the action once upon success.
export function useRequireRecentLogin() {
  const { showReauthModal } = useReauth()

  async function requireRecentLogin<T>(action: () => Promise<T>, emailHint?: string): Promise<T> {
    try {
      return await action()
    } catch (e) {
      const code = e instanceof FirebaseError ? e.code : undefined
      if (code === 'auth/requires-recent-login') {
        await showReauthModal({ emailHint })
        // Retry once after successful reauth
        return await action()
      }
      throw e
    }
  }

  return { requireRecentLogin }
}

// UX copy suggestion for consumers:
// "For your security, please confirm it’s you by re‑entering your password."
// Error variants are handled in the modal with safe, non-revealing language.
