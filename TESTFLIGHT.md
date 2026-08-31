# Getting Card Builder onto TestFlight

Everything in the repo is ready (app.json has the bundle id + icons +
photo permission, eas.json has build profiles). The steps below need YOUR
accounts, so they can't be fully automated — but it's four commands.

## One-time setup (~30 min, mostly waiting on Apple)

1. **Apple Developer Program** — enroll at
   https://developer.apple.com/programs/enroll/ with your Apple ID
   ($99/year). Approval is usually minutes-to-hours.
2. **Expo account** — you likely have one (used for Expo Go signing).
   If not: https://expo.dev/signup (free tier is fine; iOS builds queue).

## Build + submit (run from the repo)

```bash
npx eas-cli login                 # your Expo account
npx eas-cli init                  # links the repo to an EAS project (writes projectId)
npx eas-cli build -p ios --profile production
#   - first run asks to log into your Apple account and offers to
#     create/manage certificates + provisioning automatically: say YES to all
#   - the build runs in Expo's cloud (no Mac needed), ~15-25 min
npx eas-cli submit -p ios --latest
#   - uploads the finished build to App Store Connect
```

## Invite your friends

1. https://appstoreconnect.apple.com → Apps → Card Builder → TestFlight.
2. The build appears after Apple's automated processing (~15 min).
   First build may ask 2 compliance questions (encryption: answer
   "standard encryption only" → exempt).
3. Internal testing: add testers by email (up to 100, instant).
   External testing: create a group + public link (needs a one-time quick
   Beta App Review, usually < 1 day).
4. Friends install the TestFlight app, tap your invite, done.

## Updating the beta later

```bash
npx eas-cli build -p ios --profile production && npx eas-cli submit -p ios --latest
```
(build numbers auto-increment; testers get the update in TestFlight)

## Notes

- Android testers instead/too: `npx eas-cli build -p android --profile preview`
  produces an installable APK you can just send people — no store needed.
- The subject-cutout feature (auto background removal) is deferred until
  we add native modules; a TestFlight build would actually unlock that
  work, since it doesn't depend on Expo Go anymore.
