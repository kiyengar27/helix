# Developer setup

## Prerequisites and local checks

Use Node.js major 24, version 24.2 or newer, npm, Git, and Make. Clone the repository, then run `npm ci` in `code/`. Use the lockfile; avoid unnecessary dependency upgrades.

| Command, from code/ | Purpose | Medplum credentials | Writes to Medplum |
|---|---|---|---|
| `make build` | Type-check and local tests | No | No |
| `make test` | Local tests | No | No |
| `make preview` | Build and render outgoing transaction | No | No |
| `make plan` | Build, server validation, compare configuration | Yes | No resource persistence |
| `make verify` | Require all expected resources without drift | Yes | No resource persistence |
| `make deploy` | Build, validated apply, verify | Yes | Yes |

Build is a validation target, not a compiled distributable. Tests check agreed inventory, stable identifiers, conditional requests, and relationships. They do not prove credentialing, authorization, scheduling, or clinical behavior.

## Optional Medplum reference checkout

From the Helix root, assuming both repos live alongside each other:

```sh
git clone --depth 1 https://github.com/medplum/medplum.git ../medplum
ln -s ../medplum medplum-link
```

The ignored symlink is not required for CI. Reference the relevant docs and examples before implementation. Do not rerun clone/link commands if those paths already exist.

## Credentials for authorized maintainers

From the repository root:

```sh
cp .env.example .env
chmod 600 .env
ln -s ../.env code/.env
```

Skip creation if files already exist. Fill credentials locally; never paste them into issues, PRs, logs, or chat. The ignored symlink is local setup and is not present in a fresh clone.

`config/staging.json` pins the owner's target project. Deployment refuses another project. For an independent sandbox, intentionally update that configuration in your own branch/fork. MEDPLUM_BASE_URL must be the allowed Medplum host. Do not send fork workflows the owner's credentials.

## Making a change

1. Create a branch and review related requirements/ADRs.
2. Change JSON for configuration; change TypeScript for deployment behavior.
3. Preserve managed identifiers and fullUrls. A renamed identifier can create duplicates.
4. Run `make build` and inspect `make preview`.
5. Open a PR; authorized maintainers perform staging checks separately.
6. Update relevant documentation and docs/STATUS.md.

## Troubleshooting

- Missing commands/packages: verify Node 24 and run `npm ci` in code/.
- Missing credentials: check the local .env setup without printing its contents.
- Project mismatch: verify intended credentials/configuration; do not remove the guard.
- Managed-field differences: deployment intentionally blocks. Review differences; editing JSON does not update existing records.
- Existing foundation verification failure: check access permissions and identifiers before assuming resources were deleted.

## Care-delivery and lifecycle preview

`npm run preview:care-delivery -- 2026-10-20T00:00:00Z` (from code/) renders the proposed resource collection and operating/lifecycle manifests at an explicit UTC timestamp, including configuration impacts. It is local-only and is not consumed by foundation deployment. See [clinic lifecycle](clinic-lifecycle.md) before changing physical site status.

## Reviewed care-delivery deployment

The main npm/Make preview, plan, apply and verify commands now use the care-delivery compiler; see [the deployment contract](care-delivery-deployment.md). Apply requires reports/plan.json (or --plan-file), not automatic planning. Commit configuration before authenticated checks. The original provision-foundation.ts remains a legacy reference and is not called by the staging workflow.
