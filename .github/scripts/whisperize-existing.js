// One-off: converts existing regular replies by the Frontline bot account into whispers.
// Uses PUT /posts/:id/post_type (post_type=4). Dry run unless DRY_RUN=false.
const { DISCOURSE_URL, DISCOURSE_API_KEY, FRONTLINE_USER = "Frontline", DRY_RUN = "true" } = process.env;
const dry = DRY_RUN !== "false";
const headers = { "Api-Key": DISCOURSE_API_KEY, "Api-Username": FRONTLINE_USER, "Content-Type": "application/json" };

(async () => {
  let offset = 0, seen = 0, changed = 0;
  for (;;) {
    // filter=5 = replies made by the user
    const r = await fetch(`${DISCOURSE_URL}/user_actions.json?username=${encodeURIComponent(FRONTLINE_USER)}&filter=5&offset=${offset}`, { headers });
    if (!r.ok) throw new Error(`user_actions ${r.status}: ${await r.text()}`);
    const { user_actions: acts = [] } = await r.json();
    if (!acts.length) break;
    offset += acts.length;
    for (const a of acts) {
      seen++;
      const p = await fetch(`${DISCOURSE_URL}/posts/${a.post_id}.json`, { headers });
      if (!p.ok) { console.error(`post ${a.post_id}: ${p.status}`); continue; }
      const post = await p.json();
      if (post.post_type !== 1) continue; // already whisper / moderator action
      console.log(`${dry ? "[dry run] would whisper" : "whispering"} post ${a.post_id} (topic ${a.topic_id})`);
      if (dry) { changed++; continue; }
      const u = await fetch(`${DISCOURSE_URL}/posts/${a.post_id}/post_type`, {
        method: "PUT", headers, body: JSON.stringify({ post_type: 4 }),
      });
      if (!u.ok) console.error(`  failed: ${u.status} ${await u.text()}`); else changed++;
      await new Promise((res) => setTimeout(res, 500)); // be gentle with rate limits
    }
  }
  console.log(`Checked ${seen} replies, ${dry ? "would change" : "changed"} ${changed}`);
})().catch((e) => { console.error(e); process.exit(1); });
