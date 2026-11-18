const fs = require('node:fs');
const path = require('node:path');

/**
 * Reads all <script src="..."> tags from public/index.html in order
 * and returns their concatenated source code for vm.runInContext.
 * Fails loudly with an Error if any referenced script file does not exist.
 */
function loadFrontendCode() {
  const indexHtmlPath = path.resolve(__dirname, '../../public/index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`[load-frontend] index.html not found at: ${indexHtmlPath}`);
  }

  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const scriptTags = [...html.matchAll(scriptRegex)];

  if (scriptTags.length === 0) {
    throw new Error(`[load-frontend] No <script src> tags found in: ${indexHtmlPath}`);
  }

  const publicDir = path.resolve(__dirname, '../../public');
  const sources = [];

  for (const match of scriptTags) {
    const rawSrc = match[1];
    // Strip query parameters (e.g., ?v=2.5)
    const cleanSrc = rawSrc.split('?')[0].replace(/^\/+/, '');
    const scriptPath = path.resolve(publicDir, cleanSrc);

    if (!fs.existsSync(scriptPath)) {
      throw new Error(`[load-frontend] Missing script file referenced in index.html: ${scriptPath} (src="${rawSrc}")`);
    }

    const code = fs.readFileSync(scriptPath, 'utf8');
    sources.push(`// --- BEGIN ${cleanSrc} ---\n` + code + `\n// --- END ${cleanSrc} ---`);
  }

  return sources.join('\n;\n');
}

module.exports = {
  loadFrontendCode
};
