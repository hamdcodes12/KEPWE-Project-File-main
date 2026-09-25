import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data/pglite-test');

fs.rmSync(dataDir, { recursive: true, force: true });
process.env.KEPWE_PGLITE_TEST = 'true';
process.env.PGLITE_DATA_DIR = dataDir;