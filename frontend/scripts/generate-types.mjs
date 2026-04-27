#!/usr/bin/env node
/**
 * Regenerates `src/types/api.d.ts` from the running backend's OpenAPI schema.
 *
 * Usage:
 *   yarn types:generate
 *   yarn types:generate http://localhost:8001    (override URL)
 *
 * The script:
 *   1. Fetches /openapi.json from the backend (defaults to localhost:8001)
 *   2. Pipes the spec through openapi-typescript
 *   3. Writes the result to /app/frontend/src/types/api.d.ts
 *
 * Run this after adding/changing a `response_model=` or new endpoint.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const apiUrl = process.argv[2] || 'http://localhost:8001';
const specUrl = `${apiUrl.replace(/\/$/, '')}/openapi.json`;
const outFile = resolve(ROOT, 'src/types/api.d.ts');
const tmpFile = '/tmp/openapi.json';

console.log(`📥 Fetching OpenAPI spec from ${specUrl}`);
const res = await fetch(specUrl);
if (!res.ok) {
  console.error(`❌ Failed to fetch ${specUrl}: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const spec = await res.json();
writeFileSync(tmpFile, JSON.stringify(spec));
console.log(`💾 Wrote spec to ${tmpFile} (${Object.keys(spec.paths || {}).length} paths)`);

mkdirSync(dirname(outFile), { recursive: true });
console.log(`⚙️  Generating TypeScript types → ${outFile}`);
execSync(`npx openapi-typescript ${tmpFile} -o ${outFile}`, { stdio: 'inherit', cwd: ROOT });
console.log('✅ Done. Commit the file along with your route changes.');
