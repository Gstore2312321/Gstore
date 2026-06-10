# GStore

Tienda sencilla para moda, zapatos, carteras y accesorios con backend propio.

## Incluye

- Tienda pública responsive en `public/index.html`.
- Panel admin protegido en `/admin`, sin enlace desde la tienda.
- Acceso admin con correo autorizado y hash bcrypt desde `.env`.
- Sesión admin temporal con cookie `HttpOnly`, `SameSite=Strict` y token CSRF.
- CORS limitado por dominio permitido y headers de seguridad en backend.
- Rate limit para login y checkout.
- Rate limit para consulta pública de pedidos.
- Backend Express con MySQL.
- Auditoría de cambios en `audit_logs`.
- Productos, categorías, tallas, colores, stock general e imágenes.
- Pedidos por WhatsApp desde backend.
- PayPal preparado por variables de entorno.
- Cloudinary preparado para subir imágenes desde el panel.
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
http://localhost:4321/admin
```

## Configuración

Crea un `.env` local desde `.env.example` solo si vas a probar en tu máquina. Para producción, configura estas variables directamente en Railway y no subas `.env` al repo:

- `ADMIN_SECRET`
- `ADMIN_PASSWORD_HASH` generado con `npm run hash:admin -- "tu-clave-larga"`
- `ADMIN_SESSION_HOURS`
- `ADMIN_COOKIE_DOMAIN` opcional si usarás subdominios compartiendo sesión
- `ALLOWED_ORIGINS` con el dominio real y cualquier subdominio permitido
- `MYSQL_URL` o las variables `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`
- `UPLOAD_DIR` solo si usarás volumen para imágenes locales
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
- Alertas de errores:
  - `ERROR_ALERT_EMAIL`
  - `ERROR_ALERT_MINUTES`
- Backups:
  - `MYSQL_BACKUP_URL` opcional si usarÃ¡s un usuario distinto al de la app
  - `BACKUP_DIR` para la carpeta temporal/local
  - `BACKUP_COPY_DIR` para copiar el backup fuera del servidor
  - `BACKUP_RETENTION_DAYS`
- `PUBLIC_BASE_URL` por el dominio real
- `STORE_TIME_ZONE` y `DEFAULT_SHIPPING` si cambian la zona horaria o el costo de envío

El correo privado y el número de WhatsApp viven solo en variables de entorno. No se imprimen en la tienda pública.

## Railway

Para esta tienda, Railway es la opción recomendada con Express + MySQL. Agrega un servicio MySQL en Railway y asegúrate de que el servicio `Gstore` reciba `MYSQL_URL`.

Antes de subir a GitHub o conectar Railway, corre:

```bash
npm run check
npm run railway:check
npm run prod:check
```

Checks adicionales cuando ya tengas dominio y credenciales reales:

```bash
npm run uptime:check
npm run paypal:check
npm run smoke:order
npm run smoke:cloudinary
npm run test:real-products
```

`smoke:order` crea un pedido real contra `PUBLIC_BASE_URL` o `SMOKE_BASE_URL`. Necesita `SMOKE_CUSTOMER_PHONE` y `SMOKE_CUSTOMER_EMAIL`. Si pones `SMOKE_TEST_PAYPAL=1`, tambien crea una orden PayPal y devuelve el `approvalUrl` para completar el pago con una cuenta real/sandbox.

`paypal:check` valida `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` y `PUBLIC_BASE_URL` contra OAuth de PayPal. No crea pedidos ni cobra.

`smoke:cloudinary` entra al admin con `ADMIN_EMAIL` + `ADMIN_LOGIN_PASSWORD` y sube una imagen real por `/api/admin/upload`. Falla si el provider no es `cloudinary`, salvo que definas `ALLOW_LOCAL_UPLOAD=1` para pruebas locales.

El monitoreo externo incluido usa GitHub Actions en `.github/workflows/gstore-uptime.yml`. Configura `GSTORE_HEALTH_URL=https://tu-dominio.com/api/health` como variable o secreto del repo para revisar la tienda cada 15 minutos.

## Importar lote de productos a Cloudinary

Para subir las imágenes de `data/imported-products.json` a Cloudinary y dejar el catálogo apuntando a CDN:

```bash
npm run cloudinary:import
```

El comando necesita una de estas configuraciones en `.env` o en las variables de Railway:

```text
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=gstore/productos
```

O una sola variable:

```text
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

Para revisar el lote sin subir nada:

```bash
npm run cloudinary:import:dry
```

En Windows tambien puedes usar el helper local. Te pide `CLOUDINARY_URL` en consola y no la guarda en archivos:

```bash
npm run cloudinary:import:local
```

Variables mínimas en Railway:

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
ERROR_ALERT_EMAIL=...
ERROR_ALERT_MINUTES=15
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
MYSQL_BACKUP_URL=
BACKUP_DIR=/tmp/gstore-backups
BACKUP_COPY_DIR=
BACKUP_RETENTION_DAYS=30
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

En producciÃ³n, no dejes el Ãºnico backup dentro del mismo servidor. Configura `BACKUP_COPY_DIR` si corres el backup desde una mÃ¡quina externa, o usa un job externo con `MYSQL_BACKUP_URL` para guardar el `.json.gz` fuera de Railway.

Lee `RAILWAY_DEPLOYMENT.md` antes de publicar.
