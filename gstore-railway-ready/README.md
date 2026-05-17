# GStore

Tienda sencilla para moda, zapatos, carteras y accesorios con backend propio.

## Incluye

- Tienda publica responsive en `public/index.html`.
- Panel admin protegido en `public/admin.html`, sin enlace desde la tienda.
- Acceso admin con correo autorizado y clave privada desde `.env`.
- Sesion admin temporal con cookie `HttpOnly`, `SameSite=Strict` y token CSRF.
- CORS limitado por dominio permitido y headers de seguridad en backend.
- Rate limit para login y checkout.
- Backend Express con SQLite nativo de Node 24.
- Productos, categorias, tallas, colores, stock general e imagenes.
- Pedidos por WhatsApp desde backend.
- PayPal preparado por variables de entorno.
- Cloudinary preparado para subir imagenes desde el panel.
- Resend preparado para notificar pedidos por correo.
- Checkout con correo de cliente obligatorio para confirmar pedidos.

## Ejecutar

```bash
npm install
npm start
```

Abrir:

```text
http://localhost:4321
http://localhost:4321/admin.html
```

## Configuracion

El archivo `.env` local ya deja la tienda lista para pruebas. Para produccion, cambia:

- `ADMIN_SECRET`
- `ADMIN_PASSWORD` por una clave larga
- `ADMIN_SESSION_HOURS`
- `ADMIN_COOKIE_DOMAIN` opcional si usaras subdominios compartiendo sesion
- `ALLOWED_ORIGINS` con el dominio real y cualquier subdominio permitido
- `DATA_DIR` y `UPLOAD_DIR` solo si necesitas rutas persistentes manuales
- Credenciales de `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`
- Credenciales de Cloudinary:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `CLOUDINARY_FOLDER`
- Credenciales de Resend:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `RESEND_TO_EMAIL`
  - `RESEND_REPLY_TO_EMAIL` opcional
- `PUBLIC_BASE_URL` por el dominio real
- `STORE_TIME_ZONE` y `DEFAULT_SHIPPING` si cambian la zona horaria o el costo de envío

El correo privado y el numero de WhatsApp viven solo en variables de entorno. No se imprimen en la tienda publica.

## Vercel

El proyecto incluye:

- `api/index.js` para usar Express como Function.
- `vercel.json` con rewrite de todas las rutas hacia el backend.
- `engines.node = 24.x`, necesario por `node:sqlite`.

Variables minimas en Vercel:

```text
NODE_ENV=production
PUBLIC_BASE_URL=https://tu-dominio.com
ALLOWED_ORIGINS=https://tu-dominio.com,https://admin.tu-dominio.com
STORE_NAME=GStore
STORE_CURRENCY=USD
STORE_TIME_ZONE=America/Guayaquil
DEFAULT_SHIPPING=0
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
ADMIN_SECRET=...
ADMIN_SESSION_HOURS=8
ADMIN_COOKIE_DOMAIN=
WHATSAPP_ADMIN_PHONE=593...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=gstore/productos
RESEND_API_KEY=...
RESEND_FROM_EMAIL=GStore <pedidos@tu-dominio.com>
RESEND_TO_EMAIL=...
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```

Importante: Vercel Functions no son un servidor con disco persistente. Cloudinary debe estar configurado para imagenes. La base SQLite local sirve para demo o pruebas; para produccion con pedidos reales conviene migrar datos a Postgres administrado, Supabase, Neon o Railway con volumen/base persistente.

## Nota de produccion

Esta version usa SQLite local. Sirve para una tienda pequena con pocos productos y administracion simple. Para crecer a varias personas administrando a la vez, conviene migrar la base a Postgres o un servicio administrado con backups.

## Railway

Para esta tienda, Railway es la opcion recomendada si quieres mantener Express + SQLite sin montar una base externa. Crea un volumen persistente y la app detecta `RAILWAY_VOLUME_MOUNT_PATH` automaticamente para guardar `gstore.db` e imagenes locales.

Lee `RAILWAY_DEPLOYMENT.md` antes de publicar.
