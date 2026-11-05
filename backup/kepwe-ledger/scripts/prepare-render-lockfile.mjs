import { readFile, writeFile } from 'node:fs/promises';

const lockfilePath = new URL('../package-lock.json', import.meta.url);
const replitRegistryPrefix = 'http://package-firewall.replit.local/npm/';
const npmRegistryPrefix = 'https://registry.npmjs.org/';

const lockfile = JSON.parse(await readFile(lockfilePath, 'utf8'));
let rewrittenCount = 0;

function normalizeResolvedUrls(value) {
  if (!value || typeof value !== 'object') return;

  if (typeof value.resolved === 'string' && value.resolved.startsWith(replitRegistryPrefix)) {
    value.resolved = `${npmRegistryPrefix}${value.resolved.slice(replitRegistryPrefix.length)}`;
    rewrittenCount += 1;
  }

  for (const child of Object.values(value)) {
    normalizeResolvedUrls(child);
  }
}

normalizeResolvedUrls(lockfile);

if (rewrittenCount > 0) {
  await writeFile(lockfilePath, `${JSON.stringify(lockfile, null, 2)}\n`);
}

console.log(`[render] Using public npm registry URLs (${rewrittenCount} lockfile entries normalized).`);