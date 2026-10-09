# Multiple flats: update an existing deployment

One account can create and join multiple flats. **My flats** switches the selected flat; each write includes its flat ID and the server checks membership. Resident/cook roles remain separate per flat. Google/email authentication, cookies, API keys and environment variable names are unchanged.

In **Our flat**, members can leave. Owners can transfer ownership to another resident and then leave, or delete the flat after typing its exact name. Deletion permanently removes that flat for all members; the account and other flats stay. Leaving retains historical names and completed chores, removes the person's votes and reassigns pending future chores. Laundry rotations continue without the departing resident.

## Existing Supabase project

1. Review the PR and save a database backup/export before applying the migration.
2. In your existing Supabase project, open **SQL Editor** and run the complete file `supabase/migrations/20261009_multiple_flats.sql`. Run only this migration for an existing database; no project reset or credential change is needed. It replaces the membership primary key `(user_id)` with `(user_id, flat_id)`, preserving current rows, and installs server-only lifecycle functions in one transaction.
3. Test the PR's Vercel Preview against a separate Supabase test project where practical. Use its existing provider configuration; a preview hostname needs its own allowed callback URL if you choose to sign in on that hostname. Production Google configuration stays unchanged.
4. Merge and let Vercel deploy. Use the existing production `APP_URL` and Supabase environment variables. No Google OAuth recreation is needed.
5. Refresh all open app tabs after deployment so they use the updated client. During the transition, old app tabs do not understand multiple memberships and should not be used for writes.

Apply the migration close to deploying the new app. Until both are updated, additional flat creation will remain unavailable or the old interface will show only one flat. The database migration is backward-compatible with existing single-flat data, but older app clients do not understand selecting among multiple memberships. Reverting only application code after users create several memberships does not safely restore single-flat behavior; do not drop membership rows to roll back.

## Check before normal use

- Sign in with your existing Google account and confirm the original flat remains.
- Create another flat. Switch between the two and confirm menus, members and laundry stay separate.
- Join both flats with a second account. Verify its role can differ between flats.
- Leave one flat as a member: refresh both accounts and confirm only that membership disappears.
- Transfer ownership to a resident before the previous owner leaves.
- Delete a disposable test flat as its owner using its exact name. Confirm another flat remains and former members cannot open the deleted flat.

## Local Git workflow (PowerShell)

If you already cloned and created `feature/flat-membership`, retrieve this PR's changes:

```powershell
git status
git fetch origin
git switch feature/flat-membership
git merge --ff-only origin/feature/flat-membership
```

With a clean working tree this fast-forwards the local branch to the remote PR. It does not merge into `main`. To run locally, use Node 24 and your own existing Supabase configuration in `.env.local` (never commit it):

```powershell
npx --yes pnpm@11.25.0 install --frozen-lockfile
npx --yes pnpm@11.25.0 typecheck
npx --yes pnpm@11.25.0 test
npx --yes pnpm@11.25.0 dev
```

Local Google sign-in requires an already allowed localhost callback; use the production app for live verification after deployment if you do not want to add one.

After further local edits, stage only the edited files, commit, and push the same branch. The existing PR updates automatically.

```powershell
git add app/flat-app.tsx
git commit -m "Refine flat selector"
git push -u origin feature/flat-membership
```

## Verification performed

- TypeScript check and production Next.js build.
- 16 model tests, including member leave, isolation, owner restriction and completed laundry preservation.
- Authenticated Next.js API integration test using a local Supabase mock backed by PGlite: create, join, switch, explicit flat scoping, permission rejection, ownership transfer, leave, typed deletion and remaining-flat selection.
- SQL integration checks against isolated PGlite PostgreSQL: migration preserves existing data; migration and fresh schema rerun successfully; multiple memberships; duplicate joins; revision conflicts; owner transfer; leave; deletion cascading only within the target flat; authenticated browser-role access denied.

The optional SQL check requires `@electric-sql/pglite` installed separately and can be run with Node 24 as `node --experimental-strip-types tests/sql-membership.integration.mjs <absolute-path-to-pglite-dist/index.js>`. The API check uses the same PGlite module path: `node --experimental-strip-types tests/api.integration.mjs <absolute-path-to-pglite-dist/index.js>` after building. Live Google, Vercel and your production Supabase project were not changed or tested by this PR.
