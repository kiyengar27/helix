# Helix declarative provisioning

## Configuration

- `config/foundation.json`: FHIR R4 resources with stable Bundle fullUrls and identifiers.
- `config/staging.json`: intended API endpoint and project ID.
- `.env`: link to private credentials in the project root.

Run from this directory with Node 22+:

```sh
npm ci
npm run typecheck
npm run preview
```

Preview is local only: it renders a transaction Bundle and does not compare against server state. The deployment layer adds identifier-based conditional creation requests. It does not update existing resources, delete removed definitions, or reconcile drift. Do not change identifiers to rename resources; that would create a new resource.

To provision intentionally:

```sh
npm run apply
```

Apply authenticates, verifies the expected project, then submits one transaction. Existing matching resources are retained. The transaction makes cross-references resolvable even when the organization already exists. Multiple matching identifiers cause failure rather than arbitrary selection.

These are initial catalog entries, not operational service availability. Clinics, virtual delivery, provider credentials, schedules, patient assignments and access policies are not provisioned. JSON parsing, selected structural checks and TypeScript checks run locally; full server-side FHIR validation and actual repeat-run behavior remain unverified until connected execution.

## Server-aware checks

`npm run plan` authenticates, verifies the target project, searches stable identifiers, validates each proposed resource through Medplum `$validate`, and reports create/retain plus differences in managed top-level fields. Apply runs the same checks and blocks on differences. This is not automatic update/delete reconciliation. Extra unmanaged fields are retained; array ordering currently affects comparison.

## Initial staging deployment — October 16, 2026

All 14 resources passed server validation and were created in one transaction. A subsequent plan found all resources with no differences; a repeated apply returned 200 for all 14 without new resources. Deployment evidence is in `reports/`.

Permission review found broad project access on the provisioning client. No permissions were changed. Restrict the client before adding patient data or granting wider operational use. The project is still named Helix; logical staging designation is not a separate production environment.

Recovery: preserve reports and resource IDs, stop on unexpected state, and inspect dependent references before any corrective action. Do not automatically delete resources. Restore prior configuration through a separately reviewed correction; create-only deployment does not perform rollback.
