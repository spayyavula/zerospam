import type { ReactNode } from 'react';

type LegalKind = 'privacy' | 'terms';

type Props = {
  kind: LegalKind;
};

const LAST_UPDATED = 'July 11, 2026';
const CONTACT = 'postmaster@zero-spam.email';

/**
 * Static legal pages, prerendered for /privacy-policy and /terms-of-service.
 *
 * Content reflects the service's actual data practices: read-only mailbox
 * access via Google (gmail.readonly) and Microsoft (Mail.Read) OAuth, storage
 * of screened message content, encrypted OAuth tokens, and retention driven by
 * per-message expiry. The Google API Services "Limited Use" disclosure in the
 * Privacy Policy is required for restricted-scope OAuth verification (CASA).
 *
 * Operator: SAALR LLC (United States). The governing-law clause references the
 * State in which SAALR LLC is organized; naming that State explicitly is
 * recommended for clarity. This is not legal advice; have counsel review
 * before launch.
 */
export default function LegalPage({ kind }: Props) {
  const isPrivacy = kind === 'privacy';

  return (
    <div className="min-h-screen bg-zsbg text-zstext px-4 sm:px-6 lg:px-8 py-10">
      <main className="max-w-4xl mx-auto rounded-2xl border border-zsborder bg-zspanel/50 p-6 sm:p-8">
        <div className="mb-6 text-sm text-zsmuted">
          <a href="/" className="hover:text-zsaccent transition">ZeroSpam Home</a>
          <span> · </span>
          {isPrivacy ? (
            <a href="/terms-of-service" className="hover:text-zsaccent transition">Terms of Service</a>
          ) : (
            <a href="/privacy-policy" className="hover:text-zsaccent transition">Privacy Policy</a>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold mb-2">{isPrivacy ? 'Privacy Policy' : 'Terms of Service'}</h1>
        <p className="text-sm text-zsmuted mb-8">Last updated: {LAST_UPDATED}</p>

        {isPrivacy ? <PrivacyContent /> : <TermsContent />}
      </main>
    </div>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-semibold pt-2">{children}</h2>;
}

function PrivacyContent() {
  return (
    <section className="space-y-5 text-sm sm:text-base leading-7">
      <p>
        This Privacy Policy explains how ZeroSpam (&ldquo;ZeroSpam&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;,
        or &ldquo;us&rdquo;) collects, uses, shares, and protects information when you use the ZeroSpam
        email screening service at zero-spam.email (the &ldquo;Service&rdquo;). ZeroSpam is a
        whitelist-first service: only senders you approve reach your inbox, and unknown senders wait in a
        Screener until you decide.
      </p>

      <H2>1. Who We Are</H2>
      <p>
        The Service is operated by SAALR LLC (&ldquo;SAALR&rdquo;), a limited liability company organized
        in the United States, which is the data controller for the personal information described here. You
        can reach us about privacy at{' '}
        <a className="text-zsaccent hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>

      <H2>2. Information We Collect</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>Account and identity data:</strong> your email address, username, a securely hashed
          password, two-factor authentication (TOTP) settings, and the devices and sessions associated
          with your account.
        </li>
        <li>
          <strong>Connected mailbox data:</strong> when you connect a Gmail or Outlook mailbox, you
          authorize us — through OAuth — to access your messages on a <strong>read-only</strong> basis so
          we can screen and display them. This includes message headers (sender, recipients, subject),
          message bodies, attachment metadata, and email authentication results (SPF, DKIM, DMARC). We
          request the minimum scopes needed: Google <code>gmail.readonly</code> and Microsoft{' '}
          <code>Mail.Read</code>. We never request permission to send, delete, or modify your mail at the
          provider.
        </li>
        <li>
          <strong>Screening data:</strong> your whitelist rules, Screener decisions and mutes, contacts,
          address aliases, and any drafts you create in the Service.
        </li>
        <li>
          <strong>Technical and security data:</strong> an audit log of security-relevant events, IP
          address and user-agent used for abuse prevention and rate limiting, and one-time verification
          codes.
        </li>
      </ul>

      <H2>3. How We Use Information</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>To provide the Service — screening, routing, and displaying your mail as you have configured.</li>
        <li>To secure accounts, detect and prevent abuse, and investigate unauthorized access.</li>
        <li>To maintain reliability and to improve the Service.</li>
        <li>To comply with legal obligations and enforce our Terms.</li>
      </ul>
      <p>
        We do <strong>not</strong> use the content of your emails for advertising, and we do{' '}
        <strong>not</strong> use it to train generalized artificial-intelligence or machine-learning models.
      </p>

      <H2>4. Google User Data and Limited Use</H2>
      <p>
        ZeroSpam&rsquo;s use and transfer of information received from Google APIs to any other app will
        adhere to the{' '}
        <a
          className="text-zsaccent hover:underline"
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. Specifically, data obtained through Google Gmail APIs is:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>used only to provide and improve the user-facing features that are prominent in the Service;</li>
        <li>
          not transferred to others except as necessary to provide or improve those features, to comply
          with applicable law, or as part of a merger, acquisition, or sale of assets with your notice;
        </li>
        <li>
          not used or transferred for serving advertisements; and
        </li>
        <li>
          not read by any human unless we have your affirmative consent for specific messages, it is
          necessary for security purposes (such as investigating abuse), to comply with applicable law, or
          the data is aggregated and anonymized.
        </li>
      </ul>
      <p>
        You can review and revoke ZeroSpam&rsquo;s access to your Google account at any time at{' '}
        <a
          className="text-zsaccent hover:underline"
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          myaccount.google.com/permissions
        </a>
        , or by disconnecting the mailbox within the Service.
      </p>

      <H2>5. Microsoft Account Data</H2>
      <p>
        When you connect an Outlook or Microsoft account, we access mail on a read-only basis via the
        Microsoft Graph <code>Mail.Read</code> scope, subject to the Microsoft Services Agreement and
        Microsoft&rsquo;s privacy terms. You can revoke access at any time from your Microsoft account
        privacy settings or by disconnecting the mailbox within the Service.
      </p>

      <H2>6. Sharing and Sub-processors</H2>
      <p>
        We do not sell personal information. We share data only with:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>Service providers</strong> that operate the Service on our behalf — including cloud
          hosting and infrastructure providers, and the email and identity providers you connect (Google,
          Microsoft) — under obligations to protect your data;
        </li>
        <li><strong>Legal authorities</strong> when required by law or to protect rights and safety; and</li>
        <li><strong>Successors</strong> in a merger, acquisition, or sale of assets, with notice to you.</li>
      </ul>

      <H2>7. Data Retention</H2>
      <p>
        Screened messages are retained only as long as needed to provide the Service and are subject to
        automatic expiry and deletion. When you disconnect a mailbox or delete your account, we delete the
        associated messages, attachments, contacts, and connection tokens, except where limited retention
        is required for security or to comply with law. Security and audit logs are kept for a limited
        period.
      </p>

      <H2>8. Security</H2>
      <p>
        We protect your data in transit with HTTPS and encrypt stored OAuth tokens at rest. Accounts
        support two-factor authentication (TOTP), and sessions are subject to both idle and absolute
        timeouts. No system is perfectly secure, but we work to protect your information using reasonable
        technical and organizational measures.
      </p>

      <H2>9. Your Rights and Choices</H2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, export, or restrict
        processing of your information, and to object to certain processing or withdraw consent. If you are
        in the European Economic Area or the United Kingdom, these rights arise under the GDPR/UK GDPR; if
        you are a California resident, the CCPA/CPRA gives you rights to know, delete, and correct your
        information and to opt out of its sale or sharing (note: we do not sell or share your personal
        information as those terms are defined). To exercise any right, contact us at{' '}
        <a className="text-zsaccent hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>. You may also
        disconnect a mailbox or delete your account at any time from within the Service. EEA/UK users may
        lodge a complaint with their local data protection authority.
      </p>

      <H2>10. International Transfers</H2>
      <p>
        We may process and store information in countries other than your own. Where we transfer personal
        data internationally, we rely on appropriate safeguards as required by applicable law.
      </p>

      <H2>11. Children</H2>
      <p>
        The Service is not directed to children and is not intended for anyone under the age of 16 (or the
        minimum age required in your jurisdiction). We do not knowingly collect data from children.
      </p>

      <H2>12. Changes to This Policy</H2>
      <p>
        We may update this Policy from time to time. Material changes will be reflected by updating the
        &ldquo;Last updated&rdquo; date above and, where appropriate, by additional notice.
      </p>

      <H2>13. Contact</H2>
      <p>
        Privacy questions:{' '}
        <a className="text-zsaccent hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </section>
  );
}

function TermsContent() {
  return (
    <section className="space-y-5 text-sm sm:text-base leading-7">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of ZeroSpam, the
        whitelist-first email screening service at zero-spam.email (the &ldquo;Service&rdquo;). By creating
        an account or using the Service, you agree to these Terms. If you do not agree, do not use the
        Service.
      </p>

      <H2>1. Eligibility</H2>
      <p>
        You must be at least 16 years old (or the age of digital consent in your jurisdiction) and able to
        form a binding contract to use the Service. You must provide accurate registration information and
        keep it current.
      </p>

      <H2>2. The Service</H2>
      <p>
        ZeroSpam screens incoming email using a whitelist-first model: only senders you approve reach your
        inbox, and unknown senders are held in a Screener until you decide. You may connect a Gmail or
        Outlook mailbox, which grants ZeroSpam read-only access to your messages solely to screen and
        display them. The Service does not send, delete, or alter mail at your provider.
      </p>

      <H2>3. Your Account and Security</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>You are responsible for all activity under your account and for keeping your credentials secure.</li>
        <li>We recommend enabling two-factor authentication.</li>
        <li>Notify us promptly at{' '}
          <a className="text-zsaccent hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>{' '}
          if you suspect unauthorized access.</li>
      </ul>

      <H2>4. Connected Mailboxes</H2>
      <p>
        When you connect a third-party mailbox, you represent that you own it or are authorized to connect
        it, and you authorize ZeroSpam to access it on a read-only basis as described in our{' '}
        <a className="text-zsaccent hover:underline" href="/privacy-policy">Privacy Policy</a>. You may
        revoke this access at any time by disconnecting the mailbox in the Service or through your provider&rsquo;s
        security settings.
      </p>

      <H2>5. Acceptable Use</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>No unlawful use, and no malware, phishing, spam, or fraudulent activity.</li>
        <li>No unauthorized access attempts, scraping, or interference with the Service or its security controls.</li>
        <li>No reverse engineering except to the extent permitted by applicable law.</li>
        <li>No use that infringes the rights of others or violates applicable law.</li>
      </ul>

      <H2>6. Intellectual Property</H2>
      <p>
        The Service, including its software, design, and content (excluding your data), is owned by
        ZeroSpam and its licensors and is protected by intellectual-property laws. You retain all rights to
        your own data.
      </p>

      <H2>7. Third-Party Services</H2>
      <p>
        The Service relies on third-party providers, including Google and Microsoft. Your use of those
        providers through the Service is also subject to their respective terms and policies. We are not
        responsible for third-party services.
      </p>

      <H2>8. Service Changes and Availability</H2>
      <p>
        The Service is offered free of charge and may be provided on a beta or evolving basis. We may add,
        change, suspend, or discontinue features at any time, and we do not guarantee uninterrupted or
        error-free availability.
      </p>

      <H2>9. Disclaimers</H2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of
        any kind, whether express or implied, to the fullest extent permitted by law. We do not warrant
        that the Service will block all unwanted mail or deliver all wanted mail.
      </p>

      <H2>10. Limitation of Liability</H2>
      <p>
        To the fullest extent permitted by law, ZeroSpam will not be liable for any indirect, incidental,
        special, consequential, or punitive damages, or for lost profits or data, arising from or related
        to your use of the Service. Our total liability for any claim relating to the Service will not
        exceed the greater of the amount you paid us in the twelve months before the claim or USD 100.
      </p>

      <H2>11. Indemnification</H2>
      <p>
        You agree to indemnify and hold ZeroSpam harmless from claims arising out of your misuse of the
        Service or violation of these Terms or applicable law.
      </p>

      <H2>12. Termination</H2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or terminate
        access if you violate these Terms or to protect the Service or its users. Provisions that by their
        nature should survive termination will survive.
      </p>

      <H2>13. Governing Law and Disputes</H2>
      <p>
        These Terms are governed by the laws of the State in which SAALR LLC is organized and the federal
        laws of the United States, without regard to conflict-of-law rules. The state and federal courts
        located in that State will have exclusive jurisdiction over disputes, except where applicable law
        grants you the right to bring a claim in your local courts.
      </p>

      <H2>14. Changes to These Terms</H2>
      <p>
        We may update these Terms from time to time. Material changes will be reflected by updating the
        &ldquo;Last updated&rdquo; date above and, where appropriate, by additional notice. Continued use
        of the Service after changes take effect constitutes acceptance.
      </p>

      <H2>15. Contact</H2>
      <p>
        Questions about these Terms:{' '}
        <a className="text-zsaccent hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </section>
  );
}
