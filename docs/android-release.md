# Releasing ZeroSpam for Android

This takes the app in `apps/mobile` from source to a Google Play **internal testing** release.
Do the steps in order. The one-time setup takes an afternoon; Google's review of the first
release can take a few days.

You need: a computer with Node 22 and this repo (`npm install` at the root), a Google account,
and an Android phone.

---

## 1. Accounts (one time)

1. **Google Play Console** — <https://play.google.com/console/signup>, $25 one-time.
   - Choose **Organization** if you'll publish as SAALR LLC. Google asks for a D-U-N-S number;
     getting one is free but takes a few days. Choose **Personal** to start sooner.
   - **Personal accounts created after 13 Nov 2023:** before the app can go to *production*,
     Google requires a closed test with at least 12 testers opted in for 14 days in a row
     ([Google's rules](https://support.google.com/googleplay/android-developer/answer/14151465)).
     Internal testing, which this guide covers, doesn't count toward that and isn't limited by
     it. The rule is written for personal accounts, so check the current policy if you sign up
     as an organization.
2. **Expo** — <https://expo.dev/signup> (free). Expo's EAS service builds and signs the app.
3. **Firebase** — <https://console.firebase.google.com>, same Google account. Android delivers
   push notifications through Firebase.

## 2. Connect the project to Expo (one time)

```
npm install -g eas-cli
eas login
cd apps/mobile
eas init
```

`eas init` creates the project on expo.dev and prints a **project ID**. Because the app also
has an `app.config.js`, it may ask you to add the ID by hand. If it does, put it in
`apps/mobile/app.json`:

```json
"extra": { "eas": { "projectId": "the-id-it-printed" } }
```

Commit that change; the ID isn't secret.

## 3. Push notifications (one time)

1. In Firebase: **Add project** → name it "ZeroSpam" (Analytics off is fine) → **Add app** →
   Android → package name **`email.zerospam.app`** → **Register** → download
   **`google-services.json`**. Skip the remaining SDK steps; Expo handles them.
2. Give the file to EAS so builds include it without committing it. On
   <https://expo.dev>, open the **zerospam** project → **Environment variables** → **Add
   variable**:
   - Name `GOOGLE_SERVICES_JSON`, type **File**, visibility **Secret**.
   - Environments **production** and **preview**.
   - Upload `google-services.json`.

   You can also keep a copy in `apps/mobile/` for local builds. It's git-ignored.
3. Let Expo send through Firebase. In Firebase: **Project settings** → **Service accounts** →
   **Generate new private key** (downloads a JSON key). Then:
   ```
   eas credentials -p android
   ```
   Choose the **production** profile → **Google Service Account** → **Manage your Google
   Service Account Key for Push Notifications (FCM V1)** → **Upload a new key** → pick the JSON
   key. Then delete the key file from your Downloads folder.
4. Turn sending on in the server. Follow "Turning on mobile push notifications" in
   `docs/deploy-runbook.md`.

## 4. Build

```
cd apps/mobile
eas build -p android --profile production
```

- The first time, answer **Yes** to "Generate a new Android Keystore?". Expo stores the upload
  key; you never handle it. Don't lose access to the Expo account.
- The build runs on Expo's servers (about 15 minutes) and gives you a link to an **.aab** file.
  Download it.
- To try the app on your own phone first, run `eas build -p android --profile preview`
  instead. It produces an **.apk** you can install directly from the link.

## 5. Create the app in Play Console (one time)

**Create app** → name "ZeroSpam", default language English (US), **App**, **Free**, accept
the declarations. Free is correct: subscriptions are sold on the website, not in the app.

Then complete **Dashboard → Set up your app**. Answers for each section:

| Section | Answer |
|---|---|
| Privacy policy | `https://zero-spam.email/privacy-policy` |
| App access | **All or some functionality is restricted.** Add instructions plus a test account Google's reviewers can sign in with (see below). |
| Ads | No ads |
| Content rating | Questionnaire category **Utility / productivity / communication**. Answer **No** to violence, sexuality, gambling and similar questions. Users can communicate: **Yes** (email). |
| Target audience | 18 and over |
| News app | No |
| Data safety | See the table below |
| Government app | No |
| Financial features | None |
| Health | None |
| Account deletion | **Yes**, users can create accounts. Delete URL: `https://zero-spam.email/delete-account`. In-app path: More → Delete account. |

**Reviewer account:** create a normal account on zero-spam.email, for example
`play-review@<your domain>`, with a fresh password and **no** two-factor sign-in. Send it a
few emails so the inbox isn't empty. Put the email address and password in **App access**.
To stop its trial from expiring, mark it exempt on the server:

```
sudo sqlite3 /data/zerospam.sqlite "UPDATE accounts SET billing_exempt = 1 WHERE id = (SELECT account_id FROM users WHERE email = 'play-review@…');"
```

### Data safety answers

**Does your app collect or share any of the required user data types?** Yes.
**Is all of the user data collected by your app encrypted in transit?** Yes.
**Do you provide a way for users to request that their data is deleted?** Yes.

| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Personal info → **Email address** | Yes | No | Required | Account management, App functionality |
| Messages → **Emails** | Yes | No | Required | App functionality |
| Device or other IDs → **Device or other IDs** (push token) | Yes | No | Optional | App functionality |

Everything else is **not collected**: location, contacts, photos, files, app activity,
analytics, diagnostics, and financial info. Card payments happen on Stripe's website, never
in the app. "Shared" means sent to a third party for its own use. Hosting providers and the
push service act on our behalf, so they don't count.

## 6. Store listing

Under **Grow → Store presence → Main store listing**:

- **App name:** ZeroSpam
- **Short description (80 characters max):**
  `Email where only the people you approve reach your inbox. No spam, ever.`
- **Full description:**
  > ZeroSpam turns email around: instead of filtering spam out, it only lets in the people you approve.
  >
  > • **Screener:** someone new writes to you, and they wait in the Screener until you decide. Allow them once and their mail goes straight to your Inbox from then on.
  > • **Quarantine:** mail from senders you haven't approved waits safely and deletes itself after 7 days.
  > • **Aliases:** give every website its own address. Forward to your existing inbox, reply privately without revealing your real address, and switch an alias off the moment it starts getting spam.
  > • **Private by design:** messages open with remote images and trackers blocked. When you choose to show images, they load through ZeroSpam, so senders never see your IP address or when you opened the message.
  > • **Notifications only for mail that matters:** your phone only buzzes for approved senders.
  >
  > Get a free @zero-spam.email address in under a minute. Three months free.
- **App icon:** `apps/mobile/store/play-icon-512.png`
- **Feature graphic:** `apps/mobile/store/play-feature-graphic.png`
- **Phone screenshots:** 2–8 screenshots taken on your phone. Good choices are the Inbox, a
  message, the Screener, Aliases, and the More screen in Night mode. On most phones, press
  Power + Volume down to take one.
- **Category:** Communication. **Contact email:** postmaster@zero-spam.email.

Keep prices and "subscribe" wording out of the listing and the app. Google Play doesn't allow
pointing users to payment outside Google Play.

## 7. Release to internal testers

1. **Test and release → Testing → Internal testing → Testers:** create an email list with your
   own Google account and anyone else testing, up to 100 people. Save.
2. **Create new release** → upload the `.aab` from step 4. The first upload has to be manual.
   Release name: `1.0.0 (1)`. Release notes: "First test build." → **Next** → **Save and
   publish**.
3. Copy the **opt-in link** from the Testers tab and open it on each tester's phone. It shows
   a "Become a tester" page, then the Play Store install page. A new app can take from a few
   minutes to a couple of days to appear.

## 8. Later releases

1. Raise `"version"` in `apps/mobile/app.json` when users should see a new version number.
   EAS increases the build number automatically.
2. `eas build -p android --profile production`
3. Upload the `.aab` in Play Console (step 7.2). Alternatively, automate this step:
   - In Play Console → **Setup → API access**, create a service account with **Release
     manager** permission.
   - Save its key as `apps/mobile/google-service-account.json` (git-ignored).
   - Then run `eas submit -p android --profile production`. This uploads the newest build to
     internal testing as a draft.

## Troubleshooting

- **No notifications:**
  - Check that **More → Notifications → New mail** is on and that Android allows
    notifications for ZeroSpam.
  - Check that `PUSH_ENABLED=true` is set on the server.
  - Check that the build was made after step 3. Builds without `google-services.json` can't
    receive pushes.
  - Expo's dashboard shows push delivery receipts under **Push notifications**.
- **"Your free trial has ended" in the app:** this is correct for an unpaid account after the
  trial. The account owner subscribes on the website.
- **The app can't sign in but the website can:** the app talks to `https://zero-spam.email`.
  Check that the server is up and the certificate is valid.
