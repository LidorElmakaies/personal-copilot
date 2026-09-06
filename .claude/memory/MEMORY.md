# Memory Index

- [shabbat-notifier project](project_shabbat-notifier.md) — currently a clean-slate Gateway+Auth+OTel+frontend-login scaffold, after the original Shabbat/WhatsApp feature was stripped back out; stack, architecture, where things live
- [Commits need explicit approval](feedback_commits_need_explicit_approval.md) — never commit proactively; ask first, even for docs-only work
- [Gateway-only service access](feedback_gateway_only_service_access.md) — nothing external ever reaches auth (or any future internal service) directly, only Gateway; internal service-to-service calls are unaffected
- [Avoid dense code comments](feedback_avoid_dense_code_comments.md) — comments stay terse/one-line; deeper explanation lives in docs/specs, referenced with a pointer; the `docs` agent enforces this
