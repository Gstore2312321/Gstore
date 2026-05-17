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

- GSAP leve en hero, productos, carrito y paneles.
- Duracion corta, sin rebotes.
- Respetar `prefers-reduced-motion`.

## Reglas

- Correo y numero del negocio no se imprimen en HTML ni JS publico.
- PayPal, Cloudinary y Resend solo desde backend.
- Admin protegido por clave y sin enlace desde la tienda.
- Nada de secretos en frontend.
