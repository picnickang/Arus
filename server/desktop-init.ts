import { initDb } from './init-db-entry.js';

const args = process.argv;

if (args.includes('--init-db')) {
  console.log('[ARUS] Running database initialisation…');
  initDb()
    .then(() => {
      console.log('[ARUS] Database initialisation complete.');
      process.exit(0);
    })
    .catch(err => {
      console.error('[ARUS] Database initialisation failed:', err);
      process.exit(1);
    });

} else if (args.includes('--health-check')) {
  console.log('[ARUS] Health check: testing native module loading…');

  (async () => {
    try {
      const { createClient } = await import('@libsql/client');
      const client = createClient({ url: ':memory:' });
      const result = await client.execute('SELECT 1 AS ok');
      if (!result.rows[0]) throw new Error('libsql query returned no rows');
      client.close();
      console.log('[ARUS] ✅ @libsql/client — OK');

      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('health-check-test', 8);
      const valid = await bcrypt.compare('health-check-test', hash);
      if (!valid) throw new Error('bcryptjs compare returned false');
      console.log('[ARUS] ✅ bcryptjs — OK');

      console.log('[ARUS] Health check PASSED.');
      process.exit(0);
    } catch (err: any) {
      console.error('[ARUS] Health check FAILED:', err.message);
      console.error('       A native module is missing from the pkg snapshot.');
      console.error('       Check the asset manifest in build-sidecar.mjs.');
      process.exit(1);
    }
  })();
}
