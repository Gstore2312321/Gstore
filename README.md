# GStore

Tienda sencilla para moda, zapatos, carteras y accesorios con backend propio.

## Incluye

- Tienda publica responsive en `public/index.html`.
- Panel admin protegido en `public/admin.html`, sin enlace desde la tienda.
- Acceso admin con correo autorizado y hash bcrypt desde `.env`.
- Sesion admin temporal con cookie `HttpOnly`, `SameSite=Strict` y token CSRF.
- CORS limitado por dominio permitido y headers de seguridad en backend.
- Rate limit para login y checkout.
- Rate limit para consulta publica de pedidos.
- Backend Express con MySQL.
- Auditoria de cambios en `audit_logs`.
- Productos, categorias, tallas, colores, stock general e imagenes.
- Pedidos por WhatsApp desde backend.
- PayPal preparado por variables de entorno.
- Cloudinary preparado para subir imagenes desde el panel.
- Resend preparado para notificar pedidos por correo.
- Recuperación de clave admin por Resend.
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
- `ADMIN_PASSWORD_HASH` generado con `npm run hash:admin -- "tu-clave-larga"`
- `ADMIN_SESSION_HOURS`
- `ADMIN_COOKIE_DOMAIN` opcional si usaras subdominios compartiendo sesion
- `ALLOWED_ORIGINS` con el dominio real y cualquier subdominio permitido
- `MYSQL_URL` o las variables `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`
- `UPLOAD_DIR` solo si usaras volumen para imagenes locales
- Credenciales de `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`
- Credenciales de Cloudinary:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `CLOUDINARY_FOLDER`
  - `CLOUDINARY_URL` opcional si prefieres usar la URL completa
- Credenciales de Resend:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `RESEND_TO_EMAIL`
  - `RESEND_REPLY_TO_EMAIL` opcional
- `PUBLIC_BASE_URL` por el dominio real
- `STORE_TIME_ZONE` y `DEFAULT_SHIPPING` si cambian la zona horaria o el costo de envío

El correo privado y el numero de WhatsApp viven solo en variables de entorno. No se imprimen en la tienda publica.

## Railway

Para esta tienda, Railway es la opcion recomendada con Express + MySQL. Agrega un servicio MySQL en Railway y asegúrate de que el servicio `Gstore` reciba `MYSQL_URL`.

Antes de subir a GitHub o conectar Railway, corre:

```bash
npm run check
npm run railway:check
```

Variables minimas en Railway:

```text
NODE_ENV=production
PUBLIC_BASE_URL=https://tu-dominio.com
ALLOWED_ORIGINS=https://tu-dominio.com,https://admin.tu-dominio.com
MYSQL_URL=mysql://usuario:clave@host:3306/base
STORE_NAME=GStore
STORE_CURRENCY=USD
STORE_TIME_ZONE=America/Guayaquil
DEFAULT_SHIPPING=0
ADMIN_EMAIL=...
ADMIN_PASSWORD_HASH=$2...
ADMIN_SECRET=...
ADMIN_SESSION_HOURS=8
ADMIN_COOKIE_DOMAIN=
WHATSAPP_ADMIN_PHONE=593...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=gstore/productos
CLOUDINARY_URL=
RESEND_API_KEY=...
RESEND_FROM_EMAIL=GStore <pedidos@tu-dominio.com>
RESEND_TO_EMAIL=...
RESEND_REPLY_TO_EMAIL=...
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```

Si Cloudinary muestra `Invalid Signature`, revisa que el API key y API secret sean de la misma cuenta. El panel tiene diagnostico privado en `/api/admin/cloudinary/status`; muestra valores enmascarados, carpeta y advertencias sin exponer secretos.

La app crea sola las tablas `categories`, `products` y `orders` cuando arranca.
Tambien crea `audit_logs`, `app_settings` y `password_reset_tokens`.
La recuperacion de clave usa `ADMIN_EMAIL`, `PUBLIC_BASE_URL` y Resend. Mantén `ADMIN_PASSWORD_HASH` en Railway como clave inicial y fallback seguro.

## Seguridad operativa

Antes de vender en serio:

1. Rota la clave de MySQL si fue compartida.
2. Crea usuario no-root usando `ops/create-gstore-mysql-user.sql`.
3. Cambia `MYSQL_URL` para usar ese usuario.
4. Genera `ADMIN_PASSWORD_HASH`:

```bash
npm run hash:admin -- "tu-clave-larga"
```

5. Programa backups con:

```bash
npm run backup:mysql
```

Lee `RAILWAY_DEPLOYMENT.md` antes de publicar.
