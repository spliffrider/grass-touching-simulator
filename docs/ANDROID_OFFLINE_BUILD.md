# Android Offline Build

The Android edition is a deliberately small native WebView shell around the same
production game. It bundles the compiled game, art, and audio inside the APK and
does not request Android's Internet permission.

## Design

- Minimum Android version: Android 7 / API 24.
- Target device: Samsung Galaxy S22 Ultra and comparable modern phones.
- Runtime: the device's existing Android System WebView; no browser engine is
  embedded in the APK.
- Rendering: hardware accelerated with the offline game loop capped at 60 FPS.
  Android 15 and newer also receive a native 60 Hz frame-rate request, reducing
  heat and battery use on 120 Hz phones such as the Galaxy S22 Ultra.
- Persistence: the existing local save remains in WebView local storage.
- Background behavior: simulation and WebView timers pause when the app leaves
  the foreground. There is no offline-time advancement.
- Networking: external navigation is blocked and the final manifest contains no
  Internet or network-state permission.

Only `dist/index.html` and the contents of `dist/assets/` enter the APK. Social
preview art, browser manifests, favicons, source maps, debug output, and other
web-only files are excluded. The soundtrack uses Ogg Vorbis instead of raw PCM,
reducing it from 8.3 MB to roughly 1.1 MB without changing its duration.

## Build

Requirements:

- Node.js 22 or newer.
- JDK 17.
- Android SDK Platform 36, Build Tools 35.0.0, and Platform Tools.

Set `JAVA_HOME` and `ANDROID_HOME`, then run:

```sh
npm run android:apk
```

The installable APK is written to:

```text
artifacts/android/GrassTouchingSimulator-0.1.0-offline.apk
```

The current release APK is approximately 3 MB. It contains no architecture-
specific native libraries, so one file supports the Galaxy S22 Ultra and other
Android 7+ phones without carrying duplicate ARM packages.

The first build creates a private alpha signing key in `.android-signing/`.
Back up that directory securely. Future APKs must use the same key for Android
to install them as updates without deleting the existing app and its save.

## Install On A Phone

1. Send the APK to the phone and open it from Files, Drive, Discord, or another
   trusted source.
2. Android may ask to allow that app to install unknown apps. Enable the option
   for the file-opening app, then return to the installer.
3. Install and launch Grass Touching Simulator.

The APK can be played in airplane mode. Uninstalling the app removes its local
save; installing a newer APK signed with the same alpha key preserves it.
