# KEX Event Runner Bridge

Implements the resident event path:

SHEET TELEMETRY -> MEMORY-IN-MOMENT EVENT -> DATA CLASS -> deterministic identity/hash -> canonical capability command -> GitHub repository_dispatch -> self-hosted KEX runner -> execution/readback.

Security: Apps Script stores only ingress URL/secret in Script Properties. GitHub token remains on the dispatcher host. Dispatch payloads carry canonical capability references, never arbitrary shell commands.

## Deployment
1. Put the workflow at `.github/workflows/kex-telemetry-runner.yml` in the target repository.
2. Run the dispatcher persistently with `GITHUB_TOKEN`, `KEX_TARGET_REPOSITORY`, and `KEX_INGRESS_SECRET`.
3. Register a self-hosted runner with labels `kex,telemetry`; use `runner/install-runner.sh` after placing the official GitHub runner binary on the host.
4. Set Apps Script properties `KEX_INGRESS_URL` and `KEX_INGRESS_SECRET`, then bind `kexTelemetryDispatch` to an installable edit trigger.

No runner-registration token, GitHub token, or ingress secret is committed.
