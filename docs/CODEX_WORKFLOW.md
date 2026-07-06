# Codex Workflow

This project follows the workflow imported from `CODEX_PROJECT_WORKFLOW_TEMPLATE.md` on 2026-07-02.

## Main Idea

- Do not turn one chat into an endless all-purpose workspace for the whole project.
- Split work by chat role:
  - `HQ / штаб`: planning, decomposition, prompts, process, and project memory.
  - `feature chat`: one concrete releasable slice.
  - `QA / release chat`: checks result, integration, regressions, UX, tests, and merge/deploy readiness.
  - `docs / user-guidance chat`: optional documentation, instructions, help text, runbooks, release notes, or onboarding.
- Chats must not assume other chats automatically know their results.
- Every working chat must return a clear handoff.
- For large epics, do decomposition in HQ, then feature chats, then QA, then docs/user-guidance if needed.
- Do not mix implementation, QA, docs, and release in one chat without a clear reason.
- When a chat prepares prompts for other chats, include the full prompt text directly in the response so the user can copy it without opening docs.

## General Rules

- Answer in the project language or the language used by the user.
- At the start of development, read local context:
  - `AGENTS.md`;
  - workflow docs;
  - sprint/status docs if present;
  - README and architecture notes when relevant;
  - current `git status`.
- Do not revert other people's uncommitted changes.
- If the working tree is dirty, work around existing changes and explicitly mention risks.
- Use `rg` / `rg --files` for search.
- Do not create a new subsystem before checking for existing models, services, APIs, pages, or domain files.
- Prefer extending existing architecture over creating duplicate implementations.
- Keep scope narrow.
- Do not write secrets, passwords, or private keys into project memory, docs, logs, or final answers.

## HQ / Штаб

HQ is responsible for process, planning, and coordination. It usually does not implement features directly unless the user explicitly asks.

HQ should:

- discuss ideas and turn them into specs;
- check whether requirements are reasonable;
- split a large epic into small releasable slices;
- write starting prompts for feature, QA, and docs chats;
- duplicate every prepared prompt directly in the chat response in a copyable fenced block;
- maintain workflow rules and project memory;
- help decide whether a new chat, branch, worktree, or spec is needed;
- collect handoffs and decide where to route the work next;
- restore process quality if feature chats drift.

HQ should not:

- silently become the main feature chat;
- mix implementation, QA, and docs without an explicit decision;
- keep important reusable rules only in chat history.

## Feature Chat

Rule: `1 feature / 1 chat`. A feature is one verifiable release slice, not the entire epic.

Feature chats must:

1. Read project context:
   - `AGENTS.md`;
   - workflow docs;
   - status/sprint docs;
   - project map/domain inventory if present;
   - current `git status`.
2. Discover existing functionality:
   - models;
   - services;
   - API routes/controllers;
   - frontend pages/components;
   - permissions/access control;
   - tests;
   - generated contracts/types if present.
3. Explicitly decide what existing implementation is being extended.
4. Keep scope within the task.
5. Avoid docs/user-guidance changes without explicit request.
6. Run relevant checks.
7. If UI changed, provide:
   - local URL or prototype URL;
   - role/account to verify;
   - manual QA checklist;
   - desktop/mobile screenshots if this is a UI/design task.
8. Return a final handoff.

Feature final should include:

```md
Summary:
- what changed

Changed areas:
- backend:
- frontend:
- data/migrations:
- permissions:
- tests:

Existing integration points checked:
- existing models/services/routes:
- frontend pages/api/lib:
- permissions:
- generated contracts/types:
- related docs/user guidance:
- why this extends existing code, not duplicates it:

Checks run:
- command:
- result:

Manual QA:
- URL:
- account/role:
- scenarios to click:
- screenshots/outputs:

Known risks:
- ...

Docs / user-guidance impact:
- affected users/roles:
- changed workflows:
- changed screens/routes:
- new user actions:
- docs/help/runbooks/release notes to update:
- screenshots/assets to refresh:
- or `none`

QA handoff:
- scope:
- acceptance criteria:
- files/areas changed:
- risks:
- screenshots/outputs:
```

## QA / Release Chat

QA chats do not start by implementing new features. They review first.

QA receives:

- original spec / acceptance criteria;
- feature final / handoff;
- diff;
- test output;
- screenshots / URLs;
- docs/user-guidance impact if present.

QA checks three levels:

1. Code and contracts:
   - diff;
   - API contracts;
   - migrations;
   - permissions;
   - data integrity;
   - edge cases;
   - regression risks.
2. Automated checks:
   - lint;
   - tests;
   - typecheck;
   - build;
   - domain-specific audits.
3. Product / browser QA:
   - desktop;
   - mobile, usually 390px;
   - role-specific access;
   - empty/loading/error states;
   - console/network errors;
   - overflow/layout issues;
   - real user scenarios from acceptance criteria.

QA final starts with findings by severity:

```md
Findings:
- P0:
- P1:
- P2:
- P3:

Verified:
- commands:
- browser:
- roles:
- screenshots:

Not verified:
- ...

Release status:
- blocked / needs fixes / ready for merge / ready for deploy

Fix prompts:
- prompt for feature chat:
- prompt for docs/user-guidance chat, if needed:

Deploy notes:
- only if release-ready
```

If QA finds an issue, the user returns the fix prompt to the feature chat or opens a separate hotfix chat.

## Docs / User Guidance Chat

Docs/user-guidance chat is needed only if the project has user documentation, help center, instructions, onboarding, training mode, runbooks, release notes, or a similar explanatory layer.

If the project has no such layer, this chat is not needed.

Docs/user-guidance is updated:

- after a standalone release feature;
- or in batches after a large epic stabilizes;
- but before merge/deploy if users, operators, or the team need to understand new functionality.

Do not send the user to docs-chat after every small feature in a large epic. QA accumulates docs/user-guidance backlog and passes a prompt when the epic is stable.

Docs/user-guidance chat must:

- read feature diff and impact;
- update relevant instructions, docs, runbooks, release notes, help text, or training materials;
- avoid inventing screenshots or UI states;
- if the user reports one scenario bug, check the whole class of similar scenarios;
- explicitly state when docs/user-guidance impact is absent.

## Handoff Rule

Any working chat must leave enough context for another chat to continue without the user retelling everything.

Minimum handoff:

```md
Task:
Branch/worktree:
Status:
What changed:
How to run:
How to test:
What was verified:
Known risks:
Next chat should:
```

## Hotfix Rule

Urgent bugs are fixed in a separate branch/commit.

Hotfix chats must:

- start from the current stable/main branch;
- avoid unrelated changes;
- not use `git add .`;
- stage only specific hotfix files;
- keep the diff minimal;
- avoid neighboring refactors unless needed;
- check the relevant scope plus build/lint/test as far as feasible;
- show changed files and checks in the final response.

Hotfix final:

```md
Bug:
Root cause:
Fix:
Changed files:
Checks:
Not checked:
Risk:
Ready for merge:
```

## Project Memory

If a stable rule is discovered, do not leave it only in chat.

Update:

- `AGENTS.md`: short rules needed by all chats;
- `docs/CODEX_WORKFLOW.md` or equivalent: detailed process;
- `docs/SPRINT_STATUS.md` or equivalent: active epic status;
- local vault/project memory: domain maps, decisions, and architecture notes if such a layer exists.

Do not write into project memory:

- one-off decisions;
- temporary guesses;
- secrets;
- passwords;
- private keys;
- random commands that are not a repeatable process.

Before changing project memory, make sure the item is a repeatable rule, not a local one-bug decision.

## Design / UI Rule

For UI/design tasks, a final answer without visual verification is not ready.

UI/design chats must:

- run the project or prototype;
- provide a URL;
- verify desktop;
- verify mobile 390px;
- attach screenshots;
- check text overflow;
- check horizontal overflow;
- check console/network errors;
- avoid building a landing page instead of the requested app/tool;
- avoid hiding important operational data for visual polish;
- avoid breaking existing workflows.

For UI features, `lint/build` and login smoke are not enough. Real visual/browser QA is required.

## Release Rule

Before merge/deploy:

- feature is complete;
- QA passed;
- docs/user-guidance impact is handled or explicitly deferred;
- release checklist is updated if one exists;
- deploy runbook is written or current;
- smoke/health checks are clear;
- known risks are explicit.

Do not write secrets in docs. Use env vars in runbooks, for example `API_SMOKE_PASSWORD`, instead of revealing secret values.

## Branching And Git Hygiene

- Do not revert other people's changes without explicit request.
- Do not use destructive commands without explicit user confirmation.
- Check `git status --short` before staging.
- Do not use `git add .` for focused tasks.
- If the working tree contains other people's changes, stage only your files.
- Commits should match one logical task.
- If a feature is large, prefer several meaningful commits over one huge unstructured commit.

## Suggested Chat Flow

1. User -> HQ:
   - idea;
   - goal;
   - constraints;
   - materials.
2. HQ:
   - clarifies requirements;
   - checks the existing system;
   - splits into feature slices;
   - writes the prompt for the first feature chat.
3. User -> Feature chat:
   - sends prompt.
4. Feature chat:
   - implements;
   - verifies;
   - returns handoff.
5. User -> QA chat:
   - sends feature handoff.
6. QA chat:
   - verifies;
   - if issues exist, writes a fix prompt.
7. User -> Feature chat:
   - sends fix prompt.
8. Repeat until `ready`.
9. If needed, User -> Docs/user-guidance chat:
   - sends accumulated impact.
10. QA/release:
   - final verification;
   - merge/deploy notes.

## Start Prompt Template For A New Feature Chat

```md
Прочитай `AGENTS.md` и workflow docs проекта.

Работай в нужной ветке/worktree проекта.

Feature:
...

Scope:
- ...

Out of scope:
- ...

Existing functionality to inspect:
- ...

Acceptance criteria:
- ...

Checks required:
- ...

Before coding:
- run `git status --short --branch`;
- find existing models/services/routes/pages via `rg`;
- explain which existing integration points you will extend.

At the end return:
- summary;
- changed files;
- checks run;
- manual QA;
- screenshots/URLs if UI changed;
- docs/user-guidance impact;
- QA handoff.
```

## Start Prompt Template For QA Chat

```md
Прочитай `AGENTS.md` и workflow docs проекта.

Review this feature/release. Do not start by implementing fixes.

Original task / acceptance criteria:
...

Feature handoff:
...

Branch/worktree:
...

Please check:
- diff;
- tests/build/typecheck/lint;
- migrations/data risks;
- permissions/access;
- API contract drift;
- UI desktop/mobile;
- console/network errors;
- product acceptance.

Return:
- findings by severity;
- verified checks;
- not verified;
- release status;
- exact fix prompts if needed.
```

## Start Prompt Template For Hotfix Chat

```md
Срочный точечный hotfix.

Work from clean current main/stable branch in a separate branch.
Do not include unrelated changes.
Do not use `git add .`.

Bug:
...

Expected:
...

Actual:
...

Suspected area:
...

Scope:
- fix only this bug;
- no redesign;
- no unrelated refactor;
- no docs changes unless required.

Checks:
- ...

Final:
- root cause;
- changed files;
- checks;
- risk;
- ready/not ready.
```
