/* ============================================================
   Rendiciones Naranjo — app (frontend)
   Todos los datos pasan por Apps Script (CONFIG.APPS_SCRIPT_URL).
   ============================================================ */

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clp = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
const kg = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const soloDigitos = v => Number(String(v).replace(/\D/g, '')) || 0;
const dec = v => Number(String(v).replace(',', '.')) || 0;
const fechaLarga = iso => { const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }); };
const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const FL = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', DEP_EFECTIVO: 'Depósito en efectivo', CHEQUE: 'Cheque', CREDITO: 'Crédito', NOTA_CREDITO: 'Nota de crédito' };
const CATS = { PROPIOS: 'Productos propios', CARNICOS: 'Cárnicos', CONGELADOS: 'Congelados', LACTEOS: 'Lácteos', LAMINADOS: 'Laminados, quesos y verduras', REVISAR: 'Por clasificar' };
const ROL = { ADMIN: 'Administración', SUPERVISOR: 'Supervisión', RENDICION: 'Rendición', BODEGA: 'Bodega', VENDEDOR: 'Vendedor' };

const IC = {
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  receipt: '<path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3z"/><path d="M9 9h6M9 13h6"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
  stack: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5l9 5 9-5" opacity=".5"/>',
  clip: '<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  camera: '<path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/>',
  store: '<path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M3 9h18M9 20v-6h6v6"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5c2.2.7 3.5 2.6 3.5 5.5"/>',
  dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  out: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;

let cargando = 0;
function busy(on) {
  cargando += on ? 1 : -1;
  let b = $('.load');
  if (cargando > 0 && !b) { b = document.createElement('div'); b.className = 'load'; document.body.appendChild(b); }
  if (cargando <= 0 && b) { b.remove(); cargando = 0; }
}
function toast(msg, err) {
  $$('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' e' : ''); t.setAttribute('role', 'status');
  t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), err ? 5500 : 2600);
}
const skeleton = n => '<div class="sk t"></div><div class="sk s"></div>' + Array.from({ length: n }, () => '<div class="sk"></div>').join('');
function render(el, html) {
  el.innerHTML = html;
  if (S.silencio) return;                       // actualización por detrás: sin animación ni salto
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  animarMontos(el);
}
/** Los totales de las tarjetas resumen "suben" desde cero al abrir la pantalla (solo se ve, el valor final es el real). */
function animarMontos(raiz) {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('.kpis b', raiz).forEach(el => {
    const txt = el.textContent.trim(), m = txt.match(/^\$([\d.]+)$/); if (!m) return;
    const fin = Number(m[1].replace(/\./g, '')); if (!(fin > 0)) return;
    const t0 = performance.now(), dur = 650, tk = el._tk = (el._tk || 0) + 1;
    const paso = t => { if (el._tk !== tk) return; const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k < 1 ? clp(fin * e) : txt; if (k < 1) requestAnimationFrame(paso); };
    el.textContent = '$0'; requestAnimationFrame(paso);
  });
}

/* ---------- fotos y archivos de respaldo ---------- */
const ADJ = { GASTOS: 1, COBRANZA: 1, PROVEEDORES: 1, DEPOSITOS: 1, DEVOLUCIONES: 1 };
/** Achica las fotos (máx. 1600 px, JPEG) para que suban rápido con datos móviles. */
async function prepararArchivo(f) {
  let blob = f, nombre = f.name || 'archivo', tipo = f.type || 'application/octet-stream';
  if (/^image\/(jpe?g|png|webp|heic|heif)/i.test(tipo)) {
    try {
      const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' });
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
      if (b) { blob = b; tipo = 'image/jpeg'; nombre = nombre.replace(/\.\w+$/, '') + '.jpg'; }
    } catch (e) { /* si el navegador no puede leerla, se sube tal cual */ }
  }
  if (blob.size > 15 * 1024 * 1024) throw new Error(`"${nombre}" pesa más de 15 MB.`);
  const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
  return { nombre, mimeType: tipo, data };
}
async function subirArchivos(tabla, id, files) {
  let n = 0;
  for (const f of files) {
    n++; toast(`Subiendo ${files.length > 1 ? n + ' de ' + files.length : 'archivo'}…`);
    const a = await prepararArchivo(f);
    await api('subirAdjunto', S.sess.token, Object.assign({ tabla, id }, a));
  }
  if (n) toast(n === 1 ? 'Archivo guardado' : n + ' archivos guardados');
}
const chipsAdj = (adj, tabla, id, editable) => (adj || []).map((a, i) =>
  `<a class="chip cu" href="${esc(a.url)}" target="_blank" rel="noopener" title="Ver archivo">${icon('clip')}${i + 1}</a>`).join(' ') +
  (editable ? ` <button type="button" class="chip" data-adj="${esc(id)}" data-tabla="${tabla}" title="Adjuntar foto o archivo">${icon('camera')} Adjuntar</button>` : '');
/** Un solo input oculto para "adjuntar después" en cualquier fila. */
function activarAdjuntarDespues(cont, alTerminar) {
  let inp = $('#adjLater');
  if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'adjLater'; inp.accept = 'image/*,application/pdf'; inp.multiple = true; inp.className = 'sr'; document.body.appendChild(inp); }
  cont.addEventListener('click', e => { const b = e.target.closest('[data-adj]'); if (!b) return;
    if (String(b.dataset.adj).indexOf('pend_') === 0) return toast('Este registro aún no se envía. Podrás adjuntar el archivo cuando se envíe.', true);
    inp.value = ''; inp.onchange = async () => { const fs = [...inp.files]; if (!fs.length) return;
      try { await subirArchivos(b.dataset.tabla, b.dataset.adj, fs); } finally { alTerminar(); } };
    inp.click(); });
}
const campoArchivos = id => `<div><label class="f">Foto o archivo de respaldo</label>
  <label class="btn ghost block" style="font-weight:600">${icon('camera')}<span id="${id}L">Tomar foto o elegir archivo</span>
  <input type="file" id="${id}" accept="image/*,application/pdf" multiple class="sr"></label></div>`;
function enlazarCampoArchivos(id) {
  const i = $('#' + id); if (!i) return;
  i.onchange = () => { $('#' + id + 'L').textContent = i.files.length ? (i.files.length === 1 ? i.files[0].name : i.files.length + ' archivos listos') : 'Tomar foto o elegir archivo'; };
}

/* ---------- conexión con el servidor ----------
   Velocidad: las consultas (no los guardados) se guardan en el teléfono. Al volver a una pantalla se muestra
   al instante lo último que se vio y, por detrás, se pide lo nuevo; si cambió, la pantalla se actualiza sola
   (salvo que la persona ya esté escribiendo). Cualquier guardado borra lo guardado para no mostrar datos viejos. */
const LECTURA = new Set(['listaUsuarios', 'catalogo', 'misDocumentos', 'getDespacho', 'getInventario', 'getSaldosClientes', 'listarTerminales',
  'getResumen', 'getInspeccion', 'descuentosPendientes', 'efectivoParaDepositar', 'historial', 'listarMov', 'listarDevoluciones', 'getConteoEfectivo', 'porCobrar', 'listarCheques', 'listarUsuariosAdmin']);
const MSG = { login: 'Ingresando…', catalogo: 'Preparando la app…', importarDTE: 'Importando ventas de Mi DTE…', importarDetalle: 'Importando detalle de productos…',
  cerrarRendicion: 'Generando el archivo de rendición…', vistaPreviaRendicion: 'Armando el borrador…', generarPlanillaInventario: 'Armando la planilla de inventario…',
  subirAdjunto: 'Subiendo archivo…', getResumen: 'Calculando la rendición…', getInventario: 'Calculando el inventario…', getSaldosClientes: 'Calculando saldos…',
  misDocumentos: 'Cargando folios…', getInspeccion: 'Preparando el detalle…', xlsx: 'Preparando el lector de Excel…', getDespacho: 'Cargando despacho…', listarMov: 'Cargando…', listarDevoluciones: 'Cargando devoluciones…', getConteoEfectivo: 'Cargando el conteo…', porCobrar: 'Buscando lo que hay por cobrar…', listarCheques: 'Cargando los cheques…', listarUsuariosAdmin: 'Cargando usuarios…', guardarUsuario: 'Guardando el usuario…', restablecerClave: 'Generando la clave…', marcarCheque: 'Guardando…', cargarCreditos: 'Cargando la lista de créditos…', generarPlanillaPorCobrar: 'Armando la planilla por cobrar…', reintentarRut: 'Buscando RUT…', historial: 'Cargando historial…' };
const textoBoton = fn => /^(guardar|save|resolver|asignar)/.test(fn) ? 'Guardando…' : /^importar/.test(fn) ? 'Importando…' : /^borrar/.test(fn) ? 'Borrando…'
  : /^cerrar/.test(fn) ? 'Cerrando…' : /^(generar|vista)/.test(fn) ? 'Generando…' : /^subir/.test(fn) ? 'Subiendo…' : fn === 'login' ? 'Ingresando…' : 'Procesando…';

const CACHE = new Map();
try { Object.entries(JSON.parse(localStorage.getItem('rn_cache') || '{}')).forEach(([k, v]) => CACHE.set(k, v)); } catch (e) {}
let tGuardarCache = 0;
function guardarCache() {
  clearTimeout(tGuardarCache);
  tGuardarCache = setTimeout(() => {
    const ult = [...CACHE.entries()].sort((a, b) => b[1].t - a[1].t).slice(0, 60);
    try { localStorage.setItem('rn_cache', JSON.stringify(Object.fromEntries(ult))); }
    catch (e) { try { localStorage.removeItem('rn_cache'); } catch (e2) {} }
  }, 400);
}
function olvidarCache(todo) {
  if (todo) CACHE.clear();
  else CACHE.forEach((v, k) => { if (!/^listaUsuarios\|/.test(k)) v.viejo = true; });     // tras guardar algo: se muestran al instante y se actualizan por detrás
  guardarCache();
}
const claveApi = (fn, args) => fn + '|' + JSON.stringify(args);
const FRESCURA = 20e3;      // si lo guardado tiene menos de 20 s no se vuelve a pedir al servidor

// indicador "trabajando": barra arriba + aviso abajo con el mensaje; el botón tocado muestra su propio "Guardando…"
let ultimoClic = null;
document.addEventListener('click', e => { const b = e.target.closest('button, .btn'); if (b) ultimoClic = { el: b, t: Date.now() }; }, true);
const AVISOS = new Map(); let nAviso = 0;
function pintarAviso() {
  let p = $('.working');
  const txt = [...AVISOS.values()].pop();
  if (!txt) { if (p) { p.classList.add('out'); setTimeout(() => p.isConnected && !AVISOS.size && p.remove(), 180); } return; }
  if (!p) { p = document.createElement('div'); p.className = 'working'; p.setAttribute('role', 'status'); p.innerHTML = '<span class="spin"></span><span></span>'; document.body.appendChild(p); }
  p.classList.remove('out'); p.lastChild.textContent = txt;
}
function trabajando(fn, escritura) {
  busy(true);
  const id = ++nAviso, timers = [];
  const decir = t => { AVISOS.set(id, t); pintarAviso(); };
  let btn = null;
  if (escritura && ultimoClic && Date.now() - ultimoClic.t < 900 && ultimoClic.el.isConnected && !ultimoClic.el.classList.contains('busy')) {
    btn = ultimoClic.el; ultimoClic = null;
    btn._html = btn.innerHTML; btn._w = btn.style.minWidth;
    btn.style.minWidth = btn.offsetWidth + 'px';
    btn.classList.add('busy'); btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>' + textoBoton(fn);
  }
  // si el botón ya muestra "Guardando…", el aviso de abajo solo aparece si se demora
  if (!btn || MSG[fn]) timers.push(setTimeout(() => decir(MSG[fn] || (escritura ? textoBoton(fn) : 'Cargando…')), btn ? 1500 : escritura ? 150 : 500));
  timers.push(setTimeout(() => decir('Sigue trabajando… Google a veces tarda unos segundos.'), 6000));
  timers.push(setTimeout(() => decir('Está tardando más de lo normal. No cierres la app.'), 16000));
  return () => {
    busy(false); timers.forEach(clearTimeout); AVISOS.delete(id); pintarAviso();
    if (btn && btn.classList.contains('busy')) { btn.innerHTML = btn._html; btn.style.minWidth = btn._w || ''; btn.classList.remove('busy'); btn.disabled = false; }
  };
}

async function llamar(fn, args, extra) {
  let r; const ctl = new AbortController(), reloj = setTimeout(() => ctl.abort(), extra && extra.op ? 45000 : 60000);
  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ fn, args }, extra || {})), signal: ctl.signal });
    r = await res.json();
  } catch (e) {
    EN_LINEA = false; pintarRed();
    const er = new Error('Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.'); er.red = true; throw er;
  } finally { clearTimeout(reloj); }
  if (!EN_LINEA) { EN_LINEA = true; pintarRed(); setTimeout(sincronizar, 50); }
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
const EN_CURSO = new Map();
function pedir(fn, args, key, extra) {                    // si ya se está pidiendo lo mismo, se reutiliza esa respuesta
  if (EN_CURSO.has(key)) return EN_CURSO.get(key);
  const p = llamar(fn, args, extra).then(d => { if (LECTURA.has(fn)) { CACHE.set(key, { t: Date.now(), d }); guardarCache(); } return d; })
    .finally(() => EN_CURSO.delete(key));
  EN_CURSO.set(key, p); return p;
}
const copia = d => JSON.parse(JSON.stringify(d));
/** Pide varias consultas en UNA sola llamada al servidor y deja cada respuesta en la caché. Devuelve cuántas se guardaron. */
async function pedirLote(items) {
  items = items.filter(x => LECTURA.has(x[0]));
  if (!items.length) return 0;
  const res = await llamar('batch', [items.map(x => [x[0], x[1]])]);
  let n = 0;
  res.forEach((r, i) => { if (r && r.ok) { CACHE.set(claveApi(items[i][0], items[i][1]), { t: Date.now(), d: r.data }); n++; } });
  if (n) guardarCache();
  return n;
}
function errorApi(e) {
  const m = String(e.message || e);
  if (m.indexOf('SESION') >= 0) salir(true);
  toast(m.replace('SESION: ', ''), true);
}

async function api(fn, ...args) {
  if (S.sess && COLA_FN.has(fn)) return escribir(fn, args);
  if ((fn === 'borrarMov' && String(args[2]).indexOf('pend_') === 0) || (fn === 'borrarDevolucion' && String(args[1]).indexOf('pend_') === 0)) {
    const id = String(args[fn === 'borrarMov' ? 2 : 1]); PEND = PEND.filter(p => 'pend_' + p.op !== id); guardarPend(); return true;       // aún no se había enviado: solo se cancela
  }
  const lectura = LECTURA.has(fn), key = claveApi(fn, args);
  if (lectura && CACHE.has(key) && (Date.now() - CACHE.get(key).t < 12 * 3600e3 || !EN_LINEA)) {
    const e = CACHE.get(key);
    if (EN_LINEA && (e.viejo || Date.now() - e.t > FRESCURA)) revalidar(fn, args, key);
    return superponer(fn, args, copia(e.d));
  }
  if (!lectura) olvidarCache(false);
  const fin = trabajando(fn, !lectura);
  try { return superponer(fn, args, copia(await pedir(fn, args, key))); }
  catch (e) {
    if (e.red && lectura) { toast('Sin conexión: esta pantalla todavía no se había abierto con internet.', true); throw e; }
    errorApi(e); throw e; }
  finally { fin(); }
}

/* ---------- modo sin conexión ----------
   Lo que se guarda sin internet queda en el teléfono (cola persistente, sobrevive aunque se cierre la app) y se envía solo, en orden,
   cuando vuelve la conexión. Las pantallas ya vistas se muestran desde la memoria del teléfono con lo pendiente superpuesto.
   El servidor reconoce los reenvíos (`op`) para no duplicar registros. */
const COLA_FN = new Set(['guardarDetalle', 'guardarVarios', 'guardarMov', 'borrarMov', 'guardarCobro', 'guardarDevolucion', 'saveDespacho', 'guardarDeposito', 'guardarConteoEfectivo']);
let EN_LINEA = navigator.onLine !== false, sincronizando = false;
let PEND = []; try { PEND = JSON.parse(localStorage.getItem('rn_cola') || '[]'); } catch (e) {}
const idOp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pendDe = () => PEND.filter(p => S.sess && p.usuario === S.sess.usuario);
const pendActivos = () => pendDe().filter(p => !p.error);
function guardarPend() {
  try { localStorage.setItem('rn_cola', JSON.stringify(PEND)); }
  catch (e) { toast('El teléfono no tiene espacio para guardar más cambios sin conexión.', true); }
  pintarRed();
}
async function escribir(fn, args) {
  const resto = args.slice(1), op = idOp(); let enviado = false;
  if (EN_LINEA && !pendActivos().length) {
    const key = claveApi(fn, args), fin = trabajando(fn, true);
    try { const r = copia(await pedir(fn, args, key, { op })); olvidarCache(false); return r; }
    catch (e) { if (!e.red) { errorApi(e); throw e; } enviado = true; }        // se cortó: puede haber llegado o no; el reenvío lo comprueba
    finally { fin(); }
  }
  PEND.push({ op, fn, args: resto, usuario: S.sess.usuario, t: Date.now(), enviado, error: '' });
  guardarPend(); olvidarCache(false);
  if (EN_LINEA) setTimeout(sincronizar, 50);
  return { _pendiente: true, id: 'pend_' + op };
}
async function sincronizar() {
  if (sincronizando || !S.sess || !pendActivos().length) return;
  sincronizando = true; pintarRed(); let enviados = 0, rechazados = 0;
  try {
    for (;;) {
      const x = pendActivos()[0]; if (!x) break;
      try { await llamar(x.fn, [S.sess.token].concat(x.args), { op: x.op, rep: !!x.enviado }); PEND = PEND.filter(p => p !== x); enviados++; guardarPend(); }
      catch (e) {
        if (e.red) { x.enviado = true; guardarPend(); break; }                      // sigue sin conexión: se intenta más tarde
        if (String(e.message).indexOf('SESION') >= 0) { guardarPend(); sincronizando = false; return salir(true); }
        x.error = String(e.message || e).replace('SESION: ', ''); rechazados++; guardarPend();    // el servidor lo rechazó (p. ej. el día ya se cerró): queda para que se revise
      }
    }
  } finally { sincronizando = false; pintarRed(); }
  if (enviados) {
    olvidarCache(false);
    toast(enviados === 1 ? 'Se envió lo que estaba pendiente.' : 'Se enviaron ' + enviados + ' cambios que estaban pendientes.');
    if (!$('.ov') && !S.tocado && S.sess) ir(S.tab, true);
  }
  if (rechazados) abrirPendientes(true);
}
/** Aplica sobre lo que se ve (guardado en el teléfono) los cambios que aún no llegaron al servidor. */
function docLocal(d, lineas) {
  const aprob = (d.descuentos || []).filter(x => x.estado === 'APROBADO').reduce((a, x) => a + x.monto, 0);
  const ls = lineas.map(l => Object.assign({}, l, { monto: soloDigitos(l.monto) })), pagado = ls.reduce((a, l) => a + l.monto, 0);
  return Object.assign({}, d, { estado: 'DETALLADO', pagos: ls, pagado, diferencia: d.total - pagado - aprob, sinEnviar: true });
}
function superponer(fn, args, data) {
  const ps = pendActivos(); if (!ps.length || !data) return data;
  try {
    if (fn === 'misDocumentos') {
      ps.forEach(p => {
        if (p.fn === 'guardarDetalle' && p.args[0] === args[1]) { const i = data.docs.findIndex(d => d.folio_key === p.args[1]); if (i >= 0) data.docs[i] = docLocal(data.docs[i], p.args[2]); }
        if (p.fn === 'guardarVarios' && p.args[0] === args[1]) p.args[1].forEach(it => { const i = data.docs.findIndex(d => d.folio_key === it.folio_key); if (i < 0) return;
          const d = data.docs[i], aprob = (d.descuentos || []).filter(x => x.estado === 'APROBADO').reduce((a, x) => a + x.monto, 0);
          data.docs[i] = docLocal(d, [Object.assign({}, it, { referencia: '', monto: d.total - aprob })]); });
      });
    } else if (fn === 'listarMov') {
      ps.forEach(p => {
        if (p.fn === 'guardarMov' && p.args[0] === args[1] && p.args[1] === args[2]) data.push(Object.assign({}, p.args[2], { id: 'pend_' + p.op, fecha: p.args[1], monto: soloDigitos(p.args[2].monto), adjuntos: [], sinEnviar: true,
          vendedor: p.args[2].vendedor || (S.sess.rol === 'VENDEDOR' ? S.sess.usuario : '') }));
        if (p.fn === 'borrarMov' && p.args[0] === args[1]) data = data.filter(r => r.id !== p.args[1]);
      });
    } else if (fn === 'listarDevoluciones') {
      ps.forEach(p => { if (p.fn === 'guardarDevolucion' && p.args[0] === args[1]) { const o = p.args[1], pr = (S.cat.productos || []).find(x => String(x.codigo) === String(o.codigo)) || {};
        data.push(Object.assign({}, o, { id: 'pend_' + p.op, fecha: p.args[0], cantidad: Number(o.cantidad) || 0, monto: soloDigitos(o.monto), producto: pr.nombre || o.codigo, unidad: pr.unidad || 'UN', adjuntos: [], sinEnviar: true })); } });
    } else if (fn === 'porCobrar' && data.clientes) {
      ps.filter(p => p.fn === 'guardarCobro').forEach(p => p.args[2].forEach(it => data.clientes.forEach(c => c.facturas.forEach(f => { if (f.folio_key === it.folio_key) { const q = Math.min(f.saldo, soloDigitos(it.monto)); f.saldo -= q; c.deuda -= q; } }))));
      data.clientes = data.clientes.filter(c => c.facturas.some(f => f.saldo > 0));
      data.clientes.forEach(c => { c.facturas = c.facturas.filter(f => f.saldo > 0); });
    }
  } catch (e) { /* si algo no calza, se muestra lo guardado tal cual */ }
  return data;
}
const fechaDe = p => String(p.args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(String(a))) || '');
const NOMBRE_TABLA = { COBRANZA: 'Cobranza', GASTOS: 'Gasto', PROVEEDORES: 'Proveedor', DEPOSITOS: 'Depósito', CONSUMO: 'Consumo' };
function descPend(x) {
  const a = x.args;
  switch (x.fn) {
    case 'guardarDetalle': return 'Forma de pago del folio ' + String(a[1]).replace(/^[A-Za-z]+-/, '');
    case 'guardarVarios': return 'Forma de pago de ' + a[1].length + ' folios';
    case 'guardarMov': return (NOMBRE_TABLA[a[0]] || a[0]) + ' ' + clp(soloDigitos(a[2].monto)) + (a[2].cliente ? ' · ' + a[2].cliente : a[2].concepto ? ' · ' + a[2].concepto : a[2].proveedor ? ' · ' + a[2].proveedor : '');
    case 'borrarMov': return 'Borrar un registro de ' + (NOMBRE_TABLA[a[0]] || a[0]);
    case 'guardarCobro': return 'Cobro a ' + a[1].cliente + ' · ' + clp(a[3].reduce((t, i) => t + soloDigitos(i.monto), 0));
    case 'guardarDevolucion': return 'Devolución (' + String(a[1].tipo || '').toLowerCase() + ') NC ' + a[1].nota_credito;
    case 'saveDespacho': return 'Despacho de ' + a[1];
    case 'guardarDeposito': return 'Depósito ' + clp(soloDigitos(a[1].monto));
    case 'guardarConteoEfectivo': return 'Conteo de efectivo';
  }
  return x.fn;
}
function pintarRed() {
  const el = $('#redbar'); if (!el) return;
  const n = pendActivos().length, err = pendDe().filter(p => p.error).length, plural = k => k + ' cambio' + (k > 1 ? 's' : '');
  let txt = '', cls = '';
  if (!EN_LINEA) { txt = 'Sin conexión' + (n ? ' · ' + plural(n) + ' por enviar' : ' · puedes seguir trabajando'); cls = 'off'; }
  else if (sincronizando) { txt = 'Enviando ' + plural(n) + '…'; cls = 'sync'; }
  else if (n) { txt = plural(n) + ' por enviar'; cls = 'sync'; }
  else if (err) { txt = plural(err) + ' no se pudo enviar · tocar para revisar'; cls = 'err'; }
  el.hidden = !txt; el.className = 'redbar ' + cls; el.textContent = txt;
}
/** Lista de lo pendiente: lo que espera conexión y lo que el servidor rechazó (con opción de reintentar o descartar). */
function abrirPendientes(soloSiHayErrores) {
  const xs = pendDe(); if (!xs.length || $('#pendov')) return;
  const ov = document.createElement('div'); ov.className = 'ov'; ov.id = 'pendov';
  const pintar = () => { const ys = pendDe();
    $('.body', ov).innerHTML = `<div style="font-weight:700;font-size:19px">Cambios por enviar</div>
      <p class="muted" style="margin:4px 0 10px">Se guardaron en este teléfono y se envían solos cuando hay internet. Si el servidor rechaza alguno (por ejemplo, si el día ya se cerró), queda aquí para que lo revises.</p>
      ${ys.length ? ys.map(p => `<div class="cfac"><div class="row" style="gap:8px"><span class="grow"><b>${esc(descPend(p))}</b><div class="muted">${fcorta(fechaDe(p))}</div>
        ${p.error ? `<div style="color:var(--bad)">${esc(p.error)}</div>` : '<div class="muted">Esperando conexión</div>'}</span>
        ${p.error ? `<button class="btn ghost sm" data-r="${esc(p.op)}">Reintentar</button>` : ''}<button class="btn ghost sm" data-d="${esc(p.op)}">Descartar</button></div></div>`).join('') : '<div class="alert ok">No queda nada pendiente.</div>'}`; };
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Cambios por enviar"><div class="grip"></div><div class="body"></div>
    <div class="foot"><button class="btn ghost" id="pcx">Cerrar</button><span class="grow"></span><button class="btn cu" id="pcs">Enviar ahora</button></div></div>`;
  document.body.appendChild(ov); pintar();
  $('#pcx', ov).onclick = () => cerrarHoja(ov);
  $('#pcs', ov).onclick = () => { pendDe().forEach(p => { p.error = ''; }); guardarPend(); sincronizar(); setTimeout(pintar, 600); };
  ov.onclick = e => {
    if (e.target === ov) return cerrarHoja(ov);
    const r = e.target.closest('[data-r]'), d = e.target.closest('[data-d]');
    if (r) { const p = PEND.find(x => x.op === r.dataset.r); if (p) { p.error = ''; guardarPend(); sincronizar(); setTimeout(pintar, 600); } }
    if (d && confirm('¿Descartar este cambio? No se enviará al servidor.')) { PEND = PEND.filter(x => x.op !== d.dataset.d); guardarPend(); pintar(); if (!pendDe().length) setTimeout(() => cerrarHoja(ov), 400); }
  };
}
window.addEventListener('online', () => { EN_LINEA = true; pintarRed(); sincronizar(); });
window.addEventListener('offline', () => { EN_LINEA = false; pintarRed(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (pendActivos().length) sincronizar(); else if (!EN_LINEA) llamar('ping', []).catch(() => {}); } });
setInterval(() => { if (!S.sess) return; if (pendActivos().length) sincronizar(); else if (!EN_LINEA) llamar('ping', []).catch(() => {}); }, 20000);
/** Pide por detrás la versión nueva de algo que se mostró desde la memoria del teléfono. */
function revalidar(fn, args, key) {
  const antes = JSON.stringify(CACHE.get(key).d), vista = S.vistaId;
  busy(true);
  pedir(fn, args, key).then(d => {
    if (JSON.stringify(d) === antes) return;
    if (fn === 'catalogo') { S.cat = copia(d); return; }
    if (vista === S.vistaId && !S.tocado && !$('.ov') && S.sess && fn !== 'listaUsuarios') ir(S.tab, true);
  }).catch(e => { if (String(e.message).indexOf('SESION') >= 0) errorApi(e); })
    .finally(() => busy(false));
}
/** Deja listas en memoria las pantallas vecinas para que abran al instante: todas en UNA llamada al servidor. */
function precargar(tabs) {
  const tok = S.sess && S.sess.token, F = S.fecha, esV = S.sess && S.sess.rol === 'VENDEDOR';
  const q = { folios: ['misDocumentos', [tok, F, S.vend]], inventario: ['getInventario', [tok, F]], resumen: ['getResumen', [tok, F]],
    saldos: ['getSaldosClientes', [tok]], cheques: ['listarCheques', [tok]], descuentos: ['descuentosPendientes', [tok]], depositos: ['efectivoParaDepositar', [tok, F, esV ? '' : S.vend]],
    despacho: (S.vend || (S.cat.vendedores[0] || {}).usuario) ? ['getDespacho', [tok, F, S.vend || S.cat.vendedores[0].usuario]] : null,
    devoluciones: ['listarDevoluciones', [tok, F]], efectivo: ['getConteoEfectivo', [tok, F]],
    historial: ['historial', [tok]] };
  const lista = [];
  tabs.forEach(t => {
    if (t === 'COBRANZA') lista.push(['porCobrar', [tok]]);
    const x = q[t] || (/^[A-Z]+$/.test(t) ? ['listarMov', [tok, t, F]] : null);
    if (!x) return;
    const e = CACHE.get(claveApi(x[0], x[1]));
    if (e && !e.viejo && Date.now() - e.t < FRESCURA * 3) return;          // ya está reciente
    lista.push(x);
  });
  if (lista.length && !PRECARGANDO) { PRECARGANDO = true; pedirLote(lista).catch(() => {}).finally(() => { PRECARGANDO = false; }); }
}
let PRECARGANDO = false;

/* ---------- estado ---------- */
const S = { sess: null, cat: null, fecha: null, tab: null, vend: '', filtro: 'pend', vistaId: 0, tocado: false, silencio: false };
const hoyCL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
try { S.sess = JSON.parse(localStorage.getItem('rn_sess') || 'null'); } catch (e) {}

const TABS = {
  VENDEDOR: [['hoy', 'Hoy', 'home'], ['folios', 'Mis folios', 'list'], ['COBRANZA', 'Cobranza', 'cash'], ['depositos', 'Depósitos', 'bank'], ['GASTOS', 'Gastos', 'receipt']],
  BODEGA: [['despacho', 'Despacho', 'box'], ['devoluciones', 'Devoluciones', 'undo'], ['inventario', 'Inventario', 'stack']],
  RENDICION: [['resumen', 'Resumen del día', 'home'], ['efectivo', 'Conteo de efectivo', 'cash'], ['importar', 'Importar Mi DTE', 'upload'], ['folios', 'Detallar ventas', 'list'],
    ['despacho', 'Despacho y kilos', 'box'], ['devoluciones', 'Devoluciones', 'undo'], ['inventario', 'Inventario', 'stack'],
    ['COBRANZA', 'Cobrar a clientes', 'cash'], ['saldos', 'Saldos de clientes', 'users'], ['cheques', 'Cheques en cartera', 'doc'],
    ['depositos', 'Depósitos', 'bank'], ['GASTOS', 'Gastos', 'receipt'], ['PROVEEDORES', 'Proveedores', 'store'], ['CONSUMO', 'Consumo', 'box'], ['historial', 'Historial', 'chart']]
};
TABS.SUPERVISOR = TABS.RENDICION.slice(0, 1).concat([['descuentos', 'Descuentos por autorizar', 'percent']], TABS.RENDICION.slice(1));
TABS.ADMIN = TABS.SUPERVISOR.concat([['usuarios', 'Usuarios', 'users']]);
// En oficina, las pantallas se agrupan por tarea (barra lateral en computador, barra inferior en el celular)
const GRUPOS = [['g-hoy', 'Hoy', ['resumen', 'efectivo', 'descuentos'], 'home'], ['g-ventas', 'Ventas', ['importar', 'folios'], 'upload'],
  ['g-bodega', 'Bodega', ['despacho', 'devoluciones', 'inventario'], 'box'], ['g-cobro', 'Cobranza', ['COBRANZA', 'saldos', 'cheques'], 'cash'],
  ['g-caja', 'Caja', ['depositos', 'GASTOS', 'PROVEEDORES', 'CONSUMO'], 'bank'], ['g-mas', 'Más', ['historial', 'usuarios'], 'dots']];
const grupoDe = t => GRUPOS.find(g => g[2].indexOf(t) >= 0);

/* ===== MODO PRUEBA (TEMPORAL): el ADMIN salta entre usuarios sin pedir claves. Para quitarlo: MODO_PRUEBA = false aquí y en APPS_SCRIPT.js (CFG). ===== */
const MODO_PRUEBA = true;
try { S_ADMIN = JSON.parse(localStorage.getItem('rn_admin') || 'null'); } catch (e) { S_ADMIN = null; }
var S_ADMIN;
const ROL_TXT = { ADMIN: 'Administración', SUPERVISOR: 'Supervisión', RENDICION: 'Encargada de rendición', VENDEDOR: 'Vendedores', BODEGA: 'Bodega' };
function montarProbar() {
  const v = $('#probar'); if (v) v.remove();
  if (!MODO_PRUEBA || !S.sess || !(S_ADMIN || S.sess.rol === 'ADMIN')) return;
  const b = document.createElement('button'); b.id = 'probar'; b.type = 'button';
  b.innerHTML = S_ADMIN ? `<small>Probando como</small><b>${esc(S.sess.nombre.split(' ')[0])} · ${esc(S.sess.rol)}</b>` : '<small>Modo prueba</small><b>Probar como…</b>';
  b.onclick = abrirProbar; document.body.appendChild(b);
}
async function abrirProbar() {
  const adm = S_ADMIN || S.sess, ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Probar como"><div class="grip"></div><div class="body">
    <h3 style="margin-top:0">Probar como…</h3><p class="muted">Modo de prueba temporal: entras como esa persona sin pedir su clave. Lo que registres queda a su nombre.</p>
    <div id="pul"><div class="sk" style="height:46px"></div></div></div><div class="foot"><button class="btn ghost grow" id="pcx">Cerrar</button></div></div>`;
  document.body.appendChild(ov);
  $('#pcx', ov).onclick = () => cerrarHoja(ov); ov.onclick = e => { if (e.target === ov) cerrarHoja(ov); };
  let us; try { us = await api('listarUsuariosAdmin', adm.token); } catch (e) { cerrarHoja(ov); return; }
  const orden = ['ADMIN', 'SUPERVISOR', 'RENDICION', 'VENDEDOR', 'BODEGA'];
  us = us.filter(u => u.activo).sort((x, y) => orden.indexOf(x.rol) - orden.indexOf(y.rol) || x.nombre.localeCompare(y.nombre));
  $('#pul', ov).innerHTML = orden.map(r => { const g = us.filter(u => u.rol === r); return g.length ? `<div class="sg" style="margin:10px 0 4px;color:var(--ink-2)">${ROL_TXT[r]}</div>` +
    g.map(u => `<button class="urow ${S.sess.usuario === u.usuario ? 'on' : ''}" data-u="${esc(u.usuario)}"><span class="grow"><b>${esc(u.nombre)}</b><small>${esc(u.usuario)}${u.terminales ? ' · ' + esc(u.terminales) : ''}</small></span>${S.sess.usuario === u.usuario ? '<span class="chip ok">Actual</span>' : '<span class="go">›</span>'}</button>`).join('') : ''; }).join('');
  $('#pul', ov).onclick = async e => {
    const bt = e.target.closest('.urow'); if (!bt || bt.classList.contains('on')) return;
    bt.disabled = true; await cambiarA(bt.dataset.u, adm); cerrarHoja(ov);
  };
}
async function cambiarA(usuario, adm) {
  try {
    if (S_ADMIN && usuario === S_ADMIN.usuario) {                          // volver a mi propio usuario
      api('logout', S.sess.token).catch(() => {});
      S.sess = S_ADMIN; S_ADMIN = null; try { localStorage.removeItem('rn_admin'); localStorage.setItem('rn_sess', JSON.stringify(S.sess)); } catch (e) {}
    } else {
      const s = await api('entrarComo', adm.token, usuario, hoyCL());
      if (!S_ADMIN) { S_ADMIN = { token: adm.token, usuario: adm.usuario, nombre: adm.nombre, rol: adm.rol, puedeAutorizar: adm.puedeAutorizar }; try { localStorage.setItem('rn_admin', JSON.stringify(S_ADMIN)); } catch (e) {} }
      else if (S.sess.token !== adm.token) api('logout', S.sess.token).catch(() => {});
      const lote = s.lote || []; delete s.lote;
      lote.forEach(x => CACHE.set(claveApi(x.fn, x.args), { t: Date.now(), d: x.data })); if (lote.length) guardarCache();
      S.sess = s; try { localStorage.setItem('rn_sess', JSON.stringify(s)); } catch (e) {}
    }
    S.tab = null; S.vend = ''; S.filtro = 'pend'; S.grupos = null; S.ultimoDeGrupo = {};
    await iniciar();
    toast('Ahora estás como ' + S.sess.nombre + ' (' + S.sess.rol + ')');
  } catch (e) { /* api ya mostró el motivo */ }
}

function salir(expirada) {
  if (!expirada && pendActivos().length && !confirm('Tienes ' + pendActivos().length + ' cambio(s) guardados en el teléfono que aún no se envían. Si sales, se enviarán cuando vuelvas a ingresar con tu usuario. ¿Salir igual?')) return;
  if (!expirada && S.sess) api('logout', S.sess.token).catch(() => {});
  if (S_ADMIN) { if (!expirada) api('logout', S_ADMIN.token).catch(() => {}); S_ADMIN = null; }
  const pb = $('#probar'); if (pb) pb.remove();
  S.sess = null; S.cat = null; S.tab = null;
  olvidarCache(false);
  try { localStorage.removeItem('rn_sess'); localStorage.removeItem('rn_admin'); } catch (e) {}
  document.body.classList.remove('has-bottom');
  pantallaLogin();
}

/* ---------- ingreso ---------- */
/** Cada persona entra con su RUT (o correo) y su clave; el rol ya viene asignado por la administración. */
function pantallaLogin() {
  const app = $('#app'); let ult = ''; try { ult = localStorage.getItem('rn_ident') || ''; } catch (e) {}
  render(app, `<div class="login"><img class="logo" src="icon-192.png" alt="Cecinas Naranjo" width="96" height="96">
    <h1>Rendiciones</h1><p class="lead">Ingresa con tu RUT o correo y tu clave.</p>
    <label class="f" for="lid">RUT o correo</label>
    <input id="lid" class="in" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="12.345.678-5" value="${esc(ult)}">
    <label class="f" for="lpw" style="margin-top:12px">Clave</label>
    <div class="row" style="gap:8px"><input id="lpw" class="in grow" type="password" autocomplete="current-password" placeholder="Tu clave">
      <button type="button" class="btn ghost sm" id="lver" aria-label="Mostrar u ocultar la clave">Ver</button></div>
    <button class="btn cu block" style="margin-top:14px" id="go">Ingresar</button>
    <p class="muted" style="margin-top:14px">Si olvidaste tu clave o es tu primera vez, pide a la administración que te dé una clave temporal.</p></div>`);
  $('#lver').onclick = () => { const p = $('#lpw'); p.type = p.type === 'password' ? 'text' : 'password'; $('#lver').textContent = p.type === 'password' ? 'Ver' : 'Ocultar'; };
  const go = async () => {
    const id = $('#lid').value.trim(), pw = $('#lpw').value;
    if (!id || !pw) return toast('Escribe tu RUT o correo y tu clave.', true);
    try {
      const s = await api('login', id, pw, hoyCL());
      try { localStorage.setItem('rn_ident', id); } catch (e) {}
      if (s.cambiarClave) return pantallaNuevaClave(id, pw, s.nombre);
      entrar(s);
    } catch (e) { const p = $('#lpw'); p.value = ''; p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); }
  };
  $('#go').onclick = go; $('#lpw').onkeydown = $('#lid').onkeydown = e => { if (e.key === 'Enter') go(); };
  ($('#lid').value ? $('#lpw') : $('#lid')).focus();
}
function entrar(s) {
  const lote = s.lote || []; delete s.lote;
  lote.forEach(x => CACHE.set(claveApi(x.fn, x.args), { t: Date.now(), d: x.data }));      // catálogo y primera pantalla ya vienen listos
  if (lote.length) guardarCache();
  S.sess = s; try { localStorage.setItem('rn_sess', JSON.stringify(s)); } catch (e) {}
  iniciar();
}
/** Primera entrada o clave restablecida: la persona crea su propia clave. */
function pantallaNuevaClave(ident, temporal, nombre) {
  render($('#app'), `<div class="login"><img class="logo" src="icon-192.png" alt="" width="96" height="96">
    <h1>Hola, ${esc(String(nombre || '').split(' ')[0])}</h1><p class="lead">Crea tu clave personal. Solo tú debes conocerla: con ella se registra todo lo que hagas en la app.</p>
    <label class="f" for="np1">Clave nueva (mínimo 6 caracteres)</label><input id="np1" class="in" type="password" autocomplete="new-password">
    <label class="f" for="np2" style="margin-top:12px">Repite la clave</label><input id="np2" class="in" type="password" autocomplete="new-password">
    <button class="btn cu block" style="margin-top:14px" id="npg">Guardar y entrar</button>
    <button class="btn ghost block" style="margin-top:8px" id="npc">Cancelar</button></div>`);
  $('#npc').onclick = () => pantallaLogin();
  const go = async () => {
    const a = $('#np1').value, b = $('#np2').value;
    if (a.length < 6) return toast('La clave debe tener al menos 6 caracteres.', true);
    if (a !== b) return toast('Las dos claves no son iguales.', true);
    try { await api('cambiarClaveInicial', ident, temporal, a); const s = await api('login', ident, a, hoyCL()); toast('Clave guardada'); entrar(s); } catch (e) { /* api ya mostró el motivo */ }
  };
  $('#npg').onclick = go; $('#np2').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#np1').focus();
}
/** Cambiar la propia clave estando dentro de la app. */
function abrirMiClave() {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Cambiar mi clave"><div class="grip"></div><div class="body">
    <div style="font-weight:700;font-size:19px">Cambiar mi clave</div>
    <label class="f" for="mc0">Clave actual</label><input id="mc0" class="in" type="password" autocomplete="current-password">
    <label class="f" for="mc1" style="margin-top:10px">Clave nueva (mínimo 6 caracteres)</label><input id="mc1" class="in" type="password" autocomplete="new-password">
    <label class="f" for="mc2" style="margin-top:10px">Repite la clave nueva</label><input id="mc2" class="in" type="password" autocomplete="new-password"></div>
    <div class="foot"><button class="btn ghost" id="mcx">Cancelar</button><span class="grow"></span><button class="btn cu" id="mcg">Guardar</button></div></div>`;
  document.body.appendChild(ov);
  $('#mcx', ov).onclick = () => cerrarHoja(ov);
  $('#mcg', ov).onclick = async () => {
    const a = $('#mc0', ov).value, b = $('#mc1', ov).value, c = $('#mc2', ov).value;
    if (!a) return toast('Escribe tu clave actual.', true);
    if (b.length < 6) return toast('La clave nueva debe tener al menos 6 caracteres.', true);
    if (b !== c) return toast('Las claves nuevas no son iguales.', true);
    await api('cambiarMiClave', S.sess.token, a, b); toast('Clave cambiada'); cerrarHoja(ov);
  };
  $('#mc0', ov).focus();
}

/* ---------- estructura ---------- */
async function iniciar() {
  const app = $('#app');
  app.innerHTML = `<main>${skeleton(4)}</main>`;
  S.cat = await api('catalogo', S.sess.token);
  S.fecha = S.fecha || hoyCL();
  const tabs = TABS[S.sess.rol] || [];
  S.tab = S.tab && tabs.some(t => t[0] === S.tab) ? S.tab : tabs[0][0];
  const unica = tabs.length === 1;          // una sola pantalla, sin menú
  const abajo = !unica && (S.sess.rol === 'VENDEDOR' || S.sess.rol === 'BODEGA' || tabs.length <= 4);
  const grupos = !unica && !abajo ? GRUPOS.map(g => [g[0], g[1], g[2].filter(t => tabs.some(x => x[0] === t)), g[3]]).filter(g => g[2].length) : null;
  S.grupos = grupos; S.ultimoDeGrupo = S.ultimoDeGrupo || {};
  document.body.classList.toggle('has-bottom', abajo || !!grupos);
  document.body.classList.toggle('oficina', !!grupos);
  const dia = `<div class="day"><button id="prev" aria-label="Día anterior">‹</button><input type="date" id="fecha" value="${S.fecha}" aria-label="Fecha"><button id="next" aria-label="Día siguiente">›</button></div>`;
  const txtDia = f => f === hoyCL() ? 'Hoy' : new Date(f + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[,.]/g, '');
  const diaC = `<div class="hday"><button id="prev" aria-label="Día anterior">‹</button><label class="dl"><span id="dtxt">${txtDia(S.fecha)}</span><input type="date" id="fecha" value="${S.fecha}" aria-label="Elegir fecha"></label><button id="next" aria-label="Día siguiente">›</button></div>`;
  const cuenta = `<button class="icon-btn" id="mclv" aria-label="Cambiar mi clave">${icon('key')}<span>Clave</span></button><button class="icon-btn" id="out" aria-label="Salir">${icon('out')}<span>Salir</span></button>`;
  const ref = t => tabs.find(x => x[0] === t) || [];
  if (grupos) {
    app.innerHTML = `<div class="shell">
      <aside class="side"><div class="brand"><img src="logo-96.png" alt="" width="44" height="44"><div><b>Naranjo</b><small>${esc(S.sess.nombre)}</small></div></div>
        <nav id="side">${grupos.map(g => `<div class="sg">${g[1]}</div>${g[2].map(t => `<button data-t="${t}">${icon(ref(t)[2])}<span>${ref(t)[1]}</span></button>`).join('')}`).join('')}</nav></aside>
      <div class="col">
        <div class="topbar"><div class="brand mini"><img src="logo-96.png" alt="" width="34" height="34"><b>Naranjo</b></div><div class="sp"></div>${dia}${cuenta}</div>
        <div id="redbar" class="redbar" role="status" hidden></div>
        <div class="otrodia" id="otrodia" hidden><span></span><button type="button" id="hoyBtn">Volver a hoy</button></div>
        <nav class="sub" id="sub"></nav>
        <main id="main"></main></div></div>
      <nav class="bottom" id="nav">${grupos.map(g => `<button data-g="${g[0]}">${icon(g[3])}${g[1]}</button>`).join('')}</nav>`;
  } else {
    app.innerHTML = `<header>
      <div class="hbar"><div class="brand"><img src="logo-96.png" alt="" width="42" height="42"><div><small>Naranjo</small><b>${esc((S.sess.nombre || '').split(' ')[0])}</b></div></div>
        ${diaC}<button class="icon-btn only" id="menub" aria-label="Menú" aria-haspopup="true" aria-expanded="false">${icon('dots')}</button></div>
      <div class="menu" id="menu" hidden><button id="mclv">${icon('key')}Cambiar mi clave</button><button id="out">${icon('out')}Salir</button></div>
      <div id="redbar" class="redbar" role="status" hidden></div>
      <div class="progress" aria-hidden="true"><i id="prog"></i></div>
      <div class="otrodia" id="otrodia" hidden><span></span><button type="button" id="hoyBtn">Volver a hoy</button></div>
    </header>
    <main id="main"></main>
    ${abajo ? `<nav class="bottom" id="nav">${tabs.map(t => `<button data-t="${t[0]}">${icon(t[2])}${t[1]}</button>`).join('')}</nav>` : ''}`;
  }
  $('#out').onclick = () => salir(); $('#mclv').onclick = abrirMiClave; $('#redbar').onclick = () => abrirPendientes(); pintarRed();
  const cambiarFecha = f => { S.fecha = f; $('#fecha').value = f; const dt = $('#dtxt'); if (dt) dt.textContent = txtDia(f); ir(S.tab); };
  const mb = $('#menub');
  if (mb) {
    mb.onclick = e => { e.stopPropagation(); const mn = $('#menu'); mn.hidden = !mn.hidden; mb.setAttribute('aria-expanded', String(!mn.hidden)); };
    if (!window._menuCierra) { window._menuCierra = true; document.addEventListener('click', () => { const mn = $('#menu'); if (mn) { mn.hidden = true; const b = $('#menub'); if (b) b.setAttribute('aria-expanded', 'false'); } }); }
  }
  $('#fecha').onchange = e => e.target.value && cambiarFecha(e.target.value);
  $('#prev').onclick = () => cambiarFecha(sumarDias(S.fecha, -1));
  $('#next').onclick = () => cambiarFecha(sumarDias(S.fecha, 1));
  $('#hoyBtn').onclick = () => cambiarFecha(hoyCL());
  if ($('#nav')) $('#nav').onclick = e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t) return ir(b.dataset.t);
    const g = grupos.find(x => x[0] === b.dataset.g); ir(S.ultimoDeGrupo[g[0]] || g[2][0]); };
  if ($('#sub')) $('#sub').onclick = e => { const b = e.target.closest('button'); if (b) ir(b.dataset.t); };
  if ($('#side')) $('#side').onclick = e => { const b = e.target.closest('button'); if (b) ir(b.dataset.t); };
  // si la persona escribe algo, no se le cambia la pantalla por una actualización de fondo
  $('#main').addEventListener('input', () => { S.tocado = true; });
  ir(S.tab);
  sincronizar();
  montarProbar();
  if (S.sess.rol === 'VENDEDOR' || S.sess.rol === 'BODEGA') setTimeout(() => precargar(tabs.map(t => t[0])), 2500);      // deja lista cada pantalla para poder trabajar sin conexión
}
function ir(t, silencioso) {
  S.tab = t;
  const tabs = TABS[S.sess.rol] || [];
  if (S.grupos) {
    const g = S.grupos.find(x => x[2].indexOf(t) >= 0);
    S.ultimoDeGrupo[g[0]] = t;
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.g === g[0]));
    $$('#side button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    const sub = $('#sub');
    sub.hidden = g[2].length < 2;
    sub.innerHTML = g[2].map(x => `<button data-t="${x}" class="${x === t ? 'on' : ''}">${(tabs.find(y => y[0] === x) || [])[1]}</button>`).join('');
    const on = $('#sub .on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  const od = $('#otrodia'), hoy = hoyCL();
  if (od) { od.hidden = S.fecha === hoy; if (S.fecha !== hoy) $('span', od).innerHTML = `Estás viendo <b>${fechaLarga(S.fecha)}</b>`; }
  const m = $('#main'); m.onclick = null;
  S.vistaId++; S.tocado = false;
  const y = window.scrollY;
  if (!silencioso) m.innerHTML = skeleton(4);
  S.silencio = !!silencioso;
  const v = { hoy: vHoy, folios: vFolios, despacho: vDespacho, resumen: vResumen, importar: vImportar, depositos: vDepositos, inventario: vInventario, saldos: vSaldos, cheques: vCheques, usuarios: vUsuarios, devoluciones: vDevoluciones, efectivo: vEfectivo, historial: vHistorial, descuentos: vDescuentos }[t] || vMov;
  Promise.resolve(v(m, t)).catch(() => {
    if (!silencioso && m.querySelector('.sk')) m.innerHTML = `<div class="empty"><b>No se pudo cargar</b>Revisa tu conexión.<br><button class="btn ghost sm" style="margin-top:10px" onclick="ir(S.tab)">Reintentar</button></div>`;
  }).finally(() => {
    S.silencio = false;
    if (silencioso) window.scrollTo(0, y);
    else setTimeout(() => {
      // primero las otras pestañas de la misma sección; después la primera pestaña de cada una de las demás secciones
      const delGrupo = S.grupos ? (S.grupos.find(x => x[2].indexOf(t) >= 0) || [0, 0, []])[2] : tabs.map(x => x[0]);
      const otras = S.grupos ? S.grupos.filter(g => g[2].indexOf(t) < 0).map(g => g[2][0]) : [];
      precargar(delGrupo.filter(x => x !== t).concat(otras).filter(x => x !== 'saldos').slice(0, 7));
    }, 600);
  });
}
const progreso = p => { const i = $('#prog'); if (i) i.style.width = Math.round(p * 100) + '%'; };
const opcVend = (sel, todos) => (todos ? '<option value="">Todos los vendedores</option>' : '') +
  S.cat.vendedores.map(v => `<option value="${esc(v.usuario)}" ${v.usuario === sel ? 'selected' : ''}>${esc(v.nombre)}</option>`).join('');

/* ============ HOY (inicio del vendedor): qué hacer y cómo va el día ============ */
async function vHoy(m) {
  const tok = S.sess.token, F = S.fecha, pri = (S.sess.nombre || '').split(' ')[0];
  const [r, cob, gas] = await Promise.all([api('misDocumentos', tok, F, S.vend), api('listarMov', tok, 'COBRANZA', F), api('listarMov', tok, 'GASTOS', F)]);
  const docs = r.docs, cerrada = r.estadoDia === 'CERRADA', hechos = docs.filter(d => d.estado === 'DETALLADO'), pend = docs.length - hechos.length;
  const por = fs => hechos.reduce((a, d) => a + d.pagos.filter(p => fs.indexOf(p.forma) >= 0).reduce((b, p) => b + p.monto, 0), 0);
  const tot = docs.reduce((a, d) => a + d.total, 0), ef = por(['EFECTIVO']), tr = por(['TRANSFERENCIA', 'DEP_EFECTIVO']), ch = por(['CHEQUE']), cr = por(['CREDITO']);
  const sumaM = xs => xs.reduce((a, x) => a + (Number(x.monto) || 0), 0), pl = (n, a, b) => n + ' ' + (n === 1 ? a : b);
  const p = docs.length ? hechos.length / docs.length : 0;
  const hero = !docs.length ? `<div class="hero vacio"><b>Aún no tienes folios</b><span>Aparecen cuando la encargada importa el informe de Mi DTE. Vuelve a mirar en un rato.</span></div>`
    : !pend ? `<div class="hero ok"><span class="tick">✓</span><b>Listo: detallaste todos tus folios</b><span>${pl(docs.length, 'folio', 'folios')}. Mira abajo si te falta registrar algo más.</span></div>`
    : `<div class="hero"><span class="kick">Primero</span><b>Cuéntanos cómo te pagó cada cliente</b>
        <div class="meter" style="margin:12px 0 4px"><div class="bar"><i style="width:${Math.round(p * 100)}%"></i></div><b>${hechos.length} de ${docs.length}</b></div>
        <button class="btn cu block" id="hgo" ${cerrada ? 'disabled' : ''}>${hechos.length ? 'Seguir detallando' : 'Empezar a detallar'} · ${pend} por hacer</button></div>`;
  const pasos = [
    ['folios', docs.length > 0 && !pend, 'Mis folios', !docs.length ? 'Todavía no hay folios' : pend ? `Te faltan ${pend}` : 'Todos detallados', ''],
    ['COBRANZA', cob.length > 0, 'Cobranza', cob.length ? `${pl(cob.length, 'pago', 'pagos')} · ${clp(sumaM(cob))}` : 'Si un cliente te pagó una factura de otro día', 'Si corresponde'],
    ['GASTOS', gas.length > 0, 'Gastos', gas.length ? `${pl(gas.length, 'gasto', 'gastos')} · ${clp(sumaM(gas))}` : 'Combustible, peajes, almuerzo', 'Si corresponde'],
    ['depositos', false, 'Depósito de efectivo', 'Si depositaste lo que te pagaron en efectivo', 'Si corresponde']];
  render(m, `<h2>Hola, ${esc(pri)}</h2><p class="lead">Esto es lo que falta para cerrar ${F === hoyCL() ? 'tu día' : 'ese día'}.</p>
    ${cerrada ? '<div class="alert">La rendición de este día está cerrada. Solo lectura.</div>' : ''}
    ${hero}
    <div class="hpasos">${pasos.map((x, i) => `<button class="hpaso ${x[1] ? 'd' : ''}" data-t="${x[0]}"><span class="n">${x[1] ? '✓' : i + 1}</span>
      <span class="t"><b>${x[2]}</b><small>${x[3]}</small></span><span class="go" aria-hidden="true">›</span></button>`).join('')}</div>
    ${hechos.length ? `<h3>Cómo va tu día</h3><div class="kpis"><div><span>Vendido</span><b>${clp(tot)}</b></div><div><span>Efectivo</span><b>${clp(ef)}</b></div>
      <div><span>Transferencias</span><b>${clp(tr)}</b></div>${ch ? `<div><span>Cheques</span><b>${clp(ch)}</b></div>` : ''}<div><span>A crédito</span><b>${clp(cr)}</b></div></div>
      <p class="muted" style="margin:6px 2px 0">Solo cuenta los folios que ya detallaste.</p>` : ''}`);
  m.onclick = e => {
    if (e.target.closest('#hgo')) { S.autoempezar = true; return ir('folios'); }
    const b = e.target.closest('.hpaso'); if (b) ir(b.dataset.t);
  };
}

/* ============ FOLIOS ============ */
async function vFolios(m) {
  const esV = S.sess.rol === 'VENDEDOR';
  let docs = [], estadoDia = '', q = '';
  const r = await api('misDocumentos', S.sess.token, S.fecha, S.vend);
  docs = r.docs; estadoDia = r.estadoDia;
  render(m, `<h2>${esV ? 'Mis folios' : 'Detallar ventas'}</h2><p class="lead">${esV ? 'Toca un folio y marca cómo te pagó el cliente.' : fechaLarga(S.fecha) + ' · Puedes detallar los folios de cualquier vendedor; quedará registrado que lo hiciste tú.'}</p>
    ${esV ? '' : `<div class="row" style="margin-bottom:6px"><select class="in" style="width:auto" id="fv">${opcVend(S.vend, true)}</select></div>`}
    <div class="meter" id="meter"><div class="bar"><i></i></div><b></b></div>
    <div id="acc"></div>
    <div class="row filtros"><div class="seg" id="seg"><button data-f="pend">Por detallar</button><button data-f="det">Detallados</button><button data-f="todos">Todos</button></div>
      ${docs.length > 8 || !esV ? `<div class="search grow" style="min-width:180px">${icon('search')}<input class="in" id="q" placeholder="Cliente o folio" type="search"></div>` : ''}</div>
    <div id="fl"></div>`);
  if (!esV) $('#fv').onchange = e => { S.vend = e.target.value; ir('folios'); };
  $('#seg').onclick = e => { const b = e.target.closest('button'); if (b) { S.filtro = b.dataset.f; pintar(); } };
  if ($('#q')) $('#q').oninput = e => { q = norm(e.target.value); pintar(); };

  function pintar(recienGuardado) {
    $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.f === S.filtro));
    const hechos = docs.filter(d => d.estado === 'DETALLADO').length;
    const p = docs.length ? hechos / docs.length : 0;
    progreso(p);
    const mt = $('#meter'); mt.classList.toggle('done', docs.length > 0 && hechos === docs.length);
    const pendientes = docs.length - hechos;
    const sb = f => $('#seg [data-f="' + f + '"]'), nom = { pend: 'Por detallar', det: 'Detallados', todos: 'Todos' }, cn = { pend: pendientes, det: hechos, todos: docs.length };
    ['pend', 'det', 'todos'].forEach(f => { sb(f).innerHTML = nom[f] + (docs.length ? ` <span class="cn">${cn[f]}</span>` : ''); });
    $('#acc').innerHTML = pendientes && estadoDia !== 'CERRADA' ? `<div class="acciones col">
      <button class="btn cu" id="emp">${hechos ? 'Seguir detallando' : 'Empezar a detallar'} <span class="cnt">${pendientes}</span></button>
      ${pendientes > 1 ? (esV || S.vend ? '<button class="btn ghost sm" id="var">Marcar varios de una vez</button>'
        : '<button class="btn ghost sm" disabled title="Elige un vendedor arriba">Elige un vendedor para marcar varios</button>') : ''}</div>` : '';
    $('.bar i', mt).style.width = (p * 100) + '%';
    $('b', mt).textContent = docs.length ? `${hechos} de ${docs.length} detallados · ${clp(docs.reduce((a, d) => a + d.total, 0))}` : '';
    const el = $('#fl');
    if (!docs.length) { el.innerHTML = `<div class="empty"><b>No hay documentos para este día</b>Los folios aparecen cuando la encargada importa el informe de ventas de Mi DTE.</div>`; return; }
    let lista = docs.filter(d => S.filtro === 'todos' || (S.filtro === 'det') === (d.estado === 'DETALLADO'));
    if (q) lista = lista.filter(d => norm(d.cliente).includes(q) || String(d.folio).includes(q));
    lista.sort((a, b) => String(a.folio).localeCompare(String(b.folio), 'es', { numeric: true }));
    if (!lista.length) {
      el.innerHTML = S.filtro === 'pend' && !q ? `<div class="empty alert ok" style="border-style:solid"><b>Todo detallado</b>No quedan folios pendientes para este día.</div>`
        : `<div class="empty">Nada coincide con el filtro.</div>`;
      return;
    }
    el.innerHTML = lista.map(d => `<button class="folio ${d.estado === 'DETALLADO' ? 'd' : ''} ${d.folio_key === recienGuardado ? 'just' : ''}" data-k="${esc(d.folio_key)}">
      <div class="grow"><div class="c">${esc(d.cliente)}</div>
        <div class="muted">${esc(d.tipo.replace(' Electrónica', ''))} ${esc(d.folio)} · Mi DTE: ${esc(d.condicion_dte)}${esV ? '' : ' · ' + esc(d.vendedor || 'sin vendedor')}</div>
        <div class="chips">${chipsEstado(d)}</div></div>
      <div class="t">${clp(d.total)}</div></button>`).join('');
    el.onclick = e => { const b = e.target.closest('.folio'); if (!b) return;
      abrirDetalle(docs.find(x => x.folio_key === b.dataset.k), estadoDia, actualizar, recorrido); };
  }
  const actualizar = nuevo => { const i = docs.findIndex(x => x.folio_key === nuevo.folio_key); docs[i] = nuevo; S.tocado = true; pintar(nuevo.folio_key); };
  // recorrido: después de guardar un folio se abre el siguiente pendiente (en orden de folio)
  const ordenados = () => docs.slice().sort((a, b) => String(a.folio).localeCompare(String(b.folio), 'es', { numeric: true }));
  const recorrido = {
    cuantos: () => docs.filter(d => d.estado !== 'DETALLADO').length,
    proximo: key => { const l = ordenados(), i = l.findIndex(d => d.folio_key === key);
      return l.slice(i + 1).concat(l.slice(0, i)).find(d => d.estado !== 'DETALLADO') || null; }
  };
  m.onclick = e => {
    if (e.target.closest('#emp')) { const p = ordenados().find(d => d.estado !== 'DETALLADO'); if (p) abrirDetalle(p, estadoDia, actualizar, recorrido); }
    if (e.target.closest('#var')) marcarVarios(docs, nuevos => {
      const vis = {}; nuevos.forEach(n => vis[n.folio_key] = n);
      docs = docs.map(d => vis[d.folio_key] || d); S.tocado = true; pintar(); });
  };
  pintar();
  if (S.autoempezar) { S.autoempezar = false; const e = $('#emp'); if (e) e.click(); }      // viene del botón de "Hoy"
}
function chipsEstado(d) {
  let h = d.estado === 'DETALLADO' ? `<span class="chip ok">Detallado${d.detalladoPor ? ' por ' + esc(d.detalladoPor.split(' ')[0]) : ''}</span>` : '<span class="chip cu">Por detallar</span>';
  h += d.pagos.map(p => `<span class="chip">${FL[p.forma]}${p.banco ? ' ' + esc(p.banco) : ''}</span>`).join('');
  d.descuentos.forEach(x => h += `<span class="chip ${x.estado === 'APROBADO' ? 'ok' : x.estado === 'RECHAZADO' ? 'bad' : 'warn'}">Desc. ${clp(x.monto)} ${x.estado.toLowerCase()}</span>`);
  return h;
}

function cerrarHoja(ov) { ov.classList.add('closing'); setTimeout(() => ov.remove(), 190); }

function abrirDetalleCompleto(d, estadoDia, alGuardar) {
  const cerrada = estadoDia === 'CERRADA';
  let lineas = d.pagos.length ? d.pagos.map(p => Object.assign({}, p))
    : [{ forma: /cr[ée]dito/i.test(d.condicion_dte) ? 'CREDITO' : 'EFECTIVO', banco: '', monto: d.total }];
  const dPrev = d.descuentos.find(x => x.estado !== 'RECHAZADO');
  const desc = { on: !!dPrev, monto: dPrev ? dPrev.monto : '', motivo: dPrev ? dPrev.motivo : '' };
  const conBanco = f => f === 'TRANSFERENCIA' || f === 'DEP_EFECTIVO' || f === 'CHEQUE';
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Folio ${esc(d.folio)}"><div class="grip"></div><div class="body">
    <div class="muted">${esc(d.tipo)} ${esc(d.folio)} · Mi DTE: ${esc(d.condicion_dte)}</div>
    <div style="font-weight:700;font-size:18px;line-height:1.25;margin:2px 0 4px">${esc(d.cliente)}</div>
    <div class="big">${clp(d.total)}</div>
    ${cerrada ? '<div class="alert">La rendición de este día está cerrada. Solo lectura.</div>' : `<div class="quick" id="qk">
      <button class="btn ghost sm" data-q="EFECTIVO">Todo efectivo</button><button class="btn ghost sm" data-q="TRANSFERENCIA">Todo transferencia</button>
      <button class="btn ghost sm" data-q="CREDITO">Todo a crédito</button><button class="btn ghost sm" data-q="CHEQUE">Todo cheque</button></div>`}
    <label class="f">Cómo se pagó</label><div id="ls"></div>
    ${cerrada ? '' : '<button class="btn ghost sm" id="add">Agregar otra forma de pago</button>'}
    <h3>Descuento</h3>
    <label class="switch"><input type="checkbox" id="don" ${desc.on ? 'checked' : ''} ${cerrada ? 'disabled' : ''}> Se aplicó un descuento</label>
    <p class="muted" style="margin:4px 0 0">Queda pendiente hasta que lo autorice administración.</p>
    <div id="dbox" class="grid g2" style="margin-top:10px;${desc.on ? '' : 'display:none'}">
      <div><label class="f" for="dm">Monto</label><input class="in n" id="dm" inputmode="numeric" value="${desc.monto}"></div>
      <div><label class="f" for="dmo">Motivo</label><input class="in" id="dmo" value="${esc(desc.motivo)}" placeholder="Ej: producto dañado"></div></div>
    <div id="sal"></div></div>
    <div class="foot"><button class="btn ghost grow" id="cx">${cerrada ? 'Cerrar' : 'Cancelar'}</button>${cerrada ? '' : '<button class="btn cu grow" id="ok">Guardar</button>'}</div></div>`;
  document.body.appendChild(ov);
  const ls = $('#ls', ov);
  const descMonto = () => desc.on ? soloDigitos(desc.monto) : 0;
  function dibujar() {
    ls.innerHTML = lineas.map((l, i) => `<div class="linea" data-i="${i}">
      <select class="in" data-k="forma" aria-label="Forma de pago" ${cerrada ? 'disabled' : ''}>${S.cat.formas.map(f => `<option value="${f}" ${f === l.forma ? 'selected' : ''}>${FL[f]}</option>`).join('')}</select>
      <select class="in banco" data-k="banco" aria-label="Banco" ${conBanco(l.forma) && l.forma !== 'CHEQUE' && !cerrada ? '' : 'disabled'}><option value="">${l.forma === 'CHEQUE' ? 'Ver abajo' : conBanco(l.forma) ? 'Banco' : '—'}</option>${l.forma === 'CHEQUE' ? '' : S.cat.bancos.map(b => `<option ${b === l.banco ? 'selected' : ''}>${b}</option>`).join('')}</select>
      <input class="in n mto" data-k="monto" inputmode="numeric" aria-label="Monto" value="${l.monto}" ${cerrada ? 'disabled' : ''}>
      <button class="x" data-del="${i}" aria-label="Quitar" ${cerrada || lineas.length < 2 ? 'disabled' : ''}>×</button></div>
      ${l.forma === 'CHEQUE' ? `<div class="lch" data-i="${i}">${camposCheque(l, 'l' + i)}</div>` : ''}`).join('');
    $$('.lch .cheque', ls).forEach(avisoTipoCheque);
    if (cerrada) $$('.lch input, .lch select', ls).forEach(x => x.disabled = true);
    saldo();
  }
  function saldo() {
    const dif = d.total - lineas.reduce((a, l) => a + soloDigitos(l.monto), 0) - descMonto();
    $('#sal', ov).innerHTML = `<div class="saldo ${dif === 0 ? 'ok' : 'no'}"><span>${dif === 0 ? 'Cuadra con el documento' : dif > 0 ? 'Falta asignar' : 'Te pasaste por'}</span><span>${clp(Math.abs(dif))}</span></div>`;
    const ok = $('#ok', ov); if (ok) ok.disabled = dif !== 0;
    return dif;
  }
  ls.oninput = ls.onchange = e => {
    const c = e.target.closest('.lch'); if (c) { Object.assign(lineas[c.dataset.i], leerCheque(c).datos); return; }
    const r = e.target.closest('.linea'); if (!r) return; const l = lineas[r.dataset.i];
    l[e.target.dataset.k] = e.target.value;
    if (e.target.dataset.k === 'forma') { if (!conBanco(l.forma) || l.forma === 'CHEQUE') l.banco = ''; dibujar(); } else saldo(); };
  ls.onclick = e => { const i = e.target.dataset.del; if (i !== undefined) { lineas.splice(i, 1); dibujar(); } };
  const qk = $('#qk', ov); if (qk) qk.onclick = e => { const f = e.target.dataset.q; if (!f) return;
    lineas = [{ forma: f, banco: '', monto: d.total - descMonto() }]; dibujar(); };
  const add = $('#add', ov); if (add) add.onclick = () => { const dif = saldo();
    lineas.push({ forma: 'TRANSFERENCIA', banco: '', monto: dif > 0 ? dif : 0 }); dibujar(); };
  $('#don', ov).onchange = e => { desc.on = e.target.checked; $('#dbox', ov).style.display = desc.on ? '' : 'none'; saldo(); };
  $('#dm', ov).oninput = e => { desc.monto = e.target.value; saldo(); };
  $('#dmo', ov).oninput = e => { desc.motivo = e.target.value; };
  $('#cx', ov).onclick = () => cerrarHoja(ov);
  ov.onclick = e => { if (e.target === ov) cerrarHoja(ov); };
  const esc_ = e => { if (e.key === 'Escape') { cerrarHoja(ov); document.removeEventListener('keydown', esc_); } };
  document.addEventListener('keydown', esc_);
  const ok = $('#ok', ov);
  if (ok) ok.onclick = async () => {
    if (saldo() !== 0) return;
    if (desc.on && !desc.motivo.trim()) return toast('Escribe el motivo del descuento.', true);
    if (lineas.some(l => (l.forma === 'TRANSFERENCIA' || l.forma === 'DEP_EFECTIVO') && !l.banco)) return toast('Indica a qué banco llegó la transferencia o depósito.', true);
    for (const c of $$('.lch', ls)) { const r = leerCheque(c); if (r.error) return toast(r.error, true); Object.assign(lineas[c.dataset.i], r.datos); }
    ok.disabled = true;
    try {
      const ls = lineas.map(l => Object.assign({ forma: l.forma, banco: l.banco, monto: soloDigitos(l.monto), referencia: l.referencia || '' },
          l.forma === 'CHEQUE' ? { cheque_numero: l.cheque_numero, cheque_fecha: l.cheque_fecha, cheque_titular: l.cheque_titular } : {}));
      const nuevo = await api('guardarDetalle', S.sess.token, S.fecha, d.folio_key, ls, desc.on ? { monto: soloDigitos(desc.monto), motivo: desc.motivo } : null);
      toast(nuevo._pendiente ? 'Folio ' + d.folio + ' guardado en el teléfono (sin conexión)' : 'Folio ' + d.folio + ' guardado'); cerrarHoja(ov); alGuardar(nuevo._pendiente ? docLocal(d, ls) : nuevo);
    } catch (e) { ok.disabled = false; }
  };
  dibujar();
}

/* ---------- datos del cheque (se piden en todos lados donde se elige cheque) ---------- */
const NOMBRES_BANCO = { 'BANCO DE CHILE': 'Banco de Chile', BANCOESTADO: 'BancoEstado', SANTANDER: 'Santander', BCI: 'BCI', ITAU: 'Itaú', SCOTIABANK: 'Scotiabank',
  BICE: 'BICE', SECURITY: 'Security', FALABELLA: 'Falabella', RIPLEY: 'Ripley', CONSORCIO: 'Consorcio', INTERNACIONAL: 'Internacional', COOPEUCH: 'Coopeuch', OTRO: 'Otro' };
const nombreBanco = b => NOMBRES_BANCO[b] || b;
function camposCheque(v, id) {
  v = v || {}; id = id || 'ch';
  return `<div class="cheque" data-cheque="${id}">
    <div><label class="f">Banco del cheque</label><select class="in" data-c="banco"><option value="">Elige…</option>${(S.cat.bancosCheque || S.cat.bancos).map(b =>
      `<option value="${esc(b)}" ${b === v.banco ? 'selected' : ''}>${esc(nombreBanco(b))}</option>`).join('')}</select></div>
    <div><label class="f">N° de cheque</label><input class="in n" data-c="cheque_numero" inputmode="numeric" value="${esc(v.cheque_numero || '')}" placeholder="Ej: 4512398"></div>
    <div><label class="f">Fecha del cheque <span class="muted">(desde cuándo se puede cobrar)</span></label><input class="in" type="date" data-c="cheque_fecha" value="${esc(v.cheque_fecha || S.fecha)}"></div>
    <div><label class="f">Titular o RUT <span class="muted">(opcional)</span></label><input class="in" data-c="cheque_titular" value="${esc(v.cheque_titular || '')}"></div>
    <div class="muted chtipo"></div></div>`;
}
/** Lee los datos del cheque de un contenedor; devuelve {datos} o {error}. */
function leerCheque(box) {
  const g = k => ($('[data-c="' + k + '"]', box) || {}).value || '';
  const datos = { banco: g('banco'), cheque_numero: g('cheque_numero').replace(/\D/g, ''), cheque_fecha: g('cheque_fecha'), cheque_titular: g('cheque_titular').trim() };
  const error = !datos.banco ? 'Elige el banco del cheque.' : !datos.cheque_numero ? 'Escribe el número del cheque.' : !datos.cheque_fecha ? 'Indica la fecha del cheque.' : '';
  return { datos, error };
}
/** Muestra "Al día" o "A fecha" bajo el formulario, según la fecha de cobro. */
function avisoTipoCheque(box) {
  const f = ($('[data-c="cheque_fecha"]', box) || {}).value, t = $('.chtipo', box); if (!t) return;
  t.textContent = !f ? '' : f > S.fecha ? 'Cheque a fecha: se puede cobrar desde el ' + f.split('-').reverse().join('-') + '.' : 'Cheque al día: se puede cobrar desde ya.';
}
document.addEventListener('input', e => { const b = e.target.closest && e.target.closest('.cheque'); if (b) avisoTipoCheque(b); });
document.addEventListener('change', e => { const b = e.target.closest && e.target.closest('.cheque'); if (b) avisoTipoCheque(b); });

/* ---------- detalle rápido: un toque por folio ----------
   La mayoría de los folios se pagan de una sola forma. Se toca cómo pagó el cliente (y el banco si fue transferencia)
   y se guarda solo; enseguida se abre el siguiente pendiente. Pagos mixtos, abonos y descuentos van al detalle completo. */
const FORMAS_RAPIDAS = [['EFECTIVO', 'Efectivo', 'cash'], ['TRANSFERENCIA', 'Transferencia', 'bank'], ['CREDITO', 'Crédito', 'receipt'], ['CHEQUE', 'Cheque', 'list']];
const esCreditoDTE = d => /cr[ée]dito/i.test(d.condicion_dte);
function abrirDetalle(d, estadoDia, alGuardar, siguiente, ovPrevio) {
  const cerrada = estadoDia === 'CERRADA';
  const descPend = d.descuentos.some(x => x.estado === 'PENDIENTE');
  if (cerrada || descPend || d.pagos.length > 1) { if (ovPrevio) ovPrevio.remove(); return abrirDetalleCompleto(d, estadoDia, alGuardar); }
  const aprob = d.descuentos.filter(x => x.estado === 'APROBADO').reduce((a, x) => a + x.monto, 0);
  const monto = d.total - aprob;
  const actual = d.pagos[0] ? d.pagos[0].forma : '';
  const sugerida = actual || (esCreditoDTE(d) ? 'CREDITO' : '');
  let bancoPref = ''; try { bancoPref = localStorage.getItem('rn_banco_' + S.sess.usuario) || ''; } catch (e) {}
  const ov = ovPrevio || document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet rapido" role="dialog" aria-modal="true" aria-label="Folio ${esc(d.folio)}"><div class="grip"></div><div class="body">
    <div class="muted">${esc(d.tipo.replace(' Electrónica', ''))} ${esc(d.folio)}${esCreditoDTE(d) ? ' · <b style="color:var(--warn)">Mi DTE dice crédito</b>' : ''}</div>
    <div style="font-weight:700;font-size:18px;line-height:1.25;margin:2px 0 2px">${esc(d.cliente)}</div>
    <div class="big">${clp(monto)}</div>${aprob ? `<div class="muted">Total ${clp(d.total)} − descuento autorizado ${clp(aprob)}</div>` : ''}
    <div class="pregunta">¿Cómo te pagó?</div>
    <div class="formas" id="fz">${FORMAS_RAPIDAS.map(f => `<button type="button" data-f="${f[0]}" class="${f[0] === sugerida ? 'sug' : ''}">${icon(f[2])}<span>${f[1]}</span>
      ${f[0] === actual ? '<small>Marcado</small>' : f[0] === sugerida ? '<small>Sugerido</small>' : ''}</button>`).join('')}</div>
    <div id="chz" hidden><div class="pregunta">Datos del cheque</div>${camposCheque((d.pagos[0] || {}).forma === 'CHEQUE' ? d.pagos[0] : null, 'q')}
      <button type="button" class="btn cu" id="chOk" style="width:100%;margin-top:10px">Guardar cheque</button></div>
    <div id="bz" hidden><div class="pregunta" id="bzT">¿A qué banco llegó?</div>
      <div class="bancos">${S.cat.bancos.map(b => `<button type="button" data-b="${esc(b)}" class="${b === ((d.pagos[0] || {}).banco || bancoPref) ? 'sug' : ''}">${esc(b)}</button>`).join('')}</div></div>
    <button type="button" class="link" id="mix">Pagó de dos formas, abonó una parte o hubo descuento</button>
    </div><div class="foot"><span class="muted grow" id="qd"></span><button class="btn ghost" id="cx">Cerrar</button></div></div>`;
  if (!ovPrevio) document.body.appendChild(ov);
  const quedan = siguiente ? siguiente.cuantos() : 0;
  $('#qd', ov).textContent = quedan ? (quedan === 1 && d.estado !== 'DETALLADO' ? 'Es el último por detallar' : `Quedan ${quedan} por detallar`) : '';
  let forma = null;
  // Sin esperas: el folio se marca al instante y se guarda por detrás (en orden), mientras ya se detalla el siguiente.
  const guardar = (f, banco, cheque) => {
    if (banco && f === 'TRANSFERENCIA') try { localStorage.setItem('rn_banco_' + S.sess.usuario, banco); } catch (e) {}
    const lineas = [Object.assign({ forma: f, banco: banco || '', monto, referencia: '' }, cheque || {})];
    alGuardar(Object.assign({}, d, { estado: 'DETALLADO', pagos: lineas, pagado: monto, diferencia: d.total - monto - aprob, detalladoPor: S.sess.rol === 'VENDEDOR' ? '' : S.sess.nombre }));
    encolarGuardado(d, lineas, alGuardar);
    const sig = siguiente && d.estado !== 'DETALLADO' && siguiente.proximo(d.folio_key);   // solo encadena si venía de un pendiente
    if (sig) { toast(`Folio ${d.folio}: ${FL[f].toLowerCase()} ✓`); abrirDetalle(sig, estadoDia, alGuardar, siguiente, ov); }
    else { cerrarHoja(ov); toast(siguiente ? '¡Listo! Todos tus folios están detallados.' : 'Folio ' + d.folio + ' guardado'); }
  };
  $('#fz', ov).onclick = e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    forma = b.dataset.f;
    $$('#fz button', ov).forEach(x => x.classList.toggle('on', x === b));
    $('#bz', ov).hidden = forma !== 'TRANSFERENCIA'; $('#chz', ov).hidden = forma !== 'CHEQUE';
    if (forma === 'TRANSFERENCIA') { $('#bzT', ov).textContent = '¿A qué banco llegó?'; $('#bz', ov).scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    if (forma === 'CHEQUE') { avisoTipoCheque($('#chz .cheque', ov)); $('#chz', ov).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const n = $('#chz [data-c="banco"]', ov); if (n && !n.value) n.focus(); return; }
    guardar(forma);
  };
  $('#chOk', ov).onclick = () => {
    const r = leerCheque($('#chz .cheque', ov)); if (r.error) return toast(r.error, true);
    const { banco, ...resto } = r.datos; guardar('CHEQUE', banco, resto);
  };
  $('.bancos', ov).onclick = e => { const b = e.target.closest('[data-b]'); if (b && forma) guardar(forma, b.dataset.b); };
  $('#mix', ov).onclick = () => { ov.remove(); abrirDetalleCompleto(d, estadoDia, alGuardar); };
  $('#cx', ov).onclick = () => cerrarHoja(ov);
  ov.onclick = e => { if (e.target === ov) cerrarHoja(ov); };
}

/* cola de guardado: uno tras otro, sin bloquear la pantalla. Si uno falla, el folio vuelve a "Por detallar". */
const COLA = [];
let colaCorriendo = false;
function encolarGuardado(d, lineas, alGuardar) {
  COLA.push({ d, lineas, alGuardar, fecha: S.fecha });
  procesarCola();
}
async function procesarCola() {
  if (colaCorriendo) return;
  colaCorriendo = true;
  while (COLA.length) {
    const x = COLA[0];
    try { await api('guardarDetalle', S.sess.token, x.fecha, x.d.folio_key, x.lineas, null, true); }      // `true`: el servidor responde corto (ya se ve el resultado en pantalla)
    catch (e) { x.alGuardar(x.d); toast(`No se pudo guardar el folio ${x.d.folio}. Quedó como "Por detallar".`, true); }
    COLA.shift();
  }
  colaCorriendo = false;
}
window.addEventListener('beforeunload', e => { if (COLA.length) { e.preventDefault(); e.returnValue = ''; } });

/** Detallar varios de una vez: se elige la forma de pago de cada folio (con banco si corresponde) y se guarda todo junto. */
function marcarVarios(docs, alGuardar) {
  const pend = docs.filter(d => d.estado !== 'DETALLADO');
  const bloqueado = d => d.descuentos.some(x => x.estado === 'PENDIENTE');
  // opciones: forma|banco
  const OPC = [['EFECTIVO', ''], ['CREDITO', '']].concat(S.cat.bancos.map(b => ['TRANSFERENCIA', b]), [['CHEQUE', '']]);
  const cheques = {};   // datos de cheque por folio
  const etiqueta = (f, b, k) => f === 'TRANSFERENCIA' ? 'Transf. ' + b : f === 'CHEQUE' ? (k && cheques[k] && cheques[k].cheque_numero ? 'Cheque N° ' + cheques[k].cheque_numero : 'Cheque…') : FL[f];
  const color = f => f === 'CREDITO' ? 'warn' : f === 'EFECTIVO' ? 'ok' : 'cu';
  const sugerida = d => esCreditoDTE(d) ? ['CREDITO', ''] : ['EFECTIVO', ''];
  const sel = {}; pend.forEach(d => { if (!bloqueado(d)) sel[d.folio_key] = sugerida(d); });
  let abierto = null;
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Detallar varios folios"><div class="grip"></div><div class="body">
    <div style="font-weight:700;font-size:19px">Detallar varios de una vez</div>
    <p class="muted" style="margin:4px 0 10px">Toca la forma de pago de un folio para cambiarla (efectivo, crédito, transferencia o cheque con su banco). Quita el ✓ a los que quieras dejar para después. Al final, guarda todo junto.</p>
    <div class="row" style="margin-bottom:8px;flex-wrap:wrap"><button type="button" class="btn ghost sm" id="tE">Todos en efectivo</button><button type="button" class="btn ghost sm" id="tM">Según Mi DTE</button></div>
    <div id="vl"></div><div class="muted" id="vres" style="margin-top:10px"></div></div>
    <div class="foot"><button class="btn ghost" id="cx">Cancelar</button><button class="btn cu grow" id="ok"></button></div></div>`;
  document.body.appendChild(ov);
  const pintar = () => {
    $('#vl', ov).innerHTML = pend.map(d => { const s = sel[d.folio_key], b = bloqueado(d);
      return `<div class="vrow ${s ? '' : 'off'}" data-k="${esc(d.folio_key)}">
        <button type="button" class="ck" data-ck ${b ? 'disabled' : ''} aria-label="Incluir">${s ? '✓' : ''}</button>
        <div class="grow"><b>${esc(d.cliente)}</b><div class="muted">${esc(d.tipo.replace(' Electrónica', ''))} ${esc(d.folio)} · ${clp(d.total)}${b ? ' · descuento pendiente: detállalo aparte' : ''}</div></div>
        ${s ? `<button type="button" class="chip ${color(s[0])}" data-sw>${esc(etiqueta(s[0], s[1], d.folio_key))} ▾</button>` : ''}</div>
        ${abierto === d.folio_key && s ? `<div class="vopc" data-k="${esc(d.folio_key)}">${OPC.map(o => `<button type="button" data-o="${o[0]}|${esc(o[1])}"
          class="${o[0] === s[0] && (o[1] === s[1] || o[0] === 'CHEQUE') ? 'on' : ''}">${esc(o[0] === 'CHEQUE' ? 'Cheque…' : etiqueta(o[0], o[1]))}</button>`).join('')}</div>` : ''}
        ${s && s[0] === 'CHEQUE' ? `<div class="vch" data-k="${esc(d.folio_key)}">${camposCheque(cheques[d.folio_key], 'v' + d.folio_key)}</div>` : ''}`; }).join('');
    $$('.vch .cheque', ov).forEach(avisoTipoCheque);
    const ks = Object.keys(sel).filter(k => sel[k]);
    const tot = {}; pend.forEach(d => { const s = sel[d.folio_key]; if (s) { const k = s[0] === 'TRANSFERENCIA' ? 'Transferencia' : FL[s[0]]; tot[k] = (tot[k] || 0) + d.total; } });
    $('#vres', ov).textContent = Object.keys(tot).map(k => k + ' ' + clp(tot[k])).join(' · ');
    $('#ok', ov).disabled = !ks.length;
    $('#ok', ov).innerHTML = ks.length ? `Guardar ${ks.length} folio${ks.length > 1 ? 's' : ''}` : 'Elige al menos uno';
  };
  $('#vl', ov).onclick = e => {
    const o = e.target.closest('[data-o]');
    if (o) { const [f, b] = o.dataset.o.split('|'), k = o.closest('.vopc').dataset.k; sel[k] = [f, b]; abierto = null; pintar();
      if (f === 'CHEQUE') { const sb = $('.vch[data-k="' + k + '"] [data-c="banco"]', ov); if (sb) { sb.scrollIntoView({ behavior: 'smooth', block: 'center' }); sb.focus(); } }
      return; }
    const r = e.target.closest('.vrow'); if (!r) return; const k = r.dataset.k, d = pend.find(x => x.folio_key === k);
    if (bloqueado(d)) return;
    if (e.target.closest('[data-sw]')) { abierto = abierto === k ? null : k; return pintar(); }
    sel[k] = sel[k] ? '' : sugerida(d); if (!sel[k] && abierto === k) abierto = null;
    pintar();
  };
  // lo que se escribe en los datos del cheque se guarda al momento (para no perderlo al redibujar)
  $('#vl', ov).addEventListener('input', e => { const c = e.target.closest('.vch'); if (!c) return; cheques[c.dataset.k] = leerCheque(c).datos;
    const chip = $('.vrow[data-k="' + c.dataset.k + '"] [data-sw]', ov); if (chip) chip.textContent = etiqueta('CHEQUE', '', c.dataset.k) + ' ▾'; });
  $('#vl', ov).addEventListener('change', e => { const c = e.target.closest('.vch'); if (c) cheques[c.dataset.k] = leerCheque(c).datos; });
  $('#tE', ov).onclick = () => { Object.keys(sel).forEach(k => { if (sel[k]) sel[k] = ['EFECTIVO', '']; }); abierto = null; pintar(); };
  $('#tM', ov).onclick = () => { pend.forEach(d => { if (sel[d.folio_key]) sel[d.folio_key] = sugerida(d); }); abierto = null; pintar(); };
  $('#cx', ov).onclick = () => cerrarHoja(ov);
  ov.onclick = e => { if (e.target === ov) cerrarHoja(ov); };
  $('#ok', ov).onclick = async () => {
    const ks = Object.keys(sel).filter(k => sel[k]);
    for (const k of ks.filter(k => sel[k][0] === 'CHEQUE')) {
      const r = leerCheque($('.vch[data-k="' + k + '"]', ov));
      if (r.error) { const d = pend.find(x => x.folio_key === k); toast('Folio ' + d.folio + ': ' + r.error.toLowerCase(), true);
        const c = $('.vch[data-k="' + k + '"]', ov); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      cheques[k] = r.datos;
    }
    const items = ks.map(k => sel[k][0] === 'CHEQUE' ? Object.assign({ folio_key: k, forma: 'CHEQUE' }, cheques[k]) : { folio_key: k, forma: sel[k][0], banco: sel[k][1] });
    try {
      const r = await api('guardarVarios', S.sess.token, S.fecha, items);
      cerrarHoja(ov);
      if (r._pendiente) {
        alGuardar(items.map(it => { const d = pend.find(x => x.folio_key === it.folio_key), aprob = d.descuentos.filter(x => x.estado === 'APROBADO').reduce((a, x) => a + x.monto, 0);
          return docLocal(d, [Object.assign({}, it, { referencia: '', monto: d.total - aprob })]); }));
        toast(`${items.length} folio${items.length === 1 ? '' : 's'} guardado${items.length === 1 ? '' : 's'} en el teléfono (sin conexión)`); return;
      }
      alGuardar(r.docs);
      toast(`${r.guardados} folio${r.guardados === 1 ? '' : 's'} guardado${r.guardados === 1 ? '' : 's'}${r.saltados ? ` · ${r.saltados} se saltaron` : ''}`);
    } catch (e) {}
  };
  pintar();
}

/* ============ DEVOLUCIONES (mermas y reprocesos) ============ */
const MOTIVOS_DEV = ['Producto vencido', 'Mal estado / en mal olor', 'Empaque dañado', 'Error de pedido', 'Reclamo de calidad', 'Otro'];
async function vDevoluciones(m) {
  const rows = await api('listarDevoluciones', S.sess.token, S.fecha);
  const cats = {}; S.cat.productos.forEach(p => (cats[p.categoria || 'REVISAR'] = cats[p.categoria || 'REVISAR'] || []).push(p));
  const opcProd = Object.keys(cats).map(c => `<optgroup label="${esc(CATS[c] || c)}">${cats[c].map(p => `<option value="${esc(p.codigo)}" data-u="${esc(p.unidad)}">${esc(p.nombre)}</option>`).join('')}</optgroup>`).join('');
  let tipo = 'MERMA';
  render(m, `<h2>Devoluciones</h2><p class="lead">Producto que vuelve y no se puede vender. <b>Merma</b>: se descarta. <b>Reproceso</b>: vuelve a producción. Cada una se justifica con una nota de crédito: el N° y el monto son obligatorios; la foto es opcional.</p>
    <div class="card" id="dvf">
      <div class="seg" id="dvt" style="width:100%;display:grid;grid-template-columns:1fr 1fr"><button type="button" data-t="MERMA" class="on">Merma</button><button type="button" data-t="REPROCESO">Reproceso</button></div>
      <div class="grid g3" style="margin-top:12px">
        <div><label class="f" for="dv_p">Producto</label><select class="in" id="dv_p"><option value="">Elige un producto…</option>${opcProd}</select></div>
        <div><label class="f" for="dv_c">Cantidad <span class="muted" id="dv_u"></span></label><input class="in n" id="dv_c" inputmode="decimal" placeholder="0"></div>
        <div><label class="f" for="dv_oc">N° nota de crédito</label><input class="in" id="dv_oc" inputmode="numeric" autocomplete="off"></div>
        <div><label class="f" for="dv_mt">Monto de la nota de crédito</label><input class="in n" id="dv_mt" inputmode="numeric" placeholder="$0"></div>
        <div><label class="f" for="dv_o">Viene de</label><select class="in" id="dv_o"><option value="">Cliente / otro</option>${opcVend('')}</select></div>
        <div><label class="f" for="dv_cl">Cliente (si corresponde)</label><input class="in" id="dv_cl" autocomplete="off"></div>
        <div><label class="f" for="dv_m">Motivo</label><select class="in" id="dv_m">${MOTIVOS_DEV.map(x => `<option>${x}</option>`).join('')}</select></div>
        <div><label class="f" for="dv_ob">Observación</label><input class="in" id="dv_ob" autocomplete="off"></div>
        ${campoArchivos('dvf_a').replace('Foto o archivo de respaldo', 'Foto de la nota de crédito (opcional)')}
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn cu" id="dv_ad">Registrar devolución</button></div></div>
    <div id="dvl" style="margin-top:16px"></div>`);
  enlazarCampoArchivos('dvf_a');
  const sel = $('#dv_p'); sel.onchange = () => { const o = sel.selectedOptions[0]; $('#dv_u').textContent = o && o.dataset.u ? '(' + (o.dataset.u === 'UN' ? 'unidades' : 'kilos') + ')' : ''; };
  $('#dvt').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; tipo = b.dataset.t; $$('#dvt button').forEach(x => x.classList.toggle('on', x === b)); };
  const fmt = (n, u) => u === 'UN' ? String(Math.round(n * 100) / 100).replace('.', ',') + ' un' : kg(n) + ' kg';
  function lista(rs) {
    const res = t => { const xs = rs.filter(r => r.tipo === t), k = xs.filter(r => r.unidad !== 'UN').reduce((a, r) => a + r.cantidad, 0), u = xs.filter(r => r.unidad === 'UN').reduce((a, r) => a + r.cantidad, 0);
      return `<div><span>${t === 'MERMA' ? 'Mermas' : 'Reprocesos'}</span><b>${xs.length}</b><small>${[k ? kg(k) + ' kg' : '', u ? u + ' un' : '', xs.length ? clp(xs.reduce((a, r) => a + r.monto, 0)) : ''].filter(Boolean).join(' · ') || '—'}</small></div>`; };
    $('#dvl').innerHTML = rs.length ? `<div class="dvres">${res('MERMA')}${res('REPROCESO')}</div>` + rs.map(r => `<div class="dev">
        <div class="row"><span class="grow"><span class="chip ${r.tipo === 'MERMA' ? 'bad' : 'warn'}">${r.tipo === 'MERMA' ? 'Merma' : 'Reproceso'}</span> <b>${esc(r.producto)}</b></span><b>${fmt(r.cantidad, r.unidad)}</b></div>
        <div class="muted">NC N° <b>${esc(r.nota_credito)}</b> · <b>${clp(r.monto)}</b>${r.motivo ? ' · ' + esc(r.motivo) : ''}${r.origen ? ' · viene de ' + esc((S.cat.vendedores.find(v => v.usuario === r.origen) || {}).nombre || r.origen) : ''}${r.cliente ? ' · ' + esc(r.cliente) : ''}${r.obs ? ' · ' + esc(r.obs) : ''}</div>
        <div class="row" style="margin-top:6px">${chipsAdj(r.adjuntos, 'DEVOLUCIONES', r.id, true)}<span class="grow"></span>
          <button class="x" style="min-height:34px;width:34px" data-id="${esc(r.id)}" aria-label="Borrar">×</button></div></div>`).join('')
      : '<div class="empty">Sin devoluciones este día.</div>';
  }
  lista(rows);
  const recargar = async () => { const args = [S.sess.token, S.fecha]; lista(copia(await pedir('listarDevoluciones', args, claveApi('listarDevoluciones', args)))); };   // siempre lo último del servidor
  activarAdjuntarDespues($('#dvl'), recargar);
  $('#dvl').addEventListener('click', async e => { const id = e.target.dataset && e.target.dataset.id; if (!id || !confirm('¿Borrar esta devolución?')) return;
    await api('borrarDevolucion', S.sess.token, id); await recargar(); });
  $('#dv_ad').onclick = async () => {
    const o = { tipo, codigo: sel.value, cantidad: String(dec($('#dv_c').value)), nota_credito: $('#dv_oc').value.trim(), monto: String(soloDigitos($('#dv_mt').value)), origen: $('#dv_o').value, cliente: $('#dv_cl').value.trim(), motivo: $('#dv_m').value, obs: $('#dv_ob').value.trim() };
    if (!o.codigo) return toast('Elige el producto.', true);
    if (!(dec(o.cantidad) > 0)) return toast('Ingresa la cantidad.', true);
    if (!o.nota_credito) return toast('Falta el N° de la nota de crédito.', true);
    if (o.monto === '0') return toast('Falta el monto de la nota de crédito.', true);
    const b = $('#dv_ad'); b.disabled = true;
    try {
      const nuevo = await api('guardarDevolucion', S.sess.token, S.fecha, o); toast(nuevo._pendiente ? 'Devolución guardada en el teléfono (sin conexión)' : 'Devolución registrada');
      const fs = [...$('#dvf_a').files];
      if (fs.length && nuevo._pendiente) toast('Sin conexión: la foto no se puede subir ahora. Cuando se envíe la devolución, usa "Adjuntar".', true);
      else if (fs.length) { try { await subirArchivos('DEVOLUCIONES', nuevo.id, fs); } catch (e) { toast('Quedó registrada, pero la foto no subió. Usa "Adjuntar" en la devolución.', true); } }
      ['#dv_c', '#dv_oc', '#dv_mt', '#dv_cl', '#dv_ob'].forEach(x => $(x).value = ''); sel.value = ''; sel.onchange(); $('#dvf_a').value = ''; $('#dvf_a').onchange();
      await recargar();
    } finally { b.disabled = false; }
  };
}

/* ============ DESPACHO Y RETORNO ============ */
async function vDespacho(m) {
  if (!S.vend) S.vend = S.cat.vendedores[0] && S.cat.vendedores[0].usuario;
  const r = await api('getDespacho', S.sess.token, S.fecha, S.vend);
  const reg = {}; r.filas.forEach(f => reg[f.codigo] = f);
  const val = x => x === '' || x == null ? '' : x;
  const cats = {};
  S.cat.productos.forEach(p => (cats[p.categoria || 'REVISAR'] = cats[p.categoria || 'REVISAR'] || []).push(p));
  const orden = Object.keys(cats).sort((a, b) => (Object.keys(CATS).indexOf(a) + 99) % 99 - (Object.keys(CATS).indexOf(b) + 99) % 99);
  render(m, `<h2>Despacho y retorno</h2><p class="lead">${fechaLarga(S.fecha)}. En la mañana anota la salida; en la tarde, al pesar lo que vuelve, el retorno.</p>
    <div class="row" style="margin-bottom:12px"><select class="in" style="width:auto" id="dv">${opcVend(S.vend)}</select>
      ${r.guias.map(g => `<button class="btn ghost sm" data-g="${esc(g.folio)}">Cargar salida desde guía ${esc(g.folio)}</button>`).join('')}</div>
    ${r.hayDetalle ? '' : '<p class="muted">Cuando se importe el Informe de ventas de Mi DTE, aquí verás los kilos facturados y la diferencia.</p>'}
    <div class="colh"><span style="text-align:left">Producto</span><span>Salida</span><span>Retorno</span></div>
    <div id="dt">${orden.map(c => {
      const conDatos = cats[c].some(p => reg[p.codigo] || r.facturado[p.codigo]);
      return `<details class="cat" ${c === 'PROPIOS' || conDatos ? 'open' : ''}><summary><span class="grow">${CATS[c] || esc(c)}</span><span class="muted" data-tot="${esc(c)}"></span></summary>
      ${cats[c].map(p => { const f = reg[p.codigo] || {}; return `<div class="prod" data-c="${esc(p.codigo)}" data-u="${esc(p.unidad)}" data-cat="${esc(c)}">
        <div class="pn">${esc(p.nombre)}<small>${p.unidad === 'UN' ? 'unidades' : 'kilos'}</small></div>
        <input class="in n" data-k="salida" inputmode="decimal" aria-label="Salida ${esc(p.nombre)}" value="${val(f.salida)}">
        <input class="in n" data-k="retorno" inputmode="decimal" aria-label="Retorno ${esc(p.nombre)}" value="${val(f.retorno)}">
        <div class="st"></div></div>`; }).join('')}</details>`; }).join('')}</div>
    <div class="sticky-foot"><div class="card"><div><div class="muted">Kilos vendidos</div><b id="tv" style="font-size:20px"></b></div>
      <button class="btn cu" id="sv">Guardar</button></div></div>`);
  $('#dv').onchange = e => { S.vend = e.target.value; ir('despacho'); };
  const filas = $$('.prod', m);
  function calc() {
    let sal = 0, ret = 0; const porCat = {};
    filas.forEach(el => {
      const c = el.dataset.c, s = $('[data-k=salida]', el).value, rt = $('[data-k=retorno]', el).value;
      const fac = r.facturado[c] || 0, vend = dec(s) - dec(rt), st = $('.st', el);
      let h = '';
      if (s !== '') h += `<span>Vendido <b>${kg(vend)}</b></span>`;
      if (r.hayDetalle && (s !== '' || fac)) {
        const dif = Math.round((vend - fac) * 10) / 10;
        h += `<span>Facturado <b>${kg(fac)}</b></span>`;
        if (s !== '' && rt !== '') h += `<span class="${Math.abs(dif) > 0.2 ? (dif > 0 ? 'warn' : 'bad') : ''}">Diferencia <b>${dif > 0 ? '+' : ''}${kg(dif)}</b></span>`;
      }
      st.innerHTML = h;
      if (el.dataset.u !== 'UN') { sal += dec(s); ret += dec(rt); porCat[el.dataset.cat] = (porCat[el.dataset.cat] || 0) + dec(s); }
    });
    $$('[data-tot]', m).forEach(x => { const v = porCat[x.dataset.tot]; x.textContent = v ? kg(v) + ' kg salida' : ''; });
    $('#tv').textContent = kg(sal - ret) + ' kg';
  }
  $('#dt').oninput = calc; calc();
  m.onclick = e => { const g = e.target.dataset.g; if (!g) return;
    const guia = r.guias.find(x => x.folio === g);
    filas.forEach(el => { const k = guia.lineas[el.dataset.c]; if (k !== undefined) $('[data-k=salida]', el).value = Math.round(k * 1000) / 1000; });
    $$('.cat', m).forEach(d => { if ($$('[data-k=salida]', d).some(i => i.value)) d.open = true; });
    calc(); toast('Salida cargada desde la guía ' + g + '. Revisa y guarda.'); };
  $('#sv').onclick = async () => {
    const datos = filas.map(el => ({ codigo: el.dataset.c, salida: $('[data-k=salida]', el).value.replace(',', '.'), retorno: $('[data-k=retorno]', el).value.replace(',', '.') }));
    await api('saveDespacho', S.sess.token, S.fecha, S.vend, datos); toast('Despacho de ' + S.vend + ' guardado');
  };
}

/* ============ INVENTARIO DE BODEGA ============ */
async function vInventario(m) {
  const inv = await api('getInventario', S.sess.token, S.fecha);
  S.secInv = S.secInv || 'TERMINADOS';
  const sum = o => Object.keys(o || {}).reduce((a, k) => a + (Number(o[k]) || 0), 0);
  // estado editable por producto
  const est = {};
  inv.filas.forEach(f => {
    const desp = {}; Object.keys(f.otras).forEach(k => { const d = (f.otras[k] || 0) - ((f.otrasManual || {})[k] || 0); if (Math.abs(d) > 1e-9) desp[k] = d; });
    est[f.codigo] = { f, ingreso: f.ingreso || '', otras: Object.assign({}, f.otrasManual || {}), desp, conteo: f.conteo === null ? '' : f.conteo,
      inicial: f.inicial, inicialEditable: !f.conHistoria || f.inicialManual, cambio: false };
  });
  const calc = e => {
    const f = e.f, ini = e.inicialEditable ? dec(e.inicial) : f.inicial;
    const t = ini - sum(f.salVend) - sum(e.desp) - sum(e.otras) + dec(e.ingreso) + sum(f.retVend);
    const final = e.conteo === '' ? t : dec(e.conteo);
    return { t, final, ajuste: e.conteo === '' ? 0 : final - t };
  };
  const nombreSec = id => (inv.secciones.find(x => x.id === id) || {}).nombre || id;
  render(m, `<div class="row"><div class="grow"><h2>Inventario de bodega</h2><p class="lead" style="margin:0">${fechaLarga(S.fecha)}</p></div>
      <button class="btn ghost sm" id="plan">Planilla del día</button></div>
    <p class="muted">Lo de los vendedores llega solo desde Despacho. Aquí anota lo que entra de fábrica y lo que sale a otros lados.</p>
    <div class="seg secs" id="sec">${inv.secciones.map(x => `<button data-s="${x.id}">${x.nombre}</button>`).join('')}</div>
    <div id="alertInv"></div><div id="lista"></div>
    <div class="card" style="margin-top:12px"><b>¿Falta un producto?</b><div class="row" style="margin-top:8px">
      <input class="in grow" id="npN" placeholder="Nombre, como en la planilla"><select class="in" id="npU" style="width:auto"><option>KG</option><option>UN</option></select>
      <button class="btn ghost sm" id="npA">Agregar a esta sección</button></div></div>
    <div id="lnkInv"></div>
    <div class="sticky-foot"><div class="card"><div><div class="muted" id="cambios">Sin cambios</div></div><button class="btn cu" id="gi">Guardar</button></div></div>`);
  const lista = $('#lista');
  function pintar() {
    $$('#sec button').forEach(b => b.classList.toggle('on', b.dataset.s === S.secInv));
    const cam = S.secInv === 'CAMARA';
    const filas = inv.filas.filter(f => f.seccion === S.secInv);
    const negativos = inv.filas.filter(f => calc(est[f.codigo]).final < -0.001);
    $('#alertInv').innerHTML = negativos.length ? `<div class="alert"><b>${negativos.length} producto(s) con stock negativo:</b> ${negativos.slice(0, 6).map(f => esc(f.nombre)).join(', ')}${negativos.length > 6 ? '…' : ''}. Revisa ingresos o registra un conteo.</div>` : '';
    lista.innerHTML = filas.length ? filas.map(f => {
      const e = est[f.codigo], c = calc(e), u = f.unidad === 'UN' ? 'un.' : 'kg';
      const detalle = cam ? '' : [
        sum(f.salVend) ? `Vendedores −${kg(sum(f.salVend))}` : '', sum(f.retVend) ? `Retorno +${kg(sum(f.retVend))}` : '',
        sum(e.desp) ? `Supermercado/otros −${kg(sum(e.desp))}` : ''].filter(Boolean).join(' · ');
      return `<div class="inv" data-c="${esc(f.codigo)}">
        <div class="pn">${esc(f.nombre)}<small>${e.inicialEditable ? 'Inventario inicial' : 'Inicial ' + kg(f.inicial) + ' ' + u}${detalle ? ' · ' + detalle : ''}</small></div>
        <div class="fin ${c.final < -0.001 ? 'neg' : ''}"><span>Final</span><b>${kg(c.final)}</b>${e.conteo !== '' && Math.abs(c.ajuste) > 0.001 ? `<em>ajuste ${c.ajuste > 0 ? '+' : ''}${kg(c.ajuste)}</em>` : ''}</div>
        <div class="campos">
          ${e.inicialEditable ? `<label>Inicial<input class="in n" data-k="inicial" inputmode="decimal" value="${e.inicial}"></label>` : ''}
          <label>${cam ? 'Ingreso producto' : 'Ingreso fábrica'}<input class="in n" data-k="ingreso" inputmode="decimal" value="${e.ingreso}"></label>
          ${cam ? `<label>Salida fábrica<input class="in n" data-k="o:FABRICA" inputmode="decimal" value="${e.otras.FABRICA || ''}"></label>
                   <label>Salida vendedores<input class="in n" data-k="o:VENDEDORES" inputmode="decimal" value="${e.otras.VENDEDORES || ''}"></label>`
                : `<label>Otras salidas<button type="button" class="in otras" data-otras="1">${sum(e.otras) ? kg(sum(e.otras)) + ' · ' + Object.keys(e.otras).filter(k => e.otras[k]).length + ' destino(s)' : 'Agregar'}</button></label>`}
          <label>Conteo físico<input class="in n" data-k="conteo" inputmode="decimal" placeholder="—" value="${e.conteo}"></label>
        </div></div>`; }).join('') : '<div class="empty">No hay productos en esta sección.</div>';
    const n = Object.values(est).filter(e => e.cambio).length;
    $('#cambios').textContent = n ? n + ' producto(s) con cambios sin guardar' : 'Sin cambios';
  }
  lista.oninput = e => {
    const box = e.target.closest('.inv'); const k = e.target.dataset.k; if (!box || !k) return;
    const st = est[box.dataset.c];
    if (k.startsWith('o:')) st.otras[k.slice(2)] = e.target.value; else st[k] = e.target.value;
    st.cambio = true;
    const c = calc(st), fin = $('.fin', box);
    fin.classList.toggle('neg', c.final < -0.001);
    fin.innerHTML = `<span>Final</span><b>${kg(c.final)}</b>${st.conteo !== '' && Math.abs(c.ajuste) > 0.001 ? `<em>ajuste ${c.ajuste > 0 ? '+' : ''}${kg(c.ajuste)}</em>` : ''}`;
    const n = Object.values(est).filter(x => x.cambio).length;
    $('#cambios').textContent = n + ' producto(s) con cambios sin guardar';
  };
  lista.onclick = e => { const b = e.target.closest('[data-otras]'); if (!b) return; abrirOtras(est[b.closest('.inv').dataset.c]); };
  function abrirOtras(st) {
    const lista2 = inv.destinos.filter(d => d !== 'SUPERMERCADO' || !st.desp.SUPERMERCADO);
    const dist = inv.distribuidores || [];
    const extras = Object.keys(st.otras).filter(k => lista2.indexOf(k) < 0 && dist.indexOf(k) < 0);
    const campo = d => `<label class="f" style="margin:0">${esc(d === 'SUPERMERCADO' ? 'Supermercado' : d.charAt(0) + d.slice(1).toLowerCase())}
        <input class="in n" data-d="${esc(d)}" inputmode="decimal" value="${st.otras[d] || ''}"></label>`;
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div><div class="body">
      <div class="muted">Otras salidas</div><div style="font-weight:700;font-size:18px">${esc(st.f.nombre)}</div>
      ${Object.keys(st.desp).length ? `<p class="muted">Desde Despacho: ${Object.keys(st.desp).map(k => esc(k) + ' ' + kg(st.desp[k])).join(', ')}</p>` : ''}
      <div class="muted" style="margin-top:12px;font-weight:700">Distribuidores</div>
      <div class="grid g2" style="margin-top:6px">${dist.map(campo).join('')}</div>
      <div class="muted" style="margin-top:14px;font-weight:700">Otros destinos</div>
      <div class="grid g2" style="margin-top:6px" id="ods">${lista2.concat(extras).map(campo).join('')}</div>
      <div class="row" style="margin-top:12px"><input class="in grow" id="odN" placeholder="Otro destino o distribuidor nuevo"><input class="in n" id="odQ" style="width:110px" inputmode="decimal" placeholder="Cantidad"></div>
      </div><div class="foot"><button class="btn ghost grow" id="odX">Cancelar</button><button class="btn cu grow" id="odOk">Listo</button></div></div>`;
    document.body.appendChild(ov);
    $('#odX', ov).onclick = () => cerrarHoja(ov); ov.onclick = e => { if (e.target === ov) cerrarHoja(ov); };
    $('#odOk', ov).onclick = () => {
      const o = {}; $$('[data-d]', ov).forEach(i => { if (i.value !== '' && dec(i.value)) o[i.dataset.d] = i.value; });
      const n = $('#odN', ov).value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(), q = $('#odQ', ov).value;
      if (n && q) o[n] = String(dec(q) + dec(o[n] || 0));
      st.otras = o; st.cambio = true; cerrarHoja(ov); pintar();
    };
  }
  $('#sec').onclick = e => { const b = e.target.closest('button'); if (b) { S.secInv = b.dataset.s; pintar(); } };
  $('#gi').onclick = async () => {
    const cambiados = Object.values(est).filter(e => e.cambio);
    if (!cambiados.length) return toast('No hay cambios que guardar.');
    const b = $('#gi'); b.disabled = true;
    try {
      const nuevo = await api('guardarInventario', S.sess.token, S.fecha, cambiados.map(e => {
        const o = {}; Object.keys(e.otras).forEach(k => { if (e.otras[k] !== '' && dec(e.otras[k])) o[k] = dec(e.otras[k]); });
        const r = { codigo: e.f.codigo, ingreso: e.ingreso === '' ? '' : dec(e.ingreso), otras: o, conteo: e.conteo === '' ? '' : dec(e.conteo) };
        if (e.inicialEditable && String(e.inicial) !== String(e.f.inicial)) r.inicial = dec(e.inicial);
        return r; }));
      toast('Inventario guardado');
      inv.filas = nuevo.filas; nuevo.filas.forEach(f => { est[f.codigo].f = f; est[f.codigo].cambio = false; });
      pintar();
    } finally { b.disabled = false; }
  };
  $('#plan').onclick = async () => {
    if (Object.values(est).some(e => e.cambio) && !confirm('Hay cambios sin guardar que no saldrán en la planilla. ¿Generarla igual?')) return;
    const r = await api('generarPlanillaInventario', S.sess.token, S.fecha);
    $('#lnkInv').innerHTML = `<div class="alert ok fcard" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <span class="grow">Hoja ${esc(r.hoja)} lista en ${esc(r.nombre)} (carpeta Inventario).</span><a class="btn cu sm" href="${esc(r.url)}" target="_blank" rel="noopener">Abrir planilla</a></div>`;
    $('#lnkInv').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  $('#npA').onclick = async () => {
    const n = $('#npN').value.trim(); if (!n) return toast('Escribe el nombre del producto.', true);
    await api('agregarProductoInv', S.sess.token, { nombre: n, seccion: S.secInv, unidad: $('#npU').value });
    toast('Producto agregado a ' + nombreSec(S.secInv)); ir('inventario');
  };
  pintar();
}

/* ============ SALDOS DE CLIENTES ============ */
/** Clientes de la lista de créditos que todavía no tienen RUT: se escribe el RUT y queda vinculado (con el nombre del DTE si ya existe). */
function abrirSinRut(lista) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet ancha" role="dialog" aria-modal="true" aria-label="Completar RUT"><div class="grip"></div><div class="body">
    <div style="font-weight:700;font-size:19px">Clientes sin RUT</div>
    <p class="muted" style="margin:4px 0 10px">Escribe el RUT de cada uno. Desde ahí todo se une por RUT y el nombre que vale es el del DTE (si el RUT aún no aparece en el DTE, se usa este nombre hasta que llegue). Si importas más Ventas Diarias, "Buscar RUT otra vez" los completa solo.</p>
    <div id="sr"></div></div><div class="foot"><button class="btn ghost" id="srx">Cerrar</button><span class="grow"></span><button class="btn ghost" id="srb">Buscar RUT otra vez</button></div></div>`;
  document.body.appendChild(ov);
  const pintar = xs => { $('#sr', ov).innerHTML = xs.length ? xs.map((c, i) => `<div class="dfila" style="align-items:center;flex-wrap:wrap" data-a="${esc(c.alias)}" data-n="${esc(c.cliente)}">
      <span class="grow"><b>${esc(c.cliente)}</b><div class="muted">${c.docs} documento${c.docs > 1 ? 's' : ''} · ${clp(c.monto)}</div></span>
      <input class="in" style="width:150px;min-height:40px" placeholder="12.345.678-9" data-rut><button class="btn cu sm" data-v>Vincular</button></div>`).join('') : '<div class="alert ok">Todos tienen RUT.</div>'; };
  pintar(lista);
  $('#srx', ov).onclick = () => cerrarHoja(ov);
  $('#srb', ov).onclick = async () => { const r = await api('reintentarRut', S.sess.token); toast(r.resueltos ? r.resueltos + ' completados' : 'No se encontró ninguno nuevo'); lista = r.sinRutClientes; pintar(lista); };
  $('#sr', ov).onclick = async e => { const b = e.target.closest('[data-v]'); if (!b) return; const fila = b.closest('.dfila'), rut = $('[data-rut]', fila).value.trim();
    if (rut.replace(/[^0-9kK]/g, '').length < 8) return toast('Escribe el RUT completo.', true);
    b.disabled = true; try { await api('vincularRut', S.sess.token, fila.dataset.a, rut, fila.dataset.n); lista = lista.filter(x => x.alias !== fila.dataset.a); pintar(lista); toast('Vinculado'); } finally { b.disabled = false; } };
}

/** Política de crédito de la empresa. Los montos son NETOS (sin IVA). */
const POLITICA = [{ dias: 7, desde: 15000, hasta: 60000 }, { dias: 14, desde: 60001, hasta: 120000 }, { dias: 21, desde: 120001, hasta: 300000 }, { dias: 28, desde: 300001, hasta: Infinity }];
const netoDe = total => Math.round(Number(total || 0) / 1.19);
const plazoPolitica = neto => (POLITICA.find(t => neto >= t.desde && neto <= t.hasta) || {}).dias || 0;
function tarjetaPolitica() {
  return `<div class="card pol"><b>Política de crédito</b><span class="muted"> · montos netos (sin IVA)</span>
    <div class="pol-g">${POLITICA.map(t => `<div class="pol-t"><span class="pol-d">${t.dias}<small>días</small></span><span class="pol-m">${t.hasta === Infinity ? 'Más de ' + clp(t.desde - 1) : clp(t.desde) + ' a ' + clp(t.hasta)}</span></div>`).join('')}</div></div>`;
}

/* ============ USUARIOS (solo administración) ============ */
async function vUsuarios(m) {
  const us = await api('listarUsuariosAdmin', S.sess.token);
  render(m, `<h2>Usuarios</h2><p class="lead" style="margin:0 0 12px">Cada persona entra con su RUT o correo y su propia clave; el rol lo asignas tú aquí. Al crear a alguien o restablecer su clave se genera una clave temporal que debes entregarle en privado: la cambia al entrar.</p>
    <div class="row" style="margin-bottom:10px"><button class="btn cu sm" id="un">+ Nuevo usuario</button></div>
    <div id="ul">${us.map(u => `<div class="cfac"><div class="row" style="gap:10px"><span class="grow"><b>${esc(u.nombre)}</b> <span class="chip">${ROL[u.rol] || u.rol}</span>
        ${u.activo ? '' : '<span class="chip bad">Desactivado</span>'}${u.bloqueado ? '<span class="chip bad">Bloqueado</span>' : ''}${!u.tieneClave ? '<span class="chip warn">Sin clave</span>' : u.debeCambiar ? '<span class="chip warn">Clave temporal pendiente</span>' : ''}
        <div class="muted">${esc([u.rut, u.correo].filter(Boolean).join(' · ') || 'Sin RUT ni correo: no puede ingresar')} · código ${esc(u.usuario)}${u.terminales ? ' · terminales ' + esc(u.terminales) : ''}</div></span>
        <button class="btn ghost sm" data-e="${esc(u.usuario)}">Editar</button><button class="btn ghost sm" data-r="${esc(u.usuario)}">Restablecer clave</button></div></div>`).join('')}</div>`);
  const mostrarClave = (nombre, temporal) => {
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div><div class="body"><div style="font-weight:700;font-size:19px">Clave temporal de ${esc(nombre)}</div>
      <div style="font-size:38px;font-weight:700;letter-spacing:6px;text-align:center;margin:18px 0;color:var(--cu)">${esc(temporal)}</div>
      <p class="muted">Entrégala en privado. Al ingresar por primera vez, ${esc(nombre.split(' ')[0])} creará su propia clave. Esta no se vuelve a mostrar: si se pierde, restablece la clave de nuevo.</p></div><div class="foot"><span class="grow"></span><button class="btn cu" id="okc">Listo</button></div></div>`;
    document.body.appendChild(ov); $('#okc', ov).onclick = () => { cerrarHoja(ov); ir('usuarios'); };
  };
  const editar = u => {
    const ov = document.createElement('div'); ov.className = 'ov'; const nuevo = !u; u = u || { nombre: '', rol: 'VENDEDOR', rut: '', correo: '', terminales: '', activo: true, usuario: '' };
    ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div><div class="body"><div style="font-weight:700;font-size:19px">${nuevo ? 'Nuevo usuario' : 'Editar a ' + esc(u.nombre)}</div>
      <label class="f" for="u1">Nombre</label><input class="in" id="u1" value="${esc(u.nombre)}" autocomplete="off">
      <label class="f" for="u2" style="margin-top:10px">Rol</label><select class="in" id="u2">${['VENDEDOR', 'BODEGA', 'RENDICION', 'SUPERVISOR', 'ADMIN'].map(r => `<option value="${r}" ${u.rol === r ? 'selected' : ''}>${ROL[r] || r}</option>`).join('')}</select>
      <label class="f" for="u3" style="margin-top:10px">RUT</label><input class="in" id="u3" value="${esc(u.rut)}" placeholder="12.345.678-5" autocomplete="off">
      <label class="f" for="u4" style="margin-top:10px">Correo (opcional)</label><input class="in" id="u4" value="${esc(u.correo)}" autocapitalize="none" autocomplete="off">
      <div id="u5w"><label class="f" for="u5" style="margin-top:10px">Terminales de Mi DTE (separados por coma)</label><input class="in" id="u5" value="${esc(u.terminales)}" autocomplete="off"></div>
      <label class="muted" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="u6" ${u.activo ? 'checked' : ''}> Activo (si lo desactivas, no puede ingresar)</label></div>
      <div class="foot"><button class="btn ghost" id="ux">Cancelar</button><span class="grow"></span><button class="btn cu" id="ug">Guardar</button></div></div>`;
    document.body.appendChild(ov);
    const rolCh = () => { $('#u5w', ov).hidden = $('#u2', ov).value !== 'VENDEDOR'; }; $('#u2', ov).onchange = rolCh; rolCh();
    $('#ux', ov).onclick = () => cerrarHoja(ov);
    $('#ug', ov).onclick = async () => {
      const o = { usuario: u.usuario, nombre: $('#u1', ov).value.trim(), rol: $('#u2', ov).value, rut: $('#u3', ov).value.trim(), correo: $('#u4', ov).value.trim(), terminales: $('#u5', ov).value.trim(), activo: $('#u6', ov).checked };
      if (!o.nombre) return toast('Escribe el nombre.', true);
      if (!o.rut && !o.correo) return toast('Indica el RUT o el correo.', true);
      const r = await api('guardarUsuario', S.sess.token, o); cerrarHoja(ov);
      olvidarCache(true);
      if (r.temporal) mostrarClave(o.nombre, r.temporal); else { toast('Guardado'); ir('usuarios'); }
    };
    $('#u1', ov).focus();
  };
  $('#un').onclick = () => editar(null);
  $('#ul').onclick = async e => {
    const be = e.target.closest('[data-e]'), br = e.target.closest('[data-r]');
    if (be) editar(us.find(x => x.usuario === be.dataset.e));
    if (br) { const u = us.find(x => x.usuario === br.dataset.r); if (!confirm('¿Restablecer la clave de ' + u.nombre + '? Se cerrarán sus sesiones abiertas.')) return;
      const r = await api('restablecerClave', S.sess.token, u.usuario); olvidarCache(true); mostrarClave(u.nombre, r.temporal); }
  };
}

/* ============ CHEQUES EN CARTERA ============ */
async function vCheques(m) {
  const r = await api('listarCheques', S.sess.token);
  const hoy = r.hoy, en7 = (() => { const d = new Date(hoy + 'T12:00:00'); d.setDate(d.getDate() + 7); return d.toLocaleDateString('en-CA'); })();
  const todos = r.cheques, cartera = todos.filter(c => c.estado === 'CARTERA');
  const suma = xs => xs.reduce((a, c) => a + c.monto, 0);
  const listos = cartera.filter(c => !c.aFecha), aFecha = cartera.filter(c => c.aFecha), semana = aFecha.filter(c => c.fechaCheque <= en7);
  const FIL = { listos: ['Para cobrar hoy', c => c.estado === 'CARTERA' && !c.aFecha], fecha: ['A fecha', c => c.estado === 'CARTERA' && c.aFecha], todos: ['Toda la cartera', c => c.estado === 'CARTERA'],
    cobrados: ['Cobrados', c => c.estado === 'COBRADO'], protes: ['Protestados', c => c.estado === 'PROTESTADO'] };
  let fil = 'listos', q = '';
  render(m, `<h2>Cheques en cartera</h2><p class="lead" style="margin:0 0 12px">Un cheque sigue siendo crédito hasta que se cobra en el banco. Márcalo cuando lo cobres para que salga de la cartera.</p>
    <div class="kpis"><div><span>En cartera</span><b>${clp(suma(cartera))}</b><small>${cartera.length} cheque${cartera.length === 1 ? '' : 's'}</small></div>
      <div><span>Se pueden cobrar hoy</span><b>${clp(suma(listos))}</b><small>${listos.length} al día</small></div>
      <div><span>A fecha (próximos 7 días)</span><b>${clp(suma(semana))}</b><small>${semana.length} cheque${semana.length === 1 ? '' : 's'}</small></div></div>
    <div class="row" style="margin:14px 0 8px;flex-wrap:wrap"><div class="seg" id="chf" style="flex-wrap:wrap">${Object.keys(FIL).map(k => `<button type="button" data-f="${k}" class="${k === fil ? 'on' : ''}">${FIL[k][0]} <small>${todos.filter(FIL[k][1]).length}</small></button>`).join('')}</div>
      <input class="in grow" id="chq" placeholder="Buscar cliente, RUT o N° de cheque" style="min-width:200px"></div>
    <div id="chl"></div>
    <div class="sticky-foot" id="chb" hidden><div class="card"><div><div class="muted"><span id="chn">0</span> seleccionados</div><b id="cht" style="font-size:20px"></b></div>
      <div class="row" style="gap:8px"><label class="muted" id="chfw" style="display:flex;gap:6px;align-items:center">Cobrado el <input type="date" class="in" id="chd" value="${hoy}" style="width:auto"></label>
      <button class="btn ghost" id="chp">Protestado</button><button class="btn cu" id="chc">Marcar cobrado</button><button class="btn ghost" id="chv" hidden>Devolver a cartera</button></div></div></div>`);
  const sel = new Set();
  const norm = t => normBus(t || '');
  const lista = () => {
    const xs = todos.filter(FIL[fil][1]).filter(c => !q || [c.cliente, c.rut, c.numero, c.documento].some(t => norm(t).indexOf(norm(q)) >= 0));
    $('#chl').innerHTML = xs.length ? xs.map(c => { const dias = c.fechaCheque ? Math.round((new Date(c.fechaCheque + 'T12:00:00') - new Date(hoy + 'T12:00:00')) / 864e5) : null;
      return `<label class="cfac" style="display:block"><div class="row" style="gap:10px"><input type="checkbox" data-k="${esc(c.clave)}" ${sel.has(c.clave) ? 'checked' : ''}>
        <span class="grow"><b>${esc(c.cliente || 'Sin nombre')}</b> <span class="muted">${esc(c.rut)}</span>
          <div class="muted">${esc(c.documento)} · ${esc(c.origen)}${c.vendedor ? ' · ' + esc(c.vendedor) : ''}</div>
          <div>${c.numero ? `<span class="chip">N° ${esc(c.numero)}</span> ` : ''}${c.banco ? `<span class="chip">${esc(c.banco)}</span> ` : ''}${c.estado === 'COBRADO' ? `<span class="chip ok">Cobrado ${fcorta(c.fechaEstado)}</span>` : c.estado === 'PROTESTADO' ? `<span class="chip bad">Protestado</span>`
            : c.fechaCheque ? (c.aFecha ? `<span class="chip warn">A fecha: ${fcorta(c.fechaCheque)}${dias != null ? ' (en ' + dias + ' d)' : ''}</span>` : `<span class="chip ok">Al día · ${fcorta(c.fechaCheque)}</span>`) : '<span class="chip">Sin fecha de cheque</span>'}
            ${c.recibido ? `<span class="muted"> · recibido ${fcorta(c.recibido)}</span>` : ''}</div></span>
        <b>${clp(c.monto)}</b></div></label>`; }).join('') : '<div class="empty">Nada en esta lista.</div>';
    barra();
  };
  const barra = () => { const xs = todos.filter(c => sel.has(c.clave)); $('#chb').hidden = !xs.length; $('#chn').textContent = xs.length; $('#cht').textContent = clp(suma(xs));
    const cartera_ = fil === 'listos' || fil === 'fecha' || fil === 'todos'; $('#chc').hidden = !cartera_; $('#chp').hidden = !cartera_; $('#chfw').hidden = !cartera_; $('#chv').hidden = cartera_; };
  $('#chf').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; fil = b.dataset.f; sel.clear(); $$('#chf button').forEach(x => x.classList.toggle('on', x === b)); lista(); };
  $('#chq').oninput = e => { q = e.target.value; lista(); };
  $('#chl').onchange = e => { const k = e.target.dataset.k; if (k === undefined) return; e.target.checked ? sel.add(k) : sel.delete(k); barra(); };
  const marcar = async (estado, msg) => {
    const xs = [...sel]; if (!xs.length) return;
    if (estado === 'PROTESTADO' && !confirm('¿Marcar ' + xs.length + ' cheque(s) como protestado(s)?')) return;
    const bs = ['#chc', '#chp', '#chv'].map(x => $(x)); bs.forEach(b => b.disabled = true);
    try { await api('marcarCheque', S.sess.token, xs, estado, $('#chd').value || hoy, '');
      toast(msg); const ka = [S.sess.token]; await pedir('listarCheques', ka, claveApi('listarCheques', ka)); ir('cheques'); } finally { bs.forEach(b => b.disabled = false); }
  };
  $('#chc').onclick = () => marcar('COBRADO', 'Cheques marcados como cobrados');
  $('#chp').onclick = () => marcar('PROTESTADO', 'Marcados como protestados');
  $('#chv').onclick = () => marcar('CARTERA', 'Devueltos a la cartera');
  lista();
}

async function vSaldos(m) {
  const r = await api('getSaldosClientes', S.sess.token);
  const fc = iso => { const [a, mm, d] = String(iso).split('-'); return d + '-' + mm + '-' + a.slice(2); };
  const edad = d => d > 60 ? 'bad' : d > 30 ? 'warn' : 'ok';
  const vends = [...new Set(r.clientes.flatMap(c => c.vendedores))].sort();
  const conDeuda = r.clientes.filter(c => c.deuda > 0);
  render(m, `<h2>Saldos de clientes</h2>
    <p class="lead" style="margin:0 0 12px">Facturas a crédito (las de la lista de créditos y las nuevas) menos los pagos anotados en Cobranza. Todo se une por RUT y el nombre es el del DTE.</p>
    <div class="row" style="margin-bottom:10px;flex-wrap:wrap"><button class="btn cu sm" id="pl">Generar planilla por cobrar (crédito + cheques)</button>
      ${r.sinRut ? `<button class="btn ghost sm" id="sr">${r.sinRut} cliente${r.sinRut > 1 ? 's' : ''} sin RUT: completar</button>` : ''}<span class="grow"></span><span class="muted" id="plr"></span></div>
    ${tarjetaPolitica()}
    <div class="kpis"><div><span>Total adeudado</span><b>${clp(r.total)}</b></div>
      <div><span>Clientes con deuda</span><b>${conDeuda.length}</b></div>
      <div><span>Con facturas de más de 30 días</span><b>${conDeuda.filter(c => c.diasMax > 30).length}</b></div></div>
    <div class="row" style="margin:14px 0 10px;flex-wrap:wrap">
      <input class="in grow" id="bq" placeholder="Buscar cliente o RUT" style="min-width:200px">
      <select class="in" id="bv" style="width:auto"><option value="">Todos los vendedores</option>${vends.map(v => `<option>${esc(v)}</option>`).join('')}</select>
      <label class="muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="bp"> Ver también los al día</label></div>
    <div id="sl"></div>
    <p class="muted" style="margin-top:14px">Todo pago en Cobranza lleva el folio de la factura que paga: se descuenta de esa factura.</p>`);
  const abiertos = {};
  $('#pl').onclick = async () => { const b = $('#pl'); b.disabled = true; try { const p = await api('generarPlanillaPorCobrar', S.sess.token);
      $('#plr').innerHTML = `<a class="chip cu" href="${esc(p.url)}" target="_blank" rel="noopener">Abrir planilla · ${p.clientes} clientes · ${clp(p.total)}</a>`; window.open(p.url, '_blank'); } finally { b.disabled = false; } };
  if ($('#sr')) $('#sr').onclick = async () => { const x = await api('reintentarRut', S.sess.token); abrirSinRut(x.sinRutClientes); };
  const pintar = () => {
    const q = normTxt($('#bq').value), v = $('#bv').value, todos = $('#bp').checked;
    const lista = r.clientes.filter(c => (todos || c.deuda > 0) && (!v || c.vendedores.indexOf(v) >= 0) &&
      (!q || normTxt(c.cliente).indexOf(q) >= 0 || String(c.rut).replace(/\W/g, '').indexOf(q.replace(/\W/g, '')) >= 0));
    $('#sl').innerHTML = lista.length ? lista.map(c => `<div class="card sc" data-k="${esc(c.clave)}" style="margin-bottom:8px;cursor:pointer">
      <div class="row"><div class="grow"><b>${esc(c.cliente)}</b><div class="muted">${esc(c.rut || 'Sin RUT')}${c.condicion ? ' · ' + c.condicion + ' días' : ''} · ${esc(c.vendedores.join(', '))}</div></div>
        <div style="text-align:right"><b style="font-size:20px">${clp(c.deuda)}</b><div>${c.pendientes
          ? `<span class="chip ${edad(c.diasMax)}">${c.pendientes} pendiente${c.pendientes > 1 ? 's' : ''} · ${c.diasMax} días</span>` : '<span class="chip ok">Al día</span>'}</div></div></div>
      ${abiertos[c.clave] ? `<div style="margin-top:10px;border-top:1px solid var(--line-2);padding-top:8px">
        ${c.facturas.map(f => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line-2)">
          <div class="grow">${esc(f.tipo)} N° ${esc(f.folio)} ${f.cheque ? '<span class="chip warn">Cheque en cartera</span>' : ''}<span class="muted">· ${fc(f.fecha)} · ${esc(f.vendedorNombre)}</span>
            ${f.pagos.length ? `<div class="muted">Pagado: ${f.pagos.map(p => fc(p.fecha) + ' ' + clp(p.monto) + ' ' + esc(String(p.forma || '').toLowerCase())).join(' · ')}</div>` : ''}</div>
          <div style="text-align:right">${f.saldo > 0 ? `<b>${clp(f.saldo)}</b><div><span class="chip ${edad(f.dias)}">${f.dias} días</span></div>` : '<span class="chip ok">Pagada</span>'}
            <div class="muted">de ${clp(f.credito)}</div></div></div>`).join('')}
        ${c.abonos.length ? `<div class="alert" style="margin-top:8px">Abonos sin factura asociada: ${c.abonos.map(a => fc(a.fecha) + ' ' + clp(a.monto)).join(', ')}. Ya están descontados del total.</div>` : ''}
        ${c.ultimoPago ? `<div class="muted" style="margin-top:6px">Último pago: ${fc(c.ultimoPago)}</div>` : ''}</div>` : ''}
    </div>`).join('') : `<div class="empty">${r.clientes.length ? 'Ningún cliente coincide con el filtro.' : 'Todavía no hay facturas a crédito. Aparecerán cuando se marque CREDITO al detallar un folio.'}</div>`;
  };
  const normTxt = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  $('#bq').oninput = pintar; $('#bv').onchange = pintar; $('#bp').onchange = pintar;
  $('#sl').onclick = e => { const c = e.target.closest('.sc'); if (!c) return; abiertos[c.dataset.k] = !abiertos[c.dataset.k]; pintar(); };
  pintar();
}

/* ============ DETALLE E INSPECCIÓN POR VENDEDOR ============ */
const textoPago = p => p.forma === 'TRANSFERENCIA' || p.forma === 'DEP_EFECTIVO' ? 'Transf. ' + p.banco
  : p.forma === 'CHEQUE' ? 'Cheque' + (p.numero ? ' N° ' + p.numero : '') + (p.banco ? ' ' + (typeof nombreBanco === 'function' ? nombreBanco(p.banco) : p.banco) : '')
  : FL[p.forma] || p.forma;

/** Al tocar un vendedor en la Rendición: todo lo que detalló, ordenado como lo revisa la encargada. */
async function abrirVendedor(usuario) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet ancha" role="dialog" aria-modal="true" aria-label="Detalle del vendedor"><div class="grip"></div>
    <div class="body">${skeleton(3)}</div><div class="foot"><button class="btn ghost" id="cx">Cerrar</button></div></div>`;
  document.body.appendChild(ov);
  const cerrar = () => cerrarHoja(ov);
  $('#cx', ov).onclick = cerrar; ov.onclick = e => { if (e.target === ov) cerrar(); };
  let r;
  try { r = await api('getInspeccion', S.sess.token, S.fecha, usuario); } catch (e) { return cerrar(); }
  const v = r.vendedores[0];
  if (!v) { $('.body', ov).innerHTML = '<div class="empty">Sin movimientos este día.</div>'; return; }
  const t = v.totales, pend = v.folios.filter(f => f.estado !== 'DETALLADO');
  let filtro = pend.length ? 'pend' : 'todos';
  const sec = (titulo, n, total, filas) => n ? `<div class="dsec"><div class="dtit"><b>${titulo}</b><span>${n} · ${clp(total)}</span></div>${filas}</div>` : '';
  const conRut = x => esc(x.cliente) + (x.rut ? `<span class="rutl">RUT ${esc(x.rut)}</span>` : '');
  const fila = (a, b, monto) => `<div class="dfila"><span class="grow">${a}</span><span class="muted">${b || ''}</span><b>${clp(monto)}</b></div>`;
  const pintar = () => {
    const folios = v.folios.filter(f => filtro === 'todos' || (filtro === 'pend' ? f.estado !== 'DETALLADO' : f.estado === 'DETALLADO'))
      .sort((a, b) => (a.estado === 'DETALLADO') - (b.estado === 'DETALLADO') || String(a.folio).localeCompare(String(b.folio), 'es', { numeric: true }));
    $('.body', ov).innerHTML = `
      <div class="row" style="align-items:flex-start"><div class="grow"><div class="muted">${fechaLarga(r.fecha)}${v.terminal ? ' · ' + esc(v.terminal) : ''}</div>
        <div style="font-weight:700;font-size:21px">${esc(v.nombre)}</div></div>
        ${pend.length ? `<span class="chip cu">${pend.length} por detallar</span>` : '<span class="chip ok">Todo detallado</span>'}</div>
      <div class="dtop">
        <div class="dbox"><span>Efectivo a entregar</span><b>${clp(t.entregar)}</b>
          <small>Ventas ${clp(t.efVentas)} + cobranza ${clp(t.efCob)} − gastos ${clp(t.gastos)} − depositado ${clp(t.depositos)}</small></div>
        <div class="dres">
          ${fila('Venta (' + v.documentos + ' docs)', '', t.venta)}${t.credito ? fila('Crédito', v.creditos.length + ' docs', t.credito) : ''}
          ${v.cheques.length ? fila('Cheques', v.cheques.length, t.cheques) : ''}
          ${Object.keys(v.transf).filter(b => v.transf[b].length).map(b => fila('Transf. ' + b, v.transf[b].length, v.transf[b].reduce((a, x) => a + x.monto, 0))).join('')}
          ${t.descuentos ? fila('Descuentos', '', t.descuentos) : ''}</div></div>
      <div class="dsec"><div class="dtit"><b>Folios</b><span>${v.detallados} de ${v.documentos} detallados</span></div>
        <div class="seg" id="dfl" style="margin:2px 0 8px">${[['pend', 'Por detallar (' + pend.length + ')'], ['det', 'Detallados'], ['todos', 'Todos']].map(x =>
          `<button type="button" data-f="${x[0]}" class="${filtro === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
        ${folios.length ? folios.map(f => `<div class="dfolio ${f.estado === 'DETALLADO' ? '' : 'pend'}">
          <div class="row"><span class="grow"><b>${esc(f.cliente)}</b> <span class="muted">${esc(f.tipo)} ${esc(f.folio)}</span>${f.rut ? `<span class="rutl">RUT ${esc(f.rut)}</span>` : ''}</span><b>${clp(f.total)}</b></div>
          <div class="muted">${f.estado === 'DETALLADO' ? f.pagos.map(p => esc(textoPago(p)) + (f.pagos.length > 1 ? ' ' + clp(p.monto) : '')).join(' + ')
            + (f.descAprob ? ' · descuento ' + clp(f.descAprob) : '') + (f.detalladoPor ? ' · por ' + esc(f.detalladoPor.split(' ')[0]) : '')
            : f.descPend ? 'Descuento esperando autorización' : 'Por detallar'}</div></div>`).join('') : '<div class="muted" style="padding:6px 0">No hay folios en este filtro.</div>'}</div>
      ${v.kilos && v.kilos.detalle.length ? `<div class="dsec"><div class="dtit"><b>Diferencia de kilos</b><span>${v.kilos.diferencia > 0 ? '+' : ''}${kg(v.kilos.diferencia)} kg · ${v.kilos.diferenciaPesos > 0 ? 'a descontar ' : 'a favor '}${clp(Math.abs(v.kilos.diferenciaPesos))}</span></div>
        ${v.sinRetorno ? `<p class="muted" style="margin:6px 0">Falta registrar el retorno de ${v.sinRetorno} producto(s): la diferencia es provisoria.</p>` : ''}
        ${v.kilos.detalle.map(d => fila(esc(d.producto), `sale ${kg(d.salida)} − vuelve ${kg(d.retorno)} − factura ${kg(d.facturado)} = ${d.diferencia > 0 ? '+' : ''}${kg(d.diferencia)} kg × ${clp(d.precio)}`, d.monto)).join('')}</div>` : ''}
      ${Object.keys(v.transf).map(b => sec('Transferencias ' + b, v.transf[b].length, v.transf[b].reduce((a, x) => a + x.monto, 0),
        v.transf[b].map(x => fila(conRut(x), esc(x.origen), x.monto)).join(''))).join('')}
      ${sec('Cheques', v.cheques.length, t.cheques, v.cheques.map(x => fila(conRut(x), esc([x.numero ? 'N° ' + x.numero : '', nombreBanco(x.banco), x.momento +
        (x.fechaCheque ? ' ' + x.fechaCheque.split('-').reverse().join('-') : '')].filter(Boolean).join(' · ')), x.monto)).join(''))}
      ${sec('Cobranza', v.cobranza.length, v.cobranza.reduce((a, x) => a + x.monto, 0), v.cobranza.map(x => fila(conRut(x),
        esc((x.folio ? 'Folio ' + x.folio + ' · ' : '') + textoPago(x)), x.monto)).join(''))}
      ${sec('Gastos', v.gastos.length, t.gastos, v.gastos.map(x => fila(esc(x.concepto), esc(x.respaldo ? 'Boleta ' + x.respaldo : ''), x.monto)).join(''))}
      ${sec('Depósitos de efectivo', v.depositos.length, t.depositos, v.depositos.map(x => fila(esc(x.banco), esc(x.referencia ? 'Op. ' + x.referencia : ''), x.monto)).join(''))}`;
    $('#dfl', ov).onclick = e => { const b = e.target.closest('[data-f]'); if (b) { filtro = b.dataset.f; pintar(); } };
  };
  pintar();
  $('.foot', ov).innerHTML = `${pend.length ? '<button class="btn ghost" id="dDet">Detallar pendientes</button>' : ''}<span class="grow"></span>
    <button class="btn ghost" id="cx">Cerrar</button><button class="btn cu" id="dImp">Imprimir inspección</button>`;
  $('#cx', ov).onclick = cerrar;
  $('#dImp', ov).onclick = () => imprimirInspeccion(usuario);
  if ($('#dDet', ov)) $('#dDet', ov).onclick = () => { ov.remove(); S.vend = usuario; S.filtro = 'pend'; ir('folios'); };
}

/** Hoja de inspección para imprimir (o guardar como PDF): una por vendedor, con RESUMEN y DETALLE y un cuadrado para marcar en cada línea.
 *  El Total rendición (resumen, por forma de pago) y el Total detalle (por origen) dan siempre la misma cifra. */
async function imprimirInspeccion(usuario) {
  let r; try { r = await api('getInspeccion', S.sess.token, S.fecha, usuario); } catch (e) { return; }
  if (!r.vendedores.length) return toast('No hay vendedores con movimientos este día.', true);
  const fc = r.fecha.split('-').reverse().join('-');
  const sum = xs => xs.reduce((a, x) => a + x.monto, 0);
  const mm = n => (n < 0 ? '−' : '') + clp(Math.abs(n));
  const CK = '<td class="ck"><i></i></td>', SINCK = '<td class="ck"></td>';
  const fechaCorta = f => f ? f.split('-').reverse().join('-') : '';
  const tipoTd = x => x.tipo === 'COBRANZA' ? '<td class="tp"><b>COBRANZA</b></td>' : '<td class="tp g">Venta</td>';
  const refOrigen = o => String(o).replace(/^Cobranza folio /, 'Folio ');
  // fila de suma (resumen y líneas sueltas del detalle)
  const suma = (lab, nota, monto, check, cls) => `<tr class="${cls || ''}"><td>${lab}</td><td class="g nt">${nota || ''}</td><td class="m">${mm(monto)}</td>${check ? CK : SINCK}</tr>`;
  const bloque = (titulo, total, nota, filas, pie, cols, largo) => `<div class="blk${largo ? ' lg' : ''}"><div class="bt"><span><b>${titulo}</b>${nota ? ' <small>' + nota + '</small>' : ''}</span><b class="m">${clp(total)}</b><i></i></div>
    <table class="d"><colgroup>${cols}</colgroup>${filas}</table>${pie || ''}</div>`;
  // anchos de columna (la primera, el cliente, ocupa lo que sobra)
  const COLS_TR = '<col><col style="width:3.1cm"><col style="width:2.9cm"><col style="width:2.6cm"><col style="width:2.5cm"><col style="width:15pt">';
  const COLS_CH = '<col><col style="width:3.1cm"><col style="width:2.6cm"><col style="width:2.5cm"><col style="width:15pt">';
  const COLS_CB = '<col><col style="width:3.1cm"><col style="width:2.5cm"><col style="width:3.9cm"><col style="width:2.5cm"><col style="width:15pt">';
  const COLS_VT = '<col><col style="width:3.1cm"><col style="width:3cm"><col style="width:2.5cm"><col style="width:15pt">';
  const COLS_DP = '<col><col style="width:5.4cm"><col style="width:2.6cm"><col style="width:15pt">';

  const html = r.vendedores.map(v => {
    const t = v.totales;
    const bancos = Object.keys(v.transf);
    const tb = {}; bancos.forEach(b => tb[b] = sum(v.transf[b]));
    const transfTot = sum(bancos.map(b => ({ monto: tb[b] })));
    const efTotal = t.efVentas + t.efCob, aEntregar = efTotal - t.gastos - t.depositos;
    const subtotal = aEntregar + t.depositos + transfTot + t.cheques, total = subtotal + t.credito;
    const totalDetalle = t.efVentas + t.efCob - t.gastos + transfTot + t.cheques + t.credito;     // por origen: debe dar igual a `total`
    const cobEf = t.efCob, cobCh = sum(v.cobranza.filter(x => x.forma === 'CHEQUE'));
    const cobTr = sum(v.cobranza.filter(x => x.forma === 'TRANSFERENCIA' || x.forma === 'DEP_EFECTIVO'));

    const resumen = [
      suma('Efectivo total', `ventas ${clp(t.efVentas)} + cobranza ${clp(t.efCob)}`, efTotal, false),
      t.gastos ? suma('(−) Gastos', `${v.gastos.length} gasto${v.gastos.length === 1 ? '' : 's'} pagados con ese efectivo`, -t.gastos, false) : '',
      t.depositos ? suma('(−) Depositado', 'ya está en el banco', -t.depositos, false) : '',
      suma('Efectivo a entregar', '', aEntregar, true, 'sub'),
      t.depositos ? suma('Depósitos de efectivo', 'en el banco', t.depositos, true) : '',
      ...bancos.map(b => suma('Transferencias ' + b, '', tb[b], true)),
      suma('Cheques', '', t.cheques, true),
      suma('Subtotal', '', subtotal, false, 'sub'),
      suma('Crédito', v.creditos.length ? `${v.creditos.length} documento${v.creditos.length === 1 ? '' : 's'}` : '', t.credito, true),
      suma('Total rendición', '', total, false, 'tot')].join('');

    const transfHtml = bancos.map(b => {
      const xs = v.transf[b].slice().sort((p, q) => (p.tipo === 'COBRANZA') - (q.tipo === 'COBRANZA'));
      return xs.length ? bloque('Transferencias ' + b, tb[b], '', xs.map(x => `<tr><td>${esc(x.cliente)}</td><td class="g">${esc(x.rut)}</td><td class="g">${esc(refOrigen(x.origen))}</td>${tipoTd(x)}<td class="m">${clp(x.monto)}</td>${CK}</tr>`).join(''), '', COLS_TR) : '';
    }).join('');
    const chequesHtml = v.cheques.length ? bloque('Cheques', t.cheques, '', v.cheques.slice().sort((p, q) => (p.tipo === 'COBRANZA') - (q.tipo === 'COBRANZA')).map(x =>
      `<tr><td>${esc(x.cliente)}<small>${esc([refOrigen(x.origen), x.numero ? 'N° ' + x.numero : '', nombreBanco(x.banco), x.fechaCheque ? fechaCorta(x.fechaCheque) + ' (' + x.momento.toLowerCase() + ')' : ''].filter(Boolean).join(' · '))}</small></td><td class="g">${esc(x.rut)}</td>${tipoTd(x)}<td class="m">${clp(x.monto)}</td>${CK}</tr>`).join(''), '', COLS_CH) : '';
    const cobHtml = v.cobranza.length ? bloque('Cobranza', sum(v.cobranza), 'solo su efectivo suma al total', v.cobranza.map(x =>
      `<tr><td>${esc(x.cliente)}</td><td class="g">${esc(x.rut)}</td><td class="g">${x.folio ? 'Folio ' + esc(x.folio) : ''}</td><td class="fp ${x.forma === 'EFECTIVO' ? '' : 'g'}">${x.forma === 'EFECTIVO' ? '<b>Efectivo</b>' : esc(textoPago(x))}</td><td class="m">${clp(x.monto)}</td>${CK}</tr>`).join(''),
      `<div class="pie"><b>en efectivo ${clp(cobEf)}</b> · en transferencia ${clp(cobTr)} · en cheque ${clp(cobCh)}</div>`, COLS_CB) : '';
    const depHtml = v.depositos.length ? bloque('Depósitos de efectivo', t.depositos, 'ya están dentro del efectivo', v.depositos.map(x =>
      `<tr><td>${esc(x.banco)}</td><td class="g">${x.referencia ? 'Op. ' + esc(x.referencia) : ''}</td><td class="m">${clp(x.monto)}</td>${CK}</tr>`).join(''), '', COLS_DP) : '';

    // todas las ventas: lo pagado en efectivo (por folio) y lo vendido a crédito
    const efecFilas = [];
    v.folios.forEach(f => (f.pagos || []).forEach(p => { if (p.forma === 'EFECTIVO') efecFilas.push({ cliente: f.cliente, rut: f.rut, doc: f.tipo + ' ' + f.folio, monto: p.monto }); }));
    const filaVt = x => `<tr><td>${esc(x.cliente)}</td><td class="g">${esc(x.rut)}</td><td class="g">${esc(x.doc)}</td><td class="m">${clp(x.monto)}</td>${CK}</tr>`;
    const efecHtml = efecFilas.length ? bloque('Venta en efectivo', t.efVentas, `${efecFilas.length} documento${efecFilas.length === 1 ? '' : 's'}`, efecFilas.map(filaVt).join(''), '', COLS_VT, true)
      : `<table class="s">${suma('Venta en efectivo', '', t.efVentas, true)}</table>`;
    const credHtml = v.creditos.length ? bloque('Crédito', t.credito, `${v.creditos.length} documento${v.creditos.length === 1 ? '' : 's'}`, v.creditos.map(x => filaVt({ cliente: x.cliente, rut: x.rut, doc: refOrigen(x.origen), monto: x.monto })).join(''), '', COLS_VT, true) : '';

    const comp = [['Venta en efectivo', t.efVentas], ['+ Cobranza en efectivo', t.efCob]].concat(t.gastos ? [['− Gastos', -t.gastos]] : [],
      [['+ Transferencias', transfTot], ['+ Cheques', t.cheques], ['+ Crédito', t.credito]]);
    return `<section class="ins">
      <div class="hd"><div><b class="n">${esc(v.nombre)}</b><small>Inspección de rendición · Cecinas Naranjo</small></div>
        <div class="r"><b>${fc}</b><small>${v.terminal ? 'Terminal ' + esc(v.terminal) : ''}</small></div></div>
      <h3>RESUMEN</h3><table class="s">${resumen}</table>
      <h3>DETALLE</h3>
      ${efecHtml}${transfHtml}${chequesHtml}${cobHtml}${depHtml}
      <table class="s sp">${t.gastos ? suma('(−) Suma de gastos', `${v.gastos.length} gasto${v.gastos.length === 1 ? '' : 's'}`, -t.gastos, true) : ''}
        </table>
      ${v.kilos && v.kilos.detalle.length ? `<div class="blk"><div class="bt"><span><b>Diferencia de kilos</b> <small>${v.kilos.diferencia > 0 ? 'a descontar de su liquidación' : 'a favor del vendedor'} · no entra al total</small></span><b class="m">${mm(v.kilos.diferenciaPesos)}</b><i></i></div>
        <table class="d"><colgroup><col><col style="width:2cm"><col style="width:2cm"><col style="width:2cm"><col style="width:2.3cm"><col style="width:2.6cm"><col style="width:15pt"></colgroup>
        <tr><td class="g">Producto</td><td class="m g">Sale − vuelve</td><td class="m g">Factura</td><td class="m g">Dif. kg</td><td class="m g">Precio kg</td><td class="m g">Monto</td>${SINCK}</tr>
        ${v.kilos.detalle.map(d => `<tr><td>${esc(d.producto)}</td><td class="m g">${kg(d.salida - d.retorno)}</td><td class="m g">${kg(d.facturado)}</td><td class="m">${kg(d.diferencia)}</td><td class="m g">${clp(d.precio)}</td><td class="m">${mm(d.monto)}</td>${CK}</tr>`).join('')}</table></div>` : ''}
      ${credHtml || (t.credito ? `<table class="s">${suma('Crédito', '', t.credito, true)}</table>` : '')}
      <table class="fin"><tr><td class="fl"><div class="firmas"><div>Firma vendedor</div><div>Firma encargada</div></div></td><td class="fr">
        <table class="comp">${comp.map(c => `<tr><td>${c[0]}</td><td class="m">${mm(c[1])}</td></tr>`).join('')}<tr class="tot"><td>Total detalle</td><td class="m">${clp(totalDetalle)}</td></tr></table></td></tr></table>
      <div class="ft">${esc(v.nombre)} · ${fc} · generado ${esc(r.generado)}</div></section>`;
  }).join('');
  let box = $('#imprimir');
  if (!box) { box = document.createElement('div'); box.id = 'imprimir'; document.body.appendChild(box); }
  box.innerHTML = html;
  const titulo = document.title;
  document.title = 'Inspección ' + (usuario ? r.vendedores[0].nombre : 'vendedores') + ' ' + fc;
  setTimeout(() => { window.print(); setTimeout(() => { document.title = titulo; }, 500); }, 60);
}

/* ============ IMPORTAR MI DTE ============ */
/** El lector de Excel se baja solo cuando se necesita (pesa ~900 KB). */
let _xlsx = null;
function cargarXLSX() {
  if (window.XLSX) return Promise.resolve();
  if (_xlsx) return _xlsx;
  _xlsx = new Promise((res, rej) => {
    const fin = trabajando('xlsx'), sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    sc.onload = () => { fin(); res(); };
    sc.onerror = () => { fin(); _xlsx = null; sc.remove(); rej(new Error('No se pudo cargar el lector de Excel. Revisa tu internet e intenta de nuevo.')); };
    document.head.appendChild(sc);
  });
  return _xlsx;
}
const isoFecha = v => { const t = String(v == null ? '' : v).trim(); let m = t.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : (t.match(/^\d{4}-\d{2}-\d{2}/) || [t])[0]; };
/** Parte las filas en tandas para que cada llamada al servidor sea corta. `clave` mantiene juntas las filas de un mismo documento. */
function tandas(filas, max, clave) {
  const out = []; let cur = [], ult = null;
  filas.forEach(f => { const k = clave ? clave(f) : null;
    if (cur.length >= max && (!clave || k !== ult)) { out.push(cur); cur = []; }
    cur.push(f); ult = k; });
  if (cur.length) out.push(cur);
  return out;
}

const serialAFecha = v => { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); };
const CANON = { 'rut': 'RUT', 'datos rut': 'RUT', 'documento': 'Documento', 'folio': 'Folio', 'fecha': 'Fecha', 'condicion': 'Condicion',
  'nombre cliente': 'Nombre Cliente', 'emitido en': 'Emitido en', 'codigo': 'Codigo', 'descripcion': 'Descripcion', 'cantidad': 'Cantidad',
  'precio': 'Precio', 'nombre': 'Nombre', 'razon social': 'Razon social', 'pago': 'Pago', 'equipo': 'Equipo', 'neto': 'NETO', 'productos': 'PRODUCTOS' };

/** Planilla "Control de crédito": se quedan solo los documentos que siguen abiertos (¿Pagó? distinto de SI). */
function leerCreditos(rows, hi, head) {
  const ix = f => head.findIndex(h => f.test(h));
  const c = { tipo: ix(/^documento$/), cliente: ix(/^cliente$/), cond: ix(/^condicion/), folio: ix(/^folio$/), fecha: ix(/^fecha$/), monto: ix(/^monto$/),
    recep: ix(/^recepcion/), pago: ix(/^¿?pag[oó]\??$/), vend: ix(/^vendedor$/), metodo: ix(/^metodo/) };
  const fecha = v => typeof v === 'number' ? serialAFecha(v) : (m => m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : String(v || ''))(String(v || '').match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/));
  const out = [];
  rows.slice(hi + 1).forEach(r => {
    const pago = String(r[c.pago] || '').trim().toUpperCase(), monto = Number(r[c.monto]);
    if (pago === 'SI' || !r[c.cliente] || !(monto > 0)) return;
    const recep = r[c.recep], esPrestamo = typeof recep === 'string' && /prestamo/i.test(recep);
    out.push({ tipo: String(r[c.tipo] || '').trim() || 'Factura Electrónica', cliente: String(r[c.cliente]).replace(/\s+/g, ' ').trim(), condicion: Number(r[c.cond]) || '',
      folio: String(r[c.folio] || '').trim(), fecha: fecha(r[c.fecha]), monto: Math.round(monto), estado: /cheque/i.test(pago) ? 'CHEQUE' : 'CREDITO',
      vendedor: String(r[c.vend] || '').trim(), recepcion: typeof recep === 'number' ? serialAFecha(recep) : '', metodo: String(r[c.metodo] || '').slice(0, 60),
      obs: [esPrestamo ? 'PRÉSTAMO' : '', pago === 'PENDIENTE' ? 'PENDIENTE' : ''].filter(Boolean).join(' · ') });
  });
  return out;
}

/** Busca en todas las hojas del Excel la tabla con encabezado "Folio" y reconoce si es Ventas Diarias o Informe de ventas. */
/* ===== ORDENAR LOS INFORMES DE MI DTE (lo que antes se hacía a mano) ===== */
const sinTilde = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
// Mi DTE entrega las ventas del mostrador con el nombre del computador de oficina. Se separan según el cliente.
const EQUIPO_OFICINA = /^(DESKTOP|PC-|OFICINA)/;
const SUPERMERCADOS = [/AMAR HERMANOS/, /KUNCAR/, /\bUNICO\b/, /SUPER ?OFERTA/, /OPERADORA DE COMERCIO/, /DISTRIBUIDORA.*MORENO/];
const DISTRIBUIDORES = [/PATRICIO MONTES/, /JUAN CARLOS SILVA/, /OSCAR LAGOS/, /CESAR (RICARDO )?CAMPOS/, /\bANBA\b/, /\bAAMF\b/, /PICHIHUILLINCO/, /\bAMIR\b/];
/** Devuelve null si el documento sale con su propio equipo. equipo = lo que se importa; grupo = como lo rotula la planilla de Ventas Diarias. */
function clasificarVenta(tipo, cliente, equipo) {
  const eq = String(equipo || '').trim().toUpperCase(), t = String(tipo || '');
  if (eq === 'DISTRIBUIDORA') return { equipo: 'BODEGA', grupo: 'DISTRIBUIDORA' };    // archivo ya ordenado a mano
  if (!EQUIPO_OFICINA.test(eq) || /gu[ií]a|nota de cr/i.test(t)) return null;
  const n = sinTilde(cliente);
  if (SUPERMERCADOS.some(r => r.test(n))) return { equipo: 'SUPERMERCADO', grupo: 'SUPERMERCADO' };
  if (DISTRIBUIDORES.some(r => r.test(n))) return { equipo: 'BODEGA', grupo: 'DISTRIBUIDORA' };
  if (/boleta/i.test(t)) return { equipo: 'BODEGA', grupo: 'DISTRIBUIDORA', supuesto: true };   // el único distribuidor que pide boleta
  return { equipo: 'BODEGA', grupo: 'BODEGA' };
}
const CAT_ALIAS = { PROPIOS: 'PROPIOS', CARNICOS: 'CARNICOS', CONGELADOS: 'CONGELADO', CONGELADO: 'CONGELADO', LACTEOS: 'LACTEO', LACTEO: 'LACTEO' };
function categoriaProducto(codigo, desc) {
  const cod = String(codigo == null ? '' : codigo).trim(), n = sinTilde(desc), lista = (S.cat && S.cat.productos) || [];
  const p = lista.find(x => String(x.codigo) === cod && cod.charAt(0) !== '?') || lista.find(x => sinTilde(x.nombre) === n);
  const c = p && CAT_ALIAS[sinTilde(p.categoria)]; if (c) return c;
  if (/^(MV|PC|SC)\d/i.test(cod) || /M\. VERDE|EMP |PAPAS PRE|SOPAIPILLA|PASTA CHOCLO/.test(n)) return 'CONGELADO';
  if (/^H\d/i.test(cod) || /^Q\. |MANTEQUILLA|YOGUR|LECHE|CREMA/.test(n)) return 'LACTEO';
  if (/TRUTRO|CHULETA|CARNE|COSTILLAR|POLLO|CERDO BBQ/.test(n)) return 'CARNICOS';
  return 'OTROS';
}
/** Ordena en el lugar los informes leídos: reclasifica equipos y completa TOTAL, NETO y PRODUCTOS. Idempotente: un archivo ya ordenado queda igual. */
function ordenarInformes(leidos) {
  for (const l of leidos) {
    if (l.error || (l.tipo !== 'dte' && l.tipo !== 'detalle')) continue;
    const dte = l.tipo === 'dte', campo = dte ? 'Emitido en' : 'Equipo', vistos = new Set();
    l.orden = { SUPERMERCADO: 0, DISTRIBUIDORA: 0, BODEGA: 0, supuestos: 0, completadas: 0 };
    for (const f of l.filas) {
      const tipo = dte ? f.Documento : f.Nombre, cli = dte ? f['Nombre Cliente'] : f['Razon social'];
      const c = clasificarVenta(tipo, cli, f[campo]);
      if (c) {
        f._equipoOrig = f[campo]; f[campo] = c.equipo; f._grupo = c.grupo;
        const k = tipo + '|' + f.Folio;
        if (!vistos.has(k)) { vistos.add(k); l.orden[c.grupo]++; if (c.supuesto) l.orden.supuestos++; }
      }
      if (!dte) {
        const vacio = v => v === '' || v == null, num = v => Number(String(v).replace(',', '.')) || 0;
        let hecho = false;
        if (vacio(f.TOTAL)) { f.TOTAL = Math.round(num(f.Cantidad) * num(f.Precio) * 100) / 100; hecho = true; }
        if (vacio(f.NETO)) { f.NETO = Math.round(num(f.TOTAL) / 1.19 * 100) / 100; hecho = true; }
        if (vacio(f.PRODUCTOS)) { f.PRODUCTOS = /gu[ií]a|nota de cr/i.test(f.Nombre) ? 'GUIA' : categoriaProducto(f.Codigo, f.Descripcion); hecho = true; }
        if (hecho) l.orden.completadas++;
      }
    }
  }
}
const f2 = n => ('0' + n).slice(-2);
/** Nombre con que se guardan hoy en el Drive: Ventas Diarias con día y mes sin ceros; Informe de ventas con ceros. */
function nombreInforme(tipo, iso) { const [a, m, d] = iso.split('-'); return tipo === 'dte' ? `Ventas Diarias ${+d}-${+m}-${a}.xlsx` : `Informe de ventas ${d}-${m}-${a}.xlsx`; }
/** Un archivo ordenado por cada fecha que traiga el informe. Devuelve [{nombre, tipo, iso, libro}] */
function libroOrdenado(l) {
  const porFecha = {}; l.filas.forEach(f => { (porFecha[isoFecha(f.Fecha)] = porFecha[isoFecha(f.Fecha)] || []).push(f); });
  // Un día que solo trae notas de crédito movidas no genera archivo: reemplazaría el informe completo de ese día en el Drive.
  const solo = f => f._ncMovida;
  return Object.keys(porFecha).sort().filter(iso => !porFecha[iso].every(solo)).map(iso => {
    const filas = porFecha[iso], wb = XLSX.utils.book_new();
    if (l.tipo === 'dte') {
      const ws = XLSX.utils.aoa_to_sheet([['RUT', 'Documento', 'Folio', 'Fecha', 'Total', 'Condicion', 'Nombre Cliente', 'Caja', 'Emitido en']]
        .concat(filas.map(f => [f.RUT, f.Documento, f.Folio, f.Fecha, f.Total, f.Condicion, f['Nombre Cliente'], f.caja === undefined ? 0 : f.caja, f._grupo || f['Emitido en']])));
      ws['!cols'] = [10, 26, 8, 12, 11, 10, 46, 6, 18].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    } else {
      const guia = f => /gu[ií]a|nota de cr/i.test(f.Nombre), res = {};
      filas.filter(f => !guia(f)).forEach(f => { const r = res[f.Descripcion] = res[f.Descripcion] || [0, 0]; r[0] += Number(f.Cantidad) || 0; r[1] += Number(f.NETO) || 0; });
      const nombres = Object.keys(res).sort(), tk = nombres.reduce((a, k) => a + res[k][0], 0), tn = nombres.reduce((a, k) => a + res[k][1], 0);
      const h1 = XLSX.utils.aoa_to_sheet([['Nombre', '(Varios elementos)'], ['Equipo', '(Todas)'], ['PRODUCTOS', '(Todas)'], [], ['Etiquetas de fila', 'Suma de Cantidad', 'Suma de NETO']]
        .concat(nombres.map(k => [k, Math.round(res[k][0] * 1000) / 1000, Math.round(res[k][1] * 100) / 100]), [['Total general', Math.round(tk * 1000) / 1000, Math.round(tn * 100) / 100]]));
      h1['!cols'] = [{ wch: 42 }, { wch: 18 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, h1, 'Hoja1');
      const rows = filas.map(f => [f.Codigo, f.Descripcion, f.Cantidad, f.Precio, f.Nombre, f.Folio, f['Razon social'], f.Pago, f.Equipo, f._fo !== undefined ? f._fo : f.Fecha, f.TOTAL, f.NETO, f.PRODUCTOS]);
      const ws = XLSX.utils.aoa_to_sheet([['Codigo', 'Descripcion', 'Cantidad', 'Precio', 'Nombre', 'Folio', 'Razon social', 'Pago', 'Equipo', 'Fecha', 'TOTAL', 'NETO', 'PRODUCTOS']].concat(rows));
      rows.forEach((r, i) => {
        const n = i + 2;
        ws['K' + n] = { t: 'n', v: Number(r[10]) || 0, f: `C${n}*D${n}` };
        ws['L' + n] = { t: 'n', v: Number(r[11]) || 0, f: `K${n}/1.19` };
        if (typeof r[9] === 'number') ws['J' + n].z = 'dd-mm-yyyy hh:mm:ss';
      });
      ws['!cols'] = [8, 40, 10, 9, 26, 8, 44, 10, 16, 20, 11, 11, 12].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, 'Informe');
    }
    return { nombre: nombreInforme(l.tipo, iso), tipo: l.tipo, iso, libro: wb };
  });
}
/* ===== FIN ORDENAR ===== */

function leerLibro(buf) {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  for (const nombre of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: true, defval: '' });
    const hi = rows.findIndex(r => r.some(c => norm(c) === 'folio'));
    if (hi < 0) continue;
    const head = rows[hi].map(h => norm(h));
    if (head.includes('cliente') && head.includes('monto') && head.some(h => /^¿?pag[oó]\??$/.test(h)))
      return { tipo: 'creditos', filas: leerCreditos(rows, hi, head) };
    const tipo = head.includes('descripcion') && head.includes('cantidad') ? 'detalle' : head.includes('documento') && head.includes('total') ? 'dte' : null;
    if (!tipo) continue;
    const keys = head.map(h => h === 'total' ? (tipo === 'dte' ? 'Total' : 'TOTAL') : CANON[h] || h);
    const filas = rows.slice(hi + 1).map(r => { const o = {}; keys.forEach((k, j) => { let v = r[j]; if (k === 'Fecha' && typeof v === 'number') { o._fo = v; v = serialAFecha(v); } o[k] = v; }); return o; })
      .filter(o => o.Folio !== '' && (tipo === 'dte' ? o.Documento : o.Descripcion));
    return { tipo, filas };
  }
  throw new Error('No reconozco este archivo. Debe ser "Ventas Diarias" o "Informe de ventas" de Mi DTE.');
}

async function vImportar(m) {
  cargarXLSX().catch(() => {});                 // se empieza a descargar mientras la encargada elige los archivos
  render(m, `<h2>Importar desde Mi DTE</h2>
    <p class="lead">Sube <b>Ventas Diarias</b> e <b>Informe de ventas</b> del mismo día. Los ordeno yo.</p>
    <details class="mas" style="margin:-6px 0 12px"><summary>Más información</summary><ul class="info">
      <li>Los dos informes son obligatorios y deben ser de las mismas fechas.</li>
      <li>Puedes subirlos varias veces en el día: solo se agregan los folios nuevos, lo ya importado o detallado no se toca.</li>
      <li>La planilla <b>Control de crédito</b> también se sube aquí. Conviene importar antes las Ventas Diarias de esas fechas: de ahí salen los RUT.</li></ul></details>
    <label class="drop" id="drop"><input type="file" id="fi" accept=".xlsx,.xls,.csv" multiple class="sr">
      <b>Elegir archivos de Excel</b><span class="muted">o arrástralos aquí</span></label>
    <div id="pv" class="stack" style="margin-top:14px"></div>
    <h3>Terminales de Mi DTE</h3><p class="muted" style="margin-top:-4px">Cada vendedor factura desde un terminal. Así se sabe de quién es cada folio.</p>
    <div id="term">${skeleton(2)}</div>`);
  const drop = $('#drop');
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => procesar([...e.dataTransfer.files]));
  $('#fi').onchange = e => procesar([...e.target.files]);
  cargarTerminales();

  /** Mi DTE entrega dos informes que van juntos: sin los dos no se importa (los kilos y las ventas deben cruzarse). */
  function requisitos(leidos) {
    const ok = leidos.filter(l => !l.error), dte = ok.filter(l => l.tipo === 'dte'), det = ok.filter(l => l.tipo === 'detalle');
    if (!dte.length && !det.length) return '';
    if (!dte.length) return 'Falta el informe <b>Ventas Diarias</b> (los folios y sus totales).';
    if (!det.length) return 'Falta el <b>Informe de ventas</b> (los kilos por producto).';
    const f = ls => [...new Set(ls.flatMap(l => l.filas.map(x => isoFecha(x.Fecha))))].sort();
    const a = f(dte), b = f(det);
    if (a.join() !== b.join()) return `Los dos informes deben ser de las mismas fechas. Ventas Diarias trae ${a.map(fcorta).join(', ')} y el Informe de ventas trae ${b.map(fcorta).join(', ')}.`;
    return '';
  }
  const avisoRequisitos = leidos => { const r = requisitos(leidos); return r ? `<div class="alert" style="margin-top:12px"><b>No se puede importar todavía.</b> ${r} Súbelos juntos para continuar.</div>` : ''; };

  const pausa = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));       // deja pintar el aviso antes de un trabajo pesado
  async function procesar(files) {
    if (!files.length) return;
    $('#pv').innerHTML = `<div class="card impl"><span class="spin"></span><div class="grow"><b>Leyendo ${files.length > 1 ? files.length + ' archivos' : 'el archivo'}…</b>
      <div class="muted" id="leyn">Preparando el lector de Excel</div></div></div>`;
    try { await cargarXLSX(); } catch (e) { $('#pv').innerHTML = `<div class="alert">${esc(e.message)}</div>`; return; }
    const leidos = [];
    for (const [k, f] of files.entries()) {
      $('#leyn').textContent = `${f.name} (${k + 1} de ${files.length})`; await pausa();
      try { leidos.push(Object.assign({ nombre: f.name }, leerLibro(await f.arrayBuffer()))); }
      catch (e) { leidos.push({ nombre: f.name, error: e.message }); }
    }
    leidos.sort((a, b) => (a.tipo === 'dte' ? 0 : 1) - (b.tipo === 'dte' ? 0 : 1)); // primero los folios
    try { ordenarInformes(leidos); } catch (e) { console.error(e); }
    const pintar = () => {
    /** Las notas de crédito suelen emitirse otro día; la encargada les pone la fecha de la factura que corrigen para que queden en ese día. */
    const ncs = () => (leidos.find(l => !l.error && l.tipo === 'dte') || { filas: [] }).filas.filter(f => /nota de cr/i.test(f.Documento));
    const tarjetaNC = () => { const n = ncs(); if (!n.length) return '';
      return `<div class="card ordc"><b>Notas de crédito (${n.length})</b>
        <p class="muted" style="margin:4px 0 8px">Si una nota corrige una factura de otro día, pon la fecha de esa factura: la nota queda en ese día, con su detalle.</p>
        <ul class="ordl">${n.map(f => `<li><span class="grow">NC ${esc(f.Folio)} · ${esc(f['Nombre Cliente'])} · <b>${clp(f.Total)}</b></span>
          <input type="date" class="in" style="min-height:36px;width:auto" data-nc="${esc(f.Folio)}" value="${isoFecha(f.Fecha)}" aria-label="Fecha de la factura que corrige la NC ${esc(f.Folio)}"></li>`).join('')}</ul></div>`; };
    const moverNC = (folio, iso) => {
      const [a, m, d] = iso.split('-');
      for (const l of leidos) { if (l.error) continue;
        for (const f of l.filas) {
          if (String(f.Folio) !== String(folio) || !/nota de cr/i.test(l.tipo === 'dte' ? f.Documento : f.Nombre)) continue;
          if (isoFecha(f.Fecha) !== iso) f._ncMovida = true;
          if (l.tipo === 'dte') { f.Fecha = d + '-' + m + '-' + a; delete f._fo; }
          else { const ant = typeof f._fo === 'number' ? f._fo % 1 : 0; f.Fecha = iso; if (typeof f._fo === 'number') f._fo = Math.floor(Date.UTC(+a, m - 1, +d) / 864e5 + 25569) + ant; }
        } }
    };
    const resumenOrden = () => {
      const d = leidos.find(l => l.orden && l.tipo === 'dte'), k = leidos.find(l => l.orden && l.tipo === 'detalle'), o = d && d.orden, tot = o ? o.SUPERMERCADO + o.DISTRIBUIDORA + o.BODEGA : 0;
      const calc = k ? k.orden.completadas : 0;
      if (!tot && !calc) return '';
      return `<div class="card ordc"><b>Orden automático</b><ul class="ordl">` +
        (tot ? `<li><span>Ventas de oficina separadas por cliente: <b>${o.SUPERMERCADO}</b> a Supermercado, <b>${o.DISTRIBUIDORA}</b> a Distribuidores, <b>${o.BODEGA}</b> a Bodega.</span></li>` : '') +
        (calc ? `<li><span>Agregué <b>TOTAL</b>, <b>NETO</b> y <b>PRODUCTOS</b> en ${calc} líneas del informe de kilos.</span></li>` : '') +
        (o && o.supuestos ? `<li class="warn"><span>${o.supuestos} boleta${o.supuestos > 1 ? 's' : ''} de oficina sin nombre de cliente: la${o.supuestos > 1 ? 's' : ''} dejé como distribuidor.</li>` : '') +
        `</ul><p class="muted" style="margin:0">Al importar, los archivos ordenados se guardan solos en el Drive.</p></div>`;
    };
    $('#pv').innerHTML = leidos.map((l, i) => {
      if (l.error) return `<div class="card fcard"><b>${esc(l.nombre)}</b><div class="alert" style="margin-bottom:0">${esc(l.error)}</div></div>`;
      if (l.tipo === 'creditos') { const ch = l.filas.filter(x => x.estado === 'CHEQUE'), tot = l.filas.reduce((a, x) => a + x.monto, 0);
        return `<div class="card fcard"><div class="row"><div class="grow"><b>Control de crédito</b><div class="muted">${esc(l.nombre)} · solo los documentos que siguen abiertos</div></div>
          <span class="chip warn">${l.filas.length - ch.length} por cobrar</span><span class="chip cu">${ch.length} en cheque</span><span class="chip">${clp(tot)}</span></div><div id="res${i}"></div></div>`; }
      const esG = x => /gu[ií]a/i.test(l.tipo === 'dte' ? x.Documento : x.Nombre);
      const g = l.filas.filter(esG).length, v = l.filas.length - g;
      const fechas = [...new Set(l.filas.map(x => String(x.Fecha)))].join(', ');
      return `<div class="card fcard"><div class="row"><div class="grow"><b>${l.tipo === 'dte' ? 'Ventas Diarias' : 'Informe de ventas (kilos)'}</b>
        <div class="muted">${esc(l.nombre)} · ${esc(fechas)}</div></div>
        <span class="chip">${l.tipo === 'dte' ? v + ' documentos' : v + ' líneas de producto'}</span>${g ? `<span class="chip">${g} ${l.tipo === 'dte' ? 'guías (se omiten)' : 'líneas de guía'}</span>` : ''}</div>
        <div id="res${i}"></div></div>`;
    }).join('') + resumenOrden() + tarjetaNC() + avisoRequisitos(leidos) + (leidos.some(l => !l.error) && !requisitos(leidos) ? '<button class="btn cu block" id="imp">Importar</button>' : '');
    $$('[data-nc]').forEach(inp => inp.onchange = () => { if (!inp.value) return; moverNC(inp.dataset.nc, inp.value); pintar(); });
    const b = $('#imp'); if (!b) return;
    const lotesDe = l => l.tipo === 'creditos' ? [l.filas] : l.tipo === 'dte' ? tandas(l.filas, 1200) : tandas(l.filas, 2000, x => String(x.Nombre) + '|' + String(x.Folio));
    b.onclick = async () => {
      b.hidden = true; const sinT = new Set(); let fechas = [];
      // panel de avance: se ve qué archivo se está guardando y cuánto falta
      const items = leidos.map((l, i) => [l, i]).filter(([l]) => !l.error), NOM = { dte: 'Ventas Diarias', detalle: 'Informe de ventas (kilos)', creditos: 'Control de crédito' };
      let T = 0, D = 0; items.forEach(([l]) => T += lotesDe(l).length);
      const pp = document.createElement('div'); pp.className = 'card impp run';
      pp.innerHTML = `<div class="row"><span class="spin" id="impsp"></span><b class="grow" id="impt">Guardando en la base de datos…</b><span class="muted" id="impn">0%</span></div>
        <div class="pbar"><i id="impb"></i></div>
        <ul class="imps">${items.map(([l, i]) => `<li data-i="${i}" class="wait"><span class="pt"></span><span class="grow">${NOM[l.tipo]} <span class="muted">· ${l.filas.length} ${l.tipo === 'dte' ? 'documentos' : l.tipo === 'detalle' ? 'líneas' : 'créditos'}</span></span><small>En espera</small></li>`).join('')}</ul>
        <p class="muted" style="margin:10px 0 0">No cierres ni cambies de pantalla hasta que termine.</p>`;
      b.parentNode.insertBefore(pp, b);
      const barra = (extra) => { const p = Math.round(D / T * 100); $('#impn', pp).textContent = p + '%'; $('#impb', pp).style.width = Math.max(extra ? 7 : 0, Math.min(100, (D + (extra || 0)) / T * 100)) + '%'; };
      const paso = (i, est, txt) => { const li = $('[data-i="' + i + '"]', pp); li.className = est; $('small', li).textContent = txt; };
      barra(0.35);
      for (const [i, l] of leidos.entries()) {
        if (l.error) continue;
        paso(i, 'run', 'Guardando…'); barra(0.35);
        try {
          if (l.tipo === 'creditos') {
            const r = await api('cargarCreditos', S.sess.token, l.filas);
            $('#res' + i).innerHTML = `<div class="alert ok" style="margin-bottom:0">Cargados <b>${r.nuevos}</b> documentos nuevos${r.actualizados ? ` y actualizados ${r.actualizados}` : ''}${r.saltados || r.duplicados ? ` (${[r.saltados ? r.saltados + ' sin folio o monto' : '', r.duplicados ? r.duplicados + ' repetidos en el archivo' : ''].filter(Boolean).join(', ')}: omitidos)` : ''}.
              <b>${r.conRut}</b> ya tienen RUT${r.sinRut ? `, <b>${r.sinRut}</b> no` : ''}.</div>${r.sinRut ? `<button class="btn ghost sm" style="margin-top:8px" data-sinrut>Completar RUT de ${r.sinRutClientes.length} cliente${r.sinRutClientes.length > 1 ? 's' : ''}</button>` : ''}`;
            const bb = $('[data-sinrut]', $('#res' + i)); if (bb) bb.onclick = () => abrirSinRut(r.sinRutClientes);
            continue;
          }
          const lotes = lotesDe(l);
          const r = { importados: 0, repetidos: 0, sinVendedor: 0, guias: 0, lineas: 0, omitidas: 0, terminalesSinAsignar: [], fechas: [], productosNuevos: [], porVendedor: {} };
          for (const [k, lote] of lotes.entries()) {
            if (lotes.length > 1) paso(i, 'run', `Parte ${k + 1} de ${lotes.length}`);
            barra(0.35);
            const x = await api(l.tipo === 'dte' ? 'importarDTE' : 'importarDetalle', S.sess.token, lote);
            D++; barra(0);
            ['importados', 'repetidos', 'sinVendedor', 'guias', 'lineas', 'omitidas'].forEach(c => r[c] += x[c] || 0);
            r.terminalesSinAsignar = r.terminalesSinAsignar.concat(x.terminalesSinAsignar || []); r.fechas = r.fechas.concat(x.fechas || []);
            r.productosNuevos = r.productosNuevos.concat(x.productosNuevos || []);
            Object.keys(x.porVendedor || {}).forEach(v => r.porVendedor[v] = (r.porVendedor[v] || 0) + x.porVendedor[v]);
          }
          (r.terminalesSinAsignar || []).forEach(t => sinT.add(t)); fechas = fechas.concat(r.fechas);
          const nomV = u => ((S.cat.vendedores || []).find(v => v.usuario === u) || {}).nombre || u || 'Sin vendedor';
          const porV = Object.keys(r.porVendedor).map(u => nomV(u).split(' ')[0] + ' ' + r.porVendedor[u]).join(', ');
          $('#res' + i).innerHTML = `<div class="alert ok" style="margin-bottom:0">` + (l.tipo === 'dte'
            ? `Documentos nuevos: <b>${r.importados}</b>${porV ? ' (' + esc(porV) + ')' : ''}. ${r.repetidos ? r.repetidos + ' ya estaban: no se tocaron, ni lo que ya detallaron los vendedores. ' : ''}${r.sinVendedor ? `<b>${r.sinVendedor}</b> sin vendedor.` : ''}`
            : `Líneas nuevas: <b>${r.lineas}</b> de venta y ${r.guias} de guías. ${r.omitidas ? r.omitidas + ' líneas de documentos que ya estaban se dejaron como estaban. ' : ''}` +
              (r.productosNuevos.length ? `<br>Productos nuevos agregados como inactivos (revísalos en la hoja PRODUCTOS): ${esc(r.productosNuevos.join(', '))}.` : '')) + '</div>';
          paso(i, 'ok', 'Listo');
        } catch (e) { $('#res' + i).innerHTML = `<div class="alert" style="margin-bottom:0">${esc(e.message)}</div>`; paso(i, 'err', 'Con error'); }
      }
      b.remove();
      guardarOrdenados(leidos, pp);
      D = T; barra(0); pp.classList.remove('run'); pp.classList.add('fin'); $('#impsp', pp).outerHTML = '<span class="okdot">✓</span>';
      $('#impt', pp).textContent = pp.querySelector('li.err') ? 'Terminó con errores' : 'Importación terminada';
      const f = [...new Set(fechas)];
      if (f.length === 1 && f[0] !== S.fecha) { S.fecha = f[0]; $('#fecha').value = S.fecha; toast('Mostrando el ' + fechaLarga(S.fecha)); }
      if (sinT.size) toast('Hay terminales sin vendedor: ' + [...sinT].join(', ') + '. Asígnalos abajo.', true);
      cargarTerminales([...sinT]);
    };
    };
    pintar();
  }
  /** Genera los Excel ordenados y los sube al Drive; si no se puede, quedan para descargar. */
  async function guardarOrdenados(leidos, pp) {
    const box = document.createElement('div'); box.className = 'card ordc'; pp.insertAdjacentElement('afterend', box);
    let libros = [];
    try { await cargarXLSX(); leidos.filter(l => !l.error && (l.tipo === 'dte' || l.tipo === 'detalle')).forEach(l => libros = libros.concat(libroOrdenado(l))); }
    catch (e) { box.innerHTML = `<div class="alert" style="margin:0">No pude armar los archivos ordenados: ${esc(e.message)}</div>`; return; }
    if (!libros.length) { box.remove(); return; }
    libros.forEach(x => x.b64 = XLSX.write(x.libro, { bookType: 'xlsx', type: 'base64' }));
    const bajar = x => { const bin = atob(x.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = x.nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    const pinta = () => { box.innerHTML = `<b>Archivos ordenados</b><ul class="ordl">${libros.map((x, i) => `<li><span class="grow">${esc(x.nombre)}</span>
      ${x.url ? `<a class="chip ok" href="${esc(x.url)}" target="_blank" rel="noopener">Guardado en Drive${x.reemplazado ? ' (reemplazó el anterior)' : ''}</a>` : x.error ? `<span class="chip bad">No se guardó</span>` : '<span class="spin"></span>'}
      <button class="btn ghost sm" data-b="${i}">Descargar</button></li>${x.error ? `<li class="warn">${esc(x.error)}</li>` : ''}`).join('')}</ul>
      ${libros.some(x => x.error) ? '<button class="btn sm" id="reint">Reintentar guardado en Drive</button>' : ''}`;
      $$('[data-b]', box).forEach(bt => bt.onclick = () => bajar(libros[bt.dataset.b]));
      const r = $('#reint', box); if (r) r.onclick = subir; };
    async function subir() {
      libros.forEach(x => { if (!x.url) x.error = ''; }); pinta();
      for (const x of libros) {
        if (x.url) continue;
        try { const r = await api('guardarInformeOrdenado', S.sess.token, { nombre: x.nombre, fecha: x.iso, data: x.b64 }); x.url = r.url; x.reemplazado = r.reemplazado; x.error = ''; }
        catch (e) { x.error = e.red ? 'Sin conexión: no se pudo guardar en el Drive. Descárgalo o reintenta.' : e.message; }
        pinta();
      }
    }
    pinta(); subir();
  }
  async function cargarTerminales(resaltar = []) {
    const t = await api('listarTerminales', S.sess.token);
    const internos = /^(OFICINA|DESKTOP|PC-)/i;
    $('#term').innerHTML = `<div class="tw"><table><thead><tr><th>Terminal</th><th class="r">Docs</th><th>Vendedor</th></tr></thead><tbody>${t.map(x => `
      <tr><td><b>${esc(x.terminal)}</b> ${resaltar.includes(x.terminal) || (!x.vendedor && x.documentos) ? '<span class="chip bad">sin asignar</span>' : ''}
        ${internos.test(x.terminal) && !x.vendedor ? '<span class="chip">uso interno</span>' : ''}</td><td class="r">${x.documentos}</td>
      <td><select class="in" style="min-height:38px" data-t="${esc(x.terminal)}"><option value="">— Ninguno —</option>${opcVend(x.vendedor)}</select></td></tr>`).join('')}
      </tbody></table></div>`;
    $$('#term select').forEach(s => s.onchange = async () => {
      const r = await api('asignarTerminal', S.sess.token, s.dataset.t, s.value);
      S.cat = await api('catalogo', S.sess.token);
      toast(`${s.dataset.t} → ${s.value || 'ninguno'}${r.documentosReasignados ? ` · ${r.documentosReasignados} documentos reasignados` : ''}`);
      cargarTerminales();
    });
  }
}

/* ============ EFECTIVO DEL DÍA: conteo de billetes y monto a depositar ============ */
const BILLETES = [20000, 10000, 5000, 2000, 1000];
async function vEfectivo(m) {
  const r = await api('getConteoEfectivo', S.sess.token, S.fecha), cerrada = r.estado === 'CERRADA';
  if (!r.vendedores.length) return render(m, `<h2>Efectivo del día</h2><div class="empty"><b>Sin movimientos este día</b>Parte importando los informes de Mi DTE.</div>`);
  const n = el => soloDigitos(el.value);
  render(m, `<h2>Efectivo del día</h2><p class="lead">Cuenta el efectivo de cada vendedor: cuántos billetes de cada tipo y las monedas (las monedas no se depositan). Abajo queda cuánto hay que depositar.</p>
    ${r.vendedores.map(v => `<div class="card efv" data-u="${esc(v.usuario)}" data-esp="${v.esperado}" style="margin-bottom:10px">
      <div class="row"><b class="grow" style="font-size:17px">${esc(v.nombre)}</b><span class="muted">Debe entregar <b>${clp(v.esperado)}</b></span></div>
      <div class="bill">${BILLETES.map(b => `<label><span>${clp(b)}</span><input class="in n" inputmode="numeric" data-b="${b}" value="${v['b' + b] || ''}" ${cerrada ? 'disabled' : ''} aria-label="Billetes de ${clp(b)} de ${esc(v.nombre)}" placeholder="0"></label>`).join('')}
        <label class="mon"><span>Monedas ($)</span><input class="in n" inputmode="numeric" data-mon value="${v.monedas || ''}" ${cerrada ? 'disabled' : ''} aria-label="Monedas de ${esc(v.nombre)}" placeholder="0"></label></div>
      <div class="row efr"><span class="muted">Billetes <b data-bt></b> · contado <b data-ct></b></span><span class="grow"></span><span data-df></span></div></div>`).join('')}
    <div class="card" id="efs" style="border:1.5px solid var(--ink)">
      <dl class="efd"><dt>Efectivo que debían entregar</dt><dd id="s_esp"></dd>
        <dt>Billetes contados</dt><dd id="s_bil"></dd><dt class="muted" id="s_det" style="grid-column:1/-1;text-align:left"></dt>
        <dt>Monedas (no se depositan)</dt><dd id="s_mon"></dd>
        <dt>Diferencia (contado − esperado)</dt><dd id="s_dif"></dd></dl>
      <div class="grid g2" style="margin:10px 0"><div><label class="f" for="cc">Caja chica (se descuenta del depósito)</label><input class="in n" id="cc" inputmode="numeric" value="${r.cajaChica || ''}" placeholder="0" ${cerrada ? 'disabled' : ''}></div>
        <div><label class="f" for="cco">Para qué es la caja chica</label><input class="in" id="cco" value="${esc(r.obs)}" ${cerrada ? 'disabled' : ''}></div></div>
      <div class="dbox" style="margin-top:6px"><span>Efectivo a depositar</span><b id="s_dep"></b><small>Billetes contados − caja chica</small></div>
      ${cerrada ? '<p class="muted">El día está cerrado: solo ADMIN puede reabrirlo para cambiar el conteo.</p>' : '<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn cu" id="efg">Guardar conteo</button></div>'}</div>`);
  const filas = $$('.efv', m);
  function calc() {
    let esp = 0, bil = 0, mon = 0; const por = {}; BILLETES.forEach(b => por[b] = 0);
    filas.forEach(f => {
      let b = 0; $$('[data-b]', f).forEach(i => { const q = n(i); b += q * Number(i.dataset.b); por[i.dataset.b] += q; });
      const mo = n($('[data-mon]', f)), e = Number(f.dataset.esp), dif = b + mo - e;
      $('[data-bt]', f).textContent = clp(b); $('[data-ct]', f).textContent = clp(b + mo);
      $('[data-df]', f).innerHTML = b + mo === 0 ? '' : dif === 0 ? '<span class="chip ok">Cuadra</span>' : `<span class="chip ${dif < 0 ? 'bad' : 'warn'}">${dif < 0 ? 'Falta ' : 'Sobra '}${clp(Math.abs(dif))}</span>`;
      esp += e; bil += b; mon += mo;
    });
    const cc = n($('#cc')), dif = bil + mon - esp;
    $('#s_esp').textContent = clp(esp); $('#s_bil').textContent = clp(bil); $('#s_mon').textContent = clp(mon);
    $('#s_det').textContent = BILLETES.filter(b => por[b]).map(b => por[b] + ' × ' + clp(b)).join(' · ') || 'Sin billetes contados todavía';
    $('#s_dif').innerHTML = bil + mon === 0 ? '—' : dif === 0 ? '<span class="chip ok">Cuadra</span>' : `<span class="chip ${dif < 0 ? 'bad' : 'warn'}">${dif < 0 ? 'Faltan ' : 'Sobran '}${clp(Math.abs(dif))}</span>`;
    $('#s_dep').textContent = clp(bil - cc);
    return { esp, bil, mon, cc };
  }
  m.oninput = e => { if (e.target.matches('input')) { S.tocado = true; calc(); } };
  calc();
  if ($('#efg')) $('#efg').onclick = async () => {
    const b = $('#efg'); b.disabled = true;
    const datos = { cajaChica: n($('#cc')), obs: $('#cco').value.trim(), filas: filas.map(f => { const o = { vendedor: f.dataset.u, monedas: n($('[data-mon]', f)) }; $$('[data-b]', f).forEach(i => o['b' + i.dataset.b] = n(i)); return o; }) };
    try { await api('guardarConteoEfectivo', S.sess.token, S.fecha, datos); toast('Conteo guardado'); S.tocado = false; } finally { b.disabled = false; }
  };
}

/* ============ RENDICIÓN ============ */
async function vResumen(m) {
  const r = await api('getResumen', S.sess.token, S.fecha);
  const t = r.totales, cerrada = r.estado === 'CERRADA';
  const difCls = v => !v.kilos.salida || !r.hayDetalle ? '' : v.kilos.alerta ? (v.kilos.diferencia > 0 ? 'pos' : 'neg') : '';
  // pasos del día: qué está listo y qué falta, en orden
  const docs = r.porVendedor.reduce((a, v) => a + v.documentos, 0), pend = r.porVendedor.reduce((a, v) => a + v.pendientes, 0);
  const pasos = [
    ['Importar ventas', docs ? docs + ' documentos' : 'Sube los Excel de Mi DTE', docs > 0, 'importar'],
    ['Vendedores detallan', docs ? (pend ? `Faltan ${pend} de ${docs}` : 'Todos listos') : 'Después de importar', docs > 0 && !pend, 'folios'],
    ['Revisar avisos', !docs ? '—' : r.alertas.length ? r.alertas.length + ' por revisar' : 'Sin avisos', docs > 0 && !r.alertas.length, 'avisos'],
    ['Cerrar el día', cerrada ? 'Archivo generado' : 'Genera el archivo', cerrada, 'cerrar']];
  const actual = pasos.findIndex(p => !p[2]);
  render(m, `<div class="row"><div class="grow"><h2>Rendición</h2><p class="lead" style="margin:0">${fechaLarga(S.fecha)}</p></div>
      <span class="chip ${cerrada ? 'ok' : 'cu'}">${cerrada ? 'Cerrada' : 'Abierta'}</span></div>
    <ol class="pasos">${pasos.map((p, i) => `<li class="${p[2] ? 'ok' : i === actual ? 'now' : ''}"><button type="button" data-paso="${p[3]}">
      <i>${p[2] ? '✓' : i + 1}</i><b>${p[0]}</b><small>${esc(p[1])}</small></button></li>`).join('')}</ol>
    <div class="kpis" style="margin-top:14px"><div><span>Venta documentada</span><b>${clp(t.venta)}</b></div><div><span>A crédito</span><b>${clp(t.credito)}</b></div>
      <div><span>Cobranza</span><b>${clp(t.cobranza)}</b></div><div><span>Gastos</span><b>${clp(t.gastos)}</b></div>
      <div class="cash"><span>Efectivo a recibir</span><b>${clp(t.efectivo)}</b></div></div>
    ${r.alertas.length ? `<div class="alert" id="avisos"><b>Antes de cerrar</b><ul>${r.alertas.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`
      : r.porVendedor.length ? '<div class="alert ok">Todo cuadra. Puedes cerrar la rendición.</div>' : ''}
    ${r.porVendedor.length ? '' : '<h3>Por vendedor</h3>'}
    ${r.porVendedor.length ? `<div class="row" style="margin:18px 0 8px"><h3 class="grow" style="margin:0">Por vendedor</h3>
      <button type="button" class="btn ghost sm" id="impTodos">Imprimir inspección de todos</button></div>
    <div class="vcards">${r.porVendedor.map(v => `<div class="vcard clic" data-ver="${esc(v.vendedor)}" role="button" tabindex="0" aria-label="Ver detalle de ${esc(v.vendedor)}">
      <div class="row"><b class="grow" style="font-size:17px">${esc(v.vendedor)}</b>${v.pendientes ? `<button type="button" class="chip cu" data-detallar="${esc(v.vendedor)}" title="Detallar sus folios">${v.pendientes} por detallar · Detallar ›</button>` : '<span class="chip ok">Detallado</span>'}</div>
      <dl><dt>Venta (${v.documentos} docs)</dt><dd>${clp(v.venta)}</dd><dt>Crédito</dt><dd>${clp(v.credito)}</dd>
        <dt>Transferencias y depósitos</dt><dd>${clp(v.TRANSFERENCIA + v.DEP_EFECTIVO)}</dd>${v.CHEQUE ? `<dt>Cheques</dt><dd>${clp(v.CHEQUE)}</dd>` : ''}
        ${v.descuentos ? `<dt>Descuentos</dt><dd>${clp(v.descuentos)}</dd>` : ''}<dt>Efectivo ventas</dt><dd>${clp(v.EFECTIVO)}</dd>
        ${v.cobranza ? `<dt>Cobranza</dt><dd>${clp(v.cobranza)}</dd>` : ''}${v.gastos ? `<dt>Gastos</dt><dd>− ${clp(v.gastos)}</dd>` : ''}
        ${v.depositos ? `<dt>Depositado a la empresa</dt><dd>− ${clp(v.depositos)}${v.depositoDif ? ` <span class="chip bad">dif. ${clp(v.depositoDif)}</span>` : ''}</dd>` : ''}
        <dt class="tot">Efectivo a entregar</dt><dd>${clp(v.efectivoEntregar)}</dd>
        ${v.kilos.salida ? `<dt>Kilos salida / retorno</dt><dd>${kg(v.kilos.salida)} / ${kg(v.kilos.retorno)}</dd>
          <dt>Kilos vendidos${r.hayDetalle ? ' / facturados' : ''}</dt><dd>${kg(v.kilos.vendido)}${r.hayDetalle ? ' / ' + kg(v.kilos.facturado) : ''}</dd>
          ${r.hayDetalle ? `<dt>Diferencia kilos</dt><dd class="${difCls(v) === 'neg' ? 'chip bad' : difCls(v) === 'pos' ? 'chip warn' : ''}" style="justify-self:end">${v.kilos.diferencia > 0 ? '+' : ''}${kg(v.kilos.diferencia)}</dd>
          ${v.kilos.diferenciaPesos ? `<dt>${v.kilos.diferenciaPesos > 0 ? 'A descontar de su liquidación' : 'A favor del vendedor'}</dt><dd class="${difCls(v) === 'neg' ? 'chip bad' : difCls(v) === 'pos' ? 'chip warn' : ''}" style="justify-self:end">${clp(Math.abs(v.kilos.diferenciaPesos))}</dd>` : ''}` : ''}` : ''}
      </dl><div class="vermas">Ver detalle ›</div></div>`).join('')}</div>` : '<div class="empty"><b>Sin movimientos este día</b>Parte importando los informes de Mi DTE.</div>'}
    ${r.sinAsignar.length ? `<h3>Documentos sin vendedor</h3><div class="tw"><table><thead><tr><th>Documento</th><th>Cliente</th><th>Terminal</th><th class="r">Total</th><th>Asignar a</th></tr></thead><tbody>
      ${r.sinAsignar.map(d => `<tr><td>${esc(d.tipo.replace(' Electrónica', ''))} ${esc(d.folio)}</td><td>${esc(d.cliente)}</td><td>${esc(d.terminal)}</td><td class="r">${clp(d.total)}</td>
        <td><select class="in" style="min-height:38px" data-fk="${esc(d.folio_key)}"><option value="">Elegir…</option>${opcVend('')}</select></td></tr>`).join('')}</tbody></table></div>
      <p class="muted">Si todos vienen del mismo terminal, es más rápido asignarlo una vez en Importar Mi DTE → Terminales.</p>` : ''}
    <h3>Otros movimientos</h3><div class="kpis"><div><span>Proveedores</span><b>${clp(t.proveedores)}</b></div><div><span>Consumo (venta en bodega)</span><b>${clp(t.consumo)}</b></div></div>
    <div class="row" style="margin-top:18px;justify-content:flex-end">
      ${cerrada ? (S.sess.rol === 'ADMIN' ? '<button class="btn ghost" id="re">Reabrir rendición</button>' : '')
        : '<button class="btn ghost" id="pv">Ver cómo quedaría</button><button class="btn cu" id="cl">Cerrar y generar archivo de rendición</button>'}</div>
    <div id="lnk"></div>`);
  $$('[data-detallar]', m).forEach(b => b.onclick = e => { e.stopPropagation(); S.vend = b.dataset.detallar; S.filtro = 'pend'; ir('folios'); });
  $$('[data-ver]', m).forEach(c => {
    c.onclick = () => abrirVendedor(c.dataset.ver);
    c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirVendedor(c.dataset.ver); } };
  });
  if ($('#impTodos')) $('#impTodos').onclick = () => imprimirInspeccion('');
  $$('[data-paso]', m).forEach(b => b.onclick = () => {
    const p = b.dataset.paso;
    if (p === 'importar' || p === 'folios') return ir(p);
    const el = p === 'avisos' ? $('#avisos') : ($('#cl') || $('#lnk'));
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  });
  const enlace = (url, txt) => { $('#lnk').innerHTML = `<div class="alert ok fcard" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <span class="grow">${txt}</span><a class="btn cu sm" href="${esc(url)}" target="_blank" rel="noopener">Abrir archivo</a></div>`;
    $('#lnk').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
  const pv = $('#pv'); if (pv) pv.onclick = async () => {
    pv.disabled = true;
    try { const r2 = await api('vistaPreviaRendicion', S.sess.token, S.fecha);
      enlace(r2.url, 'Borrador generado en la carpeta Resumen Rendición / Borradores. El día sigue abierto.'); }
    finally { pv.disabled = false; } };
  $$('select[data-fk]', m).forEach(s => s.onchange = async () => { if (!s.value) return;
    await api('asignarVendedor', S.sess.token, s.dataset.fk, s.value); toast('Asignado'); ir('resumen'); });
  const re = $('#re'); if (re) re.onclick = async () => { if (!confirm('¿Reabrir la rendición de este día?')) return; await api('reabrirRendicion', S.sess.token, S.fecha); ir('resumen'); };
  const cl = $('#cl'); if (cl) cl.onclick = async () => {
    cl.disabled = true;
    try {
      let res = await api('cerrarRendicion', S.sess.token, S.fecha, false);
      if (!res.ok) {
        if (!confirm('Hay pendientes:\n\n• ' + res.alertas.join('\n• ') + '\n\n¿Cerrar de todas formas?')) { cl.disabled = false; return; }
        res = await api('cerrarRendicion', S.sess.token, S.fecha, true);
      }
      toast('Rendición cerrada'); await vResumen(m); $('#lnk') && (() => { $('#lnk').innerHTML = `<div class="alert ok fcard" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span class="grow">Rendición cerrada y guardada en Resumen Rendición.</span><a class="btn cu sm" href="${esc(res.url)}" target="_blank" rel="noopener">Abrir archivo</a></div>`; })();
    } catch (e) { cl.disabled = false; }
  };
}

/* ============ DESCUENTOS ============ */
async function vDescuentos(m) {
  const ds = await api('descuentosPendientes', S.sess.token);
  render(m, `<h2>Descuentos por autorizar</h2><p class="lead">Los vendedores los solicitan al detallar un folio.</p>` + (ds.length ? ds.map(d => `<div class="card" style="margin-bottom:10px"><div class="row">
      <div class="grow"><b>${esc(d.cliente)}</b><div class="muted">${esc(d.folio_key)} · ${esc(d.vendedor)} · ${esc(d.fecha)}</div><div style="margin-top:4px">${esc(d.motivo)}</div></div>
      <div class="big" style="font-size:24px">${clp(d.monto)}</div></div>
      <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost sm" data-no="${d.id}">Rechazar</button><button class="btn cu sm" data-si="${d.id}">Autorizar</button></div></div>`).join('')
    : '<div class="empty"><b>Nada pendiente</b>No hay descuentos esperando autorización.</div>'));
  m.onclick = async e => { const si = e.target.dataset.si, no = e.target.dataset.no; if (!si && !no) return;
    await api('resolverDescuento', S.sess.token, si || no, !!si); toast(si ? 'Descuento autorizado' : 'Descuento rechazado'); ir('descuentos'); };
}

/* ============ DEPÓSITOS DE EFECTIVO ============ */
/** La lista de efectivo por depositar tiene que salir de lo último guardado: se espera a que terminen los guardados pendientes
    (detalle de folios en cola o sin conexión) y se pide de nuevo al servidor, sin usar la copia guardada en el teléfono. */
async function frescoDep(esV) {
  if (COLA.length || (EN_LINEA && pendActivos().length)) toast('Guardando tus folios antes de mostrar los depósitos…');
  for (let i = 0; i < 40 && (COLA.length || (EN_LINEA && pendActivos().length)); i++) { if (EN_LINEA && !colaCorriendo && !COLA.length) sincronizar(); await new Promise(r => setTimeout(r, 400)); }
  if (EN_LINEA) CACHE.delete(claveApi('efectivoParaDepositar', [S.sess.token, S.fecha, esV ? '' : S.vend]));
  return api('efectivoParaDepositar', S.sess.token, S.fecha, esV ? '' : S.vend);
}
async function vDepositos(m) {
  const esV = S.sess.rol === 'VENDEDOR';
  if (!esV && !S.vend) S.vend = S.cat.vendedores[0] && S.cat.vendedores[0].usuario;
  const r = await frescoDep(esV);
  const cerrada = r.estadoDia === 'CERRADA';
  const libres = r.folios.filter(x => !x.deposito).map(x => Object.assign({ tipo: 'f' }, x))
    .concat(r.cobranzas.filter(x => !x.deposito).map(x => Object.assign({ tipo: 'c' }, x)));
  const sumE = xs => xs.reduce((a, x) => a + x.efectivo, 0), pl = n => n + (n === 1 ? ' pago' : ' pagos');
  const todosI = r.folios.map(x => Object.assign({ tipo: 'f' }, x)).concat(r.cobranzas.map(x => Object.assign({ tipo: 'c' }, x))), yaDep = todosI.filter(x => x.deposito);
  render(m, `<h2>Depósitos de efectivo</h2>
    <p class="lead">Registra aquí el efectivo que depositaste. Marca qué folios incluye y sube el comprobante.</p>
    ${libres.length || yaDep.length ? `<div class="kpis" style="margin-bottom:14px"><div><span>Por depositar</span><b>${clp(sumE(libres))}</b><span>${pl(libres.length)}</span></div>
      <div><span>Ya depositado</span><b>${clp(sumE(yaDep))}</b><span>${pl(yaDep.length)}</span></div></div>` : ''}
    ${esV ? '' : `<div class="row" style="margin-bottom:12px"><select class="in" style="width:auto" id="dv">${opcVend(S.vend)}</select></div>`}
    ${cerrada ? '<div class="alert">La rendición de este día está cerrada. Solo lectura.</div>' : libres.length ? `<div class="card">
      <div class="row"><b class="grow">Por depositar (${libres.length})</b><button class="btn ghost sm" id="all">Marcar todos</button></div>
      <p class="muted" style="margin:4px 0 0">Si aparecen folios nuevos después de depositar, son pagos que se detallaron más tarde: aún no están depositados.</p>
      <div id="chk" style="margin:10px 0">${libres.map((x, i) => `<label class="switch" style="padding:8px 0;border-top:1px solid var(--line-2)">
        <input type="checkbox" data-i="${i}" checked><span class="grow">${esc(x.cliente)}<br><span class="muted">${x.tipo === 'c' ? 'Cobranza' : 'Folio'} ${esc(x.folio)}</span></span><b>${clp(x.efectivo)}</b></label>`).join('')}</div>
      <div class="grid g3">
        <div><label class="f" for="db">Banco</label><select class="in" id="db"><option value="">Elegir…</option>${S.cat.bancos.map(b => `<option>${b}</option>`).join('')}</select></div>
        <div><label class="f" for="dm">Monto depositado</label><input class="in n" id="dm" inputmode="numeric"></div>
        <div><label class="f" for="dr">N° de operación</label><input class="in" id="dr" inputmode="numeric"></div>
        ${campoArchivos('dfile')}
      </div>
      <div id="dsal"></div>
      <button class="btn cu block" id="dg" style="margin-top:6px">Registrar depósito</button></div>`
    : '<div class="empty"><b>No hay efectivo pendiente</b>Aparece aquí el efectivo de los folios que marcaste como pagados en efectivo.</div>'}
    <h3>Depósitos registrados</h3>
    ${r.depositos.length ? r.depositos.map(d => `<div class="card" style="margin-bottom:8px"><div class="row">
      <div class="grow"><b>${esc(d.banco)}</b> ${d.referencia ? '· N° ' + esc(d.referencia) : ''}<div class="muted">${d.folios.length} folio(s)${d.cobranzas.length ? ' y ' + d.cobranzas.length + ' cobranza(s)' : ''} · efectivo incluido ${clp(d.incluido)}</div>
        ${d.monto !== d.incluido ? `<span class="chip bad">Diferencia ${clp(d.monto - d.incluido)}</span>` : '<span class="chip ok">Cuadra</span>'}
        <div style="margin-top:6px">${chipsAdj(d.adjuntos, 'DEPOSITOS', d.id, !cerrada || !esV)}</div></div>
      <div class="big" style="font-size:22px">${clp(d.monto)}</div>${cerrada ? '' : `<button class="x" style="width:42px" data-del="${d.id}" aria-label="Borrar depósito">×</button>`}</div><details class="mas" style="margin:6px 0"><summary>Ver qué incluye</summary><ul class="info">${todosI.filter(x => x.deposito === d.id).map(x => `<li>${x.tipo === 'c' ? 'Cobranza' : 'Folio'} ${esc(x.folio)} · ${esc(x.cliente)} · <b>${clp(x.efectivo)}</b></li>`).join('')}</ul></details></div>`).join('')
    : '<div class="empty">Sin depósitos este día.</div>'}`);
  if (!esV) $('#dv').onchange = e => { S.vend = e.target.value; ir('depositos'); };
  m.onclick = async e => { const id = e.target.dataset.del; if (!id || !confirm('¿Borrar este depósito?')) return;
    await api('borrarDeposito', S.sess.token, id); toast('Depósito borrado'); ir('depositos'); };
  activarAdjuntarDespues(m, () => ir('depositos'));
  if (cerrada || !libres.length) return;
  enlazarCampoArchivos('dfile');
  const sel = () => $$('#chk input').filter(c => c.checked).map(c => libres[c.dataset.i]);
  const dm = $('#dm');
  const saldo = () => {
    const inc = sel().reduce((a, x) => a + x.efectivo, 0), mon = soloDigitos(dm.value);
    $('#dsal').innerHTML = `<div class="saldo ${mon === inc ? 'ok' : 'no'}"><span>Efectivo marcado ${clp(inc)}</span><span>${mon === inc ? 'Cuadra' : 'Diferencia ' + clp(mon - inc)}</span></div>`;
  };
  $('#chk').onchange = () => { dm.value = sel().reduce((a, x) => a + x.efectivo, 0); saldo(); };
  $('#all').onclick = () => { $$('#chk input').forEach(c => c.checked = true); $('#chk').onchange(); };
  dm.oninput = saldo; $('#chk').onchange();
  $('#dg').onclick = async () => {
    const s2 = sel();
    if (!$('#db').value) return toast('Elige el banco del depósito.', true);
    if (!s2.length) return toast('Marca al menos un folio.', true);
    const b = $('#dg'); b.disabled = true;
    try {
      if (COLA.length || pendActivos().length) { toast('Aún se están guardando folios. Espera unos segundos y vuelve a intentar.', true); return; }
      if (EN_LINEA) {      // última revisión: si la lista cambió desde que se abrió la pantalla, no se guarda a ciegas
        const f = await frescoDep(esV), ids = r2 => r2.folios.filter(x => !x.deposito).map(x => 'f' + x.key).concat(r2.cobranzas.filter(x => !x.deposito).map(x => 'c' + x.key)).sort().join();
        if (ids(f) !== ids(r)) { toast('La lista de efectivo cambió (se detallaron más folios). Revísala antes de depositar.', true); ir('depositos'); return; }
      }
      const nuevo = await api('guardarDeposito', S.sess.token, S.fecha, { vendedor: esV ? '' : S.vend, banco: $('#db').value, monto: soloDigitos(dm.value), referencia: $('#dr').value,
        folios: s2.filter(x => x.tipo === 'f').map(x => x.key), cobranzas: s2.filter(x => x.tipo === 'c').map(x => x.key) });
      const quedan = libres.filter(x => s2.indexOf(x) < 0);
      toast((nuevo._pendiente ? 'Depósito guardado en el teléfono (sin conexión)' : 'Depósito registrado') + (quedan.length ? `. Quedan ${pl(quedan.length)} por depositar (${clp(sumE(quedan))})` : '. No queda nada por depositar'));
      const fs = [...$('#dfile').files];
      if (fs.length && nuevo._pendiente) toast('Sin conexión: el comprobante no se puede subir ahora. Cuando se envíe el depósito, usa "Adjuntar".', true);
      else if (fs.length) { try { await subirArchivos('DEPOSITOS', nuevo.id, fs); } catch (e) { toast('El depósito quedó guardado, pero el comprobante no subió. Usa "Adjuntar".', true); } }
      ir('depositos');
    } finally { b.disabled = false; }
  };
}

/* ============ HISTORIAL ============ */
async function vHistorial(m) {
  const h = await api('historial', S.sess.token);
  render(m, `<h2>Rendiciones cerradas</h2><p class="lead">Cada cierre genera una planilla en la carpeta Resumen Rendición.</p>` + (h.length ? `<div class="tw"><table><thead><tr><th>Fecha</th><th>Estado</th><th>Cerrada por</th><th>Archivo</th></tr></thead><tbody>
    ${h.map(x => `<tr><td>${esc(x.fecha.split('-').reverse().join('-'))}</td><td>${esc(x.estado)}</td><td>${esc(x.cerrado_por)}</td><td>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">Abrir</a>` : ''}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty"><b>Todavía no hay cierres</b>Cuando cierres una rendición, aparecerá aquí.</div>'));
}

/* ============ COBRAR A UN CLIENTE (desde la lista de créditos) ============ */
const normBus = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fcorta = iso => { const [a, m, d] = String(iso || '').split('-'); return d ? d + '-' + m + '-' + a.slice(2) : ''; };
/** Panel de la sección Cobranza: buscar al cliente, ver lo que debe y registrar el pago de una o varias facturas. */
async function cobrarDesdeLista(box, alTerminar) {
  box.innerHTML = '<div class="card"><div class="sk" style="height:46px;margin:0"></div></div>';
  let r; try { r = await api('porCobrar', S.sess.token); } catch (e) { box.innerHTML = ''; return; }
  const clientes = r.clientes;
  if (!clientes.length) { box.innerHTML = '<div class="card"><b>Por cobrar</b><p class="muted" style="margin:4px 0 0">No hay créditos por cobrar cargados. La encargada puede subir la lista en <b>Importar Mi DTE</b>.</p></div>'; return; }
  const edad = d => d > 60 ? 'bad' : d > 30 ? 'warn' : 'ok';
  box.innerHTML = `<div class="card"><div class="row"><b class="grow" style="font-size:17px">Cobrar a un cliente</b><span class="muted">${clientes.length} con deuda · ${clp(clientes.reduce((a, c) => a + c.deuda, 0))}</span></div>
    <details style="margin-top:8px"><summary class="muted" style="cursor:pointer">Ver política de crédito</summary>${tarjetaPolitica()}</details>
    <input class="in" id="cq" placeholder="Buscar por nombre o RUT" autocomplete="off" style="margin-top:10px"><div id="cres" style="margin-top:8px"></div><div id="cpan"></div></div>`;
  const res = $('#cres', box), pan = $('#cpan', box);
  const lista = q => {
    const n = normBus(q), xs = (n ? clientes.filter(c => normBus(c.cliente).indexOf(n) >= 0 || normBus(c.rut).indexOf(n) >= 0) : clientes.slice().sort((a, b) => b.deuda - a.deuda)).slice(0, 8);
    res.innerHTML = xs.length ? xs.map(c => `<button type="button" class="cli" data-k="${esc(c.clave)}"><span class="grow"><b>${esc(c.cliente)}</b><small>${esc(c.rut || 'Sin RUT')} · ${c.facturas.length} factura${c.facturas.length > 1 ? 's' : ''}</small></span><b>${clp(c.deuda)}</b></button>`).join('')
      : '<div class="muted">Ningún cliente con deuda coincide.</div>';
  };
  lista('');
  $('#cq', box).oninput = e => { pan.innerHTML = ''; lista(e.target.value); };
  res.onclick = e => { const b = e.target.closest('.cli'); if (!b) return; abrirCliente(clientes.find(c => c.clave === b.dataset.k)); };
  function abrirCliente(c) {
    res.innerHTML = '';
    pan.innerHTML = `<div class="cpan"><div class="row"><div class="grow"><b style="font-size:17px">${esc(c.cliente)}</b><div class="muted">${esc(c.rut || 'Sin RUT')}${c.condicion ? ' · crédito a ' + c.condicion + ' días' : ''}</div></div>
        <button type="button" class="btn ghost sm" id="cvolver">Otro cliente</button></div>
      <div class="muted" style="margin:8px 0 4px">Marca las facturas que paga hoy:</div>
      ${c.facturas.map((f, i) => `<div class="cfac"><label class="row" style="gap:10px"><input type="checkbox" class="cchk" data-i="${i}">
          <span class="grow">${esc(f.tipo.replace(' Electrónica', ''))} N° ${esc(f.folio)} <span class="muted">· ${fcorta(f.fecha)}${f.vendedor ? ' · ' + esc(f.vendedor) : ''}</span>
          <div>${f.cheque ? '<span class="chip warn">Cheque en cartera</span> ' : ''}<span class="chip ${edad(f.dias)}">${f.dias} días</span>${f.venc && f.venc < r.hoy ? ' <span class="chip bad">Vencida</span>' : ''}</div>${plazoPolitica(netoDe(f.total)) ? `<div class="muted">Neto ${clp(netoDe(f.total))} · política: ${plazoPolitica(netoDe(f.total))} días</div>` : ''}</span>
          <span style="text-align:right"><b>${clp(f.saldo)}</b><div class="muted">de ${clp(f.total)}</div></span></label>
        <div class="cmonto" hidden><label class="f">Monto que paga</label><input class="in n" inputmode="numeric" data-m="${i}" value="${f.saldo}"></div></div>`).join('')}
      <div class="row" style="margin:8px 0"><button type="button" class="btn ghost sm" id="ctodas">Marcar todas</button><span class="grow"></span><span class="muted">Total a cobrar <b id="ctot" style="color:var(--ink);font-size:18px">$0</b></span></div>
      <div class="grid g2"><div><label class="f" for="cforma">Forma de pago</label><select class="in" id="cforma"><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="CHEQUE">Cheque</option></select></div>
        <div id="cbancow" hidden><label class="f" for="cbanco">Banco al que transfirió</label><select class="in" id="cbanco">${S.cat.bancos.map(b => `<option>${b}</option>`).join('')}</select></div></div>
      <div id="cch" hidden style="margin-top:10px">${camposCheque(null, 'cobro')}</div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn cu" id="cok">Registrar cobro</button></div></div>`;
    const sel = () => $$('.cchk', pan).filter(x => x.checked);
    const total = () => { const t = sel().reduce((a, x) => a + soloDigitos($('[data-m="' + x.dataset.i + '"]', pan).value), 0); $('#ctot', pan).textContent = clp(t); return t; };
    pan.onchange = e => { if (e.target.classList.contains('cchk')) { $('.cmonto', e.target.closest('.cfac')).hidden = !e.target.checked; total(); } };
    pan.oninput = e => { if (e.target.dataset.m !== undefined) total(); };
    $('#cvolver', pan).onclick = () => { pan.innerHTML = ''; lista($('#cq', box).value); };
    $('#ctodas', pan).onclick = () => { const todas = $$('.cchk', pan); const on = todas.some(x => !x.checked); todas.forEach(x => { x.checked = on; $('.cmonto', x.closest('.cfac')).hidden = !on; }); total(); };
    const forma = $('#cforma', pan);
    forma.onchange = () => { $('#cbancow', pan).hidden = forma.value !== 'TRANSFERENCIA'; $('#cch', pan).hidden = forma.value !== 'CHEQUE'; if (forma.value === 'CHEQUE') avisoTipoCheque($('.cheque', pan)); };
    $('#cok', pan).onclick = async () => {
      const xs = sel(); if (!xs.length) return toast('Marca al menos una factura.', true);
      const items = xs.map(x => { const f = c.facturas[x.dataset.i], m = soloDigitos($('[data-m="' + x.dataset.i + '"]', pan).value); return { folio_key: f.folio_key, folio: f.folio, monto: m, saldo: f.saldo }; });
      if (items.some(i => !i.monto)) return toast('Hay una factura sin monto.', true);
      const mas = items.find(i => i.monto > i.saldo);
      if (mas && !confirm('Una de las facturas paga más de lo que debe (' + clp(mas.monto) + ' de ' + clp(mas.saldo) + '). ¿Registrar igual?')) return;
      const pago = { forma: forma.value };
      if (forma.value === 'TRANSFERENCIA') pago.banco = $('#cbanco', pan).value;
      if (forma.value === 'CHEQUE') { const ch = leerCheque($('.cheque', pan)); if (ch.error) return toast(ch.error, true); Object.assign(pago, ch.datos); }
      const b = $('#cok', pan); b.disabled = true;
      try {
        const r = await api('guardarCobro', S.sess.token, S.fecha, { cliente: c.cliente, rut: c.rut }, pago, items.map(i => ({ folio_key: i.folio_key, folio: i.folio, monto: i.monto })));
        toast((r._pendiente ? 'Cobro guardado en el teléfono (sin conexión): ' : 'Cobro registrado: ') + clp(items.reduce((a, i) => a + i.monto, 0)));
        await alTerminar();
      } finally { b.disabled = false; }
    };
  }
}

/* ============ COBRANZA, PROVEEDORES, CONSUMO, GASTOS ============ */
const MOV = {
  COBRANZA: { t: 'Cobranza', d: 'Pagos recibidos de facturas a crédito de días anteriores.',
    f: [['cliente', 'Cliente'], ['folio', 'Folio que paga (obligatorio)'], ['monto', 'Monto', 'n'], ['forma', 'Forma de pago', 'forma'], ['banco', 'Banco', 'banco'], ['vendedor', 'Vendedor', 'vend']] },
  PROVEEDORES: { t: 'Proveedores', d: 'Pagos y documentos de proveedores del día.',
    f: [['proveedor', 'Proveedor'], ['documento', 'Documento'], ['folio', 'Folio'], ['monto', 'Monto', 'n'], ['forma', 'Forma de pago', 'forma'], ['obs', 'Observación']] },
  CONSUMO: { t: 'Consumo', d: 'Ventas hechas directamente en la bodega.',
    f: [['cliente', 'Cliente'], ['folio', 'Folio'], ['monto', 'Monto', 'n'], ['forma', 'Forma de pago', 'forma'], ['obs', 'Observación']] },
  GASTOS: { t: 'Gastos', d: 'Combustible, peajes, almuerzo y otros gastos del día. Saca una foto a la boleta. Se descuentan del efectivo a entregar.',
    f: [['concepto', 'Concepto'], ['monto', 'Monto', 'n'], ['respaldo', 'N° de boleta'], ['responsable', 'Responsable', 'vend'], ['obs', 'Observación']] }
};
async function vMov(m, tabla) {
  const cfg = MOV[tabla], esV = S.sess.rol === 'VENDEDOR';
  const campos = cfg.f.filter(c => !(esV && c[2] === 'vend'));
  const inp = c => c[2] === 'forma' ? `<select class="in" name="${c[0]}" id="m_${c[0]}">${S.cat.formas.filter(f => f !== 'CREDITO').map(f => `<option value="${f}">${FL[f]}</option>`).join('')}</select>`
    : c[2] === 'banco' ? `<select class="in" name="${c[0]}" id="m_${c[0]}"><option value="">—</option>${S.cat.bancos.map(b => `<option>${b}</option>`).join('')}</select>`
    : c[2] === 'vend' ? `<select class="in" name="${c[0]}" id="m_${c[0]}">${tabla === 'GASTOS' ? '<option value="GENERAL">General / planta</option>' : ''}${opcVend(S.vend)}</select>`
    : `<input class="in ${c[2] === 'n' ? 'n' : ''}" name="${c[0]}" id="m_${c[0]}" ${c[2] === 'n' ? 'inputmode="numeric"' : ''}>`;
  const rows = await api('listarMov', S.sess.token, tabla, S.fecha);
  const conAdj = !!ADJ[tabla];
  render(m, `<h2>${cfg.t}</h2><p class="lead">${cfg.d}</p>
    ${tabla === 'COBRANZA' ? '<div id="cbx" style="margin-bottom:14px"></div><details class="manual"><summary>Registrar un pago a mano (sin usar la lista)</summary>' : ''}
    <div class="card">${tabla === 'GASTOS' ? (() => {
        const celda = c => `<div><label class="f" for="m_${c[0]}">${c[1]}</label>${inp(c)}</div>`, extra = c => c[0] === 'respaldo' || c[0] === 'obs';
        return `<div id="fm"><div class="grid g2">${campos.filter(c => !extra(c)).map(celda).join('')}</div>
          <div style="margin-top:12px">${campoArchivos('mf').replace('Foto o archivo de respaldo', 'Foto de la boleta')}</div>
          <details class="mas"><summary>Agregar N° de boleta u observación</summary><div class="grid g2" style="margin-top:8px">${campos.filter(extra).map(celda).join('')}</div></details></div>`; })()
      : `<div class="grid g3" id="fm">${campos.map(c => `<div><label class="f" for="m_${c[0]}">${c[1]}</label>${inp(c)}</div>`).join('')}${conAdj ? campoArchivos('mf') : ''}</div>`}
      ${tabla === 'COBRANZA' ? `<div id="mch" hidden style="margin-top:12px"><div class="pregunta" style="margin-top:0">Datos del cheque</div>${camposCheque(null, 'mov')}</div>` : ''}
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn cu" id="ad">Agregar</button></div></div>
    ${tabla === 'COBRANZA' ? '</details>' : ''}
    <div id="ml" style="margin-top:16px"></div>`);
  function lista(rows) {
    const cols = campos.map(c => c[0]);
    $('#ml').innerHTML = rows.length ? `<div class="tw"><table><thead><tr>${campos.map(c => `<th class="${c[2] === 'n' ? 'r' : ''}">${c[1]}</th>`).join('')}${conAdj ? '<th>Respaldo</th>' : ''}<th></th></tr></thead><tbody>
      ${rows.map(r => `<tr>${cols.map(k => `<td class="${k === 'monto' ? 'r' : ''}">${k === 'monto' ? clp(r[k]) : k === 'forma' ? (FL[r[k]] || esc(r[k])) : esc(r[k])}</td>`).join('')}
        ${conAdj ? `<td>${chipsAdj(r.adjuntos, tabla, r.id, true)}</td>` : ''}
        <td><button class="x" style="min-height:34px;width:34px" data-id="${r.id}" aria-label="Borrar">×</button></td></tr>`).join('')}
      </tbody><tfoot><tr>${cols.map(k => `<td class="r">${k === 'monto' ? clp(rows.reduce((a, r) => a + r.monto, 0)) : ''}</td>`).join('')}${conAdj ? '<td></td>' : ''}<td></td></tr></tfoot></table></div>`
      : '<div class="empty">Sin registros para este día.</div>';
  }
  lista(rows);
  const recargar = async () => lista(await api('listarMov', S.sess.token, tabla, S.fecha));
  if (tabla === 'COBRANZA') {
    const panel = () => cobrarDesdeLista($('#cbx'), async () => {
      const ka = [S.sess.token], kb = [S.sess.token, tabla, S.fecha];
      if (EN_LINEA && !pendActivos().length) await Promise.all([pedir('porCobrar', ka, claveApi('porCobrar', ka)), pedir('listarMov', kb, claveApi('listarMov', kb))]).catch(() => {});
      lista(await api('listarMov', S.sess.token, tabla, S.fecha)); panel();
    });
    panel();
  }
  if (conAdj) { enlazarCampoArchivos('mf'); activarAdjuntarDespues($('#ml'), recargar); }
  $('#ml').onclick = async e => { const id = e.target.dataset.id; if (!id || !confirm('¿Borrar este registro?')) return;
    await api('borrarMov', S.sess.token, tabla, id); lista(await api('listarMov', S.sess.token, tabla, S.fecha)); };
  // cobranza con cheque: se piden sus datos y el banco pasa a ser el del cheque
  const mf = $('#m_forma'), mch = $('#mch');
  if (mf && mch) mf.onchange = () => { const ch = mf.value === 'CHEQUE'; mch.hidden = !ch; const mb = $('#m_banco'); if (mb) { mb.disabled = ch; if (ch) mb.value = ''; }
    if (ch) avisoTipoCheque($('.cheque', mch)); };
  $('#ad').onclick = async () => {
    const o = {}; $$('[name]', $('#fm')).forEach(x => o[x.name] = x.value);
    o.monto = String(soloDigitos(o.monto));
    if (mch && o.forma === 'CHEQUE') { const r = leerCheque($('.cheque', mch)); if (r.error) return toast(r.error, true); Object.assign(o, r.datos); }
    if (o.monto === '0') return toast('Ingresa el monto.', true);
    if (tabla === 'COBRANZA') { o.folio = String(o.folio || '').replace(/\D/g, ''); if (!o.folio) return toast('Falta el folio de la factura que paga. Es obligatorio.', true); }
    if ((o.forma === 'TRANSFERENCIA' || o.forma === 'DEP_EFECTIVO') && 'banco' in o && !o.banco) return toast('Indica el banco.', true);
    const b = $('#ad'); b.disabled = true;
    try {
      const nuevo = await api('guardarMov', S.sess.token, tabla, S.fecha, o); toast(nuevo._pendiente ? 'Guardado en el teléfono (sin conexión)' : 'Agregado');
      const fs = conAdj ? [...$('#mf').files] : [];
      if (fs.length && nuevo._pendiente) toast('Sin conexión: el archivo no se puede subir ahora. Cuando se envíe el registro, usa "Adjuntar".', true);
      else if (fs.length) { try { await subirArchivos(tabla, nuevo.id, fs); } catch (e) { toast('El registro quedó guardado, pero el archivo no subió. Usa "Adjuntar" en la fila.', true); } }
      $$('input', $('#fm')).forEach(x => x.value = ''); if (conAdj) $('#mf').onchange();
      if (mch) { $$('input:not([type=date])', mch).forEach(x => x.value = ''); $('[data-c="banco"]', mch).value = ''; }
      await recargar();
    } finally { b.disabled = false; }
  };
}

/* ---------- arranque ---------- */
if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.indexOf('PEGA_AQUI') >= 0)
  $('#app').innerHTML = '<div class="login"><img class="logo" src="icon-192.png" alt=""><h1>Falta configurar</h1><p class="lead">Pega la URL de la implementación de Apps Script en <b>config.js</b>.</p></div>';
else S.sess ? iniciar().catch(e => /SESION/.test(String((e && e.message) || e)) ? salir(true) : sinConexionInicio()) : pantallaLogin();
function sinConexionInicio() {
  $('#app').innerHTML = `<div class="login"><img class="logo" src="icon-192.png" alt="" width="96" height="96"><h1>Sin conexión</h1><p class="lead">No se pudo abrir la app. Tus cambios guardados siguen en el teléfono. Revisa tu internet e intenta de nuevo.</p>
    <button class="btn cu block" id="rei">Reintentar</button></div>`;
  $('#rei').onclick = () => iniciar().catch(e => /SESION/.test(String((e && e.message) || e)) ? salir(true) : sinConexionInicio());
}

if ('serviceWorker' in navigator) window.addEventListener('load', () => {
  const habia = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  // cuando se instala una versión nueva, se ofrece recargar (no se recarga sola para no perder lo que se está escribiendo)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habia || $('.nuevaver')) return;
    const b = document.createElement('div'); b.className = 'nuevaver'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>Hay una versión nueva de la app.</span><button type="button">Actualizar</button>';
    b.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(b);
  });
});
