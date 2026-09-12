# Monefy PWA — Finanzas Personales Offline-First

Aplicación web progresiva (PWA) moderna para el control de gastos e ingresos, con diseño inspirado en Monefy, funcionamiento **100% offline**, almacenamiento local seguro en **IndexedDB**, sincronización bidireccional mediante **Google Apps Script** y persistencia central en **Google Sheets y Google Drive**.

---

## 🌟 Principios Fundamentales y Arquitectura

1. **Integridad de Datos**: Identificadores universales únicos (UUID v4) en todas las entidades.
2. **Offline Real**: La aplicación guarda y lee directamente de IndexedDB en el navegador o móvil. Nunca bloquea una acción por falta de Internet.
3. **Cola de Sincronización (`sync_queue`)**: Todas las altas, modificaciones y bajas se encolan con marcas de tiempo y reintentos.
4. **Borrado Seguro (Tombstones)**: Las eliminaciones marcan `isDeleted = true`. Nunca se borran físicamente filas de Google Sheets.
5. **Neutralidad de Transferencias**: Las transferencias entre cuentas recalculan los saldos de cada cuenta sin contar como gasto ni como ingreso.
6. **Saldos Dinámicos**: El saldo de una cuenta se calcula como:
   $$\text{Saldo} = \text{Saldo Inicial} + \text{Ingresos} - \text{Gastos} + \text{Transferencias Entrantes} - \text{Transferencias Salientes}$$
7. **Sin Servidores Propios ni Dependencias Propietarias**: Sin Firebase, sin Firestore, sin Supabase. El usuario es el dueño absoluto de sus datos.

---

## 📂 Estructura del Backend en Google Apps Script (`/apps-script`)

La carpeta `apps-script/` contiene los archivos listos para copiar y pegar en un proyecto de Google Apps Script:

- **`Config.gs`**: Nombres de hojas, versión y constantes.
- **`Validation.gs`**: Validación estricta de estructura y firmas de peticiones.
- **`Database.gs`**: Operaciones no destructivas (`upsertRecord`, `softDeleteRecord`, creación de encabezados de hojas).
- **`Drive.gs`**: Creación de carpetas y subida de imágenes de recibos/tickets.
- **`Sync.gs`**: Procesamiento de lotes de operaciones y obtención de deltas remotos.
- **`Code.gs`**: Puntos de entrada `doGet` y `doPost` con respuestas JSON estructuradas.

---

## 🚀 Guía de Instalación del Backend (Para Usuarios No Programadores)

### Paso 1: Abrir Google Drive
1. Ve a [Google Drive](https://drive.google.com).
2. Haz clic en **Nuevo** → **Más** → **Google Apps Script**. (Si no te aparece, pulsa en "Conectar más aplicaciones" y busca "Google Apps Script").

### Paso 2: Copiar el Código del Backend
En el editor de Google Apps Script:
1. Renombra el proyecto a **Monefy Backend**.
2. En el archivo `Código.gs`, sustituye todo su contenido por el archivo `apps-script/Code.gs`.
3. Crea un nuevo archivo de script (icono `+` → *Script*):
   - `Config.gs`: Copia el contenido de `apps-script/Config.gs`.
   - `Validation.gs`: Copia el contenido de `apps-script/Validation.gs`.
   - `Database.gs`: Copia el contenido de `apps-script/Database.gs`.
   - `Drive.gs`: Copia el contenido de `apps-script/Drive.gs`.
   - `Sync.gs`: Copia el contenido de `apps-script/Sync.gs`.
4. Pulsa en el icono de **Guardar proyecto** (disco).

### Paso 3: Desplegar como Aplicación Web
1. Arriba a la derecha, haz clic en **Implementar** (o *Desplegar*) → **Nueva implementación**.
2. Haz clic en el engranaje ⚙️ junto a "Seleccionar tipo" y elige **Aplicación web**.
3. Rellena los siguientes campos:
   - **Descripción**: Monefy API v1.
   - **Ejecutar como**: **Yo (tu cuenta de Google)**.
   - **Quién tiene acceso**: **Cualquiera** (permite que tu app móvil se comunique directamente).
4. Haz clic en **Implementar**.
5. Autoriza los permisos solicitados por Google.
6. Copia la **URL de la aplicación web** (tiene el formato `https://script.google.com/macros/s/.../exec`).

### Paso 4: Enlazar en Monefy PWA
1. Abre tu aplicación Monefy PWA.
2. Ve a la pestaña **Ajustes**.
3. Pega la URL en el campo **URL del Despliegue Web App de Apps Script**.
4. Haz clic en **Probar Conexión**.
5. Haz clic en **Inicializar Hojas (Sheets)** para que Apps Script cree automáticamente la hoja de cálculo y todas sus tablas con encabezados congelados.

---

## 📱 Instalación de la PWA en Android
1. Abre la aplicación en Google Chrome en tu teléfono Android.
2. Pulsa el botón **Instalar App** que aparece en la cabecera, o toca el menú de Chrome (tres puntos verticales) y selecciona **Instalar aplicación** / **Añadir a pantalla de inicio**.
3. La aplicación se instalará como una app nativa en tu móvil, accesible con o sin conexión.

---

## 🧪 Batería de Pruebas Obligatorias (20 Casos)
Ve a **Ajustes** → **Batería de Pruebas** para ejecutar los 20 tests obligatorios del sistema, que comprueban:
- Creación y persistencia offline en IndexedDB.
- Cálculo matemático dinámico de saldos.
- Neutralidad de transferencias.
- Detección y resolución de conflictos.
- Detección de duplicados en extractos bancarios de ING, ABANCA y Revolut.
- Backups y restauración limpia sin fugas de credenciales.
- Borrado lógico tombstone (`isDeleted = true`).
