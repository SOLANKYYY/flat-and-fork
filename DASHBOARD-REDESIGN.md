# Home dashboard and Manage flat

This update reorganizes the interface around daily priorities and a single place for flat settings.

## Where to find things

- Visitors and accounts without a flat see a welcome page. Get started creates a flat; Join your flat opens the existing sign-in/join flow. Explore a sample first opens the demo explicitly.
- My day is the default workspace section. It highlights your unfinished kitchen and laundry duties today, members home today, open votes for the selected week, and outstanding shopping items.
- A task opens its relevant kitchen or laundry section at the current week. Today uses the existing India calendar day.
- Manage flat is available in the header, page introduction and dashboard shortcuts. It contains the flat selector, Create another flat, Join another flat, My profile, invitations, and membership actions.
- Owners see Transfer ownership when another resident is available, plus Delete this flat. Other members see Leave this flat. Existing confirmation dialogs and server permissions still apply.
- Our flat includes a name search. Your own kitchen and laundry rows have a teal highlight as well as the existing “you” label.
- The navy-and-teal theme includes wrapping mobile navigation, stacked dashboard cards, scrollable settings and reduced-motion support. Browser zoom remains enabled.

## Deployment

Merge this PR and wait for the production Vercel deployment to finish, then reload the website. No SQL migration, environment changes, database reset or Google authentication reconfiguration is required. This changes the interface only.

The preceding mobile/profile/handover PR (#2) was confirmed merged and its production deployment reported success. A particular failing user action has not been reproduced; this redesign is not a diagnosis of an unspecified error.

## Validation

- Production build and TypeScript check passed.
- All 27 existing model tests passed.
- Server-rendered component checks passed for welcome, personal task display, empty checklist, and cook-specific navigation.
- Actual browser interactions and phone visual/zoom checks remain to be performed on the Vercel preview. Component rendering checks do not verify those interactions.

Before merging, check the welcome screen, sample entry/exit, existing Google sign-in, My day links, Manage flat navigation, member search, and phone portrait/landscape layout. Check Leave/Delete confirmation dialogs without submitting against a real flat. Use disposable test flats to test destructive actions.
