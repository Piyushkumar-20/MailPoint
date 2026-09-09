import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-8 lg:py-16">
        <div className="mb-10">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            ← Back to MailPoint
          </Link>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight">
            Privacy Policy
          </h1>

          <p className="text-muted-foreground mt-3 text-sm">
            Last updated: September 9, 2026
          </p>
        </div>

        <div className="text-muted-foreground space-y-10 text-sm leading-7">
          {/* 1 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              1. Introduction
            </h2>

            <p>
              MailPoint (&quot;MailPoint&quot;, &quot;we&quot;, &quot;us&quot;,
              or &quot;our&quot;) is a software service that provides a unified
              workspace for managing email, calendar information, search, and
              AI-assisted productivity features.
            </p>

            <p className="mt-4">
              This Privacy Policy explains what information MailPoint processes,
              how that information is used, how third-party services may process
              information on our behalf, and the choices available to you.
            </p>

            <p className="mt-4">
              By using MailPoint, you acknowledge the practices described in
              this Privacy Policy.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              2. Information We Collect and Process
            </h2>

            <p>
              Depending on the features you use, MailPoint may process the
              following categories of information:
            </p>

            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Account and authentication information.</li>

              <li>
                Gmail messages and related information, including message
                metadata, sender and recipient information, subjects, snippets,
                labels, drafts, and message content required for MailPoint
                features.
              </li>

              <li>
                Google Calendar information, including event titles,
                descriptions, dates, times, attendees, locations, and other
                event metadata required by calendar features.
              </li>

              <li>
                User-created MailPoint data, including AI classifications,
                search embeddings, preferences, and application settings.
              </li>

              <li>
                Information you voluntarily provide when communicating with us.
              </li>

              <li>
                Technical information necessary to operate, secure, and
                troubleshoot the service.
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              3. Google User Data
            </h2>

            <p>
              MailPoint uses Google APIs to provide Gmail and Google Calendar
              functionality. When you connect your Google account, MailPoint may
              access Google user data permitted by the OAuth scopes you
              authorize.
            </p>

            <p className="mt-4">
              Gmail data may be processed to display and manage email, perform
              searches, classify messages, provide AI-assisted functionality,
              and provide other features explicitly requested or enabled within
              MailPoint.
            </p>

            <p className="mt-4">
              Google Calendar data may be processed to display, create, update,
              delete, and manage calendar events and related calendar
              functionality.
            </p>

            <p className="mt-4">
              MailPoint does not sell Google user data. Google user data is not
              used for advertising or targeted advertising.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              4. AI-Assisted Features
            </h2>

            <p>
              MailPoint provides AI-assisted functionality, including email
              intelligence, email priority classification, an AI agent, and
              semantic email search.
            </p>

            {/* 4.1 */}
            <h3 className="text-foreground mt-6 mb-2 font-medium">4.1 Groq</h3>

            <p>
              MailPoint uses the Groq API to provide AI-powered email
              classification and AI agent functionality.
            </p>

            <p className="mt-4">
              For email priority classification, MailPoint may send relevant
              email information to Groq, including the sender, recipient,
              subject, date, Gmail labels, and a limited portion of the email
              body or snippet. MailPoint limits the amount of email content
              included in an individual classification request.
            </p>

            <p className="mt-4">
              MailPoint also uses Groq for its AI agent. When the AI agent is
              used, information required to understand and fulfill the
              user&apos;s request may be processed by Groq.
            </p>

            {/* 4.2 */}
            <h3 className="text-foreground mt-6 mb-2 font-medium">
              4.2 Google Gemini
            </h3>

            <p>
              MailPoint uses the Google Gemini API to generate semantic
              embeddings used by its intelligent email search functionality.
            </p>

            <p className="mt-4">
              For semantic email search, MailPoint may send a limited text
              representation of an email to Gemini. This representation may
              contain the email subject, sender, and email body or snippet.
              MailPoint limits the amount of source text submitted for an
              embedding request.
            </p>

            <p className="mt-4">
              The resulting numerical embedding is stored by MailPoint to
              support subsequent semantic searches. MailPoint may also store the
              source text used to generate that embedding as part of its search
              data.
            </p>

            {/* 4.3 */}
            <h3 className="text-foreground mt-6 mb-2 font-medium">
              4.3 AI Training
            </h3>

            <p>
              MailPoint does not use Google user data to develop, train, or
              improve MailPoint&apos;s own generalized artificial intelligence
              models.
            </p>

            <p className="mt-4">
              MailPoint uses third-party AI services to provide specific
              application functionality. Processing by those services is
              governed by their applicable terms, privacy policies, and
              service-specific data-use practices.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              5. Google API Limited Use Compliance
            </h2>

            <p>
              MailPoint&apos;s use and transfer of information received from
              Google APIs will comply with the Google API Services User Data
              Policy, including the Limited Use requirements.
            </p>

            <p className="mt-4">
              MailPoint requests access to Google data necessary to provide the
              functionality described in this Privacy Policy.
            </p>

            <p className="mt-4">
              MailPoint does not sell Google user data or use Google user data
              for advertising or targeted advertising.
            </p>

            <p className="mt-4">
              Google user data is not transferred to third parties for
              advertising or sale. Where Google user data is processed by
              service providers, the processing is limited to purposes necessary
              to provide or support MailPoint functionality and is subject to
              applicable policies and agreements.
            </p>

            <p className="mt-4">
              MailPoint does not use Google user data to develop, improve, or
              train generalized or non-personalized AI/ML models.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              6. Third-Party Services
            </h2>

            <p>
              MailPoint relies on selected third-party infrastructure and
              service providers to operate its features. These providers may
              process information as necessary to provide the services used by
              MailPoint.
            </p>

            <p className="mt-4">Relevant services include:</p>

            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>
                <strong className="text-foreground">Google</strong> — Gmail,
                Google Calendar, Google authentication, and Gemini API
                functionality.
              </li>

              <li>
                <strong className="text-foreground">Groq</strong> — AI inference
                for MailPoint&apos;s AI-assisted functionality.
              </li>

              <li>
                <strong className="text-foreground">
                  Hosting and infrastructure providers
                </strong>{" "}
                — services required to host, secure, and operate MailPoint.
              </li>
            </ul>

            <p className="mt-4">
              MailPoint does not intentionally provide Google user data to third
              parties for advertising or sale.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              7. Data Storage and Retention
            </h2>

            <p>
              MailPoint stores information for as long as reasonably necessary
              to provide the service, maintain application functionality,
              protect the service, comply with legal obligations, and resolve
              disputes.
            </p>

            <p className="mt-4">
              Certain application data, such as email classifications and
              semantic search embeddings, may be retained so that MailPoint can
              provide features without repeatedly processing the same
              information.
            </p>

            <p className="mt-4">
              MailPoint may retain the source text used to generate an email
              embedding because that information is stored with the embedding to
              support the semantic search system.
            </p>

            <p className="mt-4">
              Retention periods may vary depending on the type of information,
              the feature involved, your account status, and applicable legal
              requirements.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              8. Disconnecting Google
            </h2>

            <p>
              You can disconnect your Google account from MailPoint through the
              integration settings provided by the application.
            </p>

            <p className="mt-4">
              You may also revoke MailPoint&apos;s access through your Google
              Account security settings.
            </p>

            <p className="mt-4">
              Disconnecting Google prevents MailPoint from obtaining new data
              through the affected Google integration. Data already stored by
              MailPoint may remain until it is deleted according to the
              applicable deletion and retention procedures described in this
              policy.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              9. Data Deletion
            </h2>

            <p>
              You may request deletion of your MailPoint account and associated
              personal information by contacting us.
            </p>

            <p className="mt-4">
              Where technically and legally applicable, deletion may include
              account information, stored application data, AI classifications,
              search embeddings, stored embedding source text, and other data
              associated with your account.
            </p>

            <p className="mt-4">
              Some information may be retained where required by law, necessary
              for security, fraud prevention, dispute resolution, backups, or
              legitimate technical and operational requirements.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              10. Security
            </h2>

            <p>
              MailPoint uses reasonable technical and organizational measures
              designed to protect information against unauthorized access,
              alteration, disclosure, and destruction.
            </p>

            <p className="mt-4">
              No internet-based service can guarantee absolute security. Users
              should also protect their account credentials and connected
              accounts.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              11. Cookies and Similar Technologies
            </h2>

            <p>
              MailPoint may use cookies, local storage, session mechanisms, or
              similar technologies that are necessary to authenticate users,
              maintain sessions, remember preferences, and operate the
              application.
            </p>

            <p className="mt-4">
              MailPoint does not use Google user data for advertising purposes.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              12. Your Privacy Choices
            </h2>

            <p>
              Depending on your location and applicable law, you may have rights
              regarding access to, correction of, deletion of, or restriction of
              processing of your personal information.
            </p>

            <p className="mt-4">
              You may also disconnect Google integrations or request deletion of
              your MailPoint account by contacting us.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              13. Children&apos;s Privacy
            </h2>

            <p>
              MailPoint is not intended for children under the age required by
              applicable law to independently provide consent to the processing
              of personal information.
            </p>

            <p className="mt-4">
              We do not knowingly collect personal information from children in
              violation of applicable law.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              14. International Processing
            </h2>

            <p>
              MailPoint and its service providers may process information in
              countries other than the country in which you reside. Appropriate
              safeguards will be used where required by applicable law.
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              15. Changes to This Privacy Policy
            </h2>

            <p>
              We may update this Privacy Policy from time to time to reflect
              changes to MailPoint, our processing practices, legal
              requirements, or our services.
            </p>

            <p className="mt-4">
              When material changes are made, we will update the &quot;Last
              updated&quot; date at the top of this policy and provide
              additional notice where required.
            </p>
          </section>

          {/* 16 */}
          <section>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              16. Contact
            </h2>

            <p>
              If you have questions about this Privacy Policy, Google user data,
              AI processing, data deletion, or privacy requests, please contact
              us at:
            </p>

            <p className="mt-4">
              <a
                href="mailto:piyushk.devhub@gmail.com"
                className="text-foreground font-medium underline underline-offset-4"
              >
                piyushk.devhub@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
