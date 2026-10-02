# CORTRIP backend (v0.1)
1. Crear PostgreSQL gestionado; ejecutar `schema.sql`.
2. Copiar `.env.example` a `.env` y completar.
3. `npm install && npm test && npm start`.
Flujo: cargar socios -> crear elección y listas -> POST /admin/elecciones/:id/abrir (reparte 5 partes de la clave, umbral 3) -> votación -> POST /admin/elecciones/:id/escrutinio con 3 partes -> acta + hash -> publicar hash.
WhatsApp: WHATSAPP_MODO=consola para pruebas (el código sale en el log); cloud requiere WhatsApp Business Cloud API (WA_PHONE_ID, WA_TOKEN).
