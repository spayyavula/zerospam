// Extends app.json with values that come from the build environment.
//
// Firebase (needed for push notifications on Android): EAS builds read the
// GOOGLE_SERVICES_JSON file variable (`eas env:create --name GOOGLE_SERVICES_JSON
// --type file --value ./google-services.json`); local builds use ./google-services.json
// when present. Without either, the app builds and runs but cannot receive pushes.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? './google-services.json' : undefined);
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}) },
  };
};
