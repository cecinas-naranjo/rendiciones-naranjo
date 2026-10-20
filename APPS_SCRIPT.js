// ============================================================
// APPS SCRIPT — Rendiciones Naranjo (backend / API)
// Vinculado a la Google Sheet "BD Rendiciones Naranjo" (Extensiones → Apps Script).
// INSTALAR / ACTUALIZAR:
// 1. Borrar todo → pegar este archivo → Guardar
// 2. Primera vez: elegir la función setup → Ejecutar (crea las hojas)
// 3. Implementar → Administrar implementaciones → editar → Nueva versión → Implementar
//    (Ejecutar como: "Yo" / Quién tiene acceso: "Cualquier usuario")
// La app (GitHub Pages) llama a este script por POST. El archivo del repo NO se
// autodespliega: si se edita, hay que volver a pegarlo e implementar nueva versión.
// ============================================================

const CFG = {
  TZ: 'America/Santiago',
  // Carpeta "Resumen Rendición" en el Drive de la empresa (donde se guardan las rendiciones cerradas)
  RENDICIONES_FOLDER_ID: '1Osm3OciOJQFgvuFil4s9ZfXd4XUMni3B',
  // Carpeta donde se guardan fotos y archivos de respaldo. Vacío = se crea "Respaldos" junto a la carpeta de rendiciones.
  RESPALDOS_FOLDER_ID: '',
  APP_NAME: 'Rendiciones Naranjo',
  // TEMPORAL (pruebas): deja que el ADMIN entre como cualquier usuario sin pedir su clave (función entrarComo). Poner en false antes de usar en serio.
  MODO_PRUEBA: true,
  // Diferencia de kilos (vendido según bodega vs facturado) desde la cual se alerta, por vendedor
  TOLERANCIA_KG: 1,
  // Informes de Mi DTE ya ordenados (Ventas Diarias e Informe de ventas): vacío = "Informes Mi DTE" junto a la carpeta de rendiciones, con subcarpetas año/mes
  INFORMES_FOLDER_ID: '',
  // Inventario: carpeta donde se guardan las planillas mensuales (vacío = "Inventario" junto a la de rendiciones)
  INVENTARIO_FOLDER_ID: '',
  // Vendedores cuyo despacho no va en columna propia sino como destino (igual que en la planilla de inventario)
  DESTINO_DE_VENDEDOR: { DISTRIBUIDOR: 'SUPERMERCADO', SUPERMERCADOS: 'SUPERMERCADO', SALA: 'CONSUMO EXTERNO' },
  // Destinos de "otras salidas". Los 4 primeros siempre tienen columna en la planilla; el resto aparece si se usa ese día.
  DESTINOS: ['REPROCESO','CONSUMO','CONSUMO EXTERNO','LAMINADO','MERMA','DEGUSTACION','MUESTRA','OTRAS SALIDAS CON GUIA','SUPERMERCADO'],
  // Distribuidores: en la planilla de inventario cada uno tiene su columna de salida (aparece si retiró ese día)
  DISTRIBUIDORES: ['PATRICIO','CESAR','JUAN CARLOS','AMIR','OSCAR','CHILOE']
};

const SCHEMA = {
  USUARIOS:    ['usuario','nombre','rol','pin','terminales','activo','rut','correo','clave_hash','sal','cambiar_clave','intentos','bloqueado_hasta','emite_antes'],
  PRODUCTOS:   ['codigo','nombre','categoria','unidad','precio','orden','activo','seccion','nombre_inv'],
  INVENTARIO_MOV: ['key','fecha','codigo','tipo','destino','cantidad','obs','registrado_por','registrado'],
  DESPACHO:    ['id','fecha','vendedor','codigo','producto','unidad','salida','retorno','obs','actualizado_por','actualizado'],
  DOCUMENTOS:  ['folio_key','fecha','tipo','folio','rut','cliente','total','condicion_dte','terminal','vendedor','estado','importado'],
  VENTAS_DETALLE: ['linea_key','fecha','folio_key','tipo','folio','codigo','producto','cantidad','precio','total','neto','terminal','vendedor','categoria','pago','es_guia','importado'],
  PAGOS:       ['id','folio_key','fecha','vendedor','forma','banco','monto','referencia','registrado_por','registrado','cheque_numero','cheque_fecha','cheque_titular'],
  DESCUENTOS:  ['id','folio_key','fecha','vendedor','cliente','monto','motivo','estado','solicitado_por','autorizado_por','resuelto'],
  COBRANZA:    ['id','fecha','vendedor','cliente','folio','monto','forma','banco','referencia','registrado_por','registrado','adjuntos','cheque_numero','cheque_fecha','cheque_titular','rut','folio_key'],
  PROVEEDORES: ['id','fecha','proveedor','documento','folio','monto','forma','obs','registrado_por','registrado','adjuntos'],
  CONSUMO:     ['id','fecha','cliente','folio','monto','forma','obs','registrado_por','registrado'],
  CONTEO_EFECTIVO: ['key','fecha','vendedor','b20000','b10000','b5000','b2000','b1000','monedas','caja_chica','obs','registrado_por','registrado'],
  CLIENTES:    ['rut','razon_social','condicion','vendedor','alias','actualizado'],
  CREDITOS_CARGA: ['folio_key','rut','cliente_excel','tipo','folio','fecha','monto','condicion','vendedor','estado','recepcion','metodo','obs','cargado'],
  DEVOLUCIONES: ['id','fecha','tipo','origen','cliente','codigo','producto','unidad','cantidad','nota_credito','motivo','obs','registrado_por','registrado','adjuntos','monto'],
  GASTOS:      ['id','fecha','responsable','concepto','monto','respaldo','obs','registrado_por','registrado','adjuntos'],
  DEPOSITOS:   ['id','fecha','vendedor','banco','monto','referencia','folios','cobranzas','obs','registrado_por','registrado','adjuntos'],
  OPERACIONES: ['op','fn','fecha'],
  CHEQUES_ESTADO: ['clave','estado','fecha','registrado_por','registrado','obs'],
  RENDICIONES: ['fecha','estado','cerrado_por','cerrado','archivo_url','resumen_json'],
  SESIONES:    ['token','usuario','creado']
};

// Formas de pago estructuradas (reemplazan el texto libre "ESTADO Y EF 20000", etc.)
const FORMAS = ['EFECTIVO','TRANSFERENCIA','DEP_EFECTIVO','CHEQUE','CREDITO','NOTA_CREDITO'];
const BANCOS = ['BICE','ESTADO','SANTANDER'];
// Bancos emisores de cheques (el banco del cliente, no el de la empresa)
const BANCOS_CHEQUE = ['BANCO DE CHILE','BANCOESTADO','SANTANDER','BCI','ITAU','SCOTIABANK','BICE','SECURITY','FALABELLA','RIPLEY',
  'CONSORCIO','INTERNACIONAL','COOPEUCH','OTRO'];
/** Un cheque debe traer número, banco emisor y fecha de cobro; el titular es opcional. Devuelve los campos limpios. */
function datosCheque_(p) {
  const numero = String(p.cheque_numero || '').replace(/\D/g, '');
  const fecha = String(p.cheque_fecha || '').slice(0, 10);
  if (!numero) throw new Error('Falta el número del cheque.');
  if (!p.banco) throw new Error('Falta el banco del cheque.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Falta la fecha del cheque.');
  return { cheque_numero: numero, cheque_fecha: fecha, cheque_titular: String(p.cheque_titular || '').trim(), referencia: 'Cheque N° ' + numero };
}
// En el detalle de un folio el vendedor ya no usa "depósito en efectivo": marca Efectivo, y si después deposita
// ese efectivo a la empresa lo registra en DEPOSITOS (un depósito puede cubrir muchos folios).
const FORMAS_APP = ['EFECTIVO','TRANSFERENCIA','CHEQUE','CREDITO','NOTA_CREDITO'];
const ROLES_AUTORIZAN = ['ADMIN','SUPERVISOR'];

/* ============================ SETUP ============================ */

// Lista de precios 2026. Códigos numéricos = códigos de Mi DTE. Los que empiezan con "?" aún no se conocen:
// se completan solos la primera vez que aparecen en un "Informe de ventas" (se busca por nombre).
const PRODUCTOS_BASE = [
  ['1','LONGANIZA','PROPIOS','KG',6390], ['1.1','LONGANIZA LARGA','PROPIOS','KG',6390],
  ['3','PATE DE CERDO','PROPIOS','KG',6390], ['5','ARROLLADO','PROPIOS','KG',7390],
  ['5.1','ARROLLADO CON CUERO','PROPIOS','KG',''], ['10','ARROLLADO C/AJI','PROPIOS','KG',7490],
  ['6','QUESO DE CABEZA','PROPIOS','KG',6590], ['7','SALCHICHON CERVECERO','PROPIOS','KG',6690],
  ['8','MORTADELA LISA','PROPIOS','KG',5590], ['9','MORTADELA JAMONADA','PROPIOS','KG',6190],
  ['11','JAMON SANDWICH','PROPIOS','KG',6090], ['?CAZUELA','CAZUELA AHUMADA','PROPIOS','KG',4300],
  ['?DESMECH','CARNE DE VACUNO DESMECHADO CAMESTRE 1KG','CARNICOS','UN',12531],
  ['?MOLIDA','CARNE MOLIDA VACUNO 500G - 10 PORCIENTO','CARNICOS','UN',4553],
  ['?BBQ','CERDO BBQ DESMECHADA 1KG','CARNICOS','UN',12531],
  ['?CHULETA','CHULETA VETADA','CARNICOS','KG',4190],
  ['?COSTILLAR','COSTILLAR DE CERDO AHUMADO ENV.','CARNICOS','UN',7000],
  ['?ARVEJAS','ARVEJAS 10X200G M. VERDE','CONGELADOS','UN',6139],
  ['?CHOCLO','CHOCLO 10X200G M. VERDE','CONGELADOS','UN',6186],
  ['?CHOCLOT','CHOCLO TROCITO M. VERDE 20X180G','CONGELADOS','UN',16135],
  ['?EMPQG1','EMP MED LUNA QUESO GRANEL 1X3KG','CONGELADOS','UN',11345],
  ['?EMPQG3','EMP MED LUNA QUESO GRANEL 3X3 9KG','CONGELADOS','UN',34034],
  ['?EMPPINO','EMP PINO VACUNO MED LUNA 8X600G BOLSA','CONGELADOS','UN',23990],
  ['?EMPQ14','EMP QUESO 14X24X25G ESTUCHE','CONGELADOS','UN',36602],
  ['?EMPQ1','EMP QUESO 1X24X25G ESTUCHE','CONGELADOS','UN',2614],
  ['?EMPQML','EMP QUESO MED LUNA 8X600G','CONGELADOS','UN',21301],
  ['?PAPAS','PAPAS PRE FRITAS 4X2.5KG SUPER CAPITAN','CONGELADOS','UN',20230],
  ['?PCHOCLO','PASTA CHOCLO 1 KILO','CONGELADOS','UN',2939],
  ['?POROTO','POROTO VERDE 10X150G M. VERDE','CONGELADOS','UN',6389],
  ['?PRIMAV','PRIMAVERA 10X200G M. VERDE','CONGELADOS','UN',6153],
  ['?SOFRITO','SOFRITO CON AJO 12X150G M. VERDE','CONGELADOS','UN',7670],
  ['?SOPA12','SOPAIPILLA 20X12X420G','CONGELADOS','UN',31868],
  ['?SOPA48','SOPAIPILLA 20X48X500G','CONGELADOS','UN',38056],
  ['?MANTEQ','MANTEQUILLA PAN. HUILCO 5X250G','LACTEOS','UN',13108],
  ['?GAUDA','Q. LAM GAUDA 3X500G HUILCO','LACTEOS','UN',12271],
  ['?MANTEC','Q. LAM MANTECOSO 3X500G HUILCO','LACTEOS','UN',13164]
];

/* ============================ LIMPIAR DATOS DE PRUEBA ============================ */
// Para dejar la app en blanco antes de entregarla. Se ejecuta SOLO desde el editor de Apps Script (no está en la API de la app).
// 1) Ejecuta `vistaPreviaLimpieza` y mira en el registro cuántas filas se borrarían.
// 2) En `limpiarPruebas` cambia `CONFIRMO = false` por `true`, guarda y ejecútala. Después vuelve a dejarlo en false.
// Se conservan los usuarios, sus claves y los productos. Todo lo demás queda vacío (folios, pagos, cobranza, gastos, inventario, saldos de clientes, etc.).
const LIMPIEZA_CONSERVAR = ['USUARIOS', 'PRODUCTOS'];
function tablasALimpiar_() { return Object.keys(SCHEMA).filter(n => LIMPIEZA_CONSERVAR.indexOf(n) < 0); }
function vistaPreviaLimpieza() {
  const ss = SpreadsheetApp.getActive();
  const l = tablasALimpiar_().map(n => { const sh = ss.getSheetByName(n); return n + ': ' + (sh ? Math.max(sh.getLastRow() - 1, 0) : 0) + ' filas'; });
  Logger.log('SE BORRARÍAN (conserva ' + LIMPIEZA_CONSERVAR.join(', ') + '):\n' + l.join('\n') +
    '\n\nLos archivos que ya están en Drive (rendiciones, informes, respaldos, planillas) NO se borran: revísalos y bórralos a mano si quieres.');
}
function limpiarPruebas() {
  const CONFIRMO = false;           // <- cambiar a true para borrar de verdad
  if (!CONFIRMO) throw new Error('Seguridad: para borrar los datos cambia CONFIRMO a true dentro de limpiarPruebas y vuelve a ejecutarla.');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  const resumen = [];
  try {
    const ss = SpreadsheetApp.getActive(), cc = CacheService.getScriptCache();
    const ses = ss.getSheetByName('SESIONES');
    if (ses && ses.getLastRow() > 1) {            // las sesiones también viven 6 horas en la caché: se sacan de ahí
      const toks = ses.getRange(2, 1, ses.getLastRow() - 1, 1).getValues().map(r => 's_' + r[0]).filter(k => k.length > 2);
      if (toks.length) try { cc.removeAll(toks); } catch (e) {}
    }
    tablasALimpiar_().forEach(n => {
      const sh = ss.getSheetByName(n); if (!sh) return;
      const filas = sh.getLastRow() - 1;
      if (filas > 0) { sh.getRange(2, 1, filas, Math.max(sh.getLastColumn(), 1)).clearContent(); }
      resumen.push(n + ': ' + Math.max(filas, 0) + ' filas borradas');
    });
    Object.keys(CACHEADAS_).forEach(limpiarCache_);
    invalidarTodo_();
  } finally { lock.releaseLock(); }
  Logger.log('LIMPIEZA LISTA\n' + resumen.join('\n') + '\n\nEntra a la app de nuevo (se cerraron todas las sesiones). Vuelve a dejar CONFIRMO en false.');
  return resumen;
}

/** Crea o actualiza las hojas. Se puede ejecutar de nuevo sin perder datos. */
function setup() {
  Object.keys(CACHEADAS_).forEach(limpiarCache_);
  activarPrecalentamiento();
  const ss = SpreadsheetApp.getActive();
  Object.keys(SCHEMA).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const head = SCHEMA[name];
    const actual = sh.getLastRow() ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0] : [];
    const igual = head.every((h, i) => actual[i] === h);
    const soloAgrega = actual.filter(String).length > 0 && actual.filter(String).every((h, i) => head[i] === h);
    if (!igual) {
      // Si solo se agregaron columnas al final, se conservan los datos. PRODUCTOS v1 (otra estructura) se reemplaza.
      if (!soloAgrega && (name === 'PRODUCTOS' || sh.getLastRow() <= 1)) sh.clear();
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  ss.getSheetByName('DOCUMENTOS').getRange('A:E').setNumberFormat('@');
  ss.getSheetByName('VENTAS_DETALLE').getRange('A:F').setNumberFormat('@');
  ss.getSheetByName('PRODUCTOS').getRange('A:A').setNumberFormat('@');
  ss.getSheetByName('USUARIOS').getRange('D:E').setNumberFormat('@');
  ss.getSheetByName('USUARIOS').getRange('G:J').setNumberFormat('@');

  const us = ss.getSheetByName('USUARIOS');
  if (us.getLastRow() === 1) {
    us.getRange(2, 1, 10, 6).setValues([
      ['ADMIN','Administrador','ADMIN','1234','',true],
      ['RENDICION','Encargada rendición','RENDICION','2222','',true],
      ['BODEGA','Bodeguero','BODEGA','3333','',true],
      ['PARADA','Parada','VENDEDOR','1001','NARANJOT1',true],
      ['AGUILERA','Aguilera','VENDEDOR','1002','NARANJOT2',true],
      ['VARGAS','Vargas','VENDEDOR','1003','NARANJOT6',true],
      ['MUÑOZ','Muñoz','VENDEDOR','1004','NARANJOT7',true],
      ['GUTIERREZ','Gutiérrez','VENDEDOR','1005','NARANJOT9',true],
      ['DISTRIBUIDOR','Distribuidor','VENDEDOR','1006','SUPERMERCADO',true],
      ['SALA','Venta en bodega','VENDEDOR','1007','BODEGA',true]
    ]);
  } else {
    const sala = read_('USUARIOS').find(u => u.usuario === 'SALA');
    if (sala && !sala.terminales) { sala.nombre = 'Venta en bodega'; sala.terminales = 'BODEGA'; updateRow_('USUARIOS', sala._row, sala); }
  }
  const ps = ss.getSheetByName('PRODUCTOS');
  if (ps.getLastRow() === 1) {
    const base = PRODUCTOS_BASE.map((r, i) => r.concat([i + 1, true, '', '']));
    ps.getRange(2, 1, base.length, SCHEMA.PRODUCTOS.length).setValues(base);
  }
  prepararProductosInventario_();
  ['Hoja 1','Sheet1'].forEach(n => { const d = ss.getSheetByName(n); if (d && ss.getSheets().length > 1) ss.deleteSheet(d); });
  Object.keys(CACHEADAS_).forEach(limpiarCache_);
  invalidarTodo_();
  migrarUsuarios();
  return 'Listo';
}

/* ============================ API ============================ */

// Funciones que la app puede llamar. Cualquier otra se rechaza.
const API = {
  batch, ping, login, cambiarClaveInicial, cambiarMiClave, listarUsuariosAdmin, guardarUsuario, restablecerClave, logout, catalogo, getDespacho, saveDespacho, importarDTE, asignarVendedor,
  misDocumentos, guardarDetalle, guardarVarios, importarDetalle, listarTerminales, asignarTerminal, descuentosPendientes, resolverDescuento, listarMov, guardarMov,
  listarDevoluciones, guardarDevolucion, borrarDevolucion, getConteoEfectivo, guardarConteoEfectivo, cargarCreditos, guardarInformeOrdenado, entrarComo, porCobrar, guardarCobro, vincularRut, reintentarRut, generarPlanillaPorCobrar, sincronizarPlanillaCreditos, listarCheques, marcarCheque, borrarMov, getInventario, guardarInventario, getSaldosClientes, agregarProductoInv, generarPlanillaInventario, subirAdjunto, borrarAdjunto, efectivoParaDepositar, guardarDeposito, borrarDeposito, getResumen, getInspeccion, cerrarRendicion, vistaPreviaRendicion, reabrirRendicion, historial
};

function doGet() { return json_({ ok: true, app: CFG.APP_NAME }); }

// Cuerpo: {"fn":"nombre","args":[...]} enviado como text/plain (evita el preflight CORS)
function doPost(e) {
  MEMO_ = {}; SLICE_ = {}; VER_ = {}; TOCADAS_ = {};
  try {
    const req = JSON.parse(e.postData.contents);
    const fn = API[req.fn];
    if (!fn) throw new Error('Acción desconocida: ' + req.fn);
    // Solo las consultas (que no escriben) pueden usar la caché por día; cualquier otra acción lee siempre la planilla.
    FRESCO_ = !LECTURAS_[req.fn];
    // Guardados que la app envía de nuevo desde su cola (se cortó internet): si ya se aplicó, no se repite.
    const op = req.op ? String(req.op).slice(0, 40) : '';
    if (op && req.rep && NO_REPETIR_[req.fn] && opAplicada_(op)) return json_({ ok: true, data: { duplicado: true } });
    const data = fn.apply(null, req.args || []);
    if (op && NO_REPETIR_[req.fn]) registrarOp_(op, req.fn);
    return json_({ ok: true, data });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    cerrarPeticion_();
  }
}

/** Guardados que agregan filas: si la app los reenvía (se cortó internet y no se supo si llegaron), se reconocen por su `op` y no se duplican. */
const NO_REPETIR_ = { guardarMov: 1, guardarCobro: 1, guardarDevolucion: 1, guardarDeposito: 1 };
function opAplicada_(op) { return read_('OPERACIONES').some(x => x.op === op); }
function registrarOp_(op, fn) {
  withLock_(() => {
    const xs = read_('OPERACIONES');
    if (xs.length > 3000) deleteRows_('OPERACIONES', xs.slice(0, 1500).map(x => x._row));       // solo importan las operaciones recientes
    append_('OPERACIONES', [{ op, fn, fecha: now_() }]);
  });
}
function ping() { return true; }

// Consultas que no modifican datos: se pueden pedir juntas (batch) y usan la caché por día.
const LECTURAS_ = { ping: 1, catalogo: 1, getDespacho: 1, misDocumentos: 1, listarTerminales: 1, descuentosPendientes: 1, listarMov: 1, listarDevoluciones: 1, listarCheques: 1, getConteoEfectivo: 1, porCobrar: 1, getInventario: 1,
  getSaldosClientes: 1, efectivoParaDepositar: 1, getResumen: 1, getInspeccion: 1, historial: 1, batch: 1 };

/** Varias consultas en una sola petición: [[fn, args], …] → [{ok, data} | {ok:false, error}, …]. Comparten las lecturas de la planilla. */
function batch(llamadas) {
  return (llamadas || []).map(l => {
    try {
      if (!LECTURAS_[l[0]] || l[0] === 'batch') throw new Error('Solo se pueden agrupar consultas: ' + l[0]);
      return { ok: true, data: API[l[0]].apply(null, l[1] || []) };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
}

/* ---------- velocidad ----------
   1) Dentro de una misma petición cada hoja se lee una sola vez (MEMO_), y cualquier escritura la invalida.
   2) USUARIOS y PRODUCTOS (casi no cambian) quedan además en CacheService 10 minutos; se limpian solos
      al escribir desde la app y, con onEdit, cuando alguien edita esas hojas a mano. */
let MEMO_ = {};
let SS_ = null;
let FRESCO_ = true;      // true: se lee siempre de la planilla (acciones que escriben)
let SLICE_ = {};         // filas de un día ya leídas en esta petición: 'TABLA|fecha' → filas
let VER_ = {};           // versiones de tabla ya leídas en esta petición
let TOCADAS_ = {};       // tablas escritas en esta petición
// Tablas con una fila por movimiento y columna fecha: se guardan por día en CacheService (clave con la versión de la tabla).
const POR_DIA_ = { DOCUMENTOS: 1, PAGOS: 1, DESCUENTOS: 1, DESPACHO: 1, COBRANZA: 1, GASTOS: 1, DEPOSITOS: 1, PROVEEDORES: 1, CONSUMO: 1, DEVOLUCIONES: 1, VENTAS_DETALLE: 1 };
const TTL_DIA_ = 600;

/* ---------- precalentamiento ----------
   Cada 5 minutos (de 6:00 a 23:00) un disparador deja listas en la caché las tablas de hoy y de ayer, usuarios, productos,
   saldos de clientes y el inventario del día. Así, aunque nadie haya usado la app en un rato, la primera pantalla no tiene que
   leer la planilla. No escribe nada. Se instala solo al ejecutar setup() (o ejecutando activarPrecalentamiento() una vez). */
function calentar() {
  const h = Number(Utilities.formatDate(new Date(), CFG.TZ, 'H'));
  if (h < 6 || h >= 23) return;
  MEMO_ = {}; SLICE_ = {}; VER_ = {}; TOCADAS_ = {}; FRESCO_ = false;
  const hoy = hoy_(), ayer = Utilities.formatDate(new Date(Date.now() - 864e5), CFG.TZ, 'yyyy-MM-dd');
  try { read_('USUARIOS'); read_('PRODUCTOS'); } catch (e) {}
  const tablas = Object.keys(POR_DIA_);
  [hoy, ayer].forEach(f => {
    try { cargarDia_(f, tablas); tablas.forEach(n => { if (!SLICE_[n + '|' + f]) byFecha_(n, f); }); } catch (e) {}
  });
  try { conCache_('saldos', ['DOCUMENTOS', 'PAGOS', 'COBRANZA', 'USUARIOS', 'CREDITOS_CARGA', 'CLIENTES', 'CHEQUES_ESTADO'], () => saldosClientes_()); } catch (e) {}
  try { conCache_('inv|' + hoy, ['INVENTARIO_MOV', 'DESPACHO', 'PRODUCTOS', 'USUARIOS'], () => inventarioDia_(hoy)); } catch (e) {}
  FRESCO_ = true;
}
function activarPrecalentamiento() {
  try { if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'calentar')) ScriptApp.newTrigger('calentar').timeBased().everyMinutes(5).create(); } catch (e) { Logger.log('No se pudo crear el disparador: ' + e); }
}

function nuevaVersion_() { return String(Date.now()) + Math.random().toString(36).slice(2, 6); }
/** Versiones actuales de las tablas (una sola consulta a la caché). Si no existe, se crea. */
function versiones_(nombres) {
  const c = CacheService.getScriptCache(), faltan = nombres.filter(n => !VER_[n]);
  if (faltan.length) {
    let got = {}; try { got = c.getAll(faltan.map(n => 'v_' + n)) || {}; } catch (e) {}
    const nuevas = {};
    faltan.forEach(n => { let v = got['v_' + n]; if (!v) { v = nuevaVersion_(); nuevas['v_' + n] = v; } VER_[n] = v; });
    if (Object.keys(nuevas).length) try { c.putAll(nuevas, 21600); } catch (e) {}
  }
  return VER_;
}
/** Trae de la caché, de una vez, los días de varias tablas. Lo que no esté se lee de la planilla cuando se pida. */
function cargarDia_(fecha, nombres) {
  if (FRESCO_) return;
  const lista = nombres.filter(n => POR_DIA_[n] && !SLICE_[n + '|' + fecha]);
  if (!lista.length) return;
  versiones_(lista);
  let got = {}; try { got = CacheService.getScriptCache().getAll(lista.map(n => 'd|' + n + '|' + VER_[n] + '|' + fecha)) || {}; } catch (e) {}
  lista.forEach(n => { const v = got['d|' + n + '|' + VER_[n] + '|' + fecha]; if (v) try { SLICE_[n + '|' + fecha] = JSON.parse(v); } catch (e) {} });
}
/** Guarda el resultado de una consulta cara, ligado a las versiones de las tablas de las que depende: si cualquiera cambia, se recalcula. */
function conCache_(clave, tablas, fn) {
  if (FRESCO_) return fn();
  const c = CacheService.getScriptCache(), vs = versiones_(tablas), k = 'r|' + clave + '|' + tablas.map(n => vs[n]).join('.');
  try { const hit = c.get(k); if (hit) return JSON.parse(hit); } catch (e) {}
  const r = fn();
  try { const j = JSON.stringify(r); if (j.length < 95000) c.put(k, j, TTL_DIA_); } catch (e) {}
  return r;
}
function tocar_(name) { FRESCO_ = true; TOCADAS_[name] = 1; SLICE_ = {}; }
/** Al terminar una petición que escribió: se confirman las escrituras y se cambia la versión de las tablas tocadas (la caché vieja deja de usarse). */
function cerrarPeticion_() {
  const t = Object.keys(TOCADAS_); if (!t.length) return;
  try { SpreadsheetApp.flush(); } catch (e) {}
  const v = {}; t.forEach(n => v['v_' + n] = nuevaVersion_());
  try { CacheService.getScriptCache().putAll(v, 21600); } catch (e) {}
  TOCADAS_ = {};
}
/** Para funciones que se ejecutan desde el editor (setup, cargas): descarta toda la caché por día. */
function invalidarTodo_() {
  const v = {}; Object.keys(SCHEMA).forEach(n => v['v_' + n] = nuevaVersion_());
  try { CacheService.getScriptCache().putAll(v, 21600); } catch (e) {}
}
const CACHEADAS_ = { USUARIOS: 1, PRODUCTOS: 1 };
function limpiarCache_(name) {
  delete MEMO_[name]; tocar_(name);
  if (CACHEADAS_[name]) try { CacheService.getScriptCache().remove('tbl_' + name); } catch (e) {}
}
/** Disparador simple: si alguien edita USUARIOS o PRODUCTOS directo en la planilla, se refresca la caché. */
function onEdit(e) {
  try {
    const n = e.range.getSheet().getName();
    if (CACHEADAS_[n]) CacheService.getScriptCache().remove('tbl_' + n);
    if (SCHEMA[n]) CacheService.getScriptCache().put('v_' + n, nuevaVersion_(), 21600);     // alguien editó la hoja a mano
  } catch (err) {}
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ============================ HELPERS ============================ */

function sh_(name) { SS_ = SS_ || SpreadsheetApp.getActive(); return SS_.getSheetByName(name); }
function now_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function hoy_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
function uid_() { return Utilities.getUuid().slice(0, 8); }
function num_(v) {
  if (typeof v === 'number') return v;
  let s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  // Separador de miles solo si es inequívoco: 1.234.567 o 1.234,5. "3.135" se lee como 3,135 (kilos).
  if (/^-?\d{1,3}(\.\d{3}){2,}(,\d+)?$/.test(s) || /^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '.');
  const n = Number(s); return isNaN(n) ? 0 : n;
}

// "1.0" → "1", "1.1" → "1.1", "abc" → "ABC"
function codeKey_(c) { const s = String(c == null ? '' : c).trim(); const n = Number(s.replace(',', '.')); return s !== '' && !isNaN(n) ? String(n) : s.toUpperCase(); }
function normTxt_(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function esGuia_(tipo) { return /gu[ií]a/i.test(String(tipo)); }
function folioKey_(tipo, folio) { return String(tipo).normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() + '-' + String(folio).trim(); }
/** Los supermercados van aparte de los distribuidores (estos salen por el terminal BODEGA). Si nadie tiene el terminal SUPERMERCADO se crea el usuario
    "Supermercados"; si lo tiene el antiguo "Distribuidor" del arranque, solo se le cambia el nombre. */
function asegurarSupermercados_() {
  const us = read_('USUARIOS'), tiene = u => String(u.terminales || '').toUpperCase().split(',').map(x => x.trim()).indexOf('SUPERMERCADO') >= 0;
  const hay = us.filter(u => u.rol === 'VENDEDOR' && tiene(u));
  if (hay.length) {
    const d = hay.find(u => u.usuario === 'DISTRIBUIDOR' && String(u.nombre).trim().toLowerCase() === 'distribuidor');
    if (d) { d.nombre = 'Supermercados'; updateRow_('USUARIOS', d._row, d); }
    return;
  }
  if (us.some(u => u.usuario === 'SUPERMERCADOS')) return;      // existe pero sin el terminal o sin activar: lo decide el administrador en Usuarios
  append_('USUARIOS', [{ usuario: 'SUPERMERCADOS', nombre: 'Supermercados', rol: 'VENDEDOR', pin: '', terminales: 'SUPERMERCADO', activo: true, rut: '', correo: '', clave_hash: '', sal: '', cambiar_clave: 'TRUE', intentos: 0, bloqueado_hasta: '' }]);
}
/** Lo ya importado del terminal SUPERMERCADO que quedó "sin vendedor" pasa al usuario de supermercados (se hace una sola vez, al primer import). */
function asignarSupermercadosAntiguos_() {
  const dueno = mapaTerminales_()['SUPERMERCADO']; if (!dueno) return;
  ['DOCUMENTOS', 'VENTAS_DETALLE'].forEach(t => read_(t).filter(r => String(r.terminal).toUpperCase() === 'SUPERMERCADO' && !r.vendedor).forEach(r => { r.vendedor = dueno; updateRow_(t, r._row, r); }));
}
function mapaTerminales_() {
  const term = {};
  vendedores_().forEach(v => String(v.terminales || '').split(',').map(x => x.trim().toUpperCase()).filter(String).forEach(t => term[t] = v.usuario));
  return term;
}

function normFecha_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  let m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : s;
}

function valores_(name) {
  const head = SCHEMA[name];
  if (CACHEADAS_[name]) {
    try { const c = CacheService.getScriptCache().get('tbl_' + name); if (c) return JSON.parse(c); } catch (e) {}
  }
  const sh = sh_(name), last = sh.getLastRow();
  const vals = last < 2 ? [] : sh.getRange(2, 1, last - 1, head.length).getValues();
  if (CACHEADAS_[name]) try { const j = JSON.stringify(vals); if (j.length < 90000) CacheService.getScriptCache().put('tbl_' + name, j, 600); } catch (e) {}
  return vals;
}
function read_(name) {
  if (!MEMO_[name]) MEMO_[name] = valores_(name);
  const head = SCHEMA[name];
  // copia nueva de los objetos en cada llamada: quien los modifica no afecta a otras lecturas
  return MEMO_[name].map((r, i) => {
    const o = { _row: i + 2 };
    head.forEach((h, j) => o[h] = r[j] instanceof Date && (h === 'fecha' || h === 'cheque_fecha') ? normFecha_(r[j]) : r[j]);
    if (o.fecha !== undefined) o.fecha = normFecha_(o.fecha);
    return o;
  });
}
function byFecha_(name, fecha) {
  if (FRESCO_ || !POR_DIA_[name]) return read_(name).filter(r => r.fecha === fecha);
  const k = name + '|' + fecha;
  if (!SLICE_[k]) {
    SLICE_[k] = read_(name).filter(r => r.fecha === fecha);
    try { const j = JSON.stringify(SLICE_[k]); if (j.length < 95000) CacheService.getScriptCache().put('d|' + name + '|' + versiones_([name])[name] + '|' + fecha, j, TTL_DIA_); } catch (e) {}
  }
  return SLICE_[k].map(r => Object.assign({}, r));
}

function append_(name, objs) {
  if (!objs.length) return;
  limpiarCache_(name);
  const head = SCHEMA[name], sh = sh_(name);
  sh.getRange(sh.getLastRow() + 1, 1, objs.length, head.length)
    .setValues(objs.map(o => head.map(h => o[h] === undefined ? '' : o[h])));
}
function updateRow_(name, row, obj) {
  limpiarCache_(name);
  const head = SCHEMA[name];
  sh_(name).getRange(row, 1, 1, head.length).setValues([head.map(h => obj[h] === undefined ? '' : obj[h])]);
}
function deleteRows_(name, rows) {
  if (!rows.length) return;
  limpiarCache_(name);
  const sh = sh_(name);
  // filas seguidas se borran de una vez (borrar fila por fila era lo más lento al guardar)
  const r = [...new Set(rows)].sort((a, b) => b - a);
  let fin = r[0], ini = r[0];
  for (let i = 1; i <= r.length; i++) {
    if (i < r.length && r[i] === ini - 1) { ini = r[i]; continue; }
    sh.deleteRows(ini, fin - ini + 1);
    if (i < r.length) { fin = ini = r[i]; }
  }
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { FRESCO_ = true; MEMO_ = {}; SLICE_ = {}; return fn(); } finally { lock.releaseLock(); }
}

/* ============================ SESIÓN ============================ */

const SESION_DIAS = 30; // la sesión dura 30 días en el celular: nadie tiene que reingresar cada hora

/* ---------- claves ----------
   Cada persona entra con su RUT (o correo) y su clave personal; el rol lo asigna la administración. La clave se guarda con sal y
   SHA-256 repetido (nunca en texto). Una clave nueva o restablecida es temporal: la persona debe cambiarla al entrar.
   5 intentos fallidos bloquean la cuenta 15 minutos. */
const CLAVE_MIN = 6, MAX_INTENTOS = 5, BLOQUEO_MIN = 15, ROLES_VALIDOS = ['ADMIN','SUPERVISOR','RENDICION','BODEGA','VENDEDOR'];
function hashClave_(clave, sal) {
  const D = Utilities.DigestAlgorithm.SHA_256;
  let h = Utilities.computeDigest(D, String(sal) + '|' + String(clave), Utilities.Charset.UTF_8);
  for (let i = 0; i < 999; i++) h = Utilities.computeDigest(D, h);
  return h.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}
function aleatorio_(n) { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, n); }
function claveTemporal_() {
  const al = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', h = Utilities.getUuid().replace(/-/g, ''); let s = '';
  for (let i = 0; i < 6; i++) s += al[parseInt(h.substr(i * 2, 2), 16) % al.length];
  return s;
}
const activo_ = u => String(u.activo).toUpperCase() !== 'FALSE';
function rutValido_(r) {
  const n = rutNorm_(r); if (n.length < 8 || n.length > 9) return false;
  const cuerpo = n.slice(0, -1), dv = n.slice(-1); let s = 0, m = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) { s += Number(cuerpo[i]) * m; m = m === 7 ? 2 : m + 1; }
  const e = 11 - (s % 11), esp = e === 11 ? '0' : e === 10 ? 'K' : String(e);
  return esp === dv;
}
function buscarUsuario_(ident) {
  const t = String(ident || '').trim(); if (!t) return null;
  const sinPuntos = t.replace(/[.\-\s]/g, ''), esRut = /^[0-9]{7,9}[0-9kK]$/.test(sinPuntos), arroba = t.indexOf('@') >= 0;
  return read_('USUARIOS').find(u => (esRut && rutNorm_(u.rut) === rutNorm_(t)) || (arroba && String(u.correo || '').trim().toLowerCase() === t.toLowerCase())
    || String(u.usuario).toUpperCase() === t.toUpperCase()) || null;
}
function claveNuevaValida_(clave, u, actual) {
  clave = String(clave || '');
  if (clave.length < CLAVE_MIN) throw new Error('La clave debe tener al menos ' + CLAVE_MIN + ' caracteres.');
  if (/^(.)\1+$/.test(clave) || /^(0123456|123456|1234567|12345678|654321|abcdef|abc123|password|clave123)/i.test(clave)) throw new Error('Esa clave es muy fácil de adivinar. Elige otra.');
  if (u && (rutNorm_(u.rut) === clave.toUpperCase().replace(/[^0-9K]/g, '') && rutNorm_(u.rut))) throw new Error('La clave no puede ser tu RUT.');
  if (actual && String(actual) === clave) throw new Error('La clave nueva debe ser distinta de la actual.');
}
/** Comprueba la clave de una persona con control de intentos. Devuelve el usuario o lanza el error. */
function verificarCredenciales_(ident, clave) {
  const cc = CacheService.getScriptCache(), kk = 'lg_' + String(ident || '').toLowerCase().replace(/[^a-z0-9@]/g, '').slice(0, 40), n = Number(cc.get(kk) || 0);
  if (n >= 10) throw new Error('Demasiados intentos. Espera ' + BLOQUEO_MIN + ' minutos e intenta de nuevo.');
  const malo = () => { cc.put(kk, String(n + 1), 900); Utilities.sleep(700); throw new Error('RUT, correo o clave incorrectos.'); };
  const u = buscarUsuario_(ident);
  if (!u || !activo_(u)) malo();
  if (u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()) throw new Error('Cuenta bloqueada por intentos fallidos. Prueba en unos minutos o pide a la administración que restablezca tu clave.');
  const antiguo = !read_('USUARIOS').some(x => String(x.clave_hash || ''));      // antes de migrar las claves se acepta el PIN antiguo
  let ok;
  if (antiguo) ok = String(u.pin || '') !== '' && String(u.pin) === String(clave);
  else if (!u.clave_hash) throw new Error('Tu usuario aún no tiene clave. Pide a la administración que te la asigne.');
  else {
    // las claves temporales son en MAYÚSCULAS sin espacios: se perdona si se escribe en minúsculas o se pega con un espacio
    const temporal = String(u.cambiar_clave).toUpperCase() === 'TRUE';
    ok = hashClave_(clave, u.sal) === String(u.clave_hash) || (temporal && hashClave_(String(clave).trim().toUpperCase(), u.sal) === String(u.clave_hash));
  }
  if (!ok) {
    withLock_(() => { const f = read_('USUARIOS').find(x => x.usuario === u.usuario); if (!f) return;
      f.intentos = num_(f.intentos) + 1;
      if (f.intentos >= MAX_INTENTOS) { f.bloqueado_hasta = new Date(Date.now() + BLOQUEO_MIN * 60000).toISOString(); f.intentos = 0; }
      updateRow_('USUARIOS', f._row, f); });
    malo();
  }
  if (num_(u.intentos) || u.bloqueado_hasta) withLock_(() => { const f = read_('USUARIOS').find(x => x.usuario === u.usuario); if (f) { f.intentos = 0; f.bloqueado_hasta = ''; updateRow_('USUARIOS', f._row, f); } });
  cc.remove(kk);
  return { u, antiguo };
}
/** Cierra todas las sesiones abiertas de una persona (dentro de withLock_). */
function cerrarSesionesDe_(usuario) {
  const cc = CacheService.getScriptCache(), ss = read_('SESIONES').filter(s => s.usuario === usuario);
  ss.forEach(s => cc.remove('s_' + s.token));
  if (ss.length) deleteRows_('SESIONES', ss.map(s => s._row));
}
function aplicarClave_(usuario, clave, temporal) {        // debe llamarse dentro de withLock_
  const f = read_('USUARIOS').find(x => x.usuario === usuario); if (!f) throw new Error('Usuario no encontrado.');
  f.sal = aleatorio_(8); f.clave_hash = hashClave_(clave, f.sal); f.cambiar_clave = temporal ? 'TRUE' : 'FALSE'; f.pin = ''; f.intentos = 0; f.bloqueado_hasta = '';
  updateRow_('USUARIOS', f._row, f);
  if (temporal) cerrarSesionesDe_(usuario);
}
const fijarClave_ = (usuario, clave, temporal) => withLock_(() => aplicarClave_(usuario, clave, temporal));
/** Primera entrada (o clave restablecida): valida la clave temporal y fija la clave personal. */
function cambiarClaveInicial(ident, temporal, nueva) {
  const c = verificarCredenciales_(ident, temporal);
  claveNuevaValida_(nueva, c.u, temporal);
  fijarClave_(c.u.usuario, nueva, false);
  return true;
}
function cambiarMiClave(token, actual, nueva) {
  const u = auth_(token);
  if (!u.clave_hash || hashClave_(actual, u.sal) !== String(u.clave_hash)) { Utilities.sleep(700); throw new Error('La clave actual no es correcta.'); }
  claveNuevaValida_(nueva, u, actual);
  fijarClave_(u.usuario, nueva, false);
  return true;
}
/** Para el editor de Apps Script (también lo llama setup): da una clave temporal a quien no tenga y borra los PIN antiguos. */
function migrarUsuarios() {
  const salida = [];
  read_('USUARIOS').forEach(u => { if (String(u.clave_hash || '')) return;
    const t = claveTemporal_(); u.sal = aleatorio_(8); u.clave_hash = hashClave_(t, u.sal); u.cambiar_clave = 'TRUE'; u.pin = ''; u.intentos = 0; u.bloqueado_hasta = '';
    updateRow_('USUARIOS', u._row, u); salida.push(u.usuario + ' (' + u.nombre + ', ' + u.rol + '): clave temporal ' + t); });
  if (salida.length) Logger.log('CLAVES TEMPORALES (entregar en privado; cada persona la cambia al entrar):\n' + salida.join('\n'));
  return salida;
}

/** Para el editor de Apps Script: si alguien (por ejemplo el ADMIN) no puede entrar, pone una clave temporal nueva y la muestra en el registro.
 *  Uso: cambia el nombre entre comillas y ejecuta `recuperarAcceso`. */
function recuperarAcceso() {
  const usuario = 'ADMIN';
  const u = read_('USUARIOS').find(x => x.usuario === usuario); if (!u) throw new Error('No existe el usuario ' + usuario);
  const t = claveTemporal_(); fijarClave_(usuario, t, true);
  Logger.log('Clave temporal de ' + usuario + ': ' + t + '  (entra con "' + usuario + '" o su RUT/correo y esta clave; la app te pedirá crear una nueva)');
  return t;
}

function login(ident, clave, fecha) {
  const c = verificarCredenciales_(ident, clave), u = c.u;
  if (!c.antiguo && String(u.cambiar_clave).toUpperCase() === 'TRUE') return { cambiarClave: true, nombre: u.nombre };
  return sesionDe_(u, fecha);
}
/** Crea la sesión de un usuario ya verificado y devuelve lo que la app necesita para abrir (usado por login y por entrarComo). */
function sesionDe_(u, fecha) {
  const token = Utilities.getUuid();
  withLock_(() => {
    const lim = new Date(Date.now() - SESION_DIAS * 864e5);
    deleteRows_('SESIONES', read_('SESIONES').filter(s => new Date(s.creado) < lim).map(s => s._row));
    append_('SESIONES', [{ token, usuario: u.usuario, creado: new Date().toISOString() }]);
  });
  CacheService.getScriptCache().put('s_' + token, u.usuario, 21600);
  const sesion = { token, usuario: u.usuario, nombre: u.nombre, rol: u.rol, puedeAutorizar: ROLES_AUTORIZAN.indexOf(u.rol) >= 0 };
  // Para que la app abra de una vez: se devuelve el catálogo y los datos de la primera pantalla (ahorra dos viajes al servidor).
  try {
    FRESCO_ = false; MEMO_ = {}; SLICE_ = {};          // el login solo escribió en SESIONES: las lecturas por día pueden usar la caché
    const f = fecha || hoy_(), cat = catalogo(token);
    const primera = u.rol === 'VENDEDOR' ? ['misDocumentos', [token, f, '']]
      : u.rol === 'BODEGA' ? ['getDespacho', [token, f, (cat.vendedores[0] || {}).usuario || '']]
      : ['getResumen', [token, f]];
    const lote = [['catalogo', [token]], primera].map(l => ({ fn: l[0], args: l[1], data: API[l[0]].apply(null, l[1]) }));
    sesion.lote = lote;
  } catch (e) { /* si algo falla, la app pide cada cosa por separado como siempre */ }
  return sesion;
}

/** TEMPORAL: el ADMIN entra como otro usuario para probar su pantalla. Solo funciona mientras CFG.MODO_PRUEBA sea true. */
function entrarComo(token, usuario, fecha) {
  if (!CFG.MODO_PRUEBA) throw new Error('El modo de prueba está desactivado.');
  const adm = auth_(token, ['ADMIN']);
  if (adm.rol !== 'ADMIN') throw new Error('Solo la administración puede usar el modo de prueba.');
  const u = read_('USUARIOS').find(x => x.usuario === String(usuario));
  if (!u || !activo_(u)) throw new Error('Ese usuario no existe o está desactivado.');
  Logger.log('MODO_PRUEBA: ' + adm.usuario + ' entró como ' + u.usuario);
  return sesionDe_(u, fecha);
}

function logout(token) {
  CacheService.getScriptCache().remove('s_' + token);
  withLock_(() => deleteRows_('SESIONES', read_('SESIONES').filter(s => s.token === token).map(s => s._row)));
  return true;
}

function auth_(token, roles) {
  const cache = CacheService.getScriptCache();
  let usuario = token && cache.get('s_' + token);
  if (!usuario && token) {
    const s = read_('SESIONES').find(x => x.token === token);
    if (s && new Date(s.creado) > new Date(Date.now() - SESION_DIAS * 864e5)) {
      usuario = s.usuario; cache.put('s_' + token, usuario, 21600);
    }
  }
  if (!usuario) throw new Error('SESION: Tu sesión expiró. Vuelve a ingresar.');
  const u = read_('USUARIOS').find(x => x.usuario === usuario);
  if (!u || String(u.activo).toUpperCase() === 'FALSE') throw new Error('SESION: Usuario desactivado.');
  if (roles && roles.indexOf(u.rol) < 0 && u.rol !== 'ADMIN') throw new Error('No tienes permiso para esta acción.');
  return u;
}

/* ---------- administración de usuarios (solo ADMIN) ---------- */
function listarUsuariosAdmin(token) {
  auth_(token, ['ADMIN']);
  return read_('USUARIOS').map(u => ({ usuario: u.usuario, nombre: u.nombre, rol: u.rol, rut: u.rut ? rutFmt_(u.rut) : '', correo: u.correo || '', terminales: u.terminales || '', emiteAntes: esSi_(u.emite_antes),
    activo: activo_(u), tieneClave: !!String(u.clave_hash || ''), debeCambiar: String(u.cambiar_clave).toUpperCase() === 'TRUE',
    bloqueado: !!(u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()) }));
}
function guardarUsuario(token, o) {
  const yo = auth_(token, ['ADMIN']);
  const nombre = String(o.nombre || '').trim(), rol = String(o.rol || '').toUpperCase();
  const rut = String(o.rut || '').trim(), correo = String(o.correo || '').trim().toLowerCase();
  if (!nombre) throw new Error('Escribe el nombre.');
  if (ROLES_VALIDOS.indexOf(rol) < 0) throw new Error('Elige el rol.');
  if (!rut && !correo) throw new Error('Indica el RUT o el correo con el que va a entrar.');
  if (rut && !rutValido_(rut)) throw new Error('El RUT no es válido. Revisa el dígito verificador.');
  if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw new Error('El correo no es válido.');
  return withLock_(() => {
    const us = read_('USUARIOS'); let codigo = String(o.usuario || '').trim().toUpperCase().replace(/\s+/g, '');
    const ex = codigo ? us.find(u => u.usuario === codigo) : null;
    if (!ex) { if (!codigo) codigo = nombre.split(/\s+/).pop().toUpperCase().replace(/[^A-ZÑÁÉÍÓÚ0-9]/g, '');
      if (!codigo) throw new Error('Indica un código para el usuario.');
      if (us.some(u => u.usuario === codigo)) throw new Error('Ya existe un usuario con el código ' + codigo + '. Escribe otro.'); }
    if (rut && us.some(u => u.usuario !== codigo && rutNorm_(u.rut) === rutNorm_(rut))) throw new Error('Ese RUT ya está asignado a otra persona.');
    if (correo && us.some(u => u.usuario !== codigo && String(u.correo || '').toLowerCase() === correo)) throw new Error('Ese correo ya está asignado a otra persona.');
    const activo = o.activo === false || String(o.activo).toUpperCase() === 'FALSE' ? false : true;
    if (ex && ex.usuario === yo.usuario && (rol !== 'ADMIN' || !activo)) throw new Error('No puedes quitarte a ti mismo el rol de administrador ni desactivarte.');
    if (ex && ex.rol === 'ADMIN' && (rol !== 'ADMIN' || !activo) && !us.some(u => u.usuario !== ex.usuario && u.rol === 'ADMIN' && activo_(u))) throw new Error('Debe quedar al menos un administrador activo.');
    const fila = Object.assign({}, ex || { usuario: codigo, pin: '', clave_hash: '', sal: '', cambiar_clave: 'TRUE', intentos: 0, bloqueado_hasta: '' },
      { nombre, rol, rut: rut ? rutFmt_(rut) : '', correo, terminales: rol === 'VENDEDOR' ? String(o.terminales || '').trim() : (ex ? ex.terminales : ''), activo,
        emite_antes: rol === 'VENDEDOR' && (o.emiteAntes === true || String(o.emiteAntes).toUpperCase() === 'TRUE') ? 'TRUE' : '' });
    let temporal = '';
    if (ex) { updateRow_('USUARIOS', ex._row, fila); if (!activo) cerrarSesionesDe_(ex.usuario); }
    else { append_('USUARIOS', [fila]); }
    if (!ex || !fila.clave_hash) { temporal = claveTemporal_(); aplicarClave_(fila.usuario, temporal, true); }
    return { usuario: fila.usuario, temporal };
  });
}
function restablecerClave(token, usuario) {
  auth_(token, ['ADMIN']);
  const u = read_('USUARIOS').find(x => x.usuario === usuario); if (!u) throw new Error('Usuario no encontrado.');
  const t = claveTemporal_(); fijarClave_(usuario, t, true);
  return { usuario, nombre: u.nombre, temporal: t };
}

function vendedores_() {
  return read_('USUARIOS').filter(u => u.rol === 'VENDEDOR' && String(u.activo).toUpperCase() !== 'FALSE');
}

function catalogo(token) {
  auth_(token);
  return {
    hoy: hoy_(),
    productos: read_('PRODUCTOS').filter(p => String(p.activo).toUpperCase() !== 'FALSE' && p.seccion !== 'CAMARA')
      .sort((a, b) => (a.orden || 999) - (b.orden || 999))
      .map(p => ({ codigo: codeKey_(p.codigo), nombre: p.nombre, categoria: p.categoria, unidad: p.unidad, precio: num_(p.precio) })),
    vendedores: vendedores_().map(v => ({ usuario: v.usuario, nombre: v.nombre, terminales: v.terminales, emiteAntes: esSi_(v.emite_antes) })),
    formas: FORMAS_APP, bancos: BANCOS, bancosCheque: BANCOS_CHEQUE
  };
}

function estadoDia_(fecha) {
  const r = read_('RENDICIONES').find(x => x.fecha === fecha);
  return r ? r.estado : 'ABIERTA';
}
function assertAbierta_(fecha) {
  if (estadoDia_(fecha) === 'CERRADA') throw new Error('La rendición del ' + fecha + ' ya está cerrada. Pide a un administrador que la reabra.');
}

/* ============================ BODEGA ============================ */

function getDespacho(token, fecha, vendedor) {
  auth_(token, ['BODEGA','RENDICION','SUPERVISOR']);
  cargarDia_(fecha, ['VENTAS_DETALLE', 'DESPACHO']);
  const det = byFecha_('VENTAS_DETALLE', fecha).filter(r => r.vendedor === vendedor);
  const facturado = {}, guias = {};
  det.forEach(r => {
    const c = codeKey_(r.codigo);
    if (esGuiaFlag_(r.es_guia)) { (guias[r.folio] = guias[r.folio] || {})[c] = ((guias[r.folio] || {})[c] || 0) + num_(r.cantidad); }
    else facturado[c] = (facturado[c] || 0) + num_(r.cantidad);
  });
  return {
    filas: byFecha_('DESPACHO', fecha).filter(r => r.vendedor === vendedor)
      .map(r => ({ codigo: codeKey_(r.codigo), salida: r.salida, retorno: r.retorno, obs: r.obs })),
    facturado, hayDetalle: det.length > 0,
    guias: Object.keys(guias).map(f => ({ folio: f, lineas: guias[f] }))
  };
}
function esSi_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function esGuiaFlag_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }

function saveDespacho(token, fecha, vendedor, filas) {
  const u = auth_(token, ['BODEGA','RENDICION','SUPERVISOR']);
  assertAbierta_(fecha);
  return withLock_(() => {
    const prods = {}; read_('PRODUCTOS').forEach(p => prods[codeKey_(p.codigo)] = p);
    const exist = byFecha_('DESPACHO', fecha).filter(r => r.vendedor === vendedor);
    const map = {}; exist.forEach(r => map[codeKey_(r.codigo)] = r);
    const nuevos = [];
    filas.forEach(f => {
      const salida = f.salida === '' ? '' : num_(f.salida);
      const retorno = f.retorno === '' ? '' : num_(f.retorno);
      const e = map[f.codigo];
      if (e) {
        if (salida === '' && retorno === '') return;
        Object.assign(e, { salida, retorno, obs: f.obs || '', actualizado_por: u.usuario, actualizado: now_() });
        updateRow_('DESPACHO', e._row, e);
      } else if (salida !== '' || retorno !== '') {
        const p = prods[f.codigo] || {};
        nuevos.push({ id: uid_(), fecha, vendedor, codigo: f.codigo, producto: p.nombre, unidad: p.unidad,
          salida, retorno, obs: f.obs || '', actualizado_por: u.usuario, actualizado: now_() });
      }
    });
    append_('DESPACHO', nuevos);
    return true;
  });
}

/* ============================ IMPORTAR DTE ============================ */

/**
 * filas: arreglo de objetos con los encabezados del export de Mi DTE:
 * RUT, Documento, Folio, Fecha, Total, Condicion, Nombre Cliente, Emitido en
 */
function importarDTE(token, filas) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return withLock_(() => {
    asegurarSupermercados_(); asignarSupermercadosAntiguos_();
    const term = mapaTerminales_();
    const existentes = {}; read_('DOCUMENTOS').forEach(d => existentes[d.folio_key] = d);
    const nuevos = []; let guias = 0, repetidos = 0, sinVendedor = 0, corregidos = 0; const fechas = {}, sinTerminal = {}, porVendedor = {};
    filas.forEach(f => {
      const tipo = String(f.Documento || '').trim();
      const folio = String(f.Folio || '').trim();
      if (!tipo || !folio) return;
      if (esGuia_(tipo)) { guias++; return; }         // guías de despacho internas: no son venta
      const key = folioKey_(tipo, folio);
      if (existentes[key]) {
        // ya estaba: si todavía no lo detallan y ahora viene con otra fecha (p. ej. folios emitidos el día antes), se corrige la fecha
        const ex = existentes[key], nf = normFecha_(f.Fecha);
        if (ex !== true && !/nota de cr/i.test(tipo) && ex.estado !== 'DETALLADO' && nf && ex.fecha !== nf) { ex.fecha = nf; updateRow_('DOCUMENTOS', ex._row, ex); corregidos++; fechas[nf] = true; }
        else repetidos++;
        return;
      }
      const terminal = String(f['Emitido en'] || '').trim().toUpperCase();
      const vendedor = term[terminal] || '';
      if (!vendedor) { sinVendedor++; sinTerminal[terminal] = true; }
      const fecha = normFecha_(f.Fecha);
      fechas[fecha] = true;
      const cond = String(f.Condicion || '').trim();
      nuevos.push({ folio_key: key, fecha, tipo, folio, rut: String(f.RUT || f['Datos RUT'] || '').trim(),
        cliente: String(f['Nombre Cliente'] || '').trim(), total: num_(f.Total), condicion_dte: cond,
        terminal, vendedor, estado: 'PENDIENTE', importado: now_() });
      existentes[key] = true; porVendedor[vendedor] = (porVendedor[vendedor] || 0) + 1;
    });
    append_('DOCUMENTOS', nuevos);
    actualizarClientes_(nuevos);
    return { importados: nuevos.length, corregidos, guias, repetidos, sinVendedor, porVendedor, terminalesSinAsignar: Object.keys(sinTerminal), fechas: Object.keys(fechas).sort() };
  });
}

function asignarVendedor(token, folio_key, vendedor) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return withLock_(() => {
    const d = read_('DOCUMENTOS').find(x => x.folio_key === folio_key);
    if (!d) throw new Error('Documento no encontrado');
    d.vendedor = vendedor; updateRow_('DOCUMENTOS', d._row, d); return true;
  });
}

/* ============================ INFORMES ORDENADOS EN EL DRIVE ============================ */

function carpetaInformes_(fecha, tipo) {
  let base;
  if (CFG.INFORMES_FOLDER_ID) base = DriveApp.getFolderById(CFG.INFORMES_FOLDER_ID);
  else {
    let padre;
    try { padre = DriveApp.getFolderById(CFG.RENDICIONES_FOLDER_ID); }
    catch (e) { padre = DriveApp.getRootFolder(); }
    base = sub_(padre, 'Informes Mi DTE');
  }
  const f = String(fecha).split('-');
  // Ventas (folios) y kilos van en carpetas distintas: Informes Mi DTE / Ventas Diarias / año / mes  y  Informes Mi DTE / Informe de ventas (kilos) / año / mes
  return sub_(sub_(sub_(base, tipo === 'dte' ? 'Ventas Diarias' : 'Informe de ventas (kilos)'), f[0]), f[1]);
}
/** a: {nombre, fecha 'YYYY-MM-DD', data(base64 de un .xlsx)}. Si ya hay un archivo con ese nombre se reemplaza (la versión de la tarde incluye la de la mañana). */
function guardarInformeOrdenado(token, a) {
  const u = auth_(token, ['RENDICION','SUPERVISOR']);
  if (!a || !a.data) throw new Error('El archivo llegó vacío.');
  if (!/^(Ventas Diarias|Informe de ventas) \d{1,2}-\d{1,2}-\d{4}\.xlsx$/.test(String(a.nombre))) throw new Error('Nombre de archivo no válido.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.fecha))) throw new Error('Fecha no válida.');
  const bytes = Utilities.base64Decode(a.data);
  if (bytes.length > 10 * 1024 * 1024) throw new Error('El archivo pesa más de 10 MB.');
  const carpeta = carpetaInformes_(a.fecha, /^Ventas Diarias/.test(String(a.nombre)) ? 'dte' : 'detalle');
  let reemplazado = false; const prev = carpeta.getFilesByName(a.nombre);
  while (prev.hasNext()) { prev.next().setTrashed(true); reemplazado = true; }
  const file = carpeta.createFile(Utilities.newBlob(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', a.nombre));
  file.setDescription('Ordenado automáticamente por ' + u.usuario + ' el ' + now_() + ' desde Rendiciones Naranjo');
  return { url: file.getUrl(), nombre: a.nombre, reemplazado };
}

/* ============================ IMPORTAR DETALLE POR PRODUCTO ============================ */

/**
 * "Informe de ventas" de Mi DTE (una fila por producto de cada documento). Columnas:
 * Codigo, Descripcion, Cantidad, Precio, Nombre (tipo doc), Folio, Razon social, Pago, Equipo, Fecha, TOTAL, NETO, PRODUCTOS
 * Las guías de despacho se guardan marcadas (es_guia) porque son la carga que sale con el vendedor.
 */
function importarDetalle(token, filas) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return withLock_(() => {
    asegurarSupermercados_();
    const term = mapaTerminales_();
    const yaHay = {}; read_('VENTAS_DETALLE').forEach(r => { (yaHay[r.folio_key] = yaHay[r.folio_key] || []).push(r); });
    const docsEx = {}; read_('DOCUMENTOS').forEach(d => docsEx[d.folio_key] = d);
    let corregidas = 0; const movidos = {};
    const prods = read_('PRODUCTOS');
    const porCodigo = {}, porNombre = {};
    prods.forEach(p => { porCodigo[codeKey_(p.codigo)] = p; porNombre[normTxt_(p.nombre)] = p; });
    const nuevos = [], nuevosProd = {}, fechas = {}, sinTerminal = {};
    let lineas = 0, guias = 0, omitidas = 0;
    const contador = {};
    filas.forEach(f => {
      const tipo = String(f.Nombre || '').trim(), folio = String(f.Folio || '').trim();
      const desc = String(f.Descripcion || '').trim();
      if (!tipo || !folio || !desc) return;
      const fk = folioKey_(tipo, folio);
      if (yaHay[fk]) {                                    // ese documento ya se importó antes
        const nf = normFecha_(f.Fecha), de = docsEx[fk];
        if (!movidos[fk] && nf && !/nota de cr/i.test(tipo) && (de ? de.estado !== 'DETALLADO' : true) && yaHay[fk].some(r => String(r.fecha) !== nf)) {   // misma corrección de fecha del día antes
          movidos[fk] = true; yaHay[fk].forEach(r => { r.fecha = nf; updateRow_('VENTAS_DETALLE', r._row, r); }); corregidas++; fechas[nf] = true;
        }
        omitidas++; return;
      }
      let codigo = codeKey_(f.Codigo);
      let p = porCodigo[codigo];
      if (!p) {
        const pn = porNombre[normTxt_(desc)];
        if (pn && String(pn.codigo).charAt(0) === '?') {  // completar el código de Mi DTE que faltaba
          delete porCodigo[codeKey_(pn.codigo)]; pn.codigo = codigo; porCodigo[codigo] = pn;
          updateRow_('PRODUCTOS', pn._row, pn);
          p = pn;
        } else if (!nuevosProd[codigo]) {
          nuevosProd[codigo] = { codigo, nombre: desc, categoria: 'REVISAR', unidad: 'KG', precio: num_(f.Precio), orden: 999, activo: false };
        }
      }
      const terminal = String(f.Equipo || '').trim().toUpperCase();
      const vendedor = term[terminal] || '';
      if (!vendedor && !esGuia_(tipo)) sinTerminal[terminal] = true;
      const fecha = normFecha_(f.Fecha); fechas[fecha] = true;
      contador[fk] = (contador[fk] || 0) + 1;
      const g = esGuia_(tipo); g ? guias++ : lineas++;
      nuevos.push({ linea_key: fk + '#' + contador[fk], fecha, folio_key: fk, tipo, folio, codigo,
        producto: p ? p.nombre : desc, cantidad: num_(f.Cantidad), precio: num_(f.Precio), total: Math.round(num_(f.TOTAL)),
        neto: Math.round(num_(f.NETO)), terminal, vendedor, categoria: String(f.PRODUCTOS || '').trim(),
        pago: String(f.Pago || '').trim(), es_guia: g, importado: now_() });
    });
    append_('VENTAS_DETALLE', nuevos);
    const np = Object.keys(nuevosProd).map(k => nuevosProd[k]);
    append_('PRODUCTOS', np);
    return { lineas, guias, omitidas, corregidas, productosNuevos: np.map(p => p.nombre), terminalesSinAsignar: Object.keys(sinTerminal),
      fechas: Object.keys(fechas).sort() };
  });
}

/* ============================ TERMINALES DE MI DTE ============================ */

/** Terminales de Mi DTE con la cantidad de documentos de los días indicados (fechas ISO; por cada día, aparte). Sin fechas cuenta todo el historial. */
function listarTerminales(token, fechas) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  const fs = (Array.isArray(fechas) ? fechas : []).map(String).filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f)).slice(0, 7);
  const term = mapaTerminales_(), vistos = {}, porFecha = {};
  const sumar = (t, f, n) => { vistos[t] = (vistos[t] || 0) + n; if (f) { porFecha[t] = porFecha[t] || {}; porFecha[t][f] = (porFecha[t][f] || 0) + n; } };
  read_('DOCUMENTOS').forEach(d => { if (!d.terminal) return; if (!fs.length) sumar(d.terminal, '', 1); else if (fs.indexOf(d.fecha) >= 0) sumar(d.terminal, d.fecha, 1); else if (vistos[d.terminal] === undefined) vistos[d.terminal] = 0; });
  read_('VENTAS_DETALLE').forEach(d => { if (d.terminal && vistos[d.terminal] === undefined) vistos[d.terminal] = 0; });
  Object.keys(term).forEach(t => { if (vistos[t] === undefined) vistos[t] = 0; });
  return Object.keys(vistos).sort().map(t => ({ terminal: t, vendedor: term[t] || '', documentos: vistos[t], porFecha: porFecha[t] || {} }));
}

/** Asigna (o quita, con vendedor vacío) un terminal a un vendedor, y reasigna los documentos abiertos de ese terminal. */
function asignarTerminal(token, terminal, vendedor) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  terminal = String(terminal).trim().toUpperCase();
  return withLock_(() => {
    read_('USUARIOS').forEach(u => {
      const lista = String(u.terminales || '').split(',').map(x => x.trim().toUpperCase()).filter(String);
      const tiene = lista.indexOf(terminal) >= 0;
      if (u.usuario === vendedor && !tiene) lista.push(terminal);
      else if (u.usuario !== vendedor && tiene) lista.splice(lista.indexOf(terminal), 1);
      else return;
      u.terminales = lista.join(','); updateRow_('USUARIOS', u._row, u);
    });
    const cerradas = {}; read_('RENDICIONES').filter(r => r.estado === 'CERRADA').forEach(r => cerradas[r.fecha] = true);
    let n = 0;
    ['DOCUMENTOS', 'VENTAS_DETALLE'].forEach(tabla => read_(tabla).forEach(d => {
      if (d.terminal === terminal && !cerradas[d.fecha] && d.vendedor !== vendedor) {
        d.vendedor = vendedor; updateRow_(tabla, d._row, d); if (tabla === 'DOCUMENTOS') n++;
      }
    }));
    return { documentosReasignados: n };
  });
}

/* ============================ VENDEDOR: DETALLE POR FOLIO ============================ */

function docsDelDia_(fecha, vendedor) {
  const pagos = byFecha_('PAGOS', fecha), descs = byFecha_('DESCUENTOS', fecha);
  const nombres = {}; read_('USUARIOS').forEach(u => nombres[u.usuario] = u.nombre);
  return byFecha_('DOCUMENTOS', fecha).filter(d => !vendedor || d.vendedor === vendedor).map(d => {
    const p = pagos.filter(x => x.folio_key === d.folio_key);
    const ds = descs.filter(x => x.folio_key === d.folio_key);
    const descAprob = ds.filter(x => x.estado === 'APROBADO').reduce((a, x) => a + num_(x.monto), 0);
    const pagado = p.reduce((a, x) => a + num_(x.monto), 0);
    return {
      folio_key: d.folio_key, tipo: d.tipo, folio: d.folio, cliente: d.cliente, rut: d.rut, total: num_(d.total),
      condicion_dte: d.condicion_dte, terminal: d.terminal, vendedor: d.vendedor, estado: d.estado,
      pagos: p.map(x => ({ forma: x.forma, banco: x.banco, monto: num_(x.monto), referencia: x.referencia,
        cheque_numero: x.cheque_numero || '', cheque_fecha: x.cheque_fecha || '', cheque_titular: x.cheque_titular || '' })),
      descuentos: ds.map(x => ({ id: x.id, monto: num_(x.monto), motivo: x.motivo, estado: x.estado, autorizado_por: x.autorizado_por })),
      pagado, descAprob, diferencia: num_(d.total) - pagado - descAprob,
      // si lo detalló otra persona (encargada o administración), se muestra para que el vendedor lo sepa
      detalladoPor: p[0] && p[0].registrado_por && p[0].registrado_por !== d.vendedor ? (nombres[p[0].registrado_por] || p[0].registrado_por) : ''
    };
  });
}

function misDocumentos(token, fecha, vendedor) {
  const u = auth_(token);
  const v = u.rol === 'VENDEDOR' ? u.usuario : vendedor;
  cargarDia_(fecha, ['DOCUMENTOS', 'PAGOS', 'DESCUENTOS']);
  return { estadoDia: estadoDia_(fecha), docs: docsDelDia_(fecha, v) };
}

/** pagos: [{forma, banco, monto, referencia}] — reemplaza el detalle anterior del folio */
function guardarDetalle(token, fecha, folio_key, pagos, descuento, minimo) {
  const u = auth_(token);
  assertAbierta_(fecha);
  return withLock_(() => {
    const d = read_('DOCUMENTOS').find(x => x.folio_key === folio_key);
    if (!d) throw new Error('Documento no encontrado');
    if (u.rol === 'VENDEDOR' && d.vendedor !== u.usuario) throw new Error('Este documento no es tuyo.');
    const limpios = (pagos || []).filter(p => num_(p.monto) > 0).map(p => {
      if (FORMAS.indexOf(p.forma) < 0) throw new Error('Forma de pago inválida: ' + p.forma);
      if ((p.forma === 'TRANSFERENCIA' || p.forma === 'DEP_EFECTIVO') && !p.banco) throw new Error('Indica el banco de la transferencia/depósito.');
      return p.forma === 'CHEQUE' ? Object.assign({}, p, datosCheque_(p)) : p;
    });
    const suma = limpios.reduce((a, p) => a + num_(p.monto), 0);
    const descMonto = descuento ? num_(descuento.monto) : 0;
    const prevDesc = read_('DESCUENTOS').filter(x => x.folio_key === folio_key);
    const aprobado = prevDesc.find(x => x.estado === 'APROBADO');
    const descVigente = descMonto || (aprobado ? num_(aprobado.monto) : 0);
    if (Math.round(suma + descVigente) !== Math.round(num_(d.total)))
      throw new Error('La suma (' + (suma + descVigente) + ') no cuadra con el total del documento (' + num_(d.total) + ').');

    deleteRows_('PAGOS', read_('PAGOS').filter(x => x.folio_key === folio_key).map(x => x._row));
    append_('PAGOS', limpios.map(p => ({ id: uid_(), folio_key, fecha: d.fecha, vendedor: d.vendedor, forma: p.forma,
      banco: p.banco || '', monto: num_(p.monto), referencia: p.referencia || '', registrado_por: u.usuario, registrado: now_(),
      cheque_numero: p.cheque_numero || '', cheque_fecha: p.cheque_fecha || '', cheque_titular: p.cheque_titular || '' })));

    // Descuentos: se reemplaza la solicitud pendiente; uno ya autorizado por el mismo monto se mantiene
    deleteRows_('DESCUENTOS', read_('DESCUENTOS').filter(x => x.folio_key === folio_key && x.estado === 'PENDIENTE').map(x => x._row));
    if (descMonto > 0 && !(aprobado && num_(aprobado.monto) === descMonto)) {
      append_('DESCUENTOS', [{ id: uid_(), folio_key, fecha: d.fecha, vendedor: d.vendedor, cliente: d.cliente,
        monto: descMonto, motivo: descuento.motivo || '', estado: 'PENDIENTE', solicitado_por: u.usuario, autorizado_por: '', resuelto: '' }]);
    }
    d.estado = 'DETALLADO'; updateRow_('DOCUMENTOS', d._row, d);
    if (minimo) return { folio_key, estado: 'DETALLADO' };      // el detalle rápido ya muestra el resultado: no se vuelve a leer todo el día
    return docsDelDia_(d.fecha, d.vendedor).find(x => x.folio_key === folio_key);
  });
}

/**
 * Detalla varios folios de una vez, cada uno pagado completo con una sola forma.
 * items: [{folio_key, forma, banco}] — se usa para "marcar el resto" (efectivo / crédito según Mi DTE).
 * Solo toma folios sin detallar y sin descuento pendiente; los demás se saltan.
 */
function guardarVarios(token, fecha, items) {
  const u = auth_(token);
  assertAbierta_(fecha);
  return withLock_(() => {
    const docs = {}; read_('DOCUMENTOS').forEach(d => { if (d.fecha === fecha) docs[d.folio_key] = d; });
    const descs = byFecha_('DESCUENTOS', fecha);
    const ok = [], saltados = [];
    (items || []).forEach(it => {
      const d = docs[it.folio_key];
      if (!d || (u.rol === 'VENDEDOR' && d.vendedor !== u.usuario)) return saltados.push(it.folio_key);
      if (FORMAS.indexOf(it.forma) < 0) throw new Error('Forma de pago inválida: ' + it.forma);
      if ((it.forma === 'TRANSFERENCIA' || it.forma === 'DEP_EFECTIVO') && !it.banco) throw new Error('Falta el banco de la transferencia.');
      const ds = descs.filter(x => x.folio_key === d.folio_key);
      if (d.estado === 'DETALLADO' || ds.some(x => x.estado === 'PENDIENTE')) return saltados.push(it.folio_key);
      const aprob = ds.filter(x => x.estado === 'APROBADO').reduce((a, x) => a + num_(x.monto), 0);
      ok.push({ d, forma: it.forma, banco: it.banco || '', monto: num_(d.total) - aprob, ch: it.forma === 'CHEQUE' ? datosCheque_(it) : {} });
    });
    const keys = {}; ok.forEach(x => keys[x.d.folio_key] = 1);
    deleteRows_('PAGOS', read_('PAGOS').filter(x => keys[x.folio_key]).map(x => x._row));
    append_('PAGOS', ok.filter(x => x.monto > 0).map(x => ({ id: uid_(), folio_key: x.d.folio_key, fecha: x.d.fecha, vendedor: x.d.vendedor, forma: x.forma,
      banco: x.banco, monto: x.monto, referencia: x.ch.referencia || '', registrado_por: u.usuario, registrado: now_(),
      cheque_numero: x.ch.cheque_numero || '', cheque_fecha: x.ch.cheque_fecha || '', cheque_titular: x.ch.cheque_titular || '' })));
    // el estado se escribe en una sola operación sobre la columna
    if (ok.length) {
      const sh = sh_('DOCUMENTOS'), col = SCHEMA.DOCUMENTOS.indexOf('estado') + 1;
      const rng = sh.getRange(2, col, sh.getLastRow() - 1, 1), vals = rng.getValues();
      ok.forEach(x => vals[x.d._row - 2][0] = 'DETALLADO');
      rng.setValues(vals); limpiarCache_('DOCUMENTOS');
    }
    return { guardados: ok.length, saltados: saltados.length, docs: docsDelDia_(fecha, u.rol === 'VENDEDOR' ? u.usuario : '') };
  });
}

/* ============================ DESCUENTOS (AUTORIZACIÓN) ============================ */

function descuentosPendientes(token) {
  auth_(token, ROLES_AUTORIZAN);
  return read_('DESCUENTOS').filter(x => x.estado === 'PENDIENTE').map(x => {
    delete x._row; x.monto = num_(x.monto); return x;
  });
}

function resolverDescuento(token, id, aprobar) {
  const u = auth_(token, ROLES_AUTORIZAN);
  return withLock_(() => {
    const x = read_('DESCUENTOS').find(r => r.id === id);
    if (!x) throw new Error('Descuento no encontrado');
    assertAbierta_(x.fecha);
    x.estado = aprobar ? 'APROBADO' : 'RECHAZADO'; x.autorizado_por = u.usuario; x.resuelto = now_();
    updateRow_('DESCUENTOS', x._row, x);
    if (!aprobar) { // el folio vuelve a quedar pendiente para que el vendedor corrija
      const d = read_('DOCUMENTOS').find(r => r.folio_key === x.folio_key);
      if (d) { d.estado = 'PENDIENTE'; updateRow_('DOCUMENTOS', d._row, d); }
    }
    return true;
  });
}

/* ============================ MOVIMIENTOS SIMPLES ============================ */

const MOV_ROLES = {
  COBRANZA: ['VENDEDOR','RENDICION','SUPERVISOR'],
  PROVEEDORES: ['RENDICION','SUPERVISOR'],
  CONSUMO: ['RENDICION','SUPERVISOR'],
  GASTOS: ['VENDEDOR','RENDICION','SUPERVISOR']
};

function listarMov(token, tabla, fecha) {
  const u = auth_(token, MOV_ROLES[tabla]);
  let rows = byFecha_(tabla, fecha);
  if (u.rol === 'VENDEDOR') rows = rows.filter(r => r.registrado_por === u.usuario);
  return rows.map(r => { delete r._row; if (r.monto !== undefined) r.monto = num_(r.monto); r.adjuntos = adjuntosDe_(r); return r; });
}

function guardarMov(token, tabla, fecha, obj) {
  const u = auth_(token, MOV_ROLES[tabla]);
  assertAbierta_(fecha);
  if (num_(obj.monto) <= 0) throw new Error('Ingresa un monto mayor a cero.');
  return withLock_(() => {
    const o = Object.assign({}, obj, { id: uid_(), fecha, monto: num_(obj.monto), registrado_por: u.usuario, registrado: now_() });
    if (tabla === 'COBRANZA') { o.folio = String(o.folio || '').replace(/[^0-9]/g, ''); if (!o.folio) throw new Error('Falta el folio de la factura que paga. Es obligatorio.'); }
    if (tabla === 'COBRANZA' && o.forma === 'CHEQUE') Object.assign(o, datosCheque_(o));
    if (tabla === 'COBRANZA' && u.rol === 'VENDEDOR') o.vendedor = u.usuario;
    if (tabla === 'GASTOS' && u.rol === 'VENDEDOR') o.responsable = u.usuario;
    append_(tabla, [o]); return o;
  });
}

function borrarMov(token, tabla, id) {
  const u = auth_(token, MOV_ROLES[tabla]);
  return withLock_(() => {
    const r = read_(tabla).find(x => x.id === id);
    if (!r) return true;
    assertAbierta_(r.fecha);
    if (u.rol === 'VENDEDOR' && r.registrado_por !== u.usuario) throw new Error('Solo puedes borrar tus registros.');
    deleteRows_(tabla, [r._row]); return true;
  });
}

/* ============================ FOTOS Y ARCHIVOS DE RESPALDO ============================ */
// Drive:  Respaldos / <Persona> / <AAAA-MM> / "2026-09-22 Gasto Combustible $25.000 - Jaime Parada.jpg"
// La carpeta es la de la persona a quien pertenece el registro (no la de quien sube el archivo).

const ADJ_TABLAS = { GASTOS: 'Gasto', COBRANZA: 'Cobranza', PROVEEDORES: 'Proveedor', DEPOSITOS: 'Depósito', DEVOLUCIONES: 'Devolución' };
const ADJ_ROLES = ['VENDEDOR','BODEGA','RENDICION','SUPERVISOR'];
const MAX_ADJ_MB = 15;

function adjuntosDe_(r) {
  return lista_(r.adjuntos).map(id => ({ id, url: 'https://drive.google.com/file/d/' + id + '/view' }));
}
function carpetaRespaldos_() {
  if (CFG.RESPALDOS_FOLDER_ID) return DriveApp.getFolderById(CFG.RESPALDOS_FOLDER_ID);
  let base;
  try { base = DriveApp.getFolderById(CFG.RENDICIONES_FOLDER_ID); }
  catch (e) { base = DriveApp.getRootFolder(); }
  return sub_(base, 'Respaldos');
}
const limpiarNombre_ = t => String(t || '').replace(/[\\/:*?"<>|#\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const pesos_ = n => '$' + Math.round(num_(n)).toLocaleString('es-CL').replace(/,/g, '.');

/** Dueño del registro: define la carpeta y el nombre. */
function duenoAdj_(tabla, r) {
  const nombres = {}; read_('USUARIOS').forEach(u => nombres[u.usuario] = u.nombre);
  if (tabla === 'PROVEEDORES') return { usuario: '', carpeta: 'Proveedores' };
  if (tabla === 'DEVOLUCIONES') return { usuario: '', carpeta: 'Devoluciones' };
  const us = tabla === 'GASTOS' ? r.responsable : r.vendedor;
  if (!us || us === 'GENERAL') return { usuario: '', carpeta: 'General planta' };
  return { usuario: us, carpeta: nombres[us] || us };
}
function nombreAdj_(tabla, r, dueno, n, ext) {
  const detalle = {
    GASTOS: () => r.concepto, COBRANZA: () => r.cliente + (r.folio ? ' folio ' + r.folio : ''),
    PROVEEDORES: () => r.proveedor + (r.folio ? ' ' + (r.documento || 'doc') + ' ' + r.folio : ''),
    DEPOSITOS: () => r.banco + (r.referencia ? ' N°' + r.referencia : ''),
    DEVOLUCIONES: () => String(r.tipo).toLowerCase() + ' NC ' + r.nota_credito + ' ' + r.producto
  }[tabla]();
  const valor = tabla === 'DEVOLUCIONES' ? num_(r.cantidad) + ' ' + String(r.unidad).toLowerCase() : pesos_(r.monto);
  return limpiarNombre_([r.fecha, ADJ_TABLAS[tabla], detalle, valor].filter(String).join(' ') +
    (dueno.usuario ? ' - ' + dueno.carpeta : '') + (n > 1 ? ' (' + n + ')' : '')) + ext;
}

/** a: {tabla, id, nombre, mimeType, data(base64)} */
function subirAdjunto(token, a) {
  const u = auth_(token, ADJ_ROLES);
  if (!ADJ_TABLAS[a.tabla]) throw new Error('No se pueden adjuntar archivos aquí.');
  if (!a.data) throw new Error('El archivo llegó vacío.');
  const bytes = Utilities.base64Decode(a.data);
  if (bytes.length > MAX_ADJ_MB * 1024 * 1024) throw new Error('El archivo pesa más de ' + MAX_ADJ_MB + ' MB.');
  return withLock_(() => {
    const r = read_(a.tabla).find(x => x.id === a.id);
    if (!r) throw new Error('No encontré el registro al que corresponde el archivo.');
    if (u.rol === 'VENDEDOR') {
      const suyo = r.registrado_por === u.usuario || r.vendedor === u.usuario || r.responsable === u.usuario;
      if (!suyo) throw new Error('Solo puedes adjuntar a tus registros.');
      assertAbierta_(r.fecha);
    }
    const dueno = duenoAdj_(a.tabla, r);
    const mes = r.fecha.slice(0, 7);
    const carpeta = sub_(sub_(carpetaRespaldos_(), dueno.carpeta), mes);
    const ext = (String(a.nombre || '').match(/\.[A-Za-z0-9]{2,5}$/) || [/pdf/.test(a.mimeType) ? '.pdf' : '.jpg'])[0].toLowerCase();
    const previos = lista_(r.adjuntos);
    const nombre = nombreAdj_(a.tabla, r, dueno, previos.length + 1, ext);
    const file = carpeta.createFile(Utilities.newBlob(bytes, a.mimeType || 'application/octet-stream', nombre));
    file.setDescription('Subido por ' + u.usuario + ' el ' + now_() + ' desde Rendiciones Naranjo');
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    previos.push(file.getId());
    r.adjuntos = previos.join(','); updateRow_(a.tabla, r._row, r);
    return { id: file.getId(), url: 'https://drive.google.com/file/d/' + file.getId() + '/view', nombre };
  });
}

function borrarAdjunto(token, tabla, id, fileId) {
  const u = auth_(token, ADJ_ROLES);
  return withLock_(() => {
    const r = read_(tabla).find(x => x.id === id);
    if (!r) return true;
    assertAbierta_(r.fecha);
    if (u.rol === 'VENDEDOR' && r.registrado_por !== u.usuario && r.vendedor !== u.usuario && r.responsable !== u.usuario) throw new Error('Solo puedes quitar archivos de tus registros.');
    r.adjuntos = lista_(r.adjuntos).filter(x => x !== fileId).join(','); updateRow_(tabla, r._row, r);
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
    return true;
  });
}

/* ============================ INVENTARIO DE BODEGA ============================ */
// Mismo esquema que la planilla "INVENTARIO SEPTIEMBRE": por día y producto
//   inicial − salidas (vendedores + otros destinos) + ingreso fábrica + retornos = final
// Cámara de carnes: inicial − salida fábrica − salida vendedores + ingreso producto = final
// Movimientos en INVENTARIO_MOV (una fila por fecha|código|tipo|destino):
//   SALDO_INICIAL (stock al comenzar el día), INGRESO, SALIDA (destino), CONTEO (stock físico al cierre del día)
// Salidas y retornos de vendedores se leen de DESPACHO (no se ingresan dos veces).

const SECCIONES_INV = [['TERMINADOS', 'Productos terminados', 'KG'], ['CAMARA', 'Cámara de carnes', 'KG'],
  ['CONGELADOS', 'Congelados y cárnicos', 'UN'], ['LAMINADOS', 'Laminados, quesos y verduras', 'UN']];

// nombre en la planilla de inventario → [sección, nombre del producto de venta (si ya existe)]
const INV_ITEMS = [
  ['TERMINADOS', 'LONGANIZA CORTA', 'LONGANIZA'], ['TERMINADOS', 'LONGANIZA LARGA', 'LONGANIZA LARGA'], ['TERMINADOS', 'PATE CERDO', 'PATE DE CERDO'],
  ['TERMINADOS', 'ARROLLADO C/AJI', 'ARROLLADO C/AJI'], ['TERMINADOS', 'ARROLLADO SIN CUERO', 'ARROLLADO'], ['TERMINADOS', 'Q. CABEZA', 'QUESO DE CABEZA'],
  ['TERMINADOS', 'COSTILLAR', 'COSTILLAR DE CERDO AHUMADO ENV.'], ['TERMINADOS', 'S. CERVEZA', 'SALCHICHON CERVECERO'], ['TERMINADOS', 'M. LISA', 'MORTADELA LISA'],
  ['TERMINADOS', 'M. JAMONADA', 'MORTADELA JAMONADA'], ['TERMINADOS', 'JAMON SANDWICH', 'JAMON SANDWICH'], ['TERMINADOS', 'TAPABARRIGA', ''],
  ['TERMINADOS', 'CHULETA AHUMADA', ''], ['TERMINADOS', 'JAMON ACARAMELADO', ''], ['TERMINADOS', 'JAMON AHUMADO', ''],
  ['TERMINADOS', 'CAZUELA', 'CAZUELA AHUMADA'], ['TERMINADOS', 'ARROLLADO CON CUERO', 'ARROLLADO CON CUERO'],
  ['CAMARA', 'PULPA PALETA'], ['CAMARA', 'GORDURA FILETE'], ['CAMARA', 'PULPA AURORA'], ['CAMARA', 'PULPA SEARA'], ['CAMARA', 'PULPA ECOFRIGO'],
  ['CAMARA', 'PULPA PAMPLONA'], ['CAMARA', 'TOCINO FRIVAR'], ['CAMARA', 'TRUTRO ENTERO POLLO'], ['CAMARA', 'PANA AGROSUPER'], ['CAMARA', 'CUERO'],
  ['CAMARA', 'GORDURA CHICA'], ['CAMARA', 'CHULETA VETADA'], ['CAMARA', 'CAZUELA'], ['CAMARA', 'CARNE LONGA'], ['CAMARA', 'FORRO FRICASA'],
  ['CONGELADOS', 'EMPANADA QUESO 16X600', ''], ['CONGELADOS', 'EMPANADA PINO 16X600', ''], ['CONGELADOS', 'EMPANADA QUESO 14X24', 'EMP QUESO 14X24X25G ESTUCHE'],
  ['CONGELADOS', 'SOPAIPILLA 20X12', 'SOPAIPILLA 20X12X420G'], ['CONGELADOS', 'SOPAIPILLA 20X48', 'SOPAIPILLA 20X48X500G'],
  ['CONGELADOS', 'PASTA CHOCLO 15X1', 'PASTA CHOCLO 1 KILO'], ['CONGELADOS', 'PAPAS FRITAS', 'PAPAS PRE FRITAS 4X2.5KG SUPER CAPITAN'],
  ['CONGELADOS', 'EMPANADA QUESO 3X3', 'EMP MED LUNA QUESO GRANEL 3X3 9KG'], ['CONGELADOS', 'CARNE MOLIDA 10', 'CARNE MOLIDA VACUNO 500G - 10 PORCIENTO'],
  ['CONGELADOS', 'CARNE MOLIDA 5', ''], ['CONGELADOS', 'MECHADA CAMPESTRE', 'CARNE DE VACUNO DESMECHADO CAMESTRE 1KG'],
  ['CONGELADOS', 'MECHADA CERDO BBQ', 'CERDO BBQ DESMECHADA 1KG'],
  ['LAMINADOS', 'P.LAM-JAMONADA 150G'], ['LAMINADOS', 'P.LAM-LISA 150G'], ['LAMINADOS', 'P.LAM-CERVECERO 150G'], ['LAMINADOS', 'P.LAM-ARROLLADO CON AJI 150G'],
  ['LAMINADOS', 'P.LAM-ARROLLADO 150G'], ['LAMINADOS', 'P.LAM-QUESO CABEZA 150G'], ['LAMINADOS', 'GAUDA LAM. 30X400G HUILCO'],
  ['LAMINADOS', 'GAUDA LAM. RIG. 24X500G HUILCO'], ['LAMINADOS', 'GAUDA BAR. 4X3.5KG NOAL CL'], ['LAMINADOS', 'GAUDA LAM. 30X200G HUILCO'],
  ['LAMINADOS', 'MANTECOSO LAM. 24X500G HUILCO'], ['LAMINADOS', 'MANTECOSO LAM. 30X400G HUILCO'], ['LAMINADOS', 'MANTECOSO LAM. 30X200G HUILCO'],
  ['LAMINADOS', 'QUESO CREMA 36X190G HUILCO'], ['LAMINADOS', 'MANTEQUILLA PAN 10X250GR HUILCO'],
  ['LAMINADOS', 'CHOCLO M.V', 'CHOCLO 10X200G M. VERDE'], ['LAMINADOS', 'ARVEJA M.V', 'ARVEJAS 10X200G M. VERDE'], ['LAMINADOS', 'PRIMAVERA M.V', 'PRIMAVERA 10X200G M. VERDE'],
  ['LAMINADOS', 'POROTO VERDE M.V', 'POROTO VERDE 10X150G M. VERDE'], ['LAMINADOS', 'SOFRITO M.V', 'SOFRITO CON AJO 12X150G M. VERDE'],
  ['LAMINADOS', 'CHOCLO TROZITO', 'CHOCLO TROCITO M. VERDE 20X180G']
];
// nombre "suelto" para comparar nombres escritos de distintas formas (P-LAM -ARROLLADO vs P.LAM-ARROLLADO, dobles espacios, etc.)
const claveInv_ = t => normTxt_(t).replace(/[^A-Z0-9]/g, '').replace(/^PILPA/, 'PULPA').replace(/^PULKPA/, 'PULPA');

/** Marca la sección y el nombre de inventario de los productos, y crea los que faltan. Se llama desde setup(). */
function prepararProductosInventario_() {
  const prods = read_('PRODUCTOS');
  const porNombre = {}, porInv = {};
  prods.forEach(p => { porNombre[normTxt_(p.nombre)] = p; if (p.nombre_inv) porInv[p.seccion + '|' + claveInv_(p.nombre_inv)] = p; });
  const nuevos = []; let orden = 1000;
  const usados = {}; prods.forEach(p => usados[codeKey_(p.codigo)] = 1);
  const codigoLibre = base => { let c = base, n = 2; while (usados[codeKey_(c)]) c = base + n++; usados[codeKey_(c)] = 1; return c; };
  INV_ITEMS.forEach(([sec, inv, venta]) => {
    if (porInv[sec + '|' + claveInv_(inv)]) return;
    const p = sec !== 'CAMARA' && venta ? porNombre[normTxt_(venta)] : null;
    if (p && !p.seccion) { p.seccion = sec; p.nombre_inv = inv; updateRow_('PRODUCTOS', p._row, p); return; }
    const unidad = (SECCIONES_INV.find(x => x[0] === sec) || [])[2] || 'UN';
    nuevos.push({ codigo: codigoLibre((sec === 'CAMARA' ? '?CAM-' : '?') + claveInv_(inv).slice(0, 18)), nombre: inv, categoria: sec === 'CAMARA' ? 'MATERIA PRIMA' : sec === 'TERMINADOS' ? 'PROPIOS' : sec,
      unidad, precio: '', orden: orden++, activo: true, seccion: sec, nombre_inv: inv });
  });
  append_('PRODUCTOS', nuevos);
}

function productosInv_() {
  const orden = {}; INV_ITEMS.forEach((x, i) => orden[x[0] + '|' + claveInv_(x[1])] = i);
  return read_('PRODUCTOS').filter(p => p.seccion && String(p.activo).toUpperCase() !== 'FALSE')
    .map(p => ({ codigo: codeKey_(p.codigo), nombre: p.nombre_inv || p.nombre, seccion: p.seccion, unidad: p.unidad,
      orden: orden[p.seccion + '|' + claveInv_(p.nombre_inv || p.nombre)] !== undefined ? orden[p.seccion + '|' + claveInv_(p.nombre_inv || p.nombre)] : 500 + num_(p.orden) }))
    .sort((a, b) => a.orden - b.orden);
}

const r3_ = x => Math.round(x * 1000) / 1000;

/** Calcula el inventario de un día para todos los productos (recorre la historia desde el último saldo o conteo). */
function inventarioDia_(fecha) {
  const prods = productosInv_();
  const vend = vendedores_(), colVend = vend.filter(v => !CFG.DESTINO_DE_VENDEDOR[v.usuario]).map(v => v.usuario);
  const movs = read_('INVENTARIO_MOV').filter(m => m.fecha <= fecha);
  const desp = read_('DESPACHO').filter(d => d.fecha <= fecha);
  // por producto → por fecha
  const dia = {};
  const D = (c, f) => { const k = c + '|' + f; return dia[k] = dia[k] || { saldo: null, ingreso: 0, salVend: {}, retVend: {}, otras: {}, otrasMan: {}, conteo: null }; };
  const fechas = {};
  movs.forEach(m => { const c = codeKey_(m.codigo), x = D(c, m.fecha), q = num_(m.cantidad); fechas[m.fecha] = 1;
    if (m.tipo === 'SALDO_INICIAL') x.saldo = q;
    else if (m.tipo === 'INGRESO') x.ingreso += q;
    else if (m.tipo === 'SALIDA') { x.otras[m.destino] = (x.otras[m.destino] || 0) + q; x.otrasMan[m.destino] = (x.otrasMan[m.destino] || 0) + q; }
    else if (m.tipo === 'CONTEO') x.conteo = q; });
  desp.forEach(d => { const c = codeKey_(d.codigo), x = D(c, d.fecha); fechas[d.fecha] = 1;
    const dest = CFG.DESTINO_DE_VENDEDOR[d.vendedor];
    if (dest) { x.otras[dest] = (x.otras[dest] || 0) + num_(d.salida) - num_(d.retorno); return; }
    x.salVend[d.vendedor] = (x.salVend[d.vendedor] || 0) + num_(d.salida);
    x.retVend[d.vendedor] = (x.retVend[d.vendedor] || 0) + num_(d.retorno); });
  const orden = Object.keys(fechas).filter(f => f < fecha).sort();
  const sum = o => Object.keys(o).reduce((a, k) => a + o[k], 0);
  const cierre = x => { // devuelve [teórico, final] de un día dado su inicial
    return ini => { const t = ini - sum(x.salVend) - sum(x.otras) + x.ingreso + sum(x.retVend); return [t, x.conteo !== null ? x.conteo : t]; };
  };
  const filas = prods.map(p => {
    let stock = 0, conHistoria = false;
    orden.forEach(f => { const x = dia[p.codigo + '|' + f]; if (!x) return;
      conHistoria = true;
      const ini = x.saldo !== null ? x.saldo : stock;
      stock = cierre(x)(ini)[1]; });
    const x = dia[p.codigo + '|' + fecha] || D(p.codigo, fecha);
    const inicial = x.saldo !== null ? x.saldo : stock;
    const [teorico, final] = cierre(x)(inicial);
    return Object.assign({}, p, { inicial: r3_(inicial), inicialManual: x.saldo !== null, conHistoria: conHistoria || x.saldo !== null,
      salVend: x.salVend, retVend: x.retVend, otras: x.otras, otrasManual: x.otrasMan, ingreso: r3_(x.ingreso), conteo: x.conteo,
      teorico: r3_(teorico), final: r3_(final), ajuste: x.conteo !== null ? r3_(x.conteo - teorico) : 0 });
  });
  return { fecha, vendedores: colVend.map(u => ({ usuario: u, nombre: (vend.find(v => v.usuario === u) || {}).nombre || u })),
    destinos: CFG.DESTINOS, distribuidores: CFG.DISTRIBUIDORES, secciones: SECCIONES_INV.map(x => ({ id: x[0], nombre: x[1] })), filas };
}

function getInventario(token, fecha) {
  auth_(token, ['BODEGA','RENDICION','SUPERVISOR']);
  return conCache_('inv|' + fecha, ['INVENTARIO_MOV', 'DESPACHO', 'PRODUCTOS', 'USUARIOS'], () => inventarioDia_(fecha));
}

/**
 * filas: [{codigo, inicial?, ingreso, otras:{destino: cantidad}, conteo}]  — reemplaza lo registrado ese día para esos productos.
 * inicial solo se guarda si viene informado (primer día o corrección del administrador).
 */
function guardarInventario(token, fecha, filas) {
  const u = auth_(token, ['BODEGA','RENDICION','SUPERVISOR']);
  return withLock_(() => {
    const codigos = {}; filas.forEach(f => codigos[codeKey_(f.codigo)] = f);
    const quitar = read_('INVENTARIO_MOV').filter(m => m.fecha === fecha && codigos[codeKey_(m.codigo)] &&
      (m.tipo !== 'SALDO_INICIAL' || codigos[codeKey_(m.codigo)].inicial !== undefined)).map(m => m._row);
    deleteRows_('INVENTARIO_MOV', quitar);
    const nuevos = [], ts = now_();
    const add = (c, tipo, destino, q) => { if (q === '' || q === null || q === undefined || isNaN(num_(q))) return;
      if (tipo !== 'CONTEO' && tipo !== 'SALDO_INICIAL' && num_(q) === 0) return;
      nuevos.push({ key: [fecha, c, tipo, destino].join('|'), fecha, codigo: c, tipo, destino, cantidad: num_(q), obs: '', registrado_por: u.usuario, registrado: ts }); };
    filas.forEach(f => {
      const c = codeKey_(f.codigo);
      if (f.inicial !== undefined && f.inicial !== '') {
        if (u.rol === 'BODEGA' && inventarioDia_(fecha).filas.find(x => x.codigo === c && x.conHistoria && !x.inicialManual))
          throw new Error('El inventario inicial de ' + c + ' viene del día anterior. Si no calza, registra un conteo físico.');
        add(c, 'SALDO_INICIAL', '', f.inicial);
      }
      add(c, 'INGRESO', '', f.ingreso);
      Object.keys(f.otras || {}).forEach(d => add(c, 'SALIDA', normTxt_(d), f.otras[d]));
      add(c, 'CONTEO', '', f.conteo);
    });
    append_('INVENTARIO_MOV', nuevos);
    return inventarioDia_(fecha);
  });
}

function agregarProductoInv(token, p) {
  auth_(token, ['BODEGA','RENDICION','SUPERVISOR']);
  const sec = SECCIONES_INV.find(x => x[0] === p.seccion);
  if (!sec) throw new Error('Sección inválida.');
  const nombre = String(p.nombre || '').trim().toUpperCase();
  if (!nombre) throw new Error('Escribe el nombre del producto.');
  return withLock_(() => {
    const ex = read_('PRODUCTOS').find(x => x.seccion === p.seccion && claveInv_(x.nombre_inv || x.nombre) === claveInv_(nombre));
    if (ex) { ex.activo = true; updateRow_('PRODUCTOS', ex._row, ex); return true; }
    const usados = {}; read_('PRODUCTOS').forEach(x => usados[codeKey_(x.codigo)] = 1);
    let codigo = (p.seccion === 'CAMARA' ? '?CAM-' : '?') + claveInv_(nombre).slice(0, 18), n = 2; const b0 = codigo;
    while (usados[codeKey_(codigo)]) codigo = b0 + n++;
    append_('PRODUCTOS', [{ codigo, nombre, categoria: p.seccion === 'CAMARA' ? 'MATERIA PRIMA' : p.seccion,
      unidad: p.unidad || sec[2], precio: '', orden: 900, activo: true, seccion: p.seccion, nombre_inv: nombre }]);
    return true;
  });
}

/* ---------- planilla mensual de inventario, con el formato actual ---------- */

function carpetaInventario_() {
  if (CFG.INVENTARIO_FOLDER_ID) return DriveApp.getFolderById(CFG.INVENTARIO_FOLDER_ID);
  let base;
  try { base = DriveApp.getFolderById(CFG.RENDICIONES_FOLDER_ID); }
  catch (e) { base = DriveApp.getRootFolder(); }
  return sub_(base, 'Inventario');
}
const MESES_ = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

/** Crea o actualiza la hoja DD-MM del día en "INVENTARIO <MES> <AÑO>". */
function generarPlanillaInventario(token, fecha) {
  auth_(token, ['BODEGA','RENDICION','SUPERVISOR']);
  return withLock_(() => {
    const [a, m, d] = fecha.split('-');
    const nombre = 'INVENTARIO ' + MESES_[Number(m) - 1] + ' ' + a;
    const carpeta = carpetaInventario_();
    const it = carpeta.getFilesByName(nombre);
    let ss;
    if (it.hasNext()) ss = SpreadsheetApp.openById(it.next().getId());
    else { ss = SpreadsheetApp.create(nombre); DriveApp.getFileById(ss.getId()).moveTo(carpeta); }
    const hoja = d + '-' + m;
    const vieja = ss.getSheetByName(hoja);
    // la hoja nueva se inserta en orden de fecha
    const hojas = ss.getSheets().map(h => h.getName()).filter(n => /^\d\d-\d\d$/.test(n) && n !== hoja);
    const pos = hojas.filter(n => n.split('-').reverse().join('') < m + d).length;
    // hoja del día anterior en el mismo archivo: el inicial se enlaza a su final, como en la planilla original
    const previa = hojas.filter(n => n.split('-').reverse().join('') < m + d).sort((x, y) => x.split('-').reverse().join('').localeCompare(y.split('-').reverse().join(''))).pop();
    const enlaces = previa ? mapaFinales_(ss.getSheetByName(previa)) : null;
    if (vieja) ss.deleteSheet(vieja);
    const sh = ss.insertSheet(hoja, pos);
    escribirHojaInventario_(sh, inventarioDia_(fecha), enlaces);
    // si ya existen días posteriores, se enlaza el siguiente a esta hoja (para que una corrección se arrastre)
    const siguiente = hojas.filter(n => n.split('-').reverse().join('') > m + d).sort((x, y) => x.split('-').reverse().join('').localeCompare(y.split('-').reverse().join('')))[0];
    if (siguiente) reenlazarInicial_(ss.getSheetByName(siguiente), mapaFinales_(sh));
    ['Hoja 1', 'Sheet1'].forEach(n => { const x = ss.getSheetByName(n); if (x && ss.getSheets().length > 1) ss.deleteSheet(x); });
    return { url: ss.getUrl() + '#gid=' + sh.getSheetId(), nombre, hoja };
  });
}

/** Lee una hoja de inventario y devuelve {hoja, celdas: {SECCION|clave producto: 'Y12'}} con la celda del final de cada producto. */
function mapaFinales_(sh) {
  const v = sh.getDataRange().getValues(), celdas = {};
  let sec = null, col = -1;
  v.forEach((row, i) => {
    const A = String(row[0] || '').trim().toUpperCase();
    const cabecera = t => row.map(x => String(x).trim().toUpperCase()).indexOf(t);
    if (A === 'PRODUCTOS') { sec = sec === null ? 'TERMINADOS' : sec === 'CAMARA' ? 'CONGELADOS' : 'LAMINADOS'; col = cabecera('INVENTARIO FINAL'); return; }
    if (A === 'CAMARA 1') { sec = 'CAMARA'; col = cabecera('STOCK FINAL'); return; }
    if (!A || !sec || col < 0 || A === 'FECHA' || A.indexOf('INVENTARIO DE') === 0) return;
    celdas[sec + '|' + claveInv_(A)] = colL_(col + 1) + (i + 1);
  });
  return { hoja: sh.getName(), celdas };
}
const refInicial_ = (enl, sec, nombre) => enl && enl.celdas[sec + '|' + claveInv_(nombre)] ? "='" + enl.hoja + "'!" + enl.celdas[sec + '|' + claveInv_(nombre)] : null;

/** Cambia la columna INVENTARIO INICIAL / STOCK INICIAL de una hoja existente para que apunte a la hoja anterior. */
function reenlazarInicial_(sh, enl) {
  const v = sh.getDataRange().getValues();
  let sec = null;
  v.forEach((row, i) => {
    const A = String(row[0] || '').trim().toUpperCase();
    if (A === 'PRODUCTOS') { sec = sec === null ? 'TERMINADOS' : sec === 'CAMARA' ? 'CONGELADOS' : 'LAMINADOS'; return; }
    if (A === 'CAMARA 1') { sec = 'CAMARA'; return; }
    if (!A || !sec || A === 'FECHA' || A.indexOf('INVENTARIO DE') === 0) return;
    const f = refInicial_(enl, sec, A);
    if (f) sh.getRange(i + 1, 2).setFormula(f);
  });
}

function escribirHojaInventario_(sh, inv, enlaces) {
  const rojo = '#FF0000', borde = SpreadsheetApp.BorderStyle.SOLID;
  const vend = inv.vendedores;
  const FIJOS = CFG.DESTINOS.slice(0, 4);
  // otros destinos usados ese día (en el orden de CFG.DESTINOS), supermercado siempre al final
  const usados = {}; inv.filas.filter(f => f.seccion !== 'CAMARA').forEach(f => Object.keys(f.otras).forEach(k => { if (f.otras[k]) usados[k] = 1; }));
  const conocidos = CFG.DESTINOS.concat(CFG.DISTRIBUIDORES);
  const extra = conocidos.filter(x => FIJOS.indexOf(x) < 0 && x !== 'SUPERMERCADO' && usados[x])
    .concat(Object.keys(usados).filter(x => conocidos.indexOf(x) < 0));
  const destinos = FIJOS.concat(extra, ['SUPERMERCADO']);
  const etiqueta = x => x === 'SUPERMERCADO' ? 'SALIDAS SUPERMERCADO' : x;
  const hayAjuste = inv.filas.some(f => f.conteo !== null && f.conteo !== undefined);
  const head = ['PRODUCTOS', 'INVENTARIO INICIAL'].concat(vend.map(v => String(v.nombre).toUpperCase()), destinos.map(etiqueta),
    ['TOTAL SALIDA', 'TOTAL INICIAL - SALIDAS', 'INGRESO FABRICA'], vend.map(v => 'RETORNO ' + String(v.usuario).toUpperCase()),
    ['TOTAL RETORNO'], hayAjuste ? ['AJUSTE CONTEO'] : [], ['INVENTARIO FINAL']);
  const W = head.length, L = colL_;
  const cSal0 = 3, cSal1 = 2 + vend.length + destinos.length, cTot = cSal1 + 1, cDif = cTot + 1, cIng = cDif + 1;
  const cRet0 = cIng + 1, cRet1 = cIng + vend.length, cTotR = cRet1 + 1, cAj = hayAjuste ? cTotR + 1 : 0, cFin = W;
  const g = [], ops = [];
  const fila = v => { const r = (v || []).slice(); while (r.length < W) r.push(''); g.push(r); return g.length; };
  const fechaD = new Date(inv.fecha + 'T12:00:00');
  let r = fila(['FECHA', fechaD]); ops.push([r, 1, 1, 2, x => x.setFontWeight('bold').setFontColor(rojo)]); ops.push([r, 2, 1, 1, x => x.setNumberFormat('dd-mm-yyyy')]);
  fila([]); fila([]);
  const v0 = x => x ? r3_(x) : '';
  const bloque = sec => {
    const filas = inv.filas.filter(f => f.seccion === sec);
    const h = fila(head); ops.push([h, 1, 1, W, x => x.setFontWeight('bold').setHorizontalAlignment('center').setWrap(true).setVerticalAlignment('middle')]);
    filas.forEach(f => {
      const n = g.length + 1;
      const row = [f.nombre, f.inicialManual ? f.inicial : (refInicial_(enlaces, sec, f.nombre) || f.inicial)]
        .concat(vend.map(v => v0(f.salVend[v.usuario])), destinos.map(dd => v0(f.otras[dd])),
          ['=SUM(' + L(cSal0) + n + ':' + L(cSal1) + n + ')', '=B' + n + '-' + L(cTot) + n, v0(f.ingreso)],
          vend.map(v => v0(f.retVend[v.usuario])), ['=SUM(' + L(cRet0) + n + ':' + L(cRet1) + n + ')'],
          hayAjuste ? [f.conteo !== null && f.conteo !== undefined ? f.ajuste : ''] : [],
          ['=' + L(cDif) + n + '+' + L(cIng) + n + '+' + L(cTotR) + n + (hayAjuste ? '+' + L(cAj) + n : '')]);
      fila(row);
    });
    const ini = h + 1, fin = g.length;
    if (fin >= ini) {
      ops.push([ini, 2, fin - ini + 1, W - 1, x => x.setNumberFormat('0.00').setHorizontalAlignment('right')]);
      ops.push([ini, 2, fin - ini + 1, 1, x => x.setFontWeight('bold').setFontColor(rojo)]);
      ops.push([ini, cFin, fin - ini + 1, 1, x => x.setFontWeight('bold').setFontColor(rojo)]);
    }
    ops.push([h, 1, Math.max(fin, h) - h + 1, W, x => x.setBorder(true, true, true, true, true, true, '#000000', borde)]);
    fila([]);
  };
  bloque('TERMINADOS');
  // cámara de carnes
  r = fila(['INVENTARIO DE CARNES', fechaD]); ops.push([r, 1, 1, 2, x => x.setFontWeight('bold').setFontColor(rojo)]); ops.push([r, 2, 1, 1, x => x.setNumberFormat('dd-mm-yyyy')]);
  fila([]);
  const camH = ['CAMARA 1', 'STOCK INICIAL', 'SALIDA FABRICA', 'SALIDA VENDEDORES', 'INGRESO PRODUCTO'].concat(hayAjuste ? ['AJUSTE CONTEO'] : [], ['STOCK FINAL']);
  const hc = fila(camH); ops.push([hc, 1, 1, camH.length, x => x.setFontWeight('bold').setHorizontalAlignment('center').setWrap(true)]);
  inv.filas.filter(f => f.seccion === 'CAMARA').forEach(f => {
    const n = g.length + 1, sf = f.otras.FABRICA || 0, sv = f.otras.VENDEDORES || 0;
    fila([f.nombre, f.inicialManual ? f.inicial : (refInicial_(enlaces, 'CAMARA', f.nombre) || f.inicial), v0(sf), v0(sv), v0(f.ingreso)].concat(hayAjuste ? [f.conteo !== null && f.conteo !== undefined ? f.ajuste : ''] : [],
      ['=B' + n + '-C' + n + '-D' + n + '+E' + n + (hayAjuste ? '+F' + n : '')]));
    ops.push([n, 2, 1, 1, x => x.setFontWeight('bold').setFontColor(rojo)]);
    ops.push([n, camH.length, 1, 1, x => x.setFontWeight('bold').setFontColor(rojo)]);
  });
  ops.push([hc, 1, g.length - hc + 1, camH.length, x => x.setBorder(true, true, true, true, true, true, '#000000', borde)]);
  fila([]);
  bloque('CONGELADOS');
  bloque('LAMINADOS');
  sh.getRange(1, 1, g.length, W).setValues(g);
  sh.getRange(1, 1, g.length, W).setFontFamily('Calibri').setFontSize(11);
  ops.forEach(o => o[4](sh.getRange(o[0], o[1], o[2], o[3])));
  sh.setColumnWidth(1, 150); for (let c = 2; c <= W; c++) sh.setColumnWidth(c, 78);
  sh.setFrozenColumns(1);
}

/**
 * Carga única, desde el editor de Apps Script: toma el INVENTARIO FINAL de una hoja de la planilla actual
 * (ej. "INVENTARIO SEPTIEMBRE", hoja "25-09") y lo deja como inventario inicial del día en que parte la app.
 * Ejemplo: cargarSaldoDesdePlanilla('1oU6LF2pfHlrVIBJmL89XaeBrF1IKXuGZJZyQ0HDb5y0', '25-09', '2026-09-28')
 */
function cargarSaldoDesdePlanilla(idPlanilla, nombreHoja, fechaInicio) {
  prepararProductosInventario_();
  const sh = SpreadsheetApp.openById(idPlanilla).getSheetByName(nombreHoja);
  if (!sh) throw new Error('No existe la hoja ' + nombreHoja);
  const v = sh.getDataRange().getValues();
  const prods = read_('PRODUCTOS');
  const buscar = (sec, nombre) => prods.find(p => p.seccion === sec && claveInv_(p.nombre_inv || p.nombre) === claveInv_(nombre));
  let sec = null, colFin = -1; const saldos = {}, faltan = [];
  // en la planilla hay dos filas "CARNE MOLIDA": la primera es la de 10% y la segunda la de 5%
  const repetidos = { 'CARNE MOLIDA': ['CARNE MOLIDA 10', 'CARNE MOLIDA 5'] }, vistos = {};
  v.forEach(row => {
    const a = String(row[0] || '').trim(), A = a.toUpperCase();
    if (A === 'PRODUCTOS') { sec = sec === null ? 'TERMINADOS' : sec === 'CAMARA' ? 'CONGELADOS' : 'LAMINADOS';
      colFin = row.map(x => String(x).trim().toUpperCase()).indexOf('INVENTARIO FINAL'); return; }
    if (A === 'CAMARA 1') { sec = 'CAMARA'; colFin = row.map(x => String(x).trim().toUpperCase()).indexOf('STOCK FINAL'); return; }
    if (!a || !sec || colFin < 0 || A.indexOf('INVENTARIO DE') === 0 || A === 'FECHA') return;
    let nom = a;
    if (repetidos[A]) { vistos[A] = (vistos[A] || 0) + 1; nom = repetidos[A][Math.min(vistos[A], repetidos[A].length) - 1]; }
    const p = buscar(sec, nom);
    const q = num_(row[colFin]);
    if (!p) { faltan.push(sec + ': ' + a); return; }
    saldos[codeKey_(p.codigo)] = (saldos[codeKey_(p.codigo)] || 0) + q;   // filas repetidas (ej. CARNE MOLIDA) se suman
  });
  deleteRows_('INVENTARIO_MOV', read_('INVENTARIO_MOV').filter(m => m.fecha === fechaInicio && m.tipo === 'SALDO_INICIAL').map(m => m._row));
  append_('INVENTARIO_MOV', Object.keys(saldos).map(c => ({ key: [fechaInicio, c, 'SALDO_INICIAL', ''].join('|'), fecha: fechaInicio, codigo: c,
    tipo: 'SALDO_INICIAL', destino: '', cantidad: r3_(saldos[c]), obs: 'Desde ' + nombreHoja, registrado_por: 'CARGA', registrado: now_() })));
  invalidarTodo_();
  Logger.log('Cargados ' + Object.keys(saldos).length + ' productos. No encontrados: ' + (faltan.join(' | ') || 'ninguno'));
  return { cargados: Object.keys(saldos).length, faltan };
}

/* ============================ SALDOS DE CLIENTES (CRÉDITO) ============================ */
// Deuda por cliente = facturas marcadas CREDITO en la rendición − pagos registrados en COBRANZA.
// Todo pago nuevo lleva folio y se descuenta de esa factura (el folio es obligatorio). Solo los registros antiguos sin folio, o el sobrante, se aplican a las facturas más antiguas del cliente.
// Lo que no se puede asociar a ninguna factura queda como "abono sin factura" del cliente.
function getSaldosClientes(token) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return conCache_('saldos', ['DOCUMENTOS', 'PAGOS', 'COBRANZA', 'USUARIOS', 'CREDITOS_CARGA', 'CLIENTES', 'CHEQUES_ESTADO'], () => saldosClientes_());
}
function saldosClientes_() {
  const docs = {}; read_('DOCUMENTOS').forEach(d => docs[d.folio_key] = d);
  const nombres = {}; vendedores_().forEach(v => nombres[v.usuario] = v.nombre);
  const hoy = hoy_(), dias = f => Math.max(0, Math.round((new Date(hoy + 'T12:00:00') - new Date(String(f) + 'T12:00:00')) / 864e5));
  const clientes = {};
  const clave = (rut, nom) => rut ? 'R' + String(rut).replace(/[^0-9kK]/g, '').toUpperCase() : 'N' + normTxt_(nom);
  const maestro = {}, aliasRut = {};
  read_('CLIENTES').forEach(c => { const k = rutNorm_(c.rut); if (!k) return; maestro[k] = c; lista_p_(c.alias).forEach(a => aliasRut[a] = k); aliasRut[normTxt_(c.razon_social)] = k; });
  const cli = (rut, nom) => { if (!rut) rut = aliasRut[normTxt_(nom)] || '';
    const k = clave(rut, nom), mc = rut ? maestro[rutNorm_(rut)] : null;
    return clientes[k] = clientes[k] || { clave: k, cliente: String((mc && mc.razon_social) || nom || 'SIN NOMBRE').trim(), rut: mc ? mc.rut : (rut ? rutFmt_(rut) : ''),
      condicion: mc ? num_(mc.condicion) : 0, facturas: [], abonos: [], vendedores: {} }; };
  // 1) facturas a crédito
  const cred = {};
  read_('PAGOS').filter(p => p.forma === 'CREDITO').forEach(p => cred[p.folio_key] = (cred[p.folio_key] || 0) + num_(p.monto));
  const porFolio = {};
  Object.keys(cred).forEach(fk => {
    const d = docs[fk]; if (!d || cred[fk] <= 0) return;
    const c = cli(d.rut, d.cliente);
    const f = { folio_key: fk, fecha: d.fecha, tipo: d.tipo, folio: String(d.folio), total: num_(d.total), credito: cred[fk], pagado: 0,
      vendedor: d.vendedor, vendedorNombre: nombres[d.vendedor] || d.vendedor, pagos: [] };
    c.facturas.push(f); c.vendedores[f.vendedorNombre] = 1;
    (porFolio[String(d.folio).trim()] = porFolio[String(d.folio).trim()] || []).push({ c, f });
  });
  // 1b) créditos cargados desde la planilla de control (saldo inicial), salvo los que ya están como crédito en la app
  const porKey = {};
  const vNom = {}; vendedores_().forEach(v => vNom[normTxt_(v.nombre)] = v);
  const chEst = {}; read_('CHEQUES_ESTADO').forEach(e => chEst[e.clave] = String(e.estado));
  read_('CREDITOS_CARGA').forEach(x => {
    if (cred[x.folio_key] > 0 || String(x.estado) === 'PAGADO') return;
    const ce = chEst['P|' + x.folio_key]; if (ce === 'COBRADO') return;            // cheque cobrado: la deuda quedó pagada
    const c = cli(x.rut, x.cliente_excel), v = vNom[normTxt_(x.vendedor)];
    if (x.condicion && !c.condicion) c.condicion = num_(x.condicion);
    const f = { folio_key: x.folio_key, fecha: String(x.fecha), tipo: x.tipo, folio: String(x.folio), total: num_(x.monto), credito: num_(x.monto), pagado: 0,
      vendedor: v ? v.usuario : String(x.vendedor || '').trim(), vendedorNombre: v ? v.nombre : String(x.vendedor || '').trim(), pagos: [], origen: 'CARGA',
      cheque: String(x.estado) === 'CHEQUE' && ce !== 'PROTESTADO', metodo: x.metodo || '', obs: x.obs || '', recepcion: x.recepcion instanceof Date ? normFecha_(x.recepcion) : String(x.recepcion || '') };
    c.facturas.push(f); c.vendedores[f.vendedorNombre] = 1; porKey[x.folio_key] = { c, f };
    (porFolio[String(x.folio).trim()] = porFolio[String(x.folio).trim()] || []).push({ c, f });
  });
  const buscarCliente = nom => {
    const n = normTxt_(nom); if (!n) return null;
    if (aliasRut[n] && clientes['R' + aliasRut[n]]) return clientes['R' + aliasRut[n]];
    const lista = Object.keys(clientes).map(k => clientes[k]);
    return lista.find(c => normTxt_(c.cliente) === n) || lista.find(c => { const m = normTxt_(c.cliente); return m.indexOf(n) >= 0 || n.indexOf(m) >= 0; }) || null;
  };
  const aplicar = (f, monto, pago) => { const q = Math.min(monto, f.credito - f.pagado); if (q <= 0) return 0; f.pagado += q; f.pagos.push({ fecha: pago.fecha, monto: q, forma: pago.forma }); return q; };
  // 2) pagos: primero los que traen folio, después el resto (en orden de fecha)
  const cobros = read_('COBRANZA').map(x => ({ fecha: x.fecha, cliente: x.cliente, folio: String(x.folio || '').replace(/[^0-9]/g, ''), folio_key: x.folio_key || '', monto: num_(x.monto), forma: x.forma }))
    .sort((a, b) => (a.folio ? 0 : 1) - (b.folio ? 0 : 1) || String(a.fecha).localeCompare(String(b.fecha)));
  cobros.forEach(p => {
    let resto = p.monto, c = null;
    if (p.folio_key && porKey[p.folio_key]) { c = porKey[p.folio_key].c; resto -= aplicar(porKey[p.folio_key].f, resto, p); }
    else if (p.folio && porFolio[p.folio]) {
      const cands = porFolio[p.folio];
      const m = cands.find(x => buscarCliente(p.cliente) === x.c && x.f.pagado < x.f.credito) || cands.find(x => x.f.pagado < x.f.credito) || cands[0];
      c = m.c; resto -= aplicar(m.f, resto, p);
    }
    c = c || buscarCliente(p.cliente);
    if (!c) return;                                  // pago de un cliente sin créditos registrados en la app: no afecta saldos
    c.facturas.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).forEach(f => { if (resto > 0) resto -= aplicar(f, resto, p); });
    if (resto > 0.5) c.abonos.push({ fecha: p.fecha, monto: Math.round(resto), forma: p.forma, folio: p.folio });
    c.ultimoPago = !c.ultimoPago || p.fecha > c.ultimoPago ? p.fecha : c.ultimoPago;
  });
  // 3) resumen por cliente
  const lista = Object.keys(clientes).map(k => {
    const c = clientes[k];
    c.facturas.forEach(f => { f.saldo = Math.round(f.credito - f.pagado); f.dias = dias(f.fecha); });
    const pend = c.facturas.filter(f => f.saldo > 0).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const abonos = c.abonos.reduce((a, x) => a + x.monto, 0);
    return { clave: c.clave, cliente: c.cliente, rut: c.rut, condicion: c.condicion || 0, vendedores: Object.keys(c.vendedores),
      deuda: pend.reduce((a, f) => a + f.saldo, 0) - abonos, abonos: c.abonos, pendientes: pend.length, diasMax: pend.length ? pend[0].dias : 0,
      ultimoPago: c.ultimoPago || '', facturas: c.facturas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))) };
  }).sort((a, b) => b.deuda - a.deuda);
  return { hoy, clientes: lista, total: lista.reduce((a, c) => a + Math.max(0, c.deuda), 0), sinRut: lista.filter(c => !c.rut && c.deuda > 0).length };
}

/* ============================ CLIENTES (RUT) Y LISTA DE CRÉDITOS ============================ */
// El RUT es lo que une todo: el nombre que vale es la razón social del DTE (la más reciente por RUT). Los nombres que usa la planilla
// de control de crédito quedan como "alias" del RUT.
const rutNorm_ = r => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();
const rutFmt_ = r => { const n = rutNorm_(r); if (n.length < 2) return n; return n.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + n.slice(-1); };
const lista_p_ = v => String(v || '').split('|').map(x => x.trim()).filter(String);

/** Pone al día la hoja CLIENTES con los documentos del DTE: razón social por RUT. Solo guarda cambios. */
function actualizarClientes_(docs) {
  const nuevos = [], ahora = now_(), cambios = {};
  const ex = {}; read_('CLIENTES').forEach(c => ex[rutNorm_(c.rut)] = c);
  docs.slice().sort((a, b) => String(a.fecha) < String(b.fecha) ? -1 : 1).forEach(d => {
    const k = rutNorm_(d.rut); if (k.length < 7 || !String(d.cliente || '').trim()) return;
    const nom = String(d.cliente).trim(), c = ex[k];
    if (!c) { const o = { rut: rutFmt_(k), razon_social: nom, condicion: '', vendedor: '', alias: '', actualizado: ahora }; nuevos.push(o); ex[k] = o; }
    else if (c.razon_social !== nom) { c.razon_social = nom; c.actualizado = ahora; if (c._row) cambios[c._row] = c; }
  });
  Object.keys(cambios).slice(0, 60).forEach(r => updateRow_('CLIENTES', Number(r), cambios[r]));      // cambios de nombre: pocos; si fueran muchos, se actualizan en la siguiente importación
  if (nuevos.length) append_('CLIENTES', nuevos);
}

const tipoDoc_ = t => /bol/i.test(String(t)) ? 'Boleta Electrónica' : 'Factura Electrónica';

/** Intenta poner RUT a los créditos cargados que no lo tienen: por folio en los documentos del DTE y por nombre (alias / razón social). */
function resolverRut_() {
  const docs = {}; read_('DOCUMENTOS').forEach(d => { if (rutNorm_(d.rut)) docs[d.folio_key] = d; });
  const cl = {}, alias = {};
  read_('CLIENTES').forEach(c => { const k = rutNorm_(c.rut); if (!k) return; cl[k] = c; alias[normTxt_(c.razon_social)] = k; lista_p_(c.alias).forEach(a => alias[a] = k); });
  const nuevosAlias = {}; let n = 0;
  const aprender = (x, k) => { const a = normTxt_(x.cliente_excel);        // el nombre de la planilla queda como alias del RUT
    if (a && alias[a] !== k) { alias[a] = k; (nuevosAlias[k] = nuevosAlias[k] || {})[a] = 1; } };
  read_('CREDITOS_CARGA').forEach(x => {
    if (rutNorm_(x.rut)) { if (cl[rutNorm_(x.rut)]) aprender(x, rutNorm_(x.rut)); return; }
    const d = docs[x.folio_key], porNombre = alias[normTxt_(x.cliente_excel)];
    const k = d ? rutNorm_(d.rut) : porNombre;
    if (!k) return;
    x.rut = rutFmt_(k); updateRow_('CREDITOS_CARGA', x._row, x); n++; aprender(x, k);
  });
  Object.keys(nuevosAlias).forEach(k => { const c = cl[k]; if (!c || !c._row) return;
    c.alias = lista_p_(c.alias).concat(Object.keys(nuevosAlias[k])).filter((v, i, a) => a.indexOf(v) === i).join('|'); updateRow_('CLIENTES', c._row, c); });
  return n;
}

// folios que no son un número ("P", "182-183"): la clave incluye al cliente para no confundir documentos distintos
const claveCredito_ = (tipo, folio, cliente) => folioKey_(tipo, /^\d+$/.test(folio) ? folio : folio + '·' + normTxt_(cliente).slice(0, 24));
/** filas: [{tipo, cliente, condicion, folio, fecha, monto, estado:'CREDITO'|'CHEQUE', vendedor, recepcion, metodo, obs}] (solo los documentos abiertos de la planilla) */
function cargarCreditos(token, filas) {
  const u = auth_(token, ['RENDICION','SUPERVISOR']);
  return withLock_(() => {
    const ex = {}; read_('CREDITOS_CARGA').forEach(x => ex[x.folio_key] = x);
    const docs = {}; read_('DOCUMENTOS').forEach(d => docs[d.folio_key] = d);
    const nuevos = [], vistos = {}; let actualizados = 0, saltados = 0, duplicados = 0;
    (filas || []).forEach(f => {
      const tipo = tipoDoc_(f.tipo), folio = String(f.folio || '').trim(), monto = Math.round(num_(f.monto));
      if (!folio || !(monto > 0)) { saltados++; return; }
      // folios que no son un número ("P", "182-183"): la clave incluye al cliente para no confundir documentos distintos
      const key = claveCredito_(tipo, folio, f.cliente), d = docs[key];
      if (vistos[key]) { duplicados++; return; }          // el mismo documento dos veces en el archivo: vale el primero
      vistos[key] = true;
      const o = { folio_key: key, rut: d && rutNorm_(d.rut) ? rutFmt_(d.rut) : '', cliente_excel: String(f.cliente || '').trim(), tipo, folio, fecha: String(f.fecha || ''),
        monto, condicion: num_(f.condicion) || '', vendedor: String(f.vendedor || '').trim(), estado: f.estado === 'CHEQUE' ? 'CHEQUE' : 'CREDITO',
        recepcion: String(f.recepcion || '').slice(0, 10), metodo: String(f.metodo || ''), obs: String(f.obs || ''), cargado: now_() };
      const p = ex[key];
      if (p) { if (rutNorm_(p.rut)) o.rut = p.rut; if (String(p.estado) === 'PAGADO') return; o.cargado = p.cargado; updateRow_('CREDITOS_CARGA', p._row, o); actualizados++; }
      else { nuevos.push(o); ex[key] = o; }
    });
    if (nuevos.length) append_('CREDITOS_CARGA', nuevos);
    planillaSucia_();
    const resueltos = resolverRut_();
    const todos = read_('CREDITOS_CARGA'), sin = todos.filter(x => !rutNorm_(x.rut) && String(x.estado) !== 'PAGADO');
    return { nuevos: nuevos.length, actualizados, saltados, duplicados, conRut: todos.length - sin.length, sinRut: sin.length, resueltos, sinRutClientes: sinRutClientes_(sin) };
  });
}
function sinRutClientes_(sin) {
  const m = {};
  sin.forEach(x => { const k = normTxt_(x.cliente_excel); const o = m[k] = m[k] || { alias: k, cliente: x.cliente_excel, docs: 0, monto: 0 }; o.docs++; o.monto += num_(x.monto); });
  return Object.keys(m).map(k => m[k]).sort((a, b) => b.monto - a.monto);
}

/** Vincula a mano un nombre de la planilla con un RUT (queda como alias y se aplica a todos sus documentos). */
function vincularRut(token, alias, rut, razon) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  const k = rutNorm_(rut);
  if (k.length < 8) throw new Error('El RUT no parece válido.');
  return withLock_(() => {
    const a = normTxt_(alias); let c = read_('CLIENTES').find(x => rutNorm_(x.rut) === k);
    if (!c) { append_('CLIENTES', [{ rut: rutFmt_(k), razon_social: String(razon || alias).trim(), condicion: '', vendedor: '', alias: a, actualizado: now_() }]); }
    else { c.alias = lista_p_(c.alias).concat([a]).filter((v, i, z) => z.indexOf(v) === i).join('|'); updateRow_('CLIENTES', c._row, c); }
    let n = 0; read_('CREDITOS_CARGA').forEach(x => { if (!rutNorm_(x.rut) && normTxt_(x.cliente_excel) === a) { x.rut = rutFmt_(k); updateRow_('CREDITOS_CARGA', x._row, x); n++; } });
    return { documentos: n };
  });
}
function reintentarRut(token) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return withLock_(() => { const n = resolverRut_(); const sin = read_('CREDITOS_CARGA').filter(x => !rutNorm_(x.rut) && String(x.estado) !== 'PAGADO');
    return { resueltos: n, sinRut: sin.length, sinRutClientes: sinRutClientes_(sin) }; });
}
// Clientes disponibles para vincular (razón social del DTE) — para el buscador de la pantalla
function listaClientesRut_() { return read_('CLIENTES').map(c => ({ rut: c.rut, razon: c.razon_social })); }

/** Lo que hay por cobrar, para la pantalla de Cobranza. El vendedor ve solo sus facturas. */
function porCobrar(token) {
  const u = auth_(token, ['VENDEDOR','RENDICION','SUPERVISOR']);
  const r = conCache_('saldos', ['DOCUMENTOS', 'PAGOS', 'COBRANZA', 'USUARIOS', 'CREDITOS_CARGA', 'CLIENTES', 'CHEQUES_ESTADO'], () => saldosClientes_());
  const out = [];
  r.clientes.forEach(c => {
    const fs = c.facturas.filter(f => f.saldo > 0 && (u.rol !== 'VENDEDOR' || f.vendedor === u.usuario));
    if (!fs.length) return;
    out.push({ clave: c.clave, cliente: c.cliente, rut: c.rut, condicion: c.condicion, deuda: fs.reduce((a, f) => a + f.saldo, 0),
      facturas: fs.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).map(f => ({ folio_key: f.folio_key, tipo: f.tipo, folio: f.folio, fecha: f.fecha, saldo: f.saldo, total: f.credito,
        dias: f.dias, vendedor: f.vendedorNombre, cheque: !!f.cheque, venc: f.fecha && c.condicion ? sumarDias_(f.fecha, c.condicion) : '' })) });
  });
  return { hoy: r.hoy, clientes: out.sort((a, b) => a.cliente.localeCompare(b.cliente)) };
}
function sumarDias_(iso, n) { const d = new Date(String(iso) + 'T12:00:00'); d.setDate(d.getDate() + num_(n)); return Utilities.formatDate(d, 'America/Santiago', 'yyyy-MM-dd'); }

/** Registra un cobro de un cliente repartido entre sus facturas. items: [{folio_key, folio, monto}], pago: {forma, banco, cheque_numero, cheque_fecha, cheque_titular}, cli: {cliente, rut} */
function guardarCobro(token, fecha, cli, pago, items) {
  const u = auth_(token, ['VENDEDOR','RENDICION','SUPERVISOR']);
  assertAbierta_(fecha);
  if (!items || !items.length) throw new Error('Elige al menos una factura.');
  const forma = String(pago.forma || '');
  if (FORMAS.indexOf(forma) < 0 || forma === 'CREDITO' || forma === 'NOTA_CREDITO') throw new Error('Forma de pago no válida.');
  if ((forma === 'TRANSFERENCIA' || forma === 'DEP_EFECTIVO') && BANCOS.indexOf(pago.banco) < 0) throw new Error('Indica el banco.');
  const ch = forma === 'CHEQUE' ? datosCheque_(pago) : {};
  return withLock_(() => {
    const vend = u.rol === 'VENDEDOR' ? u.usuario : String(pago.vendedor || '');
    const filas = items.map(i => { const m = Math.round(num_(i.monto)); if (!(m > 0)) throw new Error('Hay un monto en cero.');
      return Object.assign({ id: uid_(), fecha, vendedor: vend, cliente: String(cli.cliente || '').trim(), folio: String(i.folio || ''), folio_key: String(i.folio_key || ''), rut: String(cli.rut || ''),
        monto: m, forma, banco: forma === 'CHEQUE' ? (pago.banco || '') : (pago.banco || ''), referencia: forma === 'CHEQUE' ? 'Cheque N° ' + (ch.cheque_numero || '') : '',
        registrado_por: u.usuario, registrado: now_() }, ch); });
    append_('COBRANZA', filas); planillaSucia_();
    return { id: filas[0].id, ids: filas.map(f => f.id), total: filas.reduce((a, f) => a + f.monto, 0) };
  });
}

/** Planilla única de cuentas por cobrar: crédito + cheques en cartera, por RUT y con la razón social del DTE. */
function generarPlanillaPorCobrar(token) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return withLock_(() => {
    const r = saldosClientes_(), hoy = r.hoy, ft = hoy.split('-').reverse().join('-');
    const nombre = 'Por cobrar ' + ft;
    const ss = SpreadsheetApp.create(nombre), file = DriveApp.getFileById(ss.getId());
    try {
      const root = DriveApp.getFolderById(CFG.RENDICIONES_FOLDER_ID), dest = sub_(root, 'Cuentas por cobrar');
      const prev = dest.getFilesByName(nombre); while (prev.hasNext()) prev.next().setTrashed(true);
      file.moveTo(dest);
    } catch (e) { /* queda en Mi unidad */ }
    const fx = iso => iso ? String(iso).split('-').reverse().join('-') : '';
    const cls = r.clientes.filter(c => c.deuda > 0 || c.facturas.some(f => f.saldo > 0));
    const pend = c => c.facturas.filter(f => f.saldo > 0);
    // 1) resumen por cliente
    const A = new Hoja_(ss, 'POR CLIENTE', 11); A.titulo('CUENTAS POR COBRAR ' + ft, 'Crédito y cheques en cartera, por RUT · razón social según el DTE · Cecinas Naranjo');
    A.tabla('', [{ h: 'RUT' }, { h: 'RAZÓN SOCIAL (DTE)' }, { h: 'VENDEDOR' }, { h: 'COND. (DÍAS)' }, { h: 'DOCS', sum: 1 }, { h: 'CRÉDITO', t: '$', sum: 1 }, { h: 'EN CHEQUE', t: '$', sum: 1 },
      { h: 'TOTAL', t: '$', sum: 1 }, { h: 'DÍAS MÁX.' }, { h: 'ÚLTIMO PAGO' }, { h: 'AVISO' }],
      cls.map(c => { const p = pend(c), ch = p.filter(f => f.cheque).reduce((a, f) => a + f.saldo, 0), tot = p.reduce((a, f) => a + f.saldo, 0);
        return [c.rut || 'SIN RUT', c.cliente, c.vendedores.join(', '), c.condicion || '', p.length, tot - ch, ch, tot, c.diasMax, fx(c.ultimoPago), c.rut ? '' : 'Falta RUT']; }));
    A.escribir([100, 300, 150, 80, 55, 100, 100, 100, 75, 95, 80]);
    // 2) detalle de documentos
    const B = new Hoja_(ss, 'DETALLE', 12); B.titulo('DETALLE DE DOCUMENTOS POR COBRAR ' + ft);
    const filas = [];
    cls.forEach(c => pend(c).forEach(f => filas.push([c.rut || 'SIN RUT', c.cliente, f.tipo.replace(' Electrónica', ''), Number(f.folio) || f.folio, fx(f.fecha),
      f.fecha && c.condicion ? fx(sumarDias_(f.fecha, c.condicion)) : '', f.dias, f.credito, f.saldo, f.vendedorNombre, f.cheque ? 'Cheque en cartera' : 'Crédito', f.obs || f.metodo || ''])));
    B.tabla('', [{ h: 'RUT' }, { h: 'RAZÓN SOCIAL (DTE)' }, { h: 'DOCUMENTO' }, { h: 'FOLIO' }, { h: 'FECHA' }, { h: 'VENCE' }, { h: 'DÍAS' }, { h: 'MONTO', t: '$', sum: 1 },
      { h: 'SALDO', t: '$', sum: 1 }, { h: 'VENDEDOR' }, { h: 'ESTADO' }, { h: 'OBSERVACIÓN' }], filas);
    B.escribir([100, 300, 80, 75, 85, 85, 55, 95, 95, 130, 120, 200]);
    // 3) cheques en cartera: los de la planilla de control (ya incluidos arriba) y los recibidos desde la app en los últimos 60 días
    const C = new Hoja_(ss, 'CHEQUES EN CARTERA', 10); C.titulo('CHEQUES EN CARTERA ' + ft, 'Cheques que se cobran en el banco: mientras no se cobren siguen siendo crédito');
    const ch = chequesTodos_().filter(x => x.estado === 'CARTERA').sort((p, q) => (p.fechaCheque || p.recibido || '').localeCompare(q.fechaCheque || q.recibido || ''))
      .map(x => [x.rut || 'SIN RUT', x.cliente, x.documento, x.monto, x.numero, x.banco, fx(x.recibido), fx(x.fechaCheque), x.origen, x.fechaCheque ? (x.aFecha ? 'A fecha' : 'Al día') : (x.obs || '')]);
    C.tabla('', [{ h: 'RUT' }, { h: 'RAZÓN SOCIAL (DTE)' }, { h: 'DOCUMENTO' }, { h: 'MONTO', t: '$', sum: 1 }, { h: 'N° CHEQUE' }, { h: 'BANCO' }, { h: 'RECIBIDO' }, { h: 'FECHA CHEQUE' }, { h: 'ORIGEN' }, { h: 'ESTADO' }], ch);
    C.escribir([100, 300, 130, 95, 85, 110, 85, 95, 150, 90]);
    try { ss.deleteSheet(ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1')); } catch (e) {}
    return { url: ss.getUrl(), clientes: cls.length, documentos: filas.length, total: filas.reduce((a, f) => a + f[8], 0) };
  });
}


/* ============================ PLANILLA ÚNICA DE CRÉDITOS ============================ */
// Un solo Google Sheets, siempre el mismo ("Cuentas por cobrar (planilla única)" en la carpeta Cuentas por cobrar). La app lo escribe (pagado y saldo al día)
// y también lo lee: lo que una persona edite en las filas ORIGEN = CARGA (RUT, cliente, fecha, monto, condición, vendedor, estado, observación) o las filas
// nuevas que agregue al final pasan a la app, al editar (disparador onEdit) o al presionar "Actualizar planilla". Las filas ORIGEN = APP son ventas a crédito
// registradas en la app: se ven pero se corrigen en la app.
const PLANILLA_NOMBRE_ = 'Cuentas por cobrar (planilla única)';
const PLANILLA_HOJA_ = 'POR COBRAR';
const PLANILLA_COLS_ = ['CLAVE', 'ORIGEN', 'RUT', 'CLIENTE', 'TIPO', 'FOLIO', 'FECHA (AAAA-MM-DD)', 'MONTO', 'PAGADO', 'SALDO', 'COND. (DÍAS)', 'VENDEDOR', 'ESTADO (CREDITO / CHEQUE / PAGADO)', 'OBSERVACIÓN', 'HUELLA'];
function planillaSucia_() { try { PropertiesService.getScriptProperties().setProperty('PLANILLA_SUCIA', '1'); } catch (e) {} }
function planillaCreditos_() {
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('PLANILLA_CREDITOS_ID');
  if (id) { try { if (!DriveApp.getFileById(id).isTrashed()) return SpreadsheetApp.openById(id); } catch (e) {} }
  const dest = sub_(DriveApp.getFolderById(CFG.RENDICIONES_FOLDER_ID), 'Cuentas por cobrar');
  const it = dest.getFilesByName(PLANILLA_NOMBRE_); let ss;
  if (it.hasNext()) ss = SpreadsheetApp.openById(it.next().getId());
  else { ss = SpreadsheetApp.create(PLANILLA_NOMBRE_); DriveApp.getFileById(ss.getId()).moveTo(dest); }
  props.setProperty('PLANILLA_CREDITOS_ID', ss.getId());
  props.setProperty('PLANILLA_SUCIA', '1');
  try {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'alEditarPlanillaCreditos').forEach(t => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('alEditarPlanillaCreditos').forSpreadsheet(ss).onEdit().create();
  } catch (e) { /* sin permiso para disparadores: queda el botón Actualizar planilla */ }
  return ss;
}
function asegurarDisparadorHorario_() {
  try { if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'planillaCreditosCadaHora')) ScriptApp.newTrigger('planillaCreditosCadaHora').timeBased().everyHours(1).create(); } catch (e) {}
}
const huellaCredito_ = c => Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,
  [String(c[0]).trim(), String(c[1]).trim(), String(c[2]).trim(), Math.round(num_(c[3])), num_(c[4]) || '', String(c[5]).trim(), String(c[6]).trim(), String(c[7]).trim()].join('¦'))).slice(0, 14);
const estadoCredito_ = v => { const s = String(v || '').toUpperCase(); return /PAG/.test(s) ? 'PAGADO' : /CHEQ/.test(s) ? 'CHEQUE' : 'CREDITO'; };

/** Pasa a la app lo que la gente cambió en la planilla. Va dentro de withLock_. */
function importarPlanilla_(ss, escribirMarcas) {
  const sh = ss.getSheetByName(PLANILLA_HOJA_), res = { actualizados: 0, nuevos: 0 };
  if (!sh || sh.getLastRow() < 2) return res;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 15).getValues();
  const ex = {}; read_('CREDITOS_CARGA').forEach(x => ex[x.folio_key] = x);
  const marcas = [], nuevos = [];
  vals.forEach((r, i) => {
    const clave = String(r[0]).trim(), origen = String(r[1]).trim().toUpperCase(), tipo = tipoDoc_(r[4]), folio = String(r[5]).trim();
    const campos = [r[2], r[3], r[6] instanceof Date ? normFecha_(r[6]) : String(r[6]).trim(), r[7], r[10], r[11], estadoCredito_(r[12]), r[13]];
    if (!clave) {
      const monto = Math.round(num_(r[7])), cliente = String(r[3]).trim();
      if (!folio || !(monto > 0) || !cliente) return;                              // fila a medio llenar: se ignora
      const key = claveCredito_(tipo, folio, cliente);
      if (!ex[key]) {
        const o = { folio_key: key, rut: rutValido_(r[2]) ? rutFmt_(r[2]) : '', cliente_excel: cliente, tipo, folio, fecha: campos[2], monto, condicion: num_(r[10]) || '',
          vendedor: String(r[11]).trim(), estado: campos[6] === 'PAGADO' ? 'PAGADO' : campos[6], recepcion: '', metodo: '', obs: String(r[13] || ''), cargado: now_() };
        nuevos.push(o); ex[key] = o; res.nuevos++;
      }
      marcas.push([i + 2, key, huellaCredito_(campos)]);
      return;
    }
    if (origen !== 'CARGA') return;
    const x = ex[clave]; if (!x || x._row === undefined) return;
    const h = huellaCredito_(campos); if (h === String(r[14])) return;               // no la tocaron
    const rut = String(r[2]).trim(), monto = Math.round(num_(r[7]));
    if (!(monto > 0)) return;
    x.rut = !rut ? '' : (rutValido_(rut) ? rutFmt_(rut) : x.rut);
    x.cliente_excel = String(r[3]).trim() || x.cliente_excel; x.fecha = campos[2] || x.fecha; x.monto = monto; x.condicion = num_(r[10]) || '';
    x.vendedor = String(r[11]).trim(); x.estado = campos[6]; x.obs = String(r[13] || '');
    updateRow_('CREDITOS_CARGA', x._row, x); res.actualizados++;
    marcas.push([i + 2, clave, h]);
  });
  if (nuevos.length) append_('CREDITOS_CARGA', nuevos);
  if (res.nuevos || res.actualizados) { resolverRut_(); planillaSucia_(); }
  if (escribirMarcas) marcas.forEach(m => { sh.getRange(m[0], 1).setValue(m[1]); sh.getRange(m[0], 2).setValue('CARGA'); sh.getRange(m[0], 15).setValue(m[2]); });
  return res;
}

/** Escribe en la planilla lo que hay en la app (pagado y saldo al día). Va dentro de withLock_. */
function exportarPlanilla_(ss) {
  const r = saldosClientes_(), porKey = {};
  r.clientes.forEach(c => c.facturas.forEach(f => porKey[f.folio_key] = f));
  const filas = [];
  read_('CREDITOS_CARGA').forEach(x => {
    const f = porKey[x.folio_key], monto = Math.round(num_(x.monto)), pag = f ? f.pagado : monto, sal = f ? f.saldo : 0;
    const campos = [x.rut || '', x.cliente_excel, String(x.fecha instanceof Date ? normFecha_(x.fecha) : x.fecha || ''), monto, num_(x.condicion) || '', x.vendedor || '', estadoCredito_(x.estado), x.obs || ''];
    filas.push([x.folio_key, 'CARGA', campos[0], campos[1], x.tipo, x.folio, campos[2], monto, Math.round(pag), Math.round(sal), campos[4], campos[5], campos[6], campos[7], huellaCredito_(campos)]);
  });
  r.clientes.forEach(c => c.facturas.forEach(f => { if (f.origen === 'CARGA' || !(f.saldo > 0)) return;
    filas.push([f.folio_key, 'APP', c.rut || '', c.cliente, f.tipo, f.folio, f.fecha, Math.round(f.credito), Math.round(f.pagado), f.saldo, c.condicion || '', f.vendedorNombre, 'CREDITO', '', '']); }));
  filas.sort((p, q) => String(p[3]).localeCompare(String(q[3])) || String(p[6]).localeCompare(String(q[6])));
  let sh = ss.getSheetByName(PLANILLA_HOJA_) || ss.insertSheet(PLANILLA_HOJA_, 0);
  sh.clear();
  const n = filas.length, h = Math.max(n + 300, 300);
  if (sh.getMaxRows() < h + 1) sh.insertRowsAfter(sh.getMaxRows(), h + 1 - sh.getMaxRows());
  sh.getRange(1, 1, h, 15).setNumberFormat('@');
  ['H', 'I', 'J', 'K'].forEach(c => sh.getRange(c + '2:' + c + (h + 1)).setNumberFormat(c === 'K' ? '0' : '#,##0'));
  sh.getRange(1, 1, 1, 15).setValues([PLANILLA_COLS_]).setFontWeight('bold').setBackground('#2A1F1A').setFontColor('#ffffff').setWrap(true);
  if (n) {
    sh.getRange(2, 1, n, 15).setValues(filas);
    const grises = ['A', 'B', 'E', 'F', 'I', 'J', 'O'];
    grises.forEach(c => sh.getRange(c + '2:' + c + (n + 1)).setBackground('#EFEDEA'));
    filas.forEach((f, i) => { if (f[1] === 'APP') sh.getRange(i + 2, 1, 1, 15).setBackground('#EFEDEA'); });
  }
  sh.setFrozenRows(1); sh.setFrozenColumns(4);
  [220, 70, 110, 280, 130, 70, 110, 100, 100, 100, 70, 130, 150, 220].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.hideColumns(15); sh.setRowHeight(1, 48);
  sh.getRange('B1').setNote('CARGA: se puede editar y la app lo lee. APP: venta a crédito hecha en la app (gris), se corrige en la app.');
  sh.getRange('G1').setNote('Formato AAAA-MM-DD, por ejemplo 2026-09-30.');
  sh.getRange('I1').setNote('Pagado y saldo los calcula la app con los pagos de Cobranza: no se editan aquí.');
  // pagos registrados desde la app
  let pg = ss.getSheetByName('PAGOS REGISTRADOS') || ss.insertSheet('PAGOS REGISTRADOS');
  pg.clear();
  const nom = {}; vendedores_().forEach(v => nom[v.usuario] = v.nombre);
  const pagos = read_('COBRANZA').sort((p, q) => String(q.fecha).localeCompare(String(p.fecha))).map(x => [String(x.fecha), x.cliente, x.folio, num_(x.monto), x.forma, x.banco || '', x.referencia || '', nom[x.vendedor] || x.vendedor, x.registrado_por]);
  pg.getRange(1, 1, 1, 9).setValues([['FECHA', 'CLIENTE', 'FOLIO', 'MONTO', 'FORMA', 'BANCO', 'REFERENCIA', 'VENDEDOR', 'REGISTRADO POR']]).setFontWeight('bold').setBackground('#2A1F1A').setFontColor('#ffffff');
  if (pagos.length) { pg.getRange(2, 1, pagos.length, 9).setValues(pagos); pg.getRange(2, 4, pagos.length, 1).setNumberFormat('#,##0'); }
  pg.setFrozenRows(1); [90, 280, 70, 100, 120, 120, 160, 130, 110].forEach((w, i) => pg.setColumnWidth(i + 1, w));
  let lm = ss.getSheetByName('LEEME') || ss.insertSheet('LEEME');
  lm.clear();
  lm.getRange(1, 1, 7, 1).setValues([['PLANILLA ÚNICA DE CUENTAS POR COBRAR — Cecinas Naranjo'],
    ['• Es siempre el mismo archivo. La app lo mantiene al día (pagado y saldo).'],
    ['• Puedes corregir las filas ORIGEN = CARGA (RUT, cliente, fecha, monto, condición, vendedor, estado, observación): la app se actualiza sola al editar.'],
    ['• Para agregar un crédito, escribe una fila nueva al final de la hoja POR COBRAR (cliente, tipo, folio, fecha, monto) y deja CLAVE vacía.'],
    ['• Para dar por pagado un documento, pon ESTADO = PAGADO. No borres filas.'],
    ['• Las filas grises no se editan aquí (ventas a crédito de la app, pagado y saldo).'],
    ['• Los pagos que se registran en la app (Cobranza) quedan en la hoja PAGOS REGISTRADOS.']]);
  lm.getRange('A1').setFontWeight('bold').setFontSize(13); lm.setColumnWidth(1, 760);
  try { ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(nm => { const d = ss.getSheetByName(nm); if (d && ss.getSheets().length > 1) ss.deleteSheet(d); }); ss.setActiveSheet(sh); } catch (e) {}
  PropertiesService.getScriptProperties().deleteProperty('PLANILLA_SUCIA');
  return { filas: n, saldo: filas.reduce((s, f) => s + (f[9] || 0), 0) };
}

/** Botón "Actualizar planilla": primero trae los cambios hechos en la planilla, después la deja al día. */
function sincronizarPlanillaCreditos(token) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return withLock_(() => {
    const ss = planillaCreditos_(); asegurarDisparadorHorario_();
    const imp = importarPlanilla_(ss, false);
    const exp = exportarPlanilla_(ss);
    return { url: ss.getUrl(), actualizados: imp.actualizados, nuevos: imp.nuevos, documentos: exp.filas, total: exp.saldo };
  });
}
/** Disparador al editar la planilla: la app recibe el cambio al tiro. */
function alEditarPlanillaCreditos(e) {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) return;
  try {
    if (e && e.range && e.range.getSheet().getName() !== PLANILLA_HOJA_) return;
    FRESCO_ = true; MEMO_ = {}; SLICE_ = {}; VER_ = {}; TOCADAS_ = {};
    importarPlanilla_(e && e.source ? e.source : planillaCreditos_(), true);
    cerrarPeticion_();
  } finally { lock.releaseLock(); }
}
/** Cada hora: si hubo pagos o cargas desde la última vez, se actualiza la planilla (antes se traen los cambios que hicieron en ella). */
function planillaCreditosCadaHora() {
  if (!PropertiesService.getScriptProperties().getProperty('PLANILLA_SUCIA')) return;
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return;
  try { FRESCO_ = true; MEMO_ = {}; SLICE_ = {}; VER_ = {}; TOCADAS_ = {};
    const ss = planillaCreditos_(); importarPlanilla_(ss, false); exportarPlanilla_(ss); cerrarPeticion_();
  } finally { lock.releaseLock(); }
}

/* ============================ CHEQUES EN CARTERA ============================ */
// Un cheque es crédito hasta que se cobra. Salen de tres lugares: ventas con cheque (PAGOS), cobranza con cheque (COBRANZA) y los cheques de la
// planilla de control (CREDITOS_CARGA). Su estado (CARTERA → COBRADO / PROTESTADO) se guarda en CHEQUES_ESTADO con la clave 'V|id', 'C|id' o 'P|folio_key'.
function chequesTodos_() {
  const hoy = hoy_(), est = {}; read_('CHEQUES_ESTADO').forEach(e => est[e.clave] = e);
  const docs = {}; read_('DOCUMENTOS').forEach(d => docs[d.folio_key] = d);
  const maestro = {}; read_('CLIENTES').forEach(c => maestro[rutNorm_(c.rut)] = c);
  const nom = {}; vendedores_().forEach(v => nom[v.usuario] = v.nombre);
  const razon = (rut, otro) => { const m = rut ? maestro[rutNorm_(rut)] : null; return m ? m.razon_social : (otro || ''); };
  const out = [];
  const poner = (clave, o) => { const e = est[clave] || {}; o.clave = clave; o.estado = e.estado || 'CARTERA'; o.fechaEstado = e.fecha || ''; o.obsEstado = e.obs || '';
    o.fechaCheque = o.fechaCheque ? String(o.fechaCheque).slice(0, 10) : ''; o.monto = Math.round(num_(o.monto));
    o.aFecha = !!(o.fechaCheque && o.fechaCheque > hoy); out.push(o); };
  read_('PAGOS').filter(x => x.forma === 'CHEQUE').forEach(x => { const d = docs[x.folio_key] || {};
    poner('V|' + x.id, { origen: 'Venta', rut: d.rut ? rutFmt_(d.rut) : '', cliente: razon(d.rut, d.cliente), documento: ((d.tipo || '').replace(' Electrónica', '') + ' ' + (d.folio || '')).trim(),
      monto: x.monto, numero: x.cheque_numero || '', banco: x.banco || '', recibido: String(x.fecha), fechaCheque: x.cheque_fecha, vendedor: nom[x.vendedor] || x.vendedor, titular: x.cheque_titular || '' }); });
  read_('COBRANZA').filter(x => x.forma === 'CHEQUE').forEach(x => { const d = docs[x.folio_key] || {}, rut = x.rut || d.rut || '';
    poner('C|' + x.id, { origen: 'Cobranza', rut: rut ? rutFmt_(rut) : '', cliente: razon(rut, x.cliente), documento: x.folio ? 'Folio ' + x.folio : 'Cobranza',
      monto: x.monto, numero: x.cheque_numero || '', banco: x.banco || '', recibido: String(x.fecha), fechaCheque: x.cheque_fecha, vendedor: nom[x.vendedor] || x.vendedor, titular: x.cheque_titular || '' }); });
  read_('CREDITOS_CARGA').filter(x => String(x.estado) === 'CHEQUE').forEach(x => {
    poner('P|' + x.folio_key, { origen: 'Planilla de control', rut: x.rut ? rutFmt_(x.rut) : '', cliente: razon(x.rut, x.cliente_excel), documento: (String(x.tipo || '').replace(' Electrónica', '') + ' ' + x.folio).trim(),
      monto: x.monto, numero: '', banco: '', recibido: x.recepcion instanceof Date ? normFecha_(x.recepcion) : String(x.recepcion || ''), fechaCheque: '', vendedor: x.vendedor || '', titular: '', obs: x.metodo || '' }); });
  return out;
}
function listarCheques(token) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return conCache_('cheques', ['PAGOS', 'COBRANZA', 'CREDITOS_CARGA', 'DOCUMENTOS', 'CLIENTES', 'CHEQUES_ESTADO', 'USUARIOS'], () => {
    const hoy = hoy_(), desde = sumarDias_(hoy, -45);
    // los cobrados se muestran solo los últimos 45 días
    const xs = chequesTodos_().filter(c => c.estado !== 'COBRADO' || String(c.fechaEstado) >= desde);
    xs.sort((p, q) => (p.fechaCheque || p.recibido || '').localeCompare(q.fechaCheque || q.recibido || ''));
    return { hoy, cheques: xs };
  });
}
/** Marca cheques como COBRADO o PROTESTADO (o los devuelve a CARTERA). `fecha` = día en que se cobró. */
function marcarCheque(token, claves, estado, fecha, obs) {
  const u = auth_(token, ['RENDICION','SUPERVISOR']);
  estado = String(estado || '').toUpperCase();
  if (['COBRADO','PROTESTADO','CARTERA'].indexOf(estado) < 0) throw new Error('Estado de cheque no válido.');
  claves = (claves || []).map(String).filter(String); if (!claves.length) throw new Error('Marca al menos un cheque.');
  return withLock_(() => {
    const ex = {}; read_('CHEQUES_ESTADO').forEach(e => ex[e.clave] = e);
    const nuevos = [], borrar = [];
    claves.forEach(k => {
      const fila = { clave: k, estado, fecha: fecha || hoy_(), registrado_por: u.usuario, registrado: now_(), obs: String(obs || '') };
      if (estado === 'CARTERA') { if (ex[k]) borrar.push(ex[k]._row); return; }
      if (ex[k]) updateRow_('CHEQUES_ESTADO', ex[k]._row, fila); else nuevos.push(fila);
    });
    if (nuevos.length) append_('CHEQUES_ESTADO', nuevos);
    if (borrar.length) deleteRows_('CHEQUES_ESTADO', borrar);
    return { ok: true, cantidad: claves.length };
  });
}

/* ============================ DEPÓSITOS DE EFECTIVO ============================ */

const lista_ = v => String(v || '').split(',').map(x => x.trim()).filter(String);

/** Efectivo del día de un vendedor (folios y cobranza) y los depósitos ya registrados. */
function efectivoParaDepositar(token, fecha, vendedor) {
  const u = auth_(token, ['VENDEDOR','RENDICION','SUPERVISOR']);
  const v = u.rol === 'VENDEDOR' ? u.usuario : vendedor;
  cargarDia_(fecha, ['DEPOSITOS', 'PAGOS', 'DESCUENTOS', 'DOCUMENTOS', 'COBRANZA', 'GASTOS']);
  const deps = byFecha_('DEPOSITOS', fecha).filter(d => d.vendedor === v);
  const enDep = {}; deps.forEach(d => { lista_(d.folios).forEach(k => enDep[k] = d.id); lista_(d.cobranzas).forEach(k => enDep['C:' + k] = d.id); });
  const folios = docsDelDia_(fecha, v).map(d => ({ key: d.folio_key, folio: d.folio, cliente: d.cliente,
    efectivo: d.pagos.filter(p => p.forma === 'EFECTIVO').reduce((a, p) => a + p.monto, 0), deposito: enDep[d.folio_key] || '' }))
    .filter(x => x.efectivo > 0);
  const cobranzas = byFecha_('COBRANZA', fecha).filter(c => c.vendedor === v && c.forma === 'EFECTIVO')
    .map(c => ({ key: c.id, folio: c.folio, cliente: c.cliente, efectivo: num_(c.monto), deposito: enDep['C:' + c.id] || '' }));
  // el depósito ya no se asocia a folios: se compara en plata (efectivo del día − gastos) contra lo depositado
  const gastos = byFecha_('GASTOS', fecha).filter(g => g.responsable === v).reduce((a, g) => a + num_(g.monto), 0);
  const efV = folios.reduce((a, x) => a + x.efectivo, 0), efC = cobranzas.reduce((a, x) => a + x.efectivo, 0), depositado = deps.reduce((a, d) => a + num_(d.monto), 0);
  return { vendedor: v, estadoDia: estadoDia_(fecha), folios, cobranzas,
    resumen: { efectivoVentas: efV, efectivoCobranza: efC, gastos, disponible: efV + efC - gastos, depositado, saldo: efV + efC - gastos - depositado },
    depositos: deps.map(d => ({ id: d.id, banco: d.banco, monto: num_(d.monto), referencia: d.referencia,
      folios: lista_(d.folios), cobranzas: lista_(d.cobranzas), incluido: incluidoDep_(d, folios, cobranzas), adjuntos: adjuntosDe_(d) })) };
}
function incluidoDep_(d, folios, cobranzas) {
  const f = lista_(d.folios), c = lista_(d.cobranzas);
  return folios.filter(x => f.indexOf(x.key) >= 0).reduce((a, x) => a + x.efectivo, 0) +
    cobranzas.filter(x => c.indexOf(x.key) >= 0).reduce((a, x) => a + x.efectivo, 0);
}

function guardarDeposito(token, fecha, dep) {
  const u = auth_(token, ['VENDEDOR','RENDICION','SUPERVISOR']);
  assertAbierta_(fecha);
  const v = u.rol === 'VENDEDOR' ? u.usuario : dep.vendedor;
  if (!v) throw new Error('Elige el vendedor.');
  if (BANCOS.indexOf(dep.banco) < 0) throw new Error('Elige el banco del depósito.');
  if (num_(dep.monto) <= 0) throw new Error('Ingresa el monto depositado.');
  return withLock_(() => {
    const ocupados = {};
    byFecha_('DEPOSITOS', fecha).filter(d => d.vendedor === v).forEach(d => { lista_(d.folios).forEach(k => ocupados[k] = 1); lista_(d.cobranzas).forEach(k => ocupados['C:' + k] = 1); });
    const rep = (dep.folios || []).filter(k => ocupados[k]).concat((dep.cobranzas || []).filter(k => ocupados['C:' + k]));
    if (rep.length) throw new Error('Algunos folios ya están en otro depósito: ' + rep.join(', '));
    const o = { id: uid_(), fecha, vendedor: v, banco: dep.banco, monto: num_(dep.monto), referencia: dep.referencia || '',
      folios: (dep.folios || []).join(','), cobranzas: (dep.cobranzas || []).join(','), obs: dep.obs || '', registrado_por: u.usuario, registrado: now_() };
    append_('DEPOSITOS', [o]); return o;
  });
}

function borrarDeposito(token, id) {
  const u = auth_(token, ['VENDEDOR','RENDICION','SUPERVISOR']);
  return withLock_(() => {
    const d = read_('DEPOSITOS').find(x => x.id === id);
    if (!d) return true;
    assertAbierta_(d.fecha);
    if (u.rol === 'VENDEDOR' && d.vendedor !== u.usuario) throw new Error('Solo puedes borrar tus depósitos.');
    deleteRows_('DEPOSITOS', [d._row]); return true;
  });
}

/* ============================ DEVOLUCIONES (mermas y reprocesos) ============================ */
// Producto que vuelve a la bodega y no se puede vender: MERMA (se descarta) o REPROCESO (vuelve a producción).
// Cada una se justifica con una nota de crédito: N° y monto obligatorios; la foto de la NC es opcional.
const DEV_ROLES = ['BODEGA','RENDICION','SUPERVISOR'];
const DEV_TIPOS = ['MERMA','REPROCESO'];

function listarDevoluciones(token, fecha) {
  auth_(token, DEV_ROLES);
  return byFecha_('DEVOLUCIONES', fecha).map(r => { delete r._row; r.cantidad = num_(r.cantidad); r.monto = num_(r.monto); r.adjuntos = adjuntosDe_(r); return r; })
    .sort((a, b) => String(a.registrado) < String(b.registrado) ? 1 : -1);
}

/** o: {tipo, codigo, cantidad, origen (usuario del vendedor o ''), cliente, nota_credito, motivo, obs} */
function guardarDevolucion(token, fecha, o) {
  const u = auth_(token, DEV_ROLES);
  assertAbierta_(fecha);
  const tipo = String(o.tipo || '').toUpperCase();
  if (DEV_TIPOS.indexOf(tipo) < 0) throw new Error('Indica si es merma o reproceso.');
  const cantidad = num_(o.cantidad);
  if (!(cantidad > 0)) throw new Error('Ingresa la cantidad.');
  const oc = String(o.nota_credito || '').trim();
  if (!oc) throw new Error('Falta el N° de la nota de crédito que justifica la devolución.');
  const monto = Math.round(num_(o.monto));
  if (!(monto > 0)) throw new Error('Ingresa el monto de la nota de crédito.');
  const p = read_('PRODUCTOS').find(x => codeKey_(x.codigo) === codeKey_(o.codigo));
  if (!p) throw new Error('Elige el producto.');
  return withLock_(() => {
    const r = { id: uid_(), fecha, tipo, monto, origen: String(o.origen || ''), cliente: String(o.cliente || '').trim(), codigo: codeKey_(p.codigo), producto: p.nombre,
      unidad: p.unidad, cantidad, nota_credito: oc, motivo: String(o.motivo || '').trim(), obs: String(o.obs || '').trim(), registrado_por: u.usuario, registrado: now_() };
    append_('DEVOLUCIONES', [r]); return r;
  });
}

function borrarDevolucion(token, id) {
  auth_(token, DEV_ROLES);
  return withLock_(() => {
    const r = read_('DEVOLUCIONES').find(x => x.id === id);
    if (!r) return true;
    assertAbierta_(r.fecha);
    deleteRows_('DEVOLUCIONES', [r._row]); return true;
  });
}

/** Precio por kilo de cada producto ese día = total facturado / kilos facturados (Informe de ventas). Si no se facturó, el de la lista de precios. */
function preciosKg_(detV) {
  const t = {}, q = {};
  detV.forEach(x => { const c = codeKey_(x.codigo); t[c] = (t[c] || 0) + num_(x.total); q[c] = (q[c] || 0) + num_(x.cantidad); });
  const p = {};
  read_('PRODUCTOS').forEach(x => { const c = codeKey_(x.codigo); p[c] = q[c] > 0 ? t[c] / q[c] : num_(x.precio); });
  Object.keys(q).forEach(c => { if (!(c in p)) p[c] = q[c] > 0 ? t[c] / q[c] : 0; });
  return p;
}
/** Kilos de un vendedor: salida − retorno vs facturado, por producto, con 2 decimales, y la diferencia valorizada en pesos
 *  (positivo = salió y no volvió ni se facturó: se descuenta de su liquidación). */
function kilosDe_(v, desp, detV, unidad, precios) {
  const m = {};
  const it = (c, nombre) => m[c] = m[c] || { codigo: c, producto: nombre, salida: 0, retorno: 0, facturado: 0 };
  desp.filter(x => x.vendedor === v && x.unidad !== 'UN').forEach(x => { const o = it(codeKey_(x.codigo), x.producto); o.salida += num_(x.salida); o.retorno += num_(x.retorno); });
  detV.filter(x => x.vendedor === v && unidad[codeKey_(x.codigo)] !== 'UN').forEach(x => { it(codeKey_(x.codigo), x.producto).facturado += num_(x.cantidad); });
  const r2 = n => Math.round(n * 100) / 100, L = Object.keys(m).map(c => m[c]);
  const detalle = L.map(o => { const dif = o.salida - o.retorno - o.facturado, pr = precios[o.codigo] || 0;
    return { codigo: o.codigo, producto: o.producto, salida: r2(o.salida), retorno: r2(o.retorno), facturado: r2(o.facturado), diferencia: r2(dif), precio: Math.round(pr), monto: Math.round(dif * pr) }; });
  const salida = L.reduce((a, o) => a + o.salida, 0), retorno = L.reduce((a, o) => a + o.retorno, 0), fact = L.reduce((a, o) => a + o.facturado, 0);
  return { salida: r2(salida), retorno: r2(retorno), vendido: r2(salida - retorno), facturado: r2(fact), diferencia: r2(salida - retorno - fact),
    diferenciaPesos: detalle.reduce((a, d) => a + d.monto, 0), detalle: detalle.filter(d => Math.abs(d.diferencia) >= 0.005) };
}

/* ============================ CONTEO DE EFECTIVO Y DEPÓSITO ============================ */
// La encargada cuenta el efectivo de cada vendedor: billetes por denominación y monedas (un total; no se depositan).
// A depositar = billetes contados − caja chica. Esperado = efectivo de ventas + cobranza − gastos − lo que el vendedor ya depositó.
const BILLETES = [20000, 10000, 5000, 2000, 1000];

function getConteoEfectivo(token, fecha) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  const r = resumen_(fecha);
  const nombres = {}; read_('USUARIOS').forEach(u => nombres[u.usuario] = u.nombre);
  const guardado = {}; byFecha_('CONTEO_EFECTIVO', fecha).forEach(x => guardado[x.vendedor] = x);
  const fila = x => { const o = {}; BILLETES.forEach(b => o['b' + b] = Math.round(num_((x || {})['b' + b]))); o.monedas = Math.round(num_((x || {}).monedas)); return o; };
  const g = guardado.GENERAL || {};
  return { fecha, estado: r.estado,
    vendedores: r.porVendedor.map(t => Object.assign({ usuario: t.vendedor, nombre: nombres[t.vendedor] || t.vendedor, esperado: t.efectivoEntregar, guardado: !!guardado[t.vendedor] }, fila(guardado[t.vendedor]))),
    cajaChica: Math.round(num_(g.caja_chica)), obs: g.obs || '' };
}

/** datos: {filas:[{vendedor, b20000, b10000, b5000, b2000, b1000, monedas}], cajaChica, obs} */
function guardarConteoEfectivo(token, fecha, datos) {
  const u = auth_(token, ['RENDICION','SUPERVISOR']);
  assertAbierta_(fecha);
  const n = x => { const v = Math.round(num_(x)); if (v < 0) throw new Error('Las cantidades no pueden ser negativas.'); return v; };
  return withLock_(() => {
    const previo = {}; read_('CONTEO_EFECTIVO').filter(x => x.fecha === fecha).forEach(x => previo[x.vendedor] = x);
    const nuevas = [];
    const poner = o => { const p = previo[o.vendedor]; o.key = fecha + '|' + o.vendedor; o.fecha = fecha; o.registrado_por = u.usuario; o.registrado = now_();
      if (p) updateRow_('CONTEO_EFECTIVO', p._row, o); else nuevas.push(o); };
    (datos.filas || []).forEach(f => { const o = { vendedor: String(f.vendedor), monedas: n(f.monedas), caja_chica: '', obs: '' }; BILLETES.forEach(b => o['b' + b] = n(f['b' + b])); poner(o); });
    const g = { vendedor: 'GENERAL', monedas: 0, caja_chica: n(datos.cajaChica), obs: String(datos.obs || '').trim() }; BILLETES.forEach(b => g['b' + b] = 0); poner(g);
    if (nuevas.length) append_('CONTEO_EFECTIVO', nuevas);
    return true;
  });
}

/* ============================ RESUMEN / RENDICIÓN ============================ */

function resumen_(fecha) {
  cargarDia_(fecha, ['DOCUMENTOS', 'PAGOS', 'DESCUENTOS', 'DESPACHO', 'VENTAS_DETALLE', 'COBRANZA', 'GASTOS', 'DEPOSITOS', 'PROVEEDORES', 'CONSUMO', 'DEVOLUCIONES']);
  const docs = docsDelDia_(fecha);
  const devs = byFecha_('DEVOLUCIONES', fecha);
  const desp = byFecha_('DESPACHO', fecha);
  const detV = byFecha_('VENTAS_DETALLE', fecha).filter(r => !esGuiaFlag_(r.es_guia));
  const unidad = {}; read_('PRODUCTOS').forEach(p => unidad[codeKey_(p.codigo)] = p.unidad);
  const hayDetalle = detV.length > 0;
  const precios = preciosKg_(detV);
  const cob = byFecha_('COBRANZA', fecha), gas = byFecha_('GASTOS', fecha), deps = byFecha_('DEPOSITOS', fecha);
  const prov = byFecha_('PROVEEDORES', fecha), cons = byFecha_('CONSUMO', fecha);
  const vend = vendedores_().map(v => v.usuario);
  docs.forEach(d => { if (d.vendedor && vend.indexOf(d.vendedor) < 0) vend.push(d.vendedor); });

  const porVendedor = vend.map(v => {
    const ds = docs.filter(d => d.vendedor === v);
    const tot = { vendedor: v, documentos: ds.length, pendientes: ds.filter(d => d.estado !== 'DETALLADO').length,
      venta: 0, contado: 0, credito: 0, descuentos: 0, descPendientes: 0 };
    FORMAS.forEach(f => tot[f] = 0);
    ds.forEach(d => {
      tot.venta += d.total; tot.descuentos += d.descAprob;
      d.descuentos.filter(x => x.estado === 'PENDIENTE').forEach(x => tot.descPendientes += x.monto);
      d.pagos.forEach(p => { tot[p.forma] += p.monto; });
    });
    tot.bancos = {}; BANCOS.forEach(b => tot.bancos[b] = 0);
    ds.forEach(d => d.pagos.filter(p => p.forma === 'TRANSFERENCIA' || p.forma === 'DEP_EFECTIVO')
      .forEach(p => { const b = BANCOS.indexOf(p.banco) >= 0 ? p.banco : 'BICE'; tot.bancos[b] += p.monto; }));
    tot.credito = tot.CREDITO; tot.contado = tot.venta - tot.CREDITO - tot.descuentos;
    const c = cob.filter(x => x.vendedor === v);
    tot.cobranza = c.reduce((a, x) => a + num_(x.monto), 0);
    tot.cobranzaEfectivo = c.filter(x => x.forma === 'EFECTIVO').reduce((a, x) => a + num_(x.monto), 0);
    tot.gastos = gas.filter(x => x.responsable === v).reduce((a, x) => a + num_(x.monto), 0);
    const dv = deps.filter(x => x.vendedor === v);
    tot.depositos = dv.reduce((a, x) => a + num_(x.monto), 0);
    const dvF = dv.filter(x => lista_(x.folios).length || lista_(x.cobranzas).length);       // depósitos antiguos asociados a folios
    tot.depositoExceso = Math.max(0, tot.depositos - (tot.EFECTIVO + tot.cobranzaEfectivo - tot.gastos));
    if (dvF.length) {
      const ef = {}; ds.forEach(d => ef[d.folio_key] = d.pagos.filter(p => p.forma === 'EFECTIVO').reduce((a, p) => a + p.monto, 0));
      const efc = {}; c.filter(x => x.forma === 'EFECTIVO').forEach(x => efc[x.id] = num_(x.monto));
      const incl = dvF.reduce((a, d) => a + lista_(d.folios).reduce((s, k) => s + (ef[k] || 0), 0) + lista_(d.cobranzas).reduce((s, k) => s + (efc[k] || 0), 0), 0);
      tot.depositoDif = dvF.reduce((a, x) => a + num_(x.monto), 0) - incl;
    } else tot.depositoDif = 0;
    tot.efectivoEntregar = tot.EFECTIVO + tot.cobranzaEfectivo - tot.gastos - tot.depositos;
    const k = desp.filter(x => x.vendedor === v);
    tot.kilos = kilosDe_(v, desp, detV, unidad, precios);
    tot.sinRetorno = k.filter(x => x.salida !== '' && x.retorno === '').length;
    // la diferencia de kilos solo se evalúa cuando ya se registró todo el retorno
    tot.kilos.alerta = hayDetalle && tot.kilos.salida > 0 && tot.sinRetorno === 0 && Math.abs(tot.kilos.diferencia) > CFG.TOLERANCIA_KG;
    return tot;
  }).filter(t => t.documentos || t.kilos.salida || t.cobranza || t.gastos || t.depositos);

  const sinAsignar = docs.filter(d => !d.vendedor);
  const sum = (arr) => arr.reduce((a, x) => a + num_(x.monto), 0);
  return {
    fecha, estado: estadoDia_(fecha), porVendedor, hayDetalle,
    sinAsignar: sinAsignar.map(d => ({ folio_key: d.folio_key, tipo: d.tipo, folio: d.folio, cliente: d.cliente, total: d.total, terminal: d.terminal })),
    totales: {
      venta: porVendedor.reduce((a, t) => a + t.venta, 0),
      credito: porVendedor.reduce((a, t) => a + t.credito, 0),
      efectivo: porVendedor.reduce((a, t) => a + t.efectivoEntregar, 0),
      devoluciones: devs.length,
      cobranza: sum(cob), proveedores: sum(prov), consumo: sum(cons), gastos: sum(gas), depositos: sum(deps)
    },
    alertas: []
      .concat(sinAsignar.length ? [sinAsignar.length + ' documento(s) sin vendedor asignado'] : [])
      .concat(porVendedor.filter(t => t.pendientes).map(t => t.vendedor + ': ' + t.pendientes + ' folio(s) sin detallar'))
      .concat(porVendedor.filter(t => t.descPendientes).map(t => t.vendedor + ': descuentos por autorizar'))
      .concat(porVendedor.filter(t => t.depositoDif).map(t => t.vendedor + ': el depósito ' + (t.depositoDif > 0 ? 'supera' : 'no alcanza') +
        ' el efectivo de los folios que incluye (diferencia $' + Math.abs(t.depositoDif).toLocaleString('es-CL') + ')'))
      .concat(porVendedor.filter(t => t.depositoExceso).map(t => t.vendedor + ': depositó $' + t.depositoExceso.toLocaleString('es-CL') + ' más que el efectivo del día'))
      .concat(porVendedor.filter(t => t.sinRetorno).map(t => t.vendedor + ': falta registrar retorno de ' + t.sinRetorno + ' producto(s)'))
      .concat(porVendedor.filter(t => t.kilos.alerta).map(t => t.vendedor + ': ' + Math.abs(t.kilos.diferencia).toFixed(2).replace('.', ',') + ' kg ($' + Math.abs(t.kilos.diferenciaPesos).toLocaleString('es-CL') + ') ' +
        (t.kilos.diferencia > 0 ? 'salieron y no volvieron ni se facturaron' : 'facturados de más respecto a lo que salió')))
      .concat(fecha && !hayDetalle && desp.length ? ['Falta importar el Informe de ventas (kilos por producto) para cruzar kilos'] : [])
  };
}

function getResumen(token, fecha) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return resumen_(fecha);
}

/**
 * Inspección final por vendedor: todo lo que la encargada revisa antes de recibir el efectivo.
 * Mismas cuentas que la hoja del vendedor en el archivo de rendición. vendedor = '' → todos los que tuvieron movimiento.
 */
function getInspeccion(token, fecha, vendedor) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  cargarDia_(fecha, ['DOCUMENTOS', 'PAGOS', 'DESCUENTOS', 'COBRANZA', 'GASTOS', 'DEPOSITOS', 'DESPACHO', 'VENTAS_DETALLE']);
  const detV = byFecha_('VENTAS_DETALLE', fecha).filter(r => !esGuiaFlag_(r.es_guia));
  const unidadP = {}; read_('PRODUCTOS').forEach(p => unidadP[codeKey_(p.codigo)] = p.unidad);
  const precios = preciosKg_(detV);
  const docs = docsDelDia_(fecha), cob = byFecha_('COBRANZA', fecha), gas = byFecha_('GASTOS', fecha), deps = byFecha_('DEPOSITOS', fecha);
  const desp = byFecha_('DESPACHO', fecha);
  const rutFolio = {}, rutNombre = {};
  read_('DOCUMENTOS').forEach(d => { if (!d.rut) return; rutFolio[String(d.folio).replace(/\D/g, '')] = d.rut; rutNombre[normTxt_(d.cliente)] = d.rut; });
  const rutCob = c => rutFolio[String(c.folio || '').replace(/\D/g, '')] || rutNombre[normTxt_(c.cliente)] || '';
  const doc = d => d.tipo.replace(' Electrónica', '') + ' ' + d.folio;
  const bancoTr = b => BANCOS.indexOf(b) >= 0 ? b : 'BICE';     // igual que en el archivo de rendición
  const momentoCh = f => f && f > fecha ? 'A fecha' : 'Al día';       // cheque al día o a fecha
  const lista = vendedores_().filter(v => !vendedor || v.usuario === vendedor);
  const out = lista.map(v => {
    const ds = docs.filter(d => d.vendedor === v.usuario), cs = cob.filter(c => c.vendedor === v.usuario);
    const gs = gas.filter(g => g.responsable === v.usuario), dps = deps.filter(d => d.vendedor === v.usuario);
    if (!ds.length && !cs.length && !gs.length && !dps.length && !desp.some(x => x.vendedor === v.usuario) && vendedor !== v.usuario) return null;
    const transf = {}; BANCOS.forEach(b => transf[b] = []);
    const cheques = [], creditos = [], cobranza = [];
    let venta = 0, credito = 0, nc = 0, desc = 0, efVentas = 0;
    ds.forEach(d => {
      venta += num_(d.total); desc += num_(d.descAprob);
      d.pagos.forEach(p => {
        const base = { cliente: d.cliente, rut: d.rut || '', origen: doc(d), tipo: 'Venta', monto: p.monto };
        if (p.forma === 'EFECTIVO') efVentas += p.monto;
        else if (p.forma === 'TRANSFERENCIA' || p.forma === 'DEP_EFECTIVO') transf[bancoTr(p.banco)].push(base);
        else if (p.forma === 'CHEQUE') cheques.push(Object.assign(base, { numero: p.cheque_numero || '', banco: p.banco, fechaCheque: p.cheque_fecha || '', momento: momentoCh(p.cheque_fecha), titular: p.cheque_titular || '' }));
        else if (p.forma === 'CREDITO') { credito += p.monto; creditos.push(base); }
        else if (p.forma === 'NOTA_CREDITO') nc += p.monto;
      });
    });
    let efCob = 0;
    cs.forEach(c => {
      const m = num_(c.monto), rut = rutCob(c), origen = 'Cobranza' + (c.folio ? ' folio ' + c.folio : '');
      cobranza.push({ cliente: c.cliente, rut, folio: c.folio || '', forma: c.forma, banco: c.banco || '', numero: c.cheque_numero || '', monto: m });
      if (c.forma === 'EFECTIVO') efCob += m;
      else if (c.forma === 'TRANSFERENCIA' || c.forma === 'DEP_EFECTIVO') transf[bancoTr(c.banco)].push({ cliente: c.cliente, rut, origen, tipo: 'COBRANZA', monto: m });
      else if (c.forma === 'CHEQUE') cheques.push({ cliente: c.cliente, rut, origen, tipo: 'COBRANZA', monto: m, numero: c.cheque_numero || '', banco: c.banco, fechaCheque: c.cheque_fecha || '', momento: momentoCh(c.cheque_fecha), titular: c.cheque_titular || '' });
    });
    const gastos = gs.map(g => ({ concepto: g.concepto, respaldo: g.respaldo || '', monto: num_(g.monto) }));
    const depositos = dps.map(d => ({ banco: d.banco, referencia: d.referencia || '', monto: num_(d.monto) }));
    const tGas = gastos.reduce((a, x) => a + x.monto, 0), tDep = depositos.reduce((a, x) => a + x.monto, 0);
    return {
      usuario: v.usuario, nombre: v.nombre, terminal: v.terminales || '',
      documentos: ds.length, detallados: ds.filter(d => d.estado === 'DETALLADO').length,
      docsEfectivo: ds.filter(d => d.pagos.some(p => p.forma === 'EFECTIVO')).length,
      totales: { venta, credito, nc, descuentos: desc, contado: venta - credito - nc - desc, efVentas, efCob, gastos: tGas, depositos: tDep,
        entregar: efVentas + efCob - tGas - tDep, cheques: cheques.reduce((a, x) => a + x.monto, 0) },
      transf, cheques, cobranza, gastos, depositos, creditos,
      kilos: kilosDe_(v.usuario, desp, detV, unidadP, precios), sinRetorno: desp.filter(x => x.vendedor === v.usuario && x.salida !== '' && x.retorno === '').length,
      folios: ds.map(d => ({ folio_key: d.folio_key, folio: d.folio, tipo: d.tipo.replace(' Electrónica', ''), cliente: d.cliente, rut: d.rut || '',
        total: num_(d.total), estado: d.estado, descAprob: num_(d.descAprob), detalladoPor: d.detalladoPor || '',
        descPend: d.descuentos.some(x => x.estado === 'PENDIENTE'),
        pagos: d.pagos.map(p => ({ forma: p.forma, banco: p.banco, monto: p.monto, numero: p.cheque_numero || '' })) }))
    };
  }).filter(Boolean);
  return { fecha, vendedores: out, generado: Utilities.formatDate(new Date(), CFG.TZ || 'America/Santiago', 'dd-MM-yyyy HH:mm') };
}

function cerrarRendicion(token, fecha, forzar) {
  const u = auth_(token, ['RENDICION','SUPERVISOR']);
  return withLock_(() => {
    const r = resumen_(fecha);
    if (r.estado === 'CERRADA') throw new Error('Esta rendición ya está cerrada.');
    if (r.alertas.length && !forzar) return { ok: false, alertas: r.alertas };
    const url = generarArchivo_(fecha, r);
    const reg = read_('RENDICIONES').find(x => x.fecha === fecha);
    const obj = { fecha, estado: 'CERRADA', cerrado_por: u.usuario, cerrado: now_(), archivo_url: url,
      resumen_json: JSON.stringify(r.totales) };
    reg ? updateRow_('RENDICIONES', reg._row, obj) : append_('RENDICIONES', [obj]);
    return { ok: true, url };
  });
}

/** Genera el archivo tal como quedaría, sin cerrar el día. */
function vistaPreviaRendicion(token, fecha) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return withLock_(() => ({ url: generarArchivo_(fecha, resumen_(fecha), true) }));
}

function reabrirRendicion(token, fecha) {
  auth_(token, ['ADMIN']);
  return withLock_(() => {
    const reg = read_('RENDICIONES').find(x => x.fecha === fecha);
    if (reg) { reg.estado = 'REABIERTA'; updateRow_('RENDICIONES', reg._row, reg); }
    return true;
  });
}

/* ============================ ARCHIVO DE RENDICIÓN ============================ */

const EST = { font: 'Calibri', gris: '#D9D9D9', grisClaro: '#F2F2F2', cobre: '#C2571A', cobreClaro: '#FBE9DD',
  amarillo: '#FFF2CC', borde: '#A6A6A6', dinero: '$ #,##0;-$ #,##0;"-"', kilos: '#,##0.00;-#,##0.00;"-"' };
// Fórmula de enlace a los respaldos: "Ver" o "Ver (2)"
function linkAdj_(r) { const a = lista_(r.adjuntos); if (!a.length) return '';
  return '=HYPERLINK("https://drive.google.com/file/d/' + a[0] + '/view","Ver' + (a.length > 1 ? ' (' + a.length + ')' : '') + '")'; }
const colL_ = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

/**
 * Arma una hoja en memoria (valores + formato) y la escribe de una vez.
 * Cada tabla devuelve la fila de totales para que la cuadratura use fórmulas.
 */
function Hoja_(ss, nombre, ancho) {
  this.sh = ss.insertSheet(nombre.slice(0, 99)); this.W = ancho; this.g = []; this.ops = [];
}
Hoja_.prototype.fila = function (vals) { const r = (vals || []).slice(0, this.W); while (r.length < this.W) r.push(''); this.g.push(r); return this.g.length; };
Hoja_.prototype.op = function (r, c, nr, nc, f) { this.ops.push({ r, c, nr, nc, f }); };
Hoja_.prototype.titulo = function (txt, sub) {
  const r = this.fila([txt]); this.op(r, 1, 1, this.W, g => g.merge().setFontSize(14).setFontWeight('bold').setFontColor('#FFFFFF').setBackground(EST.cobre));
  if (sub) { const r2 = this.fila([sub]); this.op(r2, 1, 1, this.W, g => g.merge().setFontColor('#595959')); }
  this.fila([]);
};
Hoja_.prototype.seccion = function (txt, ancho) {
  const r = this.fila([txt]); this.op(r, 1, 1, ancho || this.W, g => g.merge().setFontWeight('bold').setBackground(EST.cobreClaro).setFontColor('#7A3A12'));
};
/** cols: [{h, w?, t:'txt'|'$'|'kg'|'n', sum?:true}] ; filas: arreglos de valores (pueden ser fórmulas con {r} = fila actual) */
Hoja_.prototype.tabla = function (titulo, cols, filas, vacio) {
  const n = cols.length;
  if (titulo) this.seccion(titulo, n);
  const h = this.fila(cols.map(c => c.h));
  this.op(h, 1, 1, n, g => g.setFontWeight('bold').setBackground(EST.gris).setWrap(true).setVerticalAlignment('middle'));
  const ini = this.g.length + 1;
  if (!filas.length) { const r = this.fila([vacio || 'Sin registros']); this.op(r, 1, 1, n, g => g.merge().setFontStyle('italic').setFontColor('#7F7F7F')); }
  filas.forEach(v => { const r = this.g.length + 1; this.fila(v.map(x => typeof x === 'string' ? x.replace(/\{r\}/g, r) : x)); });
  const fin = this.g.length;
  let tot = null;
  if (cols.some(c => c.sum)) {
    tot = this.fila(cols.map((c, i) => i === 0 ? 'TOTAL' : c.sum ? (filas.length ? '=SUM(' + colL_(i + 1) + ini + ':' + colL_(i + 1) + fin + ')' : 0) : ''));
    this.op(tot, 1, 1, n, g => g.setFontWeight('bold').setBackground(EST.grisClaro).setBorder(true, null, null, null, null, null, '#595959', SpreadsheetApp.BorderStyle.SOLID));
  }
  const last = tot || fin;
  this.op(h, 1, last - h + 1, n, g => g.setBorder(true, true, true, true, true, true, EST.borde, SpreadsheetApp.BorderStyle.SOLID));
  cols.forEach((c, i) => { if (c.t === '$' || c.t === 'kg') this.op(ini, i + 1, last - ini + 1, 1, g => g.setNumberFormat(c.t === '$' ? EST.dinero : EST.kilos)); });
  this.fila([]);
  return { ini, fin, tot, col: i => colL_(i + 1) };
};
Hoja_.prototype.escribir = function (anchos) {
  const sh = this.sh;
  if (this.g.length) sh.getRange(1, 1, this.g.length, this.W).setValues(this.g);
  sh.getRange(1, 1, Math.max(this.g.length, 1), this.W).setFontFamily(EST.font).setFontSize(10);
  this.ops.forEach(o => o.f(sh.getRange(o.r, o.c, o.nr, o.nc)));
  (anchos || []).forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setHiddenGridlines(true);
  return sh;
};

/** Rendición de un vendedor: cuadratura arriba, luego kilos, ventas, cobranza, gastos y depósitos. */
function hojaVendedor_(ss, fecha, t, u, datos) {
  const H = new Hoja_(ss, t.vendedor, 15);
  const fechaTxt = fecha.split('-').reverse().join('-');
  H.titulo('RENDICIÓN ' + (u ? u.nombre : t.vendedor).toUpperCase(), 'Fecha: ' + fechaTxt + (u && u.terminales ? '    Terminal Mi DTE: ' + u.terminales : '') + '    Cecinas Naranjo');

  // espacio reservado para la cuadratura (se llena al final, cuando se conocen las filas de totales)
  H.seccion('CUADRATURA', 5);
  const cuadIni = H.g.length + 1, CUAD = 17;
  for (let i = 0; i < CUAD; i++) H.fila([]);
  H.fila([]);

  // KILOS
  const kil = datos.kilos.filter(k => k.vendedor === t.vendedor);
  if (kil.length) {
    H.tabla('KILOS', [{ h: 'PRODUCTO' }, { h: 'SALIDA', t: 'kg', sum: 1 }, { h: 'RETORNO', t: 'kg', sum: 1 }, { h: 'VENDIDO', t: 'kg', sum: 1 },
      { h: 'FACTURADO', t: 'kg', sum: 1 }, { h: 'DIFERENCIA', t: 'kg', sum: 1 }, { h: 'PRECIO KG', t: '$' }, { h: 'DIFERENCIA $', t: '$', sum: 1 }],
      kil.map(k => [k.producto, k.salida, k.retorno, '=ROUND(B{r}-C{r},2)', k.facturado, '=ROUND(D{r}-E{r},2)', k.precio, '=ROUND(F{r}*G{r},0)']));
  }
  // VENTAS
  const docs = datos.docs.filter(d => d.vendedor === t.vendedor);
  const s = (d, f, b) => d.pagos.filter(p => p.forma === f && (!b || p.banco === b)).reduce((a, p) => a + p.monto, 0);
  const tr = (d, b) => d.pagos.filter(p => (p.forma === 'TRANSFERENCIA' || p.forma === 'DEP_EFECTIVO') && (p.banco === b || (b === 'BICE' && BANCOS.indexOf(p.banco) < 0))).reduce((a, p) => a + p.monto, 0);
  const V = H.tabla('VENTAS DEL DÍA', [{ h: 'CLIENTE' }, { h: 'RUT' }, { h: 'DOCUMENTO' }, { h: 'FOLIO' }, { h: 'MONTO', t: '$', sum: 1 }, { h: 'CONDICIÓN' },
    { h: 'EFECTIVO', t: '$', sum: 1 }, { h: 'TRANSF. BICE', t: '$', sum: 1 }, { h: 'TRANSF. ESTADO', t: '$', sum: 1 }, { h: 'TRANSF. SANTANDER', t: '$', sum: 1 },
    { h: 'CHEQUE', t: '$', sum: 1 }, { h: 'CRÉDITO', t: '$', sum: 1 }, { h: 'NOTA CRÉDITO', t: '$', sum: 1 }, { h: 'DESCUENTO', t: '$', sum: 1 }, { h: 'DEPOSITADO EN' }],
    docs.map(d => {
      const cr = s(d, 'CREDITO');
      return [d.cliente, d.rut || '', d.tipo.replace(' Electrónica', ''), Number(d.folio) || d.folio, d.total, cr >= d.total ? 'Crédito' : cr ? 'Mixto' : 'Contado',
        s(d, 'EFECTIVO'), tr(d, 'BICE'), tr(d, 'ESTADO'), tr(d, 'SANTANDER'), s(d, 'CHEQUE'), cr, s(d, 'NOTA_CREDITO'), d.descAprob, datos.depDe[d.folio_key] || ''];
    }), 'Sin documentos');
  // COBRANZA
  const cob = datos.cob.filter(c => c.vendedor === t.vendedor);
  const cm = (c, f, b) => c.forma === f && (!b || c.banco === b) ? num_(c.monto) : 0;
  const C = H.tabla('COBRANZA (pagos de créditos anteriores)', [{ h: 'CLIENTE' }, { h: 'RUT' }, { h: 'FOLIO' }, { h: 'EFECTIVO', t: '$', sum: 1 }, { h: 'TRANSF. BICE', t: '$', sum: 1 },
    { h: 'TRANSF. ESTADO', t: '$', sum: 1 }, { h: 'TRANSF. SANTANDER', t: '$', sum: 1 }, { h: 'CHEQUE', t: '$', sum: 1 }, { h: 'DEPOSITADO EN' }, { h: 'COMPROBANTE' }],
    cob.map(c => [c.cliente, c.rut, c.folio, cm(c, 'EFECTIVO'), cm(c, 'TRANSFERENCIA', 'BICE') + cm(c, 'DEP_EFECTIVO', 'BICE'), cm(c, 'TRANSFERENCIA', 'ESTADO') + cm(c, 'DEP_EFECTIVO', 'ESTADO'),
      cm(c, 'TRANSFERENCIA', 'SANTANDER') + cm(c, 'DEP_EFECTIVO', 'SANTANDER'), cm(c, 'CHEQUE'), datos.depDe['C:' + c.id] || '', linkAdj_(c)]));
  // GASTOS
  const gas = datos.gas.filter(x => x.responsable === t.vendedor);
  const G = H.tabla('GASTOS', [{ h: 'CONCEPTO' }, { h: 'N° BOLETA' }, { h: 'MONTO', t: '$', sum: 1 }, { h: 'OBSERVACIÓN' }, { h: 'FOTO / ARCHIVO' }],
    gas.map(x => [x.concepto, x.respaldo, num_(x.monto), x.obs, linkAdj_(x)]));
  // DEPÓSITOS
  const dep = datos.deps.filter(x => x.vendedor === t.vendedor);
  const D = H.tabla('DEPÓSITOS DE EFECTIVO A LA EMPRESA', [{ h: 'BANCO' }, { h: 'N° OPERACIÓN' }, { h: 'MONTO DEPOSITADO', t: '$', sum: 1 },
    { h: 'EFECTIVO QUE INCLUYE', t: '$', sum: 1 }, { h: 'DIFERENCIA', t: '$', sum: 1 }, { h: 'FOLIOS INCLUIDOS' }, { h: 'COMPROBANTE' }],
    dep.map(x => x.tieneFolios ? [x.banco, x.referencia, num_(x.monto), x.incluido, '=C{r}-D{r}', x.foliosTxt, x.link]
      : [x.banco, x.referencia, num_(x.monto), '', '', 'Depósito general (no se asocia a folios)', x.link]));
  // CHEQUES recibidos (ventas y cobranza), con los datos para depositarlos o cobrarlos
  const fch = f => f ? String(f).split('-').reverse().join('-') : '';
  const cheques = [];
  docs.forEach(d => d.pagos.filter(p => p.forma === 'CHEQUE').forEach(p => cheques.push([d.cliente, d.rut || '', 'Folio ' + d.folio, p.cheque_numero, p.banco,
    fch(p.cheque_fecha), p.cheque_fecha && p.cheque_fecha > fecha ? 'A fecha' : 'Al día', p.cheque_titular, p.monto])));
  cob.filter(c => c.forma === 'CHEQUE').forEach(c => cheques.push([c.cliente, c.rut, 'Cobranza' + (c.folio ? ' folio ' + c.folio : ''), c.cheque_numero, c.banco,
    fch(c.cheque_fecha), c.cheque_fecha && c.cheque_fecha > fecha ? 'A fecha' : 'Al día', c.cheque_titular, num_(c.monto)]));
  if (cheques.length) H.tabla('CHEQUES RECIBIDOS', [{ h: 'CLIENTE' }, { h: 'RUT' }, { h: 'ORIGEN' }, { h: 'N° CHEQUE' }, { h: 'BANCO' }, { h: 'FECHA DEL CHEQUE' },
    { h: 'TIPO' }, { h: 'TITULAR / RUT' }, { h: 'MONTO', t: '$', sum: 1 }], cheques);

  // CUADRATURA con fórmulas hacia los totales de cada tabla
  const ref = (T, i) => T.tot ? colL_(i + 1) + T.tot : '0';
  const lineas = [
    ['Venta documentada', '=' + ref(V, 4)],
    ['(−) Crédito', '=' + ref(V, 11)],
    ['(−) Notas de crédito', '=' + ref(V, 12)],
    ['(−) Descuentos autorizados', '=' + ref(V, 13)],
    ['Venta contado', '=D{0}-D{1}-D{2}-D{3}'],
    ['Transferencias BICE', '=' + ref(V, 7) + '+' + ref(C, 4)],
    ['Transferencias Estado', '=' + ref(V, 8) + '+' + ref(C, 5)],
    ['Transferencias Santander', '=' + ref(V, 9) + '+' + ref(C, 6)],
    ['Cheques', '=' + ref(V, 10) + '+' + ref(C, 7)],
    ['Efectivo de ventas', '=' + ref(V, 6)],
    ['(+) Efectivo de cobranza', '=' + ref(C, 3)],
    ['(−) Gastos', '=' + ref(G, 2)],
    ['(−) Depositado a la empresa', '=' + ref(D, 2)],
    ['EFECTIVO A ENTREGAR', '=D{9}+D{10}-D{11}-D{12}'],
    ['Efectivo recibido', ''],
    ['DIFERENCIA', '=IF(D{14}="","",D{14}-D{13})'],
    ['Firma vendedor: ____________________        Firma recibe: ____________________', '']
  ];
  lineas.forEach((l, i) => {
    const f = String(l[1]).replace(/\{(\d+)\}/g, (_, k) => cuadIni + Number(k));
    H.g[cuadIni - 1 + i] = [l[0], '', '', f].concat(Array(H.W - 4).fill(''));
    const r = cuadIni + i;
    if (i === 16) { H.op(r, 1, 1, 8, g => g.merge().setFontColor('#595959').setVerticalAlignment('bottom')); return; }
    H.op(r, 1, 1, 3, g => g.merge());
    H.op(r, 4, 1, 1, g => g.setNumberFormat(EST.dinero));
    if ([4, 13, 15].indexOf(i) >= 0) H.op(r, 1, 1, 4, g => g.setFontWeight('bold').setBackground(i === 13 ? EST.gris : EST.grisClaro));
    if (i === 14) H.op(r, 4, 1, 1, g => g.setBackground(EST.amarillo).setNote('Anotar el efectivo contado al recibir la rendición'));
  });
  H.op(cuadIni, 1, 16, 4, g => g.setBorder(true, true, true, true, null, true, EST.borde, SpreadsheetApp.BorderStyle.SOLID));
  H.op(cuadIni + 16, 1, 1, 1, g => g.setFontSize(10));
  H.escribir([260, 95, 95, 70, 95, 80, 90, 95, 105, 120, 85, 90, 95, 85, 110]);
}

/** Crea el archivo de rendición: una hoja por vendedor y luego las hojas generales (formato de la planilla actual). */
function generarArchivo_(fecha, r, borrador) {
  const f = fecha.split('-'), nombre = (borrador ? 'BORRADOR ' : '') + 'Rendición ' + f[2] + '-' + f[1] + '-' + f[0];
  const ss = SpreadsheetApp.create(nombre);
  const file = DriveApp.getFileById(ss.getId());
  try {
    const root = DriveApp.getFolderById(CFG.RENDICIONES_FOLDER_ID);
    let destino;
    if (borrador) {            // los borradores van aparte y se reemplazan: solo queda el último de cada día
      destino = sub_(root, 'Borradores');
      const prev = destino.getFilesByName(nombre);
      while (prev.hasNext()) prev.next().setTrashed(true);
    } else destino = sub_(sub_(root, f[0]), f[1]);
    file.moveTo(destino);
  } catch (e) { /* si no hay acceso a la carpeta queda en Mi unidad */ }

  const docs = docsDelDia_(fecha);
  const cob = byFecha_('COBRANZA', fecha), gas = byFecha_('GASTOS', fecha), depsRaw = byFecha_('DEPOSITOS', fecha);
  const usuarios = {}; read_('USUARIOS').forEach(u => usuarios[u.usuario] = u);
  // qué depósito cubre cada folio / cobranza
  const depDe = {}, efFolio = {}, efCob = {};
  docs.forEach(d => efFolio[d.folio_key] = d.pagos.filter(p => p.forma === 'EFECTIVO').reduce((a, p) => a + p.monto, 0));
  cob.forEach(c => efCob[c.id] = c.forma === 'EFECTIVO' ? num_(c.monto) : 0);
  const folioTxt = {}; docs.forEach(d => folioTxt[d.folio_key] = d.folio);
  const deps = depsRaw.map(d => {
    const et = d.banco + (d.referencia ? ' #' + d.referencia : '');
    lista_(d.folios).forEach(k => depDe[k] = et); lista_(d.cobranzas).forEach(k => depDe['C:' + k] = et);
    return { vendedor: d.vendedor, banco: d.banco, referencia: d.referencia, monto: num_(d.monto),
      tieneFolios: lista_(d.folios).length + lista_(d.cobranzas).length > 0,
      incluido: lista_(d.folios).reduce((a, k) => a + (efFolio[k] || 0), 0) + lista_(d.cobranzas).reduce((a, k) => a + (efCob[k] || 0), 0),
      foliosTxt: lista_(d.folios).map(k => folioTxt[k] || k).concat(lista_(d.cobranzas).map(() => 'cobranza')).join(', '), bancoDe: d.banco, link: linkAdj_(d) };
  });
  const bancoDep = {}; depsRaw.forEach(d => { lista_(d.folios).forEach(k => bancoDep[k] = d.banco); lista_(d.cobranzas).forEach(k => bancoDep['C:' + k] = d.banco); });
  const preciosK = preciosKg_(byFecha_('VENTAS_DETALLE', fecha).filter(x => !esGuiaFlag_(x.es_guia)));
  const fact = {};
  byFecha_('VENTAS_DETALLE', fecha).filter(x => !esGuiaFlag_(x.es_guia)).forEach(x => {
    const k = x.vendedor + '|' + codeKey_(x.codigo); fact[k] = (fact[k] || 0) + num_(x.cantidad); });
  const kilos = byFecha_('DESPACHO', fecha).map(k => ({ vendedor: k.vendedor, producto: k.producto, salida: num_(k.salida), retorno: num_(k.retorno),
    facturado: Math.round((fact[k.vendedor + '|' + codeKey_(k.codigo)] || 0) * 100) / 100, precio: Math.round(preciosK[codeKey_(k.codigo)] || 0) }));
  // RUT de los clientes de cobranza: por el folio que pagan y, si no, por el nombre del cliente
  const rutFolio = {}, rutNombre = {};
  read_('DOCUMENTOS').forEach(d => { if (!d.rut) return; rutFolio[String(d.folio).replace(/\D/g, '')] = d.rut; rutNombre[normTxt_(d.cliente)] = d.rut; });
  cob.forEach(c => c.rut = rutFolio[String(c.folio || '').replace(/\D/g, '')] || rutNombre[normTxt_(c.cliente)] || '');
  const datos = { docs, cob, gas, deps, depDe, kilos };

  // 1) Una hoja por vendedor
  r.porVendedor.forEach(t => hojaVendedor_(ss, fecha, t, usuarios[t.vendedor], datos));

  // 2) Resumen del día
  const fechaTxt = f[2] + '-' + f[1] + '-' + f[0];
  const R = new Hoja_(ss, 'RESUMEN', 17);
  R.titulo('RESUMEN RENDICIÓN ' + fechaTxt, 'Cecinas Naranjo');
  R.tabla('', [{ h: 'VENDEDOR' }, { h: 'DOCS', sum: 1 }, { h: 'VENTA', t: '$', sum: 1 }, { h: 'CRÉDITO', t: '$', sum: 1 }, { h: 'DESCUENTOS', t: '$', sum: 1 },
    { h: 'EFECTIVO', t: '$', sum: 1 }, { h: 'TRANSF. BICE', t: '$', sum: 1 }, { h: 'TRANSF. ESTADO', t: '$', sum: 1 }, { h: 'TRANSF. SANTANDER', t: '$', sum: 1 },
    { h: 'CHEQUE', t: '$', sum: 1 }, { h: 'COBRANZA', t: '$', sum: 1 }, { h: 'GASTOS', t: '$', sum: 1 }, { h: 'DEPÓSITOS', t: '$', sum: 1 },
    { h: 'EFECTIVO A ENTREGAR', t: '$', sum: 1 }, { h: 'KG VENDIDOS', t: 'kg', sum: 1 }, { h: 'KG FACTURADOS', t: 'kg', sum: 1 }, { h: 'DIF. KILOS $ (A DESCONTAR)', t: '$', sum: 1 }],
    r.porVendedor.map(t => [(usuarios[t.vendedor] || {}).nombre || t.vendedor, t.documentos, t.venta, t.credito, t.descuentos, t.EFECTIVO,
      t.bancos.BICE, t.bancos.ESTADO, t.bancos.SANTANDER, t.CHEQUE, t.cobranza, t.gastos, t.depositos, t.efectivoEntregar, t.kilos.vendido, t.kilos.facturado, t.kilos.diferenciaPesos]));
  const sumM = a => a.reduce((x, y) => x + num_(y.monto), 0);
  const prov = byFecha_('PROVEEDORES', fecha), cons = byFecha_('CONSUMO', fecha);
  R.tabla('OTROS MOVIMIENTOS', [{ h: 'CONCEPTO' }, { h: 'MONTO', t: '$', sum: 0 }], [['Proveedores', sumM(prov)], ['Consumo (venta en bodega)', sumM(cons)], ['Gastos generales', sumM(gas.filter(x => x.responsable === 'GENERAL'))]]);
  R.escribir([150, 55, 100, 100, 90, 100, 100, 105, 120, 90, 95, 85, 95, 120, 90, 100, 130]);

  // 3) Proveedores, consumo y gastos generales
  const P = new Hoja_(ss, 'PROVEEDORES', 7); P.titulo('PROVEEDORES ' + fechaTxt);
  P.tabla('', [{ h: 'PROVEEDOR' }, { h: 'DOCUMENTO' }, { h: 'FOLIO' }, { h: 'MONTO', t: '$', sum: 1 }, { h: 'FORMA DE PAGO' }, { h: 'OBSERVACIÓN' }, { h: 'ARCHIVO' }],
    prov.map(x => [x.proveedor, x.documento, x.folio, num_(x.monto), etiquetaForma_(x.forma), x.obs, linkAdj_(x)]));
  P.escribir([220, 110, 80, 100, 130, 220, 80]);
  const K = new Hoja_(ss, 'CONSUMO', 5); K.titulo('CONSUMO (VENTAS EN BODEGA) ' + fechaTxt);
  K.tabla('', [{ h: 'CLIENTE' }, { h: 'FOLIO' }, { h: 'MONTO', t: '$', sum: 1 }, { h: 'FORMA DE PAGO' }, { h: 'OBSERVACIÓN' }],
    cons.map(x => [x.cliente, x.folio, num_(x.monto), etiquetaForma_(x.forma), x.obs]));
  K.escribir([220, 80, 100, 130, 220]);
  const dvs = byFecha_('DEVOLUCIONES', fecha);
  if (dvs.length) {
    const DV = new Hoja_(ss, 'DEVOLUCIONES', 10); DV.titulo('DEVOLUCIONES (MERMAS Y REPROCESOS) ' + fechaTxt);
    DV.tabla('', [{ h: 'TIPO' }, { h: 'PRODUCTO' }, { h: 'CANTIDAD', t: 'kg', sum: 0 }, { h: 'UNIDAD' }, { h: 'VIENE DE' }, { h: 'CLIENTE' }, { h: 'N° NOTA DE CRÉDITO' }, { h: 'MONTO NC', t: '$', sum: 1 }, { h: 'MOTIVO' }, { h: 'FOTO NC' }],
      dvs.map(x => [x.tipo, x.producto, num_(x.cantidad), x.unidad, x.origen ? ((usuarios[x.origen] || {}).nombre || x.origen) : 'Cliente / otro', x.cliente, x.nota_credito, num_(x.monto), x.motivo, linkAdj_(x)]));
    DV.escribir([90, 220, 80, 70, 150, 200, 140, 100, 200, 80]);
  }
  const cef = byFecha_('CONTEO_EFECTIVO', fecha);
  if (cef.length) {
    const nom = u => (usuarios[u] || {}).nombre || u, esp = {}; r.porVendedor.forEach(t => esp[t.vendedor] = t.efectivoEntregar);
    const vs = cef.filter(x => x.vendedor !== 'GENERAL'), gen = cef.find(x => x.vendedor === 'GENERAL') || {};
    const bil = x => BILLETES.reduce((a, b) => a + b * num_(x['b' + b]), 0);
    const totBil = vs.reduce((a, x) => a + bil(x), 0), cc = num_(gen.caja_chica);
    const EF = new Hoja_(ss, 'EFECTIVO A DEPOSITAR', 12); EF.titulo('CONTEO DE EFECTIVO Y DEPÓSITO ' + fechaTxt);
    EF.tabla('', [{ h: 'VENDEDOR' }, { h: 'ESPERADO', t: '$', sum: 1 }, { h: '$20.000' }, { h: '$10.000' }, { h: '$5.000' }, { h: '$2.000' }, { h: '$1.000' },
      { h: 'BILLETES', t: '$', sum: 1 }, { h: 'MONEDAS', t: '$', sum: 1 }, { h: 'CONTADO', t: '$', sum: 1 }, { h: 'DIFERENCIA', t: '$', sum: 1 }],
      vs.map(x => [nom(x.vendedor), esp[x.vendedor] || 0, num_(x.b20000), num_(x.b10000), num_(x.b5000), num_(x.b2000), num_(x.b1000), bil(x), num_(x.monedas), bil(x) + num_(x.monedas), bil(x) + num_(x.monedas) - (esp[x.vendedor] || 0)]));
    EF.tabla('A DEPOSITAR', [{ h: 'CONCEPTO' }, { h: 'MONTO', t: '$', sum: 0 }],
      [['Billetes contados', totBil], ['(−) Caja chica' + (gen.obs ? ' · ' + gen.obs : ''), -cc], ['EFECTIVO A DEPOSITAR (las monedas no se depositan)', totBil - cc]]);
    EF.escribir([150, 100, 70, 70, 70, 70, 70, 100, 90, 100, 100, 10]);
  }
  const GG = new Hoja_(ss, 'GASTOS', 6); GG.titulo('GASTOS ' + fechaTxt);
  GG.tabla('', [{ h: 'RESPONSABLE' }, { h: 'CONCEPTO' }, { h: 'N° BOLETA' }, { h: 'MONTO', t: '$', sum: 1 }, { h: 'OBSERVACIÓN' }, { h: 'FOTO / ARCHIVO' }],
    gas.map(x => [(usuarios[x.responsable] || {}).nombre || (x.responsable === 'GENERAL' ? 'General planta' : x.responsable), x.concepto, x.respaldo, num_(x.monto), x.obs, linkAdj_(x)]));
  GG.escribir([150, 200, 120, 100, 220, 100]);

  // 4) Hojas para copiar al RESUMEN RENDICION histórico (mismas columnas y orden que la planilla actual)
  const lbl = { EFECTIVO: 'EFECTIVO', TRANSFERENCIA: 'TRANSFERENCIA', DEP_EFECTIVO: 'DEP. EFECTIVO', CHEQUE: 'CHEQUE', CREDITO: 'CREDITO', NOTA_CREDITO: 'NC' };
  const VC = new Hoja_(ss, 'VENTA Y CREDITO', 17);
  VC.tabla('', ['CLIENTES','DOCUMENTO','FOLIO','FECHA','MONTO','CONDICION','CONTADO','CREDITO','N.CREDITO','FORMA DE PAGO','NC CREDITOS','EFECTIVO','TRANSFERENCIA','CHEQUE','VENDEDOR','DESCUENTO','RUT']
    .map((h, i) => ({ h, t: [4, 6, 7, 8, 10, 11, 12, 13, 15].indexOf(i) >= 0 ? '$' : '' })),
    docs.map(d => {
      const sm = k => d.pagos.filter(p => p.forma === k).reduce((a, p) => a + p.monto, 0);
      const cred = sm('CREDITO'), nc = sm('NOTA_CREDITO'), dep = bancoDep[d.folio_key];
      const ef = sm('EFECTIVO');
      const formas = d.pagos.map(p => (p.forma === 'EFECTIVO' && dep ? 'DEP. EFECTIVO ' + dep : lbl[p.forma] + (p.banco ? ' ' + p.banco : '')) +
        (d.pagos.length > 1 ? ' (' + p.monto + ')' : '')).join(' Y ');
      return [d.cliente, d.tipo, Number(d.folio) || d.folio, fechaTxt, d.total, cred >= d.total ? 'Crédito' : (cred ? 'Mixto' : 'Contado'),
        d.total - cred, cred, nc, formas, 0, dep ? 0 : ef, sm('TRANSFERENCIA') + sm('DEP_EFECTIVO') + (dep ? ef : 0), sm('CHEQUE'), d.vendedor, d.descAprob, d.rut || ''];
    }));
  VC.escribir([260, 130, 70, 85, 90, 80, 90, 90, 80, 170, 80, 90, 105, 85, 100, 85, 95]);
  const CO = new Hoja_(ss, 'COBRANZA', 10);
  CO.tabla('', ['FECHA','CLIENTE','FOLIO','MONTO','FORMA DE PAGO','EFECTIVO','TRANSFERENCIA','CHEQUE','VENDEDOR','RUT'].map((h, i) => ({ h, t: [3, 5, 6, 7].indexOf(i) >= 0 ? '$' : '' })),
    cob.map(c => { const dep = bancoDep['C:' + c.id], m = num_(c.monto);
      return [fechaTxt, c.cliente, c.folio, m, dep ? 'DEP. EFECTIVO ' + dep : lbl[c.forma] + (c.banco ? ' ' + c.banco : ''),
        c.forma === 'EFECTIVO' && !dep ? m : 0, (c.forma === 'TRANSFERENCIA' || c.forma === 'DEP_EFECTIVO' || dep) ? m : 0, c.forma === 'CHEQUE' ? m : 0, c.vendedor, c.rut]; }));
  CO.escribir([85, 260, 70, 90, 170, 90, 105, 85, 100, 95]);

  const def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (def) ss.deleteSheet(def);
  ss.setActiveSheet(ss.getSheets()[0]);
  return ss.getUrl();
}
function etiquetaForma_(f) { return ({ EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', DEP_EFECTIVO: 'Depósito en efectivo', CHEQUE: 'Cheque', CREDITO: 'Crédito', NOTA_CREDITO: 'Nota de crédito' })[f] || f || ''; }

function sub_(folder, name) {
  const it = folder.getFoldersByName(name);
  return it.hasNext() ? it.next() : folder.createFolder(name);
}

function historial(token) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return read_('RENDICIONES').map(x => ({ fecha: x.fecha, estado: x.estado, cerrado_por: x.cerrado_por, url: x.archivo_url }))
    .sort((a, b) => a.fecha < b.fecha ? 1 : -1).slice(0, 60);
}
