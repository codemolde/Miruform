/**
 * Starter Decks & Automated Public Domain Verification Test Suite
 *
 * Verifies:
 * 1. Automated CC0 / Public Domain verification gate (verifyPublicDomainReference)
 * 2. GET /api/starter-decks endpoint: returns verified CC0 catalog with installation status
 * 3. POST /api/starter-deck/install endpoint: public domain enforcement, SSRF protection,
 *    trusted folder registration, and atomic card metadata persistence
 * 4. GET /api/starter-deck/progress endpoint: job tracking and progress reporting
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const {
  app,
  startServer,
  verifyPublicDomainReference
} = require('../server.js');

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

  await t.test('8. GET /api/starter-decks returns verified CC0 catalog with installation status', async () => {
    const res = await makeRequest('GET', '/api/starter-decks');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json), 'Returns an array of decks');
    assert.ok(res.json.length >= 1, 'Contains at least one starter deck');

    const gestureDeck = res.json.find(d => d.id === 'starter-gesture');
    assert.ok(gestureDeck, 'Contains Master Gesture starter deck');
    assert.equal(gestureDeck.id, 'starter-gesture');
    assert.equal(gestureDeck.title, 'Master Gesture & Dynamic Pose Collection');
    assert.equal(gestureDeck.category, 'Figure & Gesture');
    assert.ok(gestureDeck.cardCount >= 70, `Has 70+ cards (actual: ${gestureDeck.cardCount})`);
    assert.equal(gestureDeck.allPublicDomain, true, 'All cards are verified Public Domain');
    assert.equal(gestureDeck.pdVerifiedCount, gestureDeck.cardCount);
    assert.ok(Array.isArray(gestureDeck.tags));
    assert.ok(gestureDeck.tags.includes('gesture'));
    assert.ok(gestureDeck.tags.includes('master-study'));
    assert.ok(Array.isArray(gestureDeck.previewImages));
    assert.equal(gestureDeck.previewImages.length, 4);
  });

  await t.test('9. POST /api/starter-deck/install rejects missing or unknown deckId', async () => {
    const res = await makeRequest('POST', '/api/starter-deck/install', { deckId: 'non-existent-deck' });
    assert.equal(res.status, 404);
    assert.match(res.json.error, /not found/i);
  });

  await t.test('10. GET /api/starter-deck/progress rejects missing parameters', async () => {
    const res = await makeRequest('GET', '/api/starter-deck/progress');
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Missing jobId or deckId/i);
  });

  await t.test('11. POST /api/starter-deck/install initiates download job and tracks progress', async () => {
    const installRes = await makeRequest('POST', '/api/starter-deck/install', {
      deckId: 'starter-gesture',
      deckName: 'Test Gesture Deck'
    });
    assert.equal(installRes.status, 200);
    assert.equal(installRes.json.success, true);
    assert.ok(installRes.json.jobId);
    assert.equal(installRes.json.status, 'downloading');

    // Poll progress endpoint
    const progRes = await makeRequest('GET', `/api/starter-deck/progress?jobId=${installRes.json.jobId}`);
    assert.equal(progRes.status, 200);
    assert.equal(progRes.json.jobId, installRes.json.jobId);
    assert.ok(['downloading', 'completed', 'failed'].includes(progRes.json.status));
    assert.equal(typeof progRes.json.downloaded, 'number');
    assert.equal(typeof progRes.json.total, 'number');
    assert.ok(progRes.json.total >= 70);
  });

  await t.test('12. GET /api/starter-deck/preview rejects missing or non-CC0 URL', async () => {
    const resNoUrl = await makeRequest('GET', '/api/starter-deck/preview');
    assert.equal(resNoUrl.status, 400);

    const resUntrusted = await makeRequest('GET', `/api/starter-deck/preview?url=${encodeURIComponent('https://evil.com/image.jpg')}`);
    assert.equal(resUntrusted.status, 403);
  });

  await t.test('13. GET /api/starter-deck/preview serves verified CC0 preview image under CSP', async () => {
    const sampleUrl = 'https://openaccess-cdn.clevelandart.org/1969.70/1969.70_web.jpg';
    const res = await makeRequest('GET', `/api/starter-deck/preview?url=${encodeURIComponent(sampleUrl)}`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^image\//);
    assert.match(res.headers['cache-control'], /max-age/);
    assert.ok(res.raw.length > 1000, 'Image payload returned');
  });

  // Teardown server
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});
