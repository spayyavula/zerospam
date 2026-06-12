const SHELL_HEAD = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ZeroSpam Legal</title>
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
    .meta { color: var(--muted); font-size: 13px; margin: 0 0 18px; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .topnav { margin: 0 0 14px; font-size: 14px; }
  </style>
</head>
<body>
  <main class="wrap">
    <article class="card">`;

const SHELL_FOOT = `
    </article>
  </main>
</body>
</html>`;

export function renderPrivacyPolicyPage(): string {
  return `${SHELL_HEAD}
      <nav class="topnav"><a href="/">ZeroSpam Home</a> · <a href="/terms-of-service">Terms of Service</a></nav>
      <h1>Privacy Policy</h1>
      <p class="meta">Last updated: June 12, 2026</p>

      <p>
        This Privacy Policy explains how ZeroSpam ("ZeroSpam", "we", "our", or "us")
        collects, uses, and protects information when you use the ZeroSpam email
        service at zero-spam.email.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>1.1 Account and profile data</h3>
      <ul>
        <li>Email address and account identifiers</li>
        <li>Authentication and security settings, including MFA state</li>
        <li>Operational account preferences related to screening and routing</li>
      </ul>

      <h3>1.2 Mail-processing data</h3>
      <ul>
        <li>Sender/recipient addressing metadata and message headers</li>
        <li>Message content and attachments needed to provide filtering and inbox delivery</li>
        <li>Whitelist, screener, and sender-trust decisions you make in the product</li>
      </ul>

      <h3>1.3 Technical and security logs</h3>
      <ul>
        <li>IP address, user agent, request timestamps, and service health logs</li>
        <li>Security and abuse telemetry used to detect misuse and protect accounts</li>
      </ul>

      <h2>2. How We Use Information</h2>
      <ul>
        <li>Provide, maintain, and improve the ZeroSpam email service</li>
        <li>Route, screen, and deliver messages according to your account settings</li>
        <li>Authenticate users and secure accounts (including MFA workflows)</li>
        <li>Detect fraud, abuse, and unauthorized access</li>
        <li>Comply with legal obligations and enforce our Terms of Service</li>
      </ul>

      <h2>3. Legal Bases (Where Applicable)</h2>
      <p>
        Where data protection law requires a legal basis, we rely on contractual necessity
        (to provide the service), legitimate interests (security and abuse prevention),
        legal obligations, and your consent where specifically requested.
      </p>

      <h2>4. Sharing and Disclosure</h2>
      <p>We do not sell your personal information.</p>
      <p>We may share information with:</p>
      <ul>
        <li>Infrastructure and service providers that help us operate the platform</li>
        <li>Law enforcement or regulators when legally required</li>
        <li>Professional advisors in connection with legal, security, or compliance matters</li>
        <li>Successors in a merger, acquisition, or sale of assets (with notice where required)</li>
      </ul>

      <h2>5. Data Retention</h2>
      <p>
        We retain information for as long as needed to provide the service,
        meet legal obligations, resolve disputes, and enforce agreements. Retention
        periods vary by data category and operational need.
      </p>

      <h2>6. Security</h2>
      <p>
        We use administrative, technical, and organizational safeguards designed to protect
        personal information. No system can be guaranteed 100% secure, but we work to
        continuously improve our controls.
      </p>

      <h2>7. Your Rights and Choices</h2>
      <p>Depending on your location, you may have rights to:</p>
      <ul>
        <li>Access, correct, or delete certain personal information</li>
        <li>Object to or restrict certain processing</li>
        <li>Request data portability</li>
        <li>Withdraw consent where processing is based on consent</li>
      </ul>
      <p>
        To exercise rights, contact us at
        <a href="mailto:postmaster@zero-spam.email">postmaster@zero-spam.email</a>.
      </p>

      <h2>8. International Data Transfers</h2>
      <p>
        Your information may be processed in countries other than your own. Where required,
        we use appropriate safeguards for cross-border transfers.
      </p>

      <h2>9. Children</h2>
      <p>
        ZeroSpam is not directed to children under 13 (or a higher minimum age where required
        by local law), and we do not knowingly collect personal information from children.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material updates will be posted
        on this page with an updated "Last updated" date.
      </p>

      <h2>11. Contact</h2>
      <p>
        For privacy questions, contact
        <a href="mailto:postmaster@zero-spam.email">postmaster@zero-spam.email</a>.
      </p>
${SHELL_FOOT}`;
}

export function renderTermsOfServicePage(): string {
  return `${SHELL_HEAD}
      <nav class="topnav"><a href="/">ZeroSpam Home</a> · <a href="/privacy-policy">Privacy Policy</a></nav>
      <h1>Terms of Service</h1>
      <p class="meta">Last updated: June 12, 2026</p>

      <p>
        These Terms of Service ("Terms") govern your access to and use of the
        ZeroSpam service at zero-spam.email. By using the service, you agree to
        these Terms.
      </p>

      <h2>1. Eligibility and Account Responsibility</h2>
      <ul>
        <li>You must provide accurate account information and keep it up to date.</li>
        <li>You are responsible for activities under your account and credentials.</li>
        <li>You must promptly notify us of suspected unauthorized account access.</li>
      </ul>

      <h2>2. Service Description</h2>
      <p>
        ZeroSpam provides whitelist-first email screening, sender trust controls,
        and related mailbox tools. Service features may evolve over time.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for unlawful, fraudulent, or abusive conduct</li>
        <li>Transmit malware, harmful code, or phishing content</li>
        <li>Attempt unauthorized access to systems, accounts, or data</li>
        <li>Interfere with service operation, availability, or security controls</li>
        <li>Reverse engineer or misuse APIs outside authorized usage</li>
      </ul>

      <h2>4. User Content and Permissions</h2>
      <p>
        You retain rights to your content. You grant ZeroSpam the limited rights
        necessary to process, route, and store data to provide the service and
        enforce these Terms.
      </p>

      <h2>5. Privacy</h2>
      <p>
        Our use of personal information is described in our
        <a href="/privacy-policy">Privacy Policy</a>.
      </p>

      <h2>6. Availability and Changes</h2>
      <p>
        We aim for reliable operation but do not guarantee uninterrupted service.
        We may modify, suspend, or discontinue features as needed.
      </p>

      <h2>7. Third-Party Services</h2>
      <p>
        Some features rely on third-party providers or integrations. We are not
        responsible for third-party services, content, or terms.
      </p>

      <h2>8. Termination</h2>
      <p>
        You may stop using the service at any time. We may suspend or terminate
        access for violations of these Terms, legal requirements, or security risks.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The service is provided "as is" and "as available" to the maximum extent
        permitted by law, without warranties of any kind, express or implied.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, ZeroSpam will not be liable for
        indirect, incidental, special, consequential, or punitive damages, or for
        loss of profits, data, goodwill, or business interruption.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold harmless ZeroSpam from claims,
        liabilities, damages, and expenses arising from your use of the service
        or violation of these Terms.
      </p>

      <h2>12. Governing Law</h2>
      <p>
        These Terms are governed by applicable laws of your service jurisdiction,
        without regard to conflict-of-law principles.
      </p>

      <h2>13. Changes to Terms</h2>
      <p>
        We may update these Terms. Continued use after updates are posted
        constitutes acceptance of the revised Terms.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms can be sent to
        <a href="mailto:postmaster@zero-spam.email">postmaster@zero-spam.email</a>.
      </p>
${SHELL_FOOT}`;
}