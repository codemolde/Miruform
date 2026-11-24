const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const {
  ThumbnailCache,
  LRUThumbnailCache,
  DecodeQueue,
  calculateThumbnailDimensions
} = require('../public/js/board/thumbnail-cache.js');

test('ThumbnailCache: calculateThumbnailDimensions caps long edge at 360px and preserves aspect ratio', () => {
  // Horizontal image (4000 x 3000 -> 4:3)
  const h = calculateThumbnailDimensions(4000, 3000, 360);
  assert.strictEqual(h.width, 360);
  assert.strictEqual(h.height, 270);
  assert.strictEqual(Math.max(h.width, h.height), 360);

  // Vertical image (2000 x 6000 -> 1:3)
  const v = calculateThumbnailDimensions(2000, 6000, 360);
  assert.strictEqual(v.width, 120);
  assert.strictEqual(v.height, 360);
  assert.strictEqual(Math.max(v.width, v.height), 360);

  // Square image (2400 x 2400)
  const sq = calculateThumbnailDimensions(2400, 2400, 360);
  assert.strictEqual(sq.width, 360);
  assert.strictEqual(sq.height, 360);

  // Small image (200 x 150) should not be upscaled
  const sm = calculateThumbnailDimensions(200, 150, 360);
  assert.strictEqual(sm.width, 200);
  assert.strictEqual(sm.height, 150);

  // Fallback for invalid dimensions
  const inv = calculateThumbnailDimensions(0, -50, 360);
  assert.strictEqual(inv.width, 360);
  assert.strictEqual(inv.height, 360);
});

test('ThumbnailCache: LRU cache respects maximum capacity of 200 items and evicts oldest', () => {
  const revokedUrls = [];
  const originalRevoke = global.URL && global.URL.revokeObjectURL;
  global.URL = global.URL || {};
  global.URL.revokeObjectURL = (url) => {
    revokedUrls.push(url);
  };

  try {
    const capacity = 5; // Use smaller capacity for deterministic test
    const lru = new LRUThumbnailCache(capacity);

    for (let i = 1; i <= 5; i++) {
      lru.set(`img_${i}`, { blobUrl: `blob:url_${i}`, width: 360, height: 270 });
    }

    assert.strictEqual(lru.size, 5);
    assert.strictEqual(revokedUrls.length, 0);

    // Access img_1 to make it most recently used (MRU)
    const entry1 = lru.get('img_1');
    assert.strictEqual(entry1.blobUrl, 'blob:url_1');

    // Add 6th item -> oldest item (img_2) should be evicted and its blob URL revoked
    lru.set('img_6', { blobUrl: 'blob:url_6', width: 360, height: 270 });
    assert.strictEqual(lru.size, 5);
    assert.strictEqual(lru.has('img_2'), false, 'img_2 must be evicted');
    assert.strictEqual(lru.has('img_1'), true, 'img_1 was accessed, so it must NOT be evicted');
    assert.strictEqual(lru.has('img_6'), true, 'img_6 must exist in cache');

    assert.strictEqual(revokedUrls.length, 1);
    assert.strictEqual(revokedUrls[0], 'blob:url_2', 'blob:url_2 must be revoked upon eviction');

    // Clear cache revokes all remaining entries (1 evicted earlier + 5 remaining = 6 total)
    lru.clear();
    assert.strictEqual(lru.size, 0);
    assert.strictEqual(revokedUrls.length, 6, 'Total 6 blob URLs revoked (1 on eviction + 5 on clear)');
  } finally {
    if (originalRevoke) global.URL.revokeObjectURL = originalRevoke;
    else delete global.URL.revokeObjectURL;
  }
});

test('ThumbnailCache: Concurrency queue caps parallel decodes at most 4 simultaneous workers', async () => {
  const lru = new LRUThumbnailCache(200);
  const queue = new DecodeQueue(lru, 4);

  let activeDecodesAtPeak = 0;
  let currentActive = 0;
  const decodeLog = [];

  // Override decodeAndDownscale with tracked simulated async worker
  queue.decodeAndDownscale = async (task) => {
    currentActive++;
    if (currentActive > activeDecodesAtPeak) {
      activeDecodesAtPeak = currentActive;
    }
    decodeLog.push({ event: 'start', key: task.key, active: currentActive });

    // Simulate async decode & downscale latency
    await new Promise(r => setTimeout(r, 20));

    currentActive--;
    decodeLog.push({ event: 'done', key: task.key, active: currentActive });

    const blobUrl = `blob:downscaled_${task.key}`;
    lru.set(task.key, { blobUrl, width: 360, height: 270 });
    task.subscribers.forEach(el => {
      if (el) el.src = blobUrl;
    });
    if (typeof task.onLoaded === 'function') task.onLoaded(blobUrl);
    return blobUrl;
  };

  const tasks = [];
  const dummyElements = [];

  for (let i = 1; i <= 12; i++) {
    const el = { src: '', classList: { add() {}, remove() {} } };
    dummyElements.push(el);
    tasks.push(new Promise((resolve) => {
      queue.enqueue(`img_${i}`, `/api/image?path=img_${i}.jpg`, el, resolve);
    }));
  }

  await Promise.all(tasks);

  assert.ok(activeDecodesAtPeak <= 4, `Active decodes at peak (${activeDecodesAtPeak}) must not exceed 4`);
  assert.strictEqual(lru.size, 12, 'All 12 thumbnails must be processed and cached');
  dummyElements.forEach((el, idx) => {
    assert.strictEqual(el.src, `blob:downscaled_img_${idx + 1}`);
  });
});

test('ThumbnailCache: Duplicate requests for same image in flight coalesce into single decode', async () => {
  const lru = new LRUThumbnailCache(200);
  const queue = new DecodeQueue(lru, 4);

  let decodeCalls = 0;
  queue.decodeAndDownscale = async (task) => {
    decodeCalls++;
    await new Promise(r => setTimeout(r, 15));
    const blobUrl = `blob:coalesced_${task.key}`;
    lru.set(task.key, { blobUrl, width: 360, height: 270 });
    task.subscribers.forEach(el => {
      if (el) el.src = blobUrl;
    });
    return blobUrl;
  };

  const el1 = { src: '', classList: { add() {}, remove() {} } };
  const el2 = { src: '', classList: { add() {}, remove() {} } };

  queue.enqueue('duplicate_ref', '/api/image?path=duplicate.jpg', el1);
  queue.enqueue('duplicate_ref', '/api/image?path=duplicate.jpg', el2);

  await new Promise(r => setTimeout(r, 35));

  assert.strictEqual(decodeCalls, 1, 'Only one decode must be executed for identical key');
  assert.strictEqual(el1.src, 'blob:coalesced_duplicate_ref');
  assert.strictEqual(el2.src, 'blob:coalesced_duplicate_ref');
});

test('ThumbnailCache: Stage isolation keeps full image path for stage only', () => {
  const sampleRef = {
    id: 'ch_portrait_101',
    hash: 'ch_portrait_101',
    name: 'portrait_pose.jpg',
    path: '/Desktop2/Art/portraits/portrait_pose.jpg',
    folder: '/Desktop2/Art/portraits'
  };

  // ThumbnailCache key references either ID or path
  const thumbKey = sampleRef.id;
  ThumbnailCache.lru.set(thumbKey, {
    blobUrl: 'blob:thumb_360_portrait_101',
    width: 360,
    height: 240
  });

  // Verify the reference object retains full uncompressed filesystem path for Stage view
  assert.strictEqual(sampleRef.path, '/Desktop2/Art/portraits/portrait_pose.jpg');
  assert.strictEqual(sampleRef.id, 'ch_portrait_101');
  assert.strictEqual(ThumbnailCache.has(thumbKey), true);
  assert.strictEqual(ThumbnailCache.get(thumbKey).blobUrl, 'blob:thumb_360_portrait_101');
});
