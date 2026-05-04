const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro can resolve workspace packages.
config.watchFolders = [workspaceRoot];

// Pin the entire react ecosystem to the mobile workspace's copies.
// Without this, packages in root node_modules (react-native-web, react-navigation)
// pull in the web workspace's React 18, causing a dual-React crash on web preview.
const PINNED_PACKAGES = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'scheduler',
  'react-is',
];

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isPinned = PINNED_PACKAGES.some(
    (pkg) => moduleName === pkg || moduleName.startsWith(`${pkg}/`),
  );
  if (isPinned) {
    // Pretend the request originated from the mobile root so Metro picks
    // apps/mobile/node_modules/react (v19) over the root node_modules (v18).
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, 'index.js') },
      moduleName,
      platform,
    );
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
