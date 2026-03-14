/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: process.env.APP_ID || "us.visitel.kiosk",
  productName: "Conference Client",
  electronVersion: "29.1.5",
  directories: {
    output: "release", // This will stop the 'dist' folder collision
    buildResources: "build"
  },
  // We tell Electron exactly where the main entry is relative to the app root
  extraMetadata: {
    main: "dist/main.js"
  },
  files: [
    "dist/**/*",
    "package.json"
  ],
  mac: {
    identity: process.env.CSC_NAME || null,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "entitlements.mac.plist",
    entitlementsInherit: "entitlements.mac.plist",
    extendInfo: {
      ElectronTeamID: process.env.APPLE_TEAM_ID || null,
      NSCameraUsageDescription: "Camera access is required for video conferencing.",
      NSMicrophoneUsageDescription: "Microphone access is required for audio calls."
    },
    notarize: {
      teamId: process.env.APPLE_TEAM_ID || null
    },
  }
};