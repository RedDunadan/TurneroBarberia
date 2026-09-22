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