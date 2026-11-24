'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * electron-builder afterPack hook.
 * Performs consistent inside-out ad-hoc code signing on macOS application bundles
 * so that Gatekeeper verifies the signature as intact, avoiding the
 * "Damaged and can't be opened" error.
 */
async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin' && process.platform !== 'darwin') {
    console.log('[afterPack] Skipping macOS code signing: non-darwin target');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = context.appOutDir.endsWith('.app')
    ? context.appOutDir
    : path.join(context.appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) {
    console.warn(`[afterPack] Warning: App bundle not found at ${appPath}`);
    return;
  }

  console.log(`\n======================================================`);
  console.log(`[afterPack] Ad-Hoc Signing macOS App Bundle: ${path.basename(appPath)}`);
  console.log(`======================================================`);

  signAppBundle(appPath);
}

function signAppBundle(appPath) {
  const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');

  if (fs.existsSync(frameworksDir)) {
    // 1. Sign all .dylib libraries inside Frameworks
    try {
      const dylibs = execSync(`find "${frameworksDir}" -type f -name "*.dylib"`, { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(Boolean);
      for (const dylib of dylibs) {
        console.log(`  [codesign] Signing dylib: ${path.basename(dylib)}`);
        execSync(`codesign --force --sign - --timestamp=none "${dylib}"`, { stdio: 'pipe' });
      }
    } catch (err) {
      console.warn('  [codesign] Warning finding dylibs:', err.message);
    }

    // 2. Sign standalone helper executables inside Frameworks (e.g. crashpad, ShipIt)
    const helperExecutables = [
      path.join(frameworksDir, 'Electron Framework.framework', 'Versions', 'A', 'Helpers', 'chrome_crashpad_handler'),
      path.join(frameworksDir, 'Squirrel.framework', 'Versions', 'A', 'Resources', 'ShipIt')
    ];
    for (const helperExe of helperExecutables) {
      if (fs.existsSync(helperExe)) {
        console.log(`  [codesign] Signing helper executable: ${path.basename(helperExe)}`);
        execSync(`codesign --force --sign - --timestamp=none "${helperExe}"`, { stdio: 'pipe' });
      }
    }

    // 3. Sign all .framework bundles
    const frameworks = fs.readdirSync(frameworksDir)
      .filter(f => f.endsWith('.framework'))
      .map(f => path.join(frameworksDir, f));
    for (const fw of frameworks) {
      console.log(`  [codesign] Signing framework: ${path.basename(fw)}`);
      execSync(`codesign --force --sign - --timestamp=none "${fw}"`, { stdio: 'pipe' });
    }

    // 4. Sign all helper .app bundles
    const helperApps = fs.readdirSync(frameworksDir)
      .filter(f => f.endsWith('.app'))
      .map(f => path.join(frameworksDir, f));
    for (const helper of helperApps) {
      console.log(`  [codesign] Signing helper app: ${path.basename(helper)}`);
      execSync(`codesign --force --deep --sign - --timestamp=none "${helper}"`, { stdio: 'pipe' });
    }
  }

  // 5. Sign the root application bundle
  console.log(`  [codesign] Signing root app bundle: ${path.basename(appPath)}`);
  execSync(`codesign --force --deep --sign - --timestamp=none "${appPath}"`, { stdio: 'pipe' });

  // 6. Strict deep verification of the app bundle
  console.log(`  [codesign] Verifying application bundle with --verify --deep --strict...`);
  try {
    execSync(`codesign --verify --deep --strict --verbose=4 "${appPath}"`, { stdio: 'inherit' });
    console.log(`[afterPack] Bundle verified valid on disk: ${appPath}\n`);
  } catch (verifyErr) {
    console.error(`[afterPack] Code signing verification failed for ${appPath}`);
    throw verifyErr;
  }
}

module.exports = afterPack;
exports.afterPack = afterPack;
exports.default = afterPack;
exports.signAppBundle = signAppBundle;
