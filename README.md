# MailPoint

MailPoint is an AI-powered communication workspace that brings Gmail and Google Calendar into a single interface. The project is designed around the user's communication workflow rather than treating email and calendar as completely separate applications.

The core idea is simple:

> **User intent → coordinated Gmail + Calendar workflow → result**

For example, a request such as scheduling a meeting and sending a confirmation can involve both Google Calendar and Gmail while remaining part of one workflow.

## Project Status

MailPoint is under active development.

The current foundation includes:

- Next.js + TypeScript application
- PostgreSQL database
- Drizzle ORM
- Better Auth
- Email/password authentication
- Google OAuth
- Gmail integration through Corsair
- Google Calendar integration through Corsair
- tRPC API layer
- Tailwind CSS v4
- Environment-based configuration

Planned capabilities include AI-driven workflows, Corsair MCP integration, real-time webhooks, intelligent/semantic search, email prioritization, and keyboard-first productivity features. These should be treated as roadmap items unless implemented in the repository.

## Why MailPoint?

Gmail and Google Calendar are powerful, but many communication workflows require switching between applications and performing several manual steps.

MailPoint aims to reduce:

- Application switching
- Repetitive actions
- Manual coordination between email and calendar
- Difficulty finding relevant communication
- The number of steps required to complete communication tasks

MailPoint is not intended to replace Gmail or Google Calendar. It provides a custom interaction layer on top of those services.

## Core Concept

```text
                         MailPoint
                            |
             +--------------+--------------+
             |                             |
           Gmail                        Calendar
             |                             |
             +--------------+--------------+
                            |
                       AI / Search
```

The long-term product direction is to make email and calendar part of one communication workflow.

## Current Features

### Authentication

MailPoint uses Better Auth for application authentication.

Currently supported:

- Email/password signup
- Email/password login
- Google OAuth
- Session persistence
- PostgreSQL-backed Better Auth data through the Drizzle adapter

The Google OAuth flow is also used to authorize access to Google services required by the application.

### Gmail

The project includes Gmail operations exposed through the application's API layer.

The current implementation includes Gmail search functionality and uses Corsair's Gmail integration.

### Google Calendar

The project includes Google Calendar integration through Corsair.

Calendar functionality is part of the broader MailPoint communication workflow and is intended to work alongside Gmail rather than as an isolated calendar application.

## Planned Features

The project documentation defines the following future direction.

### AI Agent

The AI agent is intended to understand natural-language communication requests and execute controlled actions through Gmail and Google Calendar.

Example:

```text
"Schedule a meeting with Rahul tomorrow at 11 AM
and send him a confirmation email."
```

Potential workflow:

```text
User Request
     |
  AI Agent
     |
 Corsair / Tools
   /        \
Gmail      Calendar
   \        /
    Workflow
       |
     Result
```

### Corsair MCP

The planned architecture uses Corsair MCP as an action layer for AI-driven Gmail and Calendar operations.

The goal is to allow the AI agent to perform multi-step workflows instead of only generating text.

Sensitive actions should be subject to appropriate confirmation and authorization controls.

### Real-Time Updates

The project roadmap includes Corsair webhooks for reacting to Gmail and Calendar changes without relying entirely on polling.

```text
Gmail / Calendar
       |
    Corsair
       |
    Webhook
       |
   MailPoint
       |
       UI
```

Ngrok is planned for local webhook development.

### Intelligent Search

The roadmap includes combining traditional keyword search with semantic/vector search.

```text
User Query
    |
 +--+-----------+
 |              |
Keyword       Semantic
Search         Search
 |              |
 +------+-------+
        |
 Relevant Results
```

The planned semantic-search architecture uses vector embeddings with PostgreSQL.

### Email Intelligence

Planned email intelligence includes:

- LLM-based email priority
- Priority categories
- Important-email detection
- Priority UI

### Keyboard-First Productivity

Planned productivity improvements include:

- Keyboard shortcuts
- Quick compose
- Quick search
- Quick calendar actions
- AI shortcuts
- Command-style actions
- UI performance improvements

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js | Full-stack React application |
| Language | TypeScript | Application development |
| UI | React | Client-side interface |
| Styling | Tailwind CSS v4 | Styling and utility classes |
| Authentication | Better Auth | Email/password and OAuth authentication |
| Auth Adapter | Better Auth Drizzle Adapter | Better Auth persistence |
| Database | PostgreSQL | Persistent application/authentication data |
| ORM | Drizzle ORM | Database access and schema management |
| API | tRPC | Type-safe server/client API layer |
| Google Integration | Corsair | External-service integration layer |
| Email | Gmail API / Corsair Gmail | Gmail operations |
| Calendar | Google Calendar API / Corsair Google Calendar | Calendar operations |
| Validation | Zod | Runtime/schema validation |
| Data Fetching | TanStack React Query | Client-side server-state management |
| Serialization | SuperJSON | tRPC data serialization |
| Package Manager | pnpm | Dependency management |

The current package manifest confirms the main application dependencies and development tooling. fileciteturn15file2

## Architecture

At a high level:

```text
                        Browser
                           |
                    Next.js Application
                           |
             +-------------+-------------+
             |                           |
       Better Auth                     tRPC
             |                           |
             |                    Server Procedures
             |                           |
             |              +------------+------------+
             |              |                         |
             |           PostgreSQL                Corsair
             |              |                    /           \
             |           Drizzle                Gmail      Calendar
             |              |
             +--------------+
```

### Authentication Layer

```text
Browser
   |
Better Auth Client
   |
/api/auth/[...all]
   |
Better Auth Server
   |
Drizzle Adapter
   |
PostgreSQL
```

Google OAuth additionally involves Google:

```text
User
 |
Continue with Google
 |
Better Auth
 |
Google OAuth
 |
Google Callback
 |
Better Auth
 |
PostgreSQL
 |
Authenticated Session
```

### Application API

MailPoint uses tRPC for type-safe communication between the frontend and server.

The current project exposes Gmail functionality through tRPC procedures. Development logs show the `gmail.searchEmails` procedure being called through `/api/trpc/gmail.searchEmails`. fileciteturn15file6

## Google Authorization

MailPoint uses Google OAuth through Better Auth.

The tested Google account authorization includes Google identity scopes plus Gmail and Calendar permissions. The currently observed authorization scope set includes:

```text
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/gmail.labels
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/calendar
```

These scopes are visible in the successful Better Auth account data from the development logs. fileciteturn15file15turn15file17

Google OAuth uses the Better Auth callback endpoint:

```text
/api/auth/callback/google
```

The development logs show the Google callback completing successfully and the application returning to `/`. fileciteturn15file19

## Database

MailPoint uses PostgreSQL with Drizzle ORM.

The project uses the Better Auth Drizzle adapter for authentication persistence.

Better Auth data includes models such as:

- User
- Account
- Session
- Verification

The `verification` model is used by Better Auth during OAuth state/code-verifier handling. Development logs show Better Auth creating and querying verification records during the Google OAuth flow. fileciteturn15file6turn15file18

Google account information is persisted through the Better Auth `account` model. fileciteturn15file15

## Database Commands

The project defines these database scripts:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

Their purposes are:

| Command | Purpose |
|---|---|
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:push` | Push schema changes |
| `pnpm db:studio` | Open Drizzle Studio |

These scripts are defined in the project's `package.json`. fileciteturn15file2

## Project Structure

The project follows a Next.js application structure with server-side integration code separated from application UI.

A representative structure is:

```text
MailPoint/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   └── trpc/
│   │   ├── login/
│   │   ├── register/
│   │   └── ...
│   ├── lib/
│   │   └── auth-client.ts
│   ├── server/
│   │   ├── db/
│   │   └── lib/
│   │       └── auth.ts
│   └── ...
├── drizzle/
├── public/
├── package.json
├── drizzle.config.ts
├── postcss.config.mjs
└── ...
```

The exact repository contents should be treated as the source of truth when adding new modules.

## Authentication Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create a local `.env` file containing the credentials required by the application.

Do not commit secrets to Git.

The authentication configuration uses values for:

```text
BETTER_AUTH_URL
BETTER_AUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

The application also requires its database and Google/Corsair configuration according to the current environment configuration.

Use the repository's environment-validation/configuration code as the authoritative source for the complete list of variables.

### 3. Database

Ensure PostgreSQL is available and configured.

Then run:

```bash
pnpm db:migrate
```

or the appropriate Drizzle command for the current schema state.

### 4. Start the application

```bash
pnpm dev
```

The development server runs on:

```text
http://localhost:3000
```

## Google Cloud Setup

To enable Google OAuth:

1. Create or select a Google Cloud project.
2. Configure the OAuth consent screen.
3. Configure the required Google API access.
4. Create OAuth client credentials.
5. Configure the application's authorized origin.
6. Configure the Better Auth callback URL.
7. Put the client ID and secret in `.env`.

For local development, the callback route is:

```text
http://localhost:3000/api/auth/callback/google
```

The exact OAuth configuration should match the URL configured in `BETTER_AUTH_URL`.

## Development Commands

The current `package.json` defines:

| Command | Purpose |
|---|---|
| `pnpm dev` | Start Next.js development server with Turbopack |
| `pnpm build` | Build the production application |
| `pnpm start` | Start the production application |
| `pnpm preview` | Build and start the production application |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run Next.js linting |
| `pnpm lint:fix` | Automatically fix lint issues |
| `pnpm check` | Run lint and TypeScript checks |
| `pnpm format:check` | Check formatting |
| `pnpm format:write` | Format project files |

These commands are defined in `package.json`. fileciteturn15file2

## Verification

Before committing changes, run:

```bash
pnpm typecheck
```

For the full configured check:

```bash
pnpm check
```

A successful TypeScript check should finish without errors.

Authentication can be manually verified through:

1. `/register`
2. Email/password signup
3. `/login`
4. Email/password login
5. Continue with Google
6. Google OAuth callback
7. Authenticated application access

The current development logs confirm successful email signup/login and successful Google OAuth callback flows. fileciteturn15file6turn15file19

## Gmail Request Flow

The current Gmail architecture is exposed through tRPC.

```text
MailPoint UI
    |
tRPC Client
    |
/api/trpc
    |
Gmail Router
    |
Corsair Gmail Integration
    |
Gmail
```

A current development request looks like:

```text
gmail.searchEmails
```

and returns through the tRPC endpoint. fileciteturn15file6

## Calendar Request Flow

The intended Calendar architecture follows the same integration pattern:

```text
MailPoint UI
    |
tRPC / Server Logic
    |
Corsair Google Calendar
    |
Google Calendar API
    |
MailPoint UI
```

The project's architecture documentation identifies Google Calendar API and Corsair as the Calendar integration layer. fileciteturn15file7

## AI + MCP Architecture

The project roadmap extends MailPoint beyond a traditional API client.

The intended architecture is:

```text
User
 |
Natural Language Request
 |
AI Agent
 |
Corsair MCP
 |
+-----------+-----------+
|                       |
Gmail                  Calendar
|                       |
+-----------+-----------+
            |
        Workflow
            |
          Result
```

This is intended to support multi-step operations such as:

```text
Search an email
      ↓
Understand context
      ↓
Check calendar
      ↓
Create meeting
      ↓
Invite attendee
      ↓
Send confirmation
```

The project documentation explicitly describes AI as an action layer rather than only a text-generation feature. fileciteturn15file7

## Real-Time Architecture

The planned real-time architecture uses Corsair webhooks:

```text
Gmail / Calendar
       |
    Corsair
       |
    Webhook
       |
   MailPoint
       |
       UI
```

The goal is to react to external changes instead of relying exclusively on repeated polling. fileciteturn15file7

## Intelligent Search

The planned search system combines traditional keyword search with semantic search:

```text
                 User Query
                     |
          +----------+----------+
          |                     |
     Keyword Search       Semantic Search
          |                     |
          +----------+----------+
                     |
              Ranked Results
```

The planned semantic layer uses vector embeddings with PostgreSQL. fileciteturn15file7

## Security

MailPoint handles private communication data, so security is a core architectural concern.

Important areas include:

- OAuth credential protection
- Secure session management
- Server-side handling of sensitive credentials
- User/data isolation
- Least-privilege Google permissions
- Webhook authentication and validation
- Controlled AI tool execution
- Confirmation for sensitive external actions
- Never committing secrets to source control

The project documentation explicitly identifies authentication, data isolation, synchronization, API failures, AI errors, external actions, search, and webhook consistency as major engineering concerns. fileciteturn15file14

## Roadmap

The documented project roadmap is organized into the following phases:

### Phase 1 — Foundation

- Project setup
- Gmail integration
- Calendar integration
- Authentication
- Database foundation

### Phase 2 — Core UI

- Email interface
- Calendar interface

### Phase 3 — Unified Experience

- Connected Gmail + Calendar workflows

### Phase 4 — AI + MCP

- AI agent
- Corsair MCP
- Multi-step Gmail + Calendar actions

### Phase 5 — Webhooks

- Real-time Gmail updates
- Real-time Calendar updates

### Phase 6 — Intelligence

- Email priority
- Advanced search
- Embeddings
- Semantic search

### Phase 7 — Productivity

- Keyboard shortcuts
- Quick compose
- Quick search
- Quick calendar actions
- AI shortcuts
- Performance improvements

### Phase 8 — Stabilization

- Workflow testing
- Authentication testing
- AI/MCP testing
- Webhook testing
- Security hardening
- Database/API/UI optimization

### Phase 9 — Final Release

- Bug fixing
- Production deployment
- Documentation
- Screenshots
- Demo workflow
- Presentation

This roadmap is derived from the project's architecture/timeline documentation. fileciteturn15file9

## Engineering Challenges

MailPoint is more than a CRUD application because it combines several systems with different failure modes.

### Authentication

Users must securely authenticate and authorize access to Google services.

### Data Isolation

One user's communication data must never be exposed to another user.

### Synchronization

Application state must remain consistent with external Google services.

### API Reliability

External Gmail and Calendar requests can fail or become temporarily unavailable.

### AI Reliability

AI-generated intent can be incorrect, so tool execution needs controlled boundaries.

### External Side Effects

Sending an email or creating a meeting changes real-world state and therefore requires careful authorization and, where appropriate, confirmation.

### Search

Large amounts of communication data need to remain searchable and useful.

### Real-Time Events

Webhook processing must avoid duplicate or inconsistent state.

These engineering challenges are part of the project's documented design rationale. fileciteturn15file14

## Product Positioning

MailPoint should not be positioned as claiming to invent AI email, AI agents, MCP, calendar integration, or semantic search. Existing products already demonstrate these capabilities.

The project's differentiation is the **workflow-oriented combination**:

```text
                MailPoint
                    |
       +------------+------------+
       |            |            |
     Gmail       Calendar       AI
       |            |            |
       +------------+------------+
                    |
                 Search
                    |
             Real-Time Events
                    |
                Workflows
```

The intended positioning is:

> **A unified AI-powered communication workspace that reduces fragmentation between email, calendar, search, and communication workflows.**

The market research explicitly recommends positioning MailPoint around this workflow-centered approach rather than claiming feature-level novelty. fileciteturn15file13

## License

License information is not currently specified in the project documentation.

---

## Project Vision

MailPoint is ultimately intended to move communication from an application-centric model:

```text
Open Gmail
   ↓
Perform action
   ↓
Open Calendar
   ↓
Perform action
```

toward an intent-centric model:

```text
User Intent
     ↓
   MailPoint
     ↓
Gmail + Calendar + AI + Search
     ↓
Completed Workflow
```

The core engineering challenge is not simply connecting APIs. It is building a reliable, secure system that can coordinate those services around what the user is actually trying to accomplish.
