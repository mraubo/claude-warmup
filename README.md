# claude-warmup

Manipulate Claude Code's 5-hour usage window into resetting when you actually need it.

> **Edit (2026-04-01):** You can apply the same concept and achieve the exact same goal in a "native" way by using a [Claude Code Web scheduled task](https://claude.ai/code/scheduled). It works flawlessly! The "Why" section below is still useful for visualizing why you'd do this at all.

> **Edit (2026-04-30):** Anthropic seems to have changed the anchor behavior. The 5-hour window now starts at the exact minute of your first message, not floored to the clock hour. A cron at 6:00 AM now anchors a window from 6:00 AM to 11:00 AM. Pick a round-minute cron time so the reset lands cleanly.

## Why

Claude Code gives you a token budget that resets every 5 hours. The window starts when you send your first message.

You get the same amount of tokens either way. That's not the problem. The problem is _when_ the reset happens.

Say you start working at 8:30 AM. Your window opens at 8:30 AM and runs until 1:30 PM. You're coding hard, burning through tokens, and by 11 AM you hit the limit. Now what? Your window doesn't reset until 1:30 PM. That's two and a half hours of sitting around in the middle of your morning.

Now say a cron job sends a throwaway "hi" at 6:00 AM while you're still asleep. The window opens at 6:00 AM and runs until 11:00 AM. You still start working at 8:30, you still burn through tokens by 11. But now the window resets _right when you need it_. No gap. Your next message starts a fresh window through 4 PM.

You're not getting more tokens. You're just shifting the reset so it lands when you'd naturally take a break instead of when you're in the middle of something.

This won't help you with your _weekly_ usage limits though.

Example schedule:
```markdown
            6am    7     8     9    10    11    12    1pm    2     3     4     5    6pm
             |     |     |     |     |     |     |     |     |     |     |     |     |

Before:                    [============ window 1 ============]
                            work ~8:30am-11am  ░░░ dead ░░░
                                                             [============ window 2 ============]
                                                                       work ~1:30pm-6pm
        cron trigger
             │
             ▼
After:       [========== window 1 =========]
              ░░ idle ░░  work ~8:30am-11am
                                           [========== window 2 =========]
                                                   work ~11am-4pm
                                                                         [== win 3 ==]
                                                                         work ~4pm-6pm
```

> Bonus: a third fresh window starts at 4pm.

## How it works

A scheduled GitHub Actions workflow installs the Claude Code CLI, authenticates with your subscription using a long-lived OAuth token, and sends one Haiku message. That's enough to anchor the window. Cost-wise, one Haiku "hi" is nothing.

## Setup

### 1. Fork this repo

```bash
gh repo fork vdsmon/claude-warmup --clone
```

### 2. Generate an OAuth token

On a machine where you're logged into Claude Code:

```bash
claude setup-token
```

Opens a browser for OAuth. Gives you a token starting with `sk-ant-oat01-...`, good for about a year.

### 3. Store it as a secret

```bash
gh secret set CLAUDE_OAUTH_TOKEN
```

Paste when prompted.

### 4. Set your schedule

Default is weekdays at 9:00 UTC.

GitHub Actions requires `on.schedule.cron` to be a literal value in the workflow file, so changing the schedule means editing `.github/workflows/warmup.yml` and updating this line:

```yml
- cron: '0 9 * * 1-5'
```

That's a standard cron expression in UTC. Common conversions:

Need help generating one? Try [crontab.guru](https://crontab.guru/#0_9_*_*_1-5).

| Timezone | 6:00 AM local in UTC | Cron |
| --- | --- | --- |
| US Pacific (UTC-7) | 1:00 PM | `0 13 * * 1-5` |
| US Eastern (UTC-4) | 10:00 AM | `0 10 * * 1-5` |
| US Central (UTC-5) | 11:00 AM | `0 11 * * 1-5` |
| Central Europe (UTC+2) | 4:00 AM | `0 4 * * 1-5` |
| Brazil BRT (UTC-3) | 9:00 AM | `0 9 * * 1-5` |
| India IST (UTC+5:30) | 12:30 AM | `30 0 * * 1-5` |
| Japan JST (UTC+9) | 9:00 PM prev day | `0 21 * * 0-4` |
| Australia AEST (UTC+10) | 8:00 PM prev day | `0 20 * * 0-4` |

Pick something 2-4 hours before you usually start working (really depends on your usage pattern).

### 5. Test it

If this is a fresh fork, open the repo's `Actions` tab once and enable workflows if GitHub asks.

Optional but useful: set your fork as the default GitHub CLI target in this clone.

```bash
gh repo set-default <your-user>/claude-warmup
```

```bash
gh workflow run warmup.yml --repo <your-user>/claude-warmup
```

Check workflow status:

```bash
gh workflow list --repo <your-user>/claude-warmup
gh run list --workflow warmup.yml --repo <your-user>/claude-warmup
gh run view --log --repo <your-user>/claude-warmup
```

Check the logs. You should see a Haiku response or a rate-limit message. Both mean it worked.

### 6. Verify

Next morning, run `/usage` in Claude Code. The session reset time should match your anchored window.

## About the quota window

Some things about how Claude Code's 5-hour window actually works that aren't well documented anywhere (as of March 2026):

- The window is a fixed block. Once set, boundaries don't move no matter how much you use.
- ~~Boundaries floor to clock hours. Message at 6:15 AM means window starts at 6:00 AM.~~ As of ~April 2026, the anchor is the exact minute of the first message. No flooring. Message at 6:15 AM means window starts at 6:15 AM.
- Usage is shared between claude.ai, Claude Code, and Claude Desktop. One pool.
- Budget is in tokens, not messages. Extended Thinking and tool use eat through it faster than regular chat.
- There's a separate 7-day weekly cap on top of the 5-hour window. They don't interact.

## Questions

**Does this waste budget?** One Haiku "hi" with no tools, no context. You won't notice it.

**What if I'm already rate-limited?** Still works. The request reaches Anthropic's servers either way, and it still anchors the window.

**Can I run this locally instead?**
Yeah. `claude -p "hi" --model haiku --no-session-persistence` in a cron or macOS launchd does the same thing. GitHub Actions is just easier because your machine doesn't need to be awake at 6 AM.

**Token expiry?** About a year. Set a reminder.

## Running the schedule from Cloudflare Workers

GitHub's `on.schedule` is best-effort. In practice the runs can start hours late or stop firing altogether (forks are disabled by default, and GitHub silently pauses schedules). This repo's schedule stopped after April 21 and did not come back, and the upstream repo's runs were hours behind their cron. A [Cloudflare Cron Trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/) fires on the minute, so the workflow here is started by a small Worker instead.

```
Cloudflare Cron Trigger (04:17 UTC, Mon-Fri)
        |
        v
Worker `claude-warmup-trigger`  --POST /actions/workflows/warmup.yml/dispatches-->  GitHub
                                                                                      |
                                                                                      v
                                                          warmup.yml runs `claude -p "hi"`
```

The workflow keeps `workflow_dispatch` only; the `schedule:` block was removed so the two triggers don't double-fire. The Claude OAuth token (`CLAUDE_OAUTH_TOKEN`) stays a GitHub Actions secret as described above. The Worker only needs a GitHub token that is allowed to dispatch the workflow.

The Worker code lives in [`worker/`](worker/).

### Setup

**1. GitHub token for the Worker.** Create a fine-grained personal access token at <https://github.com/settings/personal-access-tokens/new>:

- **Repository access:** *Only select repositories* -> this repo. Do **not** leave the default *Public repositories*, which is read-only and returns `403`.
- **Repository permissions:** **Actions: Read and write** (plus Metadata: Read-only, added automatically). This is the permission `workflow_dispatch` needs. Don't confuse it with *Account permissions*.
- **Expiration:** pick a real date (not today) and note it. When the token expires the Worker gets `403` and the warmup stops silently, so renew it before then.

**2. Cloudflare login.**

```bash
npx wrangler login
npx wrangler whoami   # confirm the right account
```

**3. Configure and deploy.** Edit `worker/wrangler.toml`:

- `crons`: the schedule, in UTC (Cloudflare uses the same 5-field syntax as GitHub). The default is `17 4 * * 1-5`.
- `GITHUB_REPO`, `GITHUB_WORKFLOW`, `GITHUB_REF`: the repo (`owner/name`), workflow file and branch to dispatch.

```bash
cd worker
npx wrangler deploy
```

**4. Store the GitHub token as a Worker secret.**

```bash
npx wrangler secret put GITHUB_TOKEN
```

The name is passed on the command line (`GITHUB_TOKEN`). Wrangler then asks only for the **value**: paste the token there. If it asks for a *name* too, you ran the command without the argument and the token would be stored as the secret's name. In that case delete the secret and start over:

```bash
npx wrangler secret list      # should show only GITHUB_TOKEN
npx wrangler secret delete <wrong-name>
```

Secrets are kept across `wrangler deploy`. Names are visible in plain text, so never put the token anywhere but the value.

### Changing the schedule

Edit `crons` in `worker/wrangler.toml` and run `npx wrangler deploy`. A schedule change takes several minutes to propagate, so a cron set only a couple of minutes ahead may be skipped. When testing, set it at least ~15 minutes ahead and don't redeploy before it fires.

### Verifying that it works

1. **Wait for a scheduled run.** Check the Actions tab, or:
   ```bash
   gh run list -R <owner>/claude-warmup --event workflow_dispatch --limit 3
   ```
2. **Check Worker logs** (observability is enabled in `wrangler.toml`): Cloudflare dashboard -> Workers & Pages -> `claude-warmup-trigger` -> Observability. A healthy run logs `cron fired: ...` followed by `dispatch status=204`. The tail command (`npx wrangler tail claude-warmup-trigger`) also works but can be flaky on poor connections.
3. **Check the registered schedule:** Workers & Pages -> `claude-warmup-trigger` -> Settings -> Triggers -> Cron Triggers.

### Troubleshooting the Cloudflare setup

| Symptom | Cause / fix |
| --- | --- |
| Log shows `dispatch status=403 ... Resource not accessible by personal access token` | Token is read-only: check *Repository access* is the specific repo and *Actions* is **Read and write**. |
| Log shows `401 Bad credentials` | `GITHUB_TOKEN` is missing, wrong or expired. Check `wrangler secret list` and renew the token. |
| Log shows `404` | `GITHUB_REPO`, `GITHUB_WORKFLOW` or the token's repository access is wrong. |
| `wrangler secret list` shows a `github_pat_...` name | The token was entered as the secret name. Delete that secret, **revoke the token on GitHub**, create a new one and redo step 4. |
| `Required Worker name missing` | Wrangler ran outside `worker/` (no `wrangler.toml`). `cd worker` first or pass `--name claude-warmup-trigger`. |
| Nothing fires at the expected minute after a schedule change | Cron changes need several minutes to propagate. Wait and don't redeploy repeatedly. |
| No logs at all | Make sure `[observability] enabled = true` is in `wrangler.toml` and redeploy. |

## Troubleshooting

**`workflow not found on the default branch`**
The workflow file is missing from your fork's default branch, or GitHub Actions has not been enabled for the fork yet. Push `.github/workflows/warmup.yml` to your fork's default branch, then open the `Actions` tab once and enable workflows if prompted.

**`Must have admin rights to Repository`**
You're probably dispatching against the upstream repo instead of your fork. Run `gh workflow run warmup.yml --repo <your-user>/claude-warmup` or set the default with `gh repo set-default <your-user>/claude-warmup`.

**`CLAUDE_OAUTH_TOKEN secret is not set`**
Add the secret in your fork under `Settings > Secrets and variables > Actions`, then rerun the workflow.

**`Claude token appears invalid or expired`**
Run `claude setup-token` on a machine where you're logged into Claude Code, then update the `CLAUDE_OAUTH_TOKEN` secret in your fork and rerun the workflow. The warmup step checks for this directly.

**Unexpected Claude CLI failure**
Check the workflow logs. The job now prints the full Claude CLI output and only treats explicit rate-limit responses as expected.

## License

MIT
