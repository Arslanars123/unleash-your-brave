# Push Notifications Setup

This document outlines the configuration and setup required for push notifications in the Unleash Your Brave app.

## Current Status

### Done (shipped in app / backend)
- Firebase project: `unleashyourbrave-86780`
- Android: `google-services.json`, FCM registration, chat + announcement channels
- Flutter: `PushNotificationService` (foreground / background / tap deep links)
- Backend: FCM via Firebase Admin (`FIREBASE_SERVICE_ACCOUNT_JSON`), chat + announcement pushes
- Announcements feed deep link: `type=announcement` → `/notifications?id=…`

### Deferred — iOS push (do later)
iOS code paths are already in the app, but **device push will not work until Apple Developer + APNs are configured**. Until then the app skips FCM registration when APNs is missing (`apns-token-not-set`) and does not crash.

---

## Backend Configuration Required

### Firebase Service Account
The backend requires Firebase Admin SDK credentials to send push notifications.

**Option 1: Service Account Key File**
1. Go to [Firebase Console](https://console.firebase.google.com/project/unleashyourbrave-86780/settings/serviceaccounts/adminsdk)
2. Click "Generate new private key"
3. Download the JSON file
4. Set environment variable: `FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json`

**Option 2: Service Account JSON String**
1. Download the service account key as above
2. Set environment variable: `FIREBASE_SERVICE_ACCOUNT_JSON=<entire-json-content>`

On App Runner this is already expected as `FIREBASE_SERVICE_ACCOUNT_JSON`.

---

## iOS — remaining checklist (do later)

> Goal: real push on physical iPhones for chat + announcements.

### Prerequisites
- [ ] Paid **Apple Developer Program** membership
- [ ] App ID / bundle id: `com.unleashyourbrave.unleash_your_brave` (confirm matches Xcode)
- [ ] Physical iPhone for testing (simulator cannot receive remote push)

### 1. Enable Push on the App ID
1. Apple Developer → **Identifiers**
2. Open the app’s App ID
3. Enable **Push Notifications**
4. Save, then regenerate any affected provisioning profiles

### 2. Create APNs auth key
1. Apple Developer → [Certificates, Identifiers & Keys → Keys](https://developer.apple.com/account/resources/authkeys/list)
2. Create a key with **Apple Push Notifications service (APNs)**
3. Download the `.p8` once; note **Key ID** and **Team ID**

### 3. Upload APNs key to Firebase
1. Firebase Console → Project Settings → **Cloud Messaging**
2. Under Apple app configuration, upload the `.p8`
3. Enter **Key ID** and **Team ID**

### 4. Xcode project
1. Open `app/ios/Runner.xcworkspace`
2. Runner target → **Signing & Capabilities**
3. Add capability: **Push Notifications**
4. (Recommended) Add **Background Modes** → Remote notifications if not already present
5. Ensure signing uses a profile that includes Push

### 5. Firebase iOS app files
1. Confirm `GoogleService-Info.plist` is in the Runner target
2. Confirm the iOS app in Firebase uses the same bundle id

### 6. Verify on device
1. Install a release/dev build on a physical iPhone
2. Grant notification permission on first launch
3. Sign in → logs should show FCM token registration (no `apns-token-not-set`)
4. Test:
   - Send a chat message while app is backgrounded
   - Publish an announcement from admin (with “Send push” on)
5. Tap notification → should open chat or `/notifications`

### Expected until this is done
- Android: push works (when backend Firebase creds are set)
- iOS: silent skip of token registration; in-app notification feed still works over HTTP

---

## Android Configuration

The Android app is fully configured:
- `google-services.json` in `app/android/app/`
- Firebase Gradle plugin in `build.gradle.kts`
- Channels: `chat_messages`, `announcements`

---

## Testing Push Notifications

### Local Testing
1. Run on a **physical device**
2. Log in to trigger FCM token registration
3. Check backend logs for device registration
4. Trigger chat or announcement push

### Firebase Console Testing
1. Firebase Console → Messaging
2. Target an FCM token
3. Confirm delivery before relying on backend sends

---

## Implementation Details

### Client
- `app/lib/core/notifications/push_notification_service.dart`
- Registers/unregisters device tokens with `/chat/devices`
- Deep links:
  - `type=announcement` → `/notifications?id=<announcementId>`
  - chat / `groupId` → `/network/chat`

### Backend
- Tokens stored per user
- Sends for chat messages and published announcements (manual + countdown)
- Prunes invalid tokens after FCM failures

### Announcement payload (data)
```json
{
  "type": "announcement",
  "announcementId": "<uuid>",
  "kind": "manual"
}
```

---

## Troubleshooting

1. **iOS `apns-token-not-set`** — APNs key / capability / paid Apple Developer not done yet (see checklist above)
2. **No token** — notification permission denied, or offline
3. **Android works, iOS doesn’t** — almost always APNs / Firebase Apple config
4. **No delivery from API** — confirm `FIREBASE_SERVICE_ACCOUNT_JSON` on App Runner

## Security

1. Keep Firebase service account JSON out of git
2. Clean up invalid FCM tokens
3. Request permission before registering
4. Avoid sensitive data in notification bodies
