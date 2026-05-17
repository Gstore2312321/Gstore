# GStore Product Context

## Register

product

## Product Purpose

GStore es una tienda familiar de moda importada con catalogo pequeno, carrito, pedidos por WhatsApp, PayPal preparado y panel privado para administrar productos, categorias, imagenes, stock y pedidos.

## Users

- Compradoras que revisan ropa, zapatos, carteras y accesorios desde celular.
- Administradora de tienda que necesita agregar mercaderia sin tocar codigo.
- Romalinks como responsable tecnico de configuracion, deploy e integraciones.

## Brand

La marca debe sentirse sencilla, cuidada y editorial: blanco calido, dorado sobrio, texto humano y una experiencia limpia. El panel admin debe priorizar claridad operativa antes que decoracion.

## Constraints

- No exponer correo privado ni telefono admin en HTML o JS publico.
- El panel admin no se enlaza desde la tienda.
- PayPal, Cloudinary, Resend y secretos viven en backend o variables de entorno.
- La tienda debe seguir funcionando con datos locales para demo y dejar listo el camino de produccion.

## Success Criteria

- La tienda se ve profesional en movil y desktop.
- El admin permite entrar con correo autorizado y clave.
- Productos, categorias, stock e imagenes se gestionan desde el panel.
- Pedidos quedan guardados y pueden abrirse en WhatsApp desde el backend.
