import type { Metadata } from 'next'
import { COMPANY_NAME, SUPPORT_EMAIL, POLICY_EFFECTIVE_DATE } from '@/lib/legal'

export const metadata: Metadata = { title: 'Terms of Service | Santa’s Helper' }

export default function TermsPage() {
  return (
    <div className="column" style={{ gap: 16, maxWidth: 720, margin: '0 auto' }}>
      <section className="card">
        <h1 style={{ marginTop: 0 }}>Terms of Service</h1>
        <p className="meter-text">Effective {POLICY_EFFECTIVE_DATE}</p>

        <p>
          These terms cover your use of Santa&rsquo;s Helper, operated by {COMPANY_NAME} (&ldquo;we,&rdquo;
          &ldquo;us&rdquo;). By creating an account or using the app, you&rsquo;re agreeing to them. If you don&rsquo;t
          agree, please don&rsquo;t use the app.
        </p>

        <h2>Who can create an account</h2>
        <p>
          You must be an adult (18 or older, or the age of legal majority where you live) to create a parent
          account. Children use the app only through a family account a parent has set up and controls &mdash; a
          child never creates their own independent account.
        </p>

        <h2>What this app is</h2>
        <p>
          Santa&rsquo;s Helper is a family activity app: kids can write notes to Santa, log good deeds, and build a
          wish list, while parents can review it all and share a read-only wish list with family or friends. Gift
          suggestions and any pricing shown are informational only &mdash; we don&rsquo;t sell anything, process
          payments, or guarantee that a suggested item is in stock, priced correctly, or available at all. Always
          check with the actual retailer before buying anything.
        </p>
        <p>
          Santa&rsquo;s replies are generated automatically by an AI model. They&rsquo;re meant to be warm and
          encouraging, but they&rsquo;re not reviewed by a person before a child sees them, even though every note is
          screened by an automated safety filter first. We can&rsquo;t promise the filter or the AI will be perfect.
        </p>

        <h2>Your responsibilities</h2>
        <ul>
          <li>Keep your password and parent PIN to yourself. You&rsquo;re responsible for anything that happens
            under your account.</li>
          <li>Use real, age-appropriate information for your children &mdash; first name or nickname only, no
            identifying details a stranger could use to find them.</li>
          <li>Don&rsquo;t use the app to submit anything abusive, illegal, or unsafe. We reserve the right to
            suspend or delete an account that does.</li>
          <li>If you share a wish-list link, only send it to people you trust to see it.</li>
        </ul>

        <h2>Your data, your control</h2>
        <p>
          You can permanently delete your family&rsquo;s account and all its data at any time from the parent
          dashboard. See our <a className="link" href="/privacy">Privacy Policy</a> for details on what we collect
          and why.
        </p>

        <h2>No warranty</h2>
        <p>
          Santa&rsquo;s Helper is provided &ldquo;as is.&rdquo; We work to keep it reliable and safe, but we don&rsquo;t
          guarantee it will always be available, error-free, or uninterrupted, especially during high-traffic
          periods like the days before Christmas.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent the law allows, {COMPANY_NAME} isn&rsquo;t liable for indirect, incidental, or
          consequential damages arising from your use of the app. Nothing here limits any rights you have that
          can&rsquo;t legally be limited.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          If we change these terms, we&rsquo;ll update the effective date above and post the new version here.
        </p>

        <h2>Contact us</h2>
        <p>
          Questions about these terms: <a className="link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </section>
    </div>
  )
}
