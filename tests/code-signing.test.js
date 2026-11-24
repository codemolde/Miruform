'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

test('Code Signing: afterPack and afterAllArtifactBuild hooks exist and are functions', () => {
  const afterPackPath = path.join(__dirname, '..', 'scripts', 'after-pack.js');
  const afterArtifactPath = path.join(__dirname, '..', 'scripts', 'after-all-artifact-build.js');
  const verifyDmgPath = path.join(__dirname, '..', 'scripts', 'verify-dmg.js');

  assert.ok(fs.existsSync(afterPackPath), 'after-pack.js script must exist');
  assert.ok(fs.existsSync(afterArtifactPath), 'after-all-artifact-build.js script must exist');
  assert.ok(fs.existsSync(verifyDmgPath), 'verify-dmg.js script must exist');

  const afterPack = require(afterPackPath);
  const afterAllArtifactBuild = require(afterArtifactPath);
  const verifyDmg = require(verifyDmgPath);

  assert.strictEqual(typeof afterPack, 'function');
  assert.strictEqual(typeof afterAllArtifactBuild, 'function');
  assert.strictEqual(typeof verifyDmg.verifyDistDmgFiles, 'function');
});

test('Code Signing: package.json specifies afterPack and afterAllArtifactBuild hooks', () => {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  assert.ok(pkg.build, 'package.json should have a build field');
  assert.strictEqual(pkg.build.afterPack, './scripts/after-pack.js', 'build.afterPack must point to ./scripts/after-pack.js');
  assert.strictEqual(pkg.build.afterAllArtifactBuild, './scripts/after-all-artifact-build.js', 'build.afterAllArtifactBuild must point to ./scripts/after-all-artifact-build.js');
});

test('Code Signing: ad-hoc signed app bundle passes codesign --verify --deep --strict on macOS', (t) => {
  if (process.platform !== 'darwin') {
    t.skip('codesign is only available on macOS darwin');
    return;
  }

  const arm64App = path.join(__dirname, '..', 'dist', 'mac-arm64', 'Miruform.app');
  if (!fs.existsSync(arm64App)) {
    t.skip('dist/mac-arm64/Miruform.app does not exist yet');
    return;
  }

  // Ensure strict verification returns 0
  const output = execSync(`codesign --verify --deep --strict --verbose=4 "${arm64App}" 2>&1`, { encoding: 'utf8' });
  assert.ok(
    output.includes('valid on disk') || output.includes('satisfies its Designated Requirement') || output.trim() === '',
    `Expected valid signature, got: ${output}`
  );
});
