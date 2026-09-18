import type { Metadata } from 'next'
import { COMPANY_NAME, SUPPORT_EMAIL, POLICY_EFFECTIVE_DATE } from '@/lib/legal'

export const metadata: Metadata = { title: 'Privacy Policy | Santa’s Helper' }

export default function PrivacyPolicyPage() {
  return (
    <div className="column" style={{ gap: 16, maxWidth: 720, margin: '0 auto' }}>
      <section className="card">
        <h1 style={{ marginTop: 0 }}>Privacy Policy</h1>
        <p className="meter-text">Effective {POLICY_EFFECTIVE_DATE}</p>

        <p>
          Santa&rsquo;s Helper is operated by {COMPANY_NAME} (&ldquo;we,&rdquo; &ldquo;us&rdquo;). This page explains what
          information we collect, why, and how you can control it. We wrote it in plain language on purpose &mdash;
          if anything is unclear, email us at <a className="link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>

        <h2>The short version</h2>
        <ul>
          <li>Only a parent can create an account. Kids join a family using a code, their name, and a PIN &mdash;
            never an email address or any way to contact them directly.</li>
          <li>We don&rsquo;t show ads, and we don&rsquo;t use ad trackers of any kind.</li>
          <li>We never sell anyone&rsquo;s information, to anyone, ever.</li>
          <li>A parent can permanently delete their family&rsquo;s account and all its data at any time, right from
            the parent dashboard.</li>
        </ul>

        <h2>Who this app is for</h2>
        <p>
          Santa&rsquo;s Helper is a family app. Parents create the account, and children use a kid-facing view under
          their family&rsquo;s account to write notes to Santa and log good deeds. Because children under 13 use part
          of this app, we handle their information the way the Children&rsquo;s Online Privacy Protection Act (COPPA)
          requires: a parent is always the one who sets it up, controls it, and can delete it.
        </p>

        <h2>What we collect</h2>
        <p><strong>From a parent, when you sign up:</strong></p>
        <ul>
          <li>Your name and email address</li>
          <li>Your password &mdash; we never see or store this ourselves; it&rsquo;s handled entirely by our
            authentication provider (Firebase Authentication, part of Google Cloud) using industry-standard
            encryption</li>
          <li>A PIN you choose, to keep the parent dashboard separate from the kid-facing view &mdash; stored only as
            a one-way cryptographic hash, never as plain text, so even we can&rsquo;t read it back</li>
        </ul>
        <p><strong>From (or about) a child, entered by a parent or the child themselves within the family&rsquo;s account:</strong></p>
        <ul>
          <li>A first name or nickname, and an optional avatar (a single emoji, not a photo)</li>
          <li>A PIN the child uses to access their own family&rsquo;s account &mdash; also stored only as a one-way
            hash</li>
          <li>Gift ideas they add to their wish list, and notes describing good deeds they&rsquo;ve done</li>
        </ul>
        <p>
          We do not ask a child for their email address, real last name, birthdate, photo, or location, and the app
          gives no way to enter them.
        </p>

        <h2>How AI is involved</h2>
        <p>
          When a child writes a note to Santa or a good deed, that text is sent to OpenAI to generate a reply and,
          if requested, to a text-to-speech provider (currently ElevenLabs or OpenAI&rsquo;s own voice model) to read
          Santa&rsquo;s reply aloud. Before any note is sent to generate a reply, it&rsquo;s automatically screened by
          a safety filter (OpenAI&rsquo;s moderation service); anything flagged is rejected and never used to
          generate a response. These providers process the text to return a response and do not use it to build
          advertising profiles.
        </p>

        <h2>How we use what we collect</h2>
        <p>
          Solely to run the app: to show a family their own children, wish lists, and good deeds; to let Santa
          reply to notes; to let a parent share a read-only wish list link with someone like a grandparent; and to
          keep the parent PIN gate secure (a lightweight, anonymized log of PIN attempts is kept for 30 days to
          detect abuse, and never includes the PIN itself).
        </p>

        <h2>Who can see it</h2>
        <ul>
          <li>A family&rsquo;s parent can see everything in their own family&rsquo;s account.</li>
          <li>A child linked to a family can see and add to their own wish list and deeds, not anyone else&rsquo;s.</li>
          <li>Anyone a parent explicitly sends a share link to can view that one child&rsquo;s wish list, read-only,
            until the parent creates a new link.</li>
          <li>Nobody else. We don&rsquo;t share, rent, or sell any of this information to third parties for their own
            purposes.</li>
        </ul>

        <h2>Who we share it with</h2>
        <p>
          Only the service providers we use to run the app, and only as needed to provide the service: Firebase /
          Google Cloud (accounts, database, hosting), OpenAI (generating Santa&rsquo;s replies and screening content
          for safety), and, if voice playback is used, ElevenLabs. None of them are permitted to use this data for
          their own advertising or profiling.
        </p>

        <h2>No ads, no tracking</h2>
        <p>
          Santa&rsquo;s Helper has no advertising and no ad-tracking technology of any kind &mdash; no ad networks,
          no third-party analytics pixels, no behavioral profiling. If that ever changes, we&rsquo;ll update this
          policy first and, for anything involving children&rsquo;s data, we won&rsquo;t make that change without
          finding a compliant way to ask for parental consent first.
        </p>

        <h2>How long we keep it, and how to delete it</h2>
        <p>
          We keep a family&rsquo;s data as long as the account exists. A parent can permanently delete their entire
          family&rsquo;s account and everything in it &mdash; every child, wish list, deed, and share link &mdash;
          at any time from the parent dashboard. This cannot be undone. You can also email{' '}
          <a className="link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to request deletion or ask
          questions about your family&rsquo;s data.
        </p>

        <h2>Security</h2>
        <p>
          Passwords and PINs are never stored as plain text. The parent dashboard requires both a signed-in account
          and a separate PIN, so a child using the kid-facing view can&rsquo;t reach parent tools or another
          family&rsquo;s data.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If we change this policy, we&rsquo;ll update the effective date above and post the new version here.
        </p>

        <h2>Contact us</h2>
        <p>
          Questions, concerns, or a request to review or delete your family&rsquo;s data:{' '}
          <a className="link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </section>
    </div>
  )
}
