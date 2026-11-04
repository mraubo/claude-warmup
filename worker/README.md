# claude-warmup-trigger

A Cloudflare Worker with a Cron Trigger. At the configured time it calls the GitHub API
(`workflow_dispatch`) to start `.github/workflows/warmup.yml`. See the
[main README](../README.md#running-the-schedule-from-cloudflare-workers) for the full setup.

- `wrangler.toml`: Worker name, cron (`17 4 * * 1-5`, UTC), target repo/workflow/ref, observability
- `src/index.js`: the `scheduled` handler (dispatch) and a `/health` endpoint

Deploy: `cd worker && npx wrangler deploy`
Secret: `npx wrangler secret put GITHUB_TOKEN`
