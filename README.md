<div align="center">

# AutoDM

Self-hosted Instagram comment-to-DM automation. A fork of [OpenReply](https://github.com/diwenne/openreply).

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)

</div>

Someone comments `LINK` on your reel, and AutoDM sends them a DM with your link. AutoDM watches the comments on your Instagram posts, and when a comment matches a keyword you set, it sends that person a private reply through the official Meta API (or through Zernio). You can also post a public reply under the comment at the same time.

AutoDM is free, MIT-licensed software that runs on your own infrastructure. There is no subscription, no plan cap and no per-DM fee from this project. Hosting and optional provider costs are separate.

> **AutoDM is a fork of [diwenne/openreply](https://github.com/diwenne/openreply)** (MIT, by Diwen Huang, itself forked from [instagram-comment-to-dm](https://github.com/im-anishraj/instagram-comment-to-dm) by Anish Raj). The original copyright notices are kept in [LICENSE](LICENSE); see [NOTICE](NOTICE) for what this fork adds.

What this fork adds on top of OpenReply:

- Email and password sign-in (no email provider needed to get started), with optional password-reset emails over Resend or your own SMTP server.
- An optional owner login from env (`ADMIN_EMAIL` / `ADMIN_PASSWORD`), so a fresh deploy is usable with zero clicks.
- An MCP connector (Settings, *Connect an AI assistant*), so Claude or any MCP client can list your posts, create automations (always switched off) and switch them on.
- DM guide lookup, comment toggles, follow-up messages and other campaign builder options.
- One-click Railway deploy: web, worker and cron services plus Postgres and Redis.

## Why this exists

Comment-to-DM is one feature, but every tool that offers it wants a recurring subscription for it. AutoDM (like AutoDM before it) makes that workflow available as software you can inspect, modify, and host yourself.

AutoDM is built around Meta's official Instagram private replies. It does not scrape, it does not automate a browser, and it never asks for an Instagram password. Instagram’s policies, permissions, messaging windows, and rate limits still apply.

## Features

- Keyword to DM. Match one or many keywords per post, whole-word or partial.
- Optional public reply. Post a visible comment reply on top of the DM.
- DM and Story reply triggers. The same keywords can also fire on an inbound DM, which covers text replies to your Stories, since Instagram delivers those as DMs. That makes `Reply LINK to this Story` work with no post involved. Turn it on per campaign, and subscribe to the `messages` webhook field if you use your own Meta app. Zernio webhook registration is automatic.
- Tracked links. Swap a link for a tracked redirect and see clicks and CTR per campaign.
- Two link buttons. Send up to two tappable link buttons in one DM, each a separate tracked link with its own click stats.
- Follow gate. Optionally require a follow before you hand over the link. The DM asks the commenter to follow and tap a button; on tap, AutoDM checks Meta's `is_user_follow_business` flag and only sends the link once they follow, re-prompting until then. It fails open (sends the link anyway) when Instagram does not return follow status, so a real follower is never trapped.
- Personalization. Use `{username}` in your message to greet the commenter by name.
- Per-account rate limiting. Stays under Meta's documented cap of 750 private replies per hour, and queues the overflow instead of dropping it.
- Multiple Instagram accounts. Connect several professional accounts under one workspace, each with its own limits.
- Workspaces and roles. Owner, admin, and member roles with invite links, useful if you run this for clients.
- Campaign templates. Start from a preset instead of a blank form.
- Inbox. Read your Instagram DM conversations and reply from the dashboard, inside Meta's 24-hour messaging window. Cached so it loads instantly on repeat visits.
- DM logs. Every send, skip, and failure is logged with a reason.
- Self-comment filtering. Your own comments never trigger a reply, since Meta rejects DMing yourself anyway.

## How it works

1. Someone comments on your Instagram post or reel, or DMs you, or replies to your Story.
2. Your connection provider (direct Meta or Zernio) delivers the event to your AutoDM instance.
3. AutoDM checks the text against your active campaigns.
4. On a keyword match, it queues a job.
5. A background worker sends the private reply, and the public reply if you enabled one.

The web app receives the webhook and serves the dashboard. A separate worker process does the sending, because the send has to survive rate limits and retries. Both talk to the same Postgres and Redis.

## Quick start

1. **Choose your Instagram connection.** [Zernio](docs/zernio.md) avoids setting up your own Meta app (a paid third-party service). Or follow the [direct Meta setup](docs/setup.md#the-meta-app).
2. **Deploy the web app, the worker and the cron service** with PostgreSQL, Redis and a public HTTPS URL. The fastest route is [Railway](#deploy-on-railway).
3. **Sign in, connect an Instagram Business or Creator account** in Settings, create an automation, and test a keyword comment from another account.

Read [docs/setup.md](docs/setup.md) for the complete walkthrough. Check [Zernio's feature limits](docs/zernio.md#feature-availability) before choosing.

## Deploy on Railway

Use the Railway template if one has been published for this repo, or build it yourself in a new Railway project. Either way you end up with five services from the one repo:

| Service | Source | What it does |
| --- | --- | --- |
| `web` | this repo, `Dockerfile` | Dashboard, API, webhooks. Runs `prisma migrate deploy` on every start, so a fresh database needs no manual step. Give it a public domain. |
| `worker` | this repo, `Dockerfile.worker` | Sends the DMs from the queue. No domain. |
| `cron` | this repo, `Dockerfile.cron` | Calls `/api/cron/*` on a timer: Instagram token refresh, attaching campaigns to new reels, follower snapshots. No domain. |
| `Postgres` | Railway Postgres | Database. |
| `Redis` | Railway Redis | Queue. |

Railway builds `Dockerfile` by default. For `worker` and `cron`, set the service variable `RAILWAY_DOCKERFILE_PATH` to `Dockerfile.worker` and `Dockerfile.cron`. (Railway's `railway.json` config-as-code is deprecated, so this repo does not rely on it.)

### Variables

`web`:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `NEXTAUTH_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` (or your custom domain, with `https://`) |
| `NEXTAUTH_SECRET` | a random secret, e.g. `${{secret(48)}}` |
| `CRON_SECRET` | a random secret, e.g. `${{secret(48)}}` |
| `ENCRYPTION_KEY` | exactly 64 hex characters: `${{secret(64, "abcdef0123456789")}}` |
| `ADMIN_EMAIL` | your email, the owner login |
| `ADMIN_PASSWORD` | a long password, e.g. `${{secret(24)}}` (read it back from the Variables tab) |
| `ALLOWED_EMAILS` | `${{ADMIN_EMAIL}}` to keep the instance private. Add teammates comma separated, or leave unset to allow open sign-up. |
| `META_GRAPH_API_VERSION` | `v25.0` |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `FACEBOOK_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN` | Direct Meta connection only, see below. Leave unset if you use Zernio. |
| `RESEND_API_KEY` + `EMAIL_FROM`, or `EMAIL_SERVER` | Optional, password-reset emails. |

`worker`:

| Variable | Value |
| --- | --- |
| `RAILWAY_DOCKERFILE_PATH` | `Dockerfile.worker` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `NEXTAUTH_URL` | `${{web.NEXTAUTH_URL}}` |
| `ENCRYPTION_KEY` | `${{web.ENCRYPTION_KEY}}` (must match web exactly) |
| `META_GRAPH_API_VERSION`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `FACEBOOK_APP_SECRET` | `${{web.<same name>}}` |
| `AI_VOICE_REPLIES`, `ANTHROPIC_API_KEY`, `AI_VOICE_GUIDE` | Optional, AI-reworded replies. |

`cron`:

| Variable | Value |
| --- | --- |
| `RAILWAY_DOCKERFILE_PATH` | `Dockerfile.cron` |
| `CRON_BASE_URL` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
| `CRON_SECRET` | `${{web.CRON_SECRET}}` |

### Instagram: Zernio or your own Meta app

- **Zernio:** nothing to set in Railway. After signing in, paste your Zernio API key in Settings. See [docs/zernio.md](docs/zernio.md).
- **Your own Meta app:** create a Business app at [developers.facebook.com](https://developers.facebook.com/apps), add the *Instagram* product (API setup with Instagram Login), and copy the Instagram app ID and secret into `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` and the app secret from *App settings, Basic* into `FACEBOOK_APP_SECRET`. Then register:
  - OAuth redirect URI: `https://<your-domain>/api/instagram/callback`
  - Webhook callback URL: `https://<your-domain>/api/webhook`, verify token = your `WEBHOOK_VERIFY_TOKEN`, subscribed fields `comments` and `messages`.

  Step-by-step, with screenshots of where each value lives: [docs/setup.md](docs/setup.md#the-meta-app).

**Meta app review.** In Development mode your app only works for Instagram accounts that have a role on the app (add yourself as an Instagram tester and accept the invite). That is enough to run AutoDM for your own account. Serving accounts you don't own needs Meta's App Review and Advanced Access; [META_APP_REVIEW.md](META_APP_REVIEW.md) has the permissions, screencast plan and reviewer notes.

### After the first deploy

1. Open the `web` domain and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. Settings: connect Instagram (Zernio key, or *Connect Instagram* for Meta).
3. Automations: create one, switch it on, comment the keyword from a different account. The DM should arrive within a minute and show in DM Logs.
4. `/api/health` reports database, Redis and worker heartbeat.

### Run it locally

```bash
git clone <your fork of this repo> autodm
cd autodm
npm install
cp .env.example .env      # then fill in the values, see docs/setup.md
docker-compose up -d      # starts Postgres and Redis
npm run db:generate
npm run db:migrate
npm run dev               # web app on http://localhost:3000
npm run worker            # in a second terminal, this sends the DMs
```

Two processes, always. `npm run dev` serves the app and receives webhooks. `npm run worker` is what actually sends the messages. If comments come in and no DM ever arrives, the worker is the first thing to check.

Full environment variables and other hosting layouts are in [docs/setup.md](docs/setup.md).

## Set it up with your AI assistant

If you use Claude Code, Cursor, or a similar tool, an assistant can walk you through either connection path. There is a ready-made prompt in the [Set it up with an AI assistant](docs/setup.md#set-it-up-with-an-ai-assistant) section of the setup guide. Paste it into your assistant inside a clone of this repo, choose your provider before configuring any Meta secrets, and it will walk you through connecting Instagram and going live.

## Tech stack

- Next.js 16 and React 19 for the web app and API routes
- Prisma 7 with PostgreSQL
- BullMQ on Redis for the send queue and the worker
- Auth.js (NextAuth) with email and password sign-in
- Tailwind CSS for the interface
- The official Instagram API with Instagram Login

For the complete stack — application libraries, the two runtime processes, and the free services this runs on (Vercel, Neon, Redis Cloud, an Oracle Cloud always-free VM for the worker, Resend, Meta) — see [docs/stack.md](docs/stack.md).

## Contributing

Issues and pull requests are welcome. If you hit a Meta quirk that is not in the setup guide, a PR that documents it is worth as much as a code fix, because that is where everyone loses time.

See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## Credits

AutoDM is a fork of [OpenReply](https://github.com/diwenne/openreply), built and maintained by Diwen Huang ([@diwenne](https://github.com/diwenne)), with contributions from the OpenReply community. OpenReply was initially forked from [instagram-comment-to-dm](https://github.com/im-anishraj/instagram-comment-to-dm) by [Anish Raj](https://github.com/im-anishraj). Both are MIT licensed. If AutoDM is useful to you, star [the original repo](https://github.com/diwenne/openreply) too.

## License

MIT. See [LICENSE](LICENSE).
