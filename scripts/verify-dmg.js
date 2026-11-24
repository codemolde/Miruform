'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Standalone verification utility:
 * 1. Checks codesign --verify --deep --strict on all .dmg files in dist/
 * 2. Mounts each DMG and checks codesign --verify --deep --strict on the enclosed .app
 * 3. Safely unmounts every DMG.
 */
function verifyDistDmgFiles(distDir = path.join(__dirname, '..', 'dist')) {
  if (!fs.existsSync(distDir)) {
    console.log(`Dist directory does not exist: ${distDir}`);
    return { success: true, verified: [] };
  }

  const pkgPath = path.join(__dirname, '..', 'package.json');
  let prefix = 'Miruform';
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      prefix = (pkg.build && pkg.build.productName) || pkg.name || 'Miruform';
    } catch (_) {}
  }

  const dmgFiles = fs.readdirSync(distDir)
    .filter(f => f.endsWith('.dmg') && f.startsWith(prefix))
    .map(f => path.join(distDir, f));

  if (dmgFiles.length === 0) {
    console.log(`No .dmg files found in ${distDir}`);
    return { success: true, verified: [] };
  }

  const results = [];

  for (const dmgPath of dmgFiles) {
    const filename = path.basename(dmgPath);
    console.log(`\n==================================================`);
    console.log(`Verifying DMG: ${filename}`);
    console.log(`==================================================`);

    // 1. Verify DMG code signature
    try {
      execSync(`codesign --verify --deep --strict --verbose=4 "${dmgPath}"`, { stdio: 'pipe' });
      console.log(`✔ DMG file signature valid on disk: ${filename}`);
    } catch (err) {
      console.error(`✖ DMG file signature verification failed: ${filename}`);
      throw new Error(`DMG signature verification failed for ${filename}: ${err.message}`);
    }

    // 2. Mount DMG and verify .app bundle inside
    const mountPoint = path.join('/tmp', `miruform-verify-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    fs.mkdirSync(mountPoint, { recursive: true });

    let mounted = false;
    try {
      console.log(`Mounting ${filename} at ${mountPoint}...`);
      execSync(`hdiutil attach "${dmgPath}" -mountpoint "${mountPoint}" -nobrowse -readonly`, { stdio: 'pipe' });
      mounted = true;

      const mountedItems = fs.readdirSync(mountPoint);
      const appName = mountedItems.find(f => f.endsWith('.app'));
      if (!appName) {
        throw new Error(`No .app bundle found inside mounted DMG ${filename}`);
      }

      const mountedAppPath = path.join(mountPoint, appName);
      console.log(`Verifying mounted app bundle: ${mountedAppPath}`);
      execSync(`codesign --verify --deep --strict --verbose=4 "${mountedAppPath}"`, { stdio: 'pipe' });
      console.log(`✔ App bundle inside DMG is valid on disk: ${appName}`);

      results.push({ dmg: filename, app: appName, status: 'valid' });
    } catch (mountErr) {
      console.error(`✖ Verification inside mounted DMG failed: ${mountErr.message}`);
      throw mountErr;
    } finally {
      if (mounted) {
        try {
          execSync(`hdiutil detach "${mountPoint}" -force`, { stdio: 'pipe' });
          console.log(`Unmounted ${mountPoint}`);
        } catch (unmountErr) {
          try {
            execSync(`diskutil eject "${mountPoint}"`, { stdio: 'pipe' });
          } catch (_) {}
        }
      }
      try {
        fs.rmdirSync(mountPoint);
      } catch (_) {}
    }
  }

  console.log('\nAll DMGs and their internal .app bundles verified successfully!');
  return { success: true, verified: results };
}

if (require.main === module) {
  try {
    verifyDistDmgFiles();
  } catch (err) {
    console.error('\nVerification failed:', err.message);
    process.exit(1);
  }
}

module.exports = { verifyDistDmgFiles };
