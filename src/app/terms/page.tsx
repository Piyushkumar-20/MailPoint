import Link from "next/link";

export const metadata = {
  title: "Terms of Service | MailPoint",
  description: "Terms of Service for MailPoint.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF9] text-zinc-900 dark:bg-[#08080B] dark:text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Back to MailPoint
        </Link>
        <article className="mt-10 space-y-8">
          <header>
            <h1 className="font-heading text-4xl font-semibold tracking-tight">Terms of Service</h1>
            <p className="mt-3 text-sm text-zinc-500">Last updated: September 2026</p>
          </header>
          <section><h2 className="text-xl font-semibold">1. Acceptance</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">By accessing or using MailPoint, you agree to these Terms of Service. If you do not agree with these terms, you should not use the service.</p></section>
          <section><h2 className="text-xl font-semibold">2. MailPoint Service</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">MailPoint provides a unified workspace for email, calendar, search, and AI-assisted communication workflows.</p></section>
          <section><h2 className="text-xl font-semibold">3. Google Account Connections</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">Certain features require you to connect a Google account. You are responsible for authorizing only the permissions you intend to provide and for maintaining the security of your Google account.</p></section>
          <section><h2 className="text-xl font-semibold">4. AI Features</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">MailPoint may use AI to interpret natural-language requests, generate content, summarize information, and perform supported actions through connected services. AI-generated results may not always be accurate, so you remain responsible for reviewing information and confirming consequential actions when required.</p></section>
          <section><h2 className="text-xl font-semibold">5. Acceptable Use</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">You agree not to misuse MailPoint, interfere with its operation, attempt unauthorized access, abuse connected services, or use the service for unlawful activities.</p></section>
          <section><h2 className="text-xl font-semibold">6. Subscriptions</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">MailPoint may provide free and paid subscription plans. Paid features, pricing, billing, and entitlement rules are presented within the application and may change as the service evolves.</p></section>
          <section><h2 className="text-xl font-semibold">7. Availability</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">We aim to keep MailPoint available and reliable, but the service may occasionally be unavailable because of maintenance, infrastructure problems, or failures of third-party services.</p></section>
          <section><h2 className="text-xl font-semibold">8. Intellectual Property</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">MailPoint and its software, interface, branding, and associated materials are protected by applicable intellectual-property laws. These terms do not transfer ownership of MailPoint to you.</p></section>
          <section><h2 className="text-xl font-semibold">9. Termination</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">Access to MailPoint may be suspended or terminated if these terms are violated or when necessary to protect the service, users, or third-party integrations.</p></section>
          <section><h2 className="text-xl font-semibold">10. Changes</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">These terms may be updated as MailPoint evolves. The current version will always be published on this page.</p></section>
        </article>
        <footer className="mt-16 border-t border-black/[0.06] pt-6 text-sm dark:border-white/[0.06]">
          <Link href="/privacy" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">Privacy Policy</Link>
        </footer>
      </div>
    </main>
  );
}
