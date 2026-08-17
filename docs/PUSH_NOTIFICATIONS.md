# Push Notifications Setup

This document outlines push setup for Unleash Your Brave (Android + iOS).

## Current Status

### Done in code
- Firebase project: `unleashyourbrave-86780`
- Android: `google-services.json`, FCM channels, branded notification icon
- iOS: `GoogleService-Info.plist`, Push entitlements, Background Modes (`remote-notification`), AppDelegate APNs registration, FCM token wait/retry
- Flutter: `PushNotificationService` (foreground / background / tap deep links)
- Backend: FCM via Firebase Admin (`FIREBASE_SERVICE_ACCOUNT_JSON`), chat + announcement pushes with APNs headers

### Critical for current bundle ID
Xcode bundle ID is **`com.unleashyourbrave.unleashapp`**.

Firebase iOS app is registered for that bundle:  
`1:685556814574:ios:d6b36e87ff7b4145c4d9ff`  
(`GoogleService-Info.plist` + `firebase_options.dart` updated).

**Still required:** upload the APNs Auth Key (`.p8`) under  
Firebase → Project settings → Cloud Messaging → Apple app configuration  
for this iOS app (Key ID + Team ID `987L6GAS2B`). Without that, Android works and iOS does not.

---

## Backend (already expected on App Runner)

Set **Firebase Admin** credentials:

- `FIREBASE_SERVICE_ACCOUNT_JSON=<service-account-json>`  
  or `FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json`

Generate the key from:  
[Firebase → Project settings → Service accounts](https://console.firebase.google.com/project/unleashyourbrave-86780/settings/serviceaccounts/adminsdk)

---

## iOS — complete these console steps

Bundle id (must match Xcode / Firebase):  
`com.unleashyourbrave.unleashapp`  
Team id in Xcode: `987L6GAS2B` (current signing team)

Firebase iOS app for this bundle (created):  
`1:685556814574:ios:d6b36e87ff7b4145c4d9ff`

### 1. Enable Push on the App ID
1. [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Open or create `com.unleashyourbrave.unleashapp`
3. Enable **Push Notifications** → Save
4. If you use manual profiles, regenerate them (Automatic signing in Xcode usually refreshes itself)

### 2. Create an APNs Auth Key (.p8)
1. [Certificates, Identifiers & Keys → Keys](https://developer.apple.com/account/resources/authkeys/list)
2. **+** → enable **Apple Push Notifications service (APNs)**
3. Continue → Register → **Download** the `.p8` (once only)
4. Note **Key ID** and your **Team ID** (`987L6GAS2B`)

### 3. Upload the key to Firebase
1. [Firebase Console → Project settings → Cloud Messaging](https://console.firebase.google.com/project/unleashyourbrave-86780/settings/cloudmessaging)
2. Under **Apple app configuration** for this iOS app, upload the `.p8`
3. Enter **Key ID** + **Team ID**
4. Save

### 4. Xcode check (already wired in repo)
Open `app/ios/Runner.xcworkspace` → **Runner** target → **Signing & Capabilities**:
- Team: your Apple team (`987L6GAS2B`)
- Capability **Push Notifications** (entitlements files are in the project)
- **Background Modes** → Remote notifications (also in `Info.plist`)

Debug uses `Runner.entitlements` (`aps-environment` = development).  
Release/Profile use `RunnerRelease.entitlements` (`production`).

### 5. Verify on a physical iPhone
Simulator cannot receive remote push.

1. `cd app && flutter run` on a real device (or archive/install)
2. Sign in and allow notifications
3. Xcode / Flutter logs should show FCM registration (no endless `apns-token-not-set`)
4. Test:
   - Send a chat message while the app is backgrounded
   - Publish an announcement with “Send push” on
5. Tap notification → chat or `/notifications`

---

## Android

Already configured (`google-services.json`, notification channels, brand icon).

---

## Deep links

| Payload | Opens |
| --- | --- |
| `type=announcement` (+ optional `announcementId`) | `/notifications` |
| `type=chat.message` / `groupId` | `/network/chat` |

---

## Troubleshooting

1. **`apns-token-not-set`** — Push capability missing, wrong team, or APNs key not in Firebase
2. **Permission denied** — Settings → Unleash Your Brave → Notifications On
3. **Android works, iOS doesn’t** — almost always APNs key / App ID Push flag
4. **No API delivery** — confirm `FIREBASE_SERVICE_ACCOUNT_JSON` on App Runner
5. **Debug build only** — use development APNs; TestFlight/App Store need production entitlements (Release)

## Security

1. Never commit Firebase service account JSON or the APNs `.p8`
2. Prune invalid FCM tokens (backend already does this)
3. Request permission before registering
