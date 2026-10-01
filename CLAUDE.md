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
   Además se importa el "Informe de ventas" de Mi DTE (una fila por producto: Codigo, Descripcion, Cantidad, Precio,
   Nombre=tipo doc, Folio, Pago, Equipo=terminal, Fecha, TOTAL, NETO, PRODUCTOS=categoría) → hoja VENTAS_DETALLE.
   Las líneas de guías de despacho se guardan con es_guia=TRUE: la guía emitida desde el terminal de un vendedor es la
   carga que sale con él (hipótesis confirmada con los datos del 22-09-2026) y sirve para precargar la salida en Despacho.
   Kilos: vendido (salida − retorno) vs facturado (VENTAS_DETALLE sin guías, solo productos unidad KG).
   Alerta si |diferencia| > CFG.TOLERANCIA_KG y ya está registrado todo el retorno.
   Códigos de producto: se comparan con codeKey_() ("5.0" == "5"). Códigos "?XXX" = desconocidos, se completan por nombre.
3. Vendedor detalla cada folio: una o más líneas {forma, banco, monto} que deben sumar exactamente el total
   (menos descuento). Formas: EFECTIVO, TRANSFERENCIA, DEP_EFECTIVO, CHEQUE, CREDITO, NOTA_CREDITO.
   Bancos: BICE, ESTADO, SANTANDER, OTRO. Reemplaza el texto libre histórico ("ESTADO Y EF 20000"...).
4. Descuentos: el vendedor los solicita; solo ADMIN/SUPERVISOR los aprueban. Rechazado → folio vuelve a PENDIENTE.
5. Tarde: bodeguero anota retorno en la misma fila de DESPACHO.
6. Cobranza (pagos de créditos anteriores), proveedores, consumo (venta en bodega), gastos.
7. Cierre: genera una Google Sheet en la carpeta "Resumen Rendición/AAAA/MM" con hojas RESUMEN,
   VENTA Y CREDITO y COBRANZA (mismas columnas que la planilla manual histórica), KILOS, PROVEEDORES,
   CONSUMO, GASTOS, DESCUENTOS. Día cerrado = bloqueado; solo ADMIN reabre.
   Botón "Ver cómo quedaría" (vistaPreviaRendicion) genera el mismo archivo como BORRADOR en Resumen Rendición/Borradores
   sin cerrar el día; se reemplaza el borrador anterior de esa fecha. RESUMEN lleva fila TOTAL con fórmulas SUM.
   Efectivo a entregar por vendedor = efectivo de ventas + cobranza en efectivo − gastos.

## Depósitos de efectivo (hoja DEPOSITOS)
Algunos vendedores (ej. Iván Aguilera) depositan/transfieren a la empresa el efectivo antes de rendir. En cada folio igual
marcan EFECTIVO; luego registran el depósito (banco, monto, N° operación) marcando qué folios y cobranzas incluye.
Efectivo a entregar = efectivo ventas + efectivo cobranza − gastos − depósitos. Alerta si el depósito ≠ efectivo incluido.
En el detalle de folio ya no se ofrece DEP_EFECTIVO (FORMAS_APP); se sigue aceptando por compatibilidad.
Bancos: BICE, ESTADO, SANTANDER.

## Fotos y archivos de respaldo
GASTOS, COBRANZA, PROVEEDORES y DEPOSITOS tienen columna `adjuntos` (IDs de Drive separados por coma).
subirAdjunto recibe base64 (el cliente achica fotos a 1600 px JPEG antes de subir; máx. 15 MB).
Drive: Respaldos/<nombre de la persona dueña del registro>/<AAAA-MM>/"<fecha> <Tipo> <detalle> $<monto> - <persona>.ext".
Dueño = responsable (gastos) o vendedor (cobranza/depósitos), no quien sube; GENERAL → "General planta"; proveedores → "Proveedores".
Respaldos se crea junto a la carpeta de rendiciones (o CFG.RESPALDOS_FOLDER_ID). Archivos compartidos "cualquiera con el enlace: ver"
para que se abran desde la app. En el archivo de rendición aparecen como =HYPERLINK(...,"Ver").

## Archivo de rendición
Una hoja por vendedor (cuadratura con fórmulas arriba, casilla amarilla "Efectivo recibido" + diferencia, firmas; luego
KILOS, VENTAS DEL DÍA con transferencias por banco, COBRANZA, GASTOS, DEPÓSITOS), después RESUMEN, PROVEEDORES,
CONSUMO, GASTOS y al final VENTA Y CREDITO y COBRANZA con las columnas exactas del RESUMEN RENDICION histórico
(los folios depositados van como "DEP. EFECTIVO <banco>" en la columna TRANSFERENCIA, como se hacía a mano).
Se arma con la clase Hoja_ (grilla en memoria + lista de operaciones de formato, una sola escritura).
Fuente Calibri como la planilla actual; encabezados gris #D9D9D9.

## Inventario de bodega (hoja INVENTARIO_MOV)
Mismo esquema que la planilla "INVENTARIO <MES>": inicial − salidas (vendedores + destinos + distribuidores) + ingreso fábrica + retornos (+ ajuste por conteo) = final. Cámara: inicial − salida fábrica − salida vendedores + ingreso = final.
- Movimientos: SALDO_INICIAL, INGRESO, SALIDA (destino), CONTEO. Salidas/retornos de vendedores se leen de DESPACHO. `CFG.DESTINO_DE_VENDEDOR` manda DISTRIBUIDOR → SUPERMERCADO y SALA → CONSUMO EXTERNO.
- Secciones en PRODUCTOS.seccion (TERMINADOS, CAMARA, CONGELADOS, LAMINADOS) y nombre de planilla en PRODUCTOS.nombre_inv. `INV_ITEMS` define orden y equivalencias; `prepararProductosInventario_()` (desde setup) completa lo que falte. Productos CAMARA no salen en Despacho.
- `CFG.DESTINOS` (otros destinos) y `CFG.DISTRIBUIDORES` (Patricio, César, Juan Carlos, Amir, Oscar, Chiloé: distribuidores que retiran en bodega, facturados desde el terminal BODEGA = usuario SALA).
- `generarPlanillaInventario` crea la hoja DD-MM en "INVENTARIO <MES> <AÑO>" (carpeta Inventario). El inicial se enlaza con fórmula al final de la hoja del día anterior del mismo archivo (`mapaFinales_`), y si existe un día posterior se re-enlaza (`reenlazarInicial_`). El primer día del mes va como valor. `cargarSaldoDesdePlanilla(id, hoja, fecha)` es la carga única de saldos desde la planilla antigua.

## Saldos de clientes
`getSaldosClientes`: facturas con líneas CREDITO en PAGOS menos pagos de COBRANZA. Pago con folio → esa factura; sin folio o sobrante → facturas más antiguas del cliente (nombre normalizado o RUT); lo que no calza queda como abono sin factura. Pantalla "Saldos clientes" para RENDICION/SUPERVISOR/ADMIN.

## Detalle de folios del vendedor
- `abrirDetalle`: modo rápido. El vendedor toca la forma (Efectivo/Transferencia/Crédito/Cheque); transferencia y cheque piden banco con 3 botones (se recuerda el último banco por usuario). Al tocar, marca el folio al instante y abre el siguiente; el guardado va por detrás en una cola en orden (`encolarGuardado`/`procesarCola`); si falla, el folio vuelve a pendiente con aviso, y `beforeunload` avisa si se cierra con guardados pendientes. Sugiere Crédito si Mi DTE dice crédito.
- Pago mixto, abono o descuento → `abrirDetalleCompleto` (el editor de líneas de siempre). Folios con varias líneas, descuento pendiente o día cerrado abren directo el completo.
- Encargada, supervisión y administración también detallan (Ventas → Detallar ventas, o "Detallar ›" en cada vendedor de la Rendición). PAGOS.registrado_por guarda quién fue; `docsDelDia_` devuelve `detalladoPor` y el chip dice "Detallado por …". En oficina, "Marcar varios" pide elegir vendedor.
- "Detallar varios de una vez" (`marcarVarios` → API `guardarVarios`): lista de pendientes con efectivo/crédito según Mi DTE; tocando la forma se elige efectivo, crédito, transferencia o cheque con banco; se puede excluir cada uno; un solo guardado. Salta folios ya detallados o con descuento pendiente.

## Velocidad y cargas
- Servidor: `MEMO_` (cada hoja se lee una vez por petición; se invalida al escribir), USUARIOS y PRODUCTOS en CacheService 10 min (`onEdit` limpia si se editan a mano; `setup` también), `deleteRows_` borra bloques seguidos de una vez.
- App: consultas (`LECTURA`) guardadas en localStorage (`rn_cache`, 30 entradas): se muestran al instante y se revalidan por detrás; si cambió, `ir(tab, true)` re-dibuja sin animación, salvo que el usuario esté escribiendo (`S.tocado`) o haya una hoja abierta. Cualquier escritura borra la caché. `precargar()` trae las pestañas vecinas. El lector de Excel se descarga solo en Importar (`cargarXLSX`).
- Indicadores: barra superior + aviso abajo (`trabajando()`, mensajes en `MSG`, escalan a los 6 s y 16 s); el botón tocado muestra spinner y "Guardando…".
- Service worker: cache-first con actualización por detrás; aviso "Hay una versión nueva" al instalarse otra.
- Navegación de oficina en 5 grupos (`GRUPOS`) con sub-pestañas; aviso "Estás viendo…" si la fecha no es hoy; Rendición muestra los 4 pasos del día.
- `.enter` usa fill `backwards`: con `both` quedaba un transform en #app y la barra inferior dejaba de estar fija.

## Roles
ADMIN (todo, reabre días), SUPERVISOR (rendición + autoriza descuentos), RENDICION, BODEGA, VENDEDOR
(solo ve sus folios, su cobranza, sus depósitos y sus gastos). BODEGA solo ve Despacho y retorno; Consumo lo registra la encargada de rendición.

## Hojas (nombres exactos, definidos en SCHEMA)
USUARIOS, PRODUCTOS, DESPACHO, DOCUMENTOS, VENTAS_DETALLE, PAGOS, DESCUENTOS, COBRANZA, PROVEEDORES, CONSUMO, GASTOS,
RENDICIONES, SESIONES. Las filas se leen por encabezado; no depender de números de fila guardados en el cliente.

## Pendientes
- Sin modo sin conexión: si se corta internet, lo no guardado se pierde (evaluar cola offline en localStorage).
- Confirmar unidades de Cárnicos (se asumió UN salvo Chuleta vetada en KG).
- Confirmar si SUPERMERCADO (distribuidor) y BODEGA (venta en bodega = consumo) deben rendirse como vendedores.
- Módulo de gastos definitivo.
- Reportes de recaudación y ventas a partir de las rendiciones.
- Hojas por vendedor de la planilla manual (el usuario debe compartirlas).
- Logo: los íconos se hicieron recortando el logo del PDF de precios (baja resolución); reemplazar con el original.

## Diseño
Tipografía Atkinson Hyperlegible Next (legibilidad en celular al aire libre). Colores: café ahumado #2A1F1A,
cobre #C2571A (acción principal), fondo #F2F1EF. Roles de terreno (vendedor, bodega) usan barra inferior; oficina usa
pestañas superiores. Animaciones cortas (≤260 ms) y se desactivan con prefers-reduced-motion.

## Cómo probar
Sin tests automáticos. Probar en el celular real; pedir al usuario que confirme antes de dar algo por resuelto.
Tras cambiar archivos del frontend, subir la versión de `CACHE_NAME` en `sw.js`.
