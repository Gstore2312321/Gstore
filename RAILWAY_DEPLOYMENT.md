# Deploy de GStore en Railway

## Recomendacion

Para esta tienda de bajo trafico, Railway es la opcion mas simple: Express corre como servidor real y MySQL queda como base administrada dentro del mismo proyecto.

## Pasos

1. Sube esta carpeta a GitHub.
2. En Railway, crea un proyecto nuevo desde el repo.
3. Agrega el plugin/servicio `MySQL` en el mismo proyecto.
4. Railway crea variables como `MYSQL_URL`, `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD` y `MYSQLDATABASE`.
5. Abre el servicio `Gstore` y vincula/pega las variables de MySQL si Railway no las comparte automaticamente.
6. Railway detecta Node/Nixpacks.
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
ADMIN_PASSWORD=clave-larga-de-minimo-12-caracteres
ADMIN_SECRET=secreto-largo-de-minimo-32-caracteres-mejor-64
ADMIN_SESSION_HOURS=8
ADMIN_COOKIE_DOMAIN=

WHATSAPP_ADMIN_PHONE=593XXXXXXXXX

PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=gstore/productos

RESEND_API_KEY=
RESEND_FROM_EMAIL=GStore <pedidos@tudominio.com>
RESEND_TO_EMAIL=correo-admin@tudominio.com
RESEND_REPLY_TO_EMAIL=
```

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

## Imagenes locales

MySQL guarda productos y pedidos, pero no guarda archivos de imagen. Para subir imagenes sin Cloudinary, crea un volumen y monta `/data`, luego pon `UPLOAD_DIR=/data/uploads`.

## Imagenes

Para una tienda pequena puedes usar volumen de Railway para imagenes. Para algo mas profesional y facil de migrar, usa Cloudinary.

## Dominio

Railway permite agregar dominios y subdominios desde el panel del servicio. Para un subdominio como `gstore.tudominio.com`, agregalo en Railway y apunta el DNS segun lo indique Railway.

## Antes de entregar

- Probar login admin.
- Subir una imagen.
- Crear producto.
- Crear pedido por WhatsApp.
- Cambiar estado del pedido.
- Revisar `/api/health`.
- Confirmar que el servicio `Gstore` puede leer `MYSQL_URL`.
