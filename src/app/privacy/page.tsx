import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | MailPoint",
  description: "Privacy Policy for MailPoint.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF9] text-zinc-900 dark:bg-[#08080B] dark:text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Back to MailPoint
        </Link>
        <article className="mt-10 space-y-8">
          <header>
            <h1 className="font-heading text-4xl font-semibold tracking-tight">Privacy Policy</h1>
            <p className="mt-3 text-sm text-zinc-500">Last updated: September 2026</p>
          </header>
          <section><h2 className="text-xl font-semibold">1. About MailPoint</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">MailPoint is an AI-powered communication workspace that brings email, calendar, search, and communication workflows together in one interface.</p></section>
          <section><h2 className="text-xl font-semibold">2. Information We Access</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">When you connect your Google account, MailPoint may access the Google services and information that you authorize, including Gmail and Google Calendar data required to provide the features you request.</p></section>
          <section><h2 className="text-xl font-semibold">3. How We Use Your Information</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">We use connected information to provide email and calendar functionality, search, communication workflows, and AI-assisted features and actions requested by you.</p></section>
          <section><h2 className="text-xl font-semibold">4. AI Processing</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">Some MailPoint features use AI to understand requests, generate responses, summarize information, and coordinate authorized Gmail and Google Calendar actions.</p></section>
          <section><h2 className="text-xl font-semibold">5. Data Security</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">MailPoint uses authentication, authorization, tenant isolation, secure integration handling, and protected server-side processing to help safeguard user information.</p></section>
          <section><h2 className="text-xl font-semibold">6. Third-Party Services</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">MailPoint integrates with third-party services such as Google Gmail and Google Calendar. Your use of those services remains subject to their respective terms and privacy policies.</p></section>
          <section><h2 className="text-xl font-semibold">7. Disconnecting Your Account</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">You can disconnect supported Google integrations through MailPoint&apos;s integration settings. You can also manage third-party access through your Google account settings.</p></section>
          <section><h2 className="text-xl font-semibold">8. Data Deletion</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">If you want information associated with your MailPoint account removed, please use the support or contact channel provided by the application.</p></section>
          <section><h2 className="text-xl font-semibold">9. Changes</h2><p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">This Privacy Policy may be updated as MailPoint evolves. Any updated version will be published on this page.</p></section>
        </article>
        <footer className="mt-16 border-t border-black/[0.06] pt-6 text-sm dark:border-white/[0.06]">
          <Link href="/terms" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">Terms of Service</Link>
        </footer>
      </div>
    </main>
  );
}
