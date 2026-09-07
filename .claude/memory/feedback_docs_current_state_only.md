---
name: feedback_docs_current_state_only
description: Don't turn a conversational wishlist/vision into a persistent doc or bake it into agent personas/memory — docs describe only what currently exists in code; feature planning happens per-feature with the relevant agent when actually implementing.
metadata:
  type: feedback
---

On [[personal-copilot-project]] (2026-09-07), the user described a broad future direction for the
app (expense tracking, a Q&A agent, alarms, notifications) in one message alongside asking for a
project rename. Overreach: wrote a `docs/VISION.md` product-vision doc and edited every
`.claude/agents/*.md` file and the project memory to reference that future feature list. The user
pushed back hard: they only wanted the rename acted on — "i just gave you a name of the project
nothing else" — and explicitly don't want agents/memory/docs describing what they *will* build from
a casual mention; when they're ready to build something, they'll plan it specifically with the
relevant agent at that time, and docs get updated then (via the `docs` agent), not preemptively.

**Why**: this user treats a stated intent/wishlist and a decision-to-build as two different things.
Recording the former as if it were settled project scope pollutes docs/memory with content that
isn't true yet and wasn't asked for, and it's the `docs` agent's job specifically to keep
docs/specs/CLAUDE.md/agent files in sync with *current* reality — inventing a "vision" exception to
that rule wasn't asked for and cuts against it.

**How to apply**: when a user mentions future plans/ideas in passing (not as a "please plan/build
X" request), don't write them into README/CLAUDE.md/`.claude/agents/*.md`/project memory at all —
not even in a dedicated "vision" doc. Only record what was actually asked for and done (e.g. a
rename). If future intent seems worth remembering for continuity, ask first, or hold it in
conversation only. When the user later wants to actually build something, that's a normal
implementation task planned with the relevant persona agent — the `docs` agent updates docs to match
what got built, same as any other change, without needing a preemptive roadmap doc to reference.
