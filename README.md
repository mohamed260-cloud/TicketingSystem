# Helpdesk

An employee support system with a two-field ticket form: **name** and **issue**.

Live app: https://helpdesk-simple-employee-support.windycrust.chatgpt.site

The deployed app is private. Repository visibility does not grant access to the app.

## Features

- Submit tickets and receive a unique reference.
- Employees see their own tickets and conversations.
- Support administrator sees all tickets in the team inbox.
- Set status, priority, and assignee; search and filter tickets.
- Exchange replies and export tickets to CSV.
- Persistent shared storage with Cloudflare D1.
- Responsive interface and keyboard-accessible ticket details.

## Project structure

| Path | Purpose |
| --- | --- |
| `worker/index.js` | Worker API and embedded HTML, CSS, and browser JavaScript |
| `drizzle/0000_helpdesk.sql` | Database schema migration |
| `drizzle/meta/_journal.json` | Migration journal |
| `.openai/hosting.json` | Existing Sites project and D1 binding declaration |
| `build.mjs` | Creates deployable files in `dist/` |
| `test.mjs` | Ticket lifecycle, authorization, and browser script syntax checks |
| `.github/workflows/checks.yml` | Automated tests and build |

## Requirements and checks

Use Node.js 24 or newer. There are no npm dependencies to install.

```sh
npm test
npm run build
```

Tests use an in-memory SQLite database and exercise authentication, ticket creation,
employee isolation, administrator updates, and replies. They also compile the browser
script. They do not cover browser layout or a hosted end-to-end session.

## Hosting

This application runs as an ES module Worker with a D1 binding named `DB`. The build
produces `dist/server/index.js`, copies hosting metadata, and includes the migrations.
It is designed for the existing ChatGPT Sites deployment, not GitHub Pages: GitHub
Pages cannot execute the API or provide the database.

For Sites publication, push the source to the site's configured source repository,
then use the Sites save/deploy workflow with an archive containing these paths:

```sh
npm run build
tar -czf helpdesk-deploy.tar.gz .openai dist/server drizzle
```

Keep the archive outside the source repository, or remove it after publication.
The existing Sites source repository and this GitHub repository are separate remotes;
a push to GitHub alone does not redeploy the app. Database migrations must be applied
before serving the Worker. Never put credentials in source control.

## Identity and administrator access

The API trusts identity supplied by the Sites authentication boundary through
`oai-authenticated-user-id` and optional display headers. Keep the site private and
use the platform's access settings to admit employees. Employees do not type account
information into the ticket form, but platform sign-in is required to identify them.

On a fresh database, the first authenticated visitor becomes the support administrator.
The owner should open the private app before granting employee access. That role is
stored in the `settings` table. Other visitors can create tickets and access only their
own records. Assignment is a text field; it does not grant administrator privileges.
There is currently one administrator account and no role-management screen.

If deploying outside Sites, provide a trusted authentication gateway that strips
visitor-supplied identity headers and injects verified identity. Do not expose the
Worker directly while trusting arbitrary incoming identity headers.

## API

All API routes require authenticated identity. Write requests also require a matching
same-origin `Origin` header.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/session` | Current identity and administrator flag |
| GET | `/api/tickets` | Own tickets, or all tickets for the administrator |
| POST | `/api/tickets` | Create with `name` and `issue` |
| GET | `/api/tickets/:id` | Ticket details and conversation |
| PATCH | `/api/tickets/:id` | Administrator updates `status`, `priority`, `assignee` |
| POST | `/api/tickets/:id/messages` | Add a reply with `body` |

Statuses: `Open`, `In progress`, `Waiting`, `Resolved`.
Priorities: `Low`, `Normal`, `High`, `Urgent`.

## Current scope

Includes persistent tickets and replies. Email notifications, attachments, multiple
support roles, and automatic live refresh are not implemented. Use Refresh to reload
the ticket list. Runtime ticket data is stored in D1 and is not part of this repository.
