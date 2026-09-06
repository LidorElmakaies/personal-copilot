---
name: feedback_commits_need_explicit_approval
description: "Hard global rule (not specific to this project): never run git commit (or push) without the user explicitly saying ok to that specific commit"
metadata:
  node_type: memory
  type: feedback
---

**Hard rule, applies globally across every project** (this copy exists in this repo's memory for
the same reason [[askmycrawl-project]] keeps its own copy: so a Claude session working in this
repo alone still sees it without needing cross-project memory lookup). Never run `git add`/stage
files proactively, and never run `git commit` or `git push` proactively — not even "stage it for
review" as a middle ground.

An earlier instruction to "create a commit" is **not** standing permission to actually execute the
commit. Prepare it (stage the intended files, draft the commit message), show the user the message,
and wait for an explicit "ok"/"commit"/"yes" before running `git commit`. This applies even
mid-task, even if committing was the literal thing just asked for a moment earlier.

**How to apply:** after making file changes, describe what's ready (`git status`/`git diff`,
read-only) and, even when asked to prepare a commit, draft the message and show it — then wait for
explicit confirmation before actually running `git commit`. Never chain commit -> push without the
same explicit per-action confirmation.
