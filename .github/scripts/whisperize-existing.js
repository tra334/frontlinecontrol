// One-off: converts existing regular replies by the Frontline bot account into whispers.
// Uses PUT /posts/:id/post_type (post_type=4). Dry run unless DRY_RUN=false.
// Throttles requests and retries on Discourse rate limits (HTTP 429).
const { DISCOURSE_URL, DISCOURSE_API_KEY, FRONTLINE_USER = "Frontline", DRY_RUN = "true" } = process.env;
const dry = DRY_RUN !== "false";
const headers = { "Api-Key": DISCOURSE_API_KEY, "Api-Username": FRONTLINE_USER, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(url, opts = {}) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(700); // stay under Discourse's per-minute API limits
    const res = await fetch(url, { headers, ...opts });
    if (res.status !== 429) return res;
    let wait = 5;
    try { wait = (await res.json()).extras?.wait_seconds ?? 5; } catch {}
    console.log(`Rate limited, waiting ${wait + 2}s (attempt ${attempt + 1})`);
    await sleep((wait + 2) * 1000);
  }
  throw new Error(`Still rate limited after retries: ${url}`);
}

(async () => {
  let offset = 0, seen = 0, changed = 0, failed = 0;
  for (;;) {
    // filter=5 = replies made by the user
    const r = await req(`${DISCOURSE_URL}/user_actions.json?username=${encodeURIComponent(FRONTLINE_USER)}&filter=5&offset=${offset}`);
    if (!r.ok) throw new Error(`user_actions ${r.status}: ${await r.text()}`);
    const { user_actions: acts = [] } = await r.json();
    if (!acts.length) break;
    offset += acts.length;
    for (const a of acts) {
      seen++;
      const p = await req(`${DISCOURSE_URL}/posts/${a.post_id}.json`);
      if (!p.ok) { console.error(`post ${a.post_id}: ${p.status}`); failed++; continue; }
      const post = await p.json();
      if (post.post_type !== 1) continue; // already whisper / moderator action
      if ((post.raw ?? "").includes("Browse files at this commit")) continue; // leave commit posts public
      console.log(`${dry ? "[dry run] would whisper" : "whispering"} post ${a.post_id} (topic ${a.topic_id})`);
      if (dry) { changed++; continue; }
      const u = await req(`${DISCOURSE_URL}/posts/${a.post_id}/post_type`, {
        method: "PUT", body: JSON.stringify({ post_type: 4 }),
      });
      if (!u.ok) { console.error(`  failed: ${u.status} ${await u.text()}`); failed++; } else changed++;
    }
  }
  console.log(`Checked ${seen} replies, ${dry ? "would change" : "changed"} ${changed}, failed ${failed}`);
  if (failed) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
