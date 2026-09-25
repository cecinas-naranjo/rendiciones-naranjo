# Cecinas Naranjo — Rendiciones

App interna para el proceso de venta diario de una fábrica de cecinas (Cecinas Naranjo, Chile).
La usan en el celular el bodeguero, los vendedores de ruta, la encargada de rendición y la administración.
Cualquier bug se nota en producción. Idioma de la interfaz: español de Chile. Montos en CLP sin decimales.

## Arquitectura
- PWA estática, vanilla JS, sin build: `index.html`, `style.css`, `app.js`, `config.js`, `sw.js`, `manifest.json`.
  Publicada en GitHub Pages.
- **Todo** acceso a datos pasa por Apps Script (`APPS_SCRIPT.js`), desplegado como Web App vinculado a la
  Google Sheet "BD Rendiciones Naranjo". El navegador nunca lee ni escribe la Sheet directo. Esto es deliberado
  (lección de la app de flota LST): una sola vía de escritura, permisos validados en el servidor, sin OAuth.
- Llamada: `POST APPS_SCRIPT_URL` con cuerpo `{"fn": "...", "args": [...]}` como `text/plain` (sin preflight CORS).
  Respuesta `{ok, data}` o `{ok:false, error}`. Solo se aceptan funciones listadas en el objeto `API`.
  **Al agregar una función nueva al backend, agregarla también a `API`.**
- `APPS_SCRIPT.js` NO se autodespliega: tras editarlo hay que pegarlo en Apps Script e implementar
  **Nueva versión** en la implementación existente (así la URL no cambia).
- Login: usuario + PIN (hoja USUARIOS). Token guardado en hoja SESIONES, válido 30 días (no pedir login cada hora).
  Errores de sesión empiezan con `SESION:` y el cliente vuelve al login.

## Proceso de negocio
1. Mañana: bodeguero registra por vendedor la salida (kg o unidades) por producto → hoja DESPACHO.
2. Encargada importa el Excel "Ventas Diarias" de Mi DTE (columnas RUT, Documento, Folio, Fecha, Total,
   Condicion, Nombre Cliente, Emitido en). El vendedor se deduce del terminal "Emitido en" (columna
   `terminales` de USUARIOS). Guías de despacho se omiten (son internas). Clave única: `folio_key` = tipo+folio.
3. Vendedor detalla cada folio: una o más líneas {forma, banco, monto} que deben sumar exactamente el total
   (menos descuento). Formas: EFECTIVO, TRANSFERENCIA, DEP_EFECTIVO, CHEQUE, CREDITO, NOTA_CREDITO.
   Bancos: BICE, ESTADO, SANTANDER, OTRO. Reemplaza el texto libre histórico ("ESTADO Y EF 20000"...).
4. Descuentos: el vendedor los solicita; solo ADMIN/SUPERVISOR los aprueban. Rechazado → folio vuelve a PENDIENTE.
5. Tarde: bodeguero anota retorno en la misma fila de DESPACHO.
6. Cobranza (pagos de créditos anteriores), proveedores, consumo (venta en bodega), gastos.
7. Cierre: genera una Google Sheet en la carpeta "Resumen Rendición/AAAA/MM" con hojas RESUMEN,
   VENTA Y CREDITO y COBRANZA (mismas columnas que la planilla manual histórica), KILOS, PROVEEDORES,
   CONSUMO, GASTOS, DESCUENTOS. Día cerrado = bloqueado; solo ADMIN reabre.
   Efectivo a entregar por vendedor = efectivo de ventas + cobranza en efectivo − gastos.

## Roles
ADMIN (todo, reabre días), SUPERVISOR (rendición + autoriza descuentos), RENDICION, BODEGA, VENDEDOR
(solo ve sus folios, su cobranza y sus gastos).

## Hojas (nombres exactos, definidos en SCHEMA)
USUARIOS, PRODUCTOS, DESPACHO, DOCUMENTOS, PAGOS, DESCUENTOS, COBRANZA, PROVEEDORES, CONSUMO, GASTOS,
RENDICIONES, SESIONES. Las filas se leen por encabezado; no depender de números de fila guardados en el cliente.

## Pendientes
- Lista real de productos (la actual es provisoria).
- Módulo de gastos definitivo.
- Reportes de recaudación y ventas a partir de las rendiciones.
- Hojas por vendedor de la planilla manual (el usuario debe compartirlas).
- Cruce kilos vendidos vs kilos facturados: requiere export de Mi DTE con detalle por producto.
- Logo real (los íconos actuales son provisorios: "N" naranja sobre café).

## Cómo probar
Sin tests automáticos. Probar en el celular real; pedir al usuario que confirme antes de dar algo por resuelto.
Tras cambiar archivos del frontend, subir la versión de `CACHE_NAME` en `sw.js`.
