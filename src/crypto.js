// Núcleo criptográfico sin dependencias externas (solo módulo 'crypto' de Node)
const c = require('crypto');
const sha = s => c.createHash('sha256').update(s).digest('hex');

// --- Shamir sobre GF(256): reparte un secreto en n partes, k bastan ---
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x ^= (x << 1) ^ (x & 128 ? 0x11b : 0); x &= 255; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;
const inv = a => EXP[255 - LOG[a]];
function split(secret, n, k) {
  const shares = Array.from({ length: n }, (_, i) => ({ x: i + 1, y: Buffer.alloc(secret.length) }));
  for (let b = 0; b < secret.length; b++) {
    const coef = [secret[b], ...c.randomBytes(k - 1)];
    for (const s of shares) { let y = 0, xp = 1; for (const a of coef) { y ^= mul(a, xp); xp = mul(xp, s.x); } s.y[b] = y; }
  }
  return shares.map(s => `${s.x}:${s.y.toString('hex')}`);
}
function combine(strs) {
  const sh = strs.map(s => { const [x, y] = s.split(':'); return { x: +x, y: Buffer.from(y, 'hex') }; });
  const out = Buffer.alloc(sh[0].y.length);
  for (let b = 0; b < out.length; b++) {
    let acc = 0;
    for (const i of sh) { let num = 1, den = 1;
      for (const j of sh) if (i !== j) { num = mul(num, j.x); den = mul(den, i.x ^ j.x); }
      acc ^= mul(i.y[b], mul(num, inv(den))); }
    out[b] = acc;
  }
  return out;
}

// --- Clave de la elección: RSA-OAEP. La privada se parte entre el Tribunal ---
function nuevaClaveEleccion(n, k) {
  const { publicKey, privateKey } = c.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const der = privateKey.export({ type: 'pkcs8', format: 'der' });
  return { publica: publicKey.export({ type: 'spki', format: 'pem' }), partes: split(der, n, k) }; // la privada NO se guarda
}
const cifrarVoto = (pub, opcion) => c.publicEncrypt({ key: pub, oaepHash: 'sha256' },
  Buffer.from(JSON.stringify({ o: opcion, n: c.randomBytes(8).toString('hex') }))).toString('base64');
function descifrarVoto(priv, b64) {
  return JSON.parse(c.privateDecrypt({ key: priv, oaepHash: 'sha256' }, Buffer.from(b64, 'base64')).toString()).o;
}
const claveDesdePartes = partes => c.createPrivateKey({ key: combine(partes), format: 'der', type: 'pkcs8' });

// --- Cadena de hashes (auditoría) ---
const encadenar = (prev, evento, detalle) => sha(prev + evento + JSON.stringify(detalle));
const hashPadron = cedulas => sha([...cedulas].sort().join('\n'));
const codigoOTP = () => String(c.randomInt(0, 1e6)).padStart(6, '0');

module.exports = { sha, split, combine, nuevaClaveEleccion, cifrarVoto, descifrarVoto, claveDesdePartes, encadenar, hashPadron, codigoOTP };
