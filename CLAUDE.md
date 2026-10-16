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
- Login: RUT o correo + clave personal (ver sección Acceso y claves). Token guardado en hoja SESIONES, válido 30 días (no pedir login cada hora).
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

## Cheques
- Al elegir cheque (detalle rápido, detallar varios, detalle completo y Cobranza) se piden: banco emisor (`BANCOS_CHEQUE`, bancos chilenos + Otro), N° de cheque y fecha del cheque, es decir desde cuándo se puede cobrar, no cuándo se cobra (obligatorios) y titular/RUT (opcional). Helpers en app: `camposCheque`, `leerCheque`, `avisoTipoCheque` (al día / a fecha).
- Servidor: `datosCheque_` valida; columnas `cheque_numero`, `cheque_fecha`, `cheque_titular` en PAGOS y COBRANZA (el banco del cheque va en `banco`; referencia = "Cheque N° …"). El archivo de rendición agrega por vendedor la tabla CHEQUES RECIBIDOS (ventas y cobranza, al día / a fecha).

## Kilos con 2 decimales y diferencia en plata
- `kilosDe_` (servidor) calcula por vendedor y producto: salida − retorno − facturado, a 2 decimales. `preciosKg_`: precio por kilo del día = total facturado / kilos facturados (VENTAS_DETALLE, sin guías); si no hubo ventas de ese producto, el precio de PRODUCTOS. `diferenciaPesos` > 0 = salió y no volvió ni se facturó → se descuenta de la liquidación del vendedor; < 0 = a favor.
- Se muestra en la tarjeta del vendedor, en el detalle (`abrirVendedor`, con el cálculo por producto), en la inspección impresa (bloque informativo, no entra al Total) y en el archivo de rendición (hoja del vendedor KILOS con PRECIO KG y DIFERENCIA $, y columna DIF. KILOS $ en RESUMEN).

## Efectivo del día (conteo y depósito)
- Pestaña "Efectivo" en Rendición. Por vendedor: cantidad de billetes de $20.000/$10.000/$5.000/$2.000/$1.000 y monedas (un solo total). Esperado = efectivo a entregar (ventas + cobranza − gastos − depositado). Muestra "Cuadra / Falta / Sobra".
- Resumen del día: billetes contados (con el desglose), monedas (NO se depositan), diferencia, caja chica (opcional, con motivo) y **Efectivo a depositar = billetes − caja chica**.
- Hoja CONTEO_EFECTIVO (`key = fecha|vendedor`; fila `GENERAL` guarda la caja chica). API `getConteoEfectivo` (lectura) y `guardarConteoEfectivo`. El archivo de rendición agrega la hoja "EFECTIVO A DEPOSITAR" si hay conteo.

## Devoluciones (mermas y reprocesos)
- Producto que vuelve a la bodega y no se puede vender: **MERMA** (se descarta) o **REPROCESO** (vuelve a producción). Se justifica con una **nota de crédito**: el **N° y el monto son obligatorios**; la foto de la NC es opcional (columna `monto` en DEVOLUCIONES; el archivo de rendición trae MONTO NC).
- Hoja DEVOLUCIONES (`id, fecha, tipo, origen, cliente, codigo, producto, unidad, cantidad, nota_credito, motivo, obs, registrado_por, registrado, adjuntos`). API `listarDevoluciones` (lectura), `guardarDevolucion`, `borrarDevolucion`; roles BODEGA, RENDICION, SUPERVISOR, ADMIN. Pantalla `vDevoluciones` (pestaña "Devoluciones" en Bodega); `origen` = vendedor de la ruta o '' (cliente/otro).
- Fotos: tabla de adjuntos `DEVOLUCIONES` (Drive: Respaldos/Devoluciones/<AAAA-MM>/"<fecha> Devolución <tipo> NC <n> <producto> <cantidad>"). BODEGA ya puede subir adjuntos.
- Archivo de rendición: hoja DEVOLUCIONES (solo si hubo). El resumen cuenta `totales.devoluciones`.
- NO toca el inventario (la merma/reproceso ya sale como destino MERMA/REPROCESO en INVENTARIO_MOV); evita doble descuento. Pendiente: cruzar con inventario si se quiere.

## Inspección por vendedor (Rendición)
- API `getInspeccion(token, fecha, vendedor)` (vendedor '' = todos con movimiento): totales con las mismas cuentas que la hoja del vendedor, transferencias por banco (ventas + cobranza), cheques, cobranza, gastos, depósitos, créditos y folios con sus pagos.
- En Rendición, cada tarjeta de vendedor se puede tocar (hover + "Ver detalle ›") y abre `abrirVendedor`: efectivo a entregar, resumen, folios (por detallar / detallados / todos, con forma de pago y quién detalló) y el detalle por sección.
- `imprimirInspeccion(usuario|'')`: arma `#imprimir` y llama a `window.print()`; CSS `@media print` oculta la app. Una hoja por vendedor (sigue en otra página si hay muchos movimientos), poca tinta, cuadrado gris a la derecha de cada línea, firmas de vendedor y encargada.
  - **RESUMEN** (por forma de pago): Efectivo total (ventas + cobranza) → (−) Gastos → (−) Depositado (si hay) → **Efectivo a entregar** → Depósitos de efectivo (si hay) → Transferencias BICE/ESTADO/SANTANDER → Cheques → **Subtotal** → Crédito → **Total rendición**.
  - **DETALLE** (por origen): Venta en efectivo (lista de cada folio pagado en efectivo: cliente, RUT, documento, monto), transferencias de cada banco con cliente, RUT, documento y tipo (Venta / **COBRANZA**), cheques (N°, banco, fecha, al día/a fecha), Cobranza (todas las formas de pago, con desglose efectivo/transferencia/cheque), Depósitos de efectivo (si hay), suma de gastos, Crédito (lista de cada documento a crédito), y la composición del **Total detalle**.
  - **Invariante: Total rendición = Total detalle** (efectivo de ventas + efectivo de cobranza − gastos + transferencias + cheques + crédito). La cobranza aparece dos veces (en su banco y en Cobranza) pero al total solo entra su efectivo. Los gastos van dentro del efectivo, por eso se restan en ambos. Los depósitos de efectivo no cambian el total: bajan "Efectivo a entregar" y suben "Depósitos de efectivo".
  - Servidor: `getInspeccion` marca cada transferencia/cheque con `tipo` ('Venta' | 'COBRANZA') y cada cheque con `momento` ('Al día' | 'A fecha'); `docsEfectivo` cuenta los folios pagados en efectivo.
- RUT del cliente en el archivo de rendición: hoja del vendedor (ventas, cobranza, cheques) y como última columna en VENTA Y CREDITO y COBRANZA.

## Velocidad y cargas
**Servidor (APPS_SCRIPT.js)**
- `MEMO_`: cada hoja se lee una sola vez por petición. USUARIOS y PRODUCTOS además en CacheService (10 min).
- **Caché por día** (`byFecha_`, `cargarDia_`, `POR_DIA_`): las tablas con movimientos (DOCUMENTOS, PAGOS, DESCUENTOS, DESPACHO, COBRANZA, GASTOS, DEPOSITOS, PROVEEDORES, CONSUMO, VENTAS_DETALLE) se guardan por día en CacheService con clave `d|TABLA|versión|fecha` (5 min). Cada tabla tiene una versión (`v_TABLA`); toda escritura (`append_`/`updateRow_`/`deleteRows_` → `tocar_`) la cambia al final de la petición (`cerrarPeticion_`: flush + nueva versión), así la caché vieja deja de usarse. `onEdit` la cambia si alguien edita la hoja a mano; `invalidarTodo_()` en `setup` y cargas del editor.
- **Regla de seguridad**: solo las acciones de `LECTURAS_` (consultas) usan la caché por día; toda acción que escribe (`FRESCO_`) y todo lo que va dentro de `withLock_` lee siempre la planilla, para que los `_row` de las escrituras nunca vengan de la caché. Borrar filas a mano en la planilla puede tardar hasta 5 min en verse en las pantallas (editar celdas se ve al tiro por `onEdit`).
- `conCache_(clave, tablas, fn)`: resultado de consultas caras (Saldos de clientes, Inventario) ligado a las versiones de sus tablas.
- `batch([[fn,args],…])`: varias consultas en una sola petición (solo lecturas); comparten lecturas. `login(usuario, pin, fecha)` devuelve además `lote` = catálogo + datos de la primera pantalla según el rol.
- `guardarDetalle(..., minimo)`: con `minimo` responde corto y no relee el día. `deleteRows_` borra bloques seguidos de una vez.

**App (app.js)**
- Consultas (`LECTURA`) en localStorage (`rn_cache`): se muestran al instante; se piden de nuevo solo si tienen más de 20 s (`FRESCURA`) o fueron marcadas `viejo` tras un guardado (`olvidarCache(false)` ya no borra, marca). Si lo nuevo es distinto, `ir(tab, true)` re-dibuja sin animación, salvo que el usuario esté escribiendo (`S.tocado`) o haya una hoja abierta.
- `pedirLote` + `precargar`: la precarga de las pestañas vecinas (las de la misma sección y la primera de cada otra sección) es UNA sola llamada `batch`. El login siembra la caché con `lote`, así la primera pantalla sale con una sola llamada.
- Detalle rápido de folios: se marca al instante y se guarda por detrás en cola (`encolarGuardado`), con respuesta mínima.
- Indicadores: barra superior + aviso abajo (`trabajando()`, `MSG`), botón con spinner. Lector de Excel solo al importar. Service worker: cache-first con actualización por detrás; aviso "Hay una versión nueva".
- Compatibilidad: un cliente nuevo con servidor viejo funciona (cae a llamadas sueltas); uno viejo con servidor nuevo también.
- Medido en simulación (400 ms por llamada): primera pantalla 1.350 → 860 ms; llamadas al ingresar 4–6 → 2; cambio de sección/pestaña ~440 ms → ~40 ms.

## Roles
ADMIN (todo, reabre días), SUPERVISOR (rendición + autoriza descuentos), RENDICION, BODEGA, VENDEDOR
(solo ve sus folios, su cobranza, sus depósitos y sus gastos). BODEGA solo ve Despacho y retorno; Consumo lo registra la encargada de rendición.

## Hojas (nombres exactos, definidos en SCHEMA)
USUARIOS, PRODUCTOS, DESPACHO, DOCUMENTOS, VENTAS_DETALLE, PAGOS, DESCUENTOS, COBRANZA, PROVEEDORES, CONSUMO, GASTOS,
RENDICIONES, SESIONES. Las filas se leen por encabezado; no depender de números de fila guardados en el cliente.

## Pendientes
- Fotos/archivos sin conexión: no se encolan (el registro sí); se adjuntan después con "Adjuntar".
- Decidir si los 8 documentos "NO" con fecha de pago y los 5 PRÉSTAMO de la planilla de control cuentan como pagados (hoy quedan como crédito abierto).
- Cheque protestado de la app (venta/cobranza): solo se marca; no vuelve a sumar deuda (sí en los de la planilla de control).
- Ajuste de kilos/hojas por vendedor de la planilla manual, etc. (ver abajo).
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

## Impresión: reglas que no hay que romper
- `th,td{white-space:nowrap}` es global para las tablas de la app; en `.ins` se anula (`white-space:normal`) para que los nombres largos salten de línea. RUT y montos van en `nowrap`.
- Al imprimir `html,body` quedan sin altura fija ni scroll; los modales usan `overflow-x:hidden` y `::-webkit-scrollbar-corner` transparente (evita el cuadrado gris de las barras de desplazamiento en Windows).
- El modal del vendedor muestra el RUT bajo/junto al cliente en folios, transferencias, cheques y cobranza.

## Clientes por RUT, lista de créditos y cobranza
- **El RUT une todo; el nombre que vale es el del DTE.** Hoja CLIENTES (`rut, razon_social, condicion, vendedor, alias, actualizado`): `importarDTE` llama a `actualizarClientes_` y deja la razón social más reciente de cada RUT. Los nombres que usa la planilla de control quedan como `alias` (separados por `|`).
- **Lista de créditos** (planilla "CONTROL CREDITO VENDEDORES", hoja CREDITOS): se sube en Importar Mi DTE (`leerCreditos` en el cliente: solo filas con ¿PAGÓ? distinto de SI → ~620). `cargarCreditos` guarda en CREDITOS_CARGA (`folio_key` = tipo+folio; si el folio no es un número —"P", "182-183"— la clave incluye al cliente). Estado `CREDITO` o `CHEQUE` (cheque en cartera, sigue siendo crédito hasta cobrarse). "PRÉSTAMO"/"PENDIENTE" quedan en `obs`. Recargar actualiza por clave y no duplica.
- **RUT de cada crédito** (`resolverRut_`): 1) por folio en DOCUMENTOS (por eso conviene importar antes las Ventas Diarias históricas del DTE), 2) por nombre vía razón social/alias. Lo que no se resuelve queda "sin RUT" y se completa a mano (`vincularRut`, pantalla `abrirSinRut`, también desde Saldos); el vínculo queda como alias y se aplica a todos sus documentos. `reintentarRut` vuelve a buscar.
- `saldosClientes_` junta los créditos de la app (PAGOS CREDITO) y los cargados (los que ya están en la app no se duplican), agrupa por RUT con la razón social del DTE y aplica los pagos de COBRANZA (por `folio_key`, si no por folio/nombre/alias).
- **Cobranza**: COBRANZA ahora tiene `rut` y `folio_key`. Pantalla "Cobrar a un cliente" (`cobrarDesdeLista`, API `porCobrar`, el vendedor ve solo sus facturas): buscar por nombre/RUT, marcar facturas, monto editable (abonos), forma de pago (efectivo / transferencia con banco / cheque con sus datos) y `guardarCobro` (una fila de COBRANZA por factura). El registro manual sigue abajo.
- **Planilla por cobrar** (`generarPlanillaPorCobrar`, botón en Saldos clientes): Google Sheet "Por cobrar DD-MM-AAAA" en `Cuentas por cobrar/` con POR CLIENTE, DETALLE y CHEQUES EN CARTERA (cheques de la planilla + los recibidos en la app los últimos 60 días).
- Cheques: ver sección Cheques en cartera.

## Importar Mi DTE (reglas)
- `cargarXLSX()` baja el lector de Excel (cdnjs, XLSX 0.18.5) la primera vez; si falla, mensaje claro y reintenta.
- Son obligatorios los DOS informes: Ventas Diarias (tipo 'dte') e Informe de ventas (tipo 'detalle', kilos), de las mismas fechas. Sin ambos no aparece el botón Importar. Control de crédito se puede subir solo.
- Se puede subir varias veces el mismo día: solo se agregan folios nuevos (clave `folio_key`); lo existente y lo ya detallado no se toca. Se informa por vendedor cuántos documentos nuevos entraron.
- Las llamadas van en tandas (1200 documentos / 2000 líneas) para evitar timeouts.

## Política de crédito (montos NETOS, sin IVA) y folio en Cobranza
- 7 días: $15.000–$60.000 · 14 días: $60.001–$120.000 · 21 días: $120.001–$300.000 · 28 días: más de $300.000. Constante `POLITICA` en app.js; neto = total/1,19. Se muestra en Saldos y en Cobranza (y el plazo por factura en "Cobrar a un cliente").
- El folio es OBLIGATORIO en todo pago de Cobranza (app y `guardarMov`). Ya no se ofrece descontar de la factura más antigua; solo los registros viejos sin folio conservan ese cálculo.

## Cheques en cartera (pestaña Cheques, RENDICION/SUPERVISOR/ADMIN)
- Un cheque es crédito hasta que se cobra. `chequesTodos_()` junta los cheques de PAGOS (clave `V|id`), COBRANZA (`C|id`) y CREDITOS_CARGA estado CHEQUE (`P|folio_key`). Su estado vive en la hoja CHEQUES_ESTADO (`clave, estado, fecha, registrado_por, registrado, obs`): sin fila = CARTERA; COBRADO; PROTESTADO.
- API `listarCheques` (lectura; cobrados solo los últimos 45 días) y `marcarCheque(token, claves[], estado, fecha, obs)` (estado CARTERA devuelve a la cartera).
- Efecto en saldos: un cheque de la planilla de control marcado COBRADO deja de ser deuda; PROTESTADO vuelve a ser crédito normal. La planilla por cobrar usa solo los cheques en CARTERA.
- Pantalla `vCheques`: KPIs (en cartera, cobrables hoy, a fecha próximos 7 días), filtros (para cobrar hoy / a fecha / toda la cartera / cobrados / protestados), buscador y selección múltiple con fecha de cobro.

## Acceso y claves (hoja USUARIOS)
- Columnas nuevas: `rut, correo, clave_hash, sal, cambiar_clave, intentos, bloqueado_hasta`. La clave se guarda con sal y SHA-256 repetido 1000 veces; nunca en texto. La columna `pin` queda vacía.
- Se entra con RUT o correo (también acepta el código interno) + clave. No hay lista de usuarios en el login (`listaUsuarios` ya no existe). El rol lo asigna solo ADMIN; la persona no lo elige.
- Clave temporal (usuario nuevo o restablecida): `login` devuelve `{cambiarClave:true}` y la app pide crear la clave personal (`cambiarClaveInicial`, mínimo 6 caracteres, rechaza claves triviales). Restablecer o desactivar cierra todas sus sesiones (`cerrarSesionesDe_`). "Clave" en la cabecera → `cambiarMiClave`.
- 5 intentos fallidos bloquean la cuenta 15 minutos; además hay un tope por identificador en CacheService.
- Pantalla Usuarios (solo ADMIN): crear/editar (nombre, rol, RUT con dígito verificador, correo, terminales si es vendedor, activo), restablecer clave (muestra la temporal una vez). No permite quitarse el rol de ADMIN ni dejar el sistema sin administrador activo. APIs `listarUsuariosAdmin`, `guardarUsuario`, `restablecerClave`.
- Migración: `migrarUsuarios()` (la llama `setup`) da una clave temporal a quien no tenga y las escribe en el registro de ejecución del editor de Apps Script (Logger). Mientras NADIE tenga clave todavía, el login acepta el PIN antiguo (solo para no dejar la app bloqueada antes de migrar).

## Modo sin conexión
- Guardados que se encolan (`COLA_FN`): guardarDetalle, guardarVarios, guardarMov, borrarMov, guardarCobro, guardarDevolucion, saveDespacho, guardarDeposito, guardarConteoEfectivo. Sin internet (o si se corta a mitad) quedan en localStorage `rn_cola` y `sincronizar()` los envía en orden al volver la conexión (evento online, cada 20 s, al volver a la app). Los args se guardan sin token; al enviar se usa el token vigente. Cada elemento queda ligado a su usuario.
- Si el servidor rechaza uno (día cerrado, etc.), queda con error y se abre el panel "Cambios por enviar" (Reintentar / Descartar). Si es un error de red se reintenta más tarde.
- Sin duplicados: cada envío lleva `op`; si es un reenvío (`rep`), el servidor revisa la hoja OPERACIONES (funciones que agregan filas: `NO_REPETIR_`) y responde `{duplicado:true}`. Los demás guardados son idempotentes (reemplazan o fijan valores).
- Lecturas: `superponer(fn,args,data)` aplica lo pendiente sobre lo que se muestra (folios, movimientos, devoluciones, por cobrar). Sin conexión se acepta la caché de cualquier edad. Vendedor y bodeguero precargan todas sus pantallas al ingresar para poder trabajar sin internet. Registros pendientes tienen id `pend_<op>`: se pueden borrar (se cancelan) pero no adjuntar.
- Barra `#redbar` bajo la cabecera: "Sin conexión · N cambios por enviar" / "Enviando…" / errores. Al salir con pendientes se pide confirmación.
- Arranque sin internet: la sesión y la caché permiten abrir; si falla la carga inicial se muestra "Sin conexión / Reintentar" (ya no cierra la sesión).
- Pruebas: Playwright con `context.set_offline` y rutas a script.google.com (ver /tmp/claude-0/t/t10.py durante el desarrollo).
- Recuperar acceso: `recuperarAcceso()` (editor de Apps Script) pone una clave temporal nueva al usuario indicado dentro de la función (ADMIN por defecto) y la escribe en el registro. Las claves temporales se aceptan también en minúsculas o con espacios.

## Navegación de oficina (ADMIN/SUPERVISOR/RENDICION)
- Computador (≥900 px): barra lateral oscura con las pantallas agrupadas por tarea (Hoy, Ventas, Bodega, Cobranza, Caja, Más), cada una con ícono; arriba a la derecha fecha, Clave y Salir (no quedan pegadas). Celular: barra inferior con los 6 grupos y las pantallas del grupo como píldoras bajo la barra superior (que se va con el scroll). `GRUPOS` = [id, nombre, pantallas, ícono]; `TABS[rol]` = [id, nombre, ícono].
- Vendedor y bodeguero mantienen su cabecera simple y barra inferior propia.
- En Cobranza, el registro manual de un pago va plegado (`details.manual`): el flujo principal es "Cobrar a un cliente".

## Importar: avance y transiciones (v31)
- Al elegir archivos se muestra "Leyendo…"; al importar, panel `.impp` con barra de avance por tandas y estado por archivo (espera/guardando/listo/error). `lotesDe(l)` define las tandas.
- Transiciones: entrada escalonada en `.enter>*`, hover de botones/tarjetas, blur en `.ov`, conteo animado de montos `.kpis b` (`animarMontos`). Respeta `prefers-reduced-motion`.

## Ordenar informes de Mi DTE (v32)
- Los informes crudos de Mi DTE ya no hay que arreglarlos a mano: `ordenarInformes(leidos)` (app.js, bloque "ORDENAR LOS INFORMES") corre al leer los archivos y es idempotente (un archivo ya ordenado queda igual).
- Regla (explicada por la encargada): Factura/Boleta emitida en equipo de oficina (`DESKTOP*`, `PC-*`, `OFICINA`) se separa por cliente. Supermercados (siempre): Amar Hermanos, Kuncar, Único, Super Oferta, Distribuidora Moreno, Operadora de Comercio → `SUPERMERCADO`. Distribuidores (Patricio Montes, Juan Carlos Silva, Oscar Lagos, César Campos, Anba, AAMF, Pichihuillinco, Amir) y todo el resto → `BODEGA` en la app. Guías y NC conservan su equipo.
- En el archivo "Ventas Diarias" que se guarda en el Drive los distribuidores se rotulan `DISTRIBUIDORA` (como la planilla manual); lo que se importa a la app va como BODEGA en ambos informes para que folios y kilos cuadren por vendedor. Boleta de oficina sin nombre de cliente → distribuidor (supuesto, se avisa).
- Informe de ventas: se completan TOTAL (=Cantidad×Precio), NETO (=TOTAL/1,19) y PRODUCTOS (GUIA para guías y NC; si no, PROPIOS/CARNICOS/CONGELADO/LACTEO/OTROS según el catálogo de PRODUCTOS y reglas de respaldo).
- Al importar se generan los Excel ordenados (`libroOrdenado`) y se suben con `guardarInformeOrdenado` a Drive: "Informes Mi DTE"/año/mes junto a la carpeta de rendiciones (o `CFG.INFORMES_FOLDER_ID`). Nombres: `Ventas Diarias d-m-aaaa.xlsx` e `Informe de ventas dd-mm-aaaa.xlsx`; si ya existe el del día se reemplaza. Siempre hay botón Descargar.
- Verificado contra los archivos manuales del 30-09: 102 documentos y 347 líneas coinciden exactamente (equipo, TOTAL, NETO, PRODUCTOS).
- Guías de despacho: solo traslado, no son venta; se conservan igual porque sirven para el inventario de carnes, degustaciones y muestras.
- Notas de crédito: suelen emitirse otro día y la encargada les cambia la fecha a la de la factura que corrigen. En la vista previa hay una tarjeta "Notas de crédito" con un selector de fecha por NC; al cambiarlo se mueve en Ventas Diarias y en el informe de kilos (`moverNC`). Un día que solo traiga NC movidas NO genera archivo en el Drive (reemplazaría el informe completo de ese día); para actualizar ese Excel hay que subir ese día de nuevo.

## Rediseño del vendedor (v34)
- Pregunta del dueño: la gente no sabe por dónde empezar y las pantallas se ven cargadas. Cambios para VENDEDOR (celular):
  - Nueva pestaña inicial **Hoy** (`vHoy`): saludo, tarjeta principal "Cuéntanos cómo te pagó cada cliente" con progreso y botón que abre directo el primer folio pendiente (`S.autoempezar`), lista de 4 pasos (Mis folios, Cobranza, Gastos, Depósito) con estado, y "Cómo va tu día" (vendido, efectivo, transferencias, cheques, crédito; solo folios ya detallados).
  - Cabecera de terreno (VENDEDOR y BODEGA) en una sola fila: "Naranjo / nombre", fecha corta ("Hoy" o "vie 16 oct") con flechas y el selector nativo invisible encima, y un menú ⋯ con "Cambiar mi clave" y "Salir". Antes la fecha tapaba el nombre.
  - Mis folios: primero progreso y botón principal "Empezar a detallar", "Marcar varios de una vez" como botón secundario; filtros con contadores; el buscador solo aparece con más de 8 folios (o en oficina).
  - Gastos: a la vista solo Concepto, Monto y "Foto de la boleta"; N° de boleta y observación plegados ("+ Agregar…").
- Vendedor y bodeguero siempre usan barra inferior (`abajo` ya no depende de la cantidad de pestañas).
- Clases nuevas: `.hero`, `.hpasos/.hpaso`, `.hday`, `.menu`, `.acciones.col`, `details.mas`. OJO: `.pasos` ya existe (stepper de Resumen), por eso las de Hoy son `.hpaso*`.
- Pendiente: revisar con el mismo criterio las pantallas de oficina (Resumen, Cobranza, Saldos) y Bodega.

## MODO PRUEBA (TEMPORAL, v35)
- Para probar roles rápido: el ADMIN ve un botón morado "Probar como…" (abajo a la derecha) que lista los usuarios activos por rol; al tocar uno entra como esa persona sin clave. Mientras se prueba, el botón dice "Probando como <nombre> · <rol>" y permite volver al ADMIN.
- Servidor: `entrarComo(token, usuario, fecha)` (solo ADMIN, solo si `CFG.MODO_PRUEBA` es true; deja registro en Logger). Cliente: `MODO_PRUEBA` en app.js; sesión del admin guardada en localStorage `rn_admin`; `montarProbar/abrirProbar/cambiarA`. Salir cierra también la sesión del admin.
- **QUITAR antes de usar en serio**: `CFG.MODO_PRUEBA: false` en APPS_SCRIPT.js (desactiva de verdad la función en el servidor) y `const MODO_PRUEBA = false` en app.js.

## Dejar la app en blanco para entregarla (limpiarPruebas)
- Solo desde el editor de Apps Script (no está en `API`). `vistaPreviaLimpieza()` muestra en el registro cuántas filas se borrarían; `limpiarPruebas()` exige cambiar `CONFIRMO = false` a `true` dentro de la función (y volver a dejarlo en false).
- Conserva `LIMPIEZA_CONSERVAR` = USUARIOS y PRODUCTOS; vacía todas las demás hojas del SCHEMA (folios, pagos, cobranza, gastos, depósitos, inventario, conteos, créditos cargados, clientes, cheques, operaciones, rendiciones, sesiones). Limpia también las sesiones de la caché (todos deben volver a entrar) e invalida las cachés.
- No toca Drive (rendiciones, informes, respaldos, planillas): se borran a mano.
- Antes de entregar: limpiarPruebas → poner `MODO_PRUEBA` en false (servidor y app) → nueva versión de la implementación.
