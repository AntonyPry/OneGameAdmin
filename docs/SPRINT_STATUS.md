# Sprint Status: SaaS Stabilization

Date: 2026-07-02

## Goal

Stabilize the current `dev` working tree into a reliable SaaS foundation for OneGameAdmin.

The product should support multiple computer clubs. Administrators should understand how much money and bonuses they earn, while club/platform admins should manage clubs, users, roles, and club settings.

## Current Baseline

- Branch: `dev`
- `dev`, `main`, and `origin/main` currently point to the same commit: `4c1719f`.
- The SaaS work exists as a large uncommitted working-tree diff on `dev`.
- Remote branches after fetch: only `origin/main`.
- Client build currently passes with Vite.
- Key backend files pass `node --check`.
- Runtime with MySQL and Smartshell was not verified.

## Product Rule Updates

- 2026-07-04: Motivation rules changed. `docs/MOTIVATION_RULES.md` is the source of truth for the next motivation feature slice.
- The old per-minute salary model and category-specific bonus gates are deprecated.

## Active Risks

- `Club.id` and `Club.smartshell_id` are mixed in service/controller calls.
- Club salary/bonus settings are stored in `Club.settings`, but award logic reads `club.salary_rates` and `club.bonuses`.
- Frontend auth state is split between old `sessionStorage` and new `localStorage`.
- Public registration is open and seed data does not create a usable login/user-club membership.
- Roles are too implicit: `owner`, `manager`, and `admin` exist, but platform-level administration is not modeled.
- Club management and club settings UI/API do not exist yet.
- Manager password flow is still present in the client, while backend now expects role-based authorization.
- Hardcoded Smartshell credentials and old password config remain in code.
- Motivation logic still uses the old model: per-minute salary rates, a boolean responsibility checklist, combined PS/services revenue, and separate category plan gates.

## Stabilization Slices

1. Backend tenant/settings foundation.
2. Backend auth and RBAC hardening.
3. Backend club, settings, and user administration.
4. Frontend auth, active club, and role-aware routing.
5. Frontend club/settings/user administration.
6. Motivation rules update for backend calculation, club settings, admin panel, and confirmation form.
7. Product screen stabilization for admin panel, plans, and exports.
8. QA/release verification across backend, frontend, roles, motivation rules, and browser.

## Next Action

Open the first feature chat with Prompt 1 from `docs/SAAS_STABILIZATION_PLAN.md`.
