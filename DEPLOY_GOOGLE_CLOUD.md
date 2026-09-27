# Despliegue en Firebase y Google Cloud

La configuración de [firebase.json](firebase.json) publica `FrontEnd/dist`, compila el frontend con `/api` y reescribe `/api/**` hacia el servicio Cloud Run `turnero-api` en `us-central1`. El backend crea el esquema PostgreSQL al arrancar.

## 1. Preparar herramientas y proyecto

Necesitás Google Cloud CLI, Firebase CLI, una cuenta con permisos de administración y un proyecto con facturación habilitada (plan Blaze). Firebase y Google Cloud deben apuntar al mismo proyecto.

En Windows podés instalar Firebase CLI con `npm install --global firebase-tools`; instalá Google Cloud CLI desde la documentación oficial de Google Cloud.

```powershell
$PROJECT_ID = "TU_PROJECT_ID"
$REGION = "us-central1"

gcloud auth login
gcloud config set project $PROJECT_ID
firebase login
firebase use --add
```

En `firebase use --add`, seleccioná `$PROJECT_ID`. Habilitá los servicios requeridos:

```powershell
gcloud services enable run.googleapis.com sqladmin.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

## 2. Crear Cloud SQL y secretos

En Google Cloud Console:

1. Creá una instancia **Cloud SQL for PostgreSQL 16** llamada `turnero-db` en `us-central1`. Para esta guía, habilitá una IP pública; Cloud Run se conectará mediante la integración segura de Cloud SQL, sin agregar `0.0.0.0/0` a las redes autorizadas. Si la instancia debe ser solo privada, configurá una VPC Connector para Cloud Run. Elegí capacidad, alta disponibilidad y backups según el nivel de servicio y presupuesto esperado.
2. En esa instancia, creá la base `turnero` y el usuario `turnero` con una contraseña segura.
3. En Secret Manager, creá `turnero-db-password` con la contraseña del usuario de PostgreSQL y `turnero-admin-password` con la contraseña del panel.
4. Conservá el usuario administrador que usarás en el panel; se configura como variable de entorno en el siguiente paso.

No incluyas contraseñas en el repositorio ni en los comandos. El despliegue las consume desde Secret Manager.

## 3. Permisos de Cloud Run

Este ejemplo usa la cuenta de servicio predeterminada de Compute Engine. Si tu organización asigna otra cuenta al servicio, reemplazá `$RUNTIME_SA` por esa cuenta en los pasos de IAM y en el despliegue.

La identidad que ejecuta Cloud Build también necesita `Artifact Registry Writer` para subir la imagen. Revisá en **Cloud Build > Settings** cuál cuenta usa el proyecto y otorgale ese rol sobre el repositorio `turnero` si el build no puede publicar la imagen.

```powershell
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$RUNTIME_SA = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$RUNTIME_SA" `
  --role="roles/cloudsql.client"

gcloud secrets add-iam-policy-binding turnero-db-password `
  --member="serviceAccount:$RUNTIME_SA" `
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding turnero-admin-password `
  --member="serviceAccount:$RUNTIME_SA" `
  --role="roles/secretmanager.secretAccessor"
```

## 4. Construir y desplegar la API

Creá el repositorio de imágenes una sola vez, construí el contenedor desde la raíz y obtené el nombre de conexión de Cloud SQL:

```powershell
$REPOSITORY = "turnero"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/turnero-api"
$ADMIN_USERNAME = "TU_USUARIO_ADMIN"

gcloud artifacts repositories create $REPOSITORY `
  --repository-format=docker `
  --location=$REGION `
  --description="Imágenes de Turnero"

gcloud builds submit --tag $IMAGE --file Dockerfile.backend .
$CONNECTION_NAME = gcloud sql instances describe turnero-db --format="value(connectionName)"
```

Desplegá Cloud Run con acceso HTTP público para que Firebase Hosting pueda reenviar las peticiones. Las rutas de administración siguen exigiendo autenticación:

```powershell
gcloud run deploy turnero-api `
  --image $IMAGE `
  --region $REGION `
  --service-account $RUNTIME_SA `
  --allow-unauthenticated `
  --add-cloudsql-instances $CONNECTION_NAME `
  --set-env-vars "NODE_ENV=production,DB_HOST=/cloudsql/$CONNECTION_NAME,DB_NAME=turnero,DB_USER=turnero,FIREBASE_PROJECT_ID=$PROJECT_ID,ADMIN_USERNAME=$ADMIN_USERNAME" `
  --set-secrets "DB_PASSWORD=turnero-db-password:latest,ADMIN_PASSWORD=turnero-admin-password:latest"
```

El contenedor escucha en el puerto `8080`. No configures `DATABASE_PATH`: los datos viven en Cloud SQL, no en el disco efímero de Cloud Run.

## 5. Publicar Firebase Hosting

**Si vas a conservar SQLite, completá primero el paso 6 y verificá los datos importados antes de publicar Hosting.** Así evitás recibir reservas nuevas en una base que todavía no contiene los datos anteriores.

Desde la raíz del repositorio:

```powershell
firebase deploy --only hosting
```

El hook de `firebase.json` genera los archivos antes de subirlos. Probá:

- `https://TU_PROJECT_ID.web.app/`
- `https://TU_PROJECT_ID.web.app/admin.html`
- `https://TU_PROJECT_ID.web.app/api/health`

Iniciá sesión en el panel y comprobá crear un barbero, hacer una reserva, cancelarla y revisar las reservas pendientes. Al estar frontend y API bajo el mismo dominio, las cookies de sesión y las llamadas a `/api` no requieren CORS para el navegador.

Si agregás un dominio personalizado de Firebase Hosting, configurá `FRONTEND_ORIGIN` en Cloud Run con su origen `https://...` y redesplegá la API.

## 6. Importar una base SQLite existente (si querés conservar esos datos)

Este workspace ya contiene `BackEnd/turnero.db` y archivos WAL/SHM. Si corresponde a los datos que querés conservar, detené cualquier proceso que escriba en esa base, instalá las dependencias de desarrollo y generá una copia SQLite consistente:

```powershell
npm install --prefix BackEnd
Set-Location BackEnd
node --input-type=module -e "import Database from 'better-sqlite3'; const source = new Database('turnero.db', { readonly: true }); await source.backup('turnero.db.backup'); source.close();"
Set-Location ..
```

No borres el archivo original ni el volumen Docker antiguo hasta verificar la migración. El importador copia barberos y turnos preservando sus IDs; las sesiones de administrador no se migran y deberás volver a iniciar sesión. Importá a una base PostgreSQL vacía antes de empezar a crear reservas o barberos allí.

Si SQLite está en un volumen Docker antiguo en vez de ese archivo local, localizá el nombre con `docker volume ls` y copiá el archivo a `BackEnd/turnero.db` (reemplazá `NOMBRE_DEL_VOLUMEN` por el nombre real):

```powershell
docker run --rm `
  --mount "source=NOMBRE_DEL_VOLUMEN,target=/data,readonly" `
  --mount "type=bind,source=$($PWD.Path),target=/backup" `
  alpine `
  cp /data/turnero.db /backup/turnero.db
```

Instalá las dependencias de desarrollo y ejecutá Cloud SQL Auth Proxy en una terminal aparte:

```powershell
npm install --prefix BackEnd
cloud-sql-proxy "$PROJECT_ID`:$REGION`:turnero-db" --port 5432
```

En otra terminal PowerShell configurá `DB_HOST=localhost`, `DB_PORT=5432`, `DB_NAME=turnero`, `DB_USER=turnero` y `DB_PASSWORD` con la contraseña de Cloud SQL. Luego ejecutá:

```powershell
node BackEnd/migrate-sqlite-to-postgres.js BackEnd/turnero.db
```

Para el archivo local respaldado en el primer paso, usá `BackEnd/turnero.db.backup` como argumento.

Si la base SQLite está dentro del volumen Docker, primero exportá una copia del archivo desde ese volumen. No ejecutes `docker compose down -v` antes de conservarla.

## Despliegues posteriores

Para publicar cambios de API, repetí el build y el deploy de Cloud Run:

```powershell
gcloud builds submit --tag $IMAGE --file Dockerfile.backend .
gcloud run deploy turnero-api --image $IMAGE --region $REGION
```

Para cambios del frontend:

```powershell
firebase deploy --only hosting
```
