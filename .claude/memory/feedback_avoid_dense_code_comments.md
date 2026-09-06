---
name: feedback_avoid_dense_code_comments
description: "User feedback: code comments were too dense/narrative (mirrored ask-my-crawl's own heavily-annotated style). Comments should be terse and direct; deeper explanation belongs in docs/specs, referenced with a short pointer. The docs agent now owns enforcing this."
metadata:
  node_type: memory
  type: feedback
---

Flagged directly at a small example (`libs/kafka-contracts/src/messages/whatsapp-inbound.message.ts`
had a 3-line JSDoc block for a 6-field interface): "you are putting too many comments in code."

**Root cause**: this project's comments were written mirroring [[askmycrawl-project]]'s own style,
which is unusually dense by design (that project narrates an AI agent's build decisions inline, as
a kind of embedded log). That's the wrong precedent to copy for a normal codebase's comments —
`[[askmycrawl-project]]`'s density is specific to what that repo is *for*, not a general
convention worth carrying over the way the architecture/layering conventions were.

**Resolution**: created a fourth agent, `.claude/agents/docs.md`, whose job is (a) keep
`docs/specs/*.md`/`CLAUDE.md`/READMEs/the other agent `.md` files synced with current reality
(never changelog/history — see that file for the full rule), (b) own the Mermaid topology +
sequence diagrams in `docs/specs/architecture.md`, and (c) trim code comments to one line by
default, reserving more for genuine footguns only. `backend.md`/`devops.md` were both updated to
explicitly hand off to `docs` when a change is done, rather than trusting their own judgment on
comment density.

**How to apply going forward, in this repo or elsewhere**: default to no comment; when one is
warranted, one line; a comment earns more than one line only for a real gotcha (something that
silently breaks if changed, not "here's how this fits into the architecture"). If a comment's
content belongs in a doc, put it there and leave a short pointer, don't inline the explanation.
