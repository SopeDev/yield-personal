# Agent Instructions

## Development workflow

Before implementing a substantial new feature:

- Review PROJECT_DECISIONS.md and PROJECT_PROGRESS.md.
- Identify only ambiguities that materially affect implementation.
- Ask the user only questions whose answers would significantly change the implementation.
- Do not ask for confirmation of information already established in the project.
- Do not create planning or process artifacts unless they provide durable project value.
- After implementation, run the project's verification checks.
- Update PROJECT_DECISIONS.md only for durable decisions.
- Update PROJECT_PROGRESS.md with completed work and the next planned slice.
- Do not stage, commit, or push Git changes. The user always handles Git staging, commits, and pushes.
- Treat project as a mobile-first, installable PWA. Design and implement the smallest viewport first, then enhance layouts for larger screens.

## Tool usage

Use available development tools only when they materially improve accuracy or verification.

### Next.js tooling

For work involving Next.js framework behavior, APIs, routing, rendering,
Server Components, caching, data fetching, middleware, configuration,
or framework-specific errors:

- Consult the version-matched Next.js documentation available to the project
  before relying on remembered framework behavior.
- Use the available Next.js development/diagnostic tooling when investigating
  runtime, build, routing, rendering, or framework-specific issues.
- Prefer project-local/version-matched Next.js documentation over assumptions
  based on older Next.js versions.

Do not invoke Next.js tooling unnecessarily for ordinary TypeScript,
CSS, copy, or simple application logic.

### shadcn

Use the shadcn MCP when:

- searching for an appropriate existing shadcn component,
- checking the current component API,
- or installing a shadcn component.

Do not introduce a shadcn component merely because one exists.
Prefer simple local components when they are sufficient.

### Browser verification

Do not run Playwright or browser automation automatically during normal implementation.

Assume the user will perform manual exploratory testing during development.

Use Playwright/browser tooling only when:

- the user explicitly asks for automated browser verification,
- the user says a feature or development slice is ready for final testing,
- reproducing or diagnosing a browser-specific issue requires it,
- or an existing automated browser test needs to be updated or fixed.

When browser verification is requested, focus on the smallest set of important flows and edge cases needed to validate the change.

Avoid exhaustive browser testing unless explicitly requested.

Prefer static checks, unit/integration tests, and targeted automated tests during normal development.

### Database tooling

Do not use direct database tooling unless inspecting or modifying the actual
development database is necessary.

Prefer application code, migrations, seeds, and automated tests for normal
database development.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
