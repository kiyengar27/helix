# Owner checkpoint: restrict staging provisioning

Tracking: GitHub issue #3. This is a proposed policy pending owner application and live verification; it is not an assertion of completed least privilege.

## Policy

`code/config/security/provisioning-policy.json` permits read/search/create for the foundation's explicit managed identifiers on Organization, Location, and HealthcareService. It omits update/delete and all patient, membership, policy, and credential-management resource permissions. It is maintained separately from the foundation transaction so the deployment client cannot manage its own policy.

The identifier criteria are an operational scope, not a tamper-proof identity boundary: a trusted writer can create a resource carrying a permitted identifier. The deployment workflow therefore remains owner controlled. Adding new managed identifiers requires updating this policy through the owner.

## Manual application

1. Keep your human administrator signed in. Do not attach this policy to your own human membership.
2. Create an AccessPolicy named **Helix Staging Foundation Provisioning**, using the JSON in this repository through the editor's JSON mode.
3. In the project membership for **Helix Staging Provisioning** (the client identity), assign this AccessPolicy. Where multiple access-policy entries exist, ensure no broad policy remains alongside it; combined access can retain broader permissions. Do not change the client secret.
4. Tell the implementation agent when saved. Do not send credentials or patient records.

Medplum stores authorization on the client's ProjectMembership; assigning a policy to an unrelated resource does not restrict the client. UI labels may differ. If you cannot find the client membership/access field, report the field labels rather than guessing.

## Verification after application

Use a fresh client login so effective policy changes are reflected. Confirm the intended project, explicit policy rules, successful foundation plan/verify, and denied unrelated access. Medplum may filter unauthorized searches to empty results rather than returning 403, so an empty search alone is not proof of denial. Inspect effective policy and use safe negative checks. Do not attempt destructive writes to prove delete denial.

If validation or transaction access fails, investigate the exact server requirement against official source before granting additional permissions. Do not add wildcard access as a workaround. Retain owner human access to correct the policy.

GitHub secrets and enablement follow only after these checks pass.
