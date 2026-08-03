# Push Notifications Setup

This document outlines the configuration and setup required for push notifications in the Unleash Your Brave app.

## Current Status

### Completed
- ✅ Firebase project created: `unleashyourbrave-86780`
- ✅ Android app configured with `google-services.json`
- ✅ Flutter Firebase integration completed
- ✅ Push notification service implemented
- ✅ Chat integration with push notifications

### Android Configuration
The Android app is fully configured:
- `google-services.json` file added to `app/android/app/`
- Firebase Gradle plugin added to `build.gradle.kts`
- Minimum SDK set to 23 (required for modern FCM features)

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

The backend will use one of these environment variables to initialize Firebase Admin SDK.

## iOS Configuration (Remaining Steps)

### 1. Apple Developer Account Setup
1. **APNs Authentication Key**:
   - Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/authkeys/list)
   - Create new key with "Apple Push Notifications service (APNs)" capability
   - Download the `.p8` file and note the Key ID

2. **Upload APNs Key to Firebase**:
   - Go to Firebase Console → Project Settings → Cloud Messaging
   - Under "Apple app configuration", upload the `.p8` file
   - Enter Key ID and Team ID (found in Apple Developer account)

### 2. Xcode Project Configuration
1. **Enable Push Notifications capability**:
   - Open `ios/Runner.xcworkspace` in Xcode
   - Select the Runner target
   - Go to "Signing & Capabilities"
   - Click "+ Capability" and add "Push Notifications"

2. **Update provisioning profile**:
   - Ensure your provisioning profile includes the Push Notifications capability
   - This may require regenerating the profile in Apple Developer portal

### 3. Update App ID Configuration
If you haven't already:
1. Go to Apple Developer → Identifiers
2. Select your App ID (`com.unleashyourbrave.unleash_your_brave`)
3. Enable "Push Notifications" capability
4. Save and regenerate affected provisioning profiles

## Testing Push Notifications

### Local Testing
1. Run the app on a physical device (push notifications don't work on simulators)
2. Log in to trigger FCM token registration
3. Check backend logs to confirm token registration
4. Send a test message through the chat to trigger a push notification

### Firebase Console Testing
1. Go to Firebase Console → Messaging
2. Create a new campaign
3. Target specific FCM tokens or user segments
4. Send test notifications to verify delivery

## Implementation Details

### Client Side
- `PushNotificationService` handles FCM token registration/management
- Automatically registers token when authenticated
- Unregisters token on logout
- Integrates with `ChatUnreadCubit` for real-time updates

### Backend Integration
The backend should:
1. Store FCM tokens per user in the database
2. Send targeted push notifications for:
   - New messages when user is offline
   - @mentions in group chat
   - Important announcements
3. Clean up expired/invalid tokens

### Notification Payload Format
```json
{
  "to": "<fcm_token>",
  "notification": {
    "title": "New message in Group Chat",
    "body": "John: Hey everyone! 👋"
  },
  "data": {
    "type": "chat_message",
    "groupId": "group_id",
    "messageId": "message_id",
    "senderId": "sender_id"
  }
}
```

## Troubleshooting

### Common Issues
1. **No token received**: Ensure app has notification permissions
2. **Token registration fails**: Check internet connectivity and Firebase config
3. **Messages not delivered**: Verify backend Firebase Admin SDK setup
4. **iOS notifications not working**: Ensure APNs key is properly configured

### Debug Steps
1. Check device logs for FCM registration errors
2. Verify Firebase project configuration
3. Test with Firebase Console first before backend integration
4. Ensure all certificates and keys are valid and not expired

## Security Considerations

1. **Service Account Security**: Keep Firebase service account keys secure
2. **Token Management**: Implement proper token cleanup and validation
3. **User Consent**: Always request permission before registering for notifications
4. **Data Privacy**: Avoid sending sensitive data in notification payloads