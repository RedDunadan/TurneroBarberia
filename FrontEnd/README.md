# FrontEnd

## Páginas

- `Index.html`: sitio público y flujo de reserva.
- `admin.html`: acceso privado y panel de administración.
- `pages/`: entrypoints JavaScript específicos de cada página.

## Componentes

- `components/`: piezas visuales reutilizables.
- `components/admin/`: login y shell del panel privado.
- `components/barbers/`: formulario, listado y coordinación de barberos.

## Datos

- `data/api-config.js`: URL base configurable de la API para todos los clientes HTTP.
- `data/barber-config.js`: días, locales y valores predeterminados.
- `data/barber-api.js`: cliente HTTP para administrar barberos.
- `data/admin-auth.js`: sesión del administrador.
- `data/booking-api.js`: cliente HTTP para registrar turnos.
- `data/barber-api.js`: cliente HTTP para consultar y administrar barberos.

## Backend

- `BackEnd/server.js`: API HTTP y validación de turnos.
- `BackEnd/turnero.db`: base SQLite creada al iniciar el servidor.
- `BackEnd/seed-barbers.js`: carga idempotente de tres barberos de prueba.

La reserva pública consulta los barberos disponibles según local y día, y envía el `barberId` junto con el turno. La cantidad de turnos de cada barbero se calcula desde la relación entre `bookings` y `barbers`.

La URL base de la API se configura en la etiqueta `meta[name="api-base-url"]` de `Index.html` y `admin.html`. El valor predeterminado para desarrollo es `http://localhost:3000/api`; para otro entorno, reemplazalo por la URL pública de la API en ambos archivos.

El panel de administración se autentica contra la API mediante una cookie de sesión `HttpOnly`. Las rutas administrativas están bajo `/api/admin/*`; la API pública solo devuelve los datos de barberos necesarios para reservar.

Para desarrollo, el backend usa `admin` / `admin` si no se configuran variables de entorno. En un entorno real, definí al menos:

```text
ADMIN_USERNAME=un-usuario-seguro
ADMIN_PASSWORD=una-contraseña-segura
FRONTEND_ORIGIN=https://tu-frontend.example.com
NODE_ENV=production
```

`ADMIN_PASSWORD_HASH` también permite usar una contraseña almacenada como hash `salt:hash` generado con `scrypt`. Las sesiones actuales viven en memoria y se invalidan al reiniciar el servidor; para producción con varias instancias conviene usar un almacén compartido de sesiones.

Para cargar los datos de prueba:

```bash
cd BackEnd
npm run seed:barbers
```

## Estilos

- `styles.css`: estilos globales y sitio público.
- `styles/barbers.css`: estilos del módulo de barberos.
- `styles/admin.css`: estilos del login y panel privado.

Los módulos de cada página se cargan desde su propio entrypoint para que una pantalla no dependa de funcionalidades que no utiliza.