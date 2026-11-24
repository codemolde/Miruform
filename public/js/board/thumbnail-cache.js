// =============================================================================
// ThumbnailCache — High-Performance Downscaled Thumbnail Engine for Reference Board
//
// Key Specifications:
// - Max 360 px on long edge (proportional aspect ratio preserved)
// - LRU in-memory cache capped at ~200 thumbnails
// - Concurrency queue limited to at most 4 simultaneous image decodes
// - Automatic URL.revokeObjectURL when thumbnails are evicted or cleared
// - IntersectionObserver integration for lazy on-screen viewport loading
// - Full image paths retained strictly for Stage and SRS Study sessions
// =============================================================================

(function () {
  'use strict';

  const MAX_CACHE_SIZE = 200;
  const MAX_CONCURRENT_DECODES = 4;
  const THUMBNAIL_MAX_EDGE = 360;

  /**
   * Calculates proportional thumbnail dimensions fitting within maxEdge on the long axis.
   */
  function calculateThumbnailDimensions(origW, origH, maxEdge = THUMBNAIL_MAX_EDGE) {
    if (!origW || !origH || origW <= 0 || origH <= 0) {
      return { width: maxEdge, height: maxEdge, scale: 1 };
    }
    const longEdge = Math.max(origW, origH);
    if (longEdge <= maxEdge) {
      return { width: Math.round(origW), height: Math.round(origH), scale: 1 };
    }
    const scale = maxEdge / longEdge;
    const targetW = Math.max(1, Math.round(origW * scale));
    const targetH = Math.max(1, Math.round(origH * scale));
    return { width: targetW, height: targetH, scale };
  }

  /**
   * LRU Thumbnail Cache backed by Map (insertion-order traversal).
   * Automatically revokes object URLs on eviction or clear.
   */
  class LRUThumbnailCache {
    constructor(capacity = MAX_CACHE_SIZE) {
      this.capacity = capacity;
      this.cache = new Map();
    }

    get(key) {
      if (!this.cache.has(key)) return null;
      const entry = this.cache.get(key);
      // Refresh MRU position
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry;
    }

    has(key) {
      return this.cache.has(key);
    }

    set(key, entry) {
      if (this.cache.has(key)) {
        const old = this.cache.get(key);
        if (old && old.blobUrl && old.blobUrl !== entry.blobUrl) {
          this.revoke(old.blobUrl);
        }
        this.cache.delete(key);
      } else if (this.cache.size >= this.capacity) {
        // Evict oldest (first key in map)
        const oldestKey = this.cache.keys().next().value;
        const oldestEntry = this.cache.get(oldestKey);
        if (oldestEntry && oldestEntry.blobUrl) {
          this.revoke(oldestEntry.blobUrl);
        }
        this.cache.delete(oldestKey);
      }
      this.cache.set(key, entry);
    }

    delete(key) {
      if (this.cache.has(key)) {
        const entry = this.cache.get(key);
        if (entry && entry.blobUrl) {
          this.revoke(entry.blobUrl);
        }
        return this.cache.delete(key);
      }
      return false;
    }

    clear() {
      for (const entry of this.cache.values()) {
        if (entry && entry.blobUrl) {
          this.revoke(entry.blobUrl);
        }
      }
      this.cache.clear();
    }

    revoke(url) {
      if (typeof url === 'string' && url.startsWith('blob:')) {
        try {
          if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(url);
          }
        } catch (e) { }
      }
    }

    get size() {
      return this.cache.size;
    }

    keys() {
      return Array.from(this.cache.keys());
    }
  }

  /**
   * Concurrency-limited decode & downscale queue (max 4 parallel workers).
   */
  class DecodeQueue {
    constructor(lruCache, maxConcurrent = MAX_CONCURRENT_DECODES) {
      this.lru = lruCache;
      this.maxConcurrent = maxConcurrent;
      this.activeDecodes = 0;
      this.queue = [];
      this.inFlightKeys = new Map(); // key -> task item
    }

    enqueue(key, fullUrl, imgEl, onLoaded, onError) {
      // 1. Cache hit check
      if (this.lru.has(key)) {
        const entry = this.lru.get(key);
        if (imgEl && entry && entry.blobUrl) {
          imgEl.src = entry.blobUrl;
          imgEl.classList.remove('is-loading');
          imgEl.classList.add('is-loaded');
        }
        if (typeof onLoaded === 'function') onLoaded(entry.blobUrl);
        return;
      }

      // 2. Coalesce duplicate requests for the same key while decoding
      if (this.inFlightKeys.has(key)) {
        const existing = this.inFlightKeys.get(key);
        if (imgEl && !existing.subscribers.includes(imgEl)) {
          existing.subscribers.push(imgEl);
        }
        return;
      }

      const task = {
        key,
        fullUrl,
        subscribers: imgEl ? [imgEl] : [],
        onLoaded,
        onError,
        cancelled: false
      };

      this.inFlightKeys.set(key, task);
      this.queue.push(task);
      this.processNext();
    }

    cancel(key) {
      if (this.inFlightKeys.has(key)) {
        const task = this.inFlightKeys.get(key);
        task.cancelled = true;
        this.inFlightKeys.delete(key);
      }
      this.queue = this.queue.filter(t => t.key !== key);
    }

    cancelAll() {
      this.queue.forEach(t => { t.cancelled = true; });
      this.queue = [];
      this.inFlightKeys.clear();
    }

    processNext() {
      if (this.activeDecodes >= this.maxConcurrent || this.queue.length === 0) {
        return;
      }

      const task = this.queue.shift();
      if (!task || task.cancelled) {
        if (task) this.inFlightKeys.delete(task.key);
        this.processNext();
        return;
      }

      this.activeDecodes++;
      this.decodeAndDownscale(task)
        .catch(err => {
          if (!task.cancelled) {
            // Graceful fallback: set src to fullUrl directly so image is never lost
            task.subscribers.forEach(el => {
              if (el) {
                el.classList.remove('is-loading');
                el.src = task.fullUrl;
                el.classList.add('is-loaded');
              }
            });
            if (typeof task.onError === 'function') task.onError(err);
          }
        })
        .finally(() => {
          this.activeDecodes--;
          this.inFlightKeys.delete(task.key);
          this.processNext();
        });
    }

    async decodeAndDownscale(task) {
      if (task.cancelled) return;

      task.subscribers.forEach(el => {
        if (el) el.classList.add('is-loading');
      });

      return new Promise((resolve, reject) => {
        let isSettled = false;
        const img = (typeof Image !== 'undefined') ? new Image() : null;

        if (!img) {
          // Headless / non-browser mock fallback
          const dummyBlobUrl = `blob:mock-thumb-${encodeURIComponent(task.key)}`;
          this.lru.set(task.key, { blobUrl: dummyBlobUrl, width: 360, height: 360 });
          task.subscribers.forEach(el => {
            if (el) {
              el.src = dummyBlobUrl;
              el.classList.remove('is-loading');
              el.classList.add('is-loaded');
            }
          });
          if (typeof task.onLoaded === 'function') task.onLoaded(dummyBlobUrl);
          resolve(dummyBlobUrl);
          return;
        }

        // Downscale rendering helper
        const renderCanvas = () => {
          if (isSettled) return;
          isSettled = true;

          try {
            const origW = img.naturalWidth || img.width || 360;
            const origH = img.naturalHeight || img.height || 360;
            const dims = calculateThumbnailDimensions(origW, origH, THUMBNAIL_MAX_EDGE);

            const canvas = (typeof document !== 'undefined' && typeof document.createElement === 'function')
              ? document.createElement('canvas')
              : null;

            if (!canvas || typeof canvas.getContext !== 'function') {
              const fallbackUrl = task.fullUrl;
              this.lru.set(task.key, { blobUrl: fallbackUrl, width: dims.width, height: dims.height });
              task.subscribers.forEach(el => {
                if (el) {
                  el.src = fallbackUrl;
                  el.classList.remove('is-loading');
                  el.classList.add('is-loaded');
                }
              });
              resolve(fallbackUrl);
              return;
            }

            canvas.width = dims.width;
            canvas.height = dims.height;
            const ctx = canvas.getContext('2d');
            if (ctx && typeof ctx.drawImage === 'function') {
              ctx.drawImage(img, 0, 0, dims.width, dims.height);
            }

            // Clean up source image bitmap immediately to release RAM / GPU memory
            img.onload = null;
            img.onerror = null;
            img.src = '';

            const handleBlobUrl = (blobUrl) => {
              this.lru.set(task.key, {
                blobUrl,
                width: dims.width,
                height: dims.height
              });

              if (!task.cancelled) {
                task.subscribers.forEach(el => {
                  if (el) {
                    el.src = blobUrl;
                    el.classList.remove('is-loading');
                    el.classList.add('is-loaded');
                  }
                });
                if (typeof task.onLoaded === 'function') task.onLoaded(blobUrl);
              }
              resolve(blobUrl);
            };

            if (typeof canvas.toBlob === 'function') {
              try {
                canvas.toBlob((blob) => {
                  if (blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                    const blobUrl = URL.createObjectURL(blob);
                    handleBlobUrl(blobUrl);
                  } else if (typeof canvas.toDataURL === 'function') {
                    handleBlobUrl(canvas.toDataURL('image/jpeg', 0.82));
                  } else {
                    handleBlobUrl(task.fullUrl);
                  }
                }, 'image/jpeg', 0.82);
              } catch (blobErr) {
                handleBlobUrl(task.fullUrl);
              }
            } else if (typeof canvas.toDataURL === 'function') {
              try {
                handleBlobUrl(canvas.toDataURL('image/jpeg', 0.82));
              } catch (dataErr) {
                handleBlobUrl(task.fullUrl);
              }
            } else {
              handleBlobUrl(task.fullUrl);
            }

          } catch (err) {
            reject(err);
          }
        };

        img.onload = renderCanvas;
        img.onerror = (e) => {
          if (isSettled) return;
          isSettled = true;
          img.onload = null;
          img.onerror = null;
          reject(new Error(`Failed to load reference image for thumbnail downscaling: ${task.fullUrl}`));
        };

        // Only set crossOrigin for external origins (not same-origin /api/image)
        const isExternal = typeof task.fullUrl === 'string' &&
          (task.fullUrl.startsWith('http://') || task.fullUrl.startsWith('https://')) &&
          (typeof window !== 'undefined' && window.location && !task.fullUrl.startsWith(window.location.origin));
        if (isExternal) {
          img.crossOrigin = 'anonymous';
        }
        img.decoding = 'async';
        img.src = task.fullUrl;
      });
    }
  }

  // Instantiate master singleton
  const lruInstance = new LRUThumbnailCache(MAX_CACHE_SIZE);
  const queueInstance = new DecodeQueue(lruInstance, MAX_CONCURRENT_DECODES);
  let intersectionObserverInstance = null;

  const ThumbnailCache = {
    MAX_CACHE_SIZE,
    MAX_CONCURRENT_DECODES,
    THUMBNAIL_MAX_EDGE,
    lru: lruInstance,
    queue: queueInstance,

    calculateThumbnailDimensions,

    /**
     * Checks if a thumbnail is already downscaled and cached in the LRU.
     */
    has(key) {
      return lruInstance.has(key);
    },

    /**
     * Gets cached downscaled thumbnail entry { blobUrl, width, height }
     */
    get(key) {
      return lruInstance.get(key);
    },

    /**
     * Requests a downscaled thumbnail. If cached, updates targetImg immediately;
     * otherwise schedules through the concurrency-capped queue.
     */
    requestThumbnail(key, fullUrl, targetImgEl, onLoaded, onError) {
      queueInstance.enqueue(key, fullUrl, targetImgEl, onLoaded, onError);
    },

    /**
     * Returns or instantiates the shared IntersectionObserver with 200px rootMargin prefetching.
     */
    getObserver() {
      if (intersectionObserverInstance) return intersectionObserverInstance;
      if (typeof IntersectionObserver === 'undefined') return null;

      intersectionObserverInstance = new IntersectionObserver((entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const target = entry.target;
            obs.unobserve(target);

            const imgEl = target.tagName === 'IMG' ? target : target.querySelector('.board-ref-thumb');
            if (imgEl) {
              const key = imgEl.dataset.id || imgEl.dataset.path || imgEl.dataset.src;
              const fullUrl = imgEl.dataset.src;
              if (key && fullUrl) {
                ThumbnailCache.requestThumbnail(key, fullUrl, imgEl);
              }
            }
          }
        }
      }, {
        root: null, // Viewport
        rootMargin: '200px 0px 200px 0px'
      });

      return intersectionObserverInstance;
    },

    /**
     * Observes thumbnail elements or cards. If IntersectionObserver is unavailable,
     * immediately falls back to loading through the concurrency queue.
     */
    observeElements(elements) {
      if (!elements) return;
      const obs = this.getObserver();
      const list = Array.isArray(elements) ? elements : Array.from(elements);

      list.forEach(el => {
        if (!el) return;
        if (obs) {
          obs.observe(el);
        } else {
          // Fallback if IntersectionObserver not available in current environment
          const imgEl = el.tagName === 'IMG' ? el : el.querySelector('.board-ref-thumb');
          if (imgEl) {
            const key = imgEl.dataset.id || imgEl.dataset.path || imgEl.dataset.src;
            const fullUrl = imgEl.dataset.src;
            if (key && fullUrl) {
              this.requestThumbnail(key, fullUrl, imgEl);
            }
          }
        }
      });
    },

    /**
     * Unobserves an element and cancels pending decode if not yet in flight.
     */
    unobserveElement(el) {
      if (!el) return;
      if (intersectionObserverInstance) {
        intersectionObserverInstance.unobserve(el);
      }
      const imgEl = el.tagName === 'IMG' ? el : el.querySelector('.board-ref-thumb');
      if (imgEl) {
        const key = imgEl.dataset.id || imgEl.dataset.path || imgEl.dataset.src;
        if (key) {
          queueInstance.cancel(key);
        }
      }
    },

    /**
     * Disconnects IntersectionObserver and cancels any remaining queued decodes.
     */
    disconnectObserver() {
      if (intersectionObserverInstance) {
        intersectionObserverInstance.disconnect();
      }
      queueInstance.cancelAll();
    },

    /**
     * Clears all cached thumbnails, revokes all blob URLs, and cancels decode queues.
     */
    clear() {
      this.disconnectObserver();
      lruInstance.clear();
      queueInstance.cancelAll();
    },

    /**
     * Helper to create a new isolated instance (useful for unit testing).
     */
    createInstance(options = {}) {
      const cap = options.capacity || MAX_CACHE_SIZE;
      const conc = options.maxConcurrent || MAX_CONCURRENT_DECODES;
      const lru = new LRUThumbnailCache(cap);
      const queue = new DecodeQueue(lru, conc);
      return {
        lru,
        queue,
        calculateThumbnailDimensions,
        requestThumbnail: (k, url, img, onOk, onErr) => queue.enqueue(k, url, img, onOk, onErr),
        clear: () => { lru.clear(); queue.cancelAll(); }
      };
    }
  };

  // Export globally for browser and Node.js
  if (typeof window !== 'undefined') {
    window.ThumbnailCache = ThumbnailCache;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.ThumbnailCache = ThumbnailCache;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ThumbnailCache,
      LRUThumbnailCache,
      DecodeQueue,
      calculateThumbnailDimensions
    };
  }
})();
