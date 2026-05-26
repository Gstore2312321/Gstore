# GStore Product Context

## Register

product

## Product Purpose

GStore es una tienda familiar de moda importada con catálogo pequeño, carrito, pedidos por WhatsApp, PayPal preparado y panel privado para administrar productos, categorías, imágenes, stock y pedidos.

## Users

- Compradoras que revisan ropa, zapatos, carteras y accesorios desde celular.
- Administradora de tienda que necesita agregar mercadería sin tocar código.
- Romalinks como responsable técnico de configuración, deploy e integraciones.

## Brand

La marca debe sentirse sencilla, cuidada y editorial: blanco cálido, dorado sobrio, texto humano y una experiencia limpia. El panel admin debe priorizar claridad operativa antes que decoración.

## Constraints

- No exponer correo privado ni teléfono admin en HTML o JS público.
- El panel admin no se enlaza desde la tienda.
- PayPal, Cloudinary, Resend y secretos viven en backend o variables de entorno.
- La tienda debe seguir funcionando con datos locales para demo y dejar listo el camino de producción.

## Success Criteria

- La tienda se ve profesional en móvil y desktop.
- El admin permite entrar con correo autorizado y clave.
- Productos, categorías, stock e imágenes se gestionan desde el panel.
- Pedidos quedan guardados y pueden abrirse en WhatsApp desde el backend.
