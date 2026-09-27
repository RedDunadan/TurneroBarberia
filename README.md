## Arranque local

Desde la raíz del proyecto:

```bash
npm install
npm install --prefix BackEnd
npm run dev
```

Antes de iniciar el backend, configurá credenciales propias. El servidor ya no arranca con credenciales predeterminadas.

En PowerShell:

```powershell
$env:ADMIN_USERNAME = "admin-local"
$env:ADMIN_PASSWORD = "una-contraseña-larga-y-unica"
$env:DB_HOST = "localhost"
$env:DB_NAME = "turnero"
$env:DB_USER = "turnero"
$env:DB_PASSWORD = "tu-clave-local"
```

Antes, iniciá PostgreSQL local con Docker Compose: `docker compose --env-file .env.docker up -d database`. El comando carga los barberos de prueba, inicia la API con recarga automática y sirve el frontend en `http://localhost:5500`. La página pública queda en `http://localhost:5500/` y el panel en `http://localhost:5500/admin.html`. Usá las credenciales definidas en las variables de entorno.

Detené ambos procesos con `Ctrl+C`.

Para desplegar en Firebase Hosting, Cloud Run y Cloud SQL, seguí [DEPLOY_GOOGLE_CLOUD.md](DEPLOY_GOOGLE_CLOUD.md).

## Docker local

Requisitos: Docker Desktop en ejecución.

1. Copiá `.env.docker.example` como `.env.docker` y cambiá las credenciales.
2. Construí y levantá los contenedores:

```bash
docker compose --env-file .env.docker up --build -d
```

Abrí `http://localhost:8080/` para el sitio público y `http://localhost:8080/admin.html` para el panel. La API queda publicada en `http://localhost:3000`.

PostgreSQL se conserva en el volumen `turnero-postgres`. Para detener los contenedores sin borrar los turnos:

```bash
docker compose down
```

`docker compose down -v` también borra la base persistida.

```bash
docker compose down -v
```

## Configuración y build del frontend

El frontend tiene su propio `package.json` y usa módulos JavaScript nativos, sin dependencias externas ni bundler. El build copia los archivos estáticos a `FrontEnd/dist` y configura la URL de la API desde `FRONTEND_API_BASE_URL`; el valor predeterminado `/api` funciona con el rewrite de Firebase Hosting.

Para construirlo:

```bash
npm run build:frontend
```

En Windows PowerShell, para usar otra API durante el build:

```powershell
$env:FRONTEND_API_BASE_URL = "https://api.example.com/api"
npm run build:frontend
```

Para Docker local, Compose construye el frontend con `http://localhost:3000/api`. El desarrollo sirve los archivos fuente directamente con `npm run dev`.

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
- `BackEnd/database.js`: pool PostgreSQL y creación idempotente del esquema.
- `BackEnd/seed-barbers.js`: carga idempotente de barberos de prueba para desarrollo.
- `BackEnd/migrate-sqlite-to-postgres.js`: importador opcional de SQLite a PostgreSQL.

La reserva pública consulta los barberos disponibles según local y día, y envía el `barberId` junto con el turno. La cantidad de turnos de cada barbero se calcula desde la relación entre `bookings` y `barbers`.

La URL base de la API se configura en la etiqueta `meta[name="api-base-url"]` de `Index.html` y `admin.html`. Firebase Hosting usa `/api`; en desarrollo local se usa `http://localhost:3000/api`.

El panel de administración se autentica contra la API mediante una cookie de sesión `HttpOnly`. Las rutas administrativas están bajo `/api/admin/*`; la API pública solo devuelve los datos de barberos necesarios para reservar.

En cualquier entorno, el backend requiere `ADMIN_USERNAME` y una de estas dos opciones:

```text
ADMIN_USERNAME=un-usuario-seguro
ADMIN_PASSWORD=una-contraseña-segura
ADMIN_PASSWORD_HASH=salt:hash
FRONTEND_ORIGIN=https://tu-frontend.example.com
NODE_ENV=production
```

`ADMIN_PASSWORD_HASH` permite usar una contraseña almacenada como hash `salt:hash` generado con `scrypt`; usalo en lugar de `ADMIN_PASSWORD`. Las sesiones se guardan en PostgreSQL y sobreviven a reinicios del backend.

Al crear una reserva se genera un código secreto por turno y se muestra en la confirmación. Guardalo para consultar o cancelar la reserva.

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