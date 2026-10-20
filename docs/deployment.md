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

The owner completed policy assignment and environment-secret setup, and STAGING_ENABLED is true. Hosted plan and deploy/verify succeeded. The checklist remains the procedure for new environments or credential replacement. No production workflow exists.

## Deploy and verify

The workflow rebuilds its selected commit, validates resources, compares managed fields, applies a single transaction for deploy, then verifies. Artifacts capture plan/apply/verify logs for 14 days and are associated with the run's commit. Current reports contain synthetic configuration, not secrets; public-repository artifacts must never contain patient data.

For authorized local operation, use `make plan`, then `make deploy` from code/. Local deployment uses local credentials and does not pass through GitHub approvals; do not distribute deployment credentials to public contributors.

## Ownership and limitations

The JSON owns the fields it defines. Extra server fields are retained. Comparison is currently order-sensitive for arrays/objects; no automatic updates or deletions exist. A matching identifier with different managed fields blocks deployment. Review each discrepancy and design a controlled correction instead of changing identifiers to create a replacement.

Successful transaction submission is atomic at the FHIR transaction boundary. A later verification failure does not undo the transaction. Full server validation does not prove clinical or authorization correctness.

## Incident and recovery

Disable STAGING_ENABLED to stop new gated runs; cancel an active run separately if appropriate. Preserve commit/run IDs and reports. Inspect state and dependencies before corrections. Never automatically delete clinical resources or assume rerunning an old JSON file restores prior values. Rotate exposed credentials and review audit history. Removing a committed secret does not invalidate it.

## Recognizing approval requests

The run title and job label explicitly identify the selected operation:

| Operation | Run title | Approval job |
|---|---|---|
| plan | Staging · PLAN · Validate only (no resource writes) | Approve staging validation — no resource writes |
| deploy | Staging · DEPLOY · Apply and verify (writes allowed) | Approve staging deployment — resource writes allowed |

The run title also identifies the initiating actor. GitHub's environment badge remains staging, and its approval button wording is controlled by GitHub. Review the run title, job, commit, and selected operation before approving. Each run requires a separate approval. A deploy can create missing resources even if a previous plan found none.

## Verified staging evidence — October 16, 2026

- [PLAN run 38928287615](https://github.com/kiyengar27/helix/actions/runs/38928287615): build and server validation passed; all 14 resources retained, no drift, deploy skipped.
- [DEPLOY run 38928472739](https://github.com/kiyengar27/helix/actions/runs/38928472739): owner approved; transaction returned 200 for all 14 existing resources; post-deploy verification passed without duplicates or drift.
- Both used main commit eabc55833c1aabd0232a14d0304fd11f4c1204ad. Reports are attached to the runs, subject to 14-day retention.
- Fresh local authentication confirmed the identifier-scoped policy. Patient, ProjectMembership and ClientApplication searches returned 403; Medplum adds read-only schema metadata rules.

This verifies the existing-resource transaction path. First-time creation under the restricted policy, update/delete denial through attempted mutations, future identifiers, and new resource types were not exercised. Do not infer them from this run.

For every future change: show the plan first, obtain approval before dispatching deploy, then wait for the separate GitHub environment approval. Do not approve the owner's deployment review on their behalf.

## Care-delivery expansion

The care-delivery deployment supersedes the original foundation-only invocation described above. Read [the reviewed-plan contract](care-delivery-deployment.md): PLAN generates a same-commit artifact; DEPLOY requires its run ID and checks versions/digests before bounded updates. The generated expanded AccessPolicy must be reviewed and applied by the owner before authoritative planning. Foundation validation evidence above remains historical, not proof of the expanded deployment.
