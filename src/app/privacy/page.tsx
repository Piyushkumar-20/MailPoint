import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | MailPoint",
  description: "Privacy Policy for MailPoint.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to MailPoint
        </Link>
        <div className="mt-10 space-y-8">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
            <p className="mt-3 text-sm text-muted-foreground">Last updated: September 2026</p>
          </div>
          <section><h2 className="text-xl font-semibold">1. About MailPoint</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">MailPoint is an AI-powered communication workspace that brings email and calendar workflows together in one interface.</p></section>
          <section><h2 className="text-xl font-semibold">2. Information We Access</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">When you connect your Google account, MailPoint may access the Google services and information that you authorize, including Gmail and Google Calendar data required to provide the features you request.</p></section>
          <section><h2 className="text-xl font-semibold">3. How We Use Your Information</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">We use connected information to provide email and calendar functionality, search, communication workflows, AI-assisted features, and actions requested by you.</p></section>
          <section><h2 className="text-xl font-semibold">4. AI Processing</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Some MailPoint features use AI to understand requests, generate responses, summarize information, and coordinate authorized Gmail and Google Calendar actions.</p></section>
          <section><h2 className="text-xl font-semibold">5. Data Security</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">MailPoint uses authentication, authorization, tenant isolation, secure integration handling, and protected server-side processing to help safeguard user information.</p></section>
          <section><h2 className="text-xl font-semibold">6. Third-Party Services</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">MailPoint integrates with third-party services such as Google Gmail and Google Calendar. Your use of those services remains subject to their respective terms and privacy policies.</p></section>
          <section><h2 className="text-xl font-semibold">7. Disconnecting Your Account</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">You can disconnect supported Google integrations through MailPoint&apos;s integration settings. You can also manage third-party access through your Google account settings.</p></section>
          <section><h2 className="text-xl font-semibold">8. Data Deletion</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">If you want information associated with your MailPoint account removed, please use the support or contact channel provided by the application.</p></section>
          <section><h2 className="text-xl font-semibold">9. Changes</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">This Privacy Policy may be updated as MailPoint evolves. Any updated version will be published on this page.</p></section>
        </div>
        <footer className="mt-16 border-t pt-6 text-sm text-muted-foreground"><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></footer>
      </div>
    </main>
  );
}
