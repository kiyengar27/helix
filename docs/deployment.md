# Staging deployment runbook

## Current boundaries

There is one owner-controlled Medplum project named Helix, used as staging. It is not a production environment. The foundation contains 14 synthetic configuration resources. No patients, providers, schedules, or production integrations are provisioned.

## CI

GitHub Actions CI runs on pull requests and main pushes: Node 24, locked dependencies, `make build`, and a local preview artifact. It has read-only repository permissions and no Medplum secrets. Keep contributions on pull_request, not privileged pull_request_target execution.

## GitHub staging controls

The workflow is manually dispatched from main, serialized under helix-staging, and gated by repository variable STAGING_ENABLED=true. The variable is an enablement switch, not authorization.

Configured repository controls at the initial setup:

- Only owner kiyengar27 is a collaborator.
- Main requires pull requests and the build status; force pushes and deletions are blocked, including for administrators.
- Staging requires owner review, allows main only, and disables administrator bypass. Self-review is permitted so the sole owner can approve their own run.

GitHub settings are external state; verify them before relying on them. Owners can change settings, and collaborator additions can change who can dispatch workflows. Review access periodically.

## Enablement checklist

1. Restrict or replace the broadly privileged Medplum provisioning identity. Define and test the necessary read/search/create and validation permissions before use. Do not broaden access merely to silence errors.
2. In repository Settings → Environments → staging, verify owner reviewer and main-only rules.
3. Store MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET as staging environment secrets. Never commit a credentials file. Use separate credentials for any future production environment.
4. Set repository variable STAGING_ENABLED=true.
5. Actions → Staging deployment → Run workflow → main → plan.
6. Approve the environment job, review plan and validation output, then deliberately run deploy when ready.

The initial setup stopped before secret upload and enablement. No production workflow exists.

## Deploy and verify

The workflow rebuilds its selected commit, validates resources, compares managed fields, applies a single transaction for deploy, then verifies. Artifacts capture plan/apply/verify logs for 14 days and are associated with the run's commit. Current reports contain synthetic configuration, not secrets; public-repository artifacts must never contain patient data.

For authorized local operation, use `make plan`, then `make deploy` from code/. Local deployment uses local credentials and does not pass through GitHub approvals; do not distribute deployment credentials to public contributors.

## Ownership and limitations

The JSON owns the fields it defines. Extra server fields are retained. Comparison is currently order-sensitive for arrays/objects; no automatic updates or deletions exist. A matching identifier with different managed fields blocks deployment. Review each discrepancy and design a controlled correction instead of changing identifiers to create a replacement.

Successful transaction submission is atomic at the FHIR transaction boundary. A later verification failure does not undo the transaction. Full server validation does not prove clinical or authorization correctness.

## Incident and recovery

Disable STAGING_ENABLED to stop new gated runs; cancel an active run separately if appropriate. Preserve commit/run IDs and reports. Inspect state and dependencies before corrections. Never automatically delete clinical resources or assume rerunning an old JSON file restores prior values. Rotate exposed credentials and review audit history. Removing a committed secret does not invalidate it.
