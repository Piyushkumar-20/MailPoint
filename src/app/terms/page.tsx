import Link from "next/link";

export const metadata = {
  title: "Terms of Service | MailPoint",
  description: "Terms of Service for MailPoint.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to MailPoint
        </Link>
        <div className="mt-10 space-y-8">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
            <p className="mt-3 text-sm text-muted-foreground">Last updated: September 2026</p>
          </div>
          <section><h2 className="text-xl font-semibold">1. Acceptance</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">By accessing or using MailPoint, you agree to these Terms of Service. If you do not agree with these terms, you should not use the service.</p></section>
          <section><h2 className="text-xl font-semibold">2. MailPoint Service</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">MailPoint provides a unified workspace for email, calendar, search, and AI-assisted communication workflows.</p></section>
          <section><h2 className="text-xl font-semibold">3. Google Account Connections</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Certain features require you to connect a Google account. You are responsible for authorizing only the permissions you intend to provide and for maintaining the security of your Google account.</p></section>
          <section><h2 className="text-xl font-semibold">4. AI Features</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">MailPoint may use AI to interpret natural-language requests, generate content, summarize information, and perform supported actions through connected services. AI-generated results may not always be accurate, so review information and consequential actions when appropriate.</p></section>
          <section><h2 className="text-xl font-semibold">5. Acceptable Use</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">You agree not to misuse MailPoint, interfere with its operation, attempt unauthorized access, abuse connected services, or use the service for unlawful activities.</p></section>
          <section><h2 className="text-xl font-semibold">6. Subscriptions</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">MailPoint may provide free and paid subscription plans. Paid features, pricing, billing, and entitlement rules are presented within the application and may change in accordance with these terms.</p></section>
          <section><h2 className="text-xl font-semibold">7. Availability</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">We aim to keep MailPoint available and reliable, but the service may occasionally be unavailable because of maintenance, infrastructure problems, or failures of third-party services.</p></section>
          <section><h2 className="text-xl font-semibold">8. Intellectual Property</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">MailPoint and its software, interface, branding, and associated materials are protected by applicable intellectual-property laws. These terms do not transfer ownership of MailPoint to you.</p></section>
          <section><h2 className="text-xl font-semibold">9. Termination</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Access to MailPoint may be suspended or terminated if these terms are violated or when necessary to protect the service, users, or third-party integrations.</p></section>
          <section><h2 className="text-xl font-semibold">10. Changes</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">These terms may be updated as MailPoint evolves. The current version will always be published on this page.</p></section>
        </div>
        <footer className="mt-16 border-t pt-6 text-sm text-muted-foreground"><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></footer>
      </div>
    </main>
  );
}
