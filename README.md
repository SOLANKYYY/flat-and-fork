# Flat & Fork

Shared meals, kitchen duties and laundry turns for a rented home. This Vercel version retains the original design and adds resident/cook roles and recurring washing/drying schedules.

**Start with [DEPLOY-TO-VERCEL.md](DEPLOY-TO-VERCEL.md).** This folder is the complete Next.js application; no separate backend server is needed. Supabase provides authentication and durable PostgreSQL storage.

## Included

- A resident creates a flat and receives separate resident and cook invitation codes.
- Residents share preferences, suggest meals and vote. Cooks can suggest meals, start plans, apply majority-approved changes, mark meals prepared and update supplies.
- Only residents count toward the strict majority and receive dishwashing duties. Cook accounts cannot read or modify laundry schedules.
- The owner sets recurring washing days and independent washing/drying orders. Drying can happen the same day, one day later or two days later.
- The laundry screen shows the upcoming person and the person after them. Residents can manually reassign one occurrence without changing future rotation. The assignee or owner marks completion.
- New future rotations retain earlier turns. Add new residents to the next rotation when required.
- Food, votes, duties, supplies and laundry data persist in Supabase. Updates use version checks to avoid overwriting simultaneous changes.
- One account belongs to one flat. Flat creator is a resident with management privileges; cook is a separate role assigned by its invitation code.
- No unrequested redesign: original CSS retained, new feature styles appended.

## Login

Google OAuth and optional email OTP are implemented through Supabase. Enable the chosen provider before inviting roommates. ChatGPT sign-in from the original hosted preview is platform-specific and is not carried into this standalone Vercel app. The old preview and its database remain separate; existing preview accounts/data are not automatically migrated.

Tokens are kept in HttpOnly cookies. The backend verifies the user with Supabase Auth before each protected operation. It does not trust the original hosting platform's user headers on Vercel.

## Local run

Install Node.js 24, open a terminal in this folder, then:

```powershell
npx --yes pnpm@11.25.0 install --frozen-lockfile
Copy-Item .env.example .env.local
npx --yes pnpm@11.25.0 dev
```

Fill `.env.local` using the deployment guide. The labelled sample flat can be viewed without credentials. Shared actions need real configured accounts and a database.

## Checks

```powershell
npx --yes pnpm@11.25.0 typecheck
npx --yes pnpm@11.25.0 test
npx --yes pnpm@11.25.0 build
```

The production Next.js build and 12 model tests passed during preparation. Tests cover role restrictions, duplicate votes, majority rules, flat isolation, recurring laundry, manual reassignment, completion and schedule preservation. Full live Google/email delivery and Supabase integration still require your project credentials and provider configuration. They have not been claimed as tested against a live account.

## Main files

| File | Purpose |
| --- | --- |
| `app/flat-app.tsx` | Existing interface with role-aware controls |
| `app/laundry-panel.tsx` | Laundry schedule, current/next turns and manual edits |
| `app/sign-in.tsx` | Google and email-code sign-in interface |
| `app/api/flat/route.ts` | Authenticated application API |
| `server/model.ts` | Flat permissions, voting and laundry rules |
| `server/auth.ts` | Server-side identity and session handling |
| `server/supabase.ts` | Server-only database and authentication requests |
| `supabase/schema.sql` | Database tables and atomic storage functions |
| `.env.example` | Required configuration names, without secrets |

The database keeps each flat's small shared state in a versioned JSONB document and maintains a separate unique user-to-flat mapping. Database tables and functions are inaccessible to anonymous/authenticated browser database clients. The server-only secret key accesses storage after the Next.js API verifies identity and permissions. Transactional create/join and compare-and-swap updates keep changes consistent.

Dates use Asia/Kolkata. Meal times are suggested labels. Allergy notes are shared for the cook to review; the menu does not automatically validate ingredients. There is no email/SMS notification service for laundry; the app displays upcoming turns and refreshes shared data every 30 seconds.

## Photo

Thali photo by [fuseviews on Unsplash](https://unsplash.com/photos/a-metal-tray-topped-with-different-types-of-food-bKmSUcAGrvI), under the Unsplash License.
