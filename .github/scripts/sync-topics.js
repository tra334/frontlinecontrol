// Runs on a schedule. Two jobs:
//  1. New Discourse topics (category CATEGORY_ID) -> GitHub issues, then reply as Frontline.
//  2. New replies on linked topics -> GitHub issue comments (ignoring IGNORE_USERS).
// Node 18+, no dependencies.
const {
  DISCOURSE_URL, DISCOURSE_API_KEY, GITHUB_TOKEN, GITHUB_REPO,
  FRONTLINE_USER = "Frontline", LOOKBACK_HOURS = "24", CATEGORY_ID = "6",
  IGNORE_USERS = "Frontline",
} = process.env;

const ignored = new Set(
  [...IGNORE_USERS.split(","), FRONTLINE_USER, "system"].map((u) => u.trim().toLowerCase()).filter(Boolean)
);
const cutoff = Date.now() - Number(LOOKBACK_HOURS) * 3600 * 1000;

const dHeaders = (user = FRONTLINE_USER) => ({
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

async function ghAll(path) {
  const out = [];
  const sep = path.includes("?") ? "&" : "?";
  for (let page = 1; ; page++) {
    const items = await gh(`${path}${sep}per_page=100&page=${page}`);
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

// Every GitHub issue created by this sync, with its Discourse topic id.
async function linkedIssues() {
  const issues = await ghAll(`/repos/${GITHUB_REPO}/issues?state=all&labels=discourse`);
  const linked = [];
  for (const i of issues) {
    const m = (i.body ?? "").match(/<!--\s*discourse-topic-id:\s*(\d+)\s*-->/);
    if (m) linked.push({ number: i.number, state: i.state, topicId: Number(m[1]) });
  }
  return linked;
}

// ---------- 1. Discourse topics -> GitHub issues ----------
async function syncTopics(linked) {
  const res = await fetch(`${DISCOURSE_URL}/latest.json?order=created`, { headers: dHeaders() });
  if (!res.ok) throw new Error(`Discourse latest ${res.status}`);
  const topics = (await res.json()).topic_list.topics;

  const recent = topics.filter(
    (t) =>
      t.archetype === "regular" &&
      String(t.category_id) === String(CATEGORY_ID) &&
      new Date(t.created_at).getTime() >= cutoff
  );
  const done = new Set(linked.map((l) => l.topicId));

  for (const t of recent.reverse()) {
    if (done.has(t.id)) continue;

    const topicUrl = `${DISCOURSE_URL}/t/${t.slug}/${t.id}`;
    let firstPost = "";
    const raw = await fetch(`${DISCOURSE_URL}/raw/${t.id}`, { headers: dHeaders() });
    if (raw.ok) firstPost = await raw.text();

    let author = "unknown";
    const info = await fetch(`${DISCOURSE_URL}/t/${t.id}.json`, { headers: dHeaders() });
    if (info.ok) author = (await info.json()).details?.created_by?.username ?? author;

    const issue = await gh(`/repos/${GITHUB_REPO}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: t.title,
        labels: ["discourse"],
        body: `${firstPost}\n\n---\nPosted by **${author}** on the forum: ${topicUrl}\n\n<!-- discourse-topic-id: ${t.id} -->`,
      }),
    });
    linked.push({ number: issue.number, state: "open", topicId: t.id });

    const reply = await fetch(`${DISCOURSE_URL}/posts.json`, {
      method: "POST",
      headers: dHeaders(),
      body: JSON.stringify({ topic_id: t.id, raw: `GitHub issue created: ${issue.html_url}` }),
    });
    if (!reply.ok) console.error(`Reply on topic ${t.id} failed: ${reply.status} ${await reply.text()}`);
    console.log(`Topic ${t.id} -> issue #${issue.number}`);
  }
}

// ---------- 2. Discourse replies -> GitHub comments ----------
async function syncReplies(linked) {
  for (const issue of linked.filter((l) => l.state === "open")) {
    const tr = await fetch(`${DISCOURSE_URL}/t/${issue.topicId}.json`, { headers: dHeaders() });
    if (!tr.ok) { console.warn(`Topic ${issue.topicId}: ${tr.status}`); continue; }
    const topic = await tr.json();

    // Skip topics with no recent activity.
    if (new Date(topic.last_posted_at).getTime() < cutoff) continue;

    const stream = topic.post_stream.stream; // all post ids, in order
    const candidates = stream.slice(1);      // first post is already in the issue body
    if (!candidates.length) continue;

    // Which Discourse posts already have a GitHub comment?
    const comments = await ghAll(`/repos/${GITHUB_REPO}/issues/${issue.number}/comments`);
    const synced = new Set();
    for (const c of comments) {
      for (const m of (c.body ?? "").matchAll(/<!--\s*discourse-post-id:\s*(\d+)\s*-->/g)) synced.add(Number(m[1]));
    }

    for (const id of candidates) {
      if (synced.has(id)) continue;

      const pr = await fetch(`${DISCOURSE_URL}/posts/${id}.json`, { headers: dHeaders() });
      if (!pr.ok) continue;
      const p = await pr.json();

      if (![1, 2].includes(p.post_type)) continue;          // regular + moderator posts only
      if (p.hidden || p.user_deleted || p.deleted_at) continue;
      if (new Date(p.created_at).getTime() < cutoff) continue;
      if (ignored.has(String(p.username).toLowerCase())) continue;

      const postUrl = `${DISCOURSE_URL}/t/${issue.topicId}/${p.post_number}`;
      await gh(`/repos/${GITHUB_REPO}/issues/${issue.number}/comments`, {
        method: "POST",
        body: JSON.stringify({
          body:
            `> 💬 **${p.username}** replied on the forum · [view post](${postUrl})\n\n` +
            `${p.raw}\n\n<!-- discourse-post-id: ${id} -->`,
        }),
      });
      console.log(`Post ${id} by ${p.username} -> issue #${issue.number}`);
    }
  }
}

(async () => {
  const linked = await linkedIssues();
  await syncTopics(linked);
  await syncReplies(linked);
})().catch((e) => { console.error(e); process.exit(1); });
