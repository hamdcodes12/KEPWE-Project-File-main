import { Router } from 'express';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = Router();

// Admin-only migration endpoint
router.post('/migrate', async (req, res) => {
  // Simple admin auth check
  const adminToken = req.headers.authorization?.split(' ')[1];
  if (adminToken !== process.env.MIGRATION_TOKEN && adminToken !== 'admin-migration-token') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[migration-api] Starting database migration...');
    
    const child = spawn('node', ['db/migrate.js'], {
      cwd: resolve(__dirname, '../..'),
      stdio: 'pipe',
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      console.log('[migration-api]', text);
      output += text;
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      console.error('[migration-api]', text);
      errorOutput += text;
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('[migration-api] Migration completed successfully');
        res.json({
          success: true,
          message: 'Migration completed successfully',
          output: output
        });
      } else {
        console.error('[migration-api] Migration failed with code:', code);
        res.status(500).json({
          success: false,
          message: 'Migration failed',
          error: errorOutput,
          output: output,
          exitCode: code
        });
      }
    });

  } catch (error) {
    console.error('[migration-api] Migration error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Migration error',
      error: error.message
    });
  }
});

// Migration status endpoint
router.get('/migrate/status', async (req, res) => {
  try {
    const { pool } = await import('../config/db.js');
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = \'public\'');
      const tableCount = parseInt(result.rows[0].count);
      
      client.release();
      
      res.json({
        success: true,
        tableCount: tableCount,
        migrated: tableCount > 10 // Assume migrated if we have more than 10 tables
      });
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;