import Head from 'next/head'
import { useRouter } from 'next/router'

export default function ParentChildDetailPage() {
  const router = useRouter()
  const { childId } = router.query

  return (
    <>
      <Head>
        <title>Santa View | Santa&apos;s Helper</title>
      </Head>
      <section className="card">
        <h2>Santa View</h2>
        <p>
          This placeholder represents the Santa-facing view for child{' '}
          <strong>{childId ?? '...'}</strong>.
        </p>
      </section>
    </>
  )
}
