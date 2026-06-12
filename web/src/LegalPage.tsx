type LegalKind = 'privacy' | 'terms';

type Props = {
  kind: LegalKind;
};

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
        <p className="text-sm text-zsmuted mb-8">Last updated: June 12, 2026</p>

        {isPrivacy ? (
          <section className="space-y-5 text-sm sm:text-base leading-7">
            <p>
              This Privacy Policy explains how ZeroSpam ("ZeroSpam", "we", "our", or "us") collects,
              uses, and protects information when you use the ZeroSpam email service at zero-spam.email.
            </p>
            <h2 className="text-xl font-semibold">1. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account data such as your email address and security settings.</li>
              <li>Mail-processing data needed to route, screen, and deliver messages.</li>
              <li>Technical logs used for reliability, abuse prevention, and security.</li>
            </ul>
            <h2 className="text-xl font-semibold">2. How We Use Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and improve the service.</li>
              <li>To protect accounts and detect unauthorized access.</li>
              <li>To comply with legal obligations and enforce our terms.</li>
            </ul>
            <h2 className="text-xl font-semibold">3. Sharing and Disclosure</h2>
            <p>
              We do not sell personal information. We may share data with service providers,
              legal authorities when required, and successors in corporate transactions.
            </p>
            <h2 className="text-xl font-semibold">4. Your Rights</h2>
            <p>
              Depending on your location, you may have rights to access, correct, delete,
              or export your information and object to certain processing.
            </p>
            <h2 className="text-xl font-semibold">5. Contact</h2>
            <p>
              Privacy questions: <a className="text-zsaccent hover:underline" href="mailto:postmaster@zero-spam.email">postmaster@zero-spam.email</a>.
            </p>
          </section>
        ) : (
          <section className="space-y-5 text-sm sm:text-base leading-7">
            <p>
              These Terms of Service ("Terms") govern your access to and use of ZeroSpam.
              By using the service, you agree to these Terms.
            </p>
            <h2 className="text-xl font-semibold">1. Eligibility and Account Responsibility</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are responsible for account activity and credential security.</li>
              <li>You must provide accurate registration information.</li>
            </ul>
            <h2 className="text-xl font-semibold">2. Acceptable Use</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>No unlawful use, abuse, malware, phishing, or unauthorized access attempts.</li>
              <li>No interference with platform operations or security controls.</li>
            </ul>
            <h2 className="text-xl font-semibold">3. Service Changes and Availability</h2>
            <p>
              We may modify features and do not guarantee uninterrupted availability.
            </p>
            <h2 className="text-xl font-semibold">4. Disclaimers and Liability</h2>
            <p>
              The service is provided "as is" and "as available" to the extent allowed by law.
              To the fullest extent permitted, ZeroSpam is not liable for indirect or consequential damages.
            </p>
            <h2 className="text-xl font-semibold">5. Contact</h2>
            <p>
              Terms questions: <a className="text-zsaccent hover:underline" href="mailto:postmaster@zero-spam.email">postmaster@zero-spam.email</a>.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
