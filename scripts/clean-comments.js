/**
 * scripts/clean-comments.js
 *
 * Replaces non-ASCII decorators in COMMENT lines only across all src .ts/.tsx files.
 *
 * What it replaces:
 *   Box-drawing dividers  U+2500 (─)  e.g.  // ─── Label ──────────  ->  // --- Label
 *   Em dash               U+2014 (—)  in comments only               ->  -
 *   En dash               U+2013 (–)  in comments only               ->  -
 *
 * What it deliberately leaves untouched:
 *   String literals and JSX text nodes (review text, placeholder values, etc.)
 *
 * Usage:
 *   node scripts/clean-comments.js
 */

const fs   = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively collect all .ts / .tsx files under a directory. */
function collectFiles(dir, results) {
  results = results || [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, results);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Clean non-ASCII artefacts from a single line.
 *
 * Rules:
 *   1. Pure comment lines (trimmed start = "//") — full clean.
 *   2. JSDoc / block comment lines (trimmed start = "*" or "/**") — em/en dash only.
 *   3. Code lines with a trailing // comment — em/en dash in the comment portion only.
 *   4. All other lines — untouched.
 */
function cleanLine(line) {
  const trimmed = line.trimStart();
  const indent  = line.slice(0, line.length - trimmed.length);

  // --- Rule 1: pure // comment line ---
  if (trimmed.startsWith('//')) {
    let c = trimmed;

    // // ─── Label ──────────  ->  // --- Label
    c = c.replace(/^\/\/ \u2500{2,} (.+?) \u2500+\s*$/, '// --- $1');
    // // ─── Label             ->  // --- Label  (no trailing dashes)
    c = c.replace(/^\/\/ \u2500{2,} (.+?)\s*$/, '// --- $1');
    // // ── Sub ──────────     ->  // -- Sub
    c = c.replace(/^\/\/ \u2500{1,2} (.+?) \u2500+\s*$/, '// -- $1');
    // // ── Sub                ->  // -- Sub
    c = c.replace(/^\/\/ \u2500{1,2} (.+?)\s*$/, '// -- $1');
    // // ──────────            ->  //  (bare divider line)
    c = c.replace(/^\/\/ \u2500+\s*$/, '//');
    // em / en dash within the comment text
    c = c.replace(/\u2014/g, '-').replace(/\u2013/g, '-');

    return indent + c;
  }

  // --- Rule 2: JSDoc / block comment line ---
  if (trimmed.startsWith('*') || trimmed.startsWith('/**')) {
    const cleaned = trimmed
      .replace(/\u2014/g, '-')
      .replace(/\u2013/g, '-');
    return indent + cleaned;
  }

  // --- Rule 3: code line with trailing // comment ---
  const commentStart = line.indexOf('//');
  if (commentStart > 0) {
    const codePart    = line.slice(0, commentStart);
    const commentPart = line.slice(commentStart)
      .replace(/\u2014/g, '-')
      .replace(/\u2013/g, '-');
    return codePart + commentPart;
  }

  // --- Rule 4: everything else is untouched ---
  return line;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let changed = 0;
let scanned = 0;

for (const filePath of collectFiles(SRC_DIR)) {
  scanned++;
  const original = fs.readFileSync(filePath, 'utf8');
  const cleaned  = original.split('\n').map(cleanLine).join('\n');

  if (cleaned !== original) {
    fs.writeFileSync(filePath, cleaned, 'utf8');
    console.log('  cleaned:', path.relative(SRC_DIR, filePath));
    changed++;
  }
}

console.log('');
console.log('Scanned ' + scanned + ' file(s). Changed ' + changed + ' file(s).');
