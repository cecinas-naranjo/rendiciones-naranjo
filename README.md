# Rendiciones Naranjo

App web instalable (PWA) para el proceso de venta de Cecinas Naranjo: despacho de la mañana,
detalle de pago por folio, retorno, cobranza, proveedores, consumo, gastos y cierre de la rendición diaria.

- **Frontend**: estos archivos, publicados en GitHub Pages.
- **Backend y datos**: `APPS_SCRIPT.js` dentro de la Google Sheet "BD Rendiciones Naranjo".

## Instalación

### 1. Backend (una sola vez)
1. Crea en el Drive de la empresa una Google Sheet llamada **BD Rendiciones Naranjo**.
2. Extensiones → Apps Script → borra todo → pega `APPS_SCRIPT.js` → Guardar.
3. Elige la función `setup` → **Ejecutar** → acepta los permisos. Se crean todas las hojas.
4. Implementar → Nueva implementación → **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. Copia la **URL de la aplicación web** (termina en `/exec`).

### 2. Frontend en GitHub Pages
1. En `config.js` pega esa URL en `APPS_SCRIPT_URL`.
2. Crea un repositorio `rendiciones-naranjo` y sube todos los archivos (menos `APPS_SCRIPT.js` si prefieres).
3. Settings → Pages → Deploy from branch → `main` / root.
4. En 1–2 minutos: `https://TUUSUARIO.github.io/rendiciones-naranjo`

### 3. Instalar en el celular
- **Android (Chrome)**: menú ⋮ → "Instalar app" o "Agregar a pantalla principal".
- **iPhone (Safari)**: compartir → "Agregar a inicio".

## Datos iniciales a revisar en la Sheet
- **USUARIOS**: cambia los PIN de ejemplo. Terminales de Mi DTE pre-asignados según el historial de enero:
  NARANJOT1 → Parada, NARANJOT2 → Aguilera, NARANJOT6 → Vargas, NARANJOT7 → Muñoz, NARANJOT9 → Gutiérrez,
  SUPERMERCADO → Distribuidor. Varios terminales por vendedor: separados por coma.
- **PRODUCTOS**: lista provisoria; reemplazar por la real.

## Actualizar
- Cambios en la app (pantallas): subir los archivos nuevos a GitHub y aumentar la versión en `sw.js` (`CACHE_NAME`).
- Cambios en `APPS_SCRIPT.js`: pegar en Apps Script → Implementar → Administrar implementaciones → editar →
  **Nueva versión**. Así la URL no cambia.
