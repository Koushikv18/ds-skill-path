
## Audit — current state

**Working & worth keeping**
- Design system in `src/styles.css` (OKLCH tokens, gradients, shadows) — solid, reusable.
- Routing shell: `__root.tsx`, `_authenticated/route.tsx` gate, protected `dashboard`, `modules.$id`, `settings`, `sql-practice`.
- DB: `profiles`, `modules` (seeded 12), `activity_log`, `daily_checklist`, `sql_tasks`, `sql_sessions` with RLS.
- Components: `AppHeader` (correct sign-out hygiene), `WeeklyTracker`, `DailyChecklistCard`, `SqlEditor` (CodeMirror + sql.js).
- Landing page: on-brand, high-conversion structure.

**Real problems (highest impact first)**
1. **Duplicate auth route** — `src/routes/auth.tsx` and `src/routes/login.tsx` are byte-near-identical. Two URLs, one flow, drift risk. `AppHeader` and gate redirect to `/auth`; landing links to `/auth`. `/login` is dead weight → delete it.
2. **No real progression state** — dashboard hardcodes `unlocked={m.id === 1}`. `activity_log.module_passed` is written but never read. No `user_module_progress`. "Mark complete" button on the module page is a fake success.
3. **`any` casts across `activity.ts` and `SqlEditor.tsx`** — supabase types are regenerated; those casts silently hide real errors. Should use typed `.from("daily_checklist")` now that types exist.
4. **Random checklist seeding** — `ensureDailyChecklist` uses `Math.random()` so the same day yields different tasks per refresh (checked in DB only after first insert, but the initial insert is nondeterministic — bad UX for a daily routine).
5. **Landing claims features that don't exist yet** — "real Python notebook", "adaptive difficulty". Either honest ("coming soon" beta) or trim. I'll trim to what ships.
6. **SEO / metadata weak on leaf routes** — only `__root` sets meta; `auth`, `dashboard`, `modules/$id` have no per-route `head()`. Public landing needs canonical + og:image.
7. **`AppHeader` email display** — plain text; no avatar / dropdown. Small polish.
8. **`modules.$id`**: fake CTA, weak "coming soon" — needs a clean, honest module page structure ready to host notebook/task later.
9. **Unused `lovable-error-reporting`**: fine to keep — used in `__root`.

**Out of scope this pass** (explicitly deferred, not silently dropped)
- Pyodide notebook, Claude task generation/grading, GitHub commit flow — big multi-day builds, called out in earlier turns and left for phased work.

## Plan — small focused commits

### Commit 1 — Remove duplication, tighten auth surface
- Delete `src/routes/login.tsx` (dead duplicate).
- No behavior change; single canonical `/auth` route.

### Commit 2 — Real module-progress state
- Migration: `user_module_progress (user_id, module_id, status['locked'|'unlocked'|'in_progress'|'passed'], passed_at, updated_at)` with RLS, GRANTs, unique(user_id, module_id).
- Trigger/function: when `activity_log.activity_type = 'module_passed'` inserts, mark that module `passed` and unlock the next module in the same level (or the first of the next level).
- On user creation: extend `handle_new_user` to insert Module 1 as `unlocked`.
- Dashboard reads real progress; `ModuleNode` uses real `unlocked/passed/in_progress` states with distinct visuals (checkmark, glow, lock).
- `modules.$id` gate: 404-style "locked" screen unless progress row is `unlocked` / `in_progress` / `passed`.

### Commit 3 — Deterministic daily checklist
- Remove `Math.random()`; derive extra items from a stable hash of `(userId, date)` so today's list is fixed but varies per day/user.
- Type the supabase calls (remove `any` casts made obsolete by regenerated types).

### Commit 4 — Honest landing + per-route SEO
- Trim landing claims to what actually ships (skill tree, SQL practice, daily routine). Keep the notebook/capstone story but label as "coming soon in your dashboard" instead of implying it's live.
- Add `head()` to `/`, `/auth`, `/dashboard`, `/modules/$id` (per-route title + description; og:image only where a real asset exists).

### Commit 5 — AppHeader polish
- Replace inline email with an avatar + dropdown (shadcn `DropdownMenu`, already installed): email, Settings, Sign out. Small but visibly premium.

### Commit 6 — Module detail cleanup
- Remove the fake "Mark module complete" button.
- Structured sections ready to host the notebook: Objectives, Task (Coming soon placeholder that reads as intentional beta), Resources. Keep the SQL-drill cross-link.

Each commit builds and typechecks independently. I'll verify after each.

### Technical notes
- All schema changes go through the migration tool.
- Progress unlock logic in a Postgres trigger (single source of truth, works even if the notebook flow later writes directly).
- No new deps.
