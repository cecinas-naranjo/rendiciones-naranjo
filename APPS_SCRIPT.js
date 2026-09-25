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
  APP_NAME: 'Rendiciones Naranjo'
};

const SCHEMA = {
  USUARIOS:    ['usuario','nombre','rol','pin','terminales','activo'],
  PRODUCTOS:   ['codigo','nombre','unidad','tipo','orden','activo'],
  DESPACHO:    ['id','fecha','vendedor','codigo','producto','unidad','salida','retorno','obs','actualizado_por','actualizado'],
  DOCUMENTOS:  ['folio_key','fecha','tipo','folio','rut','cliente','total','condicion_dte','terminal','vendedor','estado','importado'],
  PAGOS:       ['id','folio_key','fecha','vendedor','forma','banco','monto','referencia','registrado_por','registrado'],
  DESCUENTOS:  ['id','folio_key','fecha','vendedor','cliente','monto','motivo','estado','solicitado_por','autorizado_por','resuelto'],
  COBRANZA:    ['id','fecha','vendedor','cliente','folio','monto','forma','banco','referencia','registrado_por','registrado'],
  PROVEEDORES: ['id','fecha','proveedor','documento','folio','monto','forma','obs','registrado_por','registrado'],
  CONSUMO:     ['id','fecha','cliente','folio','monto','forma','obs','registrado_por','registrado'],
  GASTOS:      ['id','fecha','responsable','concepto','monto','respaldo','obs','registrado_por','registrado'],
  RENDICIONES: ['fecha','estado','cerrado_por','cerrado','archivo_url','resumen_json'],
  SESIONES:    ['token','usuario','creado']
};

// Formas de pago estructuradas (reemplazan el texto libre "ESTADO Y EF 20000", etc.)
const FORMAS = ['EFECTIVO','TRANSFERENCIA','DEP_EFECTIVO','CHEQUE','CREDITO','NOTA_CREDITO'];
const BANCOS = ['BICE','ESTADO','SANTANDER','OTRO'];
const ROLES_AUTORIZAN = ['ADMIN','SUPERVISOR'];

/* ============================ SETUP ============================ */

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SCHEMA).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  // Folios y RUT como texto para no perder ceros ni formatos
  ss.getSheetByName('DOCUMENTOS').getRange('A:E').setNumberFormat('@');

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
      ['SALA','Venta en bodega (consumo)','VENDEDOR','1007','',true]
    ]);
    us.getRange('D:D').setNumberFormat('@');
  }
  const ps = ss.getSheetByName('PRODUCTOS');
  if (ps.getLastRow() === 1) {
    const base = [
      ['LONG','Longaniza','KG','ELABORADO'],['LONGC','Longaniza casera','KG','ELABORADO'],
      ['PRIE','Prieta','KG','ELABORADO'],['CHOR','Chorizo','KG','ELABORADO'],
      ['VIEN','Vienesa','KG','ELABORADO'],['MORL','Mortadela lisa','KG','ELABORADO'],
      ['MORJ','Mortadela jamonada','KG','ELABORADO'],['QCAB','Queso de cabeza','KG','ELABORADO'],
      ['ARRH','Arrollado huaso','KG','ELABORADO'],['PATE','Paté','KG','ELABORADO'],
      ['SALC','Salchichón cervecero','KG','ELABORADO'],['JAMO','Jamón','KG','ELABORADO'],
      ['CONG','Congelados (reventa)','UN','REVENTA']
    ].map((r, i) => r.concat([i + 1, true]));
    ps.getRange(2, 1, base.length, 6).setValues(base);
  }
  const d = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (d && ss.getSheets().length > 1) ss.deleteSheet(d);
  return 'Listo';
}

/* ============================ API ============================ */

// Funciones que la app puede llamar. Cualquier otra se rechaza.
const API = {
  listaUsuarios, login, logout, catalogo, getDespacho, saveDespacho, importarDTE, asignarVendedor,
  misDocumentos, guardarDetalle, descuentosPendientes, resolverDescuento, listarMov, guardarMov,
  borrarMov, getResumen, cerrarRendicion, reabrirRendicion, historial
};

function doGet() { return json_({ ok: true, app: CFG.APP_NAME }); }

// Cuerpo: {"fn":"nombre","args":[...]} enviado como text/plain (evita el preflight CORS)
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const fn = API[req.fn];
    if (!fn) throw new Error('Acción desconocida: ' + req.fn);
    return json_({ ok: true, data: fn.apply(null, req.args || []) });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ============================ HELPERS ============================ */

function sh_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function now_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function hoy_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
function uid_() { return Utilities.getUuid().slice(0, 8); }
function num_(v) {
  if (typeof v === 'number') return v;
  let s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234.567,5
  else s = s.replace(/,/g, '.');
  const n = Number(s); return isNaN(n) ? 0 : n;
}

function normFecha_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  let m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : s;
}

function read_(name) {
  const sh = sh_(name), last = sh.getLastRow();
  if (last < 2) return [];
  const head = SCHEMA[name];
  return sh.getRange(2, 1, last - 1, head.length).getValues().map((r, i) => {
    const o = { _row: i + 2 };
    head.forEach((h, j) => o[h] = r[j] instanceof Date && h === 'fecha' ? normFecha_(r[j]) : r[j]);
    if (o.fecha !== undefined) o.fecha = normFecha_(o.fecha);
    return o;
  });
}
function byFecha_(name, fecha) { return read_(name).filter(r => r.fecha === fecha); }

function append_(name, objs) {
  if (!objs.length) return;
  const head = SCHEMA[name], sh = sh_(name);
  sh.getRange(sh.getLastRow() + 1, 1, objs.length, head.length)
    .setValues(objs.map(o => head.map(h => o[h] === undefined ? '' : o[h])));
}
function updateRow_(name, row, obj) {
  const head = SCHEMA[name];
  sh_(name).getRange(row, 1, 1, head.length).setValues([head.map(h => obj[h] === undefined ? '' : obj[h])]);
}
function deleteRows_(name, rows) {
  const sh = sh_(name);
  rows.sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ============================ SESIÓN ============================ */

const SESION_DIAS = 30; // la sesión dura 30 días en el celular: nadie tiene que reingresar cada hora

function login(usuario, pin) {
  const u = read_('USUARIOS').find(x =>
    String(x.usuario).toUpperCase() === String(usuario).toUpperCase() &&
    String(x.pin) === String(pin) && String(x.activo).toUpperCase() !== 'FALSE');
  if (!u) { Utilities.sleep(800); throw new Error('Usuario o PIN incorrecto.'); }
  const token = Utilities.getUuid();
  withLock_(() => {
    const lim = new Date(Date.now() - SESION_DIAS * 864e5);
    deleteRows_('SESIONES', read_('SESIONES').filter(s => new Date(s.creado) < lim).map(s => s._row));
    append_('SESIONES', [{ token, usuario: u.usuario, creado: new Date().toISOString() }]);
  });
  CacheService.getScriptCache().put('s_' + token, u.usuario, 21600);
  return { token, usuario: u.usuario, nombre: u.nombre, rol: u.rol, puedeAutorizar: ROLES_AUTORIZAN.indexOf(u.rol) >= 0 };
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

function listaUsuarios() {
  return read_('USUARIOS').filter(u => String(u.activo).toUpperCase() !== 'FALSE')
    .map(u => ({ usuario: u.usuario, nombre: u.nombre, rol: u.rol }));
}

function vendedores_() {
  return read_('USUARIOS').filter(u => u.rol === 'VENDEDOR' && String(u.activo).toUpperCase() !== 'FALSE');
}

function catalogo(token) {
  auth_(token);
  return {
    hoy: hoy_(),
    productos: read_('PRODUCTOS').filter(p => String(p.activo).toUpperCase() !== 'FALSE')
      .sort((a, b) => (a.orden || 999) - (b.orden || 999))
      .map(p => ({ codigo: p.codigo, nombre: p.nombre, unidad: p.unidad, tipo: p.tipo })),
    vendedores: vendedores_().map(v => ({ usuario: v.usuario, nombre: v.nombre, terminales: v.terminales })),
    formas: FORMAS, bancos: BANCOS
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
  return byFecha_('DESPACHO', fecha).filter(r => r.vendedor === vendedor)
    .map(r => ({ codigo: r.codigo, salida: r.salida, retorno: r.retorno, obs: r.obs }));
}

function saveDespacho(token, fecha, vendedor, filas) {
  const u = auth_(token, ['BODEGA','RENDICION','SUPERVISOR']);
  assertAbierta_(fecha);
  return withLock_(() => {
    const prods = {}; read_('PRODUCTOS').forEach(p => prods[p.codigo] = p);
    const exist = byFecha_('DESPACHO', fecha).filter(r => r.vendedor === vendedor);
    const map = {}; exist.forEach(r => map[r.codigo] = r);
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
    const term = {};
    vendedores_().forEach(v => String(v.terminales || '').split(',').map(s => s.trim().toUpperCase())
      .filter(String).forEach(t => term[t] = v.usuario));
    const existentes = {}; read_('DOCUMENTOS').forEach(d => existentes[d.folio_key] = d);
    const nuevos = []; let guias = 0, repetidos = 0, sinVendedor = 0; const fechas = {};
    filas.forEach(f => {
      const tipo = String(f.Documento || '').trim();
      const folio = String(f.Folio || '').trim();
      if (!tipo || !folio) return;
      if (/gu[ií]a/i.test(tipo)) { guias++; return; }         // guías de despacho internas: no son venta
      const key = tipo.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() + '-' + folio;
      if (existentes[key]) { repetidos++; return; }
      const terminal = String(f['Emitido en'] || '').trim().toUpperCase();
      const vendedor = term[terminal] || '';
      if (!vendedor) sinVendedor++;
      const fecha = normFecha_(f.Fecha);
      fechas[fecha] = true;
      const cond = String(f.Condicion || '').trim();
      nuevos.push({ folio_key: key, fecha, tipo, folio, rut: String(f.RUT || f['Datos RUT'] || '').trim(),
        cliente: String(f['Nombre Cliente'] || '').trim(), total: num_(f.Total), condicion_dte: cond,
        terminal, vendedor, estado: 'PENDIENTE', importado: now_() });
      existentes[key] = true;
    });
    append_('DOCUMENTOS', nuevos);
    return { importados: nuevos.length, guias, repetidos, sinVendedor, fechas: Object.keys(fechas).sort() };
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

/* ============================ VENDEDOR: DETALLE POR FOLIO ============================ */

function docsDelDia_(fecha, vendedor) {
  const pagos = byFecha_('PAGOS', fecha), descs = byFecha_('DESCUENTOS', fecha);
  return byFecha_('DOCUMENTOS', fecha).filter(d => !vendedor || d.vendedor === vendedor).map(d => {
    const p = pagos.filter(x => x.folio_key === d.folio_key);
    const ds = descs.filter(x => x.folio_key === d.folio_key);
    const descAprob = ds.filter(x => x.estado === 'APROBADO').reduce((a, x) => a + num_(x.monto), 0);
    const pagado = p.reduce((a, x) => a + num_(x.monto), 0);
    return {
      folio_key: d.folio_key, tipo: d.tipo, folio: d.folio, cliente: d.cliente, rut: d.rut, total: num_(d.total),
      condicion_dte: d.condicion_dte, terminal: d.terminal, vendedor: d.vendedor, estado: d.estado,
      pagos: p.map(x => ({ forma: x.forma, banco: x.banco, monto: num_(x.monto), referencia: x.referencia })),
      descuentos: ds.map(x => ({ id: x.id, monto: num_(x.monto), motivo: x.motivo, estado: x.estado, autorizado_por: x.autorizado_por })),
      pagado, descAprob, diferencia: num_(d.total) - pagado - descAprob
    };
  });
}

function misDocumentos(token, fecha, vendedor) {
  const u = auth_(token);
  const v = u.rol === 'VENDEDOR' ? u.usuario : vendedor;
  return { estadoDia: estadoDia_(fecha), docs: docsDelDia_(fecha, v) };
}

/** pagos: [{forma, banco, monto, referencia}] — reemplaza el detalle anterior del folio */
function guardarDetalle(token, fecha, folio_key, pagos, descuento) {
  const u = auth_(token);
  assertAbierta_(fecha);
  return withLock_(() => {
    const d = read_('DOCUMENTOS').find(x => x.folio_key === folio_key);
    if (!d) throw new Error('Documento no encontrado');
    if (u.rol === 'VENDEDOR' && d.vendedor !== u.usuario) throw new Error('Este documento no es tuyo.');
    const limpios = (pagos || []).filter(p => num_(p.monto) > 0).map(p => {
      if (FORMAS.indexOf(p.forma) < 0) throw new Error('Forma de pago inválida: ' + p.forma);
      if ((p.forma === 'TRANSFERENCIA' || p.forma === 'DEP_EFECTIVO') && !p.banco) throw new Error('Indica el banco de la transferencia/depósito.');
      return p;
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
      banco: p.banco || '', monto: num_(p.monto), referencia: p.referencia || '', registrado_por: u.usuario, registrado: now_() })));

    // Descuentos: se reemplaza la solicitud pendiente; uno ya autorizado por el mismo monto se mantiene
    deleteRows_('DESCUENTOS', read_('DESCUENTOS').filter(x => x.folio_key === folio_key && x.estado === 'PENDIENTE').map(x => x._row));
    if (descMonto > 0 && !(aprobado && num_(aprobado.monto) === descMonto)) {
      append_('DESCUENTOS', [{ id: uid_(), folio_key, fecha: d.fecha, vendedor: d.vendedor, cliente: d.cliente,
        monto: descMonto, motivo: descuento.motivo || '', estado: 'PENDIENTE', solicitado_por: u.usuario, autorizado_por: '', resuelto: '' }]);
    }
    d.estado = 'DETALLADO'; updateRow_('DOCUMENTOS', d._row, d);
    return docsDelDia_(d.fecha, d.vendedor).find(x => x.folio_key === folio_key);
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
  CONSUMO: ['RENDICION','SUPERVISOR','BODEGA'],
  GASTOS: ['VENDEDOR','RENDICION','SUPERVISOR']
};

function listarMov(token, tabla, fecha) {
  const u = auth_(token, MOV_ROLES[tabla]);
  let rows = byFecha_(tabla, fecha);
  if (u.rol === 'VENDEDOR') rows = rows.filter(r => r.registrado_por === u.usuario);
  return rows.map(r => { delete r._row; if (r.monto !== undefined) r.monto = num_(r.monto); return r; });
}

function guardarMov(token, tabla, fecha, obj) {
  const u = auth_(token, MOV_ROLES[tabla]);
  assertAbierta_(fecha);
  if (num_(obj.monto) <= 0) throw new Error('Ingresa un monto mayor a cero.');
  return withLock_(() => {
    const o = Object.assign({}, obj, { id: uid_(), fecha, monto: num_(obj.monto), registrado_por: u.usuario, registrado: now_() });
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
    sh_(tabla).deleteRow(r._row); return true;
  });
}

/* ============================ RESUMEN / RENDICIÓN ============================ */

function resumen_(fecha) {
  const docs = docsDelDia_(fecha);
  const desp = byFecha_('DESPACHO', fecha);
  const cob = byFecha_('COBRANZA', fecha), gas = byFecha_('GASTOS', fecha);
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
    tot.credito = tot.CREDITO; tot.contado = tot.venta - tot.CREDITO - tot.descuentos;
    const c = cob.filter(x => x.vendedor === v);
    tot.cobranza = c.reduce((a, x) => a + num_(x.monto), 0);
    tot.cobranzaEfectivo = c.filter(x => x.forma === 'EFECTIVO').reduce((a, x) => a + num_(x.monto), 0);
    tot.gastos = gas.filter(x => x.responsable === v).reduce((a, x) => a + num_(x.monto), 0);
    tot.efectivoEntregar = tot.EFECTIVO + tot.cobranzaEfectivo - tot.gastos;
    const k = desp.filter(x => x.vendedor === v);
    tot.kilos = {
      salida: k.filter(x => x.unidad !== 'UN').reduce((a, x) => a + num_(x.salida), 0),
      retorno: k.filter(x => x.unidad !== 'UN').reduce((a, x) => a + num_(x.retorno), 0)
    };
    tot.kilos.vendido = tot.kilos.salida - tot.kilos.retorno;
    tot.sinRetorno = k.filter(x => x.salida !== '' && x.retorno === '').length;
    return tot;
  }).filter(t => t.documentos || t.kilos.salida || t.cobranza || t.gastos);

  const sinAsignar = docs.filter(d => !d.vendedor);
  const sum = (arr) => arr.reduce((a, x) => a + num_(x.monto), 0);
  return {
    fecha, estado: estadoDia_(fecha), porVendedor,
    sinAsignar: sinAsignar.map(d => ({ folio_key: d.folio_key, tipo: d.tipo, folio: d.folio, cliente: d.cliente, total: d.total, terminal: d.terminal })),
    totales: {
      venta: porVendedor.reduce((a, t) => a + t.venta, 0),
      credito: porVendedor.reduce((a, t) => a + t.credito, 0),
      efectivo: porVendedor.reduce((a, t) => a + t.efectivoEntregar, 0),
      cobranza: sum(cob), proveedores: sum(prov), consumo: sum(cons), gastos: sum(gas)
    },
    alertas: []
      .concat(sinAsignar.length ? [sinAsignar.length + ' documento(s) sin vendedor asignado'] : [])
      .concat(porVendedor.filter(t => t.pendientes).map(t => t.vendedor + ': ' + t.pendientes + ' folio(s) sin detallar'))
      .concat(porVendedor.filter(t => t.descPendientes).map(t => t.vendedor + ': descuentos por autorizar'))
      .concat(porVendedor.filter(t => t.sinRetorno).map(t => t.vendedor + ': falta registrar retorno de ' + t.sinRetorno + ' producto(s)'))
  };
}

function getResumen(token, fecha) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return resumen_(fecha);
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

function reabrirRendicion(token, fecha) {
  auth_(token, ['ADMIN']);
  return withLock_(() => {
    const reg = read_('RENDICIONES').find(x => x.fecha === fecha);
    if (reg) { reg.estado = 'REABIERTA'; updateRow_('RENDICIONES', reg._row, reg); }
    return true;
  });
}

/** Crea el archivo de rendición del día con el mismo formato de columnas que usa la empresa hoy. */
function generarArchivo_(fecha, r) {
  const f = fecha.split('-'), nombre = 'Rendición ' + f[2] + '-' + f[1] + '-' + f[0];
  const ss = SpreadsheetApp.create(nombre);
  const file = DriveApp.getFileById(ss.getId());
  try {
    const root = DriveApp.getFolderById(CFG.RENDICIONES_FOLDER_ID);
    const anio = sub_(root, f[0]), mes = sub_(anio, f[1]);
    file.moveTo(mes);
  } catch (e) { /* si no hay acceso a la carpeta queda en Mi unidad */ }

  const put = (titulo, head, rows) => {
    const s = ss.insertSheet(titulo);
    s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#F3D9C4');
    if (rows.length) s.getRange(2, 1, rows.length, head.length).setValues(rows);
    s.setFrozenRows(1); s.autoResizeColumns(1, head.length);
    return s;
  };
  const docs = docsDelDia_(fecha);
  const lbl = { EFECTIVO: 'EFECTIVO', TRANSFERENCIA: 'TRANSFERENCIA', DEP_EFECTIVO: 'DEP. EFECTIVO', CHEQUE: 'CHEQUE', CREDITO: 'CREDITO', NOTA_CREDITO: 'NC' };

  // Resumen por vendedor
  put('RESUMEN', ['VENDEDOR','DOCS','VENTA','CONTADO','CREDITO','DESCUENTOS','EFECTIVO','TRANSFERENCIA','DEP. EFECTIVO','CHEQUE','NC','COBRANZA','GASTOS','EFECTIVO A ENTREGAR','KG SALIDA','KG RETORNO','KG VENDIDOS'],
    r.porVendedor.map(t => [t.vendedor, t.documentos, t.venta, t.contado, t.credito, t.descuentos, t.EFECTIVO, t.TRANSFERENCIA,
      t.DEP_EFECTIVO, t.CHEQUE, t.NOTA_CREDITO, t.cobranza, t.gastos, t.efectivoEntregar, t.kilos.salida, t.kilos.retorno, t.kilos.vendido]));

  // Igual a la hoja "VENTA Y CREDITO" actual
  put('VENTA Y CREDITO', ['CLIENTES','DOCUMENTO','FOLIO','FECHA','MONTO','CONDICION','CONTADO','CREDITO','N.CREDITO','FORMA DE PAGO','NC CREDITOS','EFECTIVO','TRANSFERENCIA','CHEQUE','VENDEDOR','DESCUENTO'],
    docs.map(d => {
      const s = k => d.pagos.filter(p => p.forma === k).reduce((a, p) => a + p.monto, 0);
      const cred = s('CREDITO'), nc = s('NOTA_CREDITO');
      const formas = d.pagos.map(p => lbl[p.forma] + (p.banco ? ' ' + p.banco : '') + (d.pagos.length > 1 ? ' (' + p.monto + ')' : '')).join(' Y ');
      return [d.cliente, d.tipo, Number(d.folio) || d.folio, fecha, d.total, cred >= d.total ? 'Crédito' : (cred ? 'Mixto' : 'Contado'),
        d.total - cred, cred, nc, formas, 0, s('EFECTIVO'), s('TRANSFERENCIA') + s('DEP_EFECTIVO'), s('CHEQUE'), d.vendedor, d.descAprob];
    }));

  // Igual a la hoja "COBRANZA" actual
  put('COBRANZA', ['FECHA','CLIENTE','FOLIO','MONTO','FORMA DE PAGO','EFECTIVO','TRANSFERENCIA','CHEQUE','VENDEDOR'],
    byFecha_('COBRANZA', fecha).map(c => [fecha, c.cliente, c.folio, num_(c.monto), lbl[c.forma] + (c.banco ? ' ' + c.banco : ''),
      c.forma === 'EFECTIVO' ? num_(c.monto) : 0, (c.forma === 'TRANSFERENCIA' || c.forma === 'DEP_EFECTIVO') ? num_(c.monto) : 0,
      c.forma === 'CHEQUE' ? num_(c.monto) : 0, c.vendedor]));

  put('KILOS', ['VENDEDOR','CODIGO','PRODUCTO','UNIDAD','SALIDA','RETORNO','VENDIDO'],
    byFecha_('DESPACHO', fecha).map(k => [k.vendedor, k.codigo, k.producto, k.unidad, num_(k.salida), num_(k.retorno), num_(k.salida) - num_(k.retorno)]));
  put('PROVEEDORES', ['PROVEEDOR','DOCUMENTO','FOLIO','MONTO','FORMA','OBS'],
    byFecha_('PROVEEDORES', fecha).map(x => [x.proveedor, x.documento, x.folio, num_(x.monto), x.forma, x.obs]));
  put('CONSUMO', ['CLIENTE','FOLIO','MONTO','FORMA','OBS'],
    byFecha_('CONSUMO', fecha).map(x => [x.cliente, x.folio, num_(x.monto), x.forma, x.obs]));
  put('GASTOS', ['RESPONSABLE','CONCEPTO','MONTO','RESPALDO','OBS'],
    byFecha_('GASTOS', fecha).map(x => [x.responsable, x.concepto, num_(x.monto), x.respaldo, x.obs]));
  put('DESCUENTOS', ['FOLIO','CLIENTE','VENDEDOR','MONTO','MOTIVO','ESTADO','AUTORIZADO POR'],
    byFecha_('DESCUENTOS', fecha).map(x => [x.folio_key, x.cliente, x.vendedor, num_(x.monto), x.motivo, x.estado, x.autorizado_por]));

  const def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (def) ss.deleteSheet(def);
  ss.getSheets().forEach(s => { if (s.getName() !== 'KILOS') s.getRange('B2:Q').setNumberFormat('#,##0'); });
  ss.getSheetByName('KILOS').getRange('E2:G').setNumberFormat('#,##0.0');
  ss.getSheetByName('RESUMEN').getRange('O2:Q').setNumberFormat('#,##0.0');
  return ss.getUrl();
}

function sub_(folder, name) {
  const it = folder.getFoldersByName(name);
  return it.hasNext() ? it.next() : folder.createFolder(name);
}

function historial(token) {
  auth_(token, ['RENDICION','SUPERVISOR']);
  return read_('RENDICIONES').map(x => ({ fecha: x.fecha, estado: x.estado, cerrado_por: x.cerrado_por, url: x.archivo_url }))
    .sort((a, b) => a.fecha < b.fecha ? 1 : -1).slice(0, 60);
}
