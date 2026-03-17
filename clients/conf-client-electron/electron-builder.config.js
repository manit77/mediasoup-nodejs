/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: process.env.APP_ID || "us.visitel.kiosk",
  productName: "ConferenceClient",
  directories: {
    output: "release", // This will stop the 'dist' folder collision
    buildResources: "build"
  }, 
  files: [
    "dist/**/*",
    "package.json"
  ],
  mac: {
    identity: process.env.CSC_NAME || undefined,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "entitlements.mac.plist",
    entitlementsInherit: "entitlements.mac.plist",
    extendInfo: {
      ElectronTeamID: process.env.APPLE_TEAM_ID || undefined,
      NSCameraUsageDescription: "Camera access is required for video conferencing.",
      NSMicrophoneUsageDescription: "Microphone access is required for audio calls."
    },
    notarize: true
  }
};