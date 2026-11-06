# Helpdesk

An employee support system with a two-field ticket form: **name** and **issue**.

Employee page: https://helpdesk-simple-employee-support.windycrust.chatgpt.site/employee

Admin page: https://helpdesk-simple-employee-support.windycrust.chatgpt.site/admin

The deployed app is private. Repository visibility does not grant access to the app.

## Features

- Submit tickets and receive a unique reference.
- Employees see their own tickets and conversations.
- Separate password-protected admin page with a shared ticket inbox.
- Comfortable dark blue theme throughout both portals.
- Database-backed admin sessions, sign-out, and login cooldowns.
- Set status, priority, and assignee; search and filter tickets.
- Exchange replies and export tickets to CSV.
- Persistent shared storage with Cloudflare D1.
- Responsive interface and keyboard-accessible ticket details.

## Project structure

| Path | Purpose |
| --- | --- |
| `worker/index.js` | Worker API and embedded HTML, CSS, and browser JavaScript |
| `drizzle/0000_helpdesk.sql` | Tickets and conversation schema |
| `drizzle/0001_admin_access.sql` | Admin accounts, sessions, and login attempt schema |
| `drizzle/meta/_journal.json` | Migration journal |
| `.openai/hosting.json` | Existing Sites project and D1 binding declaration |
| `build.mjs` | Creates deployable files in `dist/` |
| `test.mjs` | Ticket lifecycle, authorization, and browser script syntax checks |
| `.github/workflows/checks.yml` | Automated tests and build |

## Run locally (127.0.0.1:8787)

Use Node.js 24 or newer. Production secrets and production D1 data are not copied to
your computer. Complete this setup before trying to sign in locally:

```sh
npm install
npm run setup:local
npm run dev
```

At the setup prompts, accept `Mohamed ashraf` as the username and enter your chosen
admin password. Password input is hidden. To use the same password as the hosted app,
enter that password here. Setup applies the database migrations and writes a salted
hash to the ignored `.dev.vars` file. No password is committed to GitHub.

Employee page: http://127.0.0.1:8787/employee

Admin page: http://127.0.0.1:8787/admin

`npm run dev` now applies pending database migrations before starting, so a missing
admin table cannot silently reach the sign-in screen. Local server failures display
their diagnostic details on loopback addresses only.

Restart `npm run dev` after changing `.dev.vars`. Run `npm run setup:local` again to
configure a different local password. Local and production ticket databases are
separate. The Wrangler configuration is for local development; deploy the hosted
Sites app through Sites rather than running `wrangler deploy` with local settings.

## Checks

```sh
npm test
npm run build
```

Tests use an in-memory SQLite database and cover ticket privacy, administrator login,
session revocation, password rotation, login cooldowns, and browser script syntax.

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

The employee portal is at `/employee` (also `/`). It requires only a name and issue
in the ticket form. Sites identity keeps employee tickets private when available. Otherwise a secure,
HTTP-only browser cookie identifies the employee without an extra sign-in. In this
browser-only mode, use the same browser to track tickets; clearing cookies loses
access to those tickets. The admin portal is at `/admin`, with an additional username/password sign-in.
No visitor becomes an administrator automatically.

Configure these server-side secrets in the hosting platform:

- `ADMIN_USERNAME`: administrator username.
- `ADMIN_PASSWORD_HASH`: `salt:hex-digest` using PBKDF2-HMAC-SHA256, 100,000 iterations,
  a UTF-8 encoded salt, and a 32-byte derived key. Use a random salt for each password.

The deployment's configured credentials are not in this repository. Never commit the
password, its hash, or live session cookies. Tests use separate fictional credentials.

Runtime secrets provision the administrator hash into `admin_accounts` when available.
Subsequent logins verify the database account directly, so a provisioned deployment
does not depend on secrets being injected into every request.
The server issues an eight-hour `HttpOnly`, `Secure`, `SameSite=Strict` cookie. Only
its SHA-256 hash is stored in `admin_sessions`. Sessions are bound to the signed-in Sites visitor or browser identity and credential version, and are revoked by sign-out or password-hash
rotation. Five failed login attempts cause a 15-minute cooldown per signed-in visitor, or per source IP when no platform identity is supplied.

Employee API routes always return only that employee's tickets, even when an admin
cookie is present. Admin API routes require a valid admin session. Assignment is a
text field and does not grant administrator privileges. There is one configured
administrator account and no role-management screen.

Sites' authentication boundary may provide `oai-authenticated-user-id`; admin password sign-in works without it. Keep the site
private and manage employee access in the platform's access settings. If hosting
outside Sites, use a trusted authentication gateway that strips visitor-supplied
identity headers and injects verified identity. Do not expose the Worker directly
while trusting arbitrary incoming identity headers.

## Database

D1 is bound as `DB`. Apply the SQL migrations in journal order. The first migration
creates tickets and conversations; the second adds administrator accounts, hashed
sessions, and login attempt records. Existing ticket records are preserved.
No schema is created during request handling. The legacy `settings` table remains for
migration compatibility and no longer grants administrator access.

## API

All API routes require authenticated identity. Write requests also require a matching
same-origin `Origin` header.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/session` | Current identity and admin-session state |
| POST | `/api/admin/login` | Sign in with `username` and `password` |
| POST | `/api/admin/logout` | Revoke the current admin session |
| GET | `/api/tickets` | Current employee's tickets |
| POST | `/api/tickets` | Create with `name` and `issue` |
| GET | `/api/tickets/:id` | Own ticket details and conversation |
| POST | `/api/tickets/:id/messages` | Reply to an owned ticket with `body` |
| GET | `/api/admin/tickets` | All tickets; admin session required |
| GET | `/api/admin/tickets/:id` | Any ticket's details and conversation |
| PATCH | `/api/admin/tickets/:id` | Update `status`, `priority`, `assignee` |
| POST | `/api/admin/tickets/:id/messages` | Support reply with `body` |

Statuses: `Open`, `In progress`, `Waiting`, `Resolved`.
Priorities: `Low`, `Normal`, `High`, `Urgent`.

## Current scope

Includes persistent tickets and replies. Email notifications, attachments, multiple
support roles, and automatic live refresh are not implemented. Use Refresh to reload
the ticket list. Runtime ticket data is stored in D1 and is not part of this repository.
