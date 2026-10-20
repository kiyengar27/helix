# Helix provisioning code

Start with the repository [README](../README.md), [developer setup](../docs/development.md), and [care-delivery deployment runbook](../docs/care-delivery-deployment.md).

Requires Node.js major 24 (24.2+). Run npm ci here, then make build and make preview. Local checks need no credentials. Authenticated commands read environment variables or the optional local .env link.

- config/foundation.json: original stable resource identities.
- config/proposals/: versioned care-delivery inputs, now consumed by the compiler; directory name is historical.
- config/security/care-delivery-policy.json: generated owner-managed deployment scope.
- src/deployment.ts: compiler, policy and reviewed-plan/transaction functions.
- scripts/provision-care-delivery.ts: preview, policy, server validation, plan, apply and verification.
- src/clinic-lifecycle.ts: local lifecycle projection and impact checks.
- tests/: 23 local tests; see the runbook for actual coverage and live limitations.

All 45 resources are deployed and verified in staging. PLAN and DEPLOY use separate owner approvals. Apply requires a successful saved plan from the same commit and checks current versions before bounded updates. No deletes or automated rollback. The original provision-foundation.ts is a legacy reference, not the CI/CD entry point.
