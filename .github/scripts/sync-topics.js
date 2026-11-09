// Runs on a schedule. Jobs:
//  1. New Discourse topics (category CATEGORY_ID = bug reports, FEATURES_CATEGORY_ID = feature requests)
//     -> GitHub issues, then reply as Frontline. Feature requests get the "feature request" label
//     and a "Feature Request" heading instead of "Description".
//  2. Tags <-> labels: Discourse topic tags and GitHub issue labels are kept in sync
//     (3-way merge against a hidden "discourse-tags" marker in the issue body).
//  3. New replies on linked topics -> GitHub issue comments (ignoring IGNORE_USERS).
// Node 18+, no dependencies.
const {
  DISCOURSE_URL: DISCOURSE_URL_RAW, DISCOURSE_API_KEY, GITHUB_TOKEN, GITHUB_REPO,
  FRONTLINE_USER = "Frontline", LOOKBACK_HOURS = "24", CATEGORY_ID = "6",
  FEATURES_CATEGORY_ID = "", // Discourse "Features" category id; leave empty to disable
  IGNORE_USERS = "Frontline",
  ISSUE_STYLE = "card", // "note" (callout header) or "card" (table header)
} = process.env;

const DISCOURSE_URL = String(DISCOURSE_URL_RAW).replace(/\/+$/, ""); // tolerate a trailing slash in the secret

// Adding one of these tags closes the linked issue (tag -> close reason + comment).
const CLOSE_TAGS = {
  fixed: { reason: "completed", comment: "Issue has been marked as fixed and closed" },
  shipped: { reason: "completed", comment: "This feature has shipped, so the request has been closed" },
  "not-planned": { reason: "not_planned", comment: "This request is not planned, so it has been closed" },
};
const SKIP_LABEL = "discourse"; // internal label, never mirrored as a tag
const FEATURE_LABEL = "feature request"; // added to issues from the features category, also never mirrored as a tag
const isInternal = (x) => { const n = norm(x); return n === norm(SKIP_LABEL) || n === norm(FEATURE_LABEL); };
const ignored = new Set(
  [...IGNORE_USERS.split(","), FRONTLINE_USER, "system"].map((u) => u.trim().toLowerCase()).filter(Boolean)
);
const cutoff = Date.now() - Number(LOOKBACK_HOURS) * 3600 * 1000;

// Discourse tag rules: lowercase, spaces -> hyphens, no special characters.
const norm = (s) =>
  String(s).toLowerCase().trim().replace(/\s+/g, "-").replace(/[\/?#\[\]@!$&'()*+,;=.:<>%\\"]/g, "");
const tagNames = (topic) =>
  (topic.tags ?? []).map((t) => norm(typeof t === "string" ? t : t.name ?? t.slug)).filter(Boolean);


// fetch with a per-request timeout and retries on network errors, 429 and 5xx,
// so one slow Discourse/GitHub response can't hang or kill the whole run.
async function req(url, options = {}, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      if ((res.status === 429 || res.status >= 500) && attempt < tries) {
        const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * 2 ** (attempt - 1);
        console.warn(`${res.status} from ${String(url).split("?")[0]}, retry ${attempt}/${tries - 1} in ${wait}ms`);
        await new Promise((r) => setTimeout(r, Math.min(wait, 20000)));
        continue;
      }
      return res;
    } catch (e) {
      if (attempt >= tries) throw e;
      console.warn(`${e.name}: ${e.message} on ${String(url).split("?")[0]}, retry ${attempt}/${tries - 1}`);
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
    }
  }
}

const dHeaders = (user = FRONTLINE_USER) => ({
  "Api-Key": DISCOURSE_API_KEY,
  "Api-Username": user,
  "Content-Type": "application/json",
});

async function gh(path, options = {}) {
  const res = await req(`https://api.github.com${path}`, {
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

const labelNames = (labels) => (labels ?? []).map((l) => (typeof l === "string" ? l : l.name));

// Every GitHub issue created by this sync, with its Discourse topic id.
async function linkedIssues() {
  const issues = await ghAll(`/repos/${GITHUB_REPO}/issues?state=all&labels=${SKIP_LABEL}`);
  const linked = [];
  for (const i of issues) {
    const m = (i.body ?? "").match(/<!--\s*discourse-topic-id:\s*(\d+)\s*-->/);
    if (m) linked.push({ number: i.number, state: i.state, topicId: Number(m[1]), body: i.body ?? "", labels: labelNames(i.labels) });
  }
  return linked;
}

// Map normalised tag -> an existing repo label name (so "good-first-issue" reuses "good first issue").
let labelMap = new Map();
const labelFor = (tag) => labelMap.get(tag) ?? tag;

// ---------- hidden tag marker ----------
function parseBase(body) {
  const m = (body ?? "").match(/<!--\s*discourse-tags:\s*([^>]*?)\s*-->/);
  return new Set(m && m[1] ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : []);
}
function withMarker(body, set) {
  const marker = `<!-- discourse-tags: ${[...set].sort().join(",")} -->`;
  return /<!--\s*discourse-tags:/.test(body)
    ? body.replace(/<!--\s*discourse-tags:[^>]*-->/, marker)
    : `${body}\n\n${marker}`;
}
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

async function setDiscourseTags(topicId, tags) {
  const res = await req(`${DISCOURSE_URL}/t/-/${topicId}.json`, {
    method: "PUT",
    headers: dHeaders(),
    body: JSON.stringify({ tags: tags.length ? tags : [""] }),
  });
  if (!res.ok) throw new Error(`Discourse tag update on topic ${topicId} ${res.status}: ${await res.text()}`);
}


// ---------- formatting helpers ----------
const fmtDate = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
  }) + " UTC";

// Discourse stores images as ![alt|594x500](upload://abc.png), which GitHub can't render.
// Resolve those to real URLs and strip the size hint from the alt text.
async function resolveUploads(raw) {
  const shorts = [...new Set([...raw.matchAll(/upload:\/\/[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?/g)].map((m) => m[0]))];
  const urls = new Map();
  if (shorts.length) {
    try {
      const res = await req(`${DISCOURSE_URL}/uploads/lookup-urls.json`, {
        method: "POST",
        headers: { ...dHeaders(), "Content-Type": "application/x-www-form-urlencoded" },
        body: shorts.map((s) => `short_urls[]=${encodeURIComponent(s)}`).join("&"),
      });
      if (res.ok) {
        for (const r of await res.json()) {
          if (r.url) urls.set(r.short_url, r.url.startsWith("/") ? `${DISCOURSE_URL}${r.url}` : r.url);
        }
      }
    } catch (e) { console.warn("Upload lookup failed:", e.message); }
  }
  return raw
    .replace(/!\[([^\]]*?)\|\d+x\d+(?:,\s*\d+%)?\]\(/g, "![$1](") // drop "|594x500" from alt text
    .replace(/!\[([^\]]*)\]\((upload:\/\/[^)\s]+)\)/g, (_, alt, src) =>
      {
        // Resolved URL if Discourse gave one, otherwise its short-url redirect (same /uploads/short-url/ route the forum itself uses).
        const url = urls.get(src) ?? `${DISCOURSE_URL}/uploads/short-url/${src.slice("upload://".length)}`;
        return `[![${alt || "image"}](${url})](${url})`; // click to open full size
      })
    .replace(/\[([^\]]+?)\|attachment\]\((upload:\/\/[^)\s]+)\)/g, (_, name, src) =>
      urls.has(src) ? `[📎 ${name}](${urls.get(src)})` : `📎 ${name}`);
}

// Discourse avatar_template looks like "/user_avatar/host/thomas/{size}/12_2.png" (or a CDN URL).
function avatarUrl(tpl, size = 96) {
  if (!tpl) return "";
  const u = String(tpl).replace("{size}", size);
  if (/^https?:/.test(u)) return u;
  return u.startsWith("//") ? `https:${u}` : `${DISCOURSE_URL}${u}`;
}

// Discourse staff flags -> short role label (admin wins over moderator).
const roleOf = (post) => (post?.admin ? "Admin" : post?.moderator ? "Mod" : "");

// Avatar + name (+ staff shield) on one line, meta underneath. Plain inline HTML, no table, so GitHub draws no borders.
function authorHeader({ name, avatar, role, action, when, url, urlText, px = 40 }) {
  const img = avatar ? `<img src="${avatar}" width="${px}" height="${px}" align="middle" alt="${name}"> &nbsp;` : "";
  const shield = role ? ` 🛡️ <sub><b>${role}</b></sub>` : "";
  return `${img}<b>${name}</b>${shield} <sub>· ${action}</sub><br>\n<sub>🕒 ${when} &nbsp;·&nbsp; 🔗 <a href="${url}">${urlText}</a></sub>`;
}

// Plain-URL list of every image, so they stay reachable even if GitHub can't render one inline.
function imageLinksBlock(text) {
  const seen = new Map();
  for (const m of text.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) if (!seen.has(m[2])) seen.set(m[2], m[1] || "image");
  if (!seen.size) return "";
  const items = [...seen].map(([url, alt]) => `- [${alt}](${url})`).join("\n");
  return `<details>\n<summary>🖼️ Image links (${seen.size})</summary>\n\n${items}\n\n</details>`;
}

// ---------- 1. Discourse topics -> GitHub issues ----------
async function syncTopics(linked) {
  const res = await req(`${DISCOURSE_URL}/latest.json?order=created`, { headers: dHeaders() });
  if (!res.ok) throw new Error(`Discourse latest ${res.status}`);
  const topics = (await res.json()).topic_list.topics;

  const watched = new Set([CATEGORY_ID, FEATURES_CATEGORY_ID].filter(Boolean).map(String));
  const recent = topics.filter(
    (t) =>
      t.archetype === "regular" &&
      watched.has(String(t.category_id)) &&
      new Date(t.created_at).getTime() >= cutoff
  );
  const done = new Set(linked.map((l) => l.topicId));

  for (const t of recent.reverse()) {
    if (done.has(t.id)) continue;

    const isFeature = !!FEATURES_CATEGORY_ID && String(t.category_id) === String(FEATURES_CATEGORY_ID);
    const topicUrl = `${DISCOURSE_URL}/t/${t.slug}/${t.id}`;
    let firstPost = "";
    let createdAt = t.created_at;
    let author = "unknown";
    let avatar = "";
    let role = "";
    let tags = [];

    const info = await req(`${DISCOURSE_URL}/t/${t.id}.json`, { headers: dHeaders() });
    if (info.ok) {
      const topic = await info.json();
      author = topic.details?.created_by?.username ?? author;
      tags = tagNames(topic).filter((x) => !isInternal(x));
      const first = topic.post_stream?.posts?.[0];
      if (first) {
        avatar = avatarUrl(first.avatar_template);
        role = roleOf(first);
        // /posts/:id.json returns the clean markdown (no "user | date | #1" header line).
        const pr = await req(`${DISCOURSE_URL}/posts/${first.id}.json`, { headers: dHeaders() });
        if (pr.ok) {
          const p = await pr.json();
          firstPost = p.raw ?? "";
          createdAt = p.created_at ?? createdAt;
        }
      }
    }
    if (!firstPost) {
      const raw = await req(`${DISCOURSE_URL}/raw/${t.id}`, { headers: dHeaders() });
      if (raw.ok) {
        firstPost = (await raw.text())
          .replace(/^[^\n]*\|\s*#\d+\s*\n+/, "") // "Thomas | 2026-10-27 ... | #1"
          .replace(/\n*-{3,}\s*$/, "");            // trailing rule Discourse adds
      }
    }

    const content = (await resolveUploads(firstPost)).trim() || (isFeature ? "_No details provided._" : "_No description provided._");
    const images = imageLinksBlock(content);
    const when = fmtDate(createdAt);
    const card = ISSUE_STYLE === "card";
    const header = authorHeader({
      name: author, avatar, role, action: isFeature ? "requested this on the forum" : "reported this on the forum", when, url: topicUrl, urlText: "Open discussion ↗",
    });
    const body = [
      header,
      "",
      ...(card ? [isFeature ? "### 💡 Feature Request" : "### 📝 Description", ""] : []),
      content,
      "",
      ...(images ? [images, ""] : []),
      ...(card ? ["> [!TIP]", "> Reply here or on the forum — comments are mirrored both ways.", ""] : []),
      "---",
      `<sub>Synced from [Discourse](${DISCOURSE_URL}) · topic #${t.id}${card ? "" : " · replies and comments are mirrored both ways"}</sub>`,
      "",
      `<!-- discourse-topic-id: ${t.id} -->`,
      `<!-- discourse-tags: ${[...tags].sort().join(",")} -->`,
    ].join("\n");

    const issue = await gh(`/repos/${GITHUB_REPO}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: t.title,
        labels: [SKIP_LABEL, ...(isFeature ? [FEATURE_LABEL] : []), ...tags.map(labelFor)],
        body,
      }),
    });
    linked.push({ number: issue.number, state: "open", topicId: t.id, body: issue.body ?? "", labels: labelNames(issue.labels) });

    const reply = await req(`${DISCOURSE_URL}/posts.json`, {
      method: "POST",
      headers: dHeaders(),
      body: JSON.stringify({ topic_id: t.id, raw: `GitHub ${isFeature ? "feature request" : "issue"} created: ${issue.html_url}` }),
    });
    if (!reply.ok) console.error(`Reply on topic ${t.id} failed: ${reply.status} ${await reply.text()}`);
    console.log(`Topic ${t.id} -> issue #${issue.number}`);
  }
}

// ---------- 2. Tags <-> labels ----------
async function reconcileTags(issue, topic) {
  const base = parseBase(issue.body);
  const tags = new Set(tagNames(topic).filter((x) => !isInternal(x)));
  const labels = new Map(); // normalised -> actual label name
  for (const l of issue.labels) if (!isInternal(l)) labels.set(norm(l), l);

  // 3-way merge: additions and removals from either side win over the last synced state.
  const merged = new Set(base);
  for (const t of tags) if (!base.has(t)) merged.add(t);
  for (const t of base) if (!tags.has(t)) merged.delete(t);
  for (const l of labels.keys()) if (!base.has(l)) merged.add(l);
  for (const t of base) if (!labels.has(t)) merged.delete(t);

  // Discourse first: if this fails we stop, so the marker never claims a sync that didn't happen.
  if (!sameSet(merged, tags)) await setDiscourseTags(issue.topicId, [...merged]);

  const toAdd = [...merged].filter((t) => !labels.has(t)).map(labelFor);
  if (toAdd.length) await gh(`/repos/${GITHUB_REPO}/issues/${issue.number}/labels`, { method: "POST", body: JSON.stringify({ labels: toAdd }) });
  for (const [key, name] of labels) {
    if (merged.has(key)) continue;
    try { await gh(`/repos/${GITHUB_REPO}/issues/${issue.number}/labels/${encodeURIComponent(name)}`, { method: "DELETE" }); }
    catch (e) { if (!String(e.message).includes(" 404")) throw e; }
  }

  // A closing tag newly added (on Discourse or GitHub) -> close the issue with the matching reason.
  // Only fires on the transition, so reopening an issue that still has the tag won't re-close it.
  const closeTag = Object.keys(CLOSE_TAGS).find((t) => merged.has(t) && !base.has(t));
  if (closeTag) {
    const { reason, comment } = CLOSE_TAGS[closeTag];
    await gh(`/repos/${GITHUB_REPO}/issues/${issue.number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: comment }),
    });
    await gh(`/repos/${GITHUB_REPO}/issues/${issue.number}`, {
      method: "PATCH",
      body: JSON.stringify({ state: "closed", state_reason: reason }),
    });
    issue.state = "closed";
    console.log(`Issue #${issue.number} closed (tagged "${closeTag}", ${reason})`);
  }

  if (!sameSet(merged, base) || !/<!--\s*discourse-tags:/.test(issue.body)) {
    issue.body = withMarker(issue.body, merged);
    await gh(`/repos/${GITHUB_REPO}/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ body: issue.body }) });
    console.log(`Tags for issue #${issue.number} synced: ${[...merged].join(", ") || "(none)"}`);
  }
}

// ---------- 3. Discourse replies -> GitHub comments ----------
async function syncReplies(issue, topic) {
  if (new Date(topic.last_posted_at).getTime() < cutoff) return;

  const candidates = topic.post_stream.stream.slice(1); // first post is already in the issue body
  if (!candidates.length) return;

  const comments = await ghAll(`/repos/${GITHUB_REPO}/issues/${issue.number}/comments`);
  const synced = new Set();
  for (const c of comments) {
    for (const m of (c.body ?? "").matchAll(/<!--\s*discourse-post-id:\s*(\d+)\s*-->/g)) synced.add(Number(m[1]));
  }

  for (const id of candidates) {
    if (synced.has(id)) continue;

    const pr = await req(`${DISCOURSE_URL}/posts/${id}.json`, { headers: dHeaders() });
    if (!pr.ok) continue;
    const p = await pr.json();

    if (![1, 2].includes(p.post_type)) continue; // regular + moderator posts only
    if (p.hidden || p.user_deleted || p.deleted_at) continue;
    if (new Date(p.created_at).getTime() < cutoff) continue;
    if (ignored.has(String(p.username).toLowerCase())) continue;

    const postUrl = `${DISCOURSE_URL}/t/${issue.topicId}/${p.post_number}`;
    const replyHeader = authorHeader({
      name: p.username, avatar: avatarUrl(p.avatar_template, 64), role: roleOf(p), action: "replied on the forum",
      when: fmtDate(p.created_at), url: postUrl, urlText: "View post ↗", px: 28,
    });
    await gh(`/repos/${GITHUB_REPO}/issues/${issue.number}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: `${replyHeader}\n\n${(await resolveUploads(p.raw ?? "")).trim()}\n\n<!-- discourse-post-id: ${id} -->`,
      }),
    });
    console.log(`Post ${id} by ${p.username} -> issue #${issue.number}`);
  }
}

(async () => {
  const repoLabels = await ghAll(`/repos/${GITHUB_REPO}/labels`);
  labelMap = new Map(repoLabels.map((l) => [norm(l.name), l.name]));

  if (FEATURES_CATEGORY_ID && !labelMap.has(norm(FEATURE_LABEL))) {
    await gh(`/repos/${GITHUB_REPO}/labels`, {
      method: "POST",
      body: JSON.stringify({ name: FEATURE_LABEL, color: "a2eeef", description: "Requested on the Discourse forum" }),
    });
  }

  const linked = await linkedIssues();
  await syncTopics(linked);

  for (const issue of linked.filter((l) => l.state === "open")) {
    try {
      const tr = await req(`${DISCOURSE_URL}/t/${issue.topicId}.json`, { headers: dHeaders() });
      if (!tr.ok) { console.warn(`Topic ${issue.topicId}: ${tr.status}`); continue; }
      const topic = await tr.json();
      await reconcileTags(issue, topic);
      await syncReplies(issue, topic);
    } catch (e) {
      console.error(`Issue #${issue.number}:`, e.message);
      process.exitCode = 1; // fail the run so GitHub emails you
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
