# GStore Design System

## Escena

Una tienda familiar de moda importada se revisa desde celular, de día, con una persona administrando pocos productos reales y compradores que necesitan decidir rápido por talla, color, precio y disponibilidad.

## Identidad

- Superficie: blanco cálido, no blanco puro.
- Texto: tinta suave casi negra.
- Primario: dorado editorial.
- Secundario: champagne y verde salvia ligero para estados tranquilos.
- Tipografía: Outfit para todo el producto, con Calibri como fallback.

## Componentes

- Header flotante sobrio, sin enlace visible al panel.
- Catálogo con filtros claros y cards de producto con imagen protagonista.
- Drawer de carrito, checkout y detalle de producto.
- Admin separado, denso y fácil: formularios, tablas, estados y acciones directas.

## Motion

- GSAP leve en catálogo, productos, carrito y paneles.
- Duración corta, sin rebotes.
- Respetar `prefers-reduced-motion`.

## Reglas

- Correo y número del negocio no se imprimen en HTML ni JS público.
- PayPal, Cloudinary y Resend solo desde backend.
- Admin protegido por clave y sin enlace desde la tienda.
- Nada de secretos en frontend.

## Responsive operativo

- En móvil, la tienda prioriza decisión rápida: cards compactas, CTAs visibles, detalle como bottom sheet y checkout con acciones persistentes.
- En móvil, la tienda entra directo al catálogo. No hay hero, índice inferior ni franja de beneficios mientras el proyecto esté en modo catálogo/carrito.
- En móvil, el admin prioriza operación: navegación visible en dos filas, métricas en grilla corta, tablas convertidas en fichas densas y drawers con footer fijo.
- Los gráficos de admin ocultan etiquetas largas en pantallas pequeñas para evitar cortes visuales.
