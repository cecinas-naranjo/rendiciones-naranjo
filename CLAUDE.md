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
- Clave temporal (usuario nuevo o restablecida): `login` devuelve `{cambiarClave:true}` y la app pide crear la clave personal (`cambiarClaveInicial`, mínimo 4 caracteres,). Restablecer o desactivar cierra todas sus sesiones (`cerrarSesionesDe_`). "Clave" en la cabecera → `cambiarMiClave`.
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

## Dejar la app en blanco para entregarla (limpiarPruebas)
- Solo desde el editor de Apps Script (no está en `API`). `vistaPreviaLimpieza()` muestra en el registro cuántas filas se borrarían; `limpiarPruebas()` exige cambiar `CONFIRMO = false` a `true` dentro de la función (y volver a dejarlo en false).
- Conserva `LIMPIEZA_CONSERVAR` = USUARIOS y PRODUCTOS; vacía todas las demás hojas del SCHEMA (folios, pagos, cobranza, gastos, depósitos, inventario, conteos, créditos cargados, clientes, cheques, operaciones, rendiciones, sesiones). Limpia también las sesiones de la caché (todos deben volver a entrar) e invalida las cachés.
- No toca Drive (rendiciones, informes, respaldos, planillas): se borran a mano.
- Antes de entregar: limpiarPruebas → nueva versión de la implementación. (El modo prueba y los datos demo ya no existen desde v59.)

## Depósitos: claridad de estado (v37)
- Problema: tras depositar, aparecían folios "nuevos" en la lista y no se sabía si estaban depositados. Ahora la pantalla muestra KPIs "Por depositar" / "Ya depositado" (suma y cantidad), el título "Por depositar (N)" con aviso de que los folios nuevos aún no están depositados, cada depósito registrado trae "Ver qué incluye" (folio/cobranza, cliente, monto), y al guardar el aviso dice cuánto queda por depositar.
- Solo frontend (sin cambios en el servidor).
- v38 (causa real): la lista de Depósitos salía de la copia guardada en el teléfono (caché `rn_cache`, hasta 20 s y luego se actualizaba por detrás) y no esperaba los folios en cola de guardado (`COLA`/`PEND`), por eso "aparecían más facturas" después. Ahora `frescoDep` espera a que terminen los guardados pendientes y pide la lista fresca al servidor; al registrar el depósito vuelve a pedirla y, si cambió, no guarda y avisa. Con guardados aún pendientes, bloquea el depósito.

## Cambio de día sin datos cruzados (v40)
- Bug: al retroceder muchos días seguidos, una respuesta lenta de un día anterior podía dibujarse después y quedaba la fecha de un día con los datos de otro. Ahora `ir()` crea un contenedor `.vm` por carga con `_vid = S.vistaId`; `render()` lanza error si la carga ya no es la vigente (la respuesta tardía se descarta antes de dibujar o activar botones).
- `cambiarFecha`: sube `S.vistaId` al tiro, muestra "cargando" y espera 200 ms antes de pedir (varios toques seguidos = una sola carga). El selector de calendario (input date) ya existía; en el celular se agregó el ícono de calendario junto a la fecha y `showPicker()` al tocarla.
- Prueba: con respuesta artificialmente lenta del 14-oct y 3 toques seguidos en ‹, la pantalla final muestra el 13-oct con datos del 13-oct.

## Transiciones en toda la app (v41)
- Cambio de pestaña (`ir`): la pantalla actual se desvanece 130 ms (`.vm.sale`) y la nueva entra deslizándose según la dirección (derecha si la pestaña está más a la derecha: `data-dir` r/l, keyframes `enterR/enterL`); sube al inicio sin salto. Un cambio de fecha o una recarga de la misma pestaña no hace la salida (solo entrada). Si llega un refresco silencioso mientras sale la pantalla anterior, `ir` lo ignora (para no perder el cambio de pestaña).
- Listas (`.folio`, `.vcard`, `.hpaso`) entran escalonadas; hojas/ventanas suben con leve rebote (`subir`/`aparecer`); `details` abren con fundido; barras `.meter` crecen; íconos activos de la barra suben un poco; presionar un botón/tarjeta la achica suavemente; toasts y login con entrada suave.
- v42: con `prefers-reduced-motion` (en PC con Windows con "Efectos de animación" apagados se activa solo y por eso en el computador no se veían las transiciones) ya NO se apaga todo: se quitan desplazamientos/rebotes/escalas y quedan fundidos suaves (`solofade`).
- Bloque de CSS al final de style.css: "Transiciones v41". Tiempos cortos (≤380 ms) para que no se sienta lento.

## Contadores de folios que no retroceden (v43)
- Bug: al detallar muchos folios seguidos (guardado rápido en cola), una actualización de fondo traía del servidor datos que aún no incluían los folios en cola y el contador "faltan N" mostraba un número mayor (6) y luego bajaba (3).
- Ahora `LOCAL` (Map `fecha␁folio_key` → líneas) recuerda cada folio detallado en esta sesión; `superponerLocal` (dentro de `superponer`, para `misDocumentos`) lo aplica sobre lo que llegue, y solo lo olvida cuando el servidor ya lo trae DETALLADO con las mismas líneas y no está en `COLA`. Si el guardado falla, se olvida y el folio vuelve a "Por detallar". `salir()` lo limpia.
- Prueba: 3 de 5 marcados localmente se ven 3 aunque el servidor traiga 0; tras confirmar 2, quedan 1 pendiente de confirmación y se siguen viendo 3.

## Supermercados aparte de los distribuidores (v44, requiere pegar APPS_SCRIPT.js)
- Los supermercados (Amar Hermanos, Kuncar, Único, Super Oferta, Operadora de Comercio, Distribuidora Moreno) se importan con el terminal `SUPERMERCADO`; los distribuidores y la venta de bodega siguen en el terminal `BODEGA` (usuario SALA).
- `asegurarSupermercados_()` (al importar Ventas Diarias o Informe de ventas): si nadie tiene el terminal SUPERMERCADO crea el usuario **SUPERMERCADOS** ("Supermercados", VENDEDOR, sin clave: no es una persona que ingrese); si lo tiene el antiguo "Distribuidor" del arranque, solo le cambia el nombre. `asignarSupermercadosAntiguos_()` pasa a ese usuario los documentos/líneas ya importados del terminal SUPERMERCADO que quedaron "sin vendedor".
- `CFG.DESTINO_DE_VENDEDOR` incluye SUPERMERCADOS → destino SUPERMERCADO del inventario (igual que DISTRIBUIDOR).

## Terminales de Mi DTE por día (v44, requiere pegar APPS_SCRIPT.js)
- `listarTerminales(token, fechas)`: cuenta los documentos de los días indicados, una columna por día (`porFecha`); sin fechas cuenta todo el historial. Antes mostraba el total de todos los días mezclados. En Importar, la tabla muestra el día elegido y, tras importar, los días recién importados (`S.diasTerm`).
- Probado en simulación con importación de 2 fechas (un archivo con 2 días y 4 archivos, uno por día): la vista previa, el import, los Excel ordenados y la tabla de terminales funcionan. El error al subir 2 fechas que reportó el usuario NO se pudo reproducir: falta el texto exacto del mensaje (posible causa: el control de que Ventas Diarias e Informe de ventas traigan las mismas fechas).

## v45 (requiere pegar APPS_SCRIPT.js COMPLETO; incluye lo pendiente de v43/v44)
- **Depósitos sin folios**: `guardarDeposito` ya no exige folios/cobranzas. `efectivoParaDepositar` devuelve `resumen` (efectivo ventas + cobranza − gastos = disponible; depositado; saldo). `getResumen`: `depositoExceso` y alerta "depositó $X más que el efectivo". La Rendición muestra "Depósito general (no se asocia a folios)".
- **Cobranza**: el buscador también busca por folio y deja marcadas las facturas (`cobrarDesdeLista`, `.cfac.buscada`).
- **Botón recargar** (`#refr`, cabecera vendedor y oficina): `actualizarTodo()` limpia caché y vuelve a cargar. Compactación de cabecera ≤420 px.
- **Importar por partes** (`vImportar`): `leidos` acumula lo subido (el mismo nombre de archivo reemplaza); botón "+ Agregar informe" (`#fi2`) siempre visible; Importar solo aparece con Ventas Diarias + Informe de ventas de las mismas fechas; `S.impPendiente` hace que `ir()` pida confirmación antes de salir. Mensaje final claro (nuevos / ya estaban / cambiaron de día / errores / "nada nuevo"); se refrescan caché y catálogo.
- **Emite el día antes (José y Javier)**: columna USUARIOS `emite_antes` (checkbox en Usuarios; `catalogo().vendedores[].emiteAntes`). En la vista previa `aplicarAntes()` pasa +1 día los documentos de esos terminales con fecha anterior a la más reciente del archivo (tarjeta con interruptor por vendedor; los de la fecha más reciente y las NC no se mueven). Servidor: `importarDTE`/`importarDetalle` corrigen la fecha de documentos ya cargados que no estén DETALLADOS (devuelven `corregidos`/`corregidas`), así se arreglan subidas anteriores volviendo a subir los mismos archivos. Después de pegar el script, ejecutar `setup()` o agregar a mano la columna `emite_antes` en USUARIOS.
- Pruebas: t22.py (importar por partes + traspaso), t23.js (corrección de fecha en servidor).

## Una sola carpeta en el Drive (v45b, solo APPS_SCRIPT.js)
- Todo lo que guarda la app queda dentro de `CFG.RENDICIONES_FOLDER_ID`: rendiciones por año/mes, `Borradores`, `Cuentas por cobrar`, y ahora también `Informes Mi DTE`, `Respaldos` (fotos/comprobantes) e `Inventario` como subcarpetas (antes se creaban al lado, en la carpeta madre). Se puede seguir forzando otra ubicación con `INFORMES_FOLDER_ID`, `RESPALDOS_FOLDER_ID`, `INVENTARIO_FOLDER_ID`.

## Informes en dos carpetas + planilla única de créditos (v46, requiere pegar APPS_SCRIPT.js)
- Drive: `Informes Mi DTE/Ventas Diarias/AAAA/MM` e `Informes Mi DTE/Informe de ventas (kilos)/AAAA/MM` (`carpetaInformes_(fecha, tipo)`).
- Planilla única "Cuentas por cobrar (planilla única)" en `Cuentas por cobrar/`; id en propiedad del script `PLANILLA_CREDITOS_ID`. Hojas: POR COBRAR (editable), PAGOS REGISTRADOS, LEEME. Columnas en `PLANILLA_COLS_`; la HUELLA (oculta) es un hash de los campos editables al exportar: al importar solo se toman las filas cuya huella cambió. Filas ORIGEN=CARGA (CREDITOS_CARGA) se editan y vuelven a la app; ORIGEN=APP (ventas a crédito de la app) son de solo lectura; filas nuevas sin CLAVE se agregan como créditos.
- `sincronizarPlanillaCreditos(token)` (botón "Abrir planilla única de créditos" en Saldos y al terminar de subir la planilla de crédito): importa y luego exporta. Disparadores: `alEditarPlanillaCreditos` (onEdit de la planilla, importa al tiro) y `planillaCreditosCadaHora` (si `PLANILLA_SUCIA`, la deja al día). Se crean solos al primer uso; requieren aceptar el permiso de disparadores al pegar el script (ejecutar `sincronizarPlanillaCreditos` no sirve desde el editor sin token: abrir el botón en la app).

## Entrega solo de lo que cambia (desde v47)
- El usuario pidió que el ZIP traiga SOLO los archivos modificados (sube más rápido a GitHub). Usar `/home/claude/entrega.sh --cerrar`: compara `/home/claude/rn` con la línea base `/home/claude/rn_entregado`, arma `/mnt/user-data/outputs/rendiciones-naranjo-cambios.zip` con los archivos distintos y actualiza la línea base. Siempre incluye sw.js (subir `CACHE_NAME`). APPS_SCRIPT.js, si cambió, se entrega aparte y COMPLETO (no va dentro del ZIP de GitHub si el usuario lo pega en Apps Script; igual se envía con SendUserFile).
- Si el usuario dice que no subió una entrega, volver a armar el ZIP con la línea base anterior (o entregar completo).

## Arranque rápido para demos (v48, requiere pegar APPS_SCRIPT.js COMPLETO y ejecutar setup())
- Cliente: `calentar()` manda un `ping` a Apps Script apenas se abre la app (mientras se escribe la clave), al volver a ella y cada 4 min (el servidor se "duerme" y el primer pedido tarda varios segundos). Oficina: el lector de Excel (`cargarXLSX(true)`, silencioso) se baja 3 s después de entrar, así la primera importación no espera su descarga.
- Servidor: `calentar()` (disparador cada 5 min, de 6:00 a 23:00) deja en CacheService USUARIOS/PRODUCTOS, las tablas por día de hoy y ayer, saldos e inventario de hoy. `activarPrecalentamiento()` crea el disparador (lo llama `setup()`). `TTL_DIA_` subió de 300 a 600 s (las caché están versionadas, así que solo afecta a borrados/ediciones hechos a mano en la planilla: hasta 10 min en verse).
- Para una demo: abrir la app 1–2 minutos antes e ingresar con la cuenta de la demo (deja todo en caché), y tener datos del día ya importados.

## Indicadores de gestión (v49, solo ADMIN; requiere pegar APPS_SCRIPT.js COMPLETO)
- Pestaña "Indicadores de gestión" (grupo Más, solo ADMIN). Servidor: `getKpis(token, desde, hasta)` → `kpis_(desde, hasta)` (en `LECTURAS_`, caché por versiones de `TABLAS_KPI_`, 10 min). Cliente: `vDatos` (app.js, al final) y bloque "Indicadores de gestión" al final de style.css.
- Contenido: **alertas automáticas** ("Para tu atención") + Ventas (total con delta vs. período anterior del mismo largo, ticket, venta por día, por vendedor, forma de pago, % contado), Crédito y cobranza (deuda total, vencida, antigüedad en tramos 0-7/8-14/15-30/31-60/+60, días reales de cobro, cobrado, top deudores/atrasados, deuda por vendedor, cheques en cartera), Kilos y mermas (kilos facturados, precio/kg, faltante en plata con `kilosDe_` por día y vendedor cuando ya hay todo el retorno, devoluciones), Control (folios sin detallar de días anteriores, días sin cerrar, descuentos por estado, efectivo contado vs. esperado con `resumen_` en los últimos 31 días con conteo, gastos).
- Reglas: notas de crédito restan de la venta; vencido = antigüedad mayor al plazo del cliente (`CLIENTES.condicion`) o, si no tiene, plazo por política (monto neto: 7/14/21/28 días); deuda y antigüedad son "a hoy", el resto del período. Períodos: 7/30/90 días, este mes, mes pasado y rango libre (máx. 13 meses). Sin exportación a Excel (no se pidió).
- Pruebas: /tmp/claude-0/t/t25.js, t26.js (servidor con datos de ejemplo) y t27.py (pantalla PC y celular).

## v50 — "Indicadores de gestión" (rediseño didáctico)
- Mismo `getKpis` (servidor sin cambios). `vDatos` rehecha: resumen en 30 segundos (4 semáforos clicables), por sección: "En simple" (frase con las cifras), KPIs con explicación, gráficos con rótulos, "Qué podrías hacer" y "¿Cómo leer esta sección?". Paleta propia (azul/violeta/verde azulado/ámbar), CSS `.dk*`.
- Semáforos (cliente): ventas Δ; vencida <15% ok, <30% atención; faltante kilos ≥0,5%/2% y mermas ≥2%/4%; control = días sin cerrar, folios sin detallar, efectivo faltante.

## v51 — "Indicadores de gestión"
- Título formal. El resumen inicial son 4 tarjetas neutras solo con cifras (sin semáforo ni opiniones); se quitaron las etiquetas Bien/Atención/Crítico de los encabezados de sección. Se corrigió el fondo oscuro heredado del `header` global en `.dksec>header`.
- Sigue habiendo en cada sección "En simple", "Qué podrías hacer" y "¿Cómo leer…?" (texto orientativo).

## v52 — Lista de clientes para clasificar ventas de oficina
- Archivo de la empresa "CLIENTES Y QUÉ SON" (643 clientes con RUT): 8 supermercados, 7 distribuidores, 23 "venta en bodega", 605 clientes de ruta (traen su terminal NARANJOT#). Se incrusta en app.js como `CLIENTES_TIPO` (RUT sin DV → [S|D|B, nombre normalizado]); solo los 38 que no son de ruta.
- `clasificarVenta(tipo, cliente, equipo, rut)`: para documentos de oficina busca primero por RUT (Mi DTE trae RUT; Informe de ventas solo razón social → nombre exacto), luego las reglas por nombre de antes. Corrige que "SUPERUNICO" no calzaba con `\bUNICO\b`. Amir (distribuidor) no está en la lista y sigue por regla.
- Para actualizar: cambiar `CLIENTES_TIPO` (hay un Excel `Clientes_clasificados.xlsx` generado). Ventas de oficina a clientes de ruta siguen yendo a BODEGA.

## v53 — Carga sugerida por vendedor (requiere pegar APPS_SCRIPT.js COMPLETO)
- Pantalla Despacho: tarjeta "Carga sugerida para <vendedor>" + línea "Sugerido N un ≈ X kg" bajo cada producto + botón "Usar como salida" (solo rellena salidas vacías).
- Servidor `getSugerido(token, fecha, vendedor)` (lectura, caché con `conCache_`, roles BODEGA/RENDICION/SUPERVISOR): promedio por DÍA DE VENTA del vendedor (días con facturas, sin guías ni NC) del mes calendario anterior a `fecha`; si ese mes tiene <3 días de venta usa las últimas 4 semanas; sin datos → `sinHistoria`.
- Unidades: productos PROPIOS por kilo → `round(promedio / kgUnidad)`, `CFG.KG_POR_UNIDAD = {porDefecto: 3, porCodigo: {'7': 1.8}}` (cervecero 1,8 kg). Productos UN → unidades directas. Otros por kilo (chuleta, etc.) → kg redondeado a 0,5. Productos CAMARA no se sugieren.
- Cliente: se pide aparte después de pintar Despacho (no demora la pantalla). Probado con datos simulados (guías y mes en curso no cuentan).

## v54 — La carga sugerida se rige por el día de venta
- `sugerido_` ya no promedia el mes anterior: mira los MISMOS días de la semana (p. ej. viernes) de las últimas 12 semanas en que el vendedor facturó, con peso 0,6^k (más reciente = más peso), por lo que se ajusta sola con cada venta. Si ese día tiene <2 ventas usa sus días de venta de las últimas 8 semanas (`base: 'general'`). Devuelve `ult` (cantidad la última vez) por producto; la pantalla lo muestra "· última vez N".
- Pendiente posible: colchón % sobre lo sugerido y usar retornos reales (DESPACHO) para afinar.

## v55 — Corrección: `getSugerido` faltaba en el objeto `API` (daba "Acción desconocida"). Ahora está registrado.

## v56 — Patés y longanizas se sugieren por kilo
- `CFG.SOLO_KILOS = ['1','1.1','3']` (longaniza, longaniza larga, paté de cerdo; también por nombre LONGANIZA/PATE): la carga sugerida los da en kg (redondeo 0,5), no en unidades. El resto de cecinas sigue en unidades de 3 kg (cervecero 1,8). Congelados/otros: sin cambios.

## v58 — Texto de la carga sugerida: plural correcto del día (lunes/martes no llevan 's'; antes decía 'luness').

## v59 — Listo para uso real
- Se quitaron el modo prueba (botón "Probar como…", `entrarComo`, `CFG.MODO_PRUEBA`) y el generador de datos demo (`cargarDatosDemo`, `demo_`, `prepararDemo`). La app ya no tiene nada temporal.
- Para empezar de cero: ejecutar `limpiarPruebas` una sola vez desde el editor (CONFIRMO = true y luego false). Conserva USUARIOS y PRODUCTOS. **Cuando ya haya datos reales, `limpiarPruebas` y `limpiarTodo_` borran todo: conviene quitarlas del script o dejar CONFIRMO siempre en false.**
- Los archivos de Drive (rendiciones, informes, respaldos, planillas) no se borran con la limpieza.

## v60 — Despacho del bodeguero rehecho (solo frontend: app.js, style.css, sw.js)
- Pensado para tablet y PC, un vendedor y un paso a la vez. Arriba: tarjetas de vendedores con su estado (Sin salida / Salida lista / Retorno N de M / Completo ✓, calculado con `pedirLote` de getDespacho de todos). Luego dos pasos: **1 · Salida (mañana)** y **2 · Retorno (tarde)**; abre según la hora (antes de las 13:00 = Salida) y recuerda el último paso elegido (`S.dmod`).
- Solo se ven los productos que importan: en Salida los que tienen salida, sugerido o guía; en Retorno los que salieron. "Agregar otro producto (N más)" muestra el resto por categoría. Cada producto es una tarjeta con − / + (0,5 kg, 1 si es unidad) y un número grande; Enter pasa al siguiente. Los dos campos (salida y retorno) siguen en el DOM y se guardan juntos con `saveDespacho` (sin cambios en el servidor).
- Retorno: muestra "Salió X"; solo avisa cuando el retorno es mayor que la salida o la diferencia con lo facturado supera 0,2 kg. Salida: carga sugerida en una línea con "Usar como salida" (la explicación va en "¿Cómo se calcula?") y "Sugerido N" en cada producto.
- Pie fijo: avance y "Guardar" / "Guardar y seguir con <siguiente vendedor>". Cambiar de vendedor con cambios sin guardar pide confirmación.

## v61 — Distribuidores, consumo y venta en bodega en Despacho
- Despacho (bodeguero) ahora tiene tarjetas extra: **Venta en bodega** (SALA), **Consumo** y **Distribuidores** (sub‑selector PATRICIO, CESAR, JUAN CARLOS, AMIR, OSCAR, CHILOE, desde `CFG.DISTRIBUIDORES` vía `catalogo().distribuidores`). Cada uno tiene salida y retorno como un vendedor.
- Se guarda en DESPACHO con `vendedor` = `DIST:NOMBRE` | `CONSUMO` | `SALA` (sin cambio de esquema). `destinoDesp_()` lleva (salida − retorno) a la columna del inventario: distribuidor → su columna, CONSUMO → CONSUMO, SALA → CONSUMO EXTERNO. Supermercados sigue como un solo total (SUPERMERCADOS/DISTRIBUIDOR → SUPERMERCADO), sin separar por razón social.
- KPI de kilos (falta/sobra) ignora estos destinos; no piden sugerido.
- Requiere pegar APPS_SCRIPT.js nuevo (nueva versión de implementación).

## v62 — Carga sugerida con el método de la planilla
- `sugerido_`: últimos 8 mismos días de la semana en que el vendedor facturó (`CFG.SUG_DIAS`); por producto se descarta el día más bajo (los días sin venta cuentan 0), se promedia el resto y se suma 20 % (`CFG.SUG_COLCHON`). Con menos de 3 días no se descarta ninguno. Si ese día tiene <2 ventas, usa sus últimos 8 días de venta. Reemplaza el promedio ponderado 0,6 de v53. Textos "¿Cómo se calcula?" actualizados.

## v63 — "Ver como…" (solo ADMIN)
- Botón morado flotante `#probar` ("Ver como…") visible solo para ADMIN: lista los usuarios activos por rol y entra como esa persona sin pedir clave (`entrarComo` en APPS_SCRIPT.js, exige rol ADMIN, queda en Logger). Al estar viendo como otro, el botón muestra "Viendo como X"; para volver se elige el propio usuario ADMIN. `S_ADMIN` guarda la sesión original (`rn_admin`). Lo que se registre queda a nombre del usuario visto. Sin interruptor MODO_PRUEBA: es permanente y solo para ADMIN.

## v64 — Sugerido discreto
- Despacho ya no muestra la barra azul "Carga sugerida…" ni el botón "Usar como salida". El sugerido queda solo como la línea "Sugerido X" en cada producto (y esos productos siguen apareciendo en la lista de Salida).

## v65
- El "Sugerido X" de cada producto queda visible aunque el bodeguero ya haya escrito la salida (antes se ocultaba al digitar).

## v66
- Despacho: los pasos se llaman solo "Salida" y "Retorno" (sin "1 ·", "2 ·" ni "en la mañana/tarde").

## v67 — Inventario más simple (solo frontend)
- Cada producto: nombre, "Quedan" grande, resumen en una línea ("Empezó con X · salió Y · volvió Z"), solo dos campos a la vista (Entra de fábrica, Conteo físico) y "+ Otras salidas" como enlace que abre la hoja de siempre. "Con cuánto empezó" solo aparece cuando el inicial es editable. Buscador y filtro Todos / Con movimiento (`S.invQ`, `S.invF`); 2 columnas en PC; borde cobre en lo modificado. Cálculos y guardado no cambian.

## v68 — Folios adelantados (requiere pegar APPS_SCRIPT.js COMPLETO)
- Para ir avanzando el detalle sin esperar el Mi DTE: el vendedor anota en Mis folios ("Adelantar folios › Anotar folio") tipo (Boleta/Factura), N°, monto total y forma de pago (Efectivo, Transferencia + banco, Crédito; cheque y pago mixto se detallan normal cuando llegue el folio). La oficina puede hacerlo a nombre del vendedor elegido.
- Hoja ADELANTOS (se crea sola: `asegurarAdelantos_`): `id, fecha, vendedor, tipo, folio, folio_key, monto, forma, banco, estado, nota, registrado, resuelto`. Estados: ESPERANDO, APLICADO, REVISAR. API: `adelantarFolio(token, fecha, tipo, folio, monto, forma, banco, vendedor)`, `listarAdelantos(token, fecha, vendedor)` (lectura), `borrarAdelanto(token, id)` (no si ya está APLICADO).
- `cruzarAdelantos_()` corre al final de cada `importarDTE` (y al anotar un folio que ya llegó): si tipo+folio (`folio_key`) existe, es del mismo vendedor, el monto calza con el total del documento y no hay descuento pendiente → crea el pago (una línea, monto menos descuento aprobado) y deja el documento DETALLADO. Si no calza queda REVISAR con la nota (monto distinto, otro vendedor/terminal, descuento pendiente) y el folio sigue por detallar normal. Si el folio ya estaba detallado, el adelanto se marca APLICADO sin tocar nada.
- `importarDTE` devuelve `adelantos: {aplicados, revisar}`; la pantalla de Importar lo informa. Subir los informes 2–3 veces al día sigue funcionando (solo se agregan folios nuevos y se cruzan los adelantos).

## v69 — Folios adelantados: cheque, pago mixto y sin conexión (requiere pegar APPS_SCRIPT.js COMPLETO)
- La hoja de "Anotar folio" admite Efectivo, Transferencia (banco), Crédito y **Cheque** (banco, N°, fecha, titular), y **pago mixto** (hasta 4 líneas con monto cada una; muestra "Cuadra ✓ / Faltan $"). ADELANTOS tiene la columna nueva `pagos` (JSON con las líneas; `asegurarAdelantos_` la agrega si la hoja era de v68). `adelantarFolio(token, fecha, tipo, folio, monto, pagos[], vendedor)` valida cada línea (`datosCheque_` para cheques) y que sumen el monto; sigue aceptando el formato v68 (forma, banco, vendedor). Al cruzar, `aplicarAdelanto_` escribe una fila de PAGOS por línea. Si el folio tiene descuento (pendiente o aprobado) queda REVISAR.
- **Sin conexión**: `adelantarFolio` y `borrarAdelanto` están en `COLA_FN` (se guardan en el teléfono y se envían solos al volver internet, igual que el resto). `superponer('listarAdelantos')` muestra lo pendiente como "Guardado en el teléfono"; quitar un pendiente solo lo cancela. Si el folio ya estaba APLICADO al reenviar, el servidor responde sin error.

## v70 — Arreglo de los botones de filtro y tarjeta de adelantos
- Bug de v60: las reglas del selector Salida/Retorno de Despacho estaban en `.seg` global y deformaban todos los demás selectores (filtros de Mis folios, buscador/filtro de Inventario, hojas). Ahora son `.seg.dseg` (solo Despacho). Los `.seg` normales vuelven a ser una fila compacta. **No definir reglas globales de `.seg`.**
- Tarjeta "Anotar folios por adelantado" con ícono y fondo cobre claro; en celular el botón ocupa el ancho.

## v71 — Se quitó "emite el día antes" (solo frontend)
- Por pedido del usuario: la app ya no cambia la fecha de los folios al importar. `aplicarAntes()` devuelve vacío (no hay tarjeta "Folios emitidos el día antes") y se quitó la casilla de Usuarios (`emiteAntes` se guarda en false). El servidor y la columna `emite_antes` quedan sin tocar (inofensivos); la corrección de fecha de documentos ya cargados en `importarDTE` sigue existiendo. Las fechas de las notas de crédito sí se pueden seguir moviendo a mano.

## v72 — Anular folio / nota de crédito (requiere pegar APPS_SCRIPT.js COMPLETO)
- Origen: la encargada explicó que el vendedor emite una factura, se equivoca y emite otra al mismo cliente (más la NC en Mi DTE); hoy ella decide al rendir cuál vale. Ahora el vendedor avisa desde la app (sin conexión también).
- Hoja ANULACIONES (se crea sola: `asegurarAnulaciones_`): `id, fecha, vendedor, tipo, folio, folio_key, cliente, modo (COMPLETO|PARCIAL), lineas (JSON [{codigo,producto,unidad,cantidad,monto}]), monto, motivo, reemplazo, vuelve (SI|NO), estado (PENDIENTE|APROBADA|RECHAZADA), nc_folio, nota, registrado_por, registrado, resuelto_por, resuelto`.
- API: `solicitarAnulacion(token, fecha, tipo, folio, modo, lineas, monto, motivo, reemplazo, vuelve, vendedor)` (en `NO_REPETIR_` y `COLA_FN`), `listarAnulaciones(token, fecha, vendedor)` y `anulacionesPendientes(token)` (lecturas), `resolverAnulacion(token, id, aprobar, ncFolio, nota)` (solo ADMIN/SUPERVISOR; también permite pasar de aprobada a rechazada), `borrarAnulacion` (solo PENDIENTE; en cola).
- Efecto al APROBAR: el monto anulado se trata como un descuento aprobado: `docsDelDia_` lo agrega a `descuentos` con `nc:true` y suma a `descAprob` (así resumen, inspección y archivo de rendición siguen cuadrando; aparece en la columna DESCUENTO). Anulación completa (restante ≤ 0): el folio queda DETALLADO sin pagos (se borran sus PAGOS) y chip "Anulado". Parcial: si lo detallado ya no cuadra, el folio vuelve a PENDIENTE para que el vendedor lo corrija; `guardarDetalle`/`guardarVarios` descuentan lo anulado (`ncAprobDe_`).
- Kilos: `anulKg_(fecha)` resta de lo facturado los kilos anulados aprobados (productos por kilo; en anulación completa sin líneas usa las de VENTAS_DETALLE por `folio_key`) en `kilosDe_`, `getDespacho.facturado` y los KPI. `vuelve = SI` solo avisa al bodeguero (`getDespacho().vuelven`, línea en Retorno): el inventario sigue saliendo del retorno que anota el bodeguero (no se suma dos veces).
- NC de Mi DTE: si al aprobar se escribe el N° de la nota de crédito (`nc_folio`), esa NC se oculta de los folios del día para no contarla dos veces. Si no se escribe, la NC importada sigue su camino de siempre.
- Cliente: tarjeta "Anular folio o pedir nota de crédito" en Mis folios (`abrirAnulacion`); aprobación en la pestaña "Por autorizar" (antes "Descuentos por autorizar", `vDescuentos`). Un adelanto de folio con anulación queda REVISAR.
- No hay anulación para vendedores de otro vendedor; la oficina puede registrarla a nombre del vendedor elegido.

## v73 — Clave de 4 dígitos
- `CLAVE_MIN` = 4 (servidor) y el cliente pide mínimo 4 caracteres. No se rechaza ninguna clave por ser fácil (1111, 1234, el RUT…): solo el largo mínimo y que sea distinta de la actual. El bloqueo de 5 intentos/15 min sigue protegiendo. Requiere pegar APPS_SCRIPT.js COMPLETO.

## v74 — Cobranza: la forma de pago va primero
- En "Cobrar a un cliente" (`cobrarDesdeLista`) el selector "¿Cómo pagó?" (con banco o datos del cheque) ahora está ARRIBA de la lista de facturas (paso 1) y luego se marcan las facturas (paso 2). Antes estaba al final y no se veía sin bajar. Solo frontend.

## v75 — Limpiar solo la lista de créditos (requiere pegar APPS_SCRIPT.js COMPLETO)
- Desde el editor (no está en `API`): `vistaPreviaLimpiezaCreditos()` cuenta; `limpiarCreditos()` (CONFIRMO = true y luego false) borra CREDITOS_CARGA y los cheques `P|…` de CHEQUES_ESTADO, y suelta la planilla única (`PLANILLA_CREDITOS_ID`; el archivo viejo queda en Drive). No toca ventas, pagos, cobranza, clientes ni usuarios. Motivo: `cargarCreditos` actualiza por folio pero no borra los créditos de cargas anteriores que ya no vienen en la planilla, y las cargas de prueba dejaban deudas que no calzaban. Después se vuelve a subir la planilla en Importar Mi DTE.

## v76 — Rol GERENCIA (solo lectura) y "Registró" visible (requiere pegar APPS_SCRIPT.js COMPLETO)
- Rol `GERENCIA` (se crea en Usuarios; en `ROLES_VALIDOS`). Ve: Indicadores de gestión (`getKpis` ahora ADMIN + GERENCIA), Resumen del día, Saldos de clientes, Cheques en cartera, Inventario, Historial (más `getInspeccion`). Toda otra función lo rechaza ("No tienes permiso"), así que no puede escribir. Cliente: `TABS.GERENCIA` y `body.solo-leer` (CSS al final de style.css) oculta botones de escritura (cerrar, reabrir, detallar, marcar cheques, guardar inventario, planilla).
- "Registró": `listarMov` devuelve `por` (nombre de `registrado_por`) y las tablas de Cobranza/Gastos/Proveedores/Consumo tienen columna "Registró"; los depósitos muestran "Registró <nombre>". Despacho sigue sin guardar quién anota.
- `limpiarTodo_` también suelta `PLANILLA_CREDITOS_ID`/`PLANILLA_SUCIA`.
- Nota Acceso: desde v73 no se rechazan claves triviales (solo largo mínimo 4 y distinta de la actual).

## v77 — Unidades en Despacho e inventario en kilos o unidades según el producto (requiere pegar APPS_SCRIPT.js COMPLETO)
- Problema: el bodeguero cuenta el inventario por unidad (o bandeja) porque pesar todo de vuelta es lento, pero Despacho solo guardaba kilos. Ahora, en productos que se pesan (unidad KG) pero que el inventario lleva en unidades, Despacho agrega una segunda fila "Unidades · para el inventario" con salida y retorno en unidades (los kilos se siguen pesando y alimentan la comparación de kilos vs facturado, sin cambios).
- DESPACHO tiene columnas nuevas `salida_un`, `retorno_un` (`asegurarColsDespacho_()` las agrega sola al guardar; setup las crea en hojas nuevas). `saveDespacho` acepta `salidaUn`/`retornoUn` (si el cliente no las manda, conserva lo guardado). `getDespacho.filas` las devuelve.
- Unidad del inventario por producto: `unidadInv_(p)` — terminados en UNIDADES salvo `CFG.INV_EN_KILOS` (longaniza corta/larga, paté de cerdo, costillar; se puede agregar nombres), cámara en KG, congelados/laminados en UN. `catalogo().productos[].inv` y `kgUn`; `productosInv_` devuelve `unidad` (la del inventario) y `unidadVenta`.
- `inventarioDia_`: para productos con inventario en UN y despacho en KG usa `salida_un`/`retorno_un`; si no se anotaron, estima kilos ÷ `kgUnidad_` (3 kg, cervecero 1,8). Distribuidores/consumo/sala usan la misma regla. La pantalla Inventario muestra "un."/"kg" en Quedan, resumen y campos.
- Pendiente: confirmar con el bodeguero si hay más productos que se cuenten en kilos (agregarlos a `CFG.INV_EN_KILOS`) y el peso por bandeja si se quisiera convertir.

## v78 — Avance de vendedores en el Resumen del día (requiere pegar APPS_SCRIPT.js COMPLETO)
- API `getAvance(token, fecha)` (lectura en `LECTURAS_`; RENDICION/SUPERVISOR/GERENCIA/ADMIN): por vendedor, folios detallados / por detallar, adelantos (esperando / aplicados / por revisar), cantidad de cobranza, gastos y depósitos, y `ultima` = hora en que el SERVIDOR recibió el último registro hecho por el propio vendedor (PAGOS, COBRANZA, GASTOS, DEPOSITOS, ADELANTOS; lo detallado por la oficina no cuenta). Si anotó sin internet, es la hora en que recuperó la señal. No hay "última conexión" real (no se guarda).
- Cliente: tarjeta "Avance de vendedores" (`#avc`) sobre "Por vendedor" en `vResumen`; chip "hace N min · HH:MM" (ámbar si pasaron >2 h hoy), "Sin actividad" si no hay registros. Se pide aparte para no demorar el Resumen.

## v79 — Avance de vendedores plegable (solo frontend)
- La tarjeta del Resumen es un `details.avd` cerrado por defecto con resumen "N de M con actividad hoy"; recuerda si se abrió (`localStorage rn_avc`).

## v80 — Tamaño de letra (solo frontend)
- Toda la UI está en px, así que el tamaño se cambia con `zoom` en `<html>` (`LETRAS`: Normal 1, Grande 1.15, Muy grande 1.3; `aplicarLetra`/`cambiarLetra`, `localStorage rn_letra`). En tablets (táctil y lado menor ≥ 600 px) el valor por defecto es "Grande"; en PC y celular, "Normal". Botón "Aa" en la cabecera de oficina y "Tamaño de letra" en el menú ⋯ del vendedor/bodeguero; cada toque cambia al siguiente tamaño.

## v81 — Trazabilidad de folios adelantados (requiere pegar APPS_SCRIPT.js COMPLETO)
- Problema: de 23 folios anotados solo ~18 se aplicaban y los demás quedaban "Esperando" sin explicación. Causas cubiertas: folio de Mi DTE con ceros o ".0" (ahora `keyNorm_` compara sin ceros), tipo equivocado (Boleta/Factura: avisa "Mi DTE lo trae como Factura"), monto/vendedor distinto (ya existía), y folio que nunca llegó.
- `cruzarAdelantos_`: si se importó Mi DTE de ese día DESPUÉS de anotarlo y el folio no aparece → REVISAR con el motivo; si aún no hay importación posterior → ESPERANDO. Devuelve `{aplicados, revisar, sinLlegar}`. Nueva API `reintentarAdelantos(token)` (botón "Volver a cruzar con Mi DTE").
- `listarAdelantos` devuelve `anotado`, `resuelto`, `llego`, `docCliente`, `docTotal`: cada folio muestra su línea ① Anotado hh:mm · ② Llegó/Aún no llega de Mi DTE · ③ Detallado ✓/No se pudo/Pendiente. Cabecera "Anotados: N · detallados · esperando · para revisar" (suma siempre N) y la tarjeta de Mis folios usa lo mismo.

## v82 — Rapidez, toques repetidos y Hoy del vendedor (solo frontend)
- Transiciones: en PC (≥900 px) ya no hay fundido de salida antes de cargar la pantalla; en celular 60 ms. Entradas escalonadas más cortas (≤60 ms de retraso, 180 ms), precarga de pestañas vecinas a los 250 ms.
- Toques repetidos: (1) `escribir` ignora una escritura idéntica (misma función, usuario y argumentos) repetida en 4 s y devuelve la misma promesa (`RECIEN`); (2) listener global en captura ignora un 2.º clic al mismo botón en <900 ms (excepto + / − y `data-rep`).
- Botón recargar (`actualizarTodo`): si la app cree que no hay internet, hace el intento (ping, ~1 s con giro y botón bloqueado) antes de decir que no hay conexión.
- Hoy del vendedor: tarjeta principal "Anota cada folio que emitas en ruta" (abre `abrirAdelanto`, con contador anotados/detallados) y segunda tarjeta "Detallar folios que ya subieron" con avance y botón.

## v83 — Animaciones livianas (solo frontend)
- Queja: en el computador de la oficina las animaciones se "pegaban". Bloque final de style.css: sin `backdrop-filter`, sin transiciones de `box-shadow`/`transform` en tarjetas, botones y filas, sin `scroll-behavior:smooth`, entradas solo con fundido de 160 ms, listas (`.folio`, `.vcard`, `.hpaso`) sin animación por fila, hojas y avisos con fundido. `animarMontos` (conteo animado) desactivado. Para volver a animaciones ricas hay que quitar ese bloque; no reintroducir sombras/blur animados.

## v84 — Despacho en tabla compacta (solo frontend)
- Salida y Retorno usan una tabla: una fila por producto con columnas Producto | Sugerido (en Salida) o Salió (en Retorno) | Kilos | Unidades. Sin botones − y +; se escribe y Enter pasa al siguiente campo. Productos por unidad (UN) solo usan la columna Unidades; los de kilos sin conteo por unidad, solo Kilos; los pesados con inventario en unidades usan ambas (`salida`/`retorno` = kilos, `salidaUn`/`retornoUn` = unidades). Los avisos (más de lo que salió, diferencia vs. facturado) siguen debajo de la fila (`.st`). En celular la fila pasa a 2 columnas.
- El pie solo tiene "Guardar" (se quitó "Guardar y seguir con <vendedor>": el bodeguero no siempre sigue el mismo orden).

## v85 — Inventario en tabla: "Ver stock" y "Contar y anotar" (solo frontend)
- `vInventario` ya no usa tarjetas: es una tabla por sección (en celular cada fila pasa a lista con etiquetas). Interruptor `S.invM`: **Contar y anotar** (por defecto para BODEGA): Empezó | Debería haber (= calc.t, sin conteo) | Entra de fábrica | Conteo físico | Diferencia ("calza" / "faltan N" / "sobran N", en vivo) | Otras salidas ›; Cámara agrega Sale a fábrica y Sale a vendedores. **Ver stock** (por defecto para el resto; GERENCIA solo ve este): Empezó | Entró | Salió (vendedores) | Volvió | Otras salidas | Quedan | Estado ("conteo ±N", "negativo"). Filtros: Todos / Con movimiento / Con diferencia (`S.invF` = todos|mov|dif). Enter pasa al siguiente campo. El pie Guardar y "¿Falta un producto?" solo salen en Contar. Cálculo, guardado y hoja "Otras salidas" no cambian.
- Sin filtro "Poco stock": no existe un mínimo por producto (queda como posible mejora).

## v86 — Costillar de cerdo en kilos (requiere pegar APPS_SCRIPT.js COMPLETO)
- El costillar salía con columna Unidades en Despacho porque PRODUCTOS.unidad decía UN. `CFG.VENTA_EN_KILOS = ['COSTILLAR']`: `read_('PRODUCTOS')` fuerza unidad KG a los productos cuyo nombre contenga ese texto (Despacho, inventario, kilos facturados). Para otro producto igual, agregar parte de su nombre a la lista.

## v87 — Cobranza sin foto y cliente elegido de la lista (requiere pegar APPS_SCRIPT.js COMPLETO)
- Cobranza (registro a mano) ya no pide ni muestra "Foto o archivo de respaldo": se puede registrar sin internet y la foto no se subiría. Los adjuntos antiguos quedan en Drive.
- El cliente de una cobranza se elige de la lista de razones sociales del DTE (hoja CLIENTES) con un buscador (nombre o RUT); no se escribe. API `listarClientes` (lectura, caché por versión de CLIENTES, roles VENDEDOR/RENDICION/SUPERVISOR/ADMIN; el vendedor la precarga para el modo sin conexión). Se guardan `cliente` (nombre del DTE) y `rut`; `guardarMov` pisa el nombre con el del DTE si llega el RUT. Si la lista está vacía o no hay caché, queda el campo de texto libre.

## v88 — Hoy del vendedor en botones y Depósito opcional (requiere pegar APPS_SCRIPT.js COMPLETO)
- `vHoy`: botón grande "Anotar folio" (con "N anotados hoy") y cuadrícula de botones Mis folios / Cobranza / Gastos / Depósito con un globito corto (por detallar en ámbar, "Listo"/cantidad en verde). Sin frases explicativas; desaparece la tarjeta "Folios que ya subió la encargada" (Mis folios la reemplaza). Debajo "Vendido hoy" y "Ver desglose" (solo con folios detallados). No son pasos obligatorios.
- **Depósito es opcional por vendedor**: columna USUARIOS `deposita` (se agrega sola con `asegurarColUsuarios_`), casilla "Deposita el efectivo" en Usuarios. `catalogo().vendedores[].deposita` = casilla marcada o ya registró algún depósito antes. `tabsRol()`/`vendDeposita()`: sin eso no aparece el botón Depósito en Hoy ni en la barra inferior del vendedor.
- Pendiente: mismo estilo de menos texto en Mis folios, Cobranza, Gastos y Depósito.
