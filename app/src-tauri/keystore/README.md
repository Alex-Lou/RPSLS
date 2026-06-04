# Release Keystore

This folder holds the **release signing keystore** for the Android Play Store
build. The keystore itself (`release.jks`) and the props file
(`keystore.properties`) are **gitignored** — never commit them.

## One-time setup (do this once per machine)

```bash
# 1. Generate the keystore (Java keytool ships with the Android SDK).
keytool -genkey -v \
  -keystore release.jks \
  -alias rpsls \
  -keyalg RSA -keysize 2048 \
  -validity 10000

# Pick a strong password. WRITE IT DOWN. Losing it means you can never
# ship an update to the Play Store under the same app ID — it would
# require publishing a brand new app and asking every existing user
# to migrate. So don't lose it.

# 2. Create keystore.properties next to release.jks with these 4 lines:
#       storeFile=release.jks
#       storePassword=<your-password>
#       keyAlias=rpsls
#       keyPassword=<your-password>
```

## What gradle does with it

`app/src-tauri/gen/android/app/build.gradle.kts` reads `keystore.properties`
on release builds. If the file is missing it falls back to the debug keystore
so dev builds still work without any setup.

## Building a release APK / AAB

```bash
rtk npx tauri android build --apk --target aarch64       # release APK
rtk npx tauri android build --aab --target aarch64       # release AAB (Play Store)
```

The AAB is what you upload to the Play Console. APK is just for sideloading.

## Backups

After generating, copy `release.jks` to:
- a password manager attachment
- an encrypted backup drive
- (optionally) Google Play App Signing — they hold the master key and you only
  use an upload key. Recommended for new projects.
