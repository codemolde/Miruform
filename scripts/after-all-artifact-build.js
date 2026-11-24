'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * electron-builder afterAllArtifactBuild hook.
 * Signs each generated .dmg installer with a consistent ad-hoc code signature
 * and verifies that codesign --verify --deep --strict passes on the final file.
 */
async function afterAllArtifactBuild(buildResult) {
  if (process.platform !== 'darwin') {
    return buildResult.artifactPaths;
  }

  const artifacts = buildResult.artifactPaths || [];
  for (const artifact of artifacts) {
    if (artifact && artifact.endsWith('.dmg') && fs.existsSync(artifact)) {
      console.log(`\n======================================================`);
      console.log(`[afterAllArtifactBuild] Signing DMG: ${path.basename(artifact)}`);
      console.log(`======================================================`);
      
      try {
        execSync(`codesign --force --sign - --timestamp=none "${artifact}"`, { stdio: 'pipe' });
        console.log(`  [codesign] Verifying DMG signature with --verify --deep --strict...`);
        execSync(`codesign --verify --deep --strict --verbose=4 "${artifact}"`, { stdio: 'inherit' });
        console.log(`[afterAllArtifactBuild] DMG verified valid on disk: ${artifact}\n`);
      } catch (err) {
        console.error(`[afterAllArtifactBuild] Code signing failed for DMG: ${artifact}`, err);
        throw err;
      }
    }
  }

  return buildResult.artifactPaths;
}

module.exports = afterAllArtifactBuild;
exports.afterAllArtifactBuild = afterAllArtifactBuild;
exports.default = afterAllArtifactBuild;
