// ==================== CORE UTILITIES ====================

/**
 * One-time migration note: existing stored dueDate, lastReviewDate, and review
 * history keys stay as they are; new entries and due-date comparisons use this local date format.
 * Formats a date to 'YYYY-MM-DD' in local time (avoiding UTC offset day-shift bugs).
 */
function localDateStr(date) {
  if (date === undefined || date === null) {
    if (arguments.length === 0) {
      date = new Date();
    } else {
      return '';
    }
  }
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    date = new Date(date);
  } else if (typeof date === 'number') {
    date = new Date(date);
  }
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates a sketch URL to prevent XSS.
 * Allows endpoints under /api/sketch/, legacy /api/sketch?file=, or data: URLs of type PNG, JPEG, or WebP.
 */
function isValidSketchUrl(url) {
  if (typeof url !== 'string' || !url) return false;
  if (url.startsWith('/api/sketch/') || url.startsWith('/api/sketch?file=')) return true;
  if (
    url.startsWith('data:image/png') ||
    url.startsWith('data:image/jpeg') ||
    url.startsWith('data:image/webp')
  ) {
    return true;
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.localDateStr = localDateStr;
  window._escapeHtml = _escapeHtml;
  window.isValidSketchUrl = isValidSketchUrl;
}
if (typeof globalThis !== 'undefined') {
  globalThis.localDateStr = localDateStr;
  globalThis._escapeHtml = _escapeHtml;
  globalThis.isValidSketchUrl = isValidSketchUrl;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    localDateStr,
    _escapeHtml,
    isValidSketchUrl
  };
}
