# CLAUDE.md — NIA Excellence Hub

## Git Workflow (IMPORTANT)

**Branch protection is enabled on `main`. Never push directly to `main`.**

All changes must go through a Pull Request:

1. Create a feature branch: `git checkout -b jon/<short-description>`
2. Make changes and commit
3. Push the branch: `git push -u origin jon/<short-description>`
4. Open a PR: `gh pr create`
5. Merge the PR: `gh pr merge`

Branch naming: `jon/<feature>` or `<name>/<feature>`

## Repository

- **GitHub:** `thenia-org/nia-results-tracker`
- **Vercel:** `thenia-org` team, auto-deploys on merge to `main`
- **Supabase:** Shared project (same for all developers)

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- Supabase (Postgres + RLS)
- Anthropic Claude API (streaming)
- Vercel (Pro plan)

## Key Patterns

- Use `createSupabaseServer()` for API routes
- Use `is_admin()` SECURITY DEFINER function for RLS (never self-referencing policies)
- Use semantic color tokens (`bg-card`, `text-foreground`) not hardcoded colors
- Use `bg-nia-dark-solid` for solid backgrounds, `bg-nia-dark` for adaptive text
- Dark mode uses CSS custom properties + `data-theme` attribute (not Tailwind `dark:`)

## Common Gotchas

- Turbopack cache corruption: `rm -rf .next` to fix
- React Rules of Hooks: never place hooks after early returns
- `overflow-hidden` clips dropdown menus — don't use on card containers
- Asana API: use `workspace` + `memberships` (not `projects`) for task creation
- Supabase RLS + self-reference = infinite recursion
