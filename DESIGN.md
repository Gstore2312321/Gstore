# GStore Design System

## Escena

Una tienda familiar de moda importada se revisa desde celular, de dia, con una persona administrando pocos productos reales y compradores que necesitan decidir rapido por talla, color, precio y disponibilidad.

## Identidad

- Superficie: blanco calido, no blanco puro.
- Texto: tinta suave casi negra.
- Primario: dorado editorial.
- Secundario: champagne y verde salvia ligero para estados tranquilos.
- Tipografia: Outfit para todo el producto, con Calibri como fallback.

## Componentes

- Header flotante sobrio, sin enlace visible al panel.
- Catalogo con filtros claros y cards de producto con imagen protagonista.
- Drawer de carrito, checkout y detalle de producto.
- Admin separado, denso y facil: formularios, tablas, estados y acciones directas.

## Motion

- GSAP leve en catalogo, productos, carrito y paneles.
- Duracion corta, sin rebotes.
- Respetar `prefers-reduced-motion`.

## Reglas

- Correo y numero del negocio no se imprimen en HTML ni JS publico.
- PayPal, Cloudinary y Resend solo desde backend.
- Admin protegido por clave y sin enlace desde la tienda.
- Nada de secretos en frontend.

## Responsive operativo

- En móvil, la tienda prioriza decisión rápida: cards compactas, CTAs visibles, detalle como bottom sheet y checkout con acciones persistentes.
- En móvil, la tienda entra directo al catálogo. No hay hero, indice inferior ni franja de beneficios mientras el proyecto este en modo catalogo/carrito.
- En móvil, el admin prioriza operación: navegación visible en dos filas, métricas en grilla corta, tablas convertidas en fichas densas y drawers con footer fijo.
- Los gráficos de admin ocultan etiquetas largas en pantallas pequeñas para evitar cortes visuales.
