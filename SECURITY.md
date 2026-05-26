# Seguridad de GStore

## Cubierto

- Admin sin enlace público desde la tienda.
- Páginas admin con `X-Robots-Tag: noindex, nofollow`.
- Headers de seguridad: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- `X-Powered-By` desactivado.
- HSTS activo en producción.
- CORS restringido a `PUBLIC_BASE_URL`, `ALLOWED_ORIGINS` y dominios de Vercel.
- Login con rate limit.
- Checkout con rate limit.
- Consulta pública de pedidos con rate limit.
- Sesión admin en cookie `HttpOnly`, `SameSite=Strict`, `Secure` en producción.
- Token CSRF requerido para mutaciones admin.
- `ADMIN_SECRET` fuerte obligatorio en producción.
- `ADMIN_PASSWORD_HASH` con bcrypt obligatorio en producción.
- Códigos de pedido con 16 caracteres aleatorios hexadecimales.
- Auditoría en tabla `audit_logs` para login, productos, categorías, uploads y cambios de estado.
- Upload de imagen valida bytes reales de JPG, PNG o WebP.
- Cloudinary o volumen persistente para uploads en producción.
- Diagnóstico privado de Cloudinary en `/api/admin/cloudinary/status` sin exponer secretos.
- Render dinámico con escape HTML/atributos.
- No se exponen costo privado ni variables sensibles en APIs públicas.

## Operación Requerida

1. Rotar la clave de MySQL que fue compartida durante configuración.
2. Crear usuario MySQL no-root con `ops/create-gstore-mysql-user.sql`.
3. Cambiar `MYSQL_URL` al usuario `gstore_app`.
4. Generar `ADMIN_PASSWORD_HASH` con `npm run hash:admin -- "tu-clave"`.
5. Quitar `ADMIN_PASSWORD` de Railway cuando `ADMIN_PASSWORD_HASH` esté activo.
6. Programar `npm run backup:mysql` como tarea recurrente o servicio programado.
7. Guardar backups fuera de Railway si la tienda empieza a vender a diario.
8. Agregar monitoreo de errores y alertas.
9. Verificar dominio de Resend para no usar remitente temporal.

## Backups

El script `npm run backup:mysql` exporta `categories`, `products`, `orders` y `audit_logs` a `backups/*.json.gz`.
No subas la carpeta `backups/` al repo.
