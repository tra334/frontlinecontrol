// Polls Discourse for new topics, opens a GitHub issue for each, and
// replies on the topic as Frontline. Node 18+, no dependencies.
const {
  DISCOURSE_URL, DISCOURSE_API_KEY, GITHUB_TOKEN, GITHUB_REPO,
  FRONTLINE_USER = "Frontline", LOOKBACK_HOURS = "24", CATEGORY_ID = "6",
} = process.env;

const dHeaders = (user) => ({
  "Api-Key": DISCOURSE_API_KEY,
  "Api-Username": user,
  "Content-Type": "application/json",
});

async function gh(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "discourse-sync",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function existingTopicIds() {
  const ids = new Set();
  for (let page = 1; ; page++) {
    const issues = await gh(`/repos/${GITHUB_REPO}/issues?state=all&labels=discourse&per_page=100&page=${page}`);
    for (const i of issues) {
      const m = (i.body ?? "").match(/<!--\s*discourse-topic-id:\s*(\d+)\s*-->/);
      if (m) ids.add(Number(m[1]));
    }
    if (issues.length < 100) break;
  }
  return ids;
}

(async () => {
  const res = await fetch(`${DISCOURSE_URL}/latest.json?order=created`, { headers: dHeaders(FRONTLINE_USER) });
  if (!res.ok) throw new Error(`Discourse latest ${res.status}`);
  const topics = (await res.json()).topic_list.topics;

  const cutoff = Date.now() - Number(LOOKBACK_HOURS) * 3600 * 1000;
  const recent = topics.filter((t) => t.archetype === "regular" && String(t.category_id) === String(CATEGORY_ID) && new Date(t.created_at).getTime() >= cutoff);
  if (!recent.length) return console.log("No recent topics");

  const done = await existingTopicIds();

  for (const t of recent.reverse()) {
    if (done.has(t.id)) continue;

    const topicUrl = `${DISCOURSE_URL}/t/${t.slug}/${t.id}`;
    let firstPost = "";
    const raw = await fetch(`${DISCOURSE_URL}/raw/${t.id}`, { headers: dHeaders(FRONTLINE_USER) });
    if (raw.ok) firstPost = await raw.text();

    let author = "unknown";
    const info = await fetch(`${DISCOURSE_URL}/t/${t.id}.json`, { headers: dHeaders(FRONTLINE_USER) });
    if (info.ok) author = (await info.json()).details?.created_by?.username ?? author;

    const issue = await gh(`/repos/${GITHUB_REPO}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: t.title,
        labels: ["discourse"],
        body: `${firstPost}\n\n---\nPosted by **${author}** on the forum: ${topicUrl}\n\n<!-- discourse-topic-id: ${t.id} -->`,
      }),
    });

    const reply = await fetch(`${DISCOURSE_URL}/posts.json`, {
      method: "POST",
      headers: dHeaders(FRONTLINE_USER),
      body: JSON.stringify({ topic_id: t.id, raw: `GitHub issue created: ${issue.html_url}` }),
    });
    if (!reply.ok) console.error(`Reply on topic ${t.id} failed: ${reply.status} ${await reply.text()}`);
    console.log(`Topic ${t.id} -> issue #${issue.number}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
