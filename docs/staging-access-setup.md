# Owner checkpoint: restrict staging provisioning

Tracking: GitHub issue #3. This is a proposed policy pending owner application and live verification; it is not an assertion of completed least privilege.

## Policy

`code/config/security/provisioning-policy.json` permits read/search/create for the foundation's explicit managed identifiers on Organization, Location, and HealthcareService. It omits update/delete and all patient, membership, policy, and credential-management resource permissions. It is maintained separately from the foundation transaction so the deployment client cannot manage its own policy.

The identifier criteria are an operational scope, not a tamper-proof identity boundary: a trusted writer can create a resource carrying a permitted identifier. The deployment workflow therefore remains owner controlled. Adding new managed identifiers requires updating this policy through the owner.

## Manual application

1. Sign in to [Medplum](https://app.medplum.com/) with your **human administrator account** and select the Helix project. Do not attach this policy to your own human membership.
2. Create an AccessPolicy named **Helix Staging Foundation Provisioning**, using [the proposed JSON](../code/config/security/provisioning-policy.json) through the editor's JSON mode. If already created, reuse it.
3. Open [the provisioning client's ProjectMembership](https://app.medplum.com/ProjectMembership/f99bac0a-7313-49c6-80c9-e4baeb1798b2). If redirected to sign-in, finish signing in and reopen the link. This ID was previously verified for the owner's Helix project; it does not apply to other projects.
4. Alternatively, open **Project → Clients** and open the membership row for **Helix Staging Provisioning**. Medplum's client administration listing represents ProjectMembership records. The ClientApplication resource page itself is not the membership editor.
5. Confirm the membership's **Profile** references the ClientApplication named **Helix Staging Provisioning**. Choose **Edit**, set **Access Policy** to **Helix Staging Foundation Provisioning**, and save. Where multiple access-policy entries exist, ensure no broad policy remains alongside it; combined access can retain broader permissions. Do not change the client secret.
6. Tell the implementation agent when saved. Do not send credentials or patient records.

Medplum stores authorization on the client's ProjectMembership; assigning a policy to an unrelated resource does not restrict the client. UI labels may differ.

### If you cannot find the membership or field

- A sign-in page is an authentication checkpoint, not proof that the membership is missing. Complete sign-in first.
- If the record is still not found after sign-in, verify the selected project is Helix. Ask the implementation agent to recheck the membership ID through a fresh client login before trying another record.
- If the membership opens but **Access Policy** or **Edit** is absent, report the visible field labels and check that your human account is an administrator. Do not edit a different membership or create a duplicate client as a workaround.
- Keep the provisioning policy unapplied until the client identity is confirmed; do not weaken human administrator access.

## Verification after application

Use a fresh client login so effective policy changes are reflected. Confirm the intended project, explicit policy rules, successful foundation plan/verify, and denied unrelated access. Medplum may filter unauthorized searches to empty results rather than returning 403, so an empty search alone is not proof of denial. Inspect effective policy and use safe negative checks. Do not attempt destructive writes to prove delete denial.

If validation or transaction access fails, investigate the exact server requirement against official source before granting additional permissions. Do not add wildcard access as a workaround. Retain owner human access to correct the policy.

GitHub secrets and enablement follow only after these checks pass.
