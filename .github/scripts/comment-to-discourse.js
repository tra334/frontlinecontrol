// Posts a GitHub issue comment back to the Discourse topic it came from.
const {
  DISCOURSE_URL, DISCOURSE_API_KEY, ISSUE_BODY = "", COMMENT_BODY = "",
  COMMENT_URL, COMMENTER, ISSUE_NUMBER = "", ISSUE_TITLE = "", FRONTLINE_USER = "Frontline",
  THOMAS_USER = "Thomas", GITHUB_THOMAS_LOGIN = "tra334",
} = process.env;

const m = ISSUE_BODY.match(/<!--\s*discourse-topic-id:\s*(\d+)\s*-->/);
if (!m) { console.log("Issue not linked to Discourse, skipping"); process.exit(0); }

if (/<!--\s*discourse-post-id:/.test(COMMENT_BODY)) { console.log("Comment came from Discourse, skipping"); process.exit(0); }

const isThomas = COMMENTER.toLowerCase() === GITHUB_THOMAS_LOGIN.toLowerCase();
const now = new Date().toISOString();
const quoted = COMMENT_BODY.trim().replace(/\n/g, "\n> ");
const raw =
  `> ### 💬 New comment on issue by ${COMMENTER}\n` +
  `>\n` +
  `> ${quoted}\n` +
  `>\n` +
  `> 🔗 [#${ISSUE_NUMBER} ${ISSUE_TITLE}](${COMMENT_URL}) · ` +
  `🕒 [date=${now.slice(0, 10)} time=${now.slice(11, 19)} timezone="UTC"]`;

(async () => {
  const res = await fetch(`${DISCOURSE_URL}/posts.json`, {
    method: "POST",
    headers: {
      "Api-Key": DISCOURSE_API_KEY,
      "Api-Username": isThomas ? THOMAS_USER : FRONTLINE_USER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ topic_id: Number(m[1]), raw }),
  });
  if (!res.ok) throw new Error(`Discourse ${res.status}: ${await res.text()}`);
  console.log(`Posted to topic ${m[1]} as ${isThomas ? THOMAS_USER : FRONTLINE_USER}`);
})().catch((e) => { console.error(e); process.exit(1); });
