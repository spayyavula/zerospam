// Server-rendered legal pages served directly at /privacy-policy and
// /terms-of-service (see api.ts). Because these are returned as raw HTML on a
// plain GET, they are what crawlers and Google's OAuth/CASA reviewer see
// without running JavaScript — so the Google API Services "Limited Use"
// disclosure in the Privacy Policy MUST live here, not only in the React SPA
// copy (web/src/LegalPage.tsx). Keep the two copies in sync.
//
// Operator: SAALR LLC (United States). The governing-law clause references the
// State in which SAALR LLC is organized; naming that State explicitly is
// recommended. This is not legal advice; have counsel review before launch.

const LAST_UPDATED = 'July 11, 2026';
const CONTACT = 'postmaster@zero-spam.email';

function shellHead(opts: { title: string; description: string; canonical: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${opts.title}</title>
  <meta name="description" content="${opts.description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${opts.canonical}">
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f7fb;
      --panel: #ffffff;
      --text: #17181c;
      --muted: #5c6270;
      --border: #dfe3eb;
      --accent: #0a84ff;
    }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; }
    .wrap { max-width: 840px; margin: 28px auto 48px; padding: 0 16px; }
    .card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 28px; }
    h1 { margin: 0 0 6px; font-size: 30px; line-height: 1.2; }
    h2 { margin: 28px 0 10px; font-size: 20px; line-height: 1.3; }
    h3 { margin: 18px 0 8px; font-size: 16px; line-height: 1.4; }
    p, li { font-size: 15px; }
    ul { margin: 8px 0 8px 20px; padding: 0; }
    code { background: #eef0f4; border-radius: 4px; padding: 1px 5px; font-size: 13px; }
    .meta { color: var(--muted); font-size: 13px; margin: 0 0 18px; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .topnav { margin: 0 0 14px; font-size: 14px; }
  </style>
</head>
<body>
  <main class="wrap">
    <article class="card">`;
}

const SHELL_FOOT = `
    </article>
  </main>
</body>
</html>`;

export function renderPrivacyPolicyPage(): string {
  return `${shellHead({
    title: 'Privacy Policy — ZeroSpam Email',
    description:
      'How ZeroSpam (SAALR LLC) collects, uses, and protects your information, including Google API Services Limited Use disclosures for read-only mailbox access.',
    canonical: 'https://zero-spam.email/privacy-policy',
  })}
      <nav class="topnav"><a href="/">ZeroSpam Home</a> · <a href="/terms-of-service">Terms of Service</a></nav>
      <h1>Privacy Policy</h1>
      <p class="meta">Last updated: ${LAST_UPDATED}</p>

      <p>
        This Privacy Policy explains how ZeroSpam ("ZeroSpam", "we", "our", or "us") collects, uses,
        shares, and protects information when you use the ZeroSpam email screening service at
        zero-spam.email (the "Service"). ZeroSpam is a whitelist-first service: only senders you approve
        reach your inbox, and unknown senders wait in a Screener until you decide.
      </p>

      <h2>1. Who We Are</h2>
      <p>
        The Service is operated by SAALR LLC ("SAALR"), a limited liability company organized in the
        United States, which is the data controller for the personal information described here. You can
        reach us about privacy at <a href="mailto:${CONTACT}">${CONTACT}</a>.
      </p>

      <h2>2. Information We Collect</h2>
      <h3>2.1 Account and identity data</h3>
      <ul>
        <li>Your email address, username, and a securely hashed password</li>
        <li>Two-factor authentication (TOTP) settings and security preferences</li>
        <li>The devices and sessions associated with your account</li>
      </ul>

      <h3>2.2 Connected mailbox data</h3>
      <p>
        When you connect a Gmail or Outlook mailbox, you authorize us — through OAuth — to access your
        messages on a <strong>read-only</strong> basis so we can screen and display them. This includes
        message headers (sender, recipients, subject), message bodies, attachment metadata, and email
        authentication results (SPF, DKIM, DMARC). We request the minimum scopes needed: Google
        <code>gmail.readonly</code> and Microsoft <code>Mail.Read</code>. We never request permission to
        send, delete, or modify your mail at the provider.
      </p>

      <h3>2.3 Screening data</h3>
      <ul>
        <li>Your whitelist rules, Screener decisions and mutes</li>
        <li>Contacts, address aliases, and any drafts you create in the Service</li>
      </ul>

      <h3>2.4 Technical and security data</h3>
      <ul>
        <li>An audit log of security-relevant events</li>
        <li>IP address and user agent used for abuse prevention and rate limiting</li>
        <li>One-time verification codes</li>
      </ul>

      <h2>3. How We Use Information</h2>
      <ul>
        <li>To provide the Service — screening, routing, and displaying your mail as you configure it</li>
        <li>To secure accounts, detect and prevent abuse, and investigate unauthorized access</li>
        <li>To maintain reliability and improve the Service</li>
        <li>To comply with legal obligations and enforce our Terms</li>
      </ul>
      <p>
        We do <strong>not</strong> use the content of your emails for advertising, and we do
        <strong>not</strong> use it to train generalized artificial-intelligence or machine-learning models.
      </p>

      <h2>4. Google User Data and Limited Use</h2>
      <p>
        ZeroSpam's use and transfer of information received from Google APIs to any other app will adhere to
        the
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>,
        including the Limited Use requirements. Specifically, data obtained through Google Gmail APIs is:
      </p>
      <ul>
        <li>used only to provide and improve the user-facing features that are prominent in the Service;</li>
        <li>not transferred to others except as necessary to provide or improve those features, to comply with applicable law, or as part of a merger, acquisition, or sale of assets with your notice;</li>
        <li>not used or transferred for serving advertisements; and</li>
        <li>not read by any human unless we have your affirmative consent for specific messages, it is necessary for security purposes (such as investigating abuse), to comply with applicable law, or the data is aggregated and anonymized.</li>
      </ul>
      <p>
        You can review and revoke ZeroSpam's access to your Google account at any time at
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>,
        or by disconnecting the mailbox within the Service.
      </p>

      <h2>5. Microsoft Account Data</h2>
      <p>
        When you connect an Outlook or Microsoft account, we access mail on a read-only basis via the
        Microsoft Graph <code>Mail.Read</code> scope, subject to the Microsoft Services Agreement and
        Microsoft's privacy terms. You can revoke access at any time from your Microsoft account privacy
        settings or by disconnecting the mailbox within the Service.
      </p>

      <h2>6. Sharing and Sub-processors</h2>
      <p>We do not sell personal information. We share data only with:</p>
      <ul>
        <li>Service providers that operate the Service on our behalf — including cloud hosting and infrastructure providers, and the email and identity providers you connect (Google, Microsoft) — under obligations to protect your data;</li>
        <li>Legal authorities when required by law or to protect rights and safety; and</li>
        <li>Successors in a merger, acquisition, or sale of assets, with notice to you.</li>
      </ul>

      <h2>7. Data Retention</h2>
      <p>
        Screened messages are retained only as long as needed to provide the Service and are subject to
        automatic expiry and deletion. When you disconnect a mailbox or delete your account, we delete the
        associated messages, attachments, contacts, and connection tokens, except where limited retention
        is required for security or to comply with law. Security and audit logs are kept for a limited
        period.
      </p>

      <h2>8. Security</h2>
      <p>
        We protect your data in transit with HTTPS and encrypt stored OAuth tokens at rest. Accounts
        support two-factor authentication (TOTP), and sessions are subject to both idle and absolute
        timeouts. No system is perfectly secure, but we work to protect your information using reasonable
        technical and organizational measures.
      </p>

      <h2>9. Your Rights and Choices</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, export, or restrict
        processing of your information, and to object to certain processing or withdraw consent. If you are
        in the European Economic Area or the United Kingdom, these rights arise under the GDPR/UK GDPR; if
        you are a California resident, the CCPA/CPRA gives you rights to know, delete, and correct your
        information and to opt out of its sale or sharing (note: we do not sell or share your personal
        information as those terms are defined). To exercise any right, contact us at
        <a href="mailto:${CONTACT}">${CONTACT}</a>. You may also disconnect a mailbox or delete your
        account at any time from within the Service. EEA/UK users may lodge a complaint with their local
        data protection authority.
      </p>

      <h2>10. International Data Transfers</h2>
      <p>
        We may process and store information in countries other than your own. Where we transfer personal
        data internationally, we rely on appropriate safeguards as required by applicable law.
      </p>

      <h2>11. Children</h2>
      <p>
        The Service is not directed to children and is not intended for anyone under the age of 16 (or the
        minimum age required in your jurisdiction). We do not knowingly collect data from children.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Policy from time to time. Material changes will be reflected by updating the
        "Last updated" date above and, where appropriate, by additional notice.
      </p>

      <h2>13. Contact</h2>
      <p>
        Privacy questions: <a href="mailto:${CONTACT}">${CONTACT}</a>.
      </p>
${SHELL_FOOT}`;
}

export function renderTermsOfServicePage(): string {
  return `${shellHead({
    title: 'Terms of Service — ZeroSpam Email',
    description:
      'The terms governing your use of ZeroSpam, the whitelist-first email screening service operated by SAALR LLC.',
    canonical: 'https://zero-spam.email/terms-of-service',
  })}
      <nav class="topnav"><a href="/">ZeroSpam Home</a> · <a href="/privacy-policy">Privacy Policy</a></nav>
      <h1>Terms of Service</h1>
      <p class="meta">Last updated: ${LAST_UPDATED}</p>

      <p>
        These Terms of Service ("Terms") govern your access to and use of ZeroSpam, the whitelist-first
        email screening service at zero-spam.email (the "Service"), operated by SAALR LLC ("SAALR", "we",
        "our", or "us"). By creating an account or using the Service, you agree to these Terms. If you do
        not agree, do not use the Service.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 16 years old (or the age of digital consent in your jurisdiction) and able to
        form a binding contract to use the Service. You must provide accurate registration information and
        keep it current.
      </p>

      <h2>2. The Service</h2>
      <p>
        ZeroSpam screens incoming email using a whitelist-first model: only senders you approve reach your
        inbox, and unknown senders are held in a Screener until you decide. You may connect a Gmail or
        Outlook mailbox, which grants ZeroSpam read-only access to your messages solely to screen and
        display them. The Service does not send, delete, or alter mail at your provider.
      </p>

      <h2>3. Your Account and Security</h2>
      <ul>
        <li>You are responsible for all activity under your account and for keeping your credentials secure.</li>
        <li>We recommend enabling two-factor authentication.</li>
        <li>Notify us promptly at <a href="mailto:${CONTACT}">${CONTACT}</a> if you suspect unauthorized access.</li>
      </ul>

      <h2>4. Connected Mailboxes</h2>
      <p>
        When you connect a third-party mailbox, you represent that you own it or are authorized to connect
        it, and you authorize ZeroSpam to access it on a read-only basis as described in our
        <a href="/privacy-policy">Privacy Policy</a>. You may revoke this access at any time by
        disconnecting the mailbox in the Service or through your provider's security settings.
      </p>

      <h2>5. Acceptable Use</h2>
      <ul>
        <li>No unlawful use, and no malware, phishing, spam, or fraudulent activity.</li>
        <li>No unauthorized access attempts, scraping, or interference with the Service or its security controls.</li>
        <li>No reverse engineering except to the extent permitted by applicable law.</li>
        <li>No use that infringes the rights of others or violates applicable law.</li>
      </ul>

      <h2>6. Intellectual Property</h2>
      <p>
        The Service, including its software, design, and content (excluding your data), is owned by SAALR
        and its licensors and is protected by intellectual-property laws. You retain all rights to your own
        data.
      </p>

      <h2>7. Third-Party Services</h2>
      <p>
        The Service relies on third-party providers, including Google and Microsoft. Your use of those
        providers through the Service is also subject to their respective terms and policies. We are not
        responsible for third-party services.
      </p>

      <h2>8. Service Changes and Availability</h2>
      <p>
        The Service is offered free of charge and may be provided on a beta or evolving basis. We may add,
        change, suspend, or discontinue features at any time, and we do not guarantee uninterrupted or
        error-free availability.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The Service is provided "as is" and "as available" without warranties of any kind, whether express
        or implied, to the fullest extent permitted by law. We do not warrant that the Service will block
        all unwanted mail or deliver all wanted mail.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, SAALR will not be liable for any indirect, incidental,
        special, consequential, or punitive damages, or for lost profits or data, arising from or related
        to your use of the Service. Our total liability for any claim relating to the Service will not
        exceed the greater of the amount you paid us in the twelve months before the claim or USD 100.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold SAALR harmless from claims arising out of your misuse of the
        Service or violation of these Terms or applicable law.
      </p>

      <h2>12. Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or terminate
        access if you violate these Terms or to protect the Service or its users. Provisions that by their
        nature should survive termination will survive.
      </p>

      <h2>13. Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the laws of the State in which SAALR LLC is organized and the federal
        laws of the United States, without regard to conflict-of-law rules. The state and federal courts
        located in that State will have exclusive jurisdiction over disputes, except where applicable law
        grants you the right to bring a claim in your local courts.
      </p>

      <h2>14. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be reflected by updating the
        "Last updated" date above and, where appropriate, by additional notice. Continued use of the
        Service after changes take effect constitutes acceptance.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions about these Terms: <a href="mailto:${CONTACT}">${CONTACT}</a>.
      </p>
${SHELL_FOOT}`;
}
