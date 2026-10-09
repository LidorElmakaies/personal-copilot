# Memory Index

- [personal-copilot project](project_personal-copilot.md) — renamed from shabbat-notifier; hosting, the ask-my-crawl conventions it follows, and the user's design preferences (CLAUDE.md has the architecture)
- [Docs describe current state only](feedback_docs_current_state_only.md) — don't write a conversational wishlist into docs/agents/memory as a vision/roadmap; only document what's actually built or actually asked for
- [Commits need explicit approval](feedback_commits_need_explicit_approval.md) — never commit proactively; ask first, even for docs-only work
- [Gateway-only service access](feedback_gateway_only_service_access.md) — nothing external ever reaches users (or any other internal service) directly, only Gateway; internal service-to-service calls are unaffected
- [Avoid dense code comments](feedback_avoid_dense_code_comments.md) — comments stay terse/one-line; deeper explanation lives in docs/specs, referenced with a pointer; the `docs` agent enforces this
