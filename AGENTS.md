# Codex Project Memory

## Product Context

OneGameAdmin is an admin tool for computer clubs. Its purpose is to help club administrators understand how much money and how many bonuses they receive, and what each payment/bonus is earned for.

The intended direction is to evolve the system into a SaaS product that can serve multiple clubs.

Active stabilization epic:

- `docs/SPRINT_STATUS.md`
- `docs/SAAS_STABILIZATION_PLAN.md`
- `docs/MOTIVATION_RULES.md`

## Required Workflow

- Work in Russian by default unless the user switches language.
- Before implementation, read this file, `docs/CODEX_WORKFLOW.md`, relevant project docs, and `git status --short --branch`.
- Use `rg` / `rg --files` for search.
- Do not revert or overwrite user or unrelated uncommitted changes.
- If the working tree is dirty, work alongside existing changes and call out risks.
- Prefer extending existing models, services, routes, pages, and components over creating parallel implementations.
- Keep scope narrow and tied to the requested release slice.
- Do not store secrets, passwords, private keys, or real credentials in docs, logs, commits, or final responses.

## Chat Roles

- HQ / planning chats decompose work, preserve process, and prepare prompts.
- When HQ prepares prompts for feature, QA, docs, or release chats, always include the full copyable prompt text in the chat response, even if the prompt is also saved in docs.
- Feature chats implement one concrete release slice.
- QA / release chats review diff, tests, browser behavior, access control, and release readiness.
- Docs / user-guidance chats update instructions, runbooks, release notes, or onboarding only when that layer exists and is affected.

## Git Hygiene

- Do not use destructive git commands without explicit user approval.
- Before staging, check `git status --short`.
- Do not use `git add .` for focused tasks.
- Stage only files that belong to the current task.
- Keep commits to one logical change.

## UI Work

For UI/design work, final verification must include real browser/visual QA when feasible:

- desktop check;
- mobile check around 390px width;
- text and horizontal overflow check;
- console/network error check;
- URL, role/account, and manual QA scenarios in the handoff.

## Handoff

Every working chat should finish with enough context for another chat to continue: task, branch/worktree, status, changes, checks, risks, and next step.
