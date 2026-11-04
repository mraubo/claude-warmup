const headers = (env) => ({
  Authorization: `Bearer ${env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "claude-warmup-trigger",
});

async function dispatch(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({ ref: env.GITHUB_REF }),
  });
  const text = res.status === 204 ? "" : await res.text();
  console.log(`dispatch status=${res.status} ${text}`);
  if (res.status !== 204) throw new Error(`GitHub dispatch failed: ${res.status} ${text}`);
}

export default {
  async scheduled(event, env, ctx) {
    console.log(`cron fired: ${event.cron}`);
    ctx.waitUntil(dispatch(env));
  },
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/health") return new Response("ok");
    return new Response("not found", { status: 404 });
  },
};
