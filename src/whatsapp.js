// Envío de códigos. Modo "consola" para pruebas; "cloud" para la API oficial de Meta.
module.exports = async function enviarCodigo(telefono, codigo) {
  const msg = `CORTRIP: su código de verificación es ${codigo}. Vence en 10 minutos. No lo comparta con nadie.`;
  if (process.env.WHATSAPP_MODO !== 'cloud') { console.log(`[WhatsApp simulado] a ${telefono}: ${msg}`); return; }
  const r = await fetch(`https://graph.facebook.com/v20.0/${process.env.WA_PHONE_ID}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: telefono.replace(/\D/g, ''), type: 'text', text: { body: msg } }) });
  if (!r.ok) throw new Error('WhatsApp falló: ' + r.status);
};
