# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via GitHub's [Security Advisories](https://github.com/annminn104/ncam.dev/security/advisories/new)
("Report a vulnerability"). Include reproduction steps and affected package/app
where possible. You can expect an initial response within a few days.

## Supported versions

Only the latest `main` is supported. Fixes land on `main`; there are no
long-lived release branches.

## Dependencies

- Automated updates arrive via Dependabot (`.github/dependabot.yml`), grouped by
  family.
- `pnpm audit` runs in CI and fails the build on **high** or **critical**
  advisories.
- Known/accepted lower-severity advisories, if any, are tracked in the pull
  request that introduced the acceptance.
