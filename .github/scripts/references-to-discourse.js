// Posts "linked a pull request" / "mentioned this issue" activity to the Discourse
// topic of any Discourse-linked issue referenced (#123) from a PR, issue, comment or commit.
// GitHub sends no webhook for timeline cross-references, so we detect them from the text.
const fs = require("fs");
const { DISCOURSE_URL, DISCOURSE_API_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_NAME,
        GITHUB_EVENT_PATH, FRONTLINE_USER = "Frontline" } = process.env;

const ev = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, "utf8"));
const action = ev.action;
const actor = ev.sender?.login ?? ev.pusher?.name ?? "someone";

const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+#(\d+)\b/gi;

function clean(t) {
  return String(t ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");
}
function refs(text) {
  const t = clean(text);
  const all = new Set([...t.matchAll(/(?<![\w/&#])#(\d+)\b/g)].map((x) => Number(x[1])));
  const closing = new Set([...t.matchAll(CLOSING)].map((x) => Number(x[1])));
  return { all, closing };
}
// On edits, only react to references that weren't there before (avoids duplicate posts).
function fresh(now, before) {
  if (before == null) return now;
  const old = refs(before);
  return { all: new Set([...now.all].filter((n) => !old.all.has(n))),
           closing: new Set([...now.closing].filter((n) => !old.closing.has(n))) };
}

// Build: { source: {label,url,kind}, kind: "linked"|"merged"|"mentioned", refs }
let jobs = [];
const link = (kind, num, title, url) => ({ kind, label: `${kind === "pr" ? "PR " : ""}#${num} ${title}`, url });

if (GITHUB_EVENT_NAME === "pull_request") {
  const pr = ev.pull_request;
  const src = link("pr", pr.number, pr.title, pr.html_url);
  const text = `${pr.title}\n${pr.body ?? ""}`;
  if (["opened", "reopened", "ready_for_review"].includes(action)) {
    const r = refs(text);
    jobs.push({ src, r, mode: "pr-open" });
  } else if (action === "edited") {
    const before = ev.changes ? `${ev.changes.title?.from ?? pr.title}\n${ev.changes.body?.from ?? pr.body ?? ""}` : null;
    jobs.push({ src, r: fresh(refs(text), before), mode: "pr-open" });
  } else if (action === "closed" && pr.merged) {
    const r = refs(text);
    jobs.push({ src, r: { all: r.closing, closing: r.closing }, mode: "pr-merged" });
  }
} else if (GITHUB_EVENT_NAME === "issues") {
  const i = ev.issue;
  const src = link("issue", i.number, i.title, i.html_url);
  const text = `${i.title}\n${i.body ?? ""}`;
  if (action === "opened") jobs.push({ src, r: refs(text), mode: "mention", self: i.number });
  else if (action === "edited") {
    const before = `${ev.changes?.title?.from ?? i.title}\n${ev.changes?.body?.from ?? i.body ?? ""}`;
    jobs.push({ src, r: fresh(refs(text), before), mode: "mention", self: i.number });
  }
} else if (GITHUB_EVENT_NAME === "issue_comment") {
  if (ev.comment?.user?.type === "Bot") process.exit(0);
  const i = ev.issue;
  const isPr = !!i.pull_request;
  const src = { kind: isPr ? "pr" : "issue", label: `${isPr ? "a comment on PR " : "a comment on "}#${i.number} ${i.title}`, url: ev.comment.html_url };
  const body = action === "edited" ? ev.changes?.body?.from : null;
  jobs.push({ src, r: fresh(refs(ev.comment.body), body), mode: "mention", self: i.number });
} else if (GITHUB_EVENT_NAME === "push") {
  for (const c of ev.commits ?? []) {
    const r = refs(c.message);
    jobs.push({ src: { kind: "commit", label: `commit ${c.id.slice(0, 7)}: ${c.message.split("\n")[0]}`, url: c.url },
                r, mode: "commit", who: c.author?.username ?? c.author?.name ?? actor });
  }
}

const gh = (path) => fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
  headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
});
const post = (topic_id, raw) => fetch(`${DISCOURSE_URL}/posts.json`, {
  method: "POST",
  headers: { "Api-Key": DISCOURSE_API_KEY, "Api-Username": FRONTLINE_USER, "Content-Type": "application/json" },
  body: JSON.stringify({ topic_id, raw }),
});

function card(job, n, issue) {
  const { src, mode, r } = job;
  const who = `**${job.who ?? actor}**`;
  const closes = r.closing.has(n);
  const kindWord = src.kind === "pr" ? "pull request" : src.kind === "commit" ? "commit" : "issue";
  let icon, heading, detail;
  if (mode === "pr-open" && closes) {
    [icon, heading, detail] = ["🔗", "Pull request linked", `${who} linked a pull request that will close this issue`];
  } else if (mode === "pr-merged") {
    [icon, heading, detail] = ["🟣", "Pull request merged", `${who} merged a pull request that closes this issue`];
  } else if (mode === "commit") {
    [icon, heading, detail] = ["📌", "Referenced in a commit", `${who} referenced this issue in a commit`];
  } else {
    [icon, heading, detail] = ["📌", `Mentioned in ${kindWord === "commit" ? "a commit" : `a ${kindWord}`}`, `${who} mentioned this issue in ${kindWord === "pull request" ? "a pull request" : `an ${kindWord}`}`];
  }
  const now = new Date().toISOString();
  return `### ${icon} ${heading}\n\n${detail}\n\n` +
    `🔗 [${src.label}](${src.url}) · 🕒 [date=${now.slice(0, 10)} time=${now.slice(11, 19)} timezone="UTC"]`;
}

(async () => {
  const seen = new Set();
  for (const job of jobs) {
    for (const n of job.r.all) {
      if (n === job.self) continue;
      const key = `${n}|${job.src.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const res = await gh(`/issues/${n}`);
      if (!res.ok) continue;
      const issue = await res.json();
      if (issue.pull_request) continue;
      const m = (issue.body ?? "").match(/<!--\s*discourse-topic-id:\s*(\d+)\s*-->/);
      if (!m) continue;
      const out = await post(Number(m[1]), card(job, n, issue));
      if (!out.ok) console.error(`Discourse ${out.status} for #${n}: ${await out.text()}`);
      else console.log(`Posted reference to #${n} on topic ${m[1]}`);
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
