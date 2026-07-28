# iOS Build & TestFlight Guide — TOUPRE VANDE

This document describes how to build the TOUPRE app for iOS and publish it to TestFlight.

---

## What Was Changed

The following changes were made to add mobile support without breaking the existing web app:

### 1. Capacitor Dependencies Added
- `@capacitor/core` — Capacitor runtime
- `@capacitor/cli` — Capacitor CLI (dev dependency)
- `@capacitor/ios` — iOS native platform
- `@capacitor/android` — Android native platform (for future release)

### 2. `capacitor.config.ts` Created
- App ID: `com.toupre.customer`
- App name: `TOUPRE`
- Web directory: `dist` (Vite build output)
- iOS scheme: `capacitor`
- Android scheme: `https`
- Splash screen configuration

### 3. `vite.config.ts` Modified
- Added `base: './'` so asset paths are relative (required for Capacitor's webview)
- No other changes — the web app continues to work identically

### 4. iOS Project Added (`ios/` directory)
- Xcode project with WKWebView
- `Info.plist` configured with:
  - App name: TOUPRE
  - Bundle ID: com.toupre.customer
  - Portrait orientation only
  - Camera and photo library permissions (for product photos and delivery proofs)
  - App Transport Security configured for Supabase API calls
  - Encryption export exemption set to false (no non-exempt encryption)
  - Development region: Haitian Creole (ht)

### 5. Android Project Added (`android/` directory)
- Gradle project ready for future Android release
- No additional configuration needed at this time

### 6. App Icons Generated
- All required iOS icon sizes (20px through 1024px) generated from the official TOUPRE logo
- Located in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

### 7. `.gitignore` Updated
- Added entries for Capacitor-generated files (capacitor.config.json copies, copied web assets, .DS_Store)

---

## What Was NOT Changed

- No database changes
- No business logic changes
- No changes to Supabase connection or configuration
- No changes to any existing React components or pages
- The web app continues to build and run identically

---

## Prerequisites

Before you can build the iOS app, you need:

1. **A Mac computer** — Xcode only runs on macOS
2. **Xcode 15+** — download free from the Mac App Store
3. **Apple Developer Program membership** — $99/year from [developer.apple.com](https://developer.apple.com)
4. **CocoaPods** — install with `sudo gem install cocoapods` (Xcode dependency manager)

---

## Build Commands

### Step 1: Install dependencies (already done, but if setting up fresh)

```bash
npm install
```

### Step 2: Build the web assets

```bash
npm run build
```

### Step 3: Sync web assets to native projects

```bash
npx cap sync ios
```

### Step 4: Open the iOS project in Xcode

```bash
npx cap open ios
```

### Step 5: Configure signing in Xcode

1. In Xcode, click on the "App" project in the left sidebar
2. Select the "App" target
3. Go to the "Signing & Capabilities" tab
4. Check "Automatically manage signing"
5. Select your Apple Developer team from the dropdown
6. Xcode will create a provisioning profile automatically

### Step 6: Set the app version and build number

1. In Xcode, select the "App" target
2. Go to the "General" tab
3. Set:
   - Version: `1.0`
   - Build: `1`

### Step 7: Archive the app for App Store

1. In Xcode, select a device target (not a simulator) — choose "Any iOS Device (arm64)"
2. From the menu: **Product > Archive**
3. Wait for the archive to complete — Xcode Organizer will open automatically

### Step 8: Upload to App Store Connect

1. In Xcode Organizer, click "Distribute App"
2. Select "App Store Connect"
3. Select "Upload"
4. Follow the prompts to upload the build

### Step 9: Configure TestFlight in App Store Connect

1. Log in to [App Store Connect](https://appstoreconnect.apple.com)
2. Go to "My Apps" > "TOUPRE"
3. Navigate to the "TestFlight" tab
4. Add test information (description, feedback email)
5. Click "Submit for Review" — Apple reviews TestFlight builds (usually 24-48 hours)
6. Once approved, add testers by email address
7. Testers will receive an email invitation to install via the TestFlight app

---

## Updating the App After Changes

Whenever you make changes to the web app (React code, styles, etc.):

```bash
# 1. Build the web assets
npm run build

# 2. Sync to iOS
npx cap sync ios

# 3. Open in Xcode and archive again
npx cap open ios
```

Then repeat steps 7-9 above with an incremented build number.

---

## Future Android Release

The Android project is already configured. When ready:

```bash
npm run build
npx cap sync android
npx cap open android
```

Then build a signed APK or AAB in Android Studio for Google Play Store submission.

---

## Troubleshooting

**"Cannot find team" in Xcode signing:**
Make sure your Apple Developer account is logged into Xcode (Xcode > Settings > Accounts).

**Blank screen on iOS:**
Run `npx cap sync ios` again after building — this copies the latest web assets.

**Build fails with "no such module":**
Run `cd ios/App && pod install` to install iOS dependencies.

**App Transport Security errors:**
Already configured in Info.plist with NSAllowsArbitraryLoads. If Supabase adds new domains, update the NSAppTransportSecurity section.
