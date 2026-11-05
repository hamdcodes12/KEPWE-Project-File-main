import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'kepwe-credit-applications-test-'));
process.env.KEPWE_PGLITE_TEST = 'true';
process.env.PGLITE_DATA_DIR = dataDir;
process.env.JWT_SECRET = 'credit-applications-test-secret';
process.on('exit', () => rmSync(dataDir, { recursive: true, force: true }));
