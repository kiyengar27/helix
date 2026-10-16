# Helix Medplum staging project

## User scope
- Set up a sample practice on the hosted free plan, primarily through repeatable scripts. A few manual setup clicks are acceptable.
- Use synthetic data only. Keep credentials out of chat, source control, logs, and deliverables.
- Helix is a multispecialty group; follow the PRD and ADRs in docs/.
- Hosted Bots and outbound email are unavailable on the free plan; run workflow logic locally through the API.

## Medplum implementation rules
Source: https://www.medplum.com/docs/building-with-ai-coding-assistants

- The official repository is linked at `medplum-link/`. Read documentation in `medplum-link/packages/docs/docs/` and real SDK, provider, and example implementations in `medplum-link/packages/` before coding. Resolve documentation slugs against that docs directory. Revisit relevant source after compaction. Treat this checkout as reference material; implement Helix code in `code/`.
- Use FHIR R4, explicitly typed resources from @medplum/fhirtypes, and @medplum/core helpers. Reuse applicable examples, especially Medplum Provider.
- Plan resource relationships before implementation. Use transaction Bundles with urn:uuid fullUrls for cross-referenced entries.
- Use identifier-based conditional writes for repeatability; avoid search-then-create races.
- Follow Medplum's scheduling model: availability is implicit; Slots represent booked or blocked time.
- Verify clinical codes; do not invent fields, codes, search parameters, or operations.
- Type-check and run relevant tests. Use server-side validation when connected, and report any unverified behavior.
- Review authorization and membership changes explicitly. Never rely on UI filtering for access control.

## Workspace
- Keep scratch material in work/ and user-facing deliverables in outputs/.

## Delivery
- Update ADR-003 for system, language, and CI/CD tooling choices rather than adding one ADR per tool.
- Run `make build` from code/ before committing. Never track .env, reports, or medplum-link.
