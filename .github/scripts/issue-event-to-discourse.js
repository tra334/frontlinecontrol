// Posts a styled "activity card" to the linked Discourse topic when a
// GitHub issue is assigned, labeled, closed, reopened, renamed, etc.
const E = process.env;
const { DISCOURSE_URL, DISCOURSE_API_KEY, FRONTLINE_USER = "Frontline" } = E;

const m = (E.ISSUE_BODY ?? "").match(/<!--\s*discourse-topic-id:\s*(\d+)\s*-->/);
if (!m) { console.log("Issue not linked to Discourse, skipping"); process.exit(0); }
const topicId = Number(m[1]);

const actor = `**${E.ACTOR}**`;
let card = null;

switch (E.ACTION) {
  case "assigned":
    card = ["👤", "Assigned", `**${E.ASSIGNEE}** was assigned by ${actor}`]; break;
  case "unassigned":
    card = ["🚫", "Unassigned", `**${E.ASSIGNEE}** was unassigned by ${actor}`]; break;
  case "labeled":
    if (E.LABEL_NAME === "discourse") break; // internal label, skip
    card = ["🏷️", "Label added", `\`${E.LABEL_NAME}\` added by ${actor}`]; break;
  case "unlabeled":
    if (E.LABEL_NAME === "discourse") break;
    card = ["🏷️", "Label removed", `\`${E.LABEL_NAME}\` removed by ${actor}`]; break;
  case "closed":
    card = E.STATE_REASON === "not_planned"
      ? ["⛔", "Closed as not planned", `Closed by ${actor}`]
      : ["✅", "Closed as completed", `Closed by ${actor}`];
    break;
  case "reopened":
    card = ["🔄", "Reopened", `Reopened by ${actor}`]; break;
  case "edited":
    if (!E.OLD_TITLE) break; // only title changes, not body edits
    card = ["✏️", "Title changed", `~~${E.OLD_TITLE}~~ → **${E.ISSUE_TITLE}**\nChanged by ${actor}`]; break;
  case "milestoned":
    card = ["🎯", "Milestone set", `**${E.MILESTONE}** set by ${actor}`]; break;
  case "demilestoned":
    card = ["🎯", "Milestone removed", `**${E.MILESTONE}** removed by ${actor}`]; break;
}

if (!card) { console.log(`Nothing to post for ${E.ACTION}`); process.exit(0); }

const [icon, heading, detail] = card;
const now = new Date().toISOString();
const raw =
  `> ### ${icon} ${heading}\n` +
  `> ${detail.replace(/\n/g, "\n> ")}\n` +
  `>\n` +
  `> 🔗 [#${E.ISSUE_NUMBER} ${E.ISSUE_TITLE}](${E.ISSUE_URL}) · 🕒 [date=${now.slice(0, 10)} time=${now.slice(11, 19)} timezone="UTC"]`;

(async () => {
  const res = await fetch(`${DISCOURSE_URL}/posts.json`, {
    method: "POST",
    headers: {
      "Api-Key": DISCOURSE_API_KEY,
      "Api-Username": FRONTLINE_USER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ topic_id: topicId, raw }),
  });
  if (!res.ok) throw new Error(`Discourse ${res.status}: ${await res.text()}`);
  console.log(`Posted "${heading}" to topic ${topicId}`);
})().catch((e) => { console.error(e); process.exit(1); });
