# Deploy Flat & Fork to Vercel

The app has been prepared and built locally. It has **not** been deployed to your Vercel account. You need a Supabase project and a Vercel project. No credentials are included in this download.

Updating an existing deployment for multiple flats? Follow [MULTIPLE-FLATS.md](MULTIPLE-FLATS.md) and its migration instead of recreating your database.

## 1. Create the database

1. Open [Supabase](https://supabase.com/dashboard) and create a project.
2. Open **SQL Editor → New query**.
3. Open `supabase/schema.sql` from this folder, paste the complete file into the editor and run it once.
4. In your project's **Connect** dialog, copy the project URL. In **Settings → API Keys**, copy a publishable key and a secret key. Legacy `anon` and `service_role` keys are also supported by this app.
5. Keep the secret key private and enter it only in your local environment file and Vercel's environment settings. Do not paste it into chat, commit it to GitHub, or add a `NEXT_PUBLIC_` prefix.

[Supabase API key instructions](https://supabase.com/docs/guides/getting-started/api-keys).

## 2. Upload this folder to GitHub

Create a new empty GitHub repository, for example `flat-and-fork`. Open PowerShell in the extracted `Flat-and-Fork-Vercel` folder—the folder containing `package.json`—then run:

```powershell
git init
git add .
git commit -m "Add Flat and Fork with cook roles and laundry rotation"
git branch -M main
git remote add origin https://github.com/SOLANKYYY/flat-and-fork.git
git push -u origin main
```

Use your actual repository URL if you choose another name. These commands assume a new empty repository. `.env.local`, dependency folders and generated build files are ignored.

## 3. Import into Vercel

1. Open [Vercel](https://vercel.com/new), import the repository and select **Next.js**.
2. The Root Directory must be the folder that contains `package.json`.
3. Use Node.js **24.x**. Keep the framework's default output directory.
4. Add these environment variables for Production (and Preview if you want separate preview deployments to work):

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | Your project URL, e.g. `https://YOUR-PROJECT.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Your publishable key or legacy anon key |
| `SUPABASE_SECRET_KEY` | Your secret key or legacy service_role key; server-only |
| `APP_URL` | Your final public Vercel URL, without a trailing slash |
| `GOOGLE_LOGIN_ENABLED` | `false` until step 4 is complete, then `true` |
| `EMAIL_LOGIN_ENABLED` | `false` unless step 5 is complete |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`, so Vercel uses the pinned pnpm version |

5. Deploy. The repository has a standard Next.js build script and a `vercel.json` framework setting. Build command is `pnpm build`; do not choose a static HTML preset or set the output to `dist`.
6. If the final URL was unknown, deploy with login disabled, copy the assigned URL into `APP_URL`, configure the login provider below and redeploy.

The sample interface works before account configuration, but real flat creation and shared data do not. Changing environment variables requires a new deployment.

[Vercel Next.js instructions](https://vercel.com/docs/frameworks/full-stack/nextjs) and [pinning the package manager with Corepack](https://vercel.com/docs/builds/configure-a-build#corepack).

## 4. Enable Google login

Google login avoids needing an email delivery service for normal sign-in.

1. In Supabase, open **Authentication → Sign In / Providers → Google**.
2. In [Google Auth Platform](https://console.cloud.google.com/auth/overview), create/select your project and configure the consent screen. If the app is in testing mode, add your flatmates as test users.
3. Create an OAuth client with type **Web application**.
4. Under **Authorized JavaScript origins**, add your final Vercel origin, e.g. `https://YOUR-APP.vercel.app`.
5. Under **Authorized redirect URIs**, add the **Supabase callback URL shown in the Google provider settings**, usually `https://YOUR-PROJECT.supabase.co/auth/v1/callback`. This is different from the app callback in the next step.
6. Copy the Google Client ID and Client Secret into the Supabase Google provider configuration and enable it.
7. In Supabase **Authentication → URL Configuration**, set Site URL to your final Vercel origin and add `https://YOUR-APP.vercel.app/auth/callback` to the redirect allowlist. For local development, also allow `http://localhost:3000/auth/callback`.
8. In Vercel, set `GOOGLE_LOGIN_ENABLED=true`, confirm `APP_URL` is the final URL and redeploy.
9. Open the app → **Create your flat → Continue with Google**. Test a second account separately before sharing broadly.

The Google secret belongs in Supabase's provider settings; it is not needed in this app's code or Vercel variables.

[Official Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 5. Optional: enable email-code login

Skip this if everyone will use Google.

1. Configure **custom SMTP** in Supabase Authentication. Supabase's built-in email sender is for limited testing and will not send to ordinary roommate addresses outside your Supabase project team. Do not disable email verification to work around this.
2. In Supabase's **Magic Link email template**, include the token:

```html
<h2>Your Flat & Fork sign-in code</h2>
<p>Enter this code in the app:</p>
<p>{{ .Token }}</p>
```

3. Enable the Email authentication provider and sign-ups.
4. Set `EMAIL_LOGIN_ENABLED=true` in Vercel and redeploy.
5. The app sends and verifies the code. New verified email users are created automatically. There is no separate password to remember.

[Email OTP setup](https://supabase.com/docs/guides/auth/auth-email-passwordless), [custom SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp). Provider quotas and pricing depend on your chosen plans; this package does not promise unlimited free hosting or email.

## 6. Use the two roles

1. Sign in as yourself and create the flat. The creator is a **resident**.
2. Click **Invite flatmates**. The resident code is for people living in the house.
3. Switch the invite selector to **Cook** and give that separate code to your cook.
4. Other users sign in and select **Join a flat**. The server assigns their role from the invitation code. A user cannot choose a more privileged role in their profile.

| Action | Resident | Cook | Resident who created the flat |
| --- | --- | --- | --- |
| Read menus and preferences | Yes | Yes | Yes |
| Suggest menu changes | Yes | Yes | Yes |
| Vote on meals | Yes | No | Yes |
| Start menu / apply approved changes | No | Yes | Yes |
| Mark meal prepared | No | Yes | Supported by the API |
| Update kitchen supplies | Yes | Yes | Yes |
| View laundry / change one turn | Yes | No | Yes |
| Set future laundry rotation | No | No | Yes |
| Mark laundry or dish duty done | Own assigned turns | No | Any resident's turn |
| Access the cook invitation code | No | No | Yes |

The creator can manage dishwashing assignments. Cooks are excluded from automatic resident chore rotations and the meal-voting majority.

## 7. Set washing and drying turns

1. Invite all residents first.
2. Open **Laundry turns → Set laundry days**.
3. Choose the washing days and the start date.
4. Choose whether drying happens on the same day, the next day or two days later.
5. Use the arrows to arrange washing and drying orders independently, then save.
6. The app calculates future turns automatically. Each panel shows the first upcoming uncompleted turn and the person after it.
7. Use **Change turn** for a manual one-time reassignment. The regular rotation stays intact.
8. Mark a turn done to advance the upcoming display. Uncheck it to undo an accidental completion.

When a new resident joins, the owner should set a future rotation including that person. Earlier turns keep their previous schedule. “Up next” is an in-app display; email/push notifications are not included.

## Before inviting everyone

Test these after configuring your real Supabase project:

- Sign in, create one flat, and refresh: the flat stays saved.
- In a separate browser/account, join with the resident code; then try the cook code using a third account.
- Verify the cook has no laundry tab and cannot cast resident votes.
- Create a meal suggestion, vote from two resident accounts and apply the majority-approved change.
- Set a laundry rotation, manually reassign a turn and complete it from the assignee's account. Refresh both accounts and confirm the upcoming person changes.
- Confirm your production Vercel URL is accessible to your intended users. Vercel deployment protection, if enabled, is separate from the app's login.

The source build and model tests passed locally. Live Supabase functions, Google OAuth, email delivery and multi-account flows need this final check in your configured accounts.

## Existing preview data

The original `chatgpt.site` preview stays as it was. Its ChatGPT identities and D1 data are not silently copied into your Supabase project. This Vercel version starts with a new database and accounts. If you have already entered real data in the preview and want it migrated, export and map it separately before changing everyone over.

