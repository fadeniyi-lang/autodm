# Railway template: what to enter

This is the checklist for creating the AutoDM template in Railway's dashboard (Workspace, Templates, *New Template*). Railway's template composer is a canvas of services, each with a source, settings and variables. Enter exactly what is below.

Notes before you start:

- Railway's `railway.json` / `railway.toml` config-as-code is deprecated (existing files stop working on 1 December 2026, and new services cannot opt in), so this repo ships **no** Railway config file. Everything is set in the template itself.
- The service names matter: the worker and cron variables reference `web`, `Postgres` and `Redis` by name. Keep them exactly as written, or update the references.
- `${{secret(...)}}` values are generated once per deploy. References like `${{web.ENCRYPTION_KEY}}` copy the value from another service, so web and worker always match.

## Services

| # | Name | Type | Source | Public domain | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `Postgres` | Database | Railway PostgreSQL | No | Default settings. |
| 2 | `Redis` | Database | Railway Redis | No | Default settings. |
| 3 | `web` | GitHub repo | `<owner>/autodm`, branch `main`, root `/` | **Yes**, generate a Railway domain (port `3000`) | Builds `Dockerfile`. Its start command runs `prisma migrate deploy` then `next start`, so no pre-deploy command is needed. Leave *Custom Start Command* empty. |
| 4 | `worker` | GitHub repo | same repo and branch | No | Builds `Dockerfile.worker` via the `RAILWAY_DOCKERFILE_PATH` variable. Leave *Custom Start Command* empty. |
| 5 | `cron` | GitHub repo | same repo and branch | No | Builds `Dockerfile.cron` (a small Alpine image) via `RAILWAY_DOCKERFILE_PATH`. |

Optional settings worth setting on `web`, `worker` and `cron`: *Restart policy* `On failure`. Do **not** set a healthcheck path on `web` from the start: `/api/health` returns an error until the worker has sent its first heartbeat, which can fail the first deploy.

## Variables

Legend: **Generated** = Railway creates it at deploy time. **Reference** = copied from another service. **User** = the person deploying fills it in (mark these as required or optional in the template, and paste the description shown here). **Fixed** = a constant default.

### `web`

| Variable | Kind | Template value | Description to show the deployer |
| --- | --- | --- | --- |
| `DATABASE_URL` | Reference | `${{Postgres.DATABASE_URL}}` | |
| `REDIS_URL` | Reference | `${{Redis.REDIS_URL}}` | |
| `NEXTAUTH_URL` | Reference | `https://${{RAILWAY_PUBLIC_DOMAIN}}` | Your app's public URL. Change it to `https://your-domain` if you add a custom domain. |
| `NEXTAUTH_SECRET` | Generated | `${{secret(48)}}` | |
| `CRON_SECRET` | Generated | `${{secret(48)}}` | |
| `ENCRYPTION_KEY` | Generated | `${{secret(64, "abcdef0123456789")}}` | Encrypts Instagram tokens. Never change it after the first deploy. |
| `ADMIN_EMAIL` | User, required | *(empty)* | Your email. This is your login. |
| `ADMIN_PASSWORD` | Generated | `${{secret(24)}}` | Your login password. Read it in the `web` service's Variables tab after deploy, or replace it with your own. |
| `ALLOWED_EMAILS` | Reference | `${{ADMIN_EMAIL}}` | Who may sign up and sign in. Add teammates comma separated, or delete to allow open sign-up. |
| `META_GRAPH_API_VERSION` | Fixed | `v25.0` | |
| `INSTAGRAM_APP_ID` | User, optional | *(empty)* | Only for a direct Meta connection. Leave empty if you will use Zernio. |
| `INSTAGRAM_APP_SECRET` | User, optional | *(empty)* | Only for a direct Meta connection. |
| `FACEBOOK_APP_SECRET` | User, optional | *(empty)* | Only for a direct Meta connection. Verifies Meta's webhook signatures. |
| `WEBHOOK_VERIFY_TOKEN` | Generated | `${{secret(32)}}` | Paste this into Meta's webhook settings if you use your own Meta app. |
| `RESEND_API_KEY` | User, optional | *(empty)* | Password-reset emails through Resend. |
| `EMAIL_FROM` | User, optional | *(empty)* | Sender for password-reset emails, e.g. `AutoDM <login@yourdomain.com>`. |

### `worker`

| Variable | Kind | Template value |
| --- | --- | --- |
| `RAILWAY_DOCKERFILE_PATH` | Fixed | `Dockerfile.worker` |
| `DATABASE_URL` | Reference | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | Reference | `${{Redis.REDIS_URL}}` |
| `NEXTAUTH_URL` | Reference | `${{web.NEXTAUTH_URL}}` |
| `ENCRYPTION_KEY` | Reference | `${{web.ENCRYPTION_KEY}}` |
| `META_GRAPH_API_VERSION` | Reference | `${{web.META_GRAPH_API_VERSION}}` |
| `INSTAGRAM_APP_ID` | Reference | `${{web.INSTAGRAM_APP_ID}}` |
| `INSTAGRAM_APP_SECRET` | Reference | `${{web.INSTAGRAM_APP_SECRET}}` |
| `FACEBOOK_APP_SECRET` | Reference | `${{web.FACEBOOK_APP_SECRET}}` |
| `AI_VOICE_REPLIES` | User, optional | *(empty)*. Set `true` to reword replies with Claude. |
| `ANTHROPIC_API_KEY` | User, optional | *(empty)*. Needed only with `AI_VOICE_REPLIES=true`. |

### `cron`

| Variable | Kind | Template value |
| --- | --- | --- |
| `RAILWAY_DOCKERFILE_PATH` | Fixed | `Dockerfile.cron` |
| `CRON_BASE_URL` | Reference | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
| `CRON_SECRET` | Reference | `${{web.CRON_SECRET}}` |

## Template details

- **Name:** AutoDM
- **Short description:** Self-hosted Instagram comment-to-DM automation. Free, open source, a fork of OpenReply.
- **Category:** Automation (or Marketing)
- **Overview (markdown):** reuse the first paragraphs of the README and the "After the first deploy" list. Mention that a Meta app (or a Zernio account) is needed to actually send DMs, and link `META_APP_REVIEW.md` for anyone serving accounts they don't own.
- **Repository:** the new public repo. Railway templates deploy from the repo's default branch; deployers get their own copy (eject) if the template allows it.

## Smoke test after publishing the template

1. Deploy the template into a fresh project with only `ADMIN_EMAIL` filled in.
2. Wait for all three app services to go green. The `web` deploy log should show `prisma migrate deploy` applying every migration with no errors.
3. Open the `web` domain, sign in with `ADMIN_EMAIL` and the generated `ADMIN_PASSWORD`.
4. The `cron` log should print `[cron] scheduler started, target https://...` and, within five minutes, an `attach-next-reel ok` line.
5. `https://<web-domain>/api/health` should report the database and Redis as ok and a recent worker heartbeat.
6. Delete the test project.

Railway docs used (read 10 Nov 2026): `docs.railway.com/reference/config-as-code`, `/guides/config-as-code`, `/variables/reference`, `/templates/create`. Re-check the `RAILWAY_DOCKERFILE_PATH` behaviour and the secret() syntax there if Railway changes them.
