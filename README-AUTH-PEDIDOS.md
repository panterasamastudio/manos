# ClayHand 3D — autenticación, perfil y pedidos

## Requerimientos escalonados implementados

### 1. Login / registro con Google
- `auth.js` centraliza la sesión.
- El usuario puede registrarse o volver a ingresar usando Google.
- La sesión y los datos básicos se guardan para mantener la experiencia entre páginas.

### 2. Perfil privado
- Se agregó `perfil.html`.
- "Mi perfil" se muestra en navegación sólo cuando existe una sesión.
- El usuario puede modificar nombre completo, teléfono, dirección y código postal.
- Los pedidos muestran estado, número de seguimiento y entrega estimada cuando el pago está confirmado.

### 3. Primera generación
- Al pulsar `¡Listo, Esculpir!`, si no existe sesión, aparece el registro/login con Google.
- Después del login se solicitan nombre completo, teléfono, dirección y código postal.
- Una vez completado el perfil, continúa automáticamente la generación.
- En las siguientes generaciones no vuelve a pedir el registro mientras la sesión y el perfil sigan completos.

### 4. Checkout
- `¡Personalizar con Alquimia!` sigue abriendo el modal de compra.
- Al pulsar el botón de Mercado Pago, primero se valida sesión y perfil.
- Se crea un pedido local con diseño, datos del cliente y estado `pending_payment`.
- Luego se deriva a Mercado Pago.

### 5. Pedido, entrega y cancelación
- El perfil contempla:
  - número de seguimiento;
  - entrega en 7 días desde la confirmación del pago;
  - cancelación;
  - reembolso informado de hasta 72 horas hábiles.
- La cancelación queda registrada localmente y está preparada para enviarse al backend.

## Configuración necesaria antes de producción

Abrir `auth.js` y reemplazar:

`GOOGLE_CLIENT_ID`

por el Client ID de Google Identity Services.

También configurar:

`MERCADOPAGO_CHECKOUT_URL`

con la URL/preferencia de Checkout Pro correspondiente.

### Importante

Este proyecto original es un sitio estático. Por seguridad, **no se debe considerar localStorage como autenticación de producción ni como fuente de verdad del pago**.

Para una versión productiva hay que conectar un backend que:
1. verifique el token de Google;
2. cree la preferencia de Mercado Pago;
3. reciba el webhook de Mercado Pago;
4. marque el pedido como `paid` únicamente después de verificar el pago;
5. genere/asigne el número de seguimiento;
6. calcule los 7 días de entrega desde la confirmación;
7. procese la cancelación y el reembolso;
8. proteja los datos personales del usuario.

La interfaz ya queda preparada para ese flujo mediante `API_BASE_URL`.
