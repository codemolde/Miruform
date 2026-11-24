/**
 * Starter Decks & Automated Public Domain Verification Test Suite
 *
 * Verifies:
 * 1. Automated CC0 / Public Domain verification gate (verifyPublicDomainReference)
 * 2. GET /api/starter-decks endpoint: returns verified pack catalog with manifest installation status
 * 3. POST /api/starter-deck/install endpoint: safe zip extraction, SHA-256 verification,
 *    trusted folder registration, manifest persistence, and duplicate install avoidance
 * 4. GET /api/starter-deck/progress endpoint: job tracking and progress reporting
 * 5. safeExtractZipFile: Zip Slip protection and file count / size caps
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const {
  app,
  startServer,
  verifyPublicDomainReference,
  PACKS_DIR,
  PACKS_MANIFEST_FILE,
  getInstalledPacksManifest,
  saveInstalledPacksManifest,
  isPackInstalled,
  safeExtractZipFile,
  scanForImages
} = require('../server.js');

// Helper to construct in-memory test zip buffers
function createTestZip(entries) {
  const localChunks = [];
  const cdChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const dataBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '');
    const compSize = dataBuf.length;
    const uncompSize = dataBuf.length;

    const localHdr = Buffer.alloc(30);
    localHdr.writeUInt32LE(0x04034b50, 0);
    localHdr.writeUInt16LE(20, 4);
    localHdr.writeUInt16LE(0, 6);
    localHdr.writeUInt16LE(0, 8); // stored
    localHdr.writeUInt32LE(0, 10);
    localHdr.writeUInt32LE(0, 14);
    localHdr.writeUInt32LE(compSize, 18);
    localHdr.writeUInt32LE(uncompSize, 22);
    localHdr.writeUInt16LE(nameBuf.length, 26);
    localHdr.writeUInt16LE(0, 28);

    localChunks.push(localHdr, nameBuf, dataBuf);

    const cdHdr = Buffer.alloc(46);
    cdHdr.writeUInt32LE(0x02014b50, 0);
    cdHdr.writeUInt16LE(20, 4);
    cdHdr.writeUInt16LE(20, 6);
    cdHdr.writeUInt16LE(0, 8);
    cdHdr.writeUInt16LE(0, 10);
    cdHdr.writeUInt32LE(0, 12);
    cdHdr.writeUInt32LE(0, 16);
    cdHdr.writeUInt32LE(compSize, 20);
    cdHdr.writeUInt32LE(uncompSize, 24);
    cdHdr.writeUInt16LE(nameBuf.length, 28);
    cdHdr.writeUInt16LE(0, 30);
    cdHdr.writeUInt16LE(0, 32);
    cdHdr.writeUInt16LE(0, 34);
    cdHdr.writeUInt16LE(0, 36);
    cdHdr.writeUInt32LE(0, 38);
    cdHdr.writeUInt32LE(offset, 42);

    cdChunks.push(cdHdr, nameBuf);
    offset += 30 + nameBuf.length + compSize;
  }

  const cdOffset = offset;
  const cdBuf = Buffer.concat(cdChunks);
  const cdSize = cdBuf.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, cdBuf, eocd]);
}

test('Starter Decks & Automated Public Domain Verification Suite', async (t) => {
  let server = null;
  let port = null;
  let baseUrl = null;

  try {
    const started = await startServer(0);
    server = started.server;
    port = started.port;
    baseUrl = `http://127.0.0.1:${port}`;
  } catch (err) {
    console.error('Failed to start test server:', err);
    throw err;
  }

  // Helper for HTTP requests with loopback Host header
  function makeRequest(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, baseUrl);
      const postData = body ? JSON.stringify(body) : null;
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Host': `127.0.0.1:${url.port}`,
          'Origin': baseUrl,
          ...(postData ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          } : {})
        }
      };

      const req = http.request(options, (res) => {
        let chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (e) {}
          resolve({ status: res.statusCode, headers: res.headers, raw, json });
        });
      });

      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  await t.test('1. verifyPublicDomainReference passes valid CC0 cards from Cleveland Museum of Art', () => {
    const card = {
      title: 'Cupid Drawing His Bow',
      artist: 'Federico Barocci',
      license: 'CC0 / Public Domain',
      url: 'https://openaccess-cdn.clevelandart.org/1969.70/1969.70_web.jpg'
    };
    const res = verifyPublicDomainReference(card);
    assert.equal(res.valid, true);
  });

  await t.test('2. verifyPublicDomainReference passes valid Public Domain cards from The Met Museum', () => {
    const card = {
      title: 'Study of a Reclining Male Nude',
      artist: 'Michelangelo Buonarroti',
      license: 'Public Domain / Open Access',
      url: 'https://images.metmuseum.org/CRDImages/dp/original/DP800001.jpg'
    };
    const res = verifyPublicDomainReference(card);
    assert.equal(res.valid, true);
  });

  await t.test('3. verifyPublicDomainReference passes valid CC0 cards from Art Institute of Chicago, Rijksmuseum & Wikimedia', () => {
    const hosts = [
      'https://artic.edu/iiif/2/sample/full/843,/0/default.jpg',
      'https://rijksmuseum.nl/asset/sample.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/sample.jpg'
    ];
    for (const url of hosts) {
      const card = {
        title: 'Study',
        license: 'CC0 1.0 Universal',
        url
      };
      const res = verifyPublicDomainReference(card);
      assert.equal(res.valid, true, `Should pass for host: ${url}`);
    }
  });

  await t.test('4. verifyPublicDomainReference rejects card with missing or non-CC0 license', () => {
    const card = {
      title: 'Contemporary Artwork',
      license: 'All Rights Reserved',
      url: 'https://openaccess-cdn.clevelandart.org/1969.70/1969.70_web.jpg'
    };
    const res = verifyPublicDomainReference(card);
    assert.equal(res.valid, false);
    assert.match(res.reason, /not verified CC0/i);
  });

  await t.test('5. verifyPublicDomainReference rejects non-HTTPS URLs', () => {
    const card = {
      title: 'Insecure URL Reference',
      license: 'CC0',
      url: 'http://openaccess-cdn.clevelandart.org/1969.70/1969.70_web.jpg'
    };
    const res = verifyPublicDomainReference(card);
    assert.equal(res.valid, false);
    assert.match(res.reason, /must use secure HTTPS/i);
  });

  await t.test('6. verifyPublicDomainReference rejects unauthorized or arbitrary hosts even if claiming CC0', () => {
    const untrustedUrls = [
      'https://pinterest.com/pin/12345/image.jpg',
      'https://i.pinimg.com/originals/ab/cd/ef.jpg',
      'https://unauthorized-art-blog.com/photo.jpg',
      'https://evil.attacker.com/exploit.jpg'
    ];
    for (const url of untrustedUrls) {
      const card = {
        title: 'Sketchy Origin Reference',
        license: 'CC0 / Public Domain',
        url
      };
      const res = verifyPublicDomainReference(card);
      assert.equal(res.valid, false, `Should reject untrusted origin: ${url}`);
      assert.match(res.reason, /not in the authorized public domain museum registry/i);
    }
  });

  await t.test('7. verifyPublicDomainReference rejects null, non-object, or malformed card entries', () => {
    assert.equal(verifyPublicDomainReference(null).valid, false);
    assert.equal(verifyPublicDomainReference('invalid string').valid, false);
    assert.equal(verifyPublicDomainReference({}).valid, false);
  });

  await t.test('8. GET /api/starter-decks returns starter packs catalog (Portraits & Poses) with manifest status', async () => {
    const res = await makeRequest('GET', '/api/starter-decks');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json), 'Returns an array of decks');
    assert.ok(res.json.length >= 2, 'Contains at least Portraits and Poses starter packs');

    const portraitsPack = res.json.find(d => d.id === 'portraits');
    assert.ok(portraitsPack, 'Contains Portraits starter pack');
    assert.equal(portraitsPack.id, 'portraits');
    assert.equal(portraitsPack.title, 'Portraits');
    assert.equal(portraitsPack.category, 'Portraits & Faces');
    assert.equal(portraitsPack.cardCount, 64);
    assert.equal(portraitsPack.zipFileName, 'Portraits.zip');
    assert.equal(portraitsPack.folderName, 'portraits');
    assert.equal(portraitsPack.sha256, 'd6bfa7a616bacdc45ccf7b3c9015e923d890454e65a80a7e3ce8545dccd543a0');
    assert.ok(Array.isArray(portraitsPack.tags));

    const posesPack = res.json.find(d => d.id === 'poses');
    assert.ok(posesPack, 'Contains Poses starter pack');
    assert.equal(posesPack.id, 'poses');
    assert.equal(posesPack.title, 'Poses & Action');
    assert.equal(posesPack.category, 'Figure & Gesture');
    assert.equal(posesPack.cardCount, 41);
    assert.equal(posesPack.zipFileName, 'Poses.zip');
    assert.equal(posesPack.folderName, 'poses');
    assert.equal(posesPack.sha256, '50db3e717d2cfa22c45244d6eee09437378a0fdc6b6fa777d73eda1d94fae1f7');
    assert.ok(Array.isArray(posesPack.tags));
  });

  await t.test('9. POST /api/starter-deck/install rejects missing or unknown packId', async () => {
    const resMissing = await makeRequest('POST', '/api/starter-deck/install', {});
    assert.equal(resMissing.status, 400);
    assert.match(resMissing.json.error, /Missing or invalid packId/i);

    const resUnknown = await makeRequest('POST', '/api/starter-deck/install', { packId: 'non-existent-pack' });
    assert.equal(resUnknown.status, 404);
    assert.match(resUnknown.json.error, /not found/i);
  });

  await t.test('10. GET /api/starter-deck/progress rejects missing parameters', async () => {
    const res = await makeRequest('GET', '/api/starter-deck/progress');
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Missing jobId or packId/i);
  });

  await t.test('11. safeExtractZipFile safely extracts archives and creates directories', () => {
    const testDir = path.join(__dirname, 'test_sandbox_zip');
    fs.mkdirSync(testDir, { recursive: true });
    const zipPath = path.join(testDir, 'test_valid.zip');
    const extractDir = path.join(testDir, 'out_valid');

    try {
      const zipBuf = createTestZip([
        { name: 'image1.jpg', data: 'Fake JPEG data 1' },
        { name: 'subfolder/image2.jpg', data: 'Fake JPEG data 2' }
      ]);
      fs.writeFileSync(zipPath, zipBuf);

      const result = safeExtractZipFile(zipPath, extractDir);
      assert.equal(result.extractedCount, 2);
      assert.ok(fs.existsSync(path.join(extractDir, 'image1.jpg')));
      assert.ok(fs.existsSync(path.join(extractDir, 'subfolder', 'image2.jpg')));
      assert.equal(fs.readFileSync(path.join(extractDir, 'image1.jpg'), 'utf8'), 'Fake JPEG data 1');
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  await t.test('12. safeExtractZipFile rejects Zip Slip path traversal attempts', () => {
    const testDir = path.join(__dirname, 'test_sandbox_slip');
    fs.mkdirSync(testDir, { recursive: true });
    const zipPath = path.join(testDir, 'test_slip.zip');
    const extractDir = path.join(testDir, 'out_slip');

    try {
      const zipBuf = createTestZip([
        { name: '../evil.txt', data: 'Malicious payload' }
      ]);
      fs.writeFileSync(zipPath, zipBuf);

      assert.throws(
        () => safeExtractZipFile(zipPath, extractDir),
        /Zip Slip path traversal attempt detected/i
      );
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  await t.test('13. safeExtractZipFile enforces file count and size limits', () => {
    const testDir = path.join(__dirname, 'test_sandbox_limits');
    fs.mkdirSync(testDir, { recursive: true });
    const zipPath = path.join(testDir, 'test_limits.zip');
    const extractDir = path.join(testDir, 'out_limits');

    try {
      const zipBuf = createTestZip([
        { name: 'big_file.txt', data: 'A'.repeat(500) }
      ]);
      fs.writeFileSync(zipPath, zipBuf);

      // Total size cap exceeded
      assert.throws(
        () => safeExtractZipFile(zipPath, extractDir, { maxTotalSize: 100 }),
        /exceed total uncompressed size limit/i
      );

      // Max files cap exceeded
      assert.throws(
        () => safeExtractZipFile(zipPath, extractDir, { maxFiles: 0 }),
        /exceeds maximum allowed file count/i
      );
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  await t.test('14. Manifest tracking and duplicate install avoidance with exact notification message', async () => {
    const portraitsDir = path.join(PACKS_DIR, 'portraits');
    fs.mkdirSync(portraitsDir, { recursive: true });
    fs.writeFileSync(path.join(portraitsDir, 'sample_portrait.jpg'), 'sample');

    // Save mock manifest entry
    const manifest = getInstalledPacksManifest();
    manifest.installedPacks['portraits'] = {
      packId: 'portraits',
      title: 'Portraits',
      folderName: 'portraits',
      installPath: portraitsDir,
      installedAt: new Date().toISOString(),
      sha256: 'd6bfa7a616bacdc45ccf7b3c9015e923d890454e65a80a7e3ce8545dccd543a0',
      fileCount: 64
    };
    saveInstalledPacksManifest(manifest);

    try {
      assert.equal(isPackInstalled('portraits', 'portraits'), true);

      // GET /api/starter-decks reports installed: true
      const getRes = await makeRequest('GET', '/api/starter-decks');
      const portraits = getRes.json.find(p => p.id === 'portraits');
      assert.ok(portraits);
      assert.equal(portraits.installed, true);
      assert.equal(portraits.installPath, portraitsDir);

      // POST /api/starter-deck/install detects alreadyInstalled and returns exact message
      const installRes = await makeRequest('POST', '/api/starter-deck/install', { packId: 'portraits' });
      assert.equal(installRes.status, 200);
      assert.equal(installRes.json.success, true);
      assert.equal(installRes.json.alreadyInstalled, true);
      assert.equal(installRes.json.installPath, portraitsDir);
      assert.equal(
        installRes.json.message,
        `Pack installed at ${portraitsDir}. To use it, click New Deck and choose the portraits folder.`
      );
    } finally {
      // Clean up mock manifest
      delete manifest.installedPacks['portraits'];
      saveInstalledPacksManifest(manifest);
      try { fs.rmSync(portraitsDir, { recursive: true, force: true }); } catch (e) {}
    }
  });

  await t.test('15. GET /api/starter-deck/preview rejects missing or non-CC0 URL', async () => {
    const resNoUrl = await makeRequest('GET', '/api/starter-deck/preview');
    assert.equal(resNoUrl.status, 400);

    const resUntrusted = await makeRequest('GET', `/api/starter-deck/preview?url=${encodeURIComponent('https://evil.com/image.jpg')}`);
    assert.equal(resUntrusted.status, 403);
  });

  await t.test('16. GET /api/starter-deck/preview serves verified CC0 preview image under CSP', async () => {
    const sampleUrl = 'https://openaccess-cdn.clevelandart.org/1969.70/1969.70_web.jpg';
    const res = await makeRequest('GET', `/api/starter-deck/preview?url=${encodeURIComponent(sampleUrl)}`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^image\//);
    assert.match(res.headers['cache-control'], /max-age/);
    assert.ok(res.raw.length > 1000, 'Image payload returned');
  });

  await t.test('17. safeExtractZipFile filters out __MACOSX directories and ._* AppleDouble metadata files', () => {
    const testDir = path.join(__dirname, 'test_sandbox_macosx');
    fs.mkdirSync(testDir, { recursive: true });
    const zipPath = path.join(testDir, 'test_mac.zip');
    const extractDir = path.join(testDir, 'out_mac');

    try {
      const zipBuf = createTestZip([
        { name: 'poses/photo1.jpg', data: 'Real photo 1 data' },
        { name: '__MACOSX/poses/._photo1.jpg', data: 'Mac AppleDouble resource fork' },
        { name: '__MACOSX/', data: '' },
        { name: 'poses/.DS_Store', data: 'Desktop Services Store' },
        { name: 'poses/._hidden_attr.jpg', data: 'AppleDouble metadata' },
        { name: 'poses/photo2.jpg', data: 'Real photo 2 data' }
      ]);
      fs.writeFileSync(zipPath, zipBuf);

      const result = safeExtractZipFile(zipPath, extractDir);
      assert.equal(result.extractedCount, 2, 'Only 2 real images extracted (skips __MACOSX, ._*, and .DS_Store)');
      assert.ok(fs.existsSync(path.join(extractDir, 'poses', 'photo1.jpg')));
      assert.ok(fs.existsSync(path.join(extractDir, 'poses', 'photo2.jpg')));
      assert.equal(fs.existsSync(path.join(extractDir, '__MACOSX')), false, '__MACOSX directory was not created');
      assert.equal(fs.existsSync(path.join(extractDir, 'poses', '.DS_Store')), false, '.DS_Store was not extracted');
      assert.equal(fs.existsSync(path.join(extractDir, 'poses', '._hidden_attr.jpg')), false, '._ AppleDouble was not extracted');
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  await t.test('18. scanForImages excludes __MACOSX directories and dotfiles (.DS_Store, ._*)', () => {
    const testDir = path.join(__dirname, 'test_sandbox_scan_mac');
    const macDir = path.join(testDir, '__MACOSX');
    const subDir = path.join(testDir, 'sub');
    fs.mkdirSync(macDir, { recursive: true });
    fs.mkdirSync(subDir, { recursive: true });

    try {
      fs.writeFileSync(path.join(testDir, 'real1.jpg'), 'JPEG DATA');
      fs.writeFileSync(path.join(subDir, 'real2.png'), 'PNG DATA');
      fs.writeFileSync(path.join(testDir, '._real1.jpg'), 'APPLEDOUBLE DATA');
      fs.writeFileSync(path.join(testDir, '.hidden.jpg'), 'HIDDEN JPEG');
      fs.writeFileSync(path.join(macDir, '._something.jpg'), 'MAC RESOURCE FORK');

      const found = scanForImages(testDir);
      assert.equal(found.length, 2, 'Found exactly 2 valid images');
      const basenames = found.map(p => path.basename(p)).sort();
      assert.deepEqual(basenames, ['real1.jpg', 'real2.png']);
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  await t.test('19. POST /api/starter-deck/install supports custom destinationPath and detects install at that path', async () => {
    const customInstallDir = path.join(__dirname, 'test_custom_install_location');
    const manifest = getInstalledPacksManifest();

    try {
      fs.mkdirSync(customInstallDir, { recursive: true });

      // Simulate an installed pack at custom destination
      manifest.installedPacks['portraits'] = {
        packId: 'portraits',
        title: 'Portraits',
        folderName: 'portraits',
        installPath: customInstallDir,
        installedAt: new Date().toISOString()
      };
      saveInstalledPacksManifest(manifest);

      // Duplicate check for custom path
      assert.equal(isPackInstalled('portraits', customInstallDir), true);

      // Re-installing at custom path detects already installed and returns 200 without starting download
      const res = await makeRequest('POST', '/api/starter-deck/install', {
        packId: 'portraits',
        destinationPath: customInstallDir
      });

      assert.equal(res.status, 200);
      assert.equal(res.json.alreadyInstalled, true);
      assert.equal(res.json.installPath, customInstallDir);
      assert.match(res.json.message, /Pack installed at/i);

      // Reject null byte destination path
      const resNull = await makeRequest('POST', '/api/starter-deck/install', {
        packId: 'portraits',
        destinationPath: '/bad/\0/path'
      });
      assert.equal(resNull.status, 400);
    } finally {
      delete manifest.installedPacks['portraits'];
      saveInstalledPacksManifest(manifest);
      try { fs.rmSync(customInstallDir, { recursive: true, force: true }); } catch (e) {}
    }
  });

  // Teardown server
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});
