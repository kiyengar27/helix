import { MedplumClient } from '@medplum/core';
import { buildFoundation, expectedProjectId, expectedBaseUrl } from '../src/foundation.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--apply', '--plan', '--verify'].includes(arg))) throw new Error('Use --plan, --verify or --apply');
  const bundle = buildFoundation();
  if (!args.length) {
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }
  const baseUrl = process.env.MEDPLUM_BASE_URL ?? expectedBaseUrl;
  if (new URL(baseUrl).origin !== 'https://api.medplum.com') throw new Error('Unexpected API host');
  const clientId = process.env.MEDPLUM_CLIENT_ID;
  const secret = process.env.MEDPLUM_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('Missing local client credentials');
  const medplum = new MedplumClient({ baseUrl });
  try {
    await medplum.startClientLogin(clientId, secret);
    const identity = await medplum.get(new URL('auth/me', baseUrl).toString()) as { project?: { id?: string } };
    if (identity.project?.id !== expectedProjectId) throw new Error('Project mismatch; no resources written');
    const refs = new Map<string, string>();
    const existing = new Map<string, Record<string, unknown>>();
    for (const entry of bundle.entry ?? []) {
      const resource = entry.resource!;
      const found = await medplum.searchResources(resource.resourceType, entry.request!.ifNoneExist!);
      if (found.length > 1) throw new Error('Duplicate managed identifier');
      if (found[0]) {
        refs.set(entry.fullUrl!, `${resource.resourceType}/${found[0].id}`);
        existing.set(entry.fullUrl!, found[0] as unknown as Record<string, unknown>);
      }
    }
    function normalize(value: unknown): unknown {
      if (typeof value === 'string') return refs.get(value) ?? value;
      if (Array.isArray(value)) return value.map(normalize);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,normalize(v)]));
      return value;
    }
    const plan = [];
    for (const entry of bundle.entry ?? []) {
      const resource = entry.resource!;
      const outcome = await medplum.validateResource(resource);
      const errors = outcome.issue?.filter(i => ['error','fatal'].includes(i.severity));
      if (errors?.length) {
        console.error(JSON.stringify({resourceType:resource.resourceType,validation:errors.map(i=>({code:i.code,details:i.details?.text,expression:i.expression}))}));
        throw new Error('FHIR validation failed');
      }
      const current = existing.get(entry.fullUrl!);
      const desired = normalize(resource) as Record<string, unknown>;
      const drift = current ? Object.keys(desired).filter(k=>JSON.stringify(normalize(current[k]))!==JSON.stringify(desired[k])) : [];
      plan.push({resourceType:resource.resourceType,name:'name' in resource?resource.name:undefined,action:current?'retain':'create',drift});
    }
    console.log(JSON.stringify({projectId:expectedProjectId,plan},null,2));
    if (plan.some(p=>p.drift.length)) throw new Error('Managed fields differ; no writes performed');
    if (args.includes('--verify') && plan.some(p=>p.action !== 'retain')) throw new Error('Expected resources are missing');
    if (!args.includes('--apply')) return;
    const response = await medplum.executeBatch(bundle);
    if (response.type !== 'transaction-response' || response.entry?.length !== bundle.entry?.length || response.entry?.some((entry) => !entry.response?.status?.startsWith('2'))) {
      throw new Error('Unexpected transaction response; inspect project before retry');
    }
    console.log(JSON.stringify({ projectId: expectedProjectId, results: (response.entry ?? []).map((entry) => ({status: entry.response?.status, location: entry.response?.location})) }, null, 2));
  } finally {
    medplum.clear();
  }
}
main().catch(() => { console.error('Provisioning failed. Check credentials, project, permissions and resource validity. Sensitive error details suppressed.'); process.exitCode = 1; });
