# Guía simple: ver CORTRIP funcionando (prueba gratis)
Use la laptop. Tiempo: unos 30 minutos. Si algo no coincide, deténgase y cuénteme qué ve.

## Palabras sencillas
- **Servidor:** una computadora de otra empresa, siempre encendida. Usted le alquila un espacio (en la prueba, gratis).
- **GitHub:** un disco duro en internet donde se guarda el programa.
- **Render:** la empresa que presta el servidor.

## PASO 1. Subir el programa a GitHub
1. Descomprima `cortrip-votacion.zip` (clic derecho > Extraer todo).
2. En github.com (con su cuenta): arriba a la derecha **+ > New repository**.
3. Nombre: `cortrip-votacion`. Marque **Private**. Clic en **Create repository**.
4. Clic en **uploading an existing file**. Arrastre TODO lo que hay DENTRO de la carpeta (src, public, schema.sql, package.json, render.yaml...). Clic en **Commit changes**.
✔ Se ven `render.yaml`, `package.json`, `src` y `public`.

## PASO 2. Cuenta en Render
En render.com > **Get Started** > elija **GitHub**.
✔ Ve el panel de Render.

## PASO 3. Crear todo con un clic
1. **New + > Blueprint** > elija `cortrip-votacion` > **Connect**.
2. Aparecen una base de datos y un servicio, ambos Free. Clic en **Apply**.
3. Espere 5 a 10 minutos hasta ver **Live** en verde.
✔ Dentro del servicio hay un enlace tipo `https://cortrip-votacion-xxxx.onrender.com`. Esa es su aplicación.

## PASO 4. Su clave de administrador
En el servicio > **Environment** > `ADMIN_TOKEN` > **Reveal** > copie. No la comparta.

## PASO 5. Preparar la prueba
1. Abra `SU-ENLACE/admin.html`. Pegue la clave.
2. **Cargar socios** (use los de ejemplo o a sus amigos) > clic.
3. **Crear elección** > clic. Responde `{"id":1}`.
4. **Abrir votación** > clic. Responde con 5 partes: **cópielas y guárdelas ahora**, no se vuelven a mostrar.

## PASO 6. Votar
Abra `SU-ENLACE`. Escriba cédula y correo de un socio cargado. En modo prueba el código aparece en pantalla. Elija lista y confirme.
✔ "Voto registrado".

## PASO 7. Contar
En `admin.html` > **Cierre y conteo** > pegue 3 de las 5 partes (una por línea) > **Contar votos**.

## Recuerde
El plan gratis es solo para pruebas: el servicio se duerme tras 15 minutos sin uso y tarda cerca de 1 minuto en despertar, y la base de datos gratis caduca. Para la elección real con 8000 socios hará falta un plan pago y WhatsApp.
