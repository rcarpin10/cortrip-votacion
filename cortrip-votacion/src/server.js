const express = require('express'); const path = require('path'); const { Pool } = require('pg'); const rate = require('express-rate-limit');
const k = require('./crypto'); const enviar = require('./whatsapp');
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express(); app.set('trust proxy', 1); app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'))); // las pantallas viven en el mismo servicio
app.use((q, s, n) => { // CORS: solo el sitio de votación puede llamar a la API
  s.set({ 'Access-Control-Allow-Origin': process.env.ORIGEN_PERMITIDO || '*', 'Access-Control-Allow-Headers': 'Content-Type,x-admin-token', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
  q.method === 'OPTIONS' ? s.sendStatus(204) : n(); });
app.use(rate({ windowMs: 60_000, limit: 30 }));
const admin = (q, s, n) => q.headers['x-admin-token'] === process.env.ADMIN_TOKEN ? n() : s.status(401).json({ error: 'No autorizado' });

async function audit(cl, evento, detalle) {
  const { rows } = await cl.query('SELECT hash FROM auditoria ORDER BY seq DESC LIMIT 1 FOR UPDATE');
  const prev = rows[0]?.hash || 'GENESIS';
  await cl.query('INSERT INTO auditoria(evento,detalle,prev_hash,hash) VALUES($1,$2,$3,$4)', [evento, detalle, prev, k.encadenar(prev, evento, detalle)]);
}
const tx = async fn => { const cl = await db.connect(); try { await cl.query('BEGIN'); const r = await fn(cl); await cl.query('COMMIT'); return r; } catch (e) { await cl.query('ROLLBACK'); throw e; } finally { cl.release(); } };

// ADMIN: cargar socios y crear elección (para no tocar la base de datos a mano)
app.post('/admin/socios', admin, async (q, s) => {
  const lista = Array.isArray(q.body && q.body.socios) ? q.body.socios : [];
  const r = { recibidos: lista.length, insertados: 0, ya_existian: 0, errores: [] };
  for (const x of lista) {
    const ced = String(x.cedula || '').replace(/\D/g, '');
    try {
      const res = await db.query(
        'INSERT INTO socios(cedula,nombre,categoria,al_dia,correo,whatsapp,fuente) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (cedula) DO NOTHING',
        [ced, String(x.nombre || '').trim(), String(x.categoria || 'activo').trim().toLowerCase(), x.al_dia !== false,
         String(x.correo || '').trim(), String(x.whatsapp || '').trim(), x.fuente || 'carga admin']);
      if (res.rowCount === 1) r.insertados++; else r.ya_existian++;
    } catch (e) { r.errores.push({ cedula: ced, motivo: e.message }); }
  }
  r.total_en_padron = (await db.query('SELECT count(*)::int n FROM socios')).rows[0].n;
  s.json(r);
});
app.post('/admin/elecciones', admin, async (q, s) => {
  const e = (await db.query('INSERT INTO elecciones(nombre) VALUES($1) RETURNING id', [q.body.nombre])).rows[0];
  for (const l of q.body.listas || []) await db.query('INSERT INTO listas(eleccion_id,nombre) VALUES($1,$2)', [e.id, l]);
  s.json({ id: e.id });
});

// ADMIN: abrir elección = congelar padrón + generar clave repartida (las partes se muestran UNA sola vez)
app.post('/admin/elecciones/:id/abrir', admin, async (q, s) => {
  try { s.json(await tx(async cl => {
    const e = (await cl.query('SELECT * FROM elecciones WHERE id=$1 FOR UPDATE', [q.params.id])).rows[0];
    if (!e || e.estado !== 'borrador') throw new Error('La elección debe estar en borrador');
    await cl.query(`INSERT INTO padron_congelado SELECT $1, cedula FROM socios WHERE categoria='activo' AND al_dia`, [e.id]);
    const ced = (await cl.query('SELECT cedula FROM padron_congelado WHERE eleccion_id=$1', [e.id])).rows.map(r => r.cedula);
    const ph = k.hashPadron(ced), clave = k.nuevaClaveEleccion(e.miembros, e.umbral);
    await cl.query(`UPDATE elecciones SET estado='abierta', clave_publica=$2, padron_hash=$3 WHERE id=$1`, [e.id, clave.publica, ph]);
    await audit(cl, 'ELECCION_ABIERTA', { id: e.id, habilitados: ced.length, padron_hash: ph });
    return { habilitados: ced.length, padron_hash: ph, partes_para_miembros_del_tribunal: clave.partes };
  })); } catch (err) { s.status(400).json({ error: err.message }); }
});

app.get('/version', (_q, s) => s.json({ version: 'v3', carga_socios: 'con diagnostico' }));

// PÚBLICO: listas y estado de la elección (para armar la papeleta)
app.get('/elecciones/:id/listas', async (q, s) => {
  const e = (await db.query('SELECT nombre, estado FROM elecciones WHERE id=$1', [q.params.id])).rows[0];
  if (!e) return s.status(404).json({ error: 'Elección no encontrada' });
  s.json({ ...e, listas: (await db.query('SELECT id, nombre FROM listas WHERE eleccion_id=$1 ORDER BY id', [q.params.id])).rows });
});

// VOTANTE paso 1: pedir código (cédula + correo deben coincidir con el padrón)
app.post('/votar/codigo', async (q, s) => {
  const { cedula, correo, eleccion } = q.body;
  const r = await db.query(`SELECT s.whatsapp FROM socios s JOIN padron_congelado p ON p.cedula=s.cedula
    WHERE s.cedula=$1 AND lower(s.correo)=lower($2) AND p.eleccion_id=$3`, [cedula, correo, eleccion]);
  if (r.rowCount && r.rows[0].whatsapp) { // respuesta idéntica exista o no el socio (no revela el padrón)
    const cod = k.codigoOTP(); global._cod = cod;
    await db.query('INSERT INTO otp VALUES($1,$2,$3,now()+interval \'10 minutes\',0,false)', [cedula, eleccion, k.sha(cod)]);
    await enviar(r.rows[0].whatsapp, cod);
  }
  const r2 = { mensaje: 'Si sus datos constan en el padrón, recibirá un código por WhatsApp.' };
  if (process.env.WHATSAPP_MODO !== 'cloud' && global._cod) r2.codigo_prueba = global._cod; // SOLO modo de prueba
  global._cod = null; s.json(r2);
});

// VOTANTE paso 2: emitir voto (participación y voto se guardan separados, sin vínculo)
app.post('/votar', async (q, s) => {
  const { cedula, codigo, eleccion, opcion } = q.body;
  try { s.json(await tx(async cl => {
    const e = (await cl.query('SELECT * FROM elecciones WHERE id=$1', [eleccion])).rows[0];
    if (e?.estado !== 'abierta') throw new Error('Elección no abierta');
    const o = (await cl.query(`SELECT ctid FROM otp WHERE cedula=$1 AND eleccion_id=$2 AND NOT usado AND expira>now() AND intentos<5 AND codigo_hash=$3`, [cedula, eleccion, k.sha(String(codigo))])).rows[0];
    if (!o) { await cl.query('UPDATE otp SET intentos=intentos+1 WHERE cedula=$1 AND eleccion_id=$2 AND NOT usado', [cedula, eleccion]); throw new Error('Código inválido o vencido'); }
    const validas = (await cl.query('SELECT id::text FROM listas WHERE eleccion_id=$1', [eleccion])).rows.map(r => r.id);
    if (opcion !== 'BLANCO' && !validas.includes(String(opcion))) throw new Error('Opción inválida');
    await cl.query('UPDATE otp SET usado=true WHERE cedula=$1 AND eleccion_id=$2', [cedula, eleccion]);
    await cl.query('INSERT INTO participacion VALUES($1,$2)', [eleccion, cedula]); // PK impide doble voto
    await cl.query('INSERT INTO votos(eleccion_id,cifrado) VALUES($1,$2)', [eleccion, k.cifrarVoto(e.clave_publica, String(opcion))]);
    await audit(cl, 'VOTO_EMITIDO', { eleccion }); // sin cédula ni opción
    return { ok: true };
  })); } catch (err) { s.status(err.code === '23505' ? 409 : 400).json({ error: err.code === '23505' ? 'Ya votó' : err.message }); }
});

// ADMIN: cerrar y escrutar con ≥ umbral partes del Tribunal
app.post('/admin/elecciones/:id/escrutinio', admin, async (q, s) => {
  try { s.json(await tx(async cl => {
    const e = (await cl.query('SELECT * FROM elecciones WHERE id=$1 FOR UPDATE', [q.params.id])).rows[0];
    if (!['abierta', 'cerrada'].includes(e?.estado)) throw new Error('Estado inválido');
    const priv = k.claveDesdePartes(q.body.partes);
    const votos = (await cl.query('SELECT cifrado FROM votos WHERE eleccion_id=$1', [e.id])).rows;
    const cuenta = {}; for (const v of votos) { const o = k.descifrarVoto(priv, v.cifrado); cuenta[o] = (cuenta[o] || 0) + 1; }
    const part = (await cl.query('SELECT count(*)::int n FROM participacion WHERE eleccion_id=$1', [e.id])).rows[0].n;
    const total = Object.values(cuenta).reduce((a, b) => a + b, 0);
    if (total !== part) throw new Error(`Inconsistencia: ${total} votos vs ${part} participantes`);
    const blancos = cuenta.BLANCO || 0; delete cuenta.BLANCO;            // Art. 23.c: blancos y nulos no suman
    const ord = Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
    const empate = ord.length > 1 && ord[0][1] === ord[1][1];            // Art. 25.g: segunda vuelta
    const acta = { eleccion: e.id, padron_hash: e.padron_hash, participantes: part, votos_por_lista: cuenta, blancos, empate_requiere_segunda_vuelta: empate };
    const acta_hash = k.sha(JSON.stringify(acta));
    await cl.query(`UPDATE elecciones SET estado='escrutada' WHERE id=$1`, [e.id]);
    await audit(cl, 'ESCRUTINIO', { ...acta, acta_hash });
    return { acta, acta_hash };
  })); } catch (err) { s.status(400).json({ error: err.message }); }
});

// PÚBLICO: verificar la cadena de auditoría
app.get('/auditoria/verificar', async (_q, s) => {
  const { rows } = await db.query('SELECT * FROM auditoria ORDER BY seq'); let prev = 'GENESIS';
  for (const r of rows) { if (r.prev_hash !== prev || r.hash !== k.encadenar(prev, r.evento, r.detalle)) return s.json({ integra: false, falla_en: r.seq }); prev = r.hash; }
  s.json({ integra: true, eventos: rows.length, ultimo_hash: prev });
});
app.listen(process.env.PORT || 3000, () => console.log('CORTRIP backend activo'));
