# Contributing

Start with README.md and docs/development.md. Use synthetic examples only.

Submit changes through a branch or fork and pull request. Include the problem, resulting behavior, validation performed, and any deployment effect. Run `make build` in code/ before submitting. Explain changes to managed identifiers explicitly.

Public contributors do not need Medplum credentials. Never include secrets or patient information in code, issues, screenshots, artifacts, or pull requests. For a suspected credential exposure, contact the repository owner privately through an already established channel; do not publish the credential in an issue.

The repository owner controls review, deployment identities, secrets, and environment approvals. Public visibility does not provide deployment authority. No contribution license or general software license has yet been chosen.

## Issue-first workflow

Create or identify a GitHub issue before implementation, including documentation and configuration changes. Describe the problem, scope, acceptance criteria, and how completion will be verified. Use an issue-numbered branch for new work, such as `feat/12-provider-roles`.

Reference the issue in the PR. Use `Closes #N` when all acceptance criteria are satisfied; otherwise use `Refs #N`. Add verification results and remaining work, and update docs/STATUS.md with active issue/PR references. Reuse existing issues rather than creating duplicates.
