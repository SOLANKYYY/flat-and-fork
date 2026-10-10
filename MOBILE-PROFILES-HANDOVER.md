# Phone layout, flatmate profiles and daily handovers

## What changes

- Narrow screens use stacked weekly meal cards, wrapping navigation, a single-column flat selector and larger touch controls. Profile and handover dialogs scroll within the screen. Inputs use 16px text to avoid automatic focus zoom on typical iPhone browsers. Pinch zoom remains enabled.
- After signing in and opening/creating/joining a flat, a member whose profile has not been completed sees a profile form. Existing members see it once per flat per page session until saved; **Finish later** remains available.
- **My profile** adds name, optional phone number and optional age alongside existing food preferences. **Our flat** shows those details to that flat's members, including its cook. Phone numbers use a `tel:` link to open the device's dialer; clicking Call does not silently place a call. Google does not supply age or phone here.
- **Home today / Away today** is a self-reported status scoped to one flat and one calendar day in Asia/Kolkata. It resets to home tomorrow. No location tracking is used.
- **I'm away today** lists every unfinished kitchen clean-up, washing and drying turn assigned to the member today, even while browsing another week. Each must be transferred to another resident who is home. All transfers and the away status save atomically through the existing revision-checked database function.
- Completed chores keep their history. Tomorrow's rotation is unchanged. Returning home does not undo a handover already made.
- The assignee or owner can transfer an individual unfinished duty. Other residents cannot change someone else's assignment. Today’s duties cannot be assigned to someone marked away.
- When a new plan, same-day laundry rotation or member departure introduces a duty for someone marked away, it is covered by a resident who is home. If no one is home, that operation stops with an explanation. An already-created duty is never silently dropped.

## Deployment

This builds on the merged multiple-flats update and its migration. **No additional SQL migration, Google OAuth change, environment variable change or database reset is needed.** The new optional values live in the existing flat-state JSONB document. Old flat data loads without conversion.

Review and merge this PR into `main`, wait for the production Vercel deployment to become Ready, then reload existing app tabs. Update all open tabs so old clients cannot make assignments without the new availability checks.

To download this branch in PowerShell from your existing project folder:

```powershell
git status
git fetch origin
git switch --track origin/feature/mobile-profiles-handover
```

If the branch already exists locally, use `git switch feature/mobile-profiles-handover`, then `git merge --ff-only origin/feature/mobile-profiles-handover`.

## Checks performed

- TypeScript and production Next.js build.
- 27 model tests, covering contact validation, partial/forged/duplicate transfers, unavailable recipients, next-day expiry, completed-task history, self-transfer permissions and new schedules while away.
- Authenticated API integration against an isolated local Supabase mock backed by PostgreSQL/PGlite. Includes profile persistence, rejected incomplete handovers, atomic handover/status update and isolation between flats.
- A visual phone-browser check could not be completed because the browser could not access the isolated local preview. Real phone layout, pinch zoom and dialer handoff still need the following device check.

## Phone acceptance check

1. On your phone, sign in and save your profile. Open **Our flat** and confirm your details. Tap another member's Call button to check the number in the dialer; no need to place a call.
2. Check the weekly menu, kitchen, laundry and profile dialog in portrait at 320–390px widths and landscape. Increase browser zoom/text size and confirm forms and buttons remain reachable.
3. With two test residents home, assign today's kitchen and laundry duties to one. That resident opens **I'm away today**, chooses cover for every listed duty, and saves. Refresh both accounts and confirm the new assignments and away badge.
4. Mark that person home again: the status changes, while the transferred duties remain with their recipients.
5. Try an incomplete handover and an away recipient: neither should save. Check another flat and confirm it is unaffected.

Live profiles, attendance, assignments and authentication settings were not modified while preparing this PR.
