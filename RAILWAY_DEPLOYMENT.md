# Deploy de GStore en Railway

## Recomendacion

Para esta tienda de bajo trafico, Railway es la opcion mas simple: Express corre como servidor real y puedes montar un volumen persistente para SQLite e imagenes locales.

## Pasos

1. Sube esta carpeta a GitHub.
2. En Railway, crea un proyecto nuevo desde el repo.
3. Railway detecta Node/Nixpacks.
4. Verifica que el start command sea `npm start`.
5. Crea un volumen persistente y montalo en una ruta como `/data`.
6. Railway expone esa ruta como `RAILWAY_VOLUME_MOUNT_PATH`; el backend la detecta automaticamente.
7. Configura las variables de entorno.
8. Agrega tu dominio o subdominio en Railway.

## Variables minimas

```text
NODE_ENV=production
PUBLIC_BASE_URL=https://tu-subdominio.tudominio.com
ALLOWED_ORIGINS=https://tu-subdominio.tudominio.com

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

## Volumen

Con volumen montado, la app guarda automaticamente:

```text
/data/data/gstore.db
/data/uploads/
```

Si prefieres rutas explicitas:

```text
DATA_DIR=/data/data
UPLOAD_DIR=/data/uploads
```

## Imagenes

Para una tienda pequena puedes usar el volumen de Railway para imagenes. Para algo mas profesional y facil de migrar, usa Cloudinary.

## Dominio

Railway permite agregar dominios y subdominios desde el panel del servicio. Para un subdominio como `gstore.tudominio.com`, agregalo en Railway y apunta el DNS segun lo indique Railway.

## Antes de entregar

- Probar login admin.
- Subir una imagen.
- Crear producto.
- Crear pedido por WhatsApp.
- Cambiar estado del pedido.
- Revisar `/api/health`.
- Confirmar que el volumen esta montado antes de guardar datos reales.
