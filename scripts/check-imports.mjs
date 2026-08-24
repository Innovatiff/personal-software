import fs from 'node:fs';
import path from 'node:path';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})('js');

const exportsOf = {};
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g))
    m[1].split(',').forEach(s => { const n = s.trim().split(/\s+as\s+/)[0].trim(); if (n) names.add(n); });
  exportsOf[path.resolve(f)] = names;
}

let problems = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](\.[^"']+)["']/g)) {
    const named = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    const target = path.resolve(path.dirname(f), m[2]);
    if (!fs.existsSync(target)) { console.log('MISSING FILE:', m[2], 'in', f); problems++; continue; }
    const exp = exportsOf[target] || new Set();
    for (const n of named) if (!exp.has(n)) { console.log('MISSING EXPORT:', n, 'from', m[2], '(in ' + f + ')'); problems++; }
  }
}
console.log(problems ? `\n${problems} problem(s)` : 'All cross-file imports resolve ✓');
