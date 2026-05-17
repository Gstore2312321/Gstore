# Seguridad de GStore

## Cubierto

- Admin sin enlace publico desde la tienda.
- Paginas admin con `X-Robots-Tag: noindex, nofollow`.
- Headers de seguridad: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- `X-Powered-By` desactivado.
- HSTS activo en produccion.
- CORS restringido a `PUBLIC_BASE_URL`, `ALLOWED_ORIGINS` y dominios de Vercel.
- Login con rate limit.
- Checkout con rate limit.
- Sesion admin en cookie `HttpOnly`, `SameSite=Strict`, `Secure` en produccion.
- Token CSRF requerido para mutaciones admin.
- `ADMIN_SECRET` fuerte obligatorio en produccion.
- Upload de imagen valida bytes reales de JPG, PNG o WebP.
- Cloudinary obligatorio para uploads en Vercel/produccion.
- Render dinamico con escape HTML/atributos.
- No se exponen costo privado ni variables sensibles en APIs publicas.

## Pendiente Recomendado

1. Migrar SQLite local a una base persistente para produccion.
2. Si se usa Supabase/Postgres directo, activar RLS y politicas por tabla.
3. Agregar auditoria de acciones admin: crear, editar, eliminar, cambio de estado.
4. Agregar backups automaticos de base de datos.
5. Agregar monitoreo de errores y alertas.
6. Usar HTTPS obligatorio en dominio final.
7. Rotar `ADMIN_SECRET` y claves si alguien externo tuvo acceso al repositorio o `.env`.
8. Verificar dominio de Resend para no usar remitente temporal.
9. Separar entorno preview y produccion en Vercel con variables distintas.

## RLS

RLS no aplica mientras el backend sea Express con SQLite. Si se migra a Supabase, las tablas privadas deben negar acceso anonimo por defecto y exponer solo funciones o endpoints server-side para admin.
