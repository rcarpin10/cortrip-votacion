// Crea las tablas la primera vez que arranca (no hace nada si ya existen)
const { Pool } = require('pg'); const fs = require('fs'); const path = require('path');
(async () => {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await db.query(`SELECT to_regclass('public.socios') AS t`);
  if (!rows[0].t) { await db.query(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8')); console.log('Tablas creadas'); }
  else console.log('Tablas ya existen');
  await db.end();
})().catch(e => { console.error(e); process.exit(1); });
