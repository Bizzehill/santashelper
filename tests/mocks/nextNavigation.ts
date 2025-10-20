// @ts-nocheck
// Mock for next/navigation router
const router = {
  calls: [] as any[],
  replace: (path: string) => { router.calls.push(path) },
}

export const useRouter = () => router
export const __routerMock = router
