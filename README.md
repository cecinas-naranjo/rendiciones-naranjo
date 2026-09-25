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
- **PRODUCTOS**: lista de precios 2026. Los códigos que empiezan con `?` se completan solos cuando el producto aparece
  por primera vez en un Informe de ventas. Productos desconocidos del informe se agregan como inactivos con categoría REVISAR.
- **Terminales**: se asignan desde la app (Importar Mi DTE → Terminales). Ej.: NARANJOT10 apareció en septiembre sin vendedor.

## Flujo diario
1. **Bodega (mañana)**: Despacho → elige vendedor → anota la salida, o toca "Cargar salida desde guía N°" si la guía ya se importó.
2. **Encargada**: Importar Mi DTE → sube *Ventas Diarias* y el *Informe de ventas* (juntos o por separado).
3. **Vendedor**: Mis folios → detalla cómo le pagaron cada folio. Registra cobranza y gastos.
4. **Bodega (tarde)**: misma pantalla → anota el retorno. Se ve al tiro vendido vs facturado y la diferencia.
5. **Administración**: autoriza descuentos.
6. **Encargada**: Rendición → revisa alertas → Cerrar y generar archivo.

## Actualizar
- Cambios en la app (pantallas): subir los archivos nuevos a GitHub y aumentar la versión en `sw.js` (`CACHE_NAME`).
- Cambios en `APPS_SCRIPT.js`: pegar el archivo completo, **ejecutar `setup` otra vez** (actualiza las hojas sin borrar datos) y luego en Apps Script → Implementar → Administrar implementaciones → editar →
  **Nueva versión**. Así la URL no cambia.
