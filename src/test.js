const k = require('./crypto'); const assert = require('assert');
const { publica, partes } = k.nuevaClaveEleccion(5, 3);
const votos = ['L1','L2','BLANCO','L1','L1'].map(o => k.cifrarVoto(publica, o));
// 3 de 5 miembros reconstruyen la clave
const priv = k.claveDesdePartes([partes[0], partes[2], partes[4]]);
const cuenta = {}; votos.forEach(v => { const o = k.descifrarVoto(priv, v); cuenta[o] = (cuenta[o]||0)+1; });
assert.deepStrictEqual(cuenta, { L1: 3, L2: 1, BLANCO: 1 });
// 2 de 5 NO bastan
let fallo = false; try { k.descifrarVoto(k.claveDesdePartes([partes[0], partes[1]]), votos[0]); } catch { fallo = true; }
assert(fallo);
// cadena de auditoría detecta alteración
let h = 'GENESIS'; const ev = ['abre','vota','cierra'].map(e => (h = k.encadenar(h, e, {}), h));
assert.notStrictEqual(ev[1], k.encadenar('GENESIS','vota',{}));
// hash de padrón independiente del orden
assert.strictEqual(k.hashPadron(['b','a']), k.hashPadron(['a','b']));
console.log('OK: Shamir 3-de-5, voto cifrado, cadena y padrón verificados', cuenta);
