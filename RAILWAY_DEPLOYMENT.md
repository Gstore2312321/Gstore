# Deploy de GStore en Railway

## Recomendacion

Para esta tienda de bajo trafico, Railway es la opcion mas simple: Express corre como servidor real y MySQL queda como base administrada dentro del mismo proyecto.

## Pasos

0. Antes de subir a GitHub, valida la carpeta:

```bash
npm run check
npm run railway:check
```

1. Sube esta carpeta a GitHub.
2. En Railway, crea un proyecto nuevo desde el repo.
3. Agrega el plugin/servicio `MySQL` en el mismo proyecto.
4. Railway crea variables como `MYSQL_URL`, `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD` y `MYSQLDATABASE`.
5. Abre el servicio `Gstore` y vincula/pega las variables de MySQL si Railway no las comparte automaticamente.
6. Railway usa `railway.json` con `RAILPACK` y arranca con `npm start`.
7. Verifica que el start command sea `npm start`.
8. Configura las variables de entorno del admin.
9. Agrega tu dominio o subdominio en Railway.

## Variables minimas

```text
NODE_ENV=production
PUBLIC_BASE_URL=https://tu-subdominio.tudominio.com
ALLOWED_ORIGINS=https://tu-subdominio.tudominio.com

MYSQL_URL=mysql://usuario:clave@host:3306/base

STORE_NAME=GStore
STORE_CURRENCY=USD
STORE_TIME_ZONE=America/Guayaquil
DEFAULT_SHIPPING=0

STORE_OWNER_EMAIL=correo-admin@tudominio.com
ADMIN_EMAIL=correo-admin@tudominio.com
ADMIN_PASSWORD_HASH=hash-bcrypt-generado-localmente
ADMIN_SECRET=secreto-largo-de-minimo-32-caracteres-mejor-64
ADMIN_SESSION_HOURS=8
ADMIN_COOKIE_DOMAIN=

WHATSAPP_ADMIN_PHONE=593XXXXXXXXX

PAYPAL_MODE=live
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=gstore/productos
CLOUDINARY_URL=

RESEND_API_KEY=
RESEND_FROM_EMAIL=GStore <pedidos@tudominio.com>
RESEND_TO_EMAIL=correo-admin@tudominio.com
RESEND_REPLY_TO_EMAIL=
ERROR_ALERT_EMAIL=correo-admin@tudominio.com
ERROR_ALERT_MINUTES=15

MYSQL_BACKUP_URL=
BACKUP_DIR=/tmp/gstore-backups
BACKUP_COPY_DIR=
BACKUP_RETENTION_DAYS=30
```

Cloudinary acepta dos formas:

- Variables separadas: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- O una sola variable: `CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME`.

Si aparece `Invalid Signature`, casi siempre `CLOUDINARY_API_SECRET` no pertenece a la misma cuenta que el API key, se pegó el API key en lugar del API secret, o la variable quedó con comillas/espacios. Entra al panel y abre `/api/admin/cloudinary/status` para ver el diagnóstico privado sin exponer secretos.

## Base de datos

La app crea sola las tablas de MySQL al arrancar:

```text
categories
products
orders
```

No ejecutes migraciones manuales para el primer deploy. Si Railway ya puso `MYSQL_URL`, usa esa variable.

Si tu servicio de base se llama `MySQL`, en el servicio `Gstore` puedes crear esta variable como referencia:

```text
MYSQL_URL=${{MySQL.MYSQL_URL}}
```

Si el nombre del servicio es distinto, cambia `MySQL` por ese nombre exacto.

## Clave admin segura

Genera el hash localmente:

```bash
npm run hash:admin -- "tu-clave-larga"
```

Pega el resultado en Railway como:

```text
ADMIN_PASSWORD_HASH=$2...
```

No necesitas `ADMIN_PASSWORD` en producción si ya tienes `ADMIN_PASSWORD_HASH`.

## Usuario MySQL no-root

Después del primer deploy, crea un usuario de aplicación con:

```text
ops/create-gstore-mysql-user.sql
```

Cambia la clave del SQL, ejecútalo con el usuario root/admin y luego reemplaza `MYSQL_URL` por el usuario `gstore_app`.

## Backups

El script incluido crea un backup comprimido de MySQL:

```bash
npm run backup:mysql
```

Para automatizarlo, crea un segundo servicio o tarea programada usando el mismo repo y el comando `npm run backup:mysql`. Si el backup corre dentro de Railway, no lo consideres copia externa definitiva: usa `MYSQL_BACKUP_URL` desde otra maquina o define `BACKUP_COPY_DIR` en un job externo para guardar el `.json.gz` fuera del servidor.

## Imágenes locales

MySQL guarda productos y pedidos, pero no guarda archivos de imagen. Para subir imágenes sin Cloudinary, crea un volumen y monta `/data`, luego pon `UPLOAD_DIR=/data/uploads`.

## Imágenes

Para una tienda pequeña puedes usar volumen de Railway para imágenes. Para algo más profesional y fácil de migrar, usa Cloudinary.

## Resend

Resend se usa para:

- Avisar al administrador cuando entra un pedido.
- Enviar confirmación al cliente.
- Enviar enlaces de recuperación de clave admin.

Para producción, verifica un dominio en Resend y usa un remitente propio:

```text
RESEND_FROM_EMAIL=GStore <pedidos@tudominio.com>
```

La recuperación de clave solo envía enlace si el correo escrito coincide con `ADMIN_EMAIL` o `STORE_OWNER_EMAIL`. El enlace usa `PUBLIC_BASE_URL`, por eso debe estar puesto con el dominio real de Railway o tu subdominio.

## Dominio

Railway permite agregar dominios y subdominios desde el panel del servicio. Para un subdominio como `gstore.tudominio.com`, agregalo en Railway y apunta el DNS segun lo indique Railway.

## Pruebas reales post-deploy

Cuando Railway ya tenga variables reales y el dominio final responda:

```bash
npm run prod:check
npm run uptime:check
npm run paypal:check
npm run smoke:order
npm run smoke:cloudinary
```

Variables para `smoke:order`:

```text
SMOKE_BASE_URL=https://tu-dominio.com
SMOKE_CUSTOMER_PHONE=593...
SMOKE_CUSTOMER_EMAIL=cliente-real-o-test@dominio.com
SMOKE_TEST_PAYPAL=1
```

Variables para `smoke:cloudinary`:

```text
SMOKE_BASE_URL=https://tu-dominio.com
ADMIN_EMAIL=correo-admin@tudominio.com
ADMIN_LOGIN_PASSWORD=clave-admin-real
LIVE_UPLOAD_IMAGE=ruta/local/a/imagen-real.jpg
```

Para monitoreo externo sin depender de Railway, este repo incluye `.github/workflows/gstore-uptime.yml`. En GitHub configura `GSTORE_HEALTH_URL=https://tu-dominio.com/api/health` como variable o secreto del repo. Para alertas con correo/WhatsApp/SMS, conecta ademas un servicio externo como UptimeRobot o Better Stack al mismo endpoint.

## Antes de entregar

- Probar login admin.
- Subir una imagen.
- Crear producto.
- Crear pedido por WhatsApp.
- Cambiar estado del pedido.
- Revisar `/api/health`.
- Confirmar que el servicio `Gstore` puede leer `MYSQL_URL`.
- Ejecutar `npm run prod:check` con las variables reales.
- Ejecutar `npm run smoke:order` con WhatsApp y, si aplica, `SMOKE_TEST_PAYPAL=1`.
- Ejecutar `npm run smoke:cloudinary` con una imagen real desde admin.
- Ejecutar `npm run backup:mysql` y confirmar copia externa.
