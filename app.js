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
const nk = n => String(Math.round((Number(String(n).replace(',', '.')) || 0) * 100) / 100).replace('.', ',');
const dec = v => Number(String(v).replace(',', '.')) || 0;

/* v134: los campos de monto muestran puntos de miles mientras se escribe (123456 → 123.456), en toda la app.
   Solo inputs "in n" con inputmode numeric; se excluyen folios y N° de cheque/NC. Todo el código lee con soloDigitos, así que los puntos no molestan. */
const MONTO_SEL = 'input.in.n[inputmode="numeric"]:not(#adF):not(#anF):not([data-nc]):not([data-c])';
const conPuntos = v => { const d = String(v).replace(/\D/g, '').replace(/^0+(?=\d)/, ''); return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
document.addEventListener('input', e => {
  const i = e.target; if (!i.matches || !i.matches(MONTO_SEL)) return;
  const antes = i.value, pos = i.selectionStart, dig = (antes.slice(0, pos).match(/\d/g) || []).length, nuevo = conPuntos(antes);
  if (nuevo === antes) return;
  i.value = nuevo;
  let c = 0, k = 0; while (k < nuevo.length && c < dig) { if (/\d/.test(nuevo[k])) c++; k++; }
  try { i.setSelectionRange(k, k); } catch (_) {}
}, true);
// valores que ya vienen puestos al dibujar una pantalla u hoja
new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(nd => {
  if (nd.nodeType !== 1) return;
  (nd.matches(MONTO_SEL) ? [nd] : Array.from(nd.querySelectorAll(MONTO_SEL))).forEach(i => { if (i.value && /^\d+$/.test(i.value)) i.value = conPuntos(i.value); });
}))).observe(document.documentElement, { childList: true, subtree: true });
const fechaLarga = iso => { const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }); };
const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const FL = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', DEP_EFECTIVO: 'Depósito en efectivo', CHEQUE: 'Cheque', CREDITO: 'Crédito', NOTA_CREDITO: 'Nota de crédito' };
const CATS = { PROPIOS: 'Productos propios', CARNICOS: 'Cárnicos', CONGELADOS: 'Congelados', LACTEOS: 'Lácteos', LAMINADOS: 'Laminados, quesos y verduras', REVISAR: 'Por clasificar' };
const ROL = { ADMIN: 'Administración', SUPERVISOR: 'Supervisión', RENDICION: 'Rendición', BODEGA: 'Bodega', VENDEDOR: 'Vendedor', GERENCIA: 'Gerencia' };

/** Pestañas del rol (todos los vendedores tienen Depósito, por si hace falta). */
const tabsRol = () => TABS[S.sess.rol] || [];
const vendDeposita = () => true;
const IC = {
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
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
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  out: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M7 9h4M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3"/>'
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
  if (el._vid !== undefined && el._vid !== S.vistaId) throw new Error('vista vieja');      // la persona ya cambió de día o pantalla: lo que llega tarde no se dibuja ni activa nada
  el.innerHTML = html;
  if (S.silencio) return;                       // actualización por detrás: sin animación ni salto
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  animarMontos(el);
}
/** Los totales de las tarjetas resumen "suben" desde cero al abrir la pantalla (solo se ve, el valor final es el real). */
function animarMontos(raiz) {
  return;       // v83: el conteo animado redibujaba el texto en cada cuadro y se sentía pegado
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
  (editable ? ` <button type="button" class="chip ${(adj || []).length ? '' : 'warn'}" data-adj="${esc(id)}" data-tabla="${tabla}" title="Adjuntar foto o archivo">${icon('camera')} ${(adj || []).length ? 'Agregar' : 'Falta foto · Adjuntar'}</button>` : '');
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
const LECTURA = new Set(['getCajaChica', 'listarClientes', 'getAvance', 'listaUsuarios', 'catalogo', 'misDocumentos', 'getDespacho', 'getInventario', 'getSaldosClientes', 'listarTerminales',
  'getResumen', 'getInspeccion', 'descuentosPendientes', 'efectivoParaDepositar', 'historial', 'listarMov', 'listarDevoluciones', 'getConteoEfectivo', 'porCobrar', 'listarCheques', 'listarUsuariosAdmin', 'getKpis', 'getSugerido', 'listarAdelantos', 'listarAnulaciones', 'anulacionesPendientes']);
const MSG = { login: 'Ingresando…', catalogo: 'Preparando la app…', importarDTE: 'Importando ventas de Mi DTE…', importarDetalle: 'Importando detalle de productos…',
  cerrarRendicion: 'Generando el archivo de rendición…', vistaPreviaRendicion: 'Armando el borrador…', generarPlanillaInventario: 'Armando la planilla de inventario…',
  subirAdjunto: 'Subiendo archivo…', getResumen: 'Calculando la rendición…', getInventario: 'Calculando el inventario…', getSaldosClientes: 'Calculando saldos…',
  misDocumentos: 'Cargando folios…', getInspeccion: 'Preparando el detalle…', xlsx: 'Preparando el lector de Excel…', getDespacho: 'Cargando despacho…', listarMov: 'Cargando…', listarDevoluciones: 'Cargando devoluciones…', getConteoEfectivo: 'Cargando el conteo…', porCobrar: 'Buscando lo que hay por cobrar…', listarCheques: 'Cargando los cheques…', listarUsuariosAdmin: 'Cargando usuarios…', listarPrecios: 'Cargando los precios…', guardarPrecios: 'Guardando los precios…', guardarUsuario: 'Guardando el usuario…', restablecerClave: 'Generando la clave…', marcarCheque: 'Guardando…', cargarCreditos: 'Cargando la lista de créditos…', generarPlanillaPorCobrar: 'Armando la planilla por cobrar…', reintentarRut: 'Buscando RUT…', historial: 'Cargando historial…', getKpis: 'Calculando los indicadores…', getSugerido: 'Calculando la carga sugerida…' };
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
/* v135: tras guardar o borrar algo, las listas que muestran ese dato se piden de nuevo al servidor (no se usa la copia guardada, que aún no lo trae:
   por eso antes «Cobrado hoy»/«Gastos» no mostraban lo recién registrado y al agregar otro aparecía el anterior). */
const LISTAS_TRAS_ESCRIBIR = /^(getCajaChica|listarMov|porCobrar|efectivoParaDepositar|listarDevoluciones|getConteoEfectivo|listarAdelantos|listarAnulaciones|anulacionesPendientes)\|/;
const ESCRITURAS_DE_LISTA = new Set(['guardarCajaChica', 'borrarCajaChica', 'guardarMov', 'borrarMov', 'guardarCobro', 'guardarDeposito', 'guardarDevolucion', 'borrarDevolucion', 'adelantarFolio', 'borrarAdelanto', 'solicitarAnulacion', 'borrarAnulacion', 'guardarConteoEfectivo']);
function purgarListas() { Array.from(CACHE.keys()).forEach(k => { if (LISTAS_TRAS_ESCRIBIR.test(k)) CACHE.delete(k); }); guardarCache(); }
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

/** Deja el botón con un giro y un texto («Registrando…») hasta que se llame a lo que devuelve; así quien toca ve que está trabajando. */
function botonOcupado(b, texto) {
  const h = b.innerHTML, w = b.style.minWidth;
  b.style.minWidth = b.offsetWidth + 'px'; b.classList.add('busy'); b.disabled = true;
  b.innerHTML = '<span class="spin"></span>' + texto;
  return () => { if (!b.isConnected) return; b.innerHTML = h; b.style.minWidth = w; b.classList.remove('busy'); b.disabled = false; };
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
  if (fn === 'borrarAdelanto' && String(args[1]).indexOf('pend_') === 0) { const id = String(args[1]); PEND = PEND.filter(p => 'pend_' + p.op !== id); guardarPend(); return true; }
  if (S.sess && COLA_FN.has(fn)) return escribir(fn, args);
  if ((fn === 'borrarMov' && String(args[2]).indexOf('pend_') === 0) || ((fn === 'borrarDevolucion' || fn === 'borrarAdelanto') && String(args[1]).indexOf('pend_') === 0)) {
    const id = String(args[fn === 'borrarMov' ? 2 : 1]); PEND = PEND.filter(p => 'pend_' + p.op !== id); guardarPend(); return true;       // aún no se había enviado: solo se cancela
  }
  const lectura = LECTURA.has(fn), key = claveApi(fn, args);
  if (lectura && S.leidas) S.leidas.set(key, [fn, args]);       // lo que usa la pantalla actual (para el refresco automático)
  if (lectura && CACHE.has(key) && (Date.now() - CACHE.get(key).t < 12 * 3600e3 || !EN_LINEA)) {
    const e = CACHE.get(key);
    if (EN_LINEA && (e.viejo || Date.now() - e.t > FRESCURA)) revalidar(fn, args, key);
    return superponer(fn, args, copia(e.d));
  }
  if (!lectura) olvidarCache(false);
  const fin = trabajando(fn, !lectura);
  try { return superponer(fn, args, copia(await pedir(fn, args, key))); }
  catch (e) {
    if (e.red && fn === 'listarAdelantos') return superponer(fn, args, []);
    if (e.red && lectura) { toast('Sin conexión: esta pantalla todavía no se había abierto con internet.', true); throw e; }
    errorApi(e); throw e; }
  finally { fin(); }
}

/* ---------- modo sin conexión ----------
   Lo que se guarda sin internet queda en el teléfono (cola persistente, sobrevive aunque se cierre la app) y se envía solo, en orden,
   cuando vuelve la conexión. Las pantallas ya vistas se muestran desde la memoria del teléfono con lo pendiente superpuesto.
   El servidor reconoce los reenvíos (`op`) para no duplicar registros. */
const COLA_FN = new Set(['guardarDetalle', 'guardarVarios', 'guardarMov', 'borrarMov', 'guardarCobro', 'guardarDevolucion', 'saveDespacho', 'guardarDeposito', 'guardarConteoEfectivo', 'adelantarFolio', 'borrarAdelanto', 'solicitarAnulacion', 'borrarAnulacion']);
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
const RECIEN = new Map();      // firma de la última escritura -> {t, p}: dos toques seguidos al mismo botón no duplican nada
function escribir(fn, args) {
  let firma; try { firma = fn + '|' + (S.sess ? S.sess.usuario : '') + '|' + JSON.stringify(args.slice(1)); } catch (e) { return escribir1(fn, args); }
  const r = RECIEN.get(firma);
  if (r && Date.now() - r.t < 4000) return r.p;
  const p = escribir1(fn, args); RECIEN.set(firma, { t: Date.now(), p });
  p.catch(() => RECIEN.delete(firma));
  if (RECIEN.size > 60) for (const [k, v] of RECIEN) if (Date.now() - v.t > 4000) RECIEN.delete(k);
  return p;
}
async function escribir1(fn, args) {
  const resto = args.slice(1), op = idOp(); let enviado = false;
  if (EN_LINEA && !pendActivos().length) {
    const key = claveApi(fn, args), fin = trabajando(fn, true);
    try { const r = copia(await pedir(fn, args, key, { op })); olvidarCache(false); if (ESCRITURAS_DE_LISTA.has(fn)) purgarListas(); return r; }
    catch (e) { if (!e.red) { errorApi(e); throw e; } enviado = true; }        // se cortó: puede haber llegado o no; el reenvío lo comprueba
    finally { fin(); }
  }
  PEND.push({ op, fn, args: resto, usuario: S.sess.usuario, t: Date.now(), enviado, error: '' });
  guardarPend(); olvidarCache(false);
  if (EN_LINEA) setTimeout(sincronizar, 50);
  return { _pendiente: true, id: 'pend_' + op };
}
let ADEL_UNO = false;
async function sincronizar() {
  if (sincronizando || !S.sess || !pendActivos().length) return;
  sincronizando = true; pintarRed(); let enviados = 0, rechazados = 0;
  try {
    for (;;) {
      const x = pendActivos()[0]; if (!x) break;
      // v99: los folios adelantados seguidos van todos en UNA llamada (antes una por folio, cada una con su espera y su cruce con Mi DTE)
      const grupo = (x.fn === 'adelantarFolio' && !ADEL_UNO) ? pendActivos().filter(p => p.fn === 'adelantarFolio').slice(0, 100) : [];
      if (grupo.length > 1) {
        try {
          const r = await llamar('adelantarVarios', [S.sess.token, grupo.map(g => g.args)], { op: grupo[0].op, rep: !!grupo[0].enviado });
          grupo.forEach((g, i) => {
            const ri = (r && r.resultados || [])[i];
            if (ri && ri.ok === false) { g.error = String(ri.error || 'No se pudo anotar'); rechazados++; }
            else { PEND = PEND.filter(p => p !== g); enviados++; }
          });
          guardarPend();
        } catch (e) {
          if (e.red) { grupo.forEach(g => { g.enviado = true; }); guardarPend(); break; }
          if (String(e.message).indexOf('SESION') >= 0) { guardarPend(); sincronizando = false; return salir(true); }
          if (/desconocid/i.test(String(e.message))) { ADEL_UNO = true; continue; }      // servidor antiguo: uno por uno, como antes
          grupo.forEach(g => { g.error = String(e.message || e).replace('SESION: ', ''); rechazados++; }); guardarPend();
        }
        continue;
      }
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
/* Folios detallados en esta sesión con el guardado rápido: se recuerdan hasta que el servidor confirme que ya los tiene, así los contadores
   ("faltan N") nunca retroceden mientras la cola va guardando por detrás. */
const LOCAL = new Map();
const kLocal = (f, k) => f + '\u0001' + k;
const mismasLineas = (a, b) => JSON.stringify((a || []).map(l => [l.forma, l.banco || '', soloDigitos(l.monto)])) === JSON.stringify((b || []).map(l => [l.forma, l.banco || '', soloDigitos(l.monto)]));
function superponerLocal(args, data) {
  if (!LOCAL.size || !data || !data.docs) return;
  LOCAL.forEach((lineas, k) => {
    const [f, key] = k.split('\u0001'); if (f !== args[1]) return;
    const i = data.docs.findIndex(d => d.folio_key === key); if (i < 0) return;
    const enCola = COLA.some(x => x.fecha === f && x.d.folio_key === key);
    if (!enCola && data.docs[i].estado === 'DETALLADO' && mismasLineas(data.docs[i].pagos, lineas)) LOCAL.delete(k);        // el servidor ya lo tiene
    else data.docs[i] = docLocal(data.docs[i], lineas);
  });
}
function superponer(fn, args, data) {
  if (fn === 'misDocumentos') superponerLocal(args, data);
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
        if (p.fn === 'guardarCobro' && args[1] === 'COBRANZA' && p.args[0] === args[2]) {      // v135: un cobro hecho con «Cobrar a un cliente» se ve al tiro en «Cobrado hoy», aunque aún no llegue al servidor
          const pg = (Array.isArray(p.args[2]) ? p.args[2] : [p.args[2]]).map(x => ({ forma: x.forma, banco: x.banco || '', resto: soloDigitos(x.monto) }));
          (p.args[3] || []).forEach((it, k) => { let falta = soloDigitos(it.monto);
            pg.forEach((x, j) => { const m = pg.length === 1 ? falta : Math.min(x.resto, falta); if (!(m > 0)) return; x.resto -= m; falta -= m;
              data.push({ id: 'pend_' + p.op + '_' + k + '_' + j, fecha: p.args[0], cliente: (p.args[1] || {}).cliente || '', rut: (p.args[1] || {}).rut || '', folio: String(it.folio || ''), monto: m, forma: x.forma, banco: x.banco, adjuntos: [], sinEnviar: true,
                vendedor: S.sess.rol === 'VENDEDOR' ? S.sess.usuario : '' }); }); });
        }
        if (p.fn === 'borrarMov' && p.args[0] === args[1]) data = data.filter(r => r.id !== p.args[1]);
      });
    } else if (fn === 'listarAdelantos') {
      ps.forEach(p => {
        if (p.fn === 'adelantarFolio' && p.args[0] === args[1] && (S.sess.rol === 'VENDEDOR' || p.args[5] === args[2])) {
          const pg = p.args[4] || [], fol = String(p.args[2]).replace(/\D/g, '').replace(/^0+/, '');
          data = data.filter(x => !(String(x.folio) === fol && x.tipo === (/bol/i.test(p.args[1]) ? 'Boleta' : 'Factura')));
          data.unshift({ id: 'pend_' + p.op, tipo: /bol/i.test(p.args[1]) ? 'Boleta' : 'Factura', folio: fol, monto: soloDigitos(p.args[3]), forma: pg.length > 1 ? 'MIXTO' : (pg[0] || {}).forma, banco: (pg[0] || {}).banco || '', estado: 'ESPERANDO', nota: '', sinEnviar: true });
        }
        if (p.fn === 'borrarAdelanto') data = data.filter(x => x.id !== p.args[0]);
      });
    } else if (fn === 'listarAnulaciones') {
      ps.forEach(p => {
        if (p.fn === 'solicitarAnulacion' && p.args[0] === args[1] && (S.sess.rol === 'VENDEDOR' || p.args[9] === args[2])) {
          const ls = p.args[4] || [], fol = String(p.args[2]).replace(/\D/g, '').replace(/^0+/, '');
          data.unshift({ id: 'pend_' + p.op, tipo: /bol/i.test(p.args[1]) ? 'Boleta' : 'Factura', folio: fol, modo: p.args[3], lineas: ls, monto: p.args[3] === 'COMPLETO' ? soloDigitos(p.args[5]) : ls.reduce((a, l) => a + soloDigitos(l.monto), 0),
            estado: 'PENDIENTE', sinEnviar: true, motivo: p.args[6] || '' });
        }
        if (p.fn === 'borrarAnulacion') data = data.filter(x => x.id !== p.args[0]);
      });
    } else if (fn === 'listarDevoluciones') {
      ps.forEach(p => { if (p.fn === 'guardarDevolucion' && p.args[0] === args[1]) { const o = p.args[1], pr = (S.cat.productos || []).find(x => String(x.codigo) === String(o.codigo)) || {};
        data.push(Object.assign({}, o, { id: 'pend_' + p.op, fecha: p.args[0], cantidad: Number(o.cantidad) || 0, monto: soloDigitos(o.monto) || Math.round((Number(o.cantidad) || 0) * (Number(pr.precio) || 0)), producto: pr.nombre || o.codigo, unidad: pr.unidad || 'UN', adjuntos: [], sinEnviar: true })); } });
    } else if (fn === 'porCobrar' && data.clientes) {
      ps.filter(p => p.fn === 'guardarCobro').forEach(p => p.args[3].forEach(it => data.clientes.forEach(c => c.facturas.forEach(f => { if (f.folio_key === it.folio_key) { const q = Math.min(f.saldo, soloDigitos(it.monto)); f.saldo -= q; c.deuda -= q; } }))));
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
    case 'guardarDevolucion': return 'Devolución (' + String(a[1].tipo || '').toLowerCase() + ')';
    case 'saveDespacho': return 'Despacho de ' + a[1];
    case 'adelantarFolio': return 'Folio adelantado ' + a[2] + ' · ' + clp(soloDigitos(a[3]));
    case 'borrarAdelanto': return 'Quitar un folio adelantado';
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
/* Precalentamiento: el servidor de Google se "duerme" si nadie lo usa y el primer pedido tarda varios segundos.
   Se le avisa apenas se abre la app (mientras la persona escribe su clave), al volver a ella y cada 4 minutos mientras está abierta. */
let ultimoCalor = 0;
function calentar() {
  if (!EN_LINEA || document.hidden || Date.now() - ultimoCalor < 90e3) return;
  ultimoCalor = Date.now();
  try { fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'ping', args: [] }) }).catch(() => {}); } catch (e) {}
}
calentar();
setInterval(calentar, 240e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { calentar(); if (pendActivos().length) sincronizar(); else if (!EN_LINEA) llamar('ping', []).catch(() => {}); } });
setInterval(() => { if (!S.sess) return; if (pendActivos().length) sincronizar(); else if (!EN_LINEA) llamar('ping', []).catch(() => {}); }, 20000);
/* ---------- refresco automático (v107) ----------
   Cada 15 s, con la app a la vista, se vuelve a pedir (UNA sola llamada) lo que muestra la pantalla actual. Si algo cambió porque otra
   persona registró algo, la pantalla se redibuja sola. No lo hace mientras alguien escribe, con una ventana abierta, con cambios sin enviar o en Importar. */
let AUTO_BUSY = false, ULTIMO_USO = Date.now();
['pointerdown', 'keydown', 'wheel', 'touchmove'].forEach(ev => window.addEventListener(ev, () => { ULTIMO_USO = Date.now(); }, { passive: true, capture: true }));
/** Redibuja la pantalla actual sin que la persona pierda dónde estaba: mantiene el alto (la página no se achica y no salta arriba),
    devuelve el scroll a donde estaba y vuelve a abrir los desplegables que tenía abiertos. */
function redibujarQuieto() {
  const main = $('#main'), y = window.scrollY, h = main.offsetHeight;
  const abiertos = $$('details[open]', main).map(d => (($('summary', d) || {}).textContent || '').trim()).filter(Boolean);
  main.style.minHeight = h + 'px';
  ir(S.tab, true);
  const volver = () => {
    $$('details:not([open])', main).forEach(d => { if (abiertos.indexOf((($('summary', d) || {}).textContent || '').trim()) >= 0) d.open = true; });
    if (Date.now() - ULTIMO_USO > 700 && Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
  };
  [0, 150, 400, 900, 1800].forEach(t => setTimeout(volver, t));
  setTimeout(() => { main.style.minHeight = ''; }, 2200);
}
async function refrescoAuto() {
  if (AUTO_BUSY || !S.sess || document.hidden || !EN_LINEA || S.tocado || Date.now() - ULTIMO_USO < 5000 || $('.ov') || S.impPendiente || sincronizando || pendActivos().length) return;
  const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  if (S.tab === 'importar' || !S.leidas || !S.leidas.size) return;
  const vista = S.vistaId, items = [...S.leidas.values()].filter(x => x[0] !== 'catalogo' && CACHE.has(claveApi(x[0], x[1])));
  if (!items.length) return;
  AUTO_BUSY = true;
  try {
    const antes = items.map(x => JSON.stringify(CACHE.get(claveApi(x[0], x[1])).d));
    await pedirLote(items);
    const cambio = items.some((x, i) => { const e = CACHE.get(claveApi(x[0], x[1])); return e && JSON.stringify(e.d) !== antes[i]; });
    if (cambio && vista === S.vistaId && !S.tocado && !$('.ov') && !pendActivos().length) redibujarQuieto();
  } catch (e) { /* sin red o servidor viejo: se intenta en el próximo ciclo */ }
  finally { AUTO_BUSY = false; }
}
setInterval(refrescoAuto, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(refrescoAuto, 600); });
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
    if (t === 'COBRANZA') { lista.push(['porCobrar', [tok]]); lista.push(['listarClientes', [tok]]); }
    const x = q[t] || (/^[A-Z]+$/.test(t) ? ['listarMov', [tok, t, F]] : null);
    if (!x) return;
    const e = CACHE.get(claveApi(x[0], x[1]));
    if (e && !e.viejo && Date.now() - e.t < FRESCURA * 3) return;          // ya está reciente
    lista.push(x);
  });
  if (lista.length && !PRECARGANDO) { PRECARGANDO = true; pedirLote(lista).catch(() => {}).finally(() => { PRECARGANDO = false; }); }
}
let PRECARGANDO = false;

/* ---------- tamaño de letra (v80) ---------- */
// Toda la interfaz está en píxeles, por eso el tamaño se cambia con zoom. En tablets arranca en "Grande" (se ve de más lejos y al aire libre).
const LETRAS = [['Normal', 1], ['Grande', 1.15], ['Muy grande', 1.3]];
const letraIdx = () => { let v = null; try { v = localStorage.getItem('rn_letra'); } catch (e) {}
  if (v !== null && LETRAS[Number(v)]) return Number(v);
  const tablet = Math.min(screen.width, screen.height) >= 600 && matchMedia('(pointer:coarse)').matches; return tablet ? 1 : 0; };
function aplicarLetra() { document.documentElement.style.zoom = LETRAS[letraIdx()][1] === 1 ? '' : String(LETRAS[letraIdx()][1]); const b = $('#letra'); if (b) b.title = 'Tamaño de letra: ' + LETRAS[letraIdx()][0]; const t = $('#letraT'); if (t) t.textContent = LETRAS[letraIdx()][0]; }
function cambiarLetra() { const i = (letraIdx() + 1) % LETRAS.length; try { localStorage.setItem('rn_letra', String(i)); } catch (e) {} aplicarLetra(); toast('Letra: ' + LETRAS[i][0]); }
try { aplicarLetra(); } catch (e) {}

/* ---------- estado ---------- */
const S = { sess: null, cat: null, fecha: null, tab: null, vend: '', filtro: 'pend', vistaId: 0, tocado: false, silencio: false };
const hoyCL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
try { S.sess = JSON.parse(localStorage.getItem('rn_sess') || 'null'); } catch (e) {}

const TABS = {
  VENDEDOR: [['hoy', 'Hoy', 'home'], ['folios', 'Mis folios', 'list'], ['COBRANZA', 'Cobranza', 'cash'], ['depositos', 'Depósitos', 'bank'], ['GASTOS', 'Gastos', 'receipt']],
  BODEGA: [['despacho', 'Despacho', 'box'], ['devoluciones', 'Devoluciones', 'undo'], ['inventario', 'Inventario', 'stack']],
  RENDICION: [['resumen', 'Resumen del día', 'home'], ['efectivo', 'Conteo de efectivo', 'cash'], ['importar', 'Importar Mi DTE', 'upload'], ['folios', 'Detallar ventas', 'list'],
    ['despacho', 'Despacho y kilos', 'box'], ['devoluciones', 'Devoluciones', 'undo'], ['inventario', 'Inventario', 'stack'],
    ['COBRANZA', 'Cobrar a clientes', 'cash'], ['saldos', 'Saldos de clientes', 'users'], ['cheques', 'Cheques en cartera', 'doc'], ['notascred', 'Notas de crédito', 'undo'],
    ['depositos', 'Depósitos', 'bank'], ['GASTOS', 'Gastos', 'receipt'], ['cajachica', 'Caja chica', 'cash'], ['PROVEEDORES', 'Proveedores', 'store'], ['CONSUMO', 'Consumo', 'box'], ['historial', 'Historial', 'chart']]
};
TABS.SUPERVISOR = TABS.RENDICION.slice(0, 1).concat([['descuentos', 'Por autorizar', 'percent']], TABS.RENDICION.slice(1));
TABS.ADMIN = TABS.SUPERVISOR.concat([['datos', 'Indicadores de gestión', 'chart'], ['precios', 'Precios', 'receipt'], ['usuarios', 'Usuarios', 'users']]);
TABS.SUPERVISOR = TABS.SUPERVISOR.concat([['precios', 'Precios', 'receipt']]);
TABS.GERENCIA = [['datos', 'Indicadores de gestión', 'chart'], ['resumen', 'Resumen del día', 'home'], ['saldos', 'Saldos de clientes', 'users'], ['cheques', 'Cheques en cartera', 'doc'], ['notascred', 'Notas de crédito', 'undo'], ['inventario', 'Inventario', 'stack'], ['historial', 'Historial', 'chart']];   // solo lectura
// En oficina, las pantallas se agrupan por tarea (barra lateral en computador, barra inferior en el celular)
const GRUPOS = [['g-hoy', 'Hoy', ['resumen', 'efectivo', 'descuentos'], 'home'], ['g-ventas', 'Ventas', ['importar', 'folios'], 'upload'],
  ['g-bodega', 'Bodega', ['despacho', 'devoluciones', 'inventario'], 'box'], ['g-cobro', 'Cobranza', ['COBRANZA', 'saldos', 'cheques', 'notascred'], 'cash'],
  ['g-caja', 'Caja', ['depositos', 'GASTOS', 'cajachica', 'PROVEEDORES', 'CONSUMO'], 'bank'], ['g-mas', 'Más', ['datos', 'historial', 'precios', 'usuarios'], 'dots']];
const grupoDe = t => GRUPOS.find(g => g[2].indexOf(t) >= 0);

/* ===== VER COMO (solo ADMIN): saltar entre usuarios para ver cómo ven la app los demás ===== */
try { S_ADMIN = JSON.parse(localStorage.getItem('rn_admin') || 'null'); } catch (e) { S_ADMIN = null; }
var S_ADMIN;
const ROL_TXT = { ADMIN: 'Administración', SUPERVISOR: 'Supervisión', RENDICION: 'Encargada de rendición', GERENCIA: 'Gerencia', VENDEDOR: 'Vendedores', BODEGA: 'Bodega' };
function montarProbar() {
  const v = $('#probar'); if (v) v.remove();
  if (!S.sess || !(S_ADMIN || S.sess.rol === 'ADMIN')) return;
  const b = document.createElement('button'); b.id = 'probar'; b.type = 'button';
  b.innerHTML = S_ADMIN ? `<small>Viendo como</small><b>${esc(S.sess.nombre.split(' ')[0])} · ${esc(S.sess.rol)}</b>` : '<small>Administración</small><b>Ver como…</b>';
  b.onclick = abrirProbar; document.body.appendChild(b);
}
async function abrirProbar() {
  const adm = S_ADMIN || S.sess, ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Ver como"><div class="grip"></div><div class="body">
    <h3 style="margin-top:0">Ver como…</h3><p class="muted">Entras como esa persona para ver su pantalla, sin pedir su clave. Lo que registres queda a su nombre. Para volver, elige tu usuario.</p>
    <div id="pul"><div class="sk" style="height:46px"></div></div></div><div class="foot"><button class="btn ghost grow" id="pcx">Cerrar</button></div></div>`;
  document.body.appendChild(ov);
  $('#pcx', ov).onclick = () => cerrarHoja(ov); ov.onclick = e => { if (e.target === ov) cerrarHoja(ov); };
  let us; try { us = await api('listarUsuariosAdmin', adm.token); } catch (e) { cerrarHoja(ov); return; }
  const orden = ['ADMIN', 'SUPERVISOR', 'RENDICION', 'GERENCIA', 'VENDEDOR', 'BODEGA'];
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
    toast('Ahora ves la app como ' + S.sess.nombre + ' (' + S.sess.rol + ')');
  } catch (e) { /* api ya mostró el motivo */ }
}


function salir(expirada) {
  if (!expirada && pendActivos().length && !confirm('Tienes ' + pendActivos().length + ' cambio(s) guardados en el teléfono que aún no se envían. Si sales, se enviarán cuando vuelvas a ingresar con tu usuario. ¿Salir igual?')) return;
  if (!expirada && S.sess) api('logout', S.sess.token).catch(() => {});
  if (S_ADMIN) { if (!expirada) api('logout', S_ADMIN.token).catch(() => {}); S_ADMIN = null; }
  LOCAL.clear();
  const pb = $('#probar'); if (pb) pb.remove();
  S.sess = null; S.cat = null; S.tab = null; S.fecha = '';
  olvidarCache(false);
  try { localStorage.removeItem('rn_sess'); localStorage.removeItem('rn_admin'); if (!expirada) localStorage.removeItem('rn_fecha'); } catch (e) {}
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
    <input id="lid" class="in" autocomplete="off" name="rn-id" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="12.345.678-5" value="${esc(ult)}">
    <label class="f" for="lpw" style="margin-top:12px">Clave</label>
    <div class="row" style="gap:8px"><input id="lpw" class="in grow pw" type="text" name="rn-clave" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Tu clave">
      <button type="button" class="btn ghost sm" id="lver" aria-label="Mostrar u ocultar la clave">Ver</button></div>
    <button class="btn cu block" style="margin-top:14px" id="go">Ingresar</button>
    <p class="muted" style="margin-top:14px">Si olvidaste tu clave o es tu primera vez, pide a la administración que te dé una clave temporal.</p></div>`);
  $('#lver').onclick = () => { const p = $('#lpw'); p.classList.toggle('ver'); $('#lver').textContent = p.classList.contains('ver') ? 'Ocultar' : 'Ver'; };
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
    <label class="f" for="np1">Clave nueva (mínimo 4 caracteres)</label><input id="np1" class="in pw" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
    <label class="f" for="np2" style="margin-top:12px">Repite la clave</label><input id="np2" class="in pw" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
    <button class="btn cu block" style="margin-top:14px" id="npg">Guardar y entrar</button>
    <button class="btn ghost block" style="margin-top:8px" id="npc">Cancelar</button></div>`);
  $('#npc').onclick = () => pantallaLogin();
  const go = async () => {
    const a = $('#np1').value, b = $('#np2').value;
    if (a.length < 4) return toast('La clave debe tener al menos 4 caracteres.', true);
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
    <label class="f" for="mc0">Clave actual</label><input id="mc0" class="in pw" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
    <label class="f" for="mc1" style="margin-top:10px">Clave nueva (mínimo 4 caracteres)</label><input id="mc1" class="in pw" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
    <label class="f" for="mc2" style="margin-top:10px">Repite la clave nueva</label><input id="mc2" class="in pw" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"></div>
    <div class="foot"><button class="btn ghost" id="mcx">Cancelar</button><span class="grow"></span><button class="btn cu" id="mcg">Guardar</button></div></div>`;
  document.body.appendChild(ov);
  $('#mcx', ov).onclick = () => cerrarHoja(ov);
  $('#mcg', ov).onclick = async () => {
    const a = $('#mc0', ov).value, b = $('#mc1', ov).value, c = $('#mc2', ov).value;
    if (!a) return toast('Escribe tu clave actual.', true);
    if (b.length < 4) return toast('La clave nueva debe tener al menos 4 caracteres.', true);
    if (b !== c) return toast('Las claves nuevas no son iguales.', true);
    await api('cambiarMiClave', S.sess.token, a, b); toast('Clave cambiada'); cerrarHoja(ov);
  };
  $('#mc0', ov).focus();
}


/* ---------- cambiar de día (v100) ---------- */
function pintarDia() {
  const f = S.fecha, hoy = hoyCL(), dt = $('#dtxt'), p = $('#dpill'), inp = $('#fecha');
  if (inp) inp.value = f;
  const corta = new Date(f + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[,.]/g, '');
  if (dt) dt.textContent = f === hoy ? 'Hoy · ' + corta : corta;      // v112: siempre se ve qué día es
  if (p) p.classList.toggle('otro', f !== hoy);
  guardarFecha();
}
/** v112: el día que se está mirando se recuerda (por usuario) para que recargar la app no vuelva a hoy. */
function guardarFecha() {
  try { if (!S.sess) return; if (S.fecha === hoyCL()) localStorage.removeItem('rn_fecha'); else localStorage.setItem('rn_fecha', JSON.stringify({ u: S.sess.usuario, f: S.fecha })); } catch (e) {}
}
function fechaGuardada() {
  try { const o = JSON.parse(localStorage.getItem('rn_fecha') || 'null'); if (o && S.sess && o.u === S.sess.usuario && /^\d{4}-\d{2}-\d{2}$/.test(o.f) && o.f < hoyCL()) return o.f; } catch (e) {}
  return '';
}
function abrirFecha(cambiar) {
  const ya = $('#fpop'); if (ya) { ya.remove(); return; }
  const hoy = hoyCL(), pill = $('#dpill'), pop = document.createElement('div'); pop.id = 'fpop'; pop.className = 'fpop';
  let mes = S.fecha.slice(0, 7);          // mes que muestra el calendario (AAAA-MM)
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const cerrar = () => { pop.remove(); document.removeEventListener('click', fuera, true); document.removeEventListener('keydown', tecla); };
  const fuera = e => { if (!pop.contains(e.target) && !pill.contains(e.target)) cerrar(); };
  const tecla = e => { if (e.key === 'Escape') cerrar(); };
  const elegir = f => { cerrar(); if (f !== S.fecha) cambiar(f); };
  const pinta = () => {
    const [A, M] = mes.split('-').map(Number), pri = new Date(A, M - 1, 1), ini = (pri.getDay() + 6) % 7, dias = new Date(A, M, 0).getDate();
    const sig = new Date(A, M, 1), hayMasAdelante = sig.toISOString().slice(0, 7) <= hoy.slice(0, 7) && `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, '0')}` <= hoy.slice(0, 7);
    let celdas = ''; for (let i = 0; i < ini; i++) celdas += '<i></i>';
    for (let d = 1; d <= dias; d++) {
      const f = `${A}-${String(M).padStart(2, '0')}-${String(d).padStart(2, '0')}`, fut = f > hoy;
      celdas += `<button type="button" class="fd ${f === S.fecha ? 'on' : ''} ${f === hoy ? 'hoy' : ''}" data-f="${f}" ${fut ? 'disabled' : ''}>${d}</button>`;
    }
    pop.innerHTML = `<div class="fm"><button type="button" data-m="-1" aria-label="Mes anterior">‹</button><b>${MESES[M - 1]} ${A}</b><button type="button" data-m="1" aria-label="Mes siguiente" ${hayMasAdelante ? '' : 'disabled'}>›</button></div>
      <div class="fs"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="fg">${celdas}</div>`;
  };
  pop.onclick = e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.f) return elegir(b.dataset.f);
    if (b.dataset.m) { const d = new Date(+mes.slice(0, 4), +mes.slice(5) - 1 + Number(b.dataset.m), 1); mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; pinta(); }
  };
  pinta(); (pill.closest('.dwrap') || pill.parentNode).appendChild(pop);
  setTimeout(() => { document.addEventListener('click', fuera, true); document.addEventListener('keydown', tecla); }, 0);
}

/* ---------- estructura ---------- */
async function iniciar() {
  const app = $('#app');
  app.innerHTML = `<main>${skeleton(4)}</main>`;
  S.cat = await api('catalogo', S.sess.token);
  S.fecha = S.fecha || fechaGuardada() || hoyCL();
  const tabs = tabsRol();
  S.tab = S.tab && tabs.some(t => t[0] === S.tab) ? S.tab : tabs[0][0];
  const unica = tabs.length === 1;          // una sola pantalla, sin menú
  const abajo = !unica && (S.sess.rol === 'VENDEDOR' || S.sess.rol === 'BODEGA' || tabs.length <= 4);
  const grupos = !unica && !abajo ? GRUPOS.map(g => [g[0], g[1], g[2].filter(t => tabs.some(x => x[0] === t)), g[3]]).filter(g => g[2].length) : null;
  S.grupos = grupos; S.ultimoDeGrupo = S.ultimoDeGrupo || {};
  document.body.classList.toggle('solo-leer', S.sess.rol === 'GERENCIA');
  document.body.classList.toggle('has-bottom', abajo || !!grupos);
  document.body.classList.toggle('oficina', !!grupos);
  const txtDia = f => f === hoyCL() ? 'Hoy' : new Date(f + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[,.]/g, '');
  // v100: el día se cambia tocando la píldora (abre una hoja con Hoy / Ayer / Anteayer / otra fecha); ya no hay flechas de día en día
  const dia = `<div class="dwrap"><button type="button" class="dpill" id="dpill" aria-label="Cambiar el día que estás viendo">${icon('cal')}<span id="dtxt">${txtDia(S.fecha)}</span><i class="dcar" aria-hidden="true"></i></button><input type="date" id="fecha" value="${S.fecha}" hidden></div>`;
  const diaC = dia;
  const cuenta = `<button class="icon-btn" id="refr" aria-label="Actualizar la información">${icon('refresh')}<span>Actualizar</span></button><button class="icon-btn" id="mclv" aria-label="Cambiar mi clave">${icon('key')}<span>Clave</span></button><button class="icon-btn" id="letra" aria-label="Tamaño de letra"><b style="font-size:17px;line-height:1">Aa</b><span id="letraT"></span></button><button class="icon-btn" id="out" aria-label="Salir">${icon('out')}<span>Salir</span></button>`;
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
        ${diaC}<button class="icon-btn only" id="refr" aria-label="Actualizar la información">${icon('refresh')}</button><button class="icon-btn only" id="menub" aria-label="Menú" aria-haspopup="true" aria-expanded="false">${icon('dots')}</button></div>
      <div class="menu" id="menu" hidden><button id="letra"><b style="font-size:17px;width:22px;display:inline-block">Aa</b>Tamaño de letra: <span id="letraT"></span></button><button id="mclv">${icon('key')}Cambiar mi clave</button><button id="out">${icon('out')}Salir</button></div>
      <div id="redbar" class="redbar" role="status" hidden></div>
      <div class="progress" aria-hidden="true"><i id="prog"></i></div>
      <div class="otrodia" id="otrodia" hidden><span></span><button type="button" id="hoyBtn">Volver a hoy</button></div>
    </header>
    <main id="main"></main>
    ${abajo ? `<nav class="bottom" id="nav">${tabs.map(t => `<button data-t="${t[0]}">${icon(t[2])}${t[1]}</button>`).join('')}</nav>` : ''}`;
  }
  $('#refr').onclick = () => actualizarTodo();
  $('#letra').onclick = cambiarLetra; aplicarLetra();
  $('#out').onclick = () => salir(); $('#mclv').onclick = abrirMiClave; $('#redbar').onclick = () => abrirPendientes(); pintarRed();
  let tFecha = 0;
  const cambiarFecha = f => {       // la fecha y la pantalla cambian juntas: al instante se ve "cargando" y las respuestas del día anterior se descartan
    S.fecha = f; pintarDia();
    S.vistaId++; const mm = $('#main'); mm.onclick = null; mm.replaceChildren(); const sk = document.createElement('div'); sk.className = 'vm'; sk.innerHTML = skeleton(4); mm.appendChild(sk);
    const od = $('#otrodia'); if (od) { od.hidden = f === hoyCL(); if (f !== hoyCL()) $('span', od).innerHTML = `Estás viendo <b>${fechaLarga(f)}</b>`; }
    clearTimeout(tFecha); tFecha = setTimeout(() => ir(S.tab), 200);
  };
  const mb = $('#menub');
  if (mb) {
    mb.onclick = e => { e.stopPropagation(); const mn = $('#menu'); mn.hidden = !mn.hidden; mb.setAttribute('aria-expanded', String(!mn.hidden)); };
    if (!window._menuCierra) { window._menuCierra = true; document.addEventListener('click', () => { const mn = $('#menu'); if (mn) { mn.hidden = true; const b = $('#menub'); if (b) b.setAttribute('aria-expanded', 'false'); } }); }
  }
  $('#dpill').onclick = () => abrirFecha(cambiarFecha); pintarDia();
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
  else setTimeout(() => cargarXLSX(true).catch(() => {}), 3000);       // oficina: el lector de Excel queda listo antes de importar (si no, la primera importación espera su descarga)
}
/** Botón "Actualizar": envía lo pendiente, olvida lo guardado en el teléfono y vuelve a pedir todo al servidor (por ejemplo, tras importar de Mi DTE). */
async function actualizarTodo() {
  const b = $('#refr');
  if (b) { if (b.classList.contains('girando')) return; b.classList.add('girando'); b.disabled = true; }
  try {
    if (!EN_LINEA) {                          // no se rinde al tiro: hace el intento de conectarse (puede que el aviso de red esté atrasado)
      toast('Conectando…');
      let fallo = null; await Promise.all([llamar('ping', []).catch(x => { fallo = x; }), new Promise(r => setTimeout(r, 900))]); if (fallo) throw fallo;
    }
    if (pendActivos().length) await sincronizar();
    olvidarCache(true);
    S.cat = await api('catalogo', S.sess.token);
    ir(S.tab);
    toast('Información actualizada');
  } catch (e) { toast(e && e.red ? 'Todavía no hay conexión. Se intentará de nuevo solo cuando vuelva.' : 'No se pudo actualizar. Revisa tu conexión.', true); }
  finally { if (b) { b.classList.remove('girando'); b.disabled = false; } }
}
function ir(t, silencioso) {
  // Importación a medias (subió un informe y falta el otro): no se pierde sin avisar
  if (S.impPendiente && S.tab === 'importar') {
    if (silencioso) return;
    if (!confirm('Tienes archivos subidos que todavía no se importan (falta el otro informe o falta presionar Importar). Si sales, se pierden. ¿Salir igual?')) return;
    S.impPendiente = false;
  }
  S.tab = t;
  const tabs = tabsRol();
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
  const main = $('#main');
  if (silencioso && main.firstElementChild && main.firstElementChild.classList.contains('sale')) return;      // está saliendo la pantalla anterior: la nueva ya viene
  main.onclick = null;
  const id = ++S.vistaId; S.tocado = false;
  if (!silencioso || !S.leidas) S.leidas = new Map();
  const y = window.scrollY;
  // dirección de la transición: al ir a una pestaña de la derecha el contenido entra desde la derecha, y al revés
  const ni = tabs.findIndex(x => x[0] === t), pi = S.idxAnt === undefined ? ni : S.idxAnt;
  const dir = silencioso || ni === pi || ni < 0 || pi < 0 ? '' : ni > pi ? 'r' : 'l';
  if (!silencioso && ni >= 0) S.idxAnt = ni;
  let m = main.firstElementChild;          // cada carga tiene su propio contenedor: si llega tarde, no pisa la pantalla nueva
  const nuevo = !silencioso || !m || !m.classList.contains('vm');
  const salir = nuevo && m && m.classList.contains('vm') && m._tab !== t && !m.querySelector('.sk');
  const v = { hoy: vHoy, folios: vFolios, despacho: vDespacho, resumen: vResumen, importar: vImportar, depositos: vDepositos, inventario: vInventario, saldos: vSaldos, cheques: vCheques, notascred: vNotasCredito, cajachica: vCajaChica, usuarios: vUsuarios, precios: vPrecios, datos: vDatos, devoluciones: vDevoluciones, efectivo: vEfectivo, historial: vHistorial, descuentos: vDescuentos }[t] || vMov;
  const arrancar = () => {
    if (id !== S.vistaId) return;           // la persona ya fue a otra parte durante la salida
    if (nuevo) { m = document.createElement('div'); m.className = 'vm'; main.replaceChildren(m); m.innerHTML = skeleton(4); if (!silencioso) window.scrollTo({ top: 0, behavior: 'instant' }); }
    m._vid = id; m._tab = t; if (dir) m.dataset.dir = dir; else delete m.dataset.dir;
    S.silencio = !!silencioso;
    corre();
  };
  const corre = () => {
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
    }, 250);
  });  };
  if (salir && !(window.matchMedia && matchMedia('(min-width:900px)').matches)) { m.classList.add('sale'); setTimeout(arrancar, 60); } else arrancar();
}
const progreso = p => { const i = $('#prog'); if (i) i.style.width = Math.round(p * 100) + '%'; };
const opcVend = (sel, todos) => (todos ? '<option value="">Todos los vendedores</option>' : '') +
  S.cat.vendedores.map(v => `<option value="${esc(v.usuario)}" ${v.usuario === sel ? 'selected' : ''}>${esc(v.nombre)}</option>`).join('');

/* ============ HOY (inicio del vendedor): qué hacer y cómo va el día ============ */
async function vHoy(m) {
  const tok = S.sess.token, F = S.fecha, pri = (S.sess.nombre || '').split(' ')[0];
  const [r, cob, gas, ads, devs] = await Promise.all([api('misDocumentos', tok, F, S.vend), api('listarMov', tok, 'COBRANZA', F), api('listarMov', tok, 'GASTOS', F), api('listarAdelantos', tok, F, S.sess.usuario).catch(() => []), api('listarDevoluciones', tok, F).catch(() => [])]);
  const nAd = ads.length, aplAd = ads.filter(x => x.estado === 'APLICADO').length;
  const docs = r.docs, cerrada = r.estadoDia === 'CERRADA', hechos = docs.filter(d => d.estado === 'DETALLADO'), pend = docs.length - hechos.length;
  const por = fs => hechos.reduce((a, d) => a + d.pagos.filter(p => fs.indexOf(p.forma) >= 0).reduce((b, p) => b + p.monto, 0), 0);
  const tot = docs.reduce((a, d) => a + d.total, 0), ef = por(['EFECTIVO']), tr = por(['TRANSFERENCIA', 'DEP_EFECTIVO']), ch = por(['CHEQUE']), cr = por(['CREDITO']);
  const sumaM = xs => xs.reduce((a, x) => a + (Number(x.monto) || 0), 0), pl = (n, a, b) => n + ' ' + (n === 1 ? a : b);
  const p = docs.length ? hechos.length / docs.length : 0;
  const dep = vendDeposita();
  const gb = (n, cls) => n ? `<span class="bd ${cls || ''}">${n}</span>` : '';
  const tiles = [
    ['folios', 'receipt', 'Mis folios', !docs.length ? '' : pend ? `<span class="bd">${pend}</span>` : '<span class="bd ok">Listo</span>'],
    ['COBRANZA', 'cash', 'Cobranza', gb(cob.length, 'ok')],
    ['GASTOS', 'fuel', 'Gastos', gb(gas.length, 'ok')]];
  if (dep) tiles.push(['depositos', 'bank', 'Depósito', '']);
  const devSin = devs.filter(x => !x.cliente).length;
  if (devs.length) tiles.push(['devs', 'box', 'Devoluciones', devSin ? `<span class="bd">${devSin} sin cliente</span>` : '<span class="bd ok">Listo</span>']);
  render(m, `<h2>Hola, ${esc(pri)}</h2>
    ${cerrada ? '<div class="alert">La rendición de este día está cerrada. Solo lectura.</div>' : ''}
    <button class="bigbtn" id="hanota" ${cerrada ? 'disabled' : ''}>${icon('plus')}<span class="grow"><b>Anotar folio</b><small>${nAd ? pl(nAd, 'anotado', 'anotados') + ' hoy' : 'Funciona sin internet'}</small></span><i class="go" aria-hidden="true">›</i></button>
    <div class="htiles${tiles.length % 2 ? ' odd' : ''}">${tiles.map(x => `<button class="htile" data-t="${x[0]}">${x[3]}${icon(x[1])}<b>${x[2]}</b><i class="go" aria-hidden="true">›</i></button>`).join('')}</div>
    ${hechos.length ? `<div class="hvend"><span>Vendido hoy</span><b>${clp(tot)}</b></div>
      <details class="mas"><summary>Ver desglose</summary><div class="kpis"><div><span>Efectivo</span><b>${clp(ef)}</b></div>
      <div><span>Transferencias</span><b>${clp(tr)}</b></div>${ch ? `<div><span>Cheques</span><b>${clp(ch)}</b></div>` : ''}<div><span>A crédito</span><b>${clp(cr)}</b></div></div></details>` : ''}`);
  m.onclick = e => {
    if (e.target.closest('#hanota')) return abrirAdelanto(S.sess.usuario, () => { olvidarCache(false); ir(S.tab, true); });
    const b = e.target.closest('.htile'); if (b && b.dataset.t === 'devs') return abrirDevolucionesVendedor(() => { olvidarCache(false); ir(S.tab, true); });
    if (b) ir(b.dataset.t);
  };
}

/* ============ FOLIOS ============ */
/** Hoja para anotar folios por adelantado (tipo, N°, monto y cómo pagó: una forma o varias). Funciona sin conexión: queda en el teléfono y se envía sola. */
const FORMAS_AD = [['EFECTIVO', 'Efectivo'], ['TRANSFERENCIA', 'Transferencia'], ['CREDITO', 'Crédito'], ['CHEQUE', 'Cheque']];
function abrirAdelanto(vend, alCerrar) {
  let tipo = 'Boleta', lineas = [{ forma: '', banco: '', monto: '', ch: {} }];
  try { tipo = localStorage.getItem('rn_adl_tipo') || tipo; } catch (e) {}
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Anotar folio"><div class="grip"></div><div class="body">
    <div style="font-weight:700;font-size:19px">Anotar un folio</div>
    <p class="muted" style="margin:2px 0 10px">Cuando el folio llegue de Mi DTE, queda detallado solo si el monto calza. Sirve también sin internet.</p>
    <div class="seg" id="adT"><button type="button" data-t="Boleta">Boleta</button><button type="button" data-t="Factura">Factura</button></div>
    <div class="grid g2" style="margin-top:10px"><label class="f" style="margin:0">N° de folio<input class="in n" id="adF" inputmode="numeric" autocomplete="off"></label>
      <label class="f" style="margin:0">Monto total $<input class="in n" id="adM" inputmode="numeric" autocomplete="off"></label></div>
    <div class="muted" style="margin-top:10px;font-weight:700">¿Cómo pagó?</div>
    <div id="adPg"></div>
    <button type="button" class="ghostlink" id="adMas" style="display:block;margin-top:6px;background:none;border:0;padding:4px 0;color:var(--cu-2);font-weight:600;cursor:pointer">+ Pago mixto (agregar otra forma de pago)</button>
    <div id="adL" style="margin-top:12px"></div></div>
    <div class="foot"><button class="btn ghost" id="adX" type="button">Listo</button><span class="grow"></span><button class="btn cu" id="adS" type="button">Guardar y anotar otro</button></div></div>`;
  document.body.appendChild(ov);
  let cambios = false;
  const cerrar = () => { cerrarHoja(ov); if (cambios && alCerrar) alCerrar(); };
  $('#adX', ov).onclick = cerrar; ov.onclick = e => { if (e.target === ov) cerrar(); };
  const total = () => Number($('#adM', ov).value.replace(/\D/g, '')) || 0;
  const resto = () => { const e = $('#adRest', ov); if (!e) return; const r = total() - lineas.reduce((a, l) => a + (Number(String(l.monto).replace(/\D/g, '')) || 0), 0);
    e.textContent = !total() ? 'Escribe primero el monto total.' : r === 0 ? 'Cuadra ✓' : r > 0 ? 'Faltan ' + clp(r) : 'Sobran ' + clp(-r); e.className = 'muted ' + (r === 0 && total() ? 'okt' : ''); };
  function pintarPagos() {
    const n = lineas.length;
    $('#adPg', ov).innerHTML = lineas.map((l, i) => `<div class="adln" data-i="${i}">
      ${n > 1 ? `<div class="row" style="margin:6px 0 2px"><b>Pago ${i + 1}</b><span class="grow"></span><button type="button" class="btn ghost sm" data-q>Quitar</button></div>` : ''}
      <div class="seg wrap" data-fs>${FORMAS_AD.map(([f, nm]) => `<button type="button" data-f="${f}" class="${l.forma === f ? 'on' : ''}">${nm}</button>`).join('')}</div>
      ${l.forma === 'TRANSFERENCIA' ? `<div class="seg" data-bs style="margin-top:8px">${['BICE', 'ESTADO', 'SANTANDER'].map(b => `<button type="button" data-b="${b}" class="${l.banco === b ? 'on' : ''}">${b.charAt(0) + b.slice(1).toLowerCase()}</button>`).join('')}</div>` : ''}
      ${l.forma === 'CHEQUE' ? camposCheque(l.ch, 'ad' + i) : ''}
      ${n > 1 ? `<label class="f" style="margin:8px 0 0">Monto de este pago $<input class="in n" data-m inputmode="numeric" value="${esc(l.monto)}"></label>` : ''}</div>`).join('') + (n > 1 ? '<div id="adRest"></div>' : '');
    $$('.cheque', ov).forEach(avisoTipoCheque); resto();
    $('#adMas', ov).hidden = n >= 4;
  }
  $('#adPg', ov).onclick = e => { const bx = e.target.closest('.adln'); if (!bx) return; const l = lineas[Number(bx.dataset.i)];
    const f = e.target.closest('[data-f]'), b = e.target.closest('[data-b]');
    if (e.target.closest('[data-q]')) { lineas.splice(Number(bx.dataset.i), 1); pintarPagos(); }
    else if (f) { l.forma = f.dataset.f; if (l.forma !== 'TRANSFERENCIA') l.banco = ''; pintarPagos(); }
    else if (b) { l.banco = b.dataset.b; pintarPagos(); } };
  $('#adPg', ov).addEventListener('input', e => { const bx = e.target.closest('.adln'); if (!bx) return; const l = lineas[Number(bx.dataset.i)];
    if (e.target.matches('[data-m]')) { l.monto = e.target.value.replace(/\D/g, ''); resto(); }
    else if (e.target.dataset.c) l.ch[e.target.dataset.c] = e.target.value; });
  $('#adPg', ov).addEventListener('change', e => { const bx = e.target.closest('.adln'); if (bx && e.target.dataset.c) lineas[Number(bx.dataset.i)].ch[e.target.dataset.c] = e.target.value; });
  $('#adM', ov).addEventListener('input', resto);
  $('#adMas', ov).onclick = () => { if (lineas.length === 1) { const t = total(); if (t && !lineas[0].monto) lineas[0].monto = String(t); } lineas.push({ forma: '', banco: '', monto: '', ch: {} }); pintarPagos(); };
  $('#adT', ov).onclick = e => { const b = e.target.closest('button'); if (b) { tipo = b.dataset.t; try { localStorage.setItem('rn_adl_tipo', tipo); } catch (x) {} $$('#adT button', ov).forEach(y => y.classList.toggle('on', y.dataset.t === tipo)); } };
  const FTXT = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', CREDITO: 'Crédito', CHEQUE: 'Cheque', MIXTO: 'Pago mixto' };
  const ESTADO = { ESPERANDO: ['Esperando Mi DTE', 'a'], APLICADO: ['Detallado ✓', 'ok'], REVISAR: ['Revisar', 'bad'] };
  const hh = t => { const m = String(t || '').match(/(\d{2}:\d{2})/); return m ? m[1] : ''; };
  async function lista() {
    let ls = []; try { ls = await api('listarAdelantos', S.sess.token, S.fecha, vend); } catch (e) {}
    const n = { A: 0, E: 0, R: 0 }; ls.forEach(x => { if (!x.sinEnviar) n[x.estado === 'APLICADO' ? 'A' : x.estado === 'REVISAR' ? 'R' : 'E']++; });
    const sinE = ls.filter(x => x.sinEnviar).length;
    const cab = ls.length ? `<div class="muted" style="font-weight:700;margin-bottom:4px">Anotados hoy: ${ls.length} · <span class="ok">${n.A} detallados</span>${n.E ? ' · ' + n.E + ' esperando Mi DTE' : ''}${n.R ? ' · <span class="bad">' + n.R + ' para revisar</span>' : ''}${sinE ? ' · ' + sinE + ' sin enviar' : ''}</div>
      ${n.E || n.R ? '<button class="btn ghost sm" id="adRe" type="button" style="margin-bottom:6px">Volver a cruzar con Mi DTE</button>' : ''}` : '';
    $('#adL', ov).innerHTML = cab + ls.map(x => { const [t, c] = x.sinEnviar ? ['Guardado en el teléfono · se envía al volver internet', 'b'] : (ESTADO[x.estado] || [x.estado, '']);
      const pasos = x.sinEnviar ? '' : `<div class="muted" style="font-size:.85em">① Anotado${hh(x.anotado) ? ' ' + hh(x.anotado) : ''} · ${x.llego ? '② Llegó en Mi DTE' + (x.docCliente ? ' (' + esc(x.docCliente) + ', ' + clp(x.docTotal) + ')' : '') : '② Aún no llega de Mi DTE'} · ${x.estado === 'APLICADO' ? '③ Detallado ✓' + (hh(x.resuelto) ? ' ' + hh(x.resuelto) : '') : x.estado === 'REVISAR' ? '③ No se pudo detallar' : '③ Pendiente'}</div>`;
      return `<div class="dfila" style="align-items:center;flex-wrap:wrap" data-id="${esc(x.id)}">
      <span class="grow"><b>${esc(x.tipo)} ${esc(x.folio)}</b> · ${clp(x.monto)} · ${esc(FTXT[x.forma] || x.forma)}${x.forma === 'TRANSFERENCIA' && x.banco ? ' ' + esc(x.banco) : ''}
      <div class="dvst ${c}">${t}</div>${pasos}${x.nota ? `<div class="muted">${esc(x.nota)}</div>` : ''}${x.estado === 'REVISAR' && x.llego && x.docTotal > x.monto && x.docEstado !== 'DETALLADO' && /^Anotaste/.test(x.nota || '') ? `<button class="btn sm" data-nc type="button" style="margin-top:6px">Registrar ${clp(x.docTotal - x.monto)} como nota de crédito</button>` : ''}</span>${x.estado === 'APLICADO' ? '' : '<button class="btn ghost sm" data-del type="button">Quitar</button>'}</div>`; }).join('');
  }
  $('#adL', ov).onclick = async e => { const re = e.target.closest('#adRe'); if (re) { re.disabled = true; try { const r = await api('reintentarAdelantos', S.sess.token); cambios = true; toast(r.aplicados ? r.aplicados + ' folio' + (r.aplicados > 1 ? 's' : '') + ' detallado' + (r.aplicados > 1 ? 's' : '') : 'Nada nuevo para cruzar.'); await lista(); } catch (x) { toast(x.message || 'No se pudo', true); } finally { re.disabled = false; } return; }
    const nc = e.target.closest('[data-nc]'); if (nc) { nc.disabled = true; try { const r = await api('aplicarAdelantoConNC', S.sess.token, nc.closest('.dfila').dataset.id); cambios = true; toast('Listo: ' + clp(r.diferencia) + ' quedó como nota de crédito por emitir.'); await lista(); } catch (x) { toast(x.message || 'No se pudo', true); nc.disabled = false; } return; }
    const b = e.target.closest('[data-del]'); if (!b) return; const id = b.closest('.dfila').dataset.id; b.disabled = true;
    try { await api('borrarAdelanto', S.sess.token, id); cambios = true; await lista(); } finally { b.disabled = false; } };
  $('#adS', ov).onclick = async () => {
    const f = $('#adF', ov).value.trim(), m = total();
    if (!f) return toast('Escribe el N° de folio.', true);
    if (!m) return toast('Escribe el monto.', true);
    const pagos = [];
    for (let i = 0; i < lineas.length; i++) { const l = lineas[i];
      if (!l.forma) return toast(lineas.length > 1 ? 'Elige la forma del pago ' + (i + 1) + '.' : 'Elige cómo pagó.', true);
      if (l.forma === 'TRANSFERENCIA' && !l.banco) return toast('Elige el banco de la transferencia.', true);
      const monto = lineas.length === 1 ? m : Number(String(l.monto).replace(/\D/g, '')) || 0;
      if (!monto) return toast('Falta el monto del pago ' + (i + 1) + '.', true);
      let p = { forma: l.forma, banco: l.banco, monto };
      if (l.forma === 'CHEQUE') { const r = leerCheque($('[data-cheque=ad' + i + ']', ov)); if (r.error) return toast(r.error, true); p = Object.assign(p, r.datos); }
      pagos.push(p); }
    if (pagos.reduce((a, p) => a + p.monto, 0) !== m) return toast('Los pagos no suman el monto del folio (' + clp(m) + ').', true);
    const b = $('#adS', ov); b.disabled = true;
    try {
      const r = await api('adelantarFolio', S.sess.token, S.fecha, tipo, f, String(m), pagos, vend); cambios = true;
      toast(r._pendiente ? 'Guardado en el teléfono. Se envía solo cuando vuelva internet.' : r.estado === 'APLICADO' ? 'Folio ' + f + ' detallado' : r.estado === 'REVISAR' ? r.nota : 'Anotado. Se detalla solo cuando llegue de Mi DTE.', r.estado === 'REVISAR');
      $('#adF', ov).value = ''; $('#adM', ov).value = ''; lineas = [{ forma: '', banco: '', monto: '', ch: {} }]; pintarPagos(); await lista(); $('#adF', ov).focus();
    } finally { b.disabled = false; }
  };
  $$('#adT button', ov).forEach(y => y.classList.toggle('on', y.dataset.t === tipo));
  pintarPagos(); lista(); setTimeout(() => $('#adF', ov).focus(), 250);
}
/* ============ ANULAR FOLIO / NOTA DE CRÉDITO (v72) ============ */
const MOTIVOS_AN = ['Error en un producto', 'Cobré de más', 'El cliente devolvió producto', 'Documento mal emitido', 'Otro'];
function abrirAnulacion(vend, docs, alCerrar) {
  let tipo = 'Factura', modo = 'COMPLETO', lineas = [{ codigo: '', cantidad: '', monto: '' }], vuelve = false;
  try { tipo = localStorage.getItem('rn_adl_tipo') || tipo; } catch (e) {}
  const prods = (S.cat.productos || []).filter(p => p.codigo !== '' && p.codigo != null).slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Anular folio"><div class="grip"></div><div class="body">
    <div style="font-weight:700;font-size:19px">Anular folio o nota de crédito</div>
    <p class="muted" style="margin:2px 0 10px">Supervisión lo aprueba. Una vez aprobado, ese monto ya no lo rindes y los kilos se descuentan de lo facturado. Funciona también sin internet.</p>
    <div class="seg" id="anT"><button type="button" data-t="Boleta">Boleta</button><button type="button" data-t="Factura">Factura</button></div>
    <label class="f" style="margin:10px 0 0">N° del folio que se anula<input class="in n" id="anF" inputmode="numeric" autocomplete="off"></label>
    <div id="anI" class="muted" style="margin:4px 0 0;min-height:20px"></div>
    <div class="muted" style="margin-top:10px;font-weight:700">¿Qué se anula?</div>
    <div class="seg" id="anM"><button type="button" data-m="COMPLETO">Folio completo</button><button type="button" data-m="PARCIAL">Por partes</button></div>
    <div id="anC"></div>
    <label class="f" style="margin:12px 0 0">Motivo<select class="in" id="anMo"><option value="">Elige…</option>${MOTIVOS_AN.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
    <label class="f" style="margin:10px 0 0">N° del folio nuevo que lo reemplaza (si lo hay)<input class="in n" id="anR" inputmode="numeric" autocomplete="off"></label>
    <div class="muted" style="margin-top:10px;font-weight:700">¿El producto volvió a la bodega?</div>
    <div class="seg" id="anV"><button type="button" data-v="0">No (va en otra factura)</button><button type="button" data-v="1">Sí, volvió</button></div>
    <div id="anL" style="margin-top:14px"></div></div>
    <div class="foot"><button class="btn ghost" id="anX" type="button">Listo</button><span class="grow"></span><button class="btn cu" id="anS" type="button">Enviar para aprobar</button></div></div>`;
  document.body.appendChild(ov);
  let cambios = false;
  const cerrar = () => { cerrarHoja(ov); if (cambios && alCerrar) alCerrar(); };
  $('#anX', ov).onclick = cerrar; ov.onclick = e => { if (e.target === ov) cerrar(); };
  const keyDoc = () => { const f = $('#anF', ov).value.replace(/\D/g, '').replace(/^0+/, ''); return (docs || []).find(d => String(d.folio).replace(/^0+/, '') === f && (tipo === 'Boleta') === /bol/i.test(d.tipo)); };
  function info() {
    const d = keyDoc(), e = $('#anI', ov);
    e.innerHTML = d ? `${esc(d.cliente)} · <b>${clp(d.total)}</b>` : ($('#anF', ov).value ? 'Aún no llega de Mi DTE: escribe el monto total.' : '');
    pintarC();
  }
  function pintarC() {
    const d = keyDoc(), c = $('#anC', ov);
    if (modo === 'COMPLETO') { c.innerHTML = d ? `<p class="muted" style="margin:8px 0 0">Se anula todo el folio por <b>${clp(d.total)}</b>.</p>`
      : `<label class="f" style="margin:8px 0 0">Monto total del folio $<input class="in n" id="anTot" inputmode="numeric" autocomplete="off"></label>`; return; }
    c.innerHTML = lineas.map((l, i) => { const p = prods.find(x => String(x.codigo) === String(l.codigo)); return `<div class="adln" data-i="${i}">
      <div class="row" style="margin:8px 0 2px"><b>Producto ${i + 1}</b><span class="grow"></span>${lineas.length > 1 ? '<button type="button" class="btn ghost sm" data-q>Quitar</button>' : ''}</div>
      <select class="in" data-k="codigo" aria-label="Producto"><option value="">Elige el producto…</option>${prods.map(x => `<option value="${esc(x.codigo)}" ${String(x.codigo) === String(l.codigo) ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>
      <div class="grid g2" style="margin-top:6px"><label class="f" style="margin:0">${p && p.unidad === 'UN' ? 'Unidades' : 'Kilos'}<input class="in n" data-k="cantidad" inputmode="decimal" value="${esc(l.cantidad)}"></label>
        <label class="f" style="margin:0">Monto $<input class="in n" data-k="monto" inputmode="numeric" value="${esc(l.monto)}"></label></div></div>`; }).join('')
      + `<button type="button" class="ghostlink" id="anMas" style="display:block;margin-top:6px;background:none;border:0;padding:4px 0;color:var(--cu-2);font-weight:600;cursor:pointer">+ Agregar otro producto</button>
      <div class="muted" id="anSum" style="margin-top:4px"></div>`;
    sum();
  }
  function sum() { const e = $('#anSum', ov); if (!e) return; const t = lineas.reduce((a, l) => a + (Number(String(l.monto).replace(/\D/g, '')) || 0), 0), d = keyDoc();
    e.textContent = 'Total a anular: ' + clp(t) + (d && t > d.total ? ' · supera el total del folio' : ''); }
  $('#anC', ov).addEventListener('input', e => { const b = e.target.closest('.adln'); if (!b) return; const l = lineas[Number(b.dataset.i)], k = e.target.dataset.k; if (!k) return;
    l[k] = k === 'monto' ? e.target.value.replace(/\D/g, '') : e.target.value; sum(); });
  $('#anC', ov).addEventListener('change', e => { if (e.target.dataset.k === 'codigo') { const b = e.target.closest('.adln'); lineas[Number(b.dataset.i)].codigo = e.target.value; pintarC(); } });
  $('#anC', ov).onclick = e => { const b = e.target.closest('.adln'); if (e.target.closest('[data-q]') && b) { lineas.splice(Number(b.dataset.i), 1); pintarC(); }
    if (e.target.closest('#anMas')) { lineas.push({ codigo: '', cantidad: '', monto: '' }); pintarC(); } };
  $('#anF', ov).addEventListener('input', info);
  $('#anT', ov).onclick = e => { const b = e.target.closest('button'); if (b) { tipo = b.dataset.t; $$('#anT button', ov).forEach(y => y.classList.toggle('on', y.dataset.t === tipo)); info(); } };
  $('#anM', ov).onclick = e => { const b = e.target.closest('button'); if (b) { modo = b.dataset.m; $$('#anM button', ov).forEach(y => y.classList.toggle('on', y.dataset.m === modo)); pintarC(); } };
  $('#anV', ov).onclick = e => { const b = e.target.closest('button'); if (b) { vuelve = b.dataset.v === '1'; $$('#anV button', ov).forEach(y => y.classList.toggle('on', (y.dataset.v === '1') === vuelve)); } };
  const ESTADO = { PENDIENTE: ['Por aprobar', 'a'], APROBADA: ['Aprobada ✓', 'ok'], RECHAZADA: ['Rechazada', 'bad'] };
  async function lista() {
    let ls = []; try { ls = await api('listarAnulaciones', S.sess.token, S.fecha, vend); } catch (e) {}
    $('#anL', ov).innerHTML = ls.length ? `<div class="muted" style="font-weight:700;margin-bottom:4px">Del día</div>` + ls.map(x => { const [t, c] = x.sinEnviar ? ['Guardado en el teléfono · se envía al volver internet', 'b'] : (ESTADO[x.estado] || [x.estado, '']);
      return `<div class="dfila" style="align-items:center;flex-wrap:wrap" data-id="${esc(x.id)}"><span class="grow"><b>${esc(x.tipo)} ${esc(x.folio)}</b> · ${clp(x.monto)} · ${x.modo === 'COMPLETO' ? 'completo' : 'por partes'}
        ${(x.lineas || []).length ? `<div class="muted">${x.lineas.map(l => esc(l.producto || (prods.find(p => String(p.codigo) === String(l.codigo)) || {}).nombre || l.codigo) + ' ' + nk(l.cantidad)).join(' · ')}</div>` : ''}
        <div class="dvst ${c}">${t}</div>${x.nota ? `<div class="muted">${esc(x.nota)}</div>` : ''}</span>${x.estado === 'PENDIENTE' ? '<button class="btn ghost sm" data-del type="button">Quitar</button>' : ''}</div>`; }).join('') : '';
  }
  $('#anL', ov).onclick = async e => { const b = e.target.closest('[data-del]'); if (!b) return; b.disabled = true;
    try { await api('borrarAnulacion', S.sess.token, b.closest('.dfila').dataset.id); cambios = true; olvidarCache(false); await lista(); } finally { b.disabled = false; } };
  $('#anS', ov).onclick = async () => {
    const f = $('#anF', ov).value.trim(), d = keyDoc(); if (!f) return toast('Escribe el N° del folio.', true);
    const motivo = $('#anMo', ov).value; if (!motivo) return toast('Elige el motivo.', true);
    let ls = [], monto = '';
    if (modo === 'COMPLETO') { monto = d ? String(d.total) : ($('#anTot', ov) ? $('#anTot', ov).value.replace(/\D/g, '') : ''); if (!soloDigitos(monto)) return toast('Escribe el monto total del folio.', true); }
    else { for (let i = 0; i < lineas.length; i++) { const l = lineas[i], p = prods.find(x => String(x.codigo) === String(l.codigo));
        if (!p) return toast('Elige el producto ' + (i + 1) + '.', true);
        const c = Number(String(l.cantidad).replace(',', '.')) || 0; if (!(c > 0)) return toast('Falta ' + (p.unidad === 'UN' ? 'las unidades' : 'los kilos') + ' de ' + p.nombre + '.', true);
        if (!soloDigitos(l.monto)) return toast('Falta el monto de ' + p.nombre + '.', true);
        ls.push({ codigo: String(p.codigo), producto: p.nombre, unidad: p.unidad === 'UN' ? 'UN' : 'KG', cantidad: c, monto: soloDigitos(l.monto) }); }
      monto = String(ls.reduce((a, l) => a + l.monto, 0)); if (d && Number(monto) > d.total) return toast('Lo que anulas supera el total del folio (' + clp(d.total) + ').', true); }
    const b = $('#anS', ov); b.disabled = true;
    try {
      const r = await api('solicitarAnulacion', S.sess.token, S.fecha, tipo, f, modo, ls, monto, motivo, $('#anR', ov).value.trim(), vuelve, vend); cambios = true;
      toast(r._pendiente ? 'Guardado en el teléfono. Se envía solo cuando vuelva internet.' : 'Enviado a supervisión para que lo apruebe.');
      $('#anF', ov).value = ''; $('#anR', ov).value = ''; $('#anMo', ov).value = ''; lineas = [{ codigo: '', cantidad: '', monto: '' }]; olvidarCache(false); info(); await lista(); $('#anF', ov).focus();
    } finally { b.disabled = false; }
  };
  $$('#anT button', ov).forEach(y => y.classList.toggle('on', y.dataset.t === tipo)); $$('#anM button', ov).forEach(y => y.classList.toggle('on', y.dataset.m === modo)); $$('#anV button', ov).forEach(y => y.classList.toggle('on', y.dataset.v === '0'));
  info(); lista(); setTimeout(() => $('#anF', ov).focus(), 250);
}

async function vFolios(m) {
  const esV = S.sess.rol === 'VENDEDOR';
  let docs = [], estadoDia = '', q = '';
  const r = await api('misDocumentos', S.sess.token, S.fecha, S.vend);
  docs = r.docs; estadoDia = r.estadoDia;
  render(m, `<h2>${esV ? 'Mis folios' : 'Detallar ventas'}</h2>${esV ? '' : '<p class="lead">' + fechaLarga(S.fecha) + ' · Puedes detallar los folios de cualquier vendedor; quedará registrado que lo hiciste tú.</p>'}
    ${esV ? '' : `<div class="row" style="margin-bottom:6px"><select class="in" style="width:auto" id="fv">${opcVend(S.vend, true)}</select></div>`}
    <div class="meter" id="meter"><div class="bar"><i></i></div><b></b></div>
    <div id="adl"></div>
    <div id="acc"></div>
    <div class="row filtros"><div class="seg" id="seg"><button data-f="pend">Por detallar</button><button data-f="det">Detallados</button><button data-f="todos">Todos</button></div>
      ${docs.length > 8 || !esV ? `<div class="search grow" style="min-width:180px">${icon('search')}<input class="in" id="q" placeholder="Cliente o folio" type="search"></div>` : ''}</div>
    <div id="fl"></div>
    <div id="anl"></div>`);
  if (!esV) $('#fv').onchange = e => { S.vend = e.target.value; ir('folios'); };
  // Folios adelantados: el vendedor anota folio + monto + forma de pago antes de que llegue Mi DTE; la app cruza sola al importar
  const vAdl = esV ? S.sess.usuario : S.vend;
  async function pintarAdl() {
    if (esV || !vAdl || !document.body.contains(m)) { $('#adl', m).innerHTML = ''; return; }
    let ls = []; try { ls = await api('listarAdelantos', S.sess.token, S.fecha, vAdl); } catch (e) {}
    if (!document.body.contains(m)) return;
    const esp = ls.filter(x => x.estado === 'ESPERANDO').length, rev = ls.filter(x => x.estado === 'REVISAR').length, apl = ls.filter(x => x.estado === 'APLICADO').length;
    $('#adl', m).innerHTML = `<div class="card adl"><span class="ic">${icon('receipt')}</span><div class="grow"><b>Anotar folios por adelantado</b><div class="muted">${esp || rev || apl ? [ls.length + ' anotados', apl ? apl + ' detallados' : '', esp ? esp + ' esperando Mi DTE' : '', rev ? '<span class="bad">' + rev + ' para revisar</span>' : ''].filter(Boolean).join(' · ') : 'Anota el folio, el monto y cómo te pagó; se detalla solo cuando llegue de Mi DTE.'}</div></div>
      <button class="btn ${esp || rev ? 'ghost' : 'cu'} sm" id="adlb" type="button">Anotar folio</button></div>`;
    $('#adlb', m).onclick = () => abrirAdelanto(vAdl, () => { olvidarCache(false); ir('folios', true); });
  }
  pintarAdl();
  async function pintarAnl() {
    if (!vAdl || !document.body.contains(m)) { $('#anl', m).innerHTML = ''; return; }
    let ls = []; try { ls = await api('listarAnulaciones', S.sess.token, S.fecha, vAdl); } catch (e) {}
    if (!document.body.contains(m)) return;
    const pe = ls.filter(x => x.estado === 'PENDIENTE').length, ap = ls.filter(x => x.estado === 'APROBADA').length, re = ls.filter(x => x.estado === 'RECHAZADA').length;
    const partes = [pe ? pe + ' por aprobar' : '', ap ? ap + ' aprobada' + (ap > 1 ? 's' : '') : '', re ? '<span class="bad">' + re + ' rechazada' + (re > 1 ? 's' : '') + '</span>' : ''].filter(Boolean).join(' · ');
    $('#anl', m).innerHTML = `<div class="anlin"><button class="linkbtn" id="anlb" type="button">${pe || ap || re ? 'Anulaciones' : 'Anular un folio'}</button>${partes ? ' <span class="muted">· ' + partes + '</span>' : ''}</div>`;
    $('#anlb', m).onclick = () => abrirAnulacion(vAdl, docs, () => { olvidarCache(false); ir('folios', true); });
  }
  pintarAnl();
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
      ${pendientes > 1 ? (esV || S.vend ? '<button class="btn ghost sm" id="var">Marcar varios</button>'
        : '<button class="btn ghost sm" disabled title="Elige un vendedor arriba">Elige un vendedor para marcar varios</button>') : ''}</div>` : '';
    $('.bar i', mt).style.width = (p * 100) + '%';
    $('b', mt).textContent = docs.length ? `${hechos} de ${docs.length} detallados · ${clp(docs.reduce((a, d) => a + d.total, 0))}` : '';
    const el = $('#fl');
    if (!docs.length) { el.innerHTML = `<div class="empty"><b>Todavía no hay folios</b>Aparecen cuando se sube Mi DTE.</div>`; return; }
    let lista = docs.filter(d => S.filtro === 'todos' || (S.filtro === 'det') === (d.estado === 'DETALLADO'));
    if (q) lista = lista.filter(d => norm(d.cliente).includes(q) || String(d.folio).includes(q));
    lista.sort((a, b) => String(a.folio).localeCompare(String(b.folio), 'es', { numeric: true }));
    if (!lista.length) {
      el.innerHTML = S.filtro === 'pend' && !q ? `<div class="empty alert ok" style="border-style:solid"><b>Todo detallado ✓</b></div>`
        : `<div class="empty">Nada coincide con el filtro.</div>`;
      return;
    }
    el.innerHTML = lista.map(d => `<button class="folio ${d.estado === 'DETALLADO' ? 'd' : ''} ${d.folio_key === recienGuardado ? 'just' : ''}" data-k="${esc(d.folio_key)}">
      <div class="grow"><div class="c">${esc(d.cliente)}</div>
        <div class="muted">${esc(d.tipo.replace(' Electrónica', ''))} ${esc(d.folio)} · ${esc(d.condicion_dte)}${esV ? '' : ' · ' + esc(d.vendedor || 'sin vendedor')}</div>
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
  d.descuentos.forEach(x => h += x.nc ? `<span class="chip ok">${d.anulado ? 'Anulado' : 'Nota de crédito'} ${clp(x.monto)}</span>`
    : `<span class="chip ${x.estado === 'APROBADO' ? 'ok' : x.estado === 'RECHAZADO' ? 'bad' : 'warn'}">Desc. ${clp(x.monto)} ${x.estado.toLowerCase()}</span>`);
  (d.anulaciones || []).filter(x => x.estado === 'PENDIENTE').forEach(x => h += `<span class="chip warn">${x.modo === 'COMPLETO' ? 'Anulación' : 'Nota de crédito'} ${clp(x.monto)} por aprobar</span>`);
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
    $('#sal', ov).innerHTML = `<div class="saldo ${dif === 0 ? 'ok' : 'no'}"><span>${dif === 0 ? 'Cuadra con el documento' : dif > 0 ? 'Falta asignar' : 'Te pasaste por'}</span><span>${clp(Math.abs(dif))}</span></div>${dif > 0 && !cerrada && S.cat.formas.indexOf('NOTA_CREDITO') >= 0 ? '<button class="btn ghost sm" type="button" id="ncq" style="margin-top:6px">Dejar la diferencia como nota de crédito</button>' : ''}`;
    const nq = $('#ncq', ov); if (nq) nq.onclick = () => { lineas.push({ forma: 'NOTA_CREDITO', banco: '', monto: dif }); dibujar(); };
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
    <button type="button" class="link" id="mix">Pagó de dos formas, abonó una parte, hubo descuento o nota de crédito</button>
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
  LOCAL.set(kLocal(S.fecha, d.folio_key), lineas);
  procesarCola();
}
async function procesarCola() {
  if (colaCorriendo) return;
  colaCorriendo = true;
  while (COLA.length) {
    const x = COLA[0];
    try { await api('guardarDetalle', S.sess.token, x.fecha, x.d.folio_key, x.lineas, null, true); }      // `true`: el servidor responde corto (ya se ve el resultado en pantalla)
    catch (e) { LOCAL.delete(kLocal(x.fecha, x.d.folio_key)); x.alGuardar(x.d); toast(`No se pudo guardar el folio ${x.d.folio}. Quedó como "Por detallar".`, true); }
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
  render(m, `<h2>Devoluciones</h2><p class="lead">Producto que vuelve y no se puede vender. <b>Merma</b>: se descarta. <b>Reproceso</b>: vuelve a producción. El bodeguero las anota al recibir el retorno (botón en cada producto) y se descuentan de la rendición del vendedor ese día; el vendedor indica el cliente. El N° de la nota de crédito y el monto los puede completar la encargada después; la foto es opcional.</p>
    <div class="card" id="dvf">
      <div class="seg" id="dvt" style="width:100%;display:grid;grid-template-columns:1fr 1fr"><button type="button" data-t="MERMA" class="on">Merma</button><button type="button" data-t="REPROCESO">Reproceso</button></div>
      <div class="grid g3" style="margin-top:12px">
        <div><label class="f" for="dv_p">Producto</label><select class="in" id="dv_p"><option value="">Elige un producto…</option>${opcProd}</select></div>
        <div><label class="f" for="dv_c">Cantidad <span class="muted" id="dv_u"></span></label><input class="in n" id="dv_c" inputmode="decimal" placeholder="0"></div>
        <div><label class="f" for="dv_oc">N° nota de crédito <span class="muted">(opcional, lo agrega la encargada)</span></label><input class="in" id="dv_oc" inputmode="numeric" autocomplete="off"></div>
        <div><label class="f" for="dv_mt">Monto a descontar <span class="muted">(vacío = cantidad × precio de lista)</span></label><input class="in n" id="dv_mt" inputmode="numeric" placeholder="$0"></div>
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
        <div class="muted">${r.nota_credito ? 'NC N° <b>' + esc(r.nota_credito) + '</b>' : '<span style="color:#9a5b00">NC por hacer</span>'} · <b>${clp(r.monto)}</b>${r.motivo ? ' · ' + esc(r.motivo) : ''}${r.origen ? ' · viene de ' + esc((S.cat.vendedores.find(v => v.usuario === r.origen) || {}).nombre || r.origen) : ''}${r.cliente ? ' · ' + esc(r.cliente) : ''}${r.obs ? ' · ' + esc(r.obs) : ''}</div>
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
    const b = $('#dv_ad'); b.disabled = true;
    try {
      const nuevo = await api('guardarDevolucion', S.sess.token, S.fecha, o); toast(nuevo._pendiente ? 'Devolución guardada en el teléfono (sin conexión)' : 'Devolución registrada');
      const fs = [...$('#dvf_a').files];
      if (fs.length && nuevo._pendiente) toast('Sin conexión: la foto no se puede subir ahora. Cuando se envíe la devolución, usa "Adjuntar".', true);
      else if (fs.length) { try { await subirArchivos('DEVOLUCIONES', nuevo.id, fs); } catch (e) { toast('Quedó registrada, pero la foto no subió. Usa "Adjuntar" en la devolución.', true); } }
      ['#dv_c', '#dv_oc', '#dv_mt', '#dv_cl', '#dv_ob'].forEach(x => $(x).value = ''); sel.value = ''; sel.onchange(); $('#dvf_a').value = ''; $('#dvf_a').onchange();
      await recargar();
    } finally { libre(); }
  };
}

/* ============ DESPACHO Y RETORNO ============ */
const pluralDia = d => /s$/.test(d) ? d : d + 's';   // lunes, martes… no cambian; sábado → sábados
async function vDespacho(m) {
  if (!S.vend) S.vend = S.cat.vendedores[0] && S.cat.vendedores[0].usuario;
  const r = await api('getDespacho', S.sess.token, S.fecha, S.vend);
  const reg = {}; r.filas.forEach(f => reg[f.codigo] = f);
  const val = x => x === '' || x == null ? '' : x;
  // Además de los vendedores: venta en bodega, consumo y cada distribuidor (salida/retorno propios; el inventario los lleva a su columna)
  const dists = S.cat.distribuidores || ['PATRICIO', 'CESAR', 'JUAN CARLOS', 'AMIR', 'OSCAR', 'CHILOE'];
  const cap = t => t.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
  const extras = [];
  if (!S.cat.vendedores.some(v => v.usuario === 'SALA')) extras.push({ usuario: 'SALA', nombre: 'Venta en bodega', pseudo: 'sala' });
  extras.push({ usuario: 'CONSUMO', nombre: 'Consumo', pseudo: 'consumo' });
  const dv = dists.map(d => ({ usuario: 'DIST:' + d, nombre: 'Distribuidor ' + cap(d), pseudo: 'dist', corto: cap(d) }));
  const vends = S.cat.vendedores.concat(extras, dv), esDist = u => String(u).indexOf('DIST:') === 0;
  const idx = vends.findIndex(v => v.usuario === S.vend), sig = vends[idx + 1];
  const nomDe = u => ((vends.find(v => v.usuario === u) || {}).nombre) || u;
  const pseudo = (vends[idx] || {}).pseudo;
  const NOTA = { sala: 'Lo que se vende en la bodega (sin boleta de vendedor). Sale del inventario como consumo externo.', consumo: 'Lo que se consume en la fábrica o la bodega. Sale del inventario como consumo.',
    dist: 'Lo que retira este distribuidor (sale con boleta genérica). Si algo vuelve, anótalo como retorno.' };
  const card = v => `<button type="button" class="dvc ${v.usuario === S.vend ? 'on' : ''}" data-u="${esc(v.usuario)}"><b>${esc(v.nombre)}</b><span class="dvst" data-st="${esc(v.usuario)}"></span></button>`;
  if (!S.dmod) S.dmod = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'America/Santiago' }).format(new Date())) < 13 ? 'salida' : 'retorno';
  const cats = {};
  S.cat.productos.forEach(p => (cats[p.categoria || 'REVISAR'] = cats[p.categoria || 'REVISAR'] || []).push(p));
  const orden = Object.keys(cats).sort((a, b) => (Object.keys(CATS).indexOf(a) + 99) % 99 - (Object.keys(CATS).indexOf(b) + 99) % 99);
  const nin = (k, p, v) => { const w = k.replace('Un', ''), un = k !== w; return `<div class="nin" data-w="${w}"><input class="in n" data-k="${k}" inputmode="decimal" enterkeyhint="next" aria-label="${w === 'salida' ? 'Salida' : 'Retorno'}${un ? ' en unidades' : ' en kilos'} ${esc(p.nombre)}" placeholder="0" value="${val(v)}"></div>`; };
  // Productos que se pesan (kilos) pero el inventario cuenta por unidad: además de los kilos se anotan las unidades
  const conUn = p => p.unidad !== 'UN' && p.inv === 'UN';
  render(m, `<h2>Despacho y retorno</h2><p class="lead">${fechaLarga(S.fecha)}</p>
    <div class="dvs" id="dvs">${vends.filter(v => v.pseudo !== 'dist').map(card).join('')}<button type="button" class="dvc ${esDist(S.vend) ? 'on' : ''}" data-u="${esc(esDist(S.vend) ? S.vend : 'DIST:' + dists[0])}" data-grp="1"><b>Distribuidores</b><span class="dvst"></span></button></div>
    ${esDist(S.vend) ? `<div class="dvs dsub" id="dsub">${dv.map(v => `<button type="button" class="dvc ${v.usuario === S.vend ? 'on' : ''}" data-u="${esc(v.usuario)}"><b>${esc(v.corto)}</b><span class="dvst" data-st="${esc(v.usuario)}"></span></button>`).join('')}</div>` : ''}
    <div class="seg dseg" id="seg" role="tablist"><button type="button" data-m="salida"><b>Salida</b></button><button type="button" data-m="retorno"><b>Retorno</b></button></div>
    <p class="dvh" id="dvh"></p>${pseudo ? `<p class="muted dvn">${esc(NOTA[pseudo])}</p>` : ''}
    <div id="dvg"></div>
    <div id="sgc"></div>
    <div id="vac" class="vac" hidden></div>
    <div id="bdev" class="bdev" hidden></div>
    <div class="dth" id="dth"><span>Producto</span><span id="rfh"></span><span>Kilos</span><span>Unidades</span><span></span></div>
    <div id="dt" class="dt dm-${S.dmod}">${orden.map(c => cats[c].map((p, i) => { const f = reg[p.codigo] || {};
      return `${i === 0 ? `<div class="catl">${CATS[c] || esc(c)}</div>` : ''}<div class="pr oc" data-c="${esc(p.codigo)}" data-u="${esc(p.unidad)}" data-cat="${esc(c)}">
        <div class="pn">${esc(p.nombre)}${pseudo || r.retornoBloqueado ? '' : `<span class="dvq" data-dq="${esc(p.codigo)}"></span>`}</div><div class="rf"></div>
        <div class="cl kgc" data-col="Kilos">${p.unidad === 'UN' ? '<span class="na">—</span>' : nin('salida', p, f.salida) + nin('retorno', p, f.retorno)}</div>
        <div class="cl unc" data-col="Unidades">${p.unidad === 'UN' ? nin('salida', p, f.salida) + nin('retorno', p, f.retorno) : conUn(p) ? nin('salidaUn', p, f.salidaUn) + nin('retornoUn', p, f.retornoUn) : '<span class="na">—</span>'}</div>
        <div class="dvx">${pseudo || r.retornoBloqueado ? '' : `<button type="button" class="dvb" data-dc="${esc(p.codigo)}" data-tip="Devolución / merma" aria-label="Devolución o merma">${icon('box')}</button>`}</div>
        <div class="st"></div></div>`; }).join('')).join('')}</div>
    <button type="button" class="btn ghost sm" id="mas" hidden></button>
    <div class="sticky-foot"><div class="card dvf"><div class="dvfi"><div class="muted" id="fl"></div><b id="tv"></b></div>
      <div class="dvfb"><button class="btn cu" id="sv" type="button">Guardar</button></div></div></div>`);
  const filas = $$('.pr', m), dt = $('#dt', m);
  const inp = (el, k) => $('[data-k=' + k + ']', el), S0 = el => inp(el, 'salida').value, R0 = el => inp(el, 'retorno').value;
  const estado = (nS, nR) => !nS ? ['Sin salida', 'x'] : !nR ? ['Salida lista', 'a'] : nR < nS ? [`Retorno ${nR} de ${nS}`, 'b'] : ['Completo ✓', 'ok'];
  const guiaTiene = el => r.guias.some(g => g.lineas[el.dataset.c] !== undefined);
  let sucio = false;

  function pintarVend(u, nS, nR) { const e = $('[data-st="' + u + '"]', m); if (!e) return; const [t, c] = estado(nS, nR); e.textContent = t; e.className = 'dvst ' + c; }
  function aplicarVis() {
    const modo = S.dmod; let vis = 0;
    filas.forEach(el => {
      const s = S0(el), rt = R0(el), tieneS = s !== '' && dec(s) > 0;
      const rel = r.retornoBloqueado && modo === 'retorno' ? false : modo === 'salida' ? (s !== '' || rt !== '' || el.dataset.sg !== undefined || guiaTiene(el)) : (tieneS || rt !== '');
      el.classList.toggle('oc', !rel); if (rel) vis++;
    });
    const ocultos = filas.length - vis, mas = $('#mas', m), todos = dt.classList.contains('todos');
    mas.hidden = !ocultos && !todos; mas.textContent = todos ? 'Mostrar solo los productos del día' : `Agregar otro producto (${ocultos} más)`;
    const bloq = modo === 'retorno' && !!r.retornoBloqueado, sig = new Date(S.fecha + 'T12:00:00'); sig.setDate(sig.getDate() + 1);
    const vacio = modo === 'retorno' && !filas.some(el => { const s = S0(el); return s !== '' && dec(s) > 0; });
    const vac = $('#vac', m); vac.hidden = !(vacio || bloq) || (todos && !bloq);
    if (bloq) { mas.hidden = true; vac.hidden = false; vac.innerHTML = `<b>El retorno de ${esc(nomDe(S.vend))} se anota el ${sig.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}.</b><p>Este vendedor rinde con el día siguiente: hoy solo se anota la salida.</p><button type="button" class="btn cu sm" id="airs">Ir a la salida</button>`; } else
    vac.innerHTML = vacio ? `<b>${esc(nomDe(S.vend))} todavía no tiene salida anotada.</b><p>Para registrar un retorno primero hay que anotar lo que se llevó.</p><button type="button" class="btn cu sm" id="airs">Anotar la salida</button>` : '';
    const ai = $('#airs', m); if (ai) ai.onclick = () => poner('salida');
  }
  function poner(modo) {
    S.dmod = modo; dt.className = 'dt dm-' + modo + (dt.classList.contains('todos') ? ' todos' : '');
    { const bd = $('#bdev', m); if (bd) bd.hidden = !(modo === 'retorno' && !pseudo && !r.retornoBloqueado && !!S.vend); }
    $$('#seg button', m).forEach(b => b.classList.toggle('on', b.dataset.m === modo));
    $('#dvh', m).innerHTML = modo === 'salida' ? `Anota cuánto se lleva <b>${esc(nomDe(S.vend))}</b> hoy. Escribe el número y presiona Enter para pasar al siguiente.` : `Anota lo que <b>${esc(nomDe(S.vend))}</b> devuelve al volver. La columna "Salió" muestra lo que se llevó.`
      + ((r.vuelven || []).length && modo === 'retorno' ? `<br><span class="okt">Folios anulados con producto devuelto: ${r.vuelven.map(x => esc(x.producto) + ' ' + nk(x.cantidad) + (x.unidad === 'UN' ? ' un' : ' kg')).join(' · ')}. Inclúyelos en el retorno si ya llegaron.</span>` : '');
    $('#sgc', m).hidden = modo !== 'salida'; $('#dvg', m).hidden = modo !== 'salida';
    $('#rfh', m).textContent = modo === 'salida' ? 'Sugerido' : 'Salió';
    aplicarVis(); calc();
  }
  function calc() {
    let sal = 0, ret = 0, nS = 0, nR = 0, nSv = 0; 
    filas.forEach(el => {
      const c = el.dataset.c, s = S0(el), rt = R0(el), st = $('.st', el), esKg = el.dataset.u !== 'UN';
      const fac = r.facturado[c] || 0, vend = dec(s) - dec(rt); let h = '', rf = '';
      if (S.dmod === 'retorno') {
        const su = inp(el, 'salidaUn'), ru = inp(el, 'retornoUn');
        if (s !== '') rf = `<b>${esKg ? kg(dec(s)) + ' kg' : dec(s) + ' un'}${su && su.value !== '' ? ' · ' + dec(su.value) + ' un' : ''}</b>`;
        else if (su && su.value !== '') rf = `<b>${dec(su.value)} un</b>`;
        if (su && ru && ru.value !== '' && dec(ru.value) > dec(su.value)) h += `<span class="bad">Las unidades que vuelven son más de las que salieron</span>`;
        if (rt !== '' && dec(rt) > dec(s)) h += `<span class="bad">Es más de lo que salió</span>`;
        else if (r.hayDetalle && s !== '' && rt !== '') {
          const dif = Math.round((vend - fac) * 10) / 10;
          if (Math.abs(dif) > 0.2) h += `<span class="${dif > 0 ? 'warn' : 'bad'}">Vendido ${kg(vend)} · facturado ${kg(fac)} · diferencia <b>${dif > 0 ? '+' : ''}${kg(dif)}</b></span>`;
        }
      } else if (el.dataset.sg !== undefined) {
        rf = `<span class="sug"><b>${esc(el.dataset.sgt)}</b></span>`;
      }
      st.innerHTML = h; $('.rf', el).innerHTML = rf;
      const hecho = (S.dmod === 'salida' ? s : rt) !== ''; el.classList.toggle('ok', hecho);
      if (s !== '' && dec(s) > 0) nS++; if (rt !== '' && s !== '' && dec(s) > 0) nR++; if (hecho) nSv++;
      if (esKg) { sal += dec(s); ret += dec(rt); }
    });
    pintarVend(S.vend, nS, nR);
    $('#fl', m).textContent = S.dmod === 'salida' ? `${nS} productos con salida` : nS ? `Retorno anotado en ${nR} de ${nS} productos` : 'Sin salida anotada';
    $('#tv', m).textContent = S.dmod === 'salida' ? kg(sal) + ' kg saldrán' : nR ? kg(sal - ret) + ' kg vendidos' : '';
  }
  // eventos
  const cambiar = e => { const b = e.target.closest('.dvc'); if (!b || b.dataset.u === S.vend) return;
    if (sucio && !confirm('Hay cambios sin guardar. Si cambias de vendedor se pierden. ¿Cambiar igual?')) return;
    S.vend = b.dataset.u; ir('despacho'); };
  $('#dvs', m).onclick = cambiar; if ($('#dsub', m)) $('#dsub', m).onclick = cambiar;
  $('#seg', m).onclick = e => { const b = e.target.closest('button'); if (b) poner(b.dataset.m); };
  dt.oninput = () => { sucio = true; calc(); };
  dt.onclick = e => { const b = e.target.closest('.mn,.pl'); if (!b) return;
    const el = b.closest('.pr'), i = $('input', b.parentNode), paso = el.dataset.u === 'UN' || /Un$/.test(i.dataset.k) ? 1 : 0.5;
    const v = Math.max(0, Math.round((dec(i.value) + (b.classList.contains('pl') ? paso : -paso)) * 1000) / 1000);
    i.value = v === 0 && i.value === '' ? '' : String(v); sucio = true; calc(); };
  dt.addEventListener('focusin', e => { if (e.target.matches('input')) setTimeout(() => e.target.select && e.target.select(), 0); });
  dt.addEventListener('keydown', e => { if (e.key !== 'Enter' || !e.target.matches('input')) return; e.preventDefault();
    const ins = $$('.pr:not(.oc) .nin[data-w=' + S.dmod + '] input', dt), i = ins.indexOf(e.target); if (ins[i + 1]) ins[i + 1].focus(); else e.target.blur(); });
  $('#mas', m).onclick = () => { dt.classList.toggle('todos'); aplicarVis(); };
  // carga sugerida y guías (solo en Salida)
  $('#dvg', m).innerHTML = r.guias.map(g => `<button class="btn ghost sm" type="button" data-g="${esc(g.folio)}">Cargar salida desde la guía ${esc(g.folio)}</button>`).join('');
  $('#dvg', m).onclick = e => { const g = e.target.dataset.g; if (!g) return;
    const guia = r.guias.find(x => x.folio === g);
    filas.forEach(el => { const k = guia.lineas[el.dataset.c]; if (k !== undefined) inp(el, 'salida').value = Math.round(k * 1000) / 1000; });
    sucio = true; aplicarVis(); calc(); toast('Salida cargada desde la guía ' + g + '. Revisa y guarda.'); };
  if (S.vend && !pseudo) api('getSugerido', S.sess.token, S.fecha, S.vend).then(sg => {
    if (!document.body.contains(m) || $('#sgc', m) === null) return;
    const nom = nomDe(S.vend);
    if (sg.sinHistoria) return;
    filas.forEach(el => { const it = sg.items[el.dataset.c]; if (!it) return;
      el.dataset.sgt = it.kgUn ? `${it.un} un (≈ ${kg(it.kg)} kg)` : it.un ? `${it.un} un` : `${kg(it.kg)} kg`;
      el.dataset.sg = it.un && !it.kgUn ? it.un : it.kg; });
    aplicarVis(); calc();
  }).catch(() => {});
  // estado de cada vendedor (una sola llamada para todos)
  (async () => {
    try {
      await pedirLote(vends.map(v => ['getDespacho', [S.sess.token, S.fecha, v.usuario]]));
      for (const v of vends) { if (v.usuario === S.vend || (v.pseudo === 'dist' && !esDist(S.vend))) continue;
        const d = await api('getDespacho', S.sess.token, S.fecha, v.usuario); if (!document.body.contains(m)) return;
        const fl = d.filas.filter(f => f.salida !== '' && dec(f.salida) > 0); pintarVend(v.usuario, fl.length, fl.filter(f => f.retorno !== '').length); }
    } catch (e) {}
  })();
  const guardar = async sigue => {
    const datos = filas.map(el => { const su = inp(el, 'salidaUn'), ru = inp(el, 'retornoUn'), o = { codigo: el.dataset.c, salida: S0(el).replace(',', '.'), retorno: R0(el).replace(',', '.') };
      if (su) { o.salidaUn = su.value.replace(',', '.'); o.retornoUn = ru.value.replace(',', '.'); } return o; });
    await api('saveDespacho', S.sess.token, S.fecha, S.vend, datos); sucio = false;
    toast('Despacho de ' + nomDe(S.vend) + ' guardado');
  };
  $('#sv', m).onclick = () => guardar(false);
  dt.addEventListener('click', e => { const bd = e.target.closest('.dvb'); if (!bd) return;
    const prod = S.cat.productos.find(x => String(x.codigo) === bd.dataset.dc); if (!prod) return;
    abrirDevolucionBodega(prod, S.vend, nomDe(S.vend), () => { if (S.devRefrescar) S.devRefrescar(); }); });
  poner(S.dmod);
  if (S.vend && !pseudo && !r.retornoBloqueado) bloqueDev(m, S.vend, nomDe(S.vend));
}

/** Mermas y devoluciones que trajo el vendedor (v139): lista junto al retorno. Se registran con el botón «Devolución / merma» de cada producto. */
async function bloqueDev(m, vend, nombre) {
  const box = $('#bdev', m); if (!box) return;
  const fmt = (n, u) => u === 'UN' ? String(Math.round(n * 100) / 100).replace('.', ',') + ' un' : kg(n) + ' kg';
  box.innerHTML = `<div class="bdh"><b>Mermas y devoluciones de ${esc(nombre)}</b><span class="chip" id="bdn">0</span><span class="grow"></span><span class="muted" id="bdt"></span></div><div id="bdl"></div>`;
  function lista(rs) {
    rs = rs.filter(x => x.origen === vend);
    $('#bdn', box).textContent = rs.length; $('#bdn', box).className = 'chip' + (rs.length ? ' warn' : '');
    $('#bdt', box).textContent = rs.length ? 'Se descuenta de su rendición: ' + clp(rs.reduce((a, x) => a + (Number(x.monto) || 0), 0)) : '';
    $('#bdl', box).innerHTML = rs.length ? rs.map(x => `<div class="dev"><div class="row"><span class="grow"><span class="chip ${x.tipo === 'MERMA' ? 'bad' : 'warn'}">${x.tipo === 'MERMA' ? 'Merma' : 'Reproceso'}</span> <b>${esc(x.producto)}</b></span><b>${fmt(x.cantidad, x.unidad)}</b></div>
        <div class="muted">${clp(x.monto)}${x.motivo ? ' · ' + esc(x.motivo) : ''}${x.obs ? ' · ' + esc(x.obs) : ''} · ${x.cliente ? 'cliente: <b>' + esc(x.cliente) + '</b>' : '<span class="okt" style="color:#9a5b00">el vendedor aún no indica el cliente</span>'}</div>
        <div class="row" style="margin-top:6px"><span class="grow"></span><button class="x" style="min-height:34px;width:34px" data-id="${esc(x.id)}" aria-label="Borrar">×</button></div></div>`).join('')
      : `<div class="muted" style="padding:6px 0">${esc(nombre)} no ha traído mermas ni devoluciones hoy.</div>`;
    // marca en cada producto lo que ya se registró
    $$('[data-dq]', m).forEach(e => { const xs = rs.filter(x => String(x.codigo) === String(e.dataset.dq));
      e.textContent = xs.length ? '· ' + xs.map(x => `${fmt(x.cantidad, x.unidad)} ${x.tipo === 'MERMA' ? 'merma' : 'reproceso'}`).join(' · ') : ''; });
  }
  const recargar = async () => { const args = [S.sess.token, S.fecha]; lista(copia(await pedir('listarDevoluciones', args, claveApi('listarDevoluciones', args)))); };
  S.devRefrescar = recargar;
  try { lista(await api('listarDevoluciones', S.sess.token, S.fecha)); } catch (e) { $('#bdl', box).innerHTML = '<div class="muted">No se pudieron cargar las devoluciones.</div>'; }
  $('#bdl', box).addEventListener('click', async e => { const id = e.target.dataset && e.target.dataset.id; if (!id || !confirm('¿Borrar esta devolución?')) return;
    await api('borrarDevolucion', S.sess.token, id); await recargar(); });
}

/** Ventana del bodeguero para registrar una merma o un reproceso de un producto que trajo el vendedor. Solo cantidad y tipo; el valor lo calcula el servidor. */
function abrirDevolucionBodega(prod, vend, nombre, alGuardar) {
  let tipo = '';
  const esUn = prod.unidad === 'UN';
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Devolución o merma"><div class="grip"></div><div class="body">
    <div class="muted">Trajo ${esc(nombre)}</div>
    <div style="font-weight:700;font-size:19px;line-height:1.25;margin:2px 0 10px">${esc(prod.nombre)}</div>
    <div class="muted" style="font-weight:700;margin-bottom:6px">¿Qué es?</div>
    <div class="seg" id="dgT" style="width:100%;display:grid;grid-template-columns:1fr 1fr"><button type="button" data-t="MERMA">Merma<small style="display:block;font-weight:400">se descarta</small></button><button type="button" data-t="REPROCESO">Reproceso<small style="display:block;font-weight:400">vuelve a producción</small></button></div>
    <label class="f" for="dgC" style="margin-top:12px">Cantidad <span class="muted">(${esUn ? 'unidades' : 'kilos'})</span></label>
    <input class="in n" id="dgC" inputmode="decimal" autocomplete="off" placeholder="0">
    <label class="f" for="dgM" style="margin-top:10px">Motivo <span class="muted">(opcional)</span></label>
    <select class="in" id="dgM"><option value="">—</option>${MOTIVOS_DEV.map(x => `<option>${x}</option>`).join('')}</select>
    
    <div class="row" style="margin-top:14px;gap:8px"><button class="btn ghost" id="dgX" type="button">Cancelar</button><span class="grow"></span><button class="btn cu" id="dgOk" type="button">Registrar</button></div></div></div>`;
  document.body.appendChild(ov);
  const cerrar = () => cerrarHoja(ov);
  $('#dgX', ov).onclick = cerrar; ov.onclick = e => { if (e.target === ov) cerrar(); };
  $('#dgT', ov).onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; tipo = b.dataset.t; $$('#dgT button', ov).forEach(x => x.classList.toggle('on', x === b)); };
  setTimeout(() => $('#dgC', ov).focus(), 60);
  $('#dgOk', ov).onclick = async () => {
    const cant = parseFloat(String($('#dgC', ov).value).replace(',', '.')) || 0;
    if (!tipo) return toast('Elige si es merma o reproceso.', true);
    if (!(cant > 0)) return toast('Ingresa la cantidad.', true);
    const b = $('#dgOk', ov); b.disabled = true;
    try {
      const nuevo = await api('guardarDevolucion', S.sess.token, S.fecha, { tipo, codigo: prod.codigo, cantidad: String(cant), origen: vend, motivo: $('#dgM', ov).value });
      toast(nuevo._pendiente ? 'Guardada en el teléfono (sin conexión)' : (tipo === 'MERMA' ? 'Merma' : 'Reproceso') + ' registrado a nombre de ' + nombre);
      cerrar(); if (alGuardar) alGuardar();
    } catch (e) { b.disabled = false; throw e; }
  };
}

/** El vendedor ve sus devoluciones del día (las que anotó el bodeguero) e indica de qué cliente es cada una. */
function abrirDevolucionesVendedor(alCerrar) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Devoluciones de hoy"><div class="grip"></div><div class="body">
    <div style="font-weight:700;font-size:19px">Devoluciones de ${S.fecha === hoyCL() ? 'hoy' : 'este día'}</div>
    <p class="muted" style="margin:2px 0 10px">Indica de qué cliente es cada una para corregir su factura o boleta.</p><div id="dvvl"></div>
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn ghost" id="dvvX" type="button">Cerrar</button></div></div></div>`;
  document.body.appendChild(ov);
  const cerrar = () => { cerrarHoja(ov); if (alCerrar) alCerrar(); };
  $('#dvvX', ov).onclick = cerrar; ov.onclick = e => { if (e.target === ov) cerrar(); };
  const fmt = (n, u) => u === 'UN' ? String(Math.round(n * 100) / 100).replace('.', ',') + ' un' : kg(n) + ' kg';
  let clientes = null, rs = [];
  const pintar = () => {
    $('#dvvl', ov).innerHTML = rs.length ? rs.map(x => `<div class="dev" data-id="${esc(x.id)}"><div class="row"><span class="grow"><span class="chip ${x.tipo === 'MERMA' ? 'bad' : 'warn'}">${x.tipo === 'MERMA' ? 'Merma' : 'Reproceso'}</span> <b>${esc(x.producto)}</b></span><b>${fmt(x.cantidad, x.unidad)}</b></div>
      <div class="muted">${x.cliente ? 'Cliente: <b>' + esc(x.cliente) + '</b>' : 'Falta indicar el cliente'}</div>
      <div class="row" style="margin-top:6px"><span class="grow"></span><button class="btn ${x.cliente ? 'ghost' : 'cu'} sm" data-el="${esc(x.id)}" type="button">${x.cliente ? 'Cambiar cliente' : 'Elegir cliente'}</button></div></div>`).join('')
      : '<div class="empty">No hay devoluciones este día.</div>';
  };
  const elegir = id => {
    $('#dvvl', ov).innerHTML = `<div class="muted" style="margin-bottom:6px">Escribe el nombre o el RUT del cliente</div><input class="in" id="dvq" autocomplete="off" placeholder="Buscar cliente…"><div id="dvr" style="margin-top:8px"></div>
      <div class="row" style="margin-top:8px"><button class="btn ghost sm" id="dvback" type="button">‹ Volver</button></div>`;
    const q = $('#dvq', ov), res = $('#dvr', ov);
    const buscar = () => { const t = normBus(q.value); let xs = clientes || [];
      if (t) xs = xs.filter(c => normBus(c.nombre).includes(t) || normBus(c.rut).includes(t)); xs = xs.slice(0, 30);
      res.innerHTML = xs.map((c, i) => `<button type="button" class="cli" data-i="${i}" style="width:100%;text-align:left"><b>${esc(c.nombre)}</b>${c.rut ? `<small>${esc(c.rut)}</small>` : ''}</button>`).join('')
        + (q.value.trim() ? `<button type="button" class="cli" data-libre="1" style="width:100%;text-align:left"><b>Usar «${esc(q.value.trim().toUpperCase())}»</b><small>cliente que no está en la lista</small></button>` : '')
        || '<div class="muted">Escribe para buscar.</div>';
      res._xs = xs; };
    q.oninput = buscar; buscar(); q.focus();
    $('#dvback', ov).onclick = pintar;
    res.onclick = async e => { const b = e.target.closest('.cli'); if (!b) return;
      const c = b.dataset.libre ? { nombre: q.value.trim().toUpperCase(), rut: '' } : res._xs[Number(b.dataset.i)];
      if (String(id).indexOf('pend_') === 0) { toast('Esta devolución aún no se envía al servidor. Espera a tener internet y vuelve a abrir.'); return; }
      b.disabled = true;
      try { await api('asignarDevolucionCliente', S.sess.token, id, c.nombre, c.rut); const x = rs.find(z => z.id === id); if (x) { x.cliente = c.nombre; x.rut = c.rut; } toast('Cliente indicado'); olvidarCache(false); purgarListas(); pintar(); }
      catch (err) { b.disabled = false; cargar(); throw err; } };
  };
  $('#dvvl', ov).onclick = async e => { const b = e.target.closest('[data-el]'); if (!b) return;
    if (!clientes) { try { clientes = (await api('listarClientes', S.sess.token) || []).slice(); } catch (err) { clientes = []; } }
    elegir(b.dataset.el); };
  const cargar = async () => { try { const args = [S.sess.token, S.fecha]; rs = copia(await pedir('listarDevoluciones', args, claveApi('listarDevoluciones', args))); pintar(); } catch (e) { $('#dvvl', ov).innerHTML = '<div class="empty">No se pudieron cargar.</div>'; } };   // siempre lo último del servidor
  cargar();
}

/* ============ INVENTARIO DE BODEGA ============ */
async function vInventario(m) {
  let inv = await api('getInventario', S.sess.token, S.fecha);
  if (inv.nominaPendiente && S.sess.rol !== 'GERENCIA') {      // v149: la primera vez deja los productos como la nómina del bodeguero
    try { await api('aplicarNominaInventario', S.sess.token); olvidarCache(true); inv = await api('getInventario', S.sess.token, S.fecha); } catch (e) { /* si falla, se sigue con lo que hay */ }
  }
  S.secInv = S.secInv || 'TERMINADOS';
  if (!S.invM) S.invM = S.sess.rol === 'BODEGA' ? 'contar' : 'ver';       // el bodeguero abre en "Contar y anotar"; los demás, en "Ver stock"
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
      ${S.sess.rol === 'GERENCIA' ? '' : '<button class="btn ghost sm" id="edp">Editar planilla</button>'}<button class="btn ghost sm" id="plan">Planilla del día</button></div>
    <p class="muted" id="invh"></p>
    <div class="invtop"><div class="seg secs" id="sec">${inv.secciones.map(x => `<button data-s="${x.id}">${x.nombre}</button>`).join('')}</div>
      <div class="seg" id="invm"><button type="button" data-m="ver">Ver stock</button><button type="button" data-m="contar">Contar y anotar</button></div></div>
    <div class="invbar"><input class="in grow" id="invq" type="search" placeholder="Buscar producto…" value="${esc(S.invQ || '')}" autocomplete="off">
      <div class="seg" id="invf"><button type="button" data-f="todos">Todos</button><button type="button" data-f="mov">Con movimiento</button><button type="button" data-f="dif">Con diferencia</button></div></div>
    <div id="alertInv"></div><div id="lista" class="invl"></div>
    <div class="card" id="npc" style="margin-top:12px"><b>¿Falta un producto?</b><div class="row" style="margin-top:8px">
      <input class="in grow" id="npN" placeholder="Nombre, como en la planilla"><select class="in" id="npU" style="width:auto"><option>KG</option><option>UN</option></select>
      <button class="btn ghost sm" id="npA">Agregar a esta sección</button></div></div>
    <div id="lnkInv"></div>
    <div class="sticky-foot" id="invfoot"><div class="card"><div><div class="muted" id="cambios">Sin cambios</div></div><button class="btn cu" id="gi">Guardar</button></div></div>`);
  const lista = $('#lista');
  function pintar() {
    $$('#sec button').forEach(b => b.classList.toggle('on', b.dataset.s === S.secInv));
    const cam = S.secInv === 'CAMARA';
    const q = (S.invQ || '').trim().toLowerCase(), mov = S.invF === 'mov', dife = S.invF === 'dif', contar = S.invM === 'contar';
    $$('#invf button').forEach(x => x.classList.toggle('on', x.dataset.f === (mov ? 'mov' : dife ? 'dif' : 'todos')));
    $$('#invm button').forEach(x => x.classList.toggle('on', x.dataset.m === S.invM));
    $('#npc').hidden = !contar; $('#invfoot').hidden = !contar;
    $('#invh').textContent = contar ? 'Lo de los vendedores llega solo desde Despacho. Aquí anota lo que entra de fábrica, lo que sale a otros lados y lo que cuentas.' : 'Cuánto había al empezar el día, qué se movió y cuánto queda de cada producto.';
    if (S.sess.rol === 'GERENCIA') { $('#invm').hidden = true; S.invM = 'ver'; }
    const conMov = f => { const e = est[f.codigo]; return e.cambio || sum(f.salVend) + sum(f.retVend) + sum(e.desp) + sum(e.otras) > 0 || dec(e.ingreso) > 0 || e.conteo !== ''; };
    const conDif = f => { const c = calc(est[f.codigo]); return (est[f.codigo].conteo !== '' && Math.abs(c.ajuste) > 0.001) || c.final < -0.001; };
    const filas = inv.filas.filter(f => f.seccion === S.secInv && (!q || String(f.nombre).toLowerCase().indexOf(q) >= 0) && (!mov || conMov(f)) && (!dife || conDif(f)));
    const negativos = inv.filas.filter(f => calc(est[f.codigo]).final < -0.001);
    $('#alertInv').innerHTML = negativos.length ? `<div class="alert"><b>${negativos.length} producto(s) con stock negativo:</b> ${negativos.slice(0, 6).map(f => esc(f.nombre)).join(', ')}${negativos.length > 6 ? '…' : ''}. Revisa ingresos o registra un conteo.</div>` : '';
    const fqU = f => v => f.unidad === 'UN' ? nk(v) : kg(v);
    const difH = (e, c, fq) => e.conteo === '' ? '' : Math.abs(c.ajuste) < 0.001 ? '<span class="chip okc">calza</span>' : c.ajuste < 0 ? `<span class="chip difc">faltan ${fq(-c.ajuste)}</span>` : `<span class="chip difc">sobran ${fq(c.ajuste)}</span>`;
    const inpt = (k, ph, v) => `<input class="in n" data-k="${k}" inputmode="decimal" enterkeyhint="next" placeholder="${ph}" value="${v}">`;
    const fila = f => {
      const e = est[f.codigo], c = calc(e), un = f.unidad === 'UN', u = un ? 'un' : 'kg', fq = fqU(f);
      const nom = `<td class="nm" data-col="Producto">${esc(f.nombre)} <span class="lab">${u}</span></td>`;
      const sal = sum(f.salVend), ret = sum(f.retVend), otr = sum(e.desp) + sum(e.otras);
      const nOtras = Object.keys(e.otras).filter(k => e.otras[k]).length;
      if (!contar) {
        const est2 = c.final < -0.001 ? '<span class="chip difc">negativo</span>' : e.conteo !== '' && Math.abs(c.ajuste) > 0.001 ? `<span class="chip difc">conteo ${c.ajuste > 0 ? '+' : '−'}${fq(Math.abs(c.ajuste))}</span>` : '';
        return `<tr data-c="${esc(f.codigo)}" class="${c.final < -0.001 ? 'neg' : ''}">${nom}<td data-col="Empezó">${fq(e.inicialEditable ? dec(e.inicial) : f.inicial)}</td><td data-col="Entró">${dec(e.ingreso) ? fq(dec(e.ingreso)) : '—'}</td>
          <td data-col="${cam ? 'Salió' : 'Salió (vendedores)'}">${cam ? fq(otr) : sal ? fq(sal) : '—'}</td>${cam ? '' : `<td data-col="Volvió">${ret ? fq(ret) : '—'}</td><td data-col="Otras salidas">${otr ? fq(otr) : '—'}</td>`}
          <td class="q" data-col="Quedan">${fq(c.final)}</td><td data-col="Estado">${est2}</td></tr>`;
      }
      const det = cam ? '' : [sal ? `salió ${fq(sal)}` : '', ret ? `volvió ${fq(ret)}` : '', sum(e.desp) ? `supermercado y otros ${fq(sum(e.desp))}` : ''].filter(Boolean).join(' · ');
      return `<tr data-c="${esc(f.codigo)}" class="${e.cambio ? 'mod' : ''}">${nom.replace('</td>', det ? `<small>${det}</small></td>` : '</td>')}
        <td data-col="Empezó">${e.inicialEditable ? inpt('inicial', '0', e.inicial) : fq(f.inicial)}</td><td class="q dh" data-col="Debería haber">${fq(c.t)}</td>
        <td data-col="${cam ? 'Entra producto' : 'Entra de fábrica'}">${inpt('ingreso', '0', e.ingreso)}</td>
        ${cam ? `<td data-col="Sale a fábrica">${inpt('o:FABRICA', '0', e.otras.FABRICA || '')}</td><td data-col="Sale a vendedores">${inpt('o:VENDEDORES', '0', e.otras.VENDEDORES || '')}</td>` : ''}
        <td data-col="Conteo físico">${inpt('conteo', '—', e.conteo)}</td><td class="df" data-col="Diferencia">${difH(e, c, fq)}</td>
        ${cam ? '' : `<td class="lk" data-col=""><button type="button" class="ghostlink" data-otras="1">${nOtras ? `Otras salidas ${fq(sum(e.otras))} ›` : 'Otras salidas ›'}</button></td>`}</tr>`;
    };
    const cab = contar
      ? `<tr><th>Producto</th><th>Empezó</th><th>Debería haber</th><th>${cam ? 'Entra producto' : 'Entra de fábrica'}</th>${cam ? '<th>Sale a fábrica</th><th>Sale a vendedores</th>' : ''}<th>Conteo físico</th><th>Diferencia</th>${cam ? '' : '<th></th>'}</tr>`
      : `<tr><th>Producto</th><th>Empezó</th><th>Entró</th><th>Salió${cam ? '' : ' (vendedores)'}</th>${cam ? '' : '<th>Volvió</th><th>Otras salidas</th>'}<th>Quedan</th><th>Estado</th></tr>`;
    lista.innerHTML = filas.length ? `<div class="invt"><table>${cab}${filas.map(fila).join('')}</table></div>` : '<div class="empty">No hay productos con ese filtro en esta sección.</div>';
    const n = Object.values(est).filter(e => e.cambio).length;
    $('#cambios').textContent = n ? n + ' producto(s) con cambios sin guardar' : 'Sin cambios';
  }
  lista.oninput = e => {
    const box = e.target.closest('tr[data-c]'); const k = e.target.dataset.k; if (!box || !k) return;
    const st = est[box.dataset.c], f = st.f, fq = v => f.unidad === 'UN' ? nk(v) : kg(v);
    if (k.startsWith('o:')) st.otras[k.slice(2)] = e.target.value; else st[k] = e.target.value;
    st.cambio = true; box.classList.add('mod');
    const c = calc(st), dh = $('.dh', box), df = $('.df', box);
    if (dh) { dh.textContent = fq(c.t); dh.classList.toggle('neg', c.final < -0.001); }
    if (df) df.innerHTML = st.conteo === '' ? '' : Math.abs(c.ajuste) < 0.001 ? '<span class="chip okc">calza</span>' : `<span class="chip difc">${c.ajuste < 0 ? 'faltan ' + fq(-c.ajuste) : 'sobran ' + fq(c.ajuste)}</span>`;
    const n = Object.values(est).filter(x => x.cambio).length;
    $('#cambios').textContent = n + ' producto(s) con cambios sin guardar';
  };
  lista.addEventListener('keydown', e => { if (e.key !== 'Enter' || !e.target.matches('input[data-k]')) return; e.preventDefault();
    const ins = $$('input[data-k]', lista), i = ins.indexOf(e.target); if (ins[i + 1]) ins[i + 1].focus(); else e.target.blur(); });
  lista.addEventListener('focusin', e => { if (e.target.matches('input[data-k]')) setTimeout(() => e.target.select && e.target.select(), 0); });
  lista.onclick = e => { const b = e.target.closest('[data-otras]'); if (!b) return; abrirOtras(est[b.closest('tr[data-c]').dataset.c]); };
  function abrirOtras(st) {
    const delaSec = inv.destinosSec && inv.destinosSec[st.f.seccion];
    const lista2 = (delaSec ? delaSec.concat(['SUPERMERCADO']) : inv.destinos).filter(d => d !== 'SUPERMERCADO' || !st.desp.SUPERMERCADO);
    const dist = delaSec ? [] : (inv.distribuidores || []);
    const extras = Object.keys(st.otras).filter(k => lista2.indexOf(k) < 0 && dist.indexOf(k) < 0);
    const campo = d => `<label class="f" style="margin:0">${esc(d === 'SUPERMERCADO' ? 'Supermercado' : d.charAt(0) + d.slice(1).toLowerCase())}
        <input class="in n" data-d="${esc(d)}" inputmode="decimal" value="${st.otras[d] || ''}"></label>`;
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div><div class="body">
      <div class="muted">Otras salidas</div><div style="font-weight:700;font-size:18px">${esc(st.f.nombre)}</div>
      ${Object.keys(st.desp).length ? `<p class="muted">Desde Despacho: ${Object.keys(st.desp).map(k => esc(k) + ' ' + kg(st.desp[k])).join(', ')}</p>` : ''}
      ${dist.length ? `<div class="muted" style="margin-top:12px;font-weight:700">Distribuidores</div>
      <div class="grid g2" style="margin-top:6px">${dist.map(campo).join('')}</div>` : ''}
      <div class="muted" style="margin-top:14px;font-weight:700">${dist.length ? 'Otros destinos' : 'Salidas de esta sección'}</div>
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
  $('#invq').oninput = e => { S.invQ = e.target.value; pintar(); };
  $('#invf').onclick = e => { const b = e.target.closest('button'); if (b) { S.invF = b.dataset.f; pintar(); } };
  $('#invm').onclick = e => { const b = e.target.closest('button'); if (b) { S.invM = b.dataset.m; pintar(); } };
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
  const edp = $('#edp'); if (edp) edp.onclick = () => abrirEditorPlanilla(() => ir('inventario', true));
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
        ${u.activo ? '' : '<span class="chip bad">Desactivado</span>'}${u.bloqueado ? '<span class="chip bad">Bloqueado</span>' : ''}${u.rindeAntes ? '<span class="chip">Rinde con el día anterior: ' + esc(u.rindeAntes) + '</span>' : ''}${!u.tieneClave ? '<span class="chip warn">Sin clave</span>' : u.debeCambiar ? '<span class="chip warn">Clave temporal pendiente</span>' : ''}
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
      <label class="f" for="u2" style="margin-top:10px">Rol</label><select class="in" id="u2">${['VENDEDOR', 'BODEGA', 'RENDICION', 'SUPERVISOR', 'GERENCIA', 'ADMIN'].map(r => `<option value="${r}" ${u.rol === r ? 'selected' : ''}>${ROL[r] || r}</option>`).join('')}</select>
      <label class="f" for="u3" style="margin-top:10px">RUT</label><input class="in" id="u3" value="${esc(u.rut)}" placeholder="12.345.678-5" autocomplete="off">
      <label class="f" for="u4" style="margin-top:10px">Correo (opcional)</label><input class="in" id="u4" value="${esc(u.correo)}" autocapitalize="none" autocomplete="off">
      <div id="u5w"><label class="f" for="u5" style="margin-top:10px">Terminales de Mi DTE (separados por coma)</label><input class="in" id="u5" value="${esc(u.terminales)}" autocomplete="off">
      <div id="u7w" style="margin-top:12px"><div class="f">Rinde con el día anterior</div>
        <div class="muted" style="margin:2px 0 6px">Marca los días en que su rendición incluye también lo del día anterior (folios, cobranza, gastos, salida y retorno). Ej.: si carga el jueves y rinde el viernes, marca Vie. Ese día anterior no aparece suelto.</div>
        <div class="row" style="gap:6px;flex-wrap:wrap" id="u7">${[['LU','Lun'],['MA','Mar'],['MI','Mié'],['JU','Jue'],['VI','Vie'],['SA','Sáb'],['DO','Dom']].map(([k, n]) => `<label class="chip" style="cursor:pointer"><input type="checkbox" value="${k}" ${String(u.rindeAntes || '').split(',').indexOf(k) >= 0 ? 'checked' : ''}> ${n}</label>`).join('')}</div></div>
      <label class="muted" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="u6" ${u.activo ? 'checked' : ''}> Activo (si lo desactivas, no puede ingresar)</label></div>
      <div class="foot"><button class="btn ghost" id="ux">Cancelar</button><span class="grow"></span><button class="btn cu" id="ug">Guardar</button></div></div>`;
    document.body.appendChild(ov);
    const rolCh = () => { $('#u5w', ov).hidden = $('#u7w', ov).hidden = $('#u2', ov).value !== 'VENDEDOR'; }; $('#u2', ov).onchange = rolCh; rolCh();
    $('#ux', ov).onclick = () => cerrarHoja(ov);
    $('#ug', ov).onclick = async () => {
      const o = { usuario: u.usuario, nombre: $('#u1', ov).value.trim(), rol: $('#u2', ov).value, rut: $('#u3', ov).value.trim(), correo: $('#u4', ov).value.trim(), terminales: $('#u5', ov).value.trim(), activo: $('#u6', ov).checked, rindeAntes: [...ov.querySelectorAll('#u7 input:checked')].map(x => x.value).join(',') };
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
    <div class="row" style="margin-bottom:10px;flex-wrap:wrap"><button class="btn cu sm" id="pl">Abrir planilla única de créditos</button>
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
  $('#pl').onclick = async () => { const b = $('#pl'); b.disabled = true; try { const p = await api('sincronizarPlanillaCreditos', S.sess.token);
      $('#plr').innerHTML = `<a class="chip cu" href="${esc(p.url)}" target="_blank" rel="noopener">Planilla actualizada · ${p.documentos} documentos · ${clp(p.total)}</a>${p.actualizados || p.nuevos ? ` <span class="chip ok">Traje de la planilla: ${p.actualizados} cambiados, ${p.nuevos} nuevos</span>` : ''}`;
      olvidarCache(true); window.open(p.url, '_blank'); } finally { b.disabled = false; } };
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
const fechaCortaTxt = f => { const d = new Date(f + 'T12:00:00'); return ['dom','lun','mar','mié','jue','vie','sáb'][d.getDay()] + ' ' + f.split('-').reverse().slice(0, 2).join('-'); };
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
          <small>Ventas ${clp(t.efVentas)} + cobranza ${clp(t.efCob)}${t.devoluciones ? ' − devoluciones ' + clp(t.devoluciones) : ''}${t.gastos ? ' − gastos ' + clp(t.gastos) : ''} − depositado ${clp(t.depositos)}${t.reposicion ? ' · repuesto desde caja chica ' + clp(t.reposicion) : ''}</small></div>
        <div class="dres">
          ${t.nc ? fila('Venta (' + v.documentos + ' docs)', '', t.ventaDocs) + fila('− Notas de crédito', '', t.nc) + fila('Venta neta', '', t.venta) : fila('Venta (' + v.documentos + ' docs)', '', t.venta)}${fila('Venta contado', '', t.contado)}${t.creditoTotal ? fila('Crédito total', 'crédito ' + clp(t.credito) + ' · cheques ' + clp(t.chequesVenta), t.creditoTotal) : ''}
          ${t.cheques - t.chequesVenta > 0 ? fila('Cheques de cobranza', '', t.cheques - t.chequesVenta) : ''}
          ${Object.keys(v.transf).filter(b => v.transf[b].length).map(b => fila('Transf. ' + b, v.transf[b].length, v.transf[b].reduce((a, x) => a + x.monto, 0))).join('')}
          ${t.descuentos ? fila('Descuentos', '', t.descuentos) : ''}${t.devoluciones ? fila('Devoluciones (' + t.devolucionesN + ')', t.devSinCliente ? t.devSinCliente + ' sin cliente' : 'merma / reproceso', t.devoluciones) : ''}</div></div>
      ${v.porDia && v.porDia.length ? `<div class="dsec"><div class="dtit"><b>Por día</b><span>todo se rinde ${fechaCortaTxt(r.fecha)}</span></div>
        ${v.porDia.map(x => fila(fechaCortaTxt(x.fecha) + ' · ' + x.documentos + ' docs', 'efectivo ' + clp(x.efVentas + x.efCob) + (x.credito ? ' · crédito ' + clp(x.credito) : ''), x.venta)).join('')}
        ${fila('Total (los días juntos)', '', v.porDia.reduce((a, x) => a + x.venta, 0))}</div>` : ''}
      ${(() => { const trV = Object.keys(v.transf).reduce((a, b) => a + v.transf[b].filter(x => x.tipo === 'Venta').reduce((c, x) => c + x.monto, 0), 0),
          ef0 = t.contado + (t.devoluciones || 0) - trV, dV = t.efVentas - ef0, cont = t.efContado, dif = cont === null || cont === undefined ? null : cont - t.entregar;
        return `<div class="dsec"><div class="dtit"><b>Cuenta del efectivo</b><span>solo aviso</span></div>
          ${fila('Venta contado', 'venta − crédito − cheques − descuentos', t.contado)}${fila('− Transferencias de ventas', '', trV)}
          ${fila('= Efectivo de ventas', dV ? 'ojo: lo anotado es ' + clp(t.efVentas) + ' (diferencia ' + clp(Math.abs(dV)) + ')' : 'calza con lo anotado', ef0)}
          ${fila('+ Cobranza en efectivo', '', t.efCob)}${t.devoluciones ? fila('− Devoluciones', 'merma / reproceso', t.devoluciones) : ''}${t.gastos ? fila('− Gastos del día', '', t.gastos) : ''}${t.depositos ? fila('− Depositado', '', t.depositos) : ''}
          ${fila('= Debe entregar', '', t.entregar)}
          ${dif === null ? '<div class="muted" style="padding:6px 0">Todavía no se cuenta el efectivo (pestaña Efectivo).</div>'
            : fila('Efectivo contado', dif === 0 ? 'cuadra' : dif < 0 ? 'FALTA ' + clp(-dif) : 'SOBRA ' + clp(dif), cont)}</div>`; })()}
      <div class="dsec"><div class="dtit"><b>Folios</b><span>${v.detallados} de ${v.documentos} detallados</span></div>
        <div class="seg" id="dfl" style="margin:2px 0 8px">${[['pend', 'Por detallar (' + pend.length + ')'], ['det', 'Detallados'], ['todos', 'Todos']].map(x =>
          `<button type="button" data-f="${x[0]}" class="${filtro === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
        ${folios.length ? folios.map(f => `<div class="dfolio ${f.estado === 'DETALLADO' ? '' : 'pend'}">
          <div class="row"><span class="grow"><b>${esc(f.cliente)}</b> <span class="muted">${esc(f.tipo)} ${esc(f.folio)}</span>${f.rut ? `<span class="rutl">RUT ${esc(f.rut)}</span>` : ''}</span><b>${clp(f.total)}</b></div>
          <div class="muted">${f.estado === 'DETALLADO' ? f.pagos.map(p => esc(textoPago(p)) + (f.pagos.length > 1 ? ' ' + clp(p.monto) : '')).join(' + ')
            + (f.descAprob ? ' · descuento ' + clp(f.descAprob) : '') + (f.detalladoPor ? ' · por ' + esc(f.detalladoPor.split(' ')[0]) : '')
            : f.descPend ? 'Descuento esperando autorización' : 'Por detallar'}</div></div>`).join('') : '<div class="muted" style="padding:6px 0">No hay folios en este filtro.</div>'}</div>
      ${v.kilos && v.kilos.detalle.length ? `<div class="dsec"><div class="dtit"><b>Diferencia de kilos</b><span>${v.kilos.diferencia > 0 ? '+' : ''}${kg(v.kilos.diferencia)} kg · ${v.kilos.diferenciaPesos > 0 ? 'faltante ' : 'sobrante '}${clp(Math.abs(v.kilos.diferenciaPesos))}</span></div>
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
    const dev = t.devoluciones || 0, efTotal = t.efVentas + t.efCob, gas = t.gastos || 0, rep = t.reposicion || 0, aEntregar = efTotal - dev - gas - t.depositos;
    const chCob = t.cheques - t.chequesVenta;                       // cheques recibidos por cobranza (no son venta del día)
    const subtotal = aEntregar + rep + t.depositos + transfTot + chCob, total = subtotal + t.creditoTotal;
    const totalDetalle = t.efVentas + t.efCob - dev - gas + rep + transfTot + chCob + t.creditoTotal;     // por origen: debe dar igual a `total`
    const cobEf = t.efCob, cobCh = sum(v.cobranza.filter(x => x.forma === 'CHEQUE'));
    const cobTr = sum(v.cobranza.filter(x => x.forma === 'TRANSFERENCIA' || x.forma === 'DEP_EFECTIVO'));

    const resumen = [
      suma('Efectivo total', `ventas ${clp(t.efVentas)} + cobranza ${clp(t.efCob)}`, efTotal, false),
      dev ? suma('(−) Devoluciones', 'merma / reproceso', -dev, false) : '',
      gas ? suma('(−) Gastos del día', `${v.gastos.length} gasto${v.gastos.length === 1 ? '' : 's'}`, -gas, false) : '',
      t.depositos ? suma('(−) Depositado', 'ya está en el banco', -t.depositos, false) : '',
      suma('Efectivo a entregar', '', aEntregar, true, 'sub'),
      rep ? suma('(+) Repuesto desde caja chica', 'gastos de este día', rep, true) : '',
      t.depositos ? suma('Depósitos de efectivo', 'en el banco', t.depositos, true) : '',
      ...bancos.map(b => suma('Transferencias ' + b, '', tb[b], true)),
      chCob ? suma('Cheques de cobranza', '', chCob, true) : '',
      suma('Subtotal (contado)', '', subtotal, false, 'sub'),
      suma('Crédito', v.creditos.length ? `${v.creditos.length} documento${v.creditos.length === 1 ? '' : 's'}` : '', t.credito, true),
      suma('Cheques de ventas', 'cuentan como crédito hasta cobrarse', t.chequesVenta, true),
      suma('Crédito total del día', '', t.creditoTotal, false, 'sub'),
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

    const devHtml = (v.devoluciones || []).length ? bloque('Devoluciones (merma / reproceso)', dev, 'se descuentan del efectivo', v.devoluciones.map(x =>
      `<tr><td>${esc(x.producto)}<small>${esc((x.tipo === 'MERMA' ? 'Merma' : 'Reproceso') + ' · ' + x.cantidad + (x.unidad === 'UN' ? ' un' : ' kg'))}</small></td><td class="g">${esc(x.cliente || 'sin cliente')}</td><td class="m">${clp(x.monto)}</td>${CK}</tr>`).join(''), '', COLS_DP) : '';
    // todas las ventas: lo pagado en efectivo (por folio) y lo vendido a crédito
    const efecFilas = [];
    v.folios.forEach(f => (f.pagos || []).forEach(p => { if (p.forma === 'EFECTIVO') efecFilas.push({ cliente: f.cliente, rut: f.rut, doc: f.tipo + ' ' + f.folio, monto: p.monto }); }));
    const filaVt = x => `<tr><td>${esc(x.cliente)}</td><td class="g">${esc(x.rut)}</td><td class="g">${esc(x.doc)}</td><td class="m">${clp(x.monto)}</td>${CK}</tr>`;
    const efecHtml = efecFilas.length ? bloque('Venta en efectivo', t.efVentas, `${efecFilas.length} documento${efecFilas.length === 1 ? '' : 's'}`, efecFilas.map(filaVt).join(''), '', COLS_VT, true)
      : `<table class="s">${suma('Venta en efectivo', '', t.efVentas, true)}</table>`;
    const credHtml = v.creditos.length ? bloque('Crédito', t.credito, `${v.creditos.length} documento${v.creditos.length === 1 ? '' : 's'}`, v.creditos.map(x => filaVt({ cliente: x.cliente, rut: x.rut, doc: refOrigen(x.origen), monto: x.monto })).join(''), '', COLS_VT, true) : '';

    const comp = [['Venta en efectivo', t.efVentas], ['+ Cobranza en efectivo', t.efCob]].concat(dev ? [['− Devoluciones (merma / reproceso)', -dev]] : [], gas ? [['− Gastos del día', -gas]] : [], rep ? [['+ Repuesto desde caja chica', rep]] : [],
      [['+ Transferencias', transfTot], ['+ Cheques de cobranza', chCob], ['+ Crédito total (crédito + cheques)', t.creditoTotal]]);
    return `<section class="ins">
      <div class="hd"><div><b class="n">${esc(v.nombre)}</b><small>Inspección de rendición · Cecinas Naranjo</small></div>
        <div class="r"><b>${fc}</b><small>${v.terminal ? 'Terminal ' + esc(v.terminal) : ''}</small></div></div>
      ${v.porDia && v.porDia.length ? `<table class="s sp">${v.porDia.map(x => suma(fechaCortaTxt(x.fecha), x.documentos + ' docs · efectivo ' + clp(x.efVentas + x.efCob), x.venta, false)).join('')}${suma('Total de los días', 'se rinde junto', v.porDia.reduce((a, x) => a + x.venta, 0), false, 'tot')}</table>` : ''}
      <h3>RESUMEN</h3><table class="s">${resumen}</table>
      <h3>DETALLE</h3>
      ${efecHtml}${transfHtml}${chequesHtml}${cobHtml}${devHtml}${depHtml}
      <table class="s sp">${t.gastos ? suma('Gastos del día', `${v.gastos.length} gasto${v.gastos.length === 1 ? '' : 's'} · se restan del efectivo`, t.gastos, true) : ''}${rep ? suma('Repuesto desde caja chica', 'se suma a la rendición', rep, true) : ''}
        </table>
      ${v.kilos && v.kilos.detalle.length ? `<div class="blk"><div class="bt"><span><b>Diferencia de kilos</b> <small>${v.kilos.diferencia > 0 ? 'kilos faltantes' : 'kilos sobrantes'} · no entra al total</small></span><b class="m">${mm(v.kilos.diferenciaPesos)}</b><i></i></div>
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
function cargarXLSX(silencioso) {
  if (window.XLSX) return Promise.resolve();
  if (_xlsx) return _xlsx;
  _xlsx = new Promise((res, rej) => {
    const fin = silencioso ? () => {} : trabajando('xlsx'), sc = document.createElement('script');
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
const SUPERMERCADOS = [/AMAR HERMANOS/, /KUNCAR/, /\bSUPER ?UNICO\b|\bUNICO\b/, /SUPER ?OFERTA/, /OPERADORA DE COMERCIO/, /DISTRIBUIDORA.*MORENO/];
const DISTRIBUIDORES = [/PATRICIO MONTES/, /JUAN CARLOS SILVA/, /OSCAR LAGOS/, /CESAR (RICARDO )?CAMPOS/, /\bANBA\b/, /\bAAMF\b/, /PICHIHUILLINCO/, /\bAMIR\b/];
// Lista de clientes entregada por la empresa (RUT sin dígito → [tipo, nombre]). S = supermercado, D = distribuidor, B = venta en bodega.
// Los clientes de ruta (cada uno con su vendedor) no se listan: salen con el terminal del vendedor.
const CLIENTES_TIPO = {6467072:['B',"JAIME ULISES PARADA CANCINO"],8571343:['B',"LUIS ANDRES SAEZ THIELEMANN"],10240346:['B',"JUAN GATICA VEGA"],10594880:['D',"JUAN CARLOS SILVA AYALA"],10967967:['D',"CESAR RICARDO CAMPOS MORA"],11603891:['B',"RODRIGO ROLANDO FIGUEROA MANRIQUEZ"],12990206:['B',"MIGUEL FERNANDEZ SAEZ"],14076345:['B',"SIMON ZAPATA SANHUEZA"],14219974:['B',"JOEL LEIVA VARAS"],14299882:['B',"MANUEL ALBERTO CAMPOMANES GUTIERREZ"],15651662:['D',"OSCAR ELADIO LAGOS LAGOS"],16389061:['B',"ELICEO ANDRES RIOS BRIONES"],16707893:['B',"MARIA TERESA TRONCOSO RIVERA"],18727612:['B',"LEONARDO ANDRES SAN MARTIN PEREZ"],19198892:['B',"JAVIER ROBLES CANARIO"],19923028:['B',"CARLA LEIVA"],20645043:['B',"ADRIELA ESCARLETH CARDENAS RODRIGUEZ"],20872678:['B',"SAMUEL BENJAMIN RUBILAR MUNOZ"],20947573:['B',"RODOLFO ISLA"],21143098:['B',"SERGIO CERNA ARANCIBIA"],21255436:['B',"CARLOS GONZALES ISLA"],27004862:['B',"YORMAN RAFAEL MORENO DIAZ"],27038200:['B',"JUAN MEJIA"],27531771:['B',"BRIAN JOSE DIAZ FLORES"],76062357:['S',"DISTRIBUIDORA Y MAYORISTA CRISTIAN MORENO SPA"],76128330:['S',"COMERCIAL SUPERUNICO STA BARBARA LTDA"],76278969:['S',"COMERCIAL SUPERUNICO LAJA LTDA"],76279855:['S',"COMERCIAL SUPERUNICO ANGOL LTDA"],76965456:['D',"SOCIEDAD CECINAS PICHIHUILLINCO LIMITADA"],77180289:['S',"DISTRIBUIDORA Y SUPERMERCADOS SUPEROFERTA SPA"],77228386:['D',"COMERCIALIZADORA PATRICIO MONTES INOSTROZA E.I.R.L"],77349320:['S',"COMERCIAL AMAR HERMANOS Y COMPANIA LTDA"],77759355:['B',"SCHNEEBERGER EVENTOS Y PRODUCCIONES SPA"],77822839:['B',"INVERSIONES Y COMERCIALIZADORA LUCAR SPA"],78006381:['S',"OPERADORA DE COMERCIO"],78007363:['D',"ANBA SPA"],78390639:['D',"COMERCIALIZADORA AAMF SUR SPA"],81096600:['S',"KUNCAR Y CIA LTDA."]};
const CLIENTES_POR_NOMBRE = Object.fromEntries(Object.values(CLIENTES_TIPO).map(([t, n]) => [n, t]));
const rutCuerpo = r => { const x = String(r == null ? '' : r).toUpperCase().replace(/[^0-9K-]/g, ''); if (!x) return ''; return (x.includes('-') ? x.split('-')[0] : x.slice(0, -1)).replace(/\D/g, '').replace(/^0+/, ''); };
const GRUPOS_CLI = { S: { equipo: 'SUPERMERCADO', grupo: 'SUPERMERCADO' }, D: { equipo: 'BODEGA', grupo: 'DISTRIBUIDORA' }, B: { equipo: 'BODEGA', grupo: 'BODEGA' } };
/** Devuelve null si el documento sale con su propio equipo. equipo = lo que se importa; grupo = como lo rotula la planilla de Ventas Diarias.
    Primero se busca al cliente en la lista (por RUT o por nombre exacto); si no está, se usan las reglas por nombre de antes. */
function clasificarVenta(tipo, cliente, equipo, rut) {
  const eq = String(equipo || '').trim().toUpperCase(), t = String(tipo || '');
  if (eq === 'DISTRIBUIDORA') return { equipo: 'BODEGA', grupo: 'DISTRIBUIDORA' };    // archivo ya ordenado a mano
  if (!EQUIPO_OFICINA.test(eq) || /gu[ií]a|nota de cr/i.test(t)) return null;
  const n = sinTilde(cliente), k = rutCuerpo(rut), enLista = (CLIENTES_TIPO[k] && CLIENTES_TIPO[k][0]) || CLIENTES_POR_NOMBRE[n];
  if (enLista) return GRUPOS_CLI[enLista];
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
      const c = clasificarVenta(tipo, cli, f[campo], dte ? f.RUT : '');
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

/** Encabezado sin tildes, símbolos ni espacios dobles; acepta variantes habituales ("N° Folio", "Tipo documento", "Monto total"…). */
function encabezado(h) {
  let t = norm(h).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(n|nro|num|numero)? ?folio( documento)?$/.test(t)) return 'folio';
  if (/^(tipo (de )?(documento|doc)|tipo|nombre documento)$/.test(t) && t !== 'tipo') return 'documento';
  if (/^(monto )?total( documento| venta)?$/.test(t) && t !== 'total') return 'total';
  if (/^(descripcion|detalle|producto|nombre producto)( producto)?$/.test(t)) return 'descripcion';
  if (/^cant(idad)?$/.test(t)) return 'cantidad';
  return t;
}
function leerLibro(buf) {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const vistos = [];
  for (const nombre of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: true, defval: '' });
    const hi = rows.findIndex(r => r.some(c => encabezado(c) === 'folio'));
    if (hi < 0) { const r0 = rows.find(r => r.some(c => String(c).trim() !== '')); if (r0) vistos.push(nombre + ': ' + r0.map(c => String(c).trim()).filter(Boolean).slice(0, 8).join(' | ')); continue; }
    const head = rows[hi].map(h => norm(h));
    if (head.includes('cliente') && head.includes('monto') && head.some(h => /^¿?pag[oó]\??$/.test(h)))
      return { tipo: 'creditos', filas: leerCreditos(rows, hi, head) };
    const h2 = rows[hi].map(h => encabezado(h));
    // Formato nuevo de Mi DTE para Ventas Diarias: "Tributario" = Documento, "Nombre" = Nombre Cliente, "Pago" = Condicion, RUT y Digito separados.
    if (h2.includes('tributario') && !h2.includes('documento') && !h2.includes('descripcion'))
      h2.forEach((h, j) => { if (h === 'tributario') h2[j] = 'documento'; else if (h === 'nombre') h2[j] = 'nombre cliente'; else if (h === 'pago') h2[j] = 'condicion'; });
    const tipo = h2.includes('descripcion') && h2.includes('cantidad') ? 'detalle' : h2.includes('documento') && h2.includes('total') ? 'dte' : null;
    if (!tipo) { vistos.push(nombre + ': ' + rows[hi].map(c => String(c).trim()).filter(Boolean).slice(0, 10).join(' | ')); continue; }
    const keys = h2.map(h => h === 'total' ? (tipo === 'dte' ? 'Total' : 'TOTAL') : CANON[h] || h);
    const filas = rows.slice(hi + 1).map(r => { const o = {}; keys.forEach((k, j) => { let v = r[j]; if (k === 'Fecha' && typeof v === 'number') { o._fo = v; v = serialAFecha(v); } o[k] = v; }); if (o.digito !== undefined && o.RUT !== '' && o.RUT != null) o.RUT = String(o.RUT) + '-' + o.digito; delete o.digito; return o; })
      .filter(o => o.Folio !== '' && (tipo === 'dte' ? o.Documento : o.Descripcion));
    return { tipo, filas };
  }
  throw new Error('No reconozco este archivo. Debe ser "Ventas Diarias" (con Folio, Documento y Total) o "Informe de ventas" (con Folio, Descripcion y Cantidad) de Mi DTE.' + (vistos.length ? ' Encabezados que encontré → ' + vistos.join(' ; ') : ' No encontré una columna "Folio".'));
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
  $('#fi').onchange = e => { const a = [...e.target.files]; e.target.value = ''; procesar(a); };
  S.diasTerm = [];
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
  const avisoRequisitos = leidos => { const r = requisitos(leidos); return r ? `<div class="alert" style="margin-top:12px"><b>No se puede importar todavía.</b> ${r} Con «Agregar informe» sube el que falta: lo que ya subiste se queda aquí.</div>` : ''; };

  const pausa = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));       // deja pintar el aviso antes de un trabajo pesado
  const leidos = [];          // todo lo subido en esta importación: se puede ir agregando de a un archivo (por ejemplo, si no están en la misma carpeta)
  S.impPendiente = false;
  async function procesar(files) {
    if (!files.length) return;
    $('#pv').innerHTML = `<div class="card impl"><span class="spin"></span><div class="grow"><b>Leyendo ${files.length > 1 ? files.length + ' archivos' : 'el archivo'}…</b>
      <div class="muted" id="leyn">Preparando el lector de Excel</div></div></div>`;
    try { await cargarXLSX(); } catch (e) { $('#pv').innerHTML = `<div class="alert">${esc(e.message)}</div>`; if (leidos.length) pintarTodo(); return; }
    const nuevos = [];
    for (const [k, f] of files.entries()) {
      $('#leyn').textContent = `${f.name} (${k + 1} de ${files.length})`; await pausa();
      try { nuevos.push(Object.assign({ nombre: f.name }, leerLibro(await f.arrayBuffer()))); }
      catch (e) { nuevos.push({ nombre: f.name, error: e.message }); }
    }
    try { ordenarInformes(nuevos); } catch (e) { console.error(e); }        // solo los nuevos: los que ya estaban conservan su orden y sus cambios (notas de crédito)
    nuevos.forEach(n => { const i = leidos.findIndex(l => l.nombre === n.nombre); if (i >= 0) leidos.splice(i, 1); });      // el mismo archivo subido otra vez lo reemplaza
    leidos.push(...nuevos);
    leidos.sort((a, b) => (a.tipo === 'dte' ? 0 : 1) - (b.tipo === 'dte' ? 0 : 1)); // primero los folios
    pintarTodo();
  }
  // Vendedores que emiten sus folios el día antes de la ruta (José, Javier): sus documentos de días anteriores al último del archivo pasan al día siguiente.
  const antes = {};                                   // usuario → true/false (la encargada puede apagarlo)
  const sumaDia = (iso, n) => { const [a, m, d] = iso.split('-'); return new Date(Date.UTC(+a, m - 1, +d + n)).toISOString().slice(0, 10); };
  const vendDeTerminal = () => { const mp = {}; (S.cat.vendedores || []).forEach(v => String(v.terminales || '').split(',').map(x => x.trim().toUpperCase()).filter(String).forEach(t => mp[t] = v)); return mp; };
  function aplicarAntes() {
    return { resumen: {}, max: '' };      // v71: ya no se cambia la fecha de los folios al importar (se quitó "emite el día antes")
    const mp = vendDeTerminal(), docs = leidos.filter(l => !l.error && (l.tipo === 'dte' || l.tipo === 'detalle'));
    const todas = docs.flatMap(l => l.filas.map(f => (f._fOrig = f._fOrig || (f._ncMovida ? isoFecha(f.Fecha) : isoFecha(f.Fecha)))));
    const max = todas.sort().slice(-1)[0] || '', resumen = {};
    for (const l of docs) {
      const campo = l.tipo === 'dte' ? 'Emitido en' : 'Equipo';
      for (const f of l.filas) {
        if (f._ncMovida || /nota de cr/i.test(l.tipo === 'dte' ? f.Documento : f.Nombre)) continue;
        const v = mp[String(f._equipoOrig || f[campo] || '').trim().toUpperCase()];
        const mover = !!(v && v.emiteAntes && antes[v.usuario] !== false && f._fOrig < max && f._fOrig);
        const nuevo = mover ? sumaDia(f._fOrig, 1) : f._fOrig;
        if (v && v.emiteAntes && l.tipo === 'dte') { const r = resumen[v.usuario] = resumen[v.usuario] || { nombre: v.nombre, n: 0, tot: 0 }; r.tot++; if (f._fOrig < max) r.n++; }
        if (isoFecha(f.Fecha) === nuevo) continue;
        const [a, m, d] = nuevo.split('-');
        if (l.tipo === 'dte') { f.Fecha = d + '-' + m + '-' + a; delete f._fo; }
        else { const ant = typeof f._fo === 'number' ? f._fo % 1 : 0; f.Fecha = nuevo; if (typeof f._fo === 'number') f._fo = Math.floor(Date.UTC(+a, m - 1, +d) / 864e5 + 25569) + ant; }
      }
    }
    return { resumen, max };
  }
  function tarjetaAntes(r) {
    const k = Object.keys(r.resumen); if (!k.length) return '';
    return `<div class="card ordc"><b>Folios emitidos el día antes</b>
      <p class="muted" style="margin:4px 0 8px">Estos vendedores facturan el día anterior a su ruta. Sus folios de días anteriores al ${esc(fcorta(r.max))} pasan al día siguiente para que salgan en su ruta.</p>
      <ul class="ordl">${k.map(u => { const x = r.resumen[u], on = antes[u] !== false;
        return `<li><span class="grow"><b>${esc(x.nombre)}</b> · ${x.n} de ${x.tot} folios ${on ? 'pasan' : 'pasarían'} al día siguiente</span>
          <label class="muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-antes="${esc(u)}" ${on ? 'checked' : ''}> Pasar al día siguiente</label></li>`; }).join('')}</ul></div>`;
  }
  function pintarTodo() {
    const infoAntes = aplicarAntes();
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
    }).join('') + resumenOrden() + tarjetaNC() + tarjetaAntes(infoAntes) + avisoRequisitos(leidos) +
      (leidos.length ? `<label class="btn ghost block" id="agr" style="cursor:pointer;text-align:center"><input type="file" id="fi2" accept=".xlsx,.xls,.csv" multiple class="sr">+ Agregar informe</label>` : '') +
      (leidos.some(l => !l.error) && !requisitos(leidos) ? '<button class="btn cu block" id="imp">Importar</button>' : '');
    $$('[data-antes]').forEach(c => c.onchange = () => { antes[c.dataset.antes] = c.checked; pintarTodo(); });
    S.impPendiente = leidos.length > 0;
    { const f2 = $('#fi2'); if (f2) f2.onchange = e => { const a = [...e.target.files]; e.target.value = ''; procesar(a); }; }
    $$('[data-nc]').forEach(inp => inp.onchange = () => { if (!inp.value) return; moverNC(inp.dataset.nc, inp.value); pintar(); });
    const b = $('#imp'); if (!b) return;
    const lotesDe = l => l.tipo === 'creditos' ? [l.filas] : l.tipo === 'dte' ? tandas(l.filas, 1200) : tandas(l.filas, 2000, x => String(x.Nombre) + '|' + String(x.Folio));
    b.onclick = async () => {
      b.hidden = true; const sinT = new Set(); let fechas = []; const ag = $('#agr'); if (ag) ag.remove();
      const resumen = [], errores = [];
      // panel de avance: se ve qué archivo se está guardando y cuánto falta
      const NOM = { dte: 'Ventas Diarias', detalle: 'Informe de ventas (kilos)', creditos: 'Control de crédito' };
      const items = leidos.map((l, i) => [l, i]).filter(([l]) => !l.error);
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
            api('sincronizarPlanillaCreditos', S.sess.token).then(() => $('#res' + i).insertAdjacentHTML('beforeend', '<div class="muted" style="margin-top:6px">La planilla única de créditos en el Drive quedó al día.</div>')).catch(() => {});
            continue;
          }
          const lotes = lotesDe(l);
          const r = { adApl: 0, adRev: 0, corregidos: 0, corregidas: 0, importados: 0, repetidos: 0, sinVendedor: 0, guias: 0, lineas: 0, omitidas: 0, terminalesSinAsignar: [], fechas: [], productosNuevos: [], porVendedor: {} };
          for (const [k, lote] of lotes.entries()) {
            if (lotes.length > 1) paso(i, 'run', `Parte ${k + 1} de ${lotes.length}`);
            barra(0.35);
            const x = await api(l.tipo === 'dte' ? 'importarDTE' : 'importarDetalle', S.sess.token, lote);
            D++; barra(0);
            ['importados', 'repetidos', 'sinVendedor', 'guias', 'lineas', 'omitidas', 'corregidos', 'corregidas'].forEach(c => r[c] += x[c] || 0);
            r.terminalesSinAsignar = r.terminalesSinAsignar.concat(x.terminalesSinAsignar || []); r.fechas = r.fechas.concat(x.fechas || []);
            r.productosNuevos = r.productosNuevos.concat(x.productosNuevos || []);
            if (x.adelantos) { r.adApl += x.adelantos.aplicados || 0; r.adRev += x.adelantos.revisar || 0; }
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
          resumen.push(l.tipo === 'dte' ? { t: 'dte', n: r.importados, rep: r.repetidos, cor: r.corregidos, ad: r.adApl, adr: r.adRev } : { t: 'det', n: r.lineas, rep: r.omitidas, cor: r.corregidas });
        } catch (e) { $('#res' + i).innerHTML = `<div class="alert" style="margin-bottom:0">${esc(e.message)}</div>`; paso(i, 'err', 'Con error'); errores.push(NOM[l.tipo] + ' (' + l.nombre + '): ' + e.message); }
      }
      b.remove(); S.impPendiente = false;
      olvidarCache(true); api('catalogo', S.sess.token).then(c => S.cat = c).catch(() => {});
      guardarOrdenados(leidos, pp);
      D = T; barra(0); pp.classList.remove('run'); pp.classList.add('fin'); $('#impsp', pp).outerHTML = '<span class="okdot">✓</span>';
      { const conErr = !!pp.querySelector('li.err');
        $('#impt', pp).textContent = conErr ? 'Terminó con errores' : 'Importación terminada';
        pp.insertAdjacentHTML('beforeend', conErr
          ? '<div class="listo mal"><b>Terminó, pero hubo errores.</b> Revisa el detalle de abajo antes de seguir.</div>'
          : '<div class="listo"><span class="okdot">✓</span><div><b>Listo: ya puedes cambiar de pantalla y seguir trabajando.</b><div class="muted">Los datos ya están guardados. Los Excel ordenados se siguen subiendo al Drive aquí abajo; no es necesario esperarlos.</div></div></div>');
        toast(conErr ? 'La importación terminó con errores' : 'Importación lista. Ya puedes seguir trabajando.', conErr); }
      const f = [...new Set(fechas)];
      { const d = resumen.filter(x => x.t === 'dte'), k = resumen.filter(x => x.t === 'det'), sum = (a, c) => a.reduce((z, x) => z + x[c], 0);
        const nuevo = sum(d, 'n') + sum(k, 'n'), rep = sum(d, 'rep'), cor = sum(d, 'cor');
        const ad = sum(d, 'ad'), adr = sum(d, 'adr');
        const caja = document.createElement('div');
        caja.className = 'alert ' + (errores.length ? '' : 'ok'); caja.style.marginTop = '12px';
        caja.innerHTML = errores.length
          ? `<b>La importación no terminó bien.</b> ${esc(errores.join(' · '))}<br>Lo que sí se guardó queda; puedes volver a subir los archivos y solo se agrega lo que falta.`
          : nuevo || cor ? `<b>Listo, se cargó.</b> ${sum(d, 'n')} documentos nuevos y ${sum(k, 'n')} líneas de kilos${rep ? `. ${rep} documentos ya estaban y no se tocaron` : ''}${cor ? `. ${cor} documentos ya cargados cambiaron de día` : ''}. Ya puedes verlos en cada día.`
          : `<b>No había nada nuevo.</b> Todo lo de estos archivos ya estaba cargado${rep ? ' (' + rep + ' documentos)' : ''}; no cambié nada.`;
        if (!errores.length && (ad || adr)) caja.innerHTML += `<br>${ad ? `<b>${ad}</b> folio${ad > 1 ? 's' : ''} ya quedó${ad > 1 ? 'aron' : ''} detallado${ad > 1 ? 's' : ''} con lo que anotaron los vendedores. ` : ''}${adr ? `<b>${adr}</b> no calzó${adr > 1 ? 'aron' : ''} (no aparece el folio, tipo, monto o vendedor distinto): el vendedor ve el motivo de cada uno en Anotar folio.` : ''}`;
        pp.insertAdjacentElement('afterend', caja); }
      if (f.length === 1 && f[0] !== S.fecha) { S.fecha = f[0]; pintarDia(); toast('Mostrando el ' + fechaLarga(S.fecha)); }
      if (sinT.size) toast('Hay terminales sin vendedor: ' + [...sinT].join(', ') + '. Asígnalos abajo.', true);
      cargarTerminales([...sinT], f.slice().sort());
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
  // días que se muestran en la tabla de terminales (S.diasTerm): los recién importados, o el día elegido
  async function cargarTerminales(resaltar = [], dias) {
    if (dias && dias.length) S.diasTerm = dias;
    const ds = (S.diasTerm && S.diasTerm.length ? S.diasTerm : [S.fecha]).slice().sort();
    const t = await api('listarTerminales', S.sess.token, ds);
    const internos = /^(OFICINA|DESKTOP|PC-)/i;
    $('#term').innerHTML = `<div class="tw"><table><thead><tr><th>Terminal</th>${ds.map(d => `<th class="r">Docs ${fcorta(d)}</th>`).join('')}<th>Vendedor</th></tr></thead><tbody>${t.map(x => `
      <tr><td><b>${esc(x.terminal)}</b> ${resaltar.includes(x.terminal) || (!x.vendedor && x.documentos) ? '<span class="chip bad">sin asignar</span>' : ''}
        ${internos.test(x.terminal) && !x.vendedor ? '<span class="chip">uso interno</span>' : ''}</td>${ds.map(d => `<td class="r">${(x.porFecha || {})[d] || 0}</td>`).join('')}
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
const BILLETES = [20000, 10000, 5000, 2000, 1000], MONEDAS = [500, 100, 50, 10];
async function vEfectivo(m) {
  const r = await api('getConteoEfectivo', S.sess.token, S.fecha), cerrada = r.estado === 'CERRADA';
  if (!r.vendedores.length) return render(m, `<h2>Efectivo del día</h2><div class="empty"><b>Sin movimientos este día</b>Parte importando los informes de Mi DTE.</div>`);
  const n = el => soloDigitos(el.value);
  render(m, `<h2>Efectivo del día</h2><p class="lead">Cuenta el efectivo de cada vendedor: cuánto suma cada tipo de billete y de moneda, por ejemplo $200.000 en billetes de $20.000 (las monedas no se depositan). Abajo queda cuánto hay que depositar.</p>
    ${r.vendedores.map((v, i) => `<div class="card efv" data-u="${esc(v.usuario)}" data-esp="${v.esperado}" style="margin-bottom:10px">
      <button type="button" class="efh" aria-expanded="false"><span class="grow"><b>${esc(v.nombre)}</b><small>Debe entregar ${clp(v.esperado)}</small></span><span data-hdf></span><i class="dcar" aria-hidden="true"></i></button>
      <div class="efb" hidden>
      <div class="bill">${BILLETES.map(b => `<label><span>${clp(b)}</span><input class="in n" inputmode="numeric" data-b="${b}" value="${v['b' + b] ? v['b' + b] * b : ''}" ${cerrada ? 'disabled' : ''} aria-label="Total en billetes de ${clp(b)} de ${esc(v.nombre)}" placeholder="0"><em class="sub" data-sb="${b}"></em></label>`).join('')}</div>
      <div class="bill mons">${MONEDAS.map(b => `<label><span>Monedas de ${clp(b)}</span><input class="in n" inputmode="numeric" data-m="${b}" value="${v['m' + b] ? v['m' + b] * b : ''}" ${cerrada ? 'disabled' : ''} aria-label="Total en monedas de ${clp(b)} de ${esc(v.nombre)}" placeholder="0"><em class="sub" data-sm="${b}"></em></label>`).join('')}
        ${v.monedasOtras ? `<label><span>Monedas (conteo anterior)</span><b class="sub2" data-mo="${v.monedasOtras}">${clp(v.monedasOtras)}</b></label>` : ''}</div>
      <div class="row efr"><span class="muted">Billetes <b data-bt></b> · contado <b data-ct></b></span><span class="grow"></span><span data-df></span></div>
      </div></div>`).join('')}
    <div class="card" id="efs" style="border:1.5px solid var(--ink)">
      <dl class="efd"><dt>Efectivo que debían entregar</dt><dd id="s_esp"></dd>
        <dt>Billetes contados</dt><dd id="s_bil"></dd><dt class="muted" id="s_det" style="grid-column:1/-1;text-align:left"></dt>
        <dt>Monedas (no se depositan)</dt><dd id="s_mon"></dd>
        <dt>Diferencia (contado − esperado)</dt><dd id="s_dif"></dd></dl>
      <div class="row" style="margin:10px 0;gap:10px;flex-wrap:wrap;align-items:flex-end"><div style="min-width:180px"><label class="f" for="cc">Caja chica sacada de este día</label><input class="in n" id="cc" inputmode="numeric" value="${r.cajaChica || ''}" placeholder="0" disabled></div>
        ${S.sess.rol === 'GERENCIA' ? '' : '<button class="btn ghost" id="ccSacar" type="button">Sacar caja chica de este día</button>'}</div>
      <p class="muted" style="margin:0 0 8px">La caja chica se saca del efectivo recaudado y se descuenta del depósito. Se anota aquí o en Caja → Caja chica.</p>
      <div class="dbox" style="margin-top:6px"><span>Efectivo a depositar</span><b id="s_dep"></b><small>Billetes contados − caja chica</small></div>
      ${cerrada ? '<p class="muted">El día está cerrado: solo ADMIN puede reabrirlo para cambiar el conteo.</p>' : '<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn cu" id="efg">Guardar conteo</button></div>'}</div>`);
  const filas = $$('.efv', m);
  function calc() {
    let esp = 0, bil = 0, mon = 0; const por = {}; BILLETES.forEach(b => por[b] = 0);
    filas.forEach(f => {
      let b = 0; $$('[data-b]', f).forEach(i => { const t = n(i), d = Number(i.dataset.b); b += t; por[d] += t; $('[data-sb="' + d + '"]', f).innerHTML = t % d ? '<span style="color:var(--bad,#b3261e)">Debe ser múltiplo de ' + clp(d) + '</span>' : ''; });
      let mo = Number(($('[data-mo]', f) || {dataset: {}}).dataset.mo || 0); $$('[data-m]', f).forEach(i => { const t = n(i), d = Number(i.dataset.m); mo += t; $('[data-sm="' + d + '"]', f).innerHTML = t % d ? '<span style="color:var(--bad,#b3261e)">Debe ser múltiplo de ' + clp(d) + '</span>' : ''; });
      const e = Number(f.dataset.esp), dif = b + mo - e;
      $('[data-bt]', f).textContent = clp(b); $('[data-ct]', f).textContent = clp(b + mo);
      $('[data-hdf]', f).innerHTML = b + mo === 0 ? '<span class="chip">Por contar</span>' : dif === 0 ? '<span class="chip ok">Cuadra</span>' : `<span class="chip ${dif < 0 ? 'bad' : 'warn'}">${dif < 0 ? 'Falta ' : 'Sobra '}${clp(Math.abs(dif))}</span>`;
      $('[data-df]', f).innerHTML = b + mo === 0 ? '' : dif === 0 ? '<span class="chip ok">Cuadra</span>' : `<span class="chip ${dif < 0 ? 'bad' : 'warn'}">${dif < 0 ? 'Falta ' : 'Sobra '}${clp(Math.abs(dif))}</span>`;
      esp += e; bil += b; mon += mo;
    });
    const cc = n($('#cc')), dif = bil + mon - esp;
    $('#s_esp').textContent = clp(esp); $('#s_bil').textContent = clp(bil); $('#s_mon').textContent = clp(mon);
    $('#s_det').textContent = BILLETES.filter(b => por[b]).map(b => clp(b) + ': ' + clp(por[b])).join(' · ') || 'Sin billetes contados todavía';
    $('#s_dif').innerHTML = bil + mon === 0 ? '—' : dif === 0 ? '<span class="chip ok">Cuadra</span>' : `<span class="chip ${dif < 0 ? 'bad' : 'warn'}">${dif < 0 ? 'Faltan ' : 'Sobran '}${clp(Math.abs(dif))}</span>`;
    $('#s_dep').textContent = clp(bil - cc);
    return { esp, bil, mon, cc };
  }
  m.oninput = e => { if (e.target.matches('input')) { S.tocado = true; calc(); } };
  // de a uno: al abrir un vendedor se cierra el que estaba abierto
  const abrirEf = f => {
    filas.forEach(x => { const on = x === f; $('.efb', x).hidden = !on; $('.efh', x).setAttribute('aria-expanded', String(on)); x.classList.toggle('abierto', on); });
    if (f) { f.scrollIntoView({ block: 'nearest' }); const i = $('[data-b]', f); if (i && !cerrada && !i.value) setTimeout(() => i.focus({ preventScroll: true }), 50); }
  };
  m.addEventListener('click', e => {
    const h = e.target.closest('.efh'); if (h) { const f = h.closest('.efv'); abrirEf(f.classList.contains('abierto') ? null : f); }
  });
  calc();
  if ($('#ccSacar')) $('#ccSacar').onclick = () => sacarCajaChica(S.fecha, async () => { olvidarCache(true); purgarListas(); S.tocado = false; ir('efectivo', true); });
  if ($('#efg')) $('#efg').onclick = async () => {
    const mal = $$('[data-b],[data-m]', m).find(i => n(i) % Number(i.dataset.b || i.dataset.m));
    if (mal) { toast('Revisa los montos: cada uno debe ser múltiplo de su billete o moneda'); mal.focus(); return; }
    const b = $('#efg'); b.disabled = true;
    const datos = { cajaChica: r.cajaChicaConteo || 0, obs: r.obs || '', filas: filas.map(f => { const o = { vendedor: f.dataset.u, monedasOtras: Number(($('[data-mo]', f) || {dataset: {}}).dataset.mo || 0) }; $$('[data-b]', f).forEach(i => o['b' + i.dataset.b] = n(i) / Number(i.dataset.b)); $$('[data-m]', f).forEach(i => o['m' + i.dataset.m] = n(i) / Number(i.dataset.m)); return o; }) };
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
    <div class="kpis" style="margin-top:14px"><div><span>Venta neta</span><b>${clp(t.venta)}</b>${t.nc ? `<small>${clp(t.venta + t.nc)} − ${clp(t.nc)} en notas de crédito</small>` : ''}</div><div><span>Venta contado</span><b>${clp(t.contado)}</b></div><div><span>Crédito total</span><b>${clp(t.credito)}</b><small>${clp(t.creditoVenta)} a crédito · ${clp(t.creditoCheque)} en cheques</small></div>
      <div><span>Cobranza</span><b>${clp(t.cobranza)}</b></div><div><span>Gastos</span><b>${clp(t.gastos)}</b></div>
      <div class="cash"><span>Efectivo a recibir</span><b>${clp(t.efectivo)}</b></div></div>
    ${r.alertas.length ? `<div class="alert" id="avisos"><b>Antes de cerrar</b><ul>${r.alertas.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`
      : r.porVendedor.length ? '<div class="alert ok">Todo cuadra. Puedes cerrar la rendición.</div>' : ''}
    <div id="avc"></div>
    ${r.porVendedor.length ? '' : '<h3>Por vendedor</h3>'}
    ${r.porVendedor.length ? `<div class="row" style="margin:18px 0 8px"><h3 class="grow" style="margin:0">Por vendedor</h3>
      <button type="button" class="btn ghost sm" id="impTodos">Imprimir inspección de todos</button></div>
    <div class="vcards">${r.porVendedor.map(v => `<div class="vcard clic" data-ver="${esc(v.vendedor)}" role="button" tabindex="0" aria-label="Ver detalle de ${esc(v.vendedor)}">
      <div class="row"><b class="grow" style="font-size:17px">${esc(v.vendedor)}</b>${v.pendientes ? `<button type="button" class="chip cu" data-detallar="${esc(v.vendedor)}" title="Detallar sus folios">${v.pendientes} por detallar · Detallar ›</button>` : '<span class="chip ok">Detallado</span>'}</div>
      <dl><dt>Venta (${v.documentos} docs)</dt><dd>${clp(v.ventaDocs != null ? v.ventaDocs : v.venta)}</dd>${v.nc ? `<dt>− Notas de crédito</dt><dd>${clp(v.nc)}</dd><dt>Venta neta</dt><dd>${clp(v.venta)}</dd>` : ''}<dt>Venta contado</dt><dd>${clp(v.contado)}</dd><dt>Crédito total</dt><dd>${clp(v.credito)}</dd>
        ${v.credito ? `<dt class="sub">· a crédito</dt><dd class="sub">${clp(v.creditoVenta)}</dd><dt class="sub">· en cheques</dt><dd class="sub">${clp(v.creditoCheque)}</dd>` : ''}
        <dt>Transferencias y depósitos</dt><dd>${clp(v.TRANSFERENCIA + v.DEP_EFECTIVO)}</dd>
        ${v.descuentos ? `<dt>Descuentos</dt><dd>${clp(v.descuentos)}</dd>` : ''}<dt>Efectivo ventas</dt><dd>${clp(v.EFECTIVO)}</dd>
        ${v.cobranza ? `<dt>Cobranza</dt><dd>${clp(v.cobranza)}</dd>` : ''}${v.gastos ? `<dt>Gastos</dt><dd>− ${clp(v.gastos)}</dd>` : ''}${v.reposicion ? `<dt>Repuesto desde caja chica</dt><dd>${clp(v.reposicion)}</dd>` : ''}
        ${v.depositos ? `<dt>Depositado a la empresa</dt><dd>− ${clp(v.depositos)}${v.depositoDif ? ` <span class="chip bad">dif. ${clp(v.depositoDif)}</span>` : ''}${v.depositoExceso ? ` <span class="chip bad">${clp(v.depositoExceso)} más que el efectivo</span>` : ''}</dd>` : ''}
        <dt class="tot">Efectivo a entregar</dt><dd>${clp(v.efectivoEntregar)}</dd>
        ${v.efectivoContado === null || v.efectivoContado === undefined ? '' : `<dt>Efectivo contado</dt><dd>${clp(v.efectivoContado)} <span class="chip ${v.efectivoDif ? 'bad' : 'ok'}">${v.efectivoDif ? (v.efectivoDif < 0 ? 'Falta ' : 'Sobra ') + clp(Math.abs(v.efectivoDif)) : 'Cuadra'}</span></dd>`}
        ${v.kilos.salida ? `<dt>Kilos salida / retorno</dt><dd>${kg(v.kilos.salida)} / ${kg(v.kilos.retorno)}</dd>
          <dt>Kilos vendidos${r.hayDetalle ? ' / facturados' : ''}</dt><dd>${kg(v.kilos.vendido)}${r.hayDetalle ? ' / ' + kg(v.kilos.facturado) : ''}</dd>
          ${r.hayDetalle ? `<dt>Diferencia kilos</dt><dd class="${difCls(v) === 'neg' ? 'chip bad' : difCls(v) === 'pos' ? 'chip warn' : ''}" style="justify-self:end">${v.kilos.diferencia > 0 ? '+' : ''}${kg(v.kilos.diferencia)}</dd>
          ${v.kilos.diferenciaPesos ? `<dt>${v.kilos.diferenciaPesos > 0 ? 'Kilos faltantes' : 'Kilos sobrantes'}</dt><dd class="${difCls(v) === 'neg' ? 'chip bad' : difCls(v) === 'pos' ? 'chip warn' : ''}" style="justify-self:end">${clp(Math.abs(v.kilos.diferenciaPesos))}</dd>` : ''}` : ''}` : ''}
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
  // Avance de vendedores (v78): detallado, adelantos y última vez que el servidor recibió algo de cada uno
  api('getAvance', S.sess.token, S.fecha).then(av => {
    const box = $('#avc', m); if (!box || !document.body.contains(m) || !av.vendedores.length) return;
    const ahora = Date.parse(new Date().toLocaleString('sv-SE', { timeZone: 'America/Santiago' }).replace(' ', 'T')), esHoy = S.fecha === hoyCL();
    const cuando = u => { if (!u) return ['Sin actividad', 'mut']; const min = Math.round((ahora - Date.parse(u.replace(' ', 'T'))) / 60000), hh = u.slice(11, 16);
      return [(esHoy ? (min < 2 ? 'hace un momento' : min < 60 ? 'hace ' + min + ' min' : 'hace ' + Math.floor(min / 60) + ' h') + ' · ' : '') + hh, esHoy && min > 120 ? 'warn' : 'ok']; };
    const act = av.vendedores.filter(v => v.ultima).length, abierto = (() => { try { return localStorage.getItem('rn_avc') === '1'; } catch (e) { return false; } })();
    box.innerHTML = `<details class="avd" ${abierto ? 'open' : ''}><summary><b>Avance de vendedores</b><span class="muted">${act} de ${av.vendedores.length} con actividad hoy</span></summary>
      <p class="muted" style="margin:8px 0">Lo que cada vendedor ya envió. Si anotó sin internet, aparece cuando recupere la señal.</p>
      <div class="avs">${av.vendedores.map(v => { const a = v.adelantos, ad = a.esperando + a.aplicado + a.revisar, [t, c] = cuando(v.ultima), p = v.documentos ? Math.round(v.detallados / v.documentos * 100) : 0;
        return `<div class="av"><div class="row"><b class="grow">${esc(v.nombre)}</b><span class="chip ${c === 'warn' ? 'warn' : c === 'ok' ? 'ok' : ''}" title="Última vez que el servidor recibió algo de este vendedor">${esc(t)}</span></div>
          <div class="meter" style="margin:8px 0 4px"><div class="bar"><i style="width:${p}%"></i></div><b>${v.documentos ? v.detallados + ' de ' + v.documentos : 'Sin folios'}</b></div>
          <div class="muted">${ad ? `Adelantos: ${[a.esperando ? a.esperando + ' esperando Mi DTE' : '', a.aplicado ? a.aplicado + ' aplicados' : '', a.revisar ? a.revisar + ' por revisar' : ''].filter(Boolean).join(' · ')}` : 'Sin folios adelantados'}${v.cobranza || v.gastos || v.depositos ? ` · ${[v.cobranza ? v.cobranza + ' cobranza' : '', v.gastos ? v.gastos + ' gastos' : '', v.depositos ? v.depositos + ' depósito' + (v.depositos > 1 ? 's' : '') : ''].filter(Boolean).join(', ')}` : ''}</div></div>`; }).join('')}</div></details>`;
    $('.avd', box).ontoggle = e => { try { localStorage.setItem('rn_avc', e.target.open ? '1' : '0'); } catch (x) {} };
  }).catch(() => {});
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
      enlace(r2.url, r2.cerrada ? 'Este día está cerrado: este es el archivo definitivo.' : 'Planilla del día al día con lo último. Es siempre el mismo archivo: se actualiza solo cuando hay cambios y, al cerrar el día, queda como el definitivo.'); }
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
  let an = []; try { an = await api('anulacionesPendientes', S.sess.token); } catch (e) {}
  const card = d => `<div class="card" style="margin-bottom:10px"><div class="row">
      <div class="grow"><b>${esc(d.cliente)}</b><div class="muted">${esc(d.folio_key)} · ${esc(d.vendedor)} · ${esc(d.fecha)}</div><div style="margin-top:4px">${esc(d.motivo)}</div></div>
      <div class="big" style="font-size:24px">${clp(d.monto)}</div></div>
      <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost sm" data-no="${d.id}">Rechazar</button><button class="btn cu sm" data-si="${d.id}">Autorizar</button></div></div>`;
  const cardAn = a => `<div class="card" style="margin-bottom:10px"><div class="row">
      <div class="grow"><b>${esc(a.tipo)} ${esc(a.folio)}</b> · ${a.modo === 'COMPLETO' ? 'anulación completa' : 'por partes'}<div class="muted">${esc(a.cliente || 'Aún no llega de Mi DTE')} · ${esc(a.vendedorNombre || a.vendedor)} · ${esc(a.fecha)}${a.existe ? ' · folio de ' + clp(a.totalDoc) : ''}</div>
        ${a.lineas.length ? `<div style="margin-top:4px">${a.lineas.map(l => `${esc(l.producto)}: ${nk(l.cantidad)} ${l.unidad === 'UN' ? 'un' : 'kg'} · ${clp(l.monto)}`).join('<br>')}</div>` : ''}
        <div style="margin-top:4px">${esc(a.motivo)}${a.reemplazo ? ' · lo reemplaza el folio ' + esc(a.reemplazo) : ''} · <b>${a.vuelve ? 'el producto volvió a la bodega' : 'el producto no volvió'}</b></div></div>
      <div class="big" style="font-size:24px">${clp(a.monto)}</div></div>
      <label class="f" style="margin:10px 0 0">N° de la nota de crédito en Mi DTE (opcional, evita contarla dos veces)<input class="in n" data-nc="${esc(a.id)}" inputmode="numeric" autocomplete="off"></label>
      <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost sm" data-ano="${esc(a.id)}">Rechazar</button><button class="btn cu sm" data-asi="${esc(a.id)}">Aprobar</button></div></div>`;
  render(m, `<h2>Por autorizar</h2><p class="lead">Descuentos y anulaciones o notas de crédito que piden los vendedores.</p>`
    + (an.length ? `<h3 style="margin:14px 0 6px">Anulaciones y notas de crédito (${an.length})</h3>` + an.map(cardAn).join('') : '')
    + (ds.length ? `<h3 style="margin:14px 0 6px">Descuentos (${ds.length})</h3>` + ds.map(card).join('') : '')
    + (!ds.length && !an.length ? '<div class="empty"><b>Nada pendiente</b>No hay descuentos ni anulaciones esperando autorización.</div>' : ''));
  m.onclick = async e => { const si = e.target.dataset.si, no = e.target.dataset.no, asi = e.target.dataset.asi, ano = e.target.dataset.ano;
    if (asi || ano) { const id = asi || ano, nc = $('[data-nc="' + id + '"]', m); e.target.disabled = true;
      try { await api('resolverAnulacion', S.sess.token, id, !!asi, nc ? nc.value : '', ''); toast(asi ? 'Anulación aprobada' : 'Anulación rechazada'); olvidarCache(false); ir('descuentos'); } finally { e.target.disabled = false; } return; }
    if (!si && !no) return;
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
  // El depósito no se asocia a folios: se compara en plata. Efectivo del día (ventas + cobranza) contra lo depositado.
  const q = r.resumen || (() => { const ev = r.folios.reduce((t, x) => t + x.efectivo, 0), ec = r.cobranzas.reduce((t, x) => t + x.efectivo, 0), dp = r.depositos.reduce((t, x) => t + x.monto, 0);
    return { efectivoVentas: ev, efectivoCobranza: ec, gastos: 0, disponible: ev + ec, depositado: dp, saldo: ev + ec - dp }; })();
  const sinMov = !q.efectivoVentas && !q.efectivoCobranza && !q.depositado && !r.depositos.length;
  render(m, `<h2>Depósito</h2>
    ${esV ? '' : `<div class="row" style="margin-bottom:12px"><select class="in" style="width:auto" id="dv">${opcVend(S.vend)}</select></div>`}
    ${esV ? '<p class="muted" style="margin:-4px 2px 10px">Solo si depositaste efectivo antes de rendir. Si no, no necesitas hacer nada aquí.</p>' : ''}
    <div class="card dsaldo ${esV || q.saldo <= 0 ? 'listo' : ''}"><small>${esV ? 'Depositado ' + (S.fecha === hoyCL() ? 'hoy' : 'este día') : q.saldo < 0 ? 'Depositaron de más' : q.saldo === 0 && q.depositado ? 'Todo depositado' : 'Sin depositar'}</small><b>${clp(esV ? q.depositado : Math.abs(q.saldo))}</b>
      <div class="dl2"><span>Efectivo del día ${clp(q.disponible)}</span>${esV ? '' : `<span>Depositado ${clp(q.depositado)}</span>`}</div></div>
    ${cerrada ? '<div class="alert">La rendición de este día está cerrada. Solo lectura.</div>' : `<div class="card">
      <label class="f">¿En qué banco?</label>
      <div class="b3" id="dbs">${S.cat.bancos.map(b => `<button type="button" data-b="${esc(b)}">${esc(b)}</button>`).join('')}</div><input type="hidden" id="db" value="">
      <label class="f" for="dm">Monto depositado</label><input class="in n gmon" id="dm" inputmode="numeric" value="${!esV && q.saldo > 0 ? q.saldo : ''}" placeholder="$ 0">
      <label class="f" for="dr" style="margin-top:6px">N° de operación <span class="muted">(opcional)</span></label><input class="in" id="dr" inputmode="numeric" placeholder="Ej. 48213390">
      <div id="dsal"></div>
      <button class="btn cu block" id="dg" style="margin-top:8px">Registrar depósito</button></div>`}
    <details class="mas" style="margin:0 0 12px"><summary>Cómo se calcula</summary><ul class="info">
      <li>Efectivo de las ventas: <b>${clp(q.efectivoVentas)}</b></li><li>Efectivo de cobranza: <b>${clp(q.efectivoCobranza)}</b></li>
      <li>Ya depositado: <b>− ${clp(q.depositado)}</b></li></ul></details>
    <div class="csec">Depositado ${S.fecha === hoyCL() ? 'hoy' : 'este día'}</div>
    ${r.depositos.length ? r.depositos.map(d => `<div class="card" style="margin-bottom:8px"><div class="row">
      <div class="grow"><b>${esc(d.banco)}</b> ${d.referencia ? '· N° ' + esc(d.referencia) : ''}${d.por ? `<div class="muted">Registró ${esc(d.por)}</div>` : ''}
        ${d.folios.length || d.cobranzas.length ? `<div class="muted">Registrado con ${d.folios.length + d.cobranzas.length} folio(s) asociados</div>` : ''}
        <div style="margin-top:6px">${chipsAdj(d.adjuntos, 'DEPOSITOS', d.id, !cerrada || !esV)}</div></div>
      <div class="big" style="font-size:22px">${clp(d.monto)}</div>${cerrada ? '' : `<button class="x" style="width:42px" data-del="${d.id}" aria-label="Borrar depósito">×</button>`}</div></div>`).join('')
    : `<div class="empty">${sinMov ? 'Hoy no hay efectivo ni depósitos.' : 'Sin depósitos este día.'}</div>`}`);
  if (!esV) $('#dv').onchange = e => { S.vend = e.target.value; ir('depositos'); };
  m.onclick = async e => { const id = e.target.dataset.del; if (!id || !confirm('¿Borrar este depósito?')) return;
    await api('borrarDeposito', S.sess.token, id); toast('Depósito borrado'); ir('depositos'); };
  activarAdjuntarDespues(m, () => ir('depositos'));
  if (cerrada) return;
  const dm = $('#dm');
  $('#dbs').onclick = e => { const b = e.target.closest('[data-b]'); if (!b) return; $('#db').value = b.dataset.b; $$('#dbs button').forEach(x => x.classList.toggle('on', x === b)); };
  const aviso = () => {
    const mon = soloDigitos(dm.value), resta = q.saldo - mon;
    $('#dsal').innerHTML = mon && !esV ? `<div class="saldo ${resta >= 0 ? 'ok' : 'no'}"><span>Después de este depósito</span><span>${resta > 0 ? 'Faltarían ' + clp(resta) : resta < 0 ? 'Más que el efectivo: ' + clp(-resta) : 'Queda todo depositado'}</span></div>` : '';
  };
  dm.oninput = aviso; aviso();
  $('#dg').onclick = async () => {
    const mon = soloDigitos(dm.value);
    if (!$('#db').value) return toast('Elige el banco del depósito.', true);
    if (!mon) return toast('Escribe el monto depositado.', true);
    const b = $('#dg'); b.disabled = true;
    try {
      if (COLA.length || pendActivos().length) { toast('Aún se están guardando folios. Espera unos segundos y vuelve a intentar.', true); return; }
      let saldo = q.saldo;
      if (EN_LINEA) {      // última revisión: si el efectivo cambió desde que se abrió la pantalla, no se guarda a ciegas
        const f = await frescoDep(esV), q2 = f.resumen || q;
        if (q2.disponible !== q.disponible) { toast('El efectivo del día cambió (se detallaron más pagos). Revisa el monto antes de depositar.', true); ir('depositos'); return; }
        saldo = q2.saldo;
      }
      if (!esV && mon > saldo && !confirm(`Vas a registrar ${clp(mon)} y solo quedan ${clp(Math.max(saldo, 0))} por depositar. ¿Registrar igual?`)) return;
      const nuevo = await api('guardarDeposito', S.sess.token, S.fecha, { vendedor: esV ? '' : S.vend, banco: $('#db').value, monto: mon, referencia: $('#dr').value, folios: [], cobranzas: [] });
      const resta = saldo - mon;
      toast((nuevo._pendiente ? 'Depósito guardado en el teléfono (sin conexión)' : 'Depósito registrado') + (esV ? '' : resta > 0 ? `. Faltan ${clp(resta)} por depositar` : resta < 0 ? `. Depositaste ${clp(-resta)} más que el efectivo` : '. Queda todo depositado'));
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
    <input class="in" id="cq" placeholder="Nombre, RUT o folio" autocomplete="off" inputmode="search" style="margin-top:10px"><div id="cres" style="margin-top:8px"></div><div id="cpan"></div></div>`;
  const res = $('#cres', box), pan = $('#cpan', box);
  const lista = q => {
    const n = normBus(q), fq = String(q || '').replace(/\D/g, '');         // si lo escrito son números, también se busca entre los folios de cada cliente
    const porFolio = c => fq.length >= 2 ? c.facturas.filter(f => String(f.folio).indexOf(fq) >= 0) : [];
    const xs = (n ? clientes.filter(c => normBus(c.cliente).indexOf(n) >= 0 || normBus(c.rut).indexOf(n) >= 0 || porFolio(c).length) : clientes.slice().sort((a, b) => b.deuda - a.deuda)).slice(0, 8);
    res.innerHTML = xs.length ? xs.map(c => { const pf = porFolio(c);
      return `<button type="button" class="cli" data-k="${esc(c.clave)}"><span class="grow"><b>${esc(c.cliente)}</b><small>${c.facturas.length} factura${c.facturas.length > 1 ? 's' : ''}${pf.length ? ' · <b style="color:var(--cu-2)">Folio ' + pf.map(f => esc(f.folio)).slice(0, 3).join(', ') + '</b>' : ''}</small></span><b>${clp(c.deuda)}</b><span class="bt">Elegir</span></button>`; }).join('')
      : '<div class="muted">Ningún cliente con deuda coincide.</div>';
  };
  lista('');
  $('#cq', box).oninput = e => { pan.innerHTML = ''; lista(e.target.value); };
  res.onclick = e => { const b = e.target.closest('.cli'); if (!b || res.dataset.ocupado) return; res.dataset.ocupado = '1';
    const c = clientes.find(x => x.clave === b.dataset.k), fq = String($('#cq', box).value || '').replace(/\D/g, '');
    $$('.cli', res).forEach(x => x.classList.add(x === b ? 'sel' : 'apag'));          // el elegido queda marcado y los demás se desvanecen
    setTimeout(() => { delete res.dataset.ocupado; abrirCliente(c, fq); }, 220); };
  function abrirCliente(c, folioBuscado) {
    res.innerHTML = '';
    const forma = { value: 'EFECTIVO' }, bancoSel = { value: S.cat.bancos[0] };
    pan.innerHTML = `<div class="cpan enter2"><button type="button" class="volver" id="cvolver">‹ Ver otros clientes</button>
      <div class="cselc"><span class="grow"><b>${esc(c.cliente)}</b><small>${c.facturas.length} factura${c.facturas.length > 1 ? 's' : ''} · toca "Cobrar" en la que pagó</small></span><b>${clp(c.deuda)}</b></div>
      <div id="cfacs" style="margin-top:8px">${c.facturas.map((f, i) => `<div class="cfac" data-i="${i}"><button type="button" class="cfh" data-i="${i}"><span class="grow"><b>${esc(f.tipo.replace(' Electrónica', ''))} ${esc(f.folio)}</b>${f.cheque ? ' <span class="chip warn">Cheque en cartera</span>' : ''}
          <small>Hace ${f.dias} días${f.venc && f.venc < r.hoy ? ' · <b class="bad">Vencida</b>' : ''}</small></span><b>${clp(f.saldo)}</b><span class="bt">Cobrar</span></button>
        <div class="cform" hidden></div></div>`).join('')}</div></div>`;
    $('#cvolver', pan).onclick = () => { const p = $('.cpan', pan); if (p) p.classList.add('sale2'); setTimeout(() => { pan.innerHTML = ''; lista($('#cq', box).value); res.classList.remove('enter2'); void res.offsetWidth; res.classList.add('enter2'); }, 160); };
    const cerrar = () => $$('.cfac.abierta', pan).forEach(d => { d.classList.remove('abierta'); const f = $('.cform', d); f.hidden = true; f.innerHTML = ''; $('.bt', d).textContent = 'Cobrar'; });
    function abrir(i) {
      const f = c.facturas[i], d = $('.cfac[data-i="' + i + '"]', pan), fm = $('.cform', d);
      if (d.classList.contains('abierta')) { cerrar(); return; }
      cerrar();
      d.classList.add('abierta'); fm.hidden = false; $('.bt', d).textContent = 'Cerrar';
      // Una o más formas de pago (pago mixto): cada línea con su forma, su banco (solo transferencia), sus datos de cheque y su monto.
      const FORMAS_C = [['EFECTIVO', 'Efectivo'], ['TRANSFERENCIA', 'Transferencia'], ['CHEQUE', 'Cheque']];
      let lineas = [{ forma: 'EFECTIVO', banco: S.cat.bancos[0], monto: f.saldo, ch: null }];
      const total = () => lineas.reduce((a, l) => a + (Number(l.monto) || 0), 0);
      const guardarChs = () => $$('.lc', fm).forEach(box => { const l = lineas[+box.dataset.i], c = $('.cheque', box); if (l && c) l.ch = leerCheque(c).datos; });
      const estado = () => { const t = total(), dif = f.saldo - t, e = $('#cest', fm); if (!e) return;
        e.className = 'cest ' + (t <= 0 ? '' : dif === 0 ? 'ok' : dif > 0 ? 'abono' : 'mas');
        e.innerHTML = lineas.length > 1 || t !== f.saldo ? (t <= 0 ? 'Escribe el monto' : `Paga <b>${clp(t)}</b> · ${dif === 0 ? 'cuadra con la factura ✓' : dif > 0 ? 'queda debiendo ' + clp(dif) : 'son ' + clp(-dif) + ' más que la factura'}`) : '';
        const b = $('#cok', fm); if (b) b.textContent = 'Registrar cobro ' + clp(t); };
      const dibujar = () => {
        $('#clin', fm).innerHTML = lineas.map((l, i) => `<div class="lc" data-i="${i}">
          ${lineas.length > 1 ? `<div class="row" style="margin-bottom:6px"><b class="grow muted">Pago ${i + 1}</b><button type="button" class="x" data-del="${i}" aria-label="Quitar este pago">×</button></div>` : ''}
          <div class="chips2" data-f="${i}">${FORMAS_C.map(([v, t]) => `<button type="button" data-v="${v}" class="${l.forma === v ? 'on' : ''}">${t}</button>`).join('')}</div>
          ${l.forma === 'TRANSFERENCIA' ? `<div style="margin-top:10px"><label class="f">Banco</label><select class="in" data-bk="${i}">${S.cat.bancos.map(b => `<option value="${esc(b)}" ${b === l.banco ? 'selected' : ''}>${esc(b.charAt(0) + b.slice(1).toLowerCase())}</option>`).join('')}</select></div>` : ''}
          ${l.forma === 'CHEQUE' ? `<div style="margin-top:10px">${camposCheque(l.ch, 'cobro' + i)}</div>` : ''}
          <div style="margin-top:10px"><label class="f">Monto</label><input class="in n" data-mt="${i}" inputmode="numeric" value="${l.monto || ''}"></div></div>`).join('');
        $$('.cheque', fm).forEach(avisoTipoCheque); estado(); };
      fm.innerHTML = `<div class="csec" style="margin-top:4px">¿Cómo pagó?</div><div id="clin"></div>
        <button type="button" class="btn ghost sm" id="cmas" style="margin-top:10px">+ Pagó una parte de otra forma</button>
        <div id="cest" class="cest"></div>
        <button class="btn cu block" id="cok" type="button" style="margin-top:12px">Registrar cobro</button>`;
      dibujar();
      $('#clin', fm).addEventListener('click', e => {
        const bf = e.target.closest('.chips2 button'), del = e.target.closest('[data-del]');
        if (bf) { guardarChs(); const l = lineas[+bf.parentNode.dataset.f]; l.forma = bf.dataset.v; dibujar(); }
        else if (del) { guardarChs(); lineas.splice(+del.dataset.del, 1); dibujar(); }
      });
      $('#clin', fm).addEventListener('input', e => { const i = e.target.dataset.mt; if (i !== undefined) { lineas[+i].monto = soloDigitos(e.target.value); estado(); } });
      $('#clin', fm).addEventListener('change', e => { const i = e.target.dataset.bk; if (i !== undefined) lineas[+i].banco = e.target.value; });
      $('#cmas', fm).onclick = () => { guardarChs(); const resto = Math.max(0, f.saldo - total());
        if (lineas.length === 1 && resto === 0) lineas[0].monto = Math.round(f.saldo / 2);       // pagó todo en una línea: se parte para repartir
        lineas.push({ forma: lineas.some(l => l.forma === 'EFECTIVO') ? 'TRANSFERENCIA' : 'EFECTIVO', banco: S.cat.bancos[0], monto: Math.max(0, f.saldo - total()), ch: null });
        if (lineas.length > 4) { lineas.pop(); return toast('Máximo 4 formas de pago.', true); }
        dibujar(); };
      $('#cok', fm).onclick = async () => {
        guardarChs();
        const t = total();
        if (!(t > 0)) return toast('Escribe el monto que paga.', true);
        if (lineas.some(l => !(Number(l.monto) > 0))) return toast('Hay un pago sin monto.', true);
        if (t > f.saldo && !confirm('Paga más de lo que debe (' + clp(t) + ' de ' + clp(f.saldo) + '). ¿Registrar igual?')) return;
        const pagos = [];
        for (let i = 0; i < lineas.length; i++) { const l = lineas[i], p = { forma: l.forma, monto: Number(l.monto) };
          if (l.forma === 'TRANSFERENCIA') p.banco = l.banco;
          if (l.forma === 'CHEQUE') { const c = $('.lc[data-i="' + i + '"] .cheque', fm), ch = leerCheque(c); if (ch.error) return toast((lineas.length > 1 ? 'Pago ' + (i + 1) + ': ' : '') + ch.error, true); Object.assign(p, ch.datos); }
          pagos.push(p); }
        const b = $('#cok', fm), libre = botonOcupado(b, 'Registrando cobro…'); fm.classList.add('guardando');
        try {
          const rr = await api('guardarCobro', S.sess.token, S.fecha, { cliente: c.cliente, rut: c.rut }, pagos, [{ folio_key: f.folio_key, folio: f.folio, monto: t }]);
          toast((rr._pendiente ? 'Cobro guardado en el teléfono (sin conexión): ' : 'Cobro registrado: ') + clp(t));
          await alTerminar();
        } finally { libre(); fm.classList.remove('guardando'); }
      };
      d.scrollIntoView({ block: 'nearest' });
    }
    $('#cfacs', pan).onclick = e => { const h = e.target.closest('.cfh'); if (h) abrir(+h.dataset.i); };
    if (folioBuscado && folioBuscado.length >= 2) { const i = c.facturas.findIndex(f => String(f.folio).indexOf(folioBuscado) >= 0); if (i >= 0) abrir(i); }
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
  GASTOS: { t: 'Gastos', d: 'Combustible, peajes, almuerzo y otros gastos del día. El gasto del día se resta de lo que entregas; al otro día se repone desde la caja chica.',
    f: [['concepto', 'Concepto'], ['monto', 'Monto', 'n'], ['respaldo', 'N° de boleta'], ['responsable', 'Responsable', 'vend'], ['obs', 'Observación']] }
};
async function vMov(m, tabla) {
  const cfg = MOV[tabla], esV = S.sess.rol === 'VENDEDOR';
  if (tabla === 'GASTOS' && esV) return vGastosV(m);
  const campos = cfg.f.filter(c => !(esV && c[2] === 'vend'));
  const inp = c => c[2] === 'forma' ? `<select class="in" name="${c[0]}" id="m_${c[0]}">${S.cat.formas.filter(f => f !== 'CREDITO').map(f => `<option value="${f}">${FL[f]}</option>`).join('')}</select>`
    : c[2] === 'banco' ? `<select class="in" name="${c[0]}" id="m_${c[0]}"><option value="">—</option>${S.cat.bancos.map(b => `<option>${b}</option>`).join('')}</select>`
    : c[2] === 'vend' ? `<select class="in" name="${c[0]}" id="m_${c[0]}">${tabla === 'GASTOS' ? '<option value="GENERAL">General / planta</option>' : ''}${opcVend(S.vend)}</select>`
    : tabla === 'COBRANZA' && c[0] === 'cliente' && clientesLista.length ? `<div class="cpick"><input class="in" id="m_cliente_q" placeholder="Busca y elige el cliente" autocomplete="off"><input type="hidden" name="cliente" id="m_cliente"><input type="hidden" name="rut" id="m_rut"><div id="m_cliente_l" class="cpl" hidden></div></div>`
    : `<input class="in ${c[2] === 'n' ? 'n' : ''}" name="${c[0]}" id="m_${c[0]}" ${c[2] === 'n' ? 'inputmode="numeric"' : ''}>`;
  const rows = await api('listarMov', S.sess.token, tabla, S.fecha);
  const conAdj = !!ADJ[tabla] && tabla !== 'COBRANZA' && tabla !== 'GASTOS';        // la cobranza ya no lleva foto (se registra también sin internet)
  let clientesLista = [];
  if (tabla === 'COBRANZA') {
    try { clientesLista = (await api('listarClientes', S.sess.token) || []).slice(); } catch (e) {}
    // también los clientes con deuda cargada (planilla de crédito) que aún no aparecen en las Ventas Diarias
    try { const pc = await api('porCobrar', S.sess.token); const vistos = new Set(clientesLista.map(c => normBus(c.nombre)));
      ((pc && pc.clientes) || []).forEach(c => { if (c.cliente && !vistos.has(normBus(c.cliente))) { vistos.add(normBus(c.cliente)); clientesLista.push({ rut: c.rut || '', nombre: c.cliente }); } });
      clientesLista.sort((x, y) => String(x.nombre).localeCompare(String(y.nombre), 'es')); } catch (e) {}
  }
  const simple = tabla === 'COBRANZA' && esV;
  render(m, `<h2>${cfg.t}</h2>${simple ? '' : `<p class="lead">${cfg.d}</p>`}
    ${tabla === 'COBRANZA' ? '<div id="cbx" style="margin-bottom:14px"></div>' + (simple ? '<div id="ml" style="margin-top:6px"></div>' : '') + '<details class="manual"><summary>' + (simple ? 'Registrar un pago sin la lista' : 'Registrar un pago a mano (sin usar la lista)') + '</summary>' : ''}
    <div class="card">${tabla === 'GASTOS' ? (() => {
        const celda = c => `<div><label class="f" for="m_${c[0]}">${c[1]}</label>${inp(c)}</div>`, extra = c => c[0] === 'respaldo' || c[0] === 'obs';
        return `<div id="fm"><div class="grid g2">${campos.filter(c => !extra(c)).map(celda).join('')}</div>
          <details class="mas"><summary>Agregar N° de boleta u observación</summary><div class="grid g2" style="margin-top:8px">${campos.filter(extra).map(celda).join('')}</div></details></div>`; })()
      : `<div class="grid g3" id="fm">${campos.map(c => `<div><label class="f" for="m_${c[0]}">${c[1]}</label>${inp(c)}</div>`).join('')}</div>`}
      ${tabla === 'COBRANZA' ? `<div id="mch" hidden style="margin-top:12px"><div class="pregunta" style="margin-top:0">Datos del cheque</div>${camposCheque(null, 'mov')}</div>` : ''}
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn cu" id="ad">Agregar</button></div></div>
    ${tabla === 'COBRANZA' ? '</details>' : ''}
    ${simple ? '' : '<div id="ml" style="margin-top:16px"></div>'}`);
  function lista(rows) {
    if (simple) {
      $('#ml').innerHTML = rows.length ? `<div class="csec" style="margin-top:4px">Cobrado hoy · ${clp(rows.reduce((a, r) => a + r.monto, 0))}</div>` + rows.map(r =>
        `<div class="hrow"><span class="grow">${esc(r.cliente)}<small>Fact. ${esc(r.folio)} · ${FL[r.forma] || esc(r.forma)}${r._pendiente || String(r.id).indexOf('pend_') === 0 ? ' · en el teléfono' : ''}</small></span><b>${clp(r.monto)}</b>
        <button class="x" style="min-height:34px;width:34px" data-id="${r.id}" aria-label="Borrar">×</button></div>`).join('') : '';
      return;
    }
    const cols = campos.map(c => c[0]);
    $('#ml').innerHTML = rows.length ? `<div class="tw"><table><thead><tr>${campos.map(c => `<th class="${c[2] === 'n' ? 'r' : ''}">${c[1]}</th>`).join('')}${conAdj ? '<th>Respaldo</th>' : ''}<th>Registró</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr>${cols.map(k => `<td class="${k === 'monto' ? 'r' : ''}">${k === 'monto' ? clp(r[k]) : k === 'forma' ? (FL[r[k]] || esc(r[k])) : esc(r[k])}</td>`).join('')}
        ${conAdj ? `<td>${chipsAdj(r.adjuntos, tabla, r.id, true)}</td>` : ''}
        <td class="muted">${esc(r.por || '')}</td>
        <td><button class="x" style="min-height:34px;width:34px" data-id="${r.id}" aria-label="Borrar">×</button></td></tr>`).join('')}
      </tbody><tfoot><tr>${cols.map(k => `<td class="r">${k === 'monto' ? clp(rows.reduce((a, r) => a + r.monto, 0)) : ''}</td>`).join('')}${conAdj ? '<td></td>' : ''}<td></td><td></td></tr></tfoot></table></div>`
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
  if (conAdj) activarAdjuntarDespues($('#ml'), recargar);
  // cobranza: el cliente se elige de la lista (razón social del DTE), no se escribe
  const cq = $('#m_cliente_q');
  if (cq) {
    const cl = $('#m_cliente_l'), elegir = c => { $('#m_cliente').value = c ? c.nombre : ''; $('#m_rut').value = c ? c.rut : ''; cq.value = c ? c.nombre : cq.value; cl.hidden = true; cq.classList.toggle('okc', !!c); };
    const pintar = () => { const n = normBus(cq.value); const xs = (n ? clientesLista.filter(c => normBus(c.nombre).indexOf(n) >= 0 || normBus(c.rut).indexOf(n) >= 0) : clientesLista).slice(0, 8);
      const txt = cq.value.trim();
      cl.innerHTML = (xs.length ? xs.map((c, i) => `<button type="button" class="cli" data-i="${i}"><span class="grow"><b>${esc(c.nombre)}</b><small>${esc(c.rut || 'Sin RUT')}</small></span></button>`).join('') : '<div class="muted" style="padding:8px">Ningún cliente coincide.</div>')
        + (txt.length >= 3 ? `<button type="button" class="cli" data-otro="1"><span class="grow"><b>Usar «${esc(txt)}»</b><small>Cliente que no está en la lista</small></span></button>` : '');
      cl.hidden = false; cl._xs = xs; };
    cq.oninput = () => { elegir(null); pintar(); }; cq.onfocus = () => { pintar(); setTimeout(() => { try { cq.scrollIntoView({ block: 'start' }); } catch (e) {} }, 120); };
    cl.onclick = e => { const o = e.target.closest('[data-otro]'); if (o) return elegir({ nombre: cq.value.trim().toUpperCase(), rut: '' }); const b = e.target.closest('[data-i]'); if (b) elegir(cl._xs[+b.dataset.i]); };
  }
  $('#ml').onclick = async e => { const id = e.target.dataset.id; if (!id || !confirm('¿Borrar este registro?')) return;
    await api('borrarMov', S.sess.token, tabla, id); lista(await api('listarMov', S.sess.token, tabla, S.fecha)); };
  // cobranza con cheque: se piden sus datos y el banco pasa a ser el del cheque
  const mf = $('#m_forma'), mch = $('#mch');
  const mbW = $('#m_banco') ? $('#m_banco').parentNode : null;           // el banco solo se pregunta si es transferencia
  const verBanco = () => { const tr = mf.value === 'TRANSFERENCIA' || mf.value === 'DEP_EFECTIVO', mb = $('#m_banco'); if (!mb) return; if (mbW) mbW.hidden = !tr; mb.disabled = !tr; if (!tr) mb.value = ''; };
  if (mf && tabla === 'COBRANZA') verBanco();
  if (mf && mch) mf.onchange = () => { const ch = mf.value === 'CHEQUE'; mch.hidden = !ch; verBanco();
    if (ch) avisoTipoCheque($('.cheque', mch)); };
  $('#ad').onclick = async () => {
    const o = {}; $$('[name]', $('#fm')).forEach(x => o[x.name] = x.value);
    o.monto = String(soloDigitos(o.monto));
    if (cq && !o.cliente) return toast('Elige el cliente de la lista.', true);
    if (mch && o.forma === 'CHEQUE') { const r = leerCheque($('.cheque', mch)); if (r.error) return toast(r.error, true); Object.assign(o, r.datos); }
    if (o.monto === '0') return toast('Ingresa el monto.', true);
    if (tabla === 'COBRANZA') { o.folio = String(o.folio || '').replace(/\D/g, ''); if (!o.folio) return toast('Falta el folio de la factura que paga. Es obligatorio.', true); }
    if ((o.forma === 'TRANSFERENCIA' || o.forma === 'DEP_EFECTIVO') && 'banco' in o && !o.banco) return toast('Indica el banco.', true);
    const b = $('#ad'), libre = botonOcupado(b, 'Guardando…');
    try {
      const nuevo = await api('guardarMov', S.sess.token, tabla, S.fecha, o); toast(nuevo._pendiente ? 'Guardado en el teléfono (sin conexión)' : 'Agregado');
      $$('input', $('#fm')).forEach(x => x.value = ''); if (cq) cq.classList.remove('okc');
      if (mch) { $$('input:not([type=date])', mch).forEach(x => x.value = ''); $('[data-c="banco"]', mch).value = ''; }
      await recargar();
    } finally { b.disabled = false; }
  };
}


/* ---------- Gastos del vendedor (v100): conceptos en botones, solo el monto a mano ---------- */
const CONCEPTOS_GASTO = ['Combustible', 'Peaje', 'Almuerzo', 'Estacionamiento', 'Otro'];
async function vGastosV(m) {
  const rows = await api('listarMov', S.sess.token, 'GASTOS', S.fecha);
  let sel = '';
  render(m, `<h2>Gastos</h2>
    <div class="gtot"><small>Gastado ${S.fecha === hoyCL() ? 'hoy' : 'este día'}</small><b id="gt"></b><small>Se resta de lo que entregas hoy</small></div>
    <div class="card" id="fm">
      <label class="f">¿En qué gastaste?</label>
      <div class="gch" id="gc">${CONCEPTOS_GASTO.map(c => `<button type="button" data-c="${c}">${c}</button>`).join('')}</div>
      <div id="gotro" hidden><input class="in" id="m_otro" placeholder="Ej. Reparación, estacionamiento…" maxlength="60"></div>
      <label class="f" for="m_monto" style="margin-top:6px">Monto</label>
      <input class="in n gmon" id="m_monto" inputmode="numeric" placeholder="$ 0" autocomplete="off">
      <button class="btn cu block" id="ad" style="margin-top:10px">Registrar gasto</button>
      <details class="mas" style="margin-top:8px"><summary>Agregar N° de boleta o nota</summary><div class="grid g2" style="margin-top:8px">
        <div><label class="f" for="m_respaldo">N° de boleta</label><input class="in" id="m_respaldo" inputmode="numeric"></div>
        <div><label class="f" for="m_obs">Nota</label><input class="in" id="m_obs"></div></div></details>
    </div>
    <div class="csec" id="gh"></div><div id="ml"></div>`);
  const lista = rs => {
    $('#gt').textContent = clp(rs.reduce((a, r) => a + r.monto, 0));
    $('#gh').textContent = rs.length ? (S.fecha === hoyCL() ? 'Hoy' : 'Este día') + ' · ' + rs.length : '';
    $('#ml').innerHTML = rs.length ? `<div class="card" style="padding:4px 14px">${rs.map(r => `<div class="hrow"><span class="grow">${esc(r.concepto)}<small>${r.respaldo ? 'Boleta ' + esc(r.respaldo) + ' · ' : ''}${r._pendiente || String(r.id).indexOf('pend_') === 0 ? 'en el teléfono' : ''}</small></span><b>${clp(r.monto)}</b>
      <button class="x" style="min-height:34px;width:34px" data-id="${r.id}" aria-label="Borrar">×</button></div>`).join('')}</div>`
      : '<div class="empty">Aún no registras gastos.</div>';
  };
  lista(rows);
  const recargar = async () => lista(await api('listarMov', S.sess.token, 'GASTOS', S.fecha));
  activarAdjuntarDespues($('#ml'), recargar);
  $('#gc').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; sel = b.dataset.c;
    $$('#gc button').forEach(x => x.classList.toggle('on', x === b)); $('#gotro').hidden = sel !== 'Otro'; if (sel === 'Otro') $('#m_otro').focus(); else $('#m_monto').focus(); };
  $('#ml').onclick = async e => { const id = e.target.dataset.id; if (!id || !confirm('¿Borrar este gasto?')) return;
    await api('borrarMov', S.sess.token, 'GASTOS', id); await recargar(); };
  $('#ad').onclick = async () => {
    const concepto = sel === 'Otro' ? $('#m_otro').value.trim() : sel, monto = soloDigitos($('#m_monto').value);
    if (!sel) return toast('Elige en qué gastaste.', true);
    if (!concepto) return toast('Escribe en qué gastaste.', true);
    if (!monto) return toast('Escribe el monto.', true);
    const b = $('#ad'); b.disabled = true;
    try {
      const nuevo = await api('guardarMov', S.sess.token, 'GASTOS', S.fecha, { concepto, monto: String(monto), respaldo: $('#m_respaldo').value, obs: $('#m_obs').value });
      toast(nuevo._pendiente ? 'Guardado en el teléfono (sin conexión)' : 'Gasto registrado');
      sel = ''; $$('#gc button').forEach(x => x.classList.remove('on')); $('#gotro').hidden = true; $('#m_otro').value = ''; $('#m_monto').value = ''; $('#m_respaldo').value = ''; $('#m_obs').value = '';
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


/* ============ CÓMO VA EL NEGOCIO (solo ADMIN, v50) ============
   Indicadores de un período explicados en lenguaje simple: semáforo por tema, resumen en frases, gráficos y "qué podrías hacer".
   Todo lo calcula el servidor (`getKpis`); acá solo se dibuja. Colores propios (no los de la app). */
async function vDatos(m) {
  const hoy = hoyCL(), sumar = (f, n) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
  const mes1 = hoy.slice(0, 8) + '01';
  const PER = { 7: ['7 días', () => [sumar(hoy, -6), hoy]], 30: ['30 días', () => [sumar(hoy, -29), hoy]], 90: ['90 días', () => [sumar(hoy, -89), hoy]],
    mes: ['Este mes', () => [mes1, hoy]], ant: ['Mes pasado', () => { const a = new Date(mes1 + 'T12:00:00'); a.setMonth(a.getMonth() - 1); return [a.toLocaleDateString('en-CA'), sumar(mes1, -1)]; }] };
  S.datos = S.datos || { p: '30', desde: '', hasta: '' };
  const rango = () => S.datos.p === 'x' && S.datos.desde && S.datos.hasta ? [S.datos.desde, S.datos.hasta] : PER[S.datos.p in PER ? S.datos.p : '30'][1]();
  const n1 = n => (Math.round(Number(n) * 10) / 10).toLocaleString('es-CL');
  const kg = n => n1(n) + ' kg', pct = n => n1(n) + '%', plural = (n, a, b) => n === 1 ? a : b;
  const ETQ = { ok: 'Bien', warn: 'Atención', bad: 'Crítico', na: 'Sin dato' };
  const pill = (e, t) => `<span class="dkp ${e}">${t || ETQ[e]}</span>`;
  const mejor = (...xs) => xs.includes('bad') ? 'bad' : xs.includes('warn') ? 'warn' : 'ok';
  const kpi = (t, v, hint, extra) => `<div class="dkk"><span class="dkk-t">${t}</span><b>${v}</b>${extra ? `<div>${extra}</div>` : ''}<small>${hint}</small></div>`;
  const delta = x => x == null ? '' : `<span class="dkp ${x >= 0 ? 'ok' : 'bad'}">${x >= 0 ? '▲ Subió' : '▼ Bajó'} ${pct(Math.abs(x))} vs. período anterior</span>`;
  const aprende = (titulo, items) => `<details class="dkh"><summary>${titulo}</summary><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul></details>`;
  const haz = xs => xs.length ? `<div class="dkdo"><b>Qué podrías hacer</b><ul>${xs.map(x => `<li>${x}</li>`).join('')}</ul></div>` : '';
  const ranking = (xs, fmt, opc = {}) => { const mx = Math.max(1, ...xs.map(x => Math.abs(x.v)));
    return xs.length ? xs.map((x, i) => `<div class="dkr1"><div class="dkr1h"><span><em>${i + 1}</em>${esc(x.l)}</span><b>${fmt(x.v)}</b></div>
      <div class="dkt"><i style="width:${Math.max(x.v ? 2 : 0, Math.abs(x.v) / mx * 100)}%;background:${x.c || opc.c || 'var(--c)'}"></i></div>${x.s ? `<small>${x.s}</small>` : ''}</div>`).join('') : '<div class="dkno">Sin datos en este período.</div>'; };
  const grafico = serie => { const n = serie.length, W = 640, H = 150, mx = Math.max(1, ...serie.map(s => s[1])), bw = W / n, conVenta = serie.filter(s => s[1] > 0), prom = conVenta.length ? conVenta.reduce((a, s) => a + s[1], 0) / conVenta.length : 0;
    const mj = serie.reduce((a, s) => s[1] > a[1] ? s : a, serie[0]), yp = H - prom / mx * H;
    return `<svg viewBox="0 0 ${W} ${H + 20}" class="dksvg" role="img" aria-label="Ventas por día">${serie.map((s, i) => { const h = Math.max(s[1] > 0 ? 2 : 0, s[1] / mx * H);
      return `<rect x="${(i * bw + bw * 0.12).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${h.toFixed(1)}" rx="${bw > 6 ? 2 : 0}" class="${s === mj && s[1] > 0 ? 'best' : ''}"><title>${fechaLarga(s[0])}: ${clp(s[1])}</title></rect>`; }).join('')}
      <line x1="0" x2="${W}" y1="${yp.toFixed(1)}" y2="${yp.toFixed(1)}" class="avg"/><text x="${W}" y="${Math.max(11, yp - 4).toFixed(1)}" text-anchor="end" class="dkx">promedio de los días con venta: ${clp(prom)}</text>
      <text x="0" y="${H + 15}" class="dkx">${fcorta(serie[0][0])}</text><text x="${W}" y="${H + 15}" class="dkx" text-anchor="end">${fcorta(serie[n - 1][0])}</text></svg>`; };
  const FCOL = { EFECTIVO: ['Efectivo', '#16A34A'], TRANSFERENCIA: ['Transferencia', '#2563EB'], CHEQUE: ['Cheque', '#0891B2'], CREDITO: ['Crédito (se cobra después)', '#F97316'] };
  const AGING = ['#16A34A', '#84CC16', '#F59E0B', '#F97316', '#DC2626'];

  const html = d => {
    const v = d.ventas, c = d.credito, cb = d.cobranza, k = d.kilos, me = d.mermas, co = d.control;
    // ---- semáforos
    const eV = v.delta == null ? 'na' : v.delta >= 0 ? 'ok' : v.delta > -10 ? 'warn' : 'bad';
    const eC = c.deuda <= 0 ? 'ok' : c.vencidaPct < 15 ? 'ok' : c.vencidaPct < 30 ? 'warn' : 'bad';
    const fPct = v.total > 0 ? k.faltante / v.total * 100 : 0, eK = mejor(fPct >= 2 ? 'bad' : fPct >= 0.5 ? 'warn' : 'ok', me.pctVenta >= 4 ? 'bad' : me.pctVenta >= 2 ? 'warn' : 'ok');
    const problemas = (co.nDiasSinCerrar > 0 ? 1 : 0) + (co.sinDetallar.n > 0 ? 1 : 0) + (co.efectivo.falta > 0 ? 1 : 0), eO = problemas === 0 ? 'ok' : problemas <= 1 ? 'warn' : 'bad';
    const mj = v.serie.reduce((a, s) => s[1] > a[1] ? s : a, v.serie[0]);
    const pagoMalo = c.topAtrasados.slice(0, 3);
    const fila = (t, x) => `<div><span>${t}</span><b>${x}</b></div>`;
    const resumen = [
      ['ventas', 'VENTAS', clp(v.total), [fila('Documentos', v.docs.toLocaleString('es-CL')), fila('Ticket promedio', clp(v.ticket)), fila('Variación vs. período anterior', v.delta == null ? '—' : (v.delta >= 0 ? '+' : '−') + pct(Math.abs(v.delta)))]],
      ['credito', 'CRÉDITO Y COBRANZA', clp(c.deuda), [fila('Deuda vencida', clp(c.vencida) + ' (' + pct(c.vencidaPct) + ')'), fila('Facturas pendientes', c.facturas), fila('Cobrado en el período', clp(cb.total))]],
      ['kilos', 'KILOS Y MERMAS', kg(k.total), [fila('Kilos faltantes', clp(k.faltante)), fila('Mermas y reprocesos', clp(me.monto)), fila('Mermas / venta', pct(me.pctVenta))]],
      ['control', 'ORDEN Y CONTROL', co.nDiasSinCerrar + ' ' + plural(co.nDiasSinCerrar, 'día abierto', 'días abiertos'), [fila('Folios sin detallar', co.sinDetallar.n + ' (' + clp(co.sinDetallar.monto) + ')'), fila('Efectivo faltante', clp(co.efectivo.falta)), fila('Descuentos aprobados', clp((co.descuentos.find(x => x.estado === 'APROBADO') || { monto: 0 }).monto))]]];

    // ---- 1. ventas
    const totPag = v.formas.filter(x => FCOL[x.forma]).reduce((a, x) => a + Math.max(0, x.monto), 0);
    const sVentas = `<section class="dksec" id="dk-ventas" style="--c:#2563EB;--cs:#EAF1FF"><header><i>1</i><div><h3>Ventas</h3><p>¿Cuánto se vendió y quién lo vendió?</p></div></header>
      <div class="dksimple"><b>En simple:</b> en estos ${d.dias} ${plural(d.dias, 'día', 'días')} vendiste <b>${clp(v.total)}</b> en ${v.docs.toLocaleString('es-CL')} documentos.${v.total > 0 ? ` El mejor día fue el ${fechaLarga(mj[0])}, con ${clp(mj[1])}.` : ''}
        De cada $100 vendidos, <b>$${Math.round(v.contadoPct)}</b> se cobraron al momento y <b>$${Math.round(100 - v.contadoPct)}</b> quedaron a crédito.</div>
      <div class="dkks">${kpi('Venta del período', clp(v.total), 'Todo lo facturado menos las notas de crédito.', delta(v.delta))}${kpi('Documentos', v.docs.toLocaleString('es-CL'), 'Facturas y boletas emitidas.')}
        ${kpi('Ticket promedio', clp(v.ticket), 'Lo que vale, en promedio, cada documento.')}${kpi('Venta por día', clp(v.promedioDia), 'Total dividido en los días del período.')}${kpi('Cobrado al momento', pct(v.contadoPct), 'Parte de la venta que no quedó a crédito.')}</div>
      <div class="dkcard"><b>Venta día por día</b><small>Cada barra es un día. La barra más oscura es el mejor día; la línea punteada es el promedio.</small><div class="dkchart">${grafico(v.serie)}</div></div>
      <div class="dkg"><div class="dkcard"><b>¿Cómo te pagaron?</b><small>Reparto de lo vendido según la forma de pago.</small>
          <div class="dkstack">${v.formas.filter(x => FCOL[x.forma] && x.monto > 0).map(x => `<i style="width:${x.monto / Math.max(1, totPag) * 100}%;background:${FCOL[x.forma][1]}" title="${FCOL[x.forma][0]}"></i>`).join('')}</div>
          <div class="dkleg">${v.formas.filter(x => FCOL[x.forma]).map(x => `<div><i style="background:${FCOL[x.forma][1]}"></i><span>${FCOL[x.forma][0]}</span><b>${clp(x.monto)}</b><em>${pct(totPag ? x.monto / totPag * 100 : 0)}</em></div>`).join('')}</div></div>
        <div class="dkcard"><b>Ranking de vendedores</b><small>Quién vendió más. Abajo de cada barra: documentos, ticket promedio y qué parte quedó a crédito.</small>
          ${ranking(v.porVendedor.map(x => ({ l: x.nombre, v: x.venta, s: `${x.docs} docs · ticket ${clp(x.ticket)} · ${pct(x.creditoPct)} a crédito` })), clp)}</div></div>
      ${haz([v.delta != null && v.delta <= -10 ? `Las ventas bajaron ${pct(Math.abs(v.delta))}. Mira el ranking: ¿cayó un vendedor en particular o cayó todo el equipo?` : '', v.contadoPct < 60 && v.total > 0 ? `Solo ${pct(v.contadoPct)} se cobra al momento. Revisa si conviene pedir más pago contado o recortar plazos.` : ''].filter(Boolean))}
      ${aprende('¿Cómo leer esta sección?', ['<b>Ticket promedio</b>: si baja, se está vendiendo en montos más chicos; si sube, vendes más por cliente.', '<b>Crédito</b>: lo que se vende hoy y se cobra después. Más crédito = más plata en la calle y más riesgo.', 'Las <b>notas de crédito</b> (devoluciones o correcciones) se restan de la venta.'])}</section>`;

    // ---- 2. crédito y cobranza
    const credMas = cb.creditoOtorgado > cb.total && cb.creditoOtorgado > 0;
    const peorV = c.porVendedor.slice().sort((a, b) => b.vencida - a.vencida)[0];
    const sCred = `<section class="dksec" id="dk-credito" style="--c:#7C3AED;--cs:#F1EAFE"><header><i>2</i><div><h3>Crédito y cobranza</h3><p>¿Cuánto te deben, desde cuándo y quién debe?</p></div></header>
      <div class="dksimple"><b>En simple:</b> hoy los clientes te deben <b>${clp(c.deuda)}</b> en ${c.facturas} ${plural(c.facturas, 'factura', 'facturas')}. De eso, <b>${clp(c.vencida)}</b> (${pct(c.vencidaPct)}) <u>ya pasó su plazo de pago</u>.
        Una factura impaga tiene en promedio ${c.diasPromedioDeuda} días.${c.diasCobro != null ? ` Cuando te pagan, tardan ${c.diasCobro} ${plural(c.diasCobro, 'día', 'días')} desde que se emitió la factura.` : ''}
        En el período vendiste a crédito <b>${clp(cb.creditoOtorgado)}</b> y cobraste <b>${clp(cb.total)}</b>${credMas ? ': <u>le estás prestando más de lo que recuperas</u>' : ': recuperas más de lo que prestas, la deuda baja'}.</div>
      <div class="dkks">${kpi('Deuda total', clp(c.deuda), `${c.clientes} ${plural(c.clientes, 'cliente', 'clientes')} con facturas pendientes.`)}
        ${kpi('Deuda vencida', clp(c.vencida), 'Facturas que ya pasaron el plazo acordado.', pill(eC, pct(c.vencidaPct) + ' de la deuda'))}
        ${kpi('Días reales de cobro', c.diasCobro == null ? '—' : c.diasCobro + ' días', 'Entre la factura y el pago, en lo cobrado del período.')}
        ${kpi('Cobrado en el período', clp(cb.total), 'Pagos de clientes anotados en Cobranza.', delta(cb.delta))}
        ${kpi('Cheques en cartera', clp(c.cheques.cartera), `${c.cheques.n} ${plural(c.cheques.n, 'cheque', 'cheques')} por cobrar${c.cheques.proximos7 ? ` · ${clp(c.cheques.proximos7)} cobrables esta semana` : ''}.`)}</div>
      <div class="dkcard"><b>¿Cuánto tiempo llevan las facturas sin pagarse?</b><small>Mientras más a la derecha, más difícil es recuperar la plata.</small>
        <div class="dkvenc"><div><span style="width:${100 - c.vencidaPct}%" class="ok"></span><span style="width:${c.vencidaPct}%" class="bad"></span></div><em>${pct(100 - c.vencidaPct)} dentro del plazo · ${pct(c.vencidaPct)} vencido</em></div>
        ${ranking(c.aging.map((a, i) => ({ l: a.tramo, v: a.monto, c: AGING[i], s: `${a.facturas} ${plural(a.facturas, 'factura', 'facturas')}` })), clp)}</div>
      <div class="dkg"><div class="dkcard"><b>A quién cobrar primero</b><small>Los clientes con más días de atraso (desde que pasó su plazo).</small>
          ${ranking(c.topAtrasados.map(x => ({ l: x.cliente, v: x.vencida, c: '#DC2626', s: `${x.atraso} días de atraso · ${x.ultimoPago ? 'último pago el ' + fcorta(x.ultimoPago) : 'sin pagos registrados'}` })), clp)}</div>
        <div class="dkcard"><b>Los que más te deben</b><small>Ordenados por monto adeudado. Lo rojo es la parte vencida.</small>
          ${ranking(c.topDeudores.map(x => ({ l: x.cliente, v: x.deuda, s: x.vencida ? `${clp(x.vencida)} vencidos` : 'al día' })), clp)}</div></div>
      <div class="dkcard"><b>Deuda por vendedor</b><small>Lo que cada vendedor tiene por cobrar. Rojo = vencido; verde = aún dentro del plazo.</small>
        ${c.porVendedor.length ? c.porVendedor.map(x => { const mx = Math.max(1, ...c.porVendedor.map(y => y.deuda)); return `<div class="dkr1"><div class="dkr1h"><span>${esc(x.vendedor)}</span><b>${clp(x.deuda)}</b></div><div class="dkt dkt2"><i style="width:${x.vencida / mx * 100}%;background:#DC2626"></i><i style="width:${(x.deuda - x.vencida) / mx * 100}%;background:#16A34A"></i></div><small>${clp(x.vencida)} vencidos</small></div>`; }).join('') : '<div class="dkno">Sin deuda.</div>'}</div>
      ${haz([pagoMalo.length ? `Empieza por llamar a <b>${pagoMalo.map(x => esc(x.cliente)).join(', ')}</b>: suman ${clp(pagoMalo.reduce((a, x) => a + x.vencida, 0))} vencidos.` : '', credMas ? 'Estás vendiendo a crédito más rápido de lo que cobras. Considera no dar nuevo crédito a clientes con facturas vencidas.' : '',
        peorV && peorV.vencida > 0 ? `<b>${esc(peorV.vendedor)}</b> concentra la mayor deuda vencida (${clp(peorV.vencida)}). Conviene sentarse a revisar su cartera.` : '', c.cheques.proximos7 > 0 ? `Programa el cobro de ${clp(c.cheques.proximos7)} en cheques a fecha que vencen esta semana.` : ''].filter(Boolean))}
      ${aprende('¿Cómo leer esta sección?', ['<b>Deuda vencida</b>: una factura se considera vencida cuando pasaron más días que el plazo del cliente (o, si no tiene, el de tu política: 7, 14, 21 o 28 días según el monto).', '<b>Días reales de cobro</b>: cuánto demoran en pagar de verdad. Compáralo con el plazo que les das.', '<b>Cheque en cartera</b>: sigue siendo deuda hasta que se cobra en el banco.', 'La deuda y su antigüedad son <b>al día de hoy</b>, no cambian con el período elegido.'])}</section>`;

    // ---- 3. kilos y mermas
    const peorK = k.porVendedor.filter(x => x.pesos > 0)[0];
    const sKilos = `<section class="dksec" id="dk-kilos" style="--c:#0F766E;--cs:#E3F6F3"><header><i>3</i><div><h3>Kilos y mermas</h3><p>¿Se está perdiendo producto?</p></div></header>
      <div class="dksimple"><b>En simple:</b> se facturaron <b>${kg(k.total)}</b>. ${k.faltante > 0 ? `Comparando lo que salió de bodega con lo que volvió y lo que se facturó, <b>faltan kilos por ${clp(k.faltante)}</b>: es producto que salió y no aparece vendido ni devuelto.` : 'No hay kilos faltantes en este período.'}
        Las mermas y reprocesos suman <b>${clp(me.monto)}</b> (${pct(me.pctVenta)} de la venta).</div>
      <div class="dkks">${kpi('Kilos facturados', kg(k.total), 'Solo productos que se venden por kilo.')}${kpi('Precio promedio por kilo', clp(k.precioPromedio), 'Venta de esos productos dividida en los kilos.')}
        ${kpi('Kilos faltantes en plata', clp(k.faltante), 'Salió, no volvió y no se facturó.', pill(fPct >= 2 ? 'bad' : fPct >= 0.5 ? 'warn' : 'ok', pct(fPct) + ' de la venta'))}
        ${kpi('Mermas y reprocesos', clp(me.monto), 'Producto que volvió y no se pudo vender (monto de las notas de crédito).', pill(me.pctVenta >= 4 ? 'bad' : me.pctVenta >= 2 ? 'warn' : 'ok', pct(me.pctVenta) + ' de la venta'))}</div>
      <div class="dkg"><div class="dkcard"><b>Productos que más se venden</b><small>En kilos, durante el período.</small>${ranking(k.productos.map(x => ({ l: x.producto, v: x.kilos, s: clp(x.monto) + ' vendidos' })), kg)}</div>
        <div class="dkcard"><b>Diferencia de kilos por vendedor</b><small>Rojo = faltan kilos (se descuenta). Verde = sobran a favor del vendedor.</small>
          ${ranking(k.porVendedor.map(x => ({ l: x.vendedor, v: x.pesos, c: x.pesos > 0 ? '#DC2626' : '#16A34A', s: `${kg(Math.abs(x.kilos))} ${x.kilos > 0 ? 'faltan' : 'sobran'}` })), x => clp(Math.abs(x)))}</div></div>
      <div class="dkcard"><b>Devoluciones</b><small>Producto que volvió a la bodega con nota de crédito.</small>
        <div class="dkleg">${me.porTipo.map(x => `<div><i style="background:${x.tipo === 'MERMA' ? '#DC2626' : '#F59E0B'}"></i><span>${x.tipo === 'MERMA' ? 'Merma (se descarta)' : x.tipo === 'REPROCESO' ? 'Reproceso (vuelve a producción)' : esc(x.tipo)}</span><b>${clp(x.monto)}</b><em>${x.n} ${plural(x.n, 'caso', 'casos')}</em></div>`).join('')}</div>
        ${me.productos.length ? `<small style="margin-top:8px">Productos que más vuelven: ${me.productos.map(x => `${esc(x.producto)} (${n1(x.cantidad)})`).join(', ')}</small>` : ''}</div>
      ${haz([peorK ? `Revisa con <b>${esc(peorK.vendedor)}</b> las diferencias de kilos (${clp(peorK.pesos)}): ¿falta registrar retornos o hay producto sin facturar?` : '', me.pctVenta >= 2 ? `Las mermas son ${pct(me.pctVenta)} de la venta. Mira qué productos vuelven más y por qué (motivo en Devoluciones).` : ''].filter(Boolean))}
      ${aprende('¿Cómo leer esta sección?', ['<b>Kilos faltantes</b> = kilos que salieron de bodega − kilos que volvieron − kilos facturados. Solo cuenta días donde ya se registró todo el retorno.', '<b>Merma</b> se descarta; <b>reproceso</b> vuelve a producción. Ambas se respaldan con nota de crédito.'])}</section>`;

    // ---- 4. control
    const desc = Object.fromEntries(co.descuentos.map(x => [x.estado, x]));
    const eD = co.descuentoPct >= 5 ? 'bad' : co.descuentoPct >= 2 ? 'warn' : 'ok';
    const efMalos = co.efectivo.contados - co.efectivo.cuadran;
    const sControl = `<section class="dksec" id="dk-control" style="--c:#B45309;--cs:#FDF1DD"><header><i>4</i><div><h3>Orden y control</h3><p>¿Está todo cerrado, detallado y cuadrado?</p></div></header>
      <div class="dksimple"><b>En simple:</b> ${problemas === 0 ? 'todo está en orden: no hay días sin cerrar, folios sin detallar ni efectivo faltante.' : `hay ${problemas} ${plural(problemas, 'tema pendiente', 'temas pendientes')}: ${[co.nDiasSinCerrar ? `<b>${co.nDiasSinCerrar}</b> ${plural(co.nDiasSinCerrar, 'día', 'días')} con ventas sin cerrar la rendición` : '', co.sinDetallar.n ? `<b>${co.sinDetallar.n}</b> ${plural(co.sinDetallar.n, 'folio', 'folios')} de días anteriores sin detallar (${clp(co.sinDetallar.monto)})` : '', co.efectivo.falta ? `el efectivo contado quedó <b>${clp(co.efectivo.falta)}</b> bajo lo esperado` : ''].filter(Boolean).join('; ')}.`}</div>
      <div class="dkks">${kpi('Días sin cerrar', co.nDiasSinCerrar, 'Días con ventas cuya rendición sigue abierta.', pill(co.nDiasSinCerrar === 0 ? 'ok' : co.nDiasSinCerrar > 3 ? 'bad' : 'warn'))}
        ${kpi('Folios sin detallar', co.sinDetallar.n, `${clp(co.sinDetallar.monto)} de días anteriores sin saber cómo se pagaron.`, pill(co.sinDetallar.n === 0 ? 'ok' : 'warn'))}
        ${kpi('Efectivo que no cuadró', clp(co.efectivo.falta), `${co.efectivo.cuadran} de ${co.efectivo.contados} ${plural(co.efectivo.contados, 'conteo cuadró', 'conteos cuadraron')}${co.efectivo.sobra ? ` · sobraron ${clp(co.efectivo.sobra)}` : ''}.`, pill(co.efectivo.falta === 0 ? 'ok' : 'bad'))}
        ${kpi('Descuentos aprobados', clp((desc.APROBADO || { monto: 0 }).monto), 'Rebajas autorizadas sobre el precio.', pill(eD, pct(co.descuentoPct) + ' de la venta'))}${kpi('Gastos', clp(co.gastos.total), 'Gastos anotados por los responsables.')}</div>
      <div class="dkg"><div class="dkcard"><b>Efectivo faltante por vendedor</b><small>Contado en caja frente a lo que debía entregar.</small>
          ${ranking(co.efectivo.porVendedor.map(x => ({ l: x.vendedor, v: x.falta, c: '#DC2626', s: `${x.dias} ${plural(x.dias, 'día', 'días')} sin cuadrar${x.sobra ? ' · sobró ' + clp(x.sobra) : ''}` })), clp)}</div>
        <div class="dkcard"><b>Folios sin detallar por vendedor</b><small>Documentos de días anteriores que aún no tienen forma de pago.</small>
          ${ranking(co.sinDetallar.porVendedor.map(x => ({ l: x.vendedor, v: x.n, s: clp(x.monto) })), x => x + ' folios')}</div></div>
      <div class="dkg"><div class="dkcard"><b>Descuentos</b><small>Según su estado.</small><div class="dkleg">${co.descuentos.length ? co.descuentos.map(x => `<div><i style="background:${x.estado === 'APROBADO' ? '#16A34A' : x.estado === 'RECHAZADO' ? '#DC2626' : '#F59E0B'}"></i><span>${({ APROBADO: 'Aprobados', PENDIENTE: 'Pendientes de aprobar', RECHAZADO: 'Rechazados' })[x.estado] || esc(x.estado)}</span><b>${clp(x.monto)}</b><em>${x.n} ${plural(x.n, 'caso', 'casos')}</em></div>`).join('') : '<div class="dkno">Sin descuentos en este período.</div>'}</div></div>
        <div class="dkcard"><b>Gastos por concepto</b><small>En qué se gastó.</small>${ranking(co.gastos.porConcepto.map(x => ({ l: x.concepto, v: x.monto })), clp)}</div></div>
      ${co.diasSinCerrar.length ? `<div class="dkcard"><b>Días con la rendición abierta</b><small>Cierra estos días para que nadie pueda cambiar sus cifras.</small><div class="dkchips">${co.diasSinCerrar.map(f => `<span>${fcorta(f)}</span>`).join('')}${co.nDiasSinCerrar > co.diasSinCerrar.length ? `<em>y ${co.nDiasSinCerrar - co.diasSinCerrar.length} más</em>` : ''}</div></div>` : ''}
      ${haz([co.nDiasSinCerrar ? `Cierra las ${co.nDiasSinCerrar} rendiciones pendientes: mientras más días abiertos, más difícil cuadrar.` : '', co.sinDetallar.n ? 'Pide a los vendedores con folios sin detallar que los completen; sin eso no se sabe cuánto es crédito.' : '', co.efectivo.falta ? `Hubo ${efMalos} ${plural(efMalos, 'conteo', 'conteos')} con diferencia. Revisa con los vendedores de la lista antes de que pase más tiempo.` : '', eD !== 'ok' ? `Los descuentos son ${pct(co.descuentoPct)} de la venta. Revisa quién los pide y por qué.` : ''].filter(Boolean))}
      ${aprende('¿Cómo leer esta sección?', ['<b>Rendición abierta</b>: el día no se ha cerrado, así que sus cifras todavía se pueden cambiar.', '<b>Folio sin detallar</b>: se emitió pero nadie ha dicho si fue efectivo, transferencia, cheque o crédito.', '<b>Efectivo que no cuadró</b>: lo contado (billetes y monedas) frente a lo que el vendedor debía entregar.'])}</section>`;

    return `<div class="dk"><div class="dkhead"><div><h2>Indicadores de gestión</h2>
        <p>Período del <b>${fechaLarga(d.desde)}</b> al <b>${fechaLarga(d.hasta)}</b> (${d.dias} ${plural(d.dias, 'día', 'días')})</p></div></div>
      <div class="dkbar"><div class="dkseg" id="dkp">${Object.keys(PER).map(x => `<button type="button" data-p="${x}" class="${S.datos.p === x ? 'on' : ''}">${PER[x][0]}</button>`).join('')}</div>
        <label class="dkd">Desde <input type="date" class="in" id="dkd1" value="${d.desde}" max="${hoy}"></label><label class="dkd">Hasta <input type="date" class="in" id="dkd2" value="${d.hasta}" max="${hoy}"></label></div>
      <h4 class="dkh4">Resumen del período</h4>
      <div class="dksem">${resumen.map(r => `<button type="button" class="dks" data-ir="dk-${r[0]}"><small>${r[1]}</small><b>${r[2]}</b>${r[3].join('')}<em>Ver detalle ↓</em></button>`).join('')}</div>
      ${sVentas}${sCred}${sKilos}${sControl}
      <p class="dkfoot">Calculado el ${esc(String(d.generado).slice(0, 16))}. Las notas de crédito se restan de la venta. Los porcentajes en verde, amarillo y rojo son referencias generales; ajústalas a lo que sea normal para tu empresa.</p></div>`;
  };
  const cargar = async recarga => {
    const [desde, hasta] = rango();
    const d = await api('getKpis', S.sess.token, desde, hasta);
    if (recarga) S.silencio = true;
    try { render(m, html(d)); } finally { S.silencio = false; }
    m.querySelectorAll('#dkp button').forEach(b => b.onclick = () => { S.datos.p = b.dataset.p; cargar(true).catch(() => {}); });
    m.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { const t = $('#' + b.dataset.ir, m); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    const cambio = () => { const a = $('#dkd1', m).value, z = $('#dkd2', m).value; if (a && z) { S.datos = { p: 'x', desde: a, hasta: z }; cargar(true).catch(() => {}); } };
    $('#dkd1', m).onchange = cambio; $('#dkd2', m).onchange = cambio;
  };
  await cargar(false);
}

/* ---- v82: toques repetidos ---- un botón que se aprieta muchas veces seguidas solo cuenta una vez (menos los de + / − y los marcados data-rep) */
(function () {
  const ult = new WeakMap();
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button, .btn, [role=button]');
    if (!b || b.hasAttribute('data-rep') || b.closest('[data-rep]')) return;
    const tx = (b.textContent || '').trim(); if (tx === '+' || tx === '−' || tx === '-' || b.closest('.pr .nin, .nin, .stp, .pad')) return;
    const t = Date.now(), a = ult.get(b);
    if (a && t - a < 900) { e.stopImmediatePropagation(); e.preventDefault(); return; }
    ult.set(b, t);
  }, true);
})();


/* ===== PRECIOS DE LISTA (v122) ===== */
async function vPrecios(m) {
  const lista = await api('listarPrecios', S.sess.token);
  const orig = {}; lista.forEach(p => orig[p.codigo] = p.precio);
  const nuevo = {};                                     // codigo -> precio escrito distinto del actual
  const num = t => { const n = Number(String(t).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : NaN; };
  const fila = p => `<tr data-c="${esc(p.codigo)}"><td>${esc(p.nombre)}</td><td class="pr-u">${p.unidad === 'KG' ? 'por kilo' : 'por unidad'}</td>
      <td><input class="in pr-in" inputmode="decimal" autocomplete="off" value="${p.precio ? Math.round(p.precio * 100) / 100 : ''}" placeholder="Sin precio" aria-label="Precio de ${esc(p.nombre)}"></td></tr>`;
  const sec = (tit, arr) => arr.length ? `<h3 class="pr-h">${tit}</h3><div class="tw"><table class="pr-t"><tbody>${arr.map(fila).join('')}</tbody></table></div>` : '';
  render(m, `<h2>Precios</h2>
    <p class="lead" style="margin:0 0 12px">Precio de lista de cada producto. Se usa para calcular en plata los kilos que faltan o sobran de cada vendedor. No cambia lo que ya está facturado en Mi DTE.</p>
    <div class="row pr-bar"><button class="btn cu sm" id="pxu">Subir listado de precios (Excel)</button><button class="btn ghost sm" id="pxd">Bajar planilla para editar</button>
      <input type="file" id="pxf" accept=".xlsx,.xls,.csv" class="sr"></div>
    <div id="pxmsg"></div>
    <input class="in" id="pxq" placeholder="Buscar producto" autocomplete="off" style="margin:10px 0">
    <div id="pxl">${sec('Por kilo', lista.filter(p => p.unidad === 'KG'))}${sec('Por unidad', lista.filter(p => p.unidad !== 'KG'))}</div>
    <div class="pr-foot" id="pxfoot" hidden><span id="pxn"></span><span class="grow"></span><button class="btn ghost sm" id="pxc">Descartar</button><button class="btn cu" id="pxg">Guardar cambios</button></div>`);
  const filas = () => [...m.querySelectorAll('#pxl tr')];
  const marcar = () => {
    const n = Object.keys(nuevo).length; $('#pxfoot', m).hidden = !n;
    $('#pxn', m).textContent = n === 1 ? '1 precio cambiado' : n + ' precios cambiados';
    filas().forEach(tr => { const c = tr.dataset.c; tr.classList.toggle('pr-chg', c in nuevo); });
  };
  const poner = (c, v) => { const tr = filas().find(t => t.dataset.c === c); if (!tr) return; const i = $('input', tr); i.value = v === '' || v == null ? '' : v;
    if (v !== '' && v != null && Number(v) !== orig[c]) nuevo[c] = Number(v); else delete nuevo[c]; };
  $('#pxl', m).addEventListener('input', e => { const tr = e.target.closest('tr'); if (!tr) return; const c = tr.dataset.c, t = e.target.value.trim(), v = t === '' ? 0 : num(t);
    if (!isNaN(v) && v !== orig[c]) nuevo[c] = v; else delete nuevo[c]; marcar(); });
  $('#pxq', m).oninput = e => { const q = normBus(e.target.value); filas().forEach(tr => tr.hidden = q && normBus(tr.cells[0].textContent).indexOf(q) < 0); };
  $('#pxc', m).onclick = () => { Object.keys(nuevo).forEach(c => poner(c, orig[c] || '')); marcar(); $('#pxmsg', m).innerHTML = ''; };
  $('#pxg', m).onclick = async () => {
    const cambios = Object.keys(nuevo).map(c => ({ codigo: c, precio: nuevo[c] })); if (!cambios.length) return;
    if (cambios.some(x => isNaN(x.precio))) return toast('Hay un precio que no es un número.', true);
    if (!confirm('¿Guardar ' + cambios.length + (cambios.length === 1 ? ' precio nuevo?' : ' precios nuevos?') + '\nLos kilos de días ya cerrados se recalculan con el precio nuevo si se abre de nuevo su rendición.')) return;
    const b = $('#pxg', m); b.disabled = true;
    try { await api('guardarPrecios', S.sess.token, cambios); olvidarCache(true); toast('Precios guardados'); ir('precios'); } catch (e) { b.disabled = false; throw e; }
  };
  $('#pxd', m).onclick = async () => {
    await cargarXLSX(); const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['Codigo', 'Producto', 'Unidad', 'Precio']].concat(lista.map(p => [p.codigo, p.nombre, p.unidad === 'KG' ? 'KG' : 'UN', p.precio || ''])));
    ws['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 8 }, { wch: 12 }]; XLSX.utils.book_append_sheet(wb, ws, 'Precios'); XLSX.writeFile(wb, 'Precios de lista.xlsx');
  };
  $('#pxu', m).onclick = () => $('#pxf', m).click();
  $('#pxf', m).onchange = async e => {
    const f = e.target.files[0]; if (!f) return; e.target.value = '';
    const msg = $('#pxmsg', m); msg.innerHTML = '<p class="muted">Leyendo el archivo…</p>';
    try {
      await cargarXLSX(); const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
      let rows = null, hi = -1, ci = -1, ni = -1, pi = -1;
      for (const nombre of wb.SheetNames) {
        const r = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: true, defval: '' });
        for (let i = 0; i < Math.min(r.length, 15); i++) { const h = r[i].map(x => normBus(x));
          const p = h.findIndex(x => x.indexOf('PRECIO') >= 0), n = h.findIndex(x => /^(PRODUCTO|NOMBRE|DESCRIPCION|DETALLE)/.test(x)), c = h.findIndex(x => x.indexOf('CODIGO') >= 0 || x === 'COD' || x === 'SKU');
          if (p >= 0 && (n >= 0 || c >= 0)) { rows = r; hi = i; pi = p; ni = n; ci = c; break; } }
        if (rows) break;
      }
      if (!rows) { msg.innerHTML = '<div class="aviso mal">No encontré las columnas. El archivo necesita una columna <b>Precio</b> y otra con el <b>Código</b> o el <b>Nombre</b> del producto. Usa «Bajar planilla para editar» y cambia solo los precios.</div>'; return; }
      const kc = x => String(x).trim().replace(/\.0+$/, ''), porC = {}, porN = {}; lista.forEach(p => { porC[kc(p.codigo)] = p; porN[normBus(p.nombre)] = p; });
      let cambian = 0, iguales = 0; const noHay = [], malos = [];
      rows.slice(hi + 1).forEach(r => {
        const cod = ci >= 0 ? kc(r[ci]) : '', nom = ni >= 0 ? String(r[ni]).trim() : '', raw = r[pi];
        if (!cod && !nom) return; if (raw === '' || raw == null) return;
        const p = (cod && porC[cod]) || (nom && porN[normBus(nom)]);
        if (!p) { noHay.push(nom || cod); return; }
        const v = typeof raw === 'number' ? raw : num(raw);
        if (isNaN(v) || v < 0) { malos.push(p.nombre); return; }
        if (v === orig[p.codigo]) { iguales++; return; }
        poner(p.codigo, v); cambian++;
      });
      marcar();
      msg.innerHTML = `<div class="aviso ${cambian ? 'ok' : ''}"><b>${cambian ? cambian + (cambian === 1 ? ' precio cambia' : ' precios cambian') : 'No hay precios distintos a los actuales'}</b>${iguales ? ` · ${iguales} sin cambio` : ''}.
        ${cambian ? 'Revisa los marcados en la lista y toca <b>Guardar cambios</b>. Todavía no se guardó nada.' : ''}
        ${noHay.length ? `<div class="muted" style="margin-top:6px">No encontré en la app (se ignoran): ${esc(noHay.slice(0, 12).join(', '))}${noHay.length > 12 ? ' y ' + (noHay.length - 12) + ' más' : ''}.</div>` : ''}
        ${malos.length ? `<div class="muted" style="margin-top:6px">Precio no válido (se ignora): ${esc(malos.join(', '))}.</div>` : ''}</div>`;
      const primero = m.querySelector('tr.pr-chg'); if (primero) primero.scrollIntoView({ block: 'center' });
    } catch (err) { msg.innerHTML = '<div class="aviso mal">No pude leer ese archivo: ' + esc(err.message || err) + '</div>'; }
  };
}

/* ============================ PRECIOS DE LISTA (v122) ============================ */
// Precio de lista de cada producto (hoja PRODUCTOS, columna precio). Lo usa la diferencia de kilos en plata (preciosKg_).
function listarPrecios(token) {
  auth_(token, ['ADMIN', 'SUPERVISOR']);
  return read_('PRODUCTOS').filter(p => String(p.activo).toUpperCase() !== 'FALSE' && p.seccion !== 'CAMARA' && p.categoria !== 'REVISAR')
    .sort((a, b) => (a.orden || 999) - (b.orden || 999))
    .map(p => ({ codigo: codeKey_(p.codigo), nombre: p.nombre, categoria: p.categoria || '', unidad: p.unidad === 'KG' ? 'KG' : 'UN', precio: num_(p.precio) }));
}
/** cambios: [{codigo, precio}]. Solo cambia el precio de los productos indicados. */
function guardarPrecios(token, cambios) {
  const u = auth_(token, ['ADMIN', 'SUPERVISOR']);
  cambios = (cambios || []).slice(0, 500);
  if (!cambios.length) throw new Error('No hay cambios para guardar.');
  return withLock_(() => {
    const por = {}; read_('PRODUCTOS').forEach(p => por[codeKey_(p.codigo)] = p);
    let n = 0; const log = [];
    cambios.forEach(c => {
      const p = por[codeKey_(c.codigo)]; if (!p) return;
      const v = Math.round(Number(String(c.precio).replace(',', '.')) * 100) / 100;
      if (!(v >= 0) || v > 100000000) throw new Error('Precio no válido en ' + p.nombre + '.');
      if (num_(p.precio) === v) return;
      log.push(p.nombre + ': ' + num_(p.precio) + ' → ' + v); p.precio = v; updateRow_('PRODUCTOS', p._row, p); n++;
    });
    if (log.length) Logger.log('Precios cambiados por ' + u.usuario + ' (' + now_() + '): ' + log.join(' | '));
    limpiarCache_('PRODUCTOS');
    return { cambiados: n };
  });
}


/* ============ NOTAS DE CRÉDITO POR EMITIR (v127) ============ */
async function vNotasCredito(m) {
  const hoy = hoyCL(), mes0 = hoy.slice(0, 7);
  let mes = S.ncMes || mes0, fil = S.ncFil || 'pend', q = '';
  const rango = ym => { const [y, mm] = ym.split('-').map(Number), ult = new Date(y, mm, 0).getDate(); return [ym + '-01', ym + '-' + String(ult).padStart(2, '0')]; };
  const [d0, d1] = rango(mes);
  const r = await api('listarNotasCredito', S.sess.token, d0, d1);
  const todos = r.filas, pend = todos.filter(x => x.estado === 'POR_EMITIR'), emi = todos.filter(x => x.estado === 'EMITIDA');
  const suma = xs => xs.reduce((a, x) => a + x.monto, 0), norm = t => normBus(t || '');
  const nombreMes = new Date(+mes.slice(0, 4), +mes.slice(5) - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  const FIL = { pend: ['Por emitir', x => x.estado === 'POR_EMITIR'], emi: ['Ya emitidas', x => x.estado === 'EMITIDA'], todas: ['Todas', () => true] };
  render(m, `<h2>Notas de crédito</h2><p class="lead" style="margin:0 0 12px">Las notas de crédito se anotan por su monto en el detalle de cada folio (línea «Nota de crédito»). Aquí se juntan por cliente para emitirlas en Mi DTE a fin de mes.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><label class="muted" style="display:flex;gap:6px;align-items:center">Mes <input type="month" class="in" id="ncm" value="${mes}" max="${mes0}" style="width:auto"></label>
      <button class="btn ghost" id="ncx">Descargar Excel</button></div>
    <div class="kpis"><div><span>Por emitir</span><b>${clp(suma(pend))}</b><small>${pend.length} nota${pend.length === 1 ? '' : 's'} · ${new Set(pend.map(x => x.rut || x.cliente)).size} cliente(s)</small></div>
      <div><span>Ya emitidas</span><b>${clp(suma(emi))}</b><small>${emi.length} nota${emi.length === 1 ? '' : 's'}</small></div></div>
    <div class="row" style="margin:14px 0 8px;flex-wrap:wrap"><div class="seg" id="ncf">${Object.keys(FIL).map(k => `<button type="button" data-f="${k}" class="${k === fil ? 'on' : ''}">${FIL[k][0]} <small>${todos.filter(FIL[k][1]).length}</small></button>`).join('')}</div>
      <input class="in grow" id="ncq" placeholder="Buscar cliente, RUT, folio o vendedor" style="min-width:200px"></div>
    <div id="ncl"></div>
    <div class="sticky-foot" id="ncb" hidden><div class="card"><div><div class="muted"><span id="ncn">0</span> seleccionadas</div><b id="nct" style="font-size:20px"></b></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><input class="in" id="ncf2" inputmode="numeric" placeholder="N° de la nota en Mi DTE" style="width:190px">
      <button class="btn cu" id="nce">Marcar emitida</button><button class="btn ghost" id="ncv" hidden>Devolver a «por emitir»</button></div></div></div>`);
  const sel = new Set();
  const lista = () => {
    const xs = todos.filter(FIL[fil][1]).filter(x => !q || [x.cliente, x.rut, x.folio, x.vendedor].some(t => norm(t).indexOf(norm(q)) >= 0));
    const por = new Map(); xs.forEach(x => { const k = x.rut || x.cliente; if (!por.has(k)) por.set(k, []); por.get(k).push(x); });
    $('#ncl').innerHTML = xs.length ? [...por.values()].map(g => `<div class="cfac" style="display:block;margin-bottom:10px">
      <div class="row" style="gap:10px"><span class="grow"><b>${esc(g[0].cliente)}</b> <span class="muted">${esc(g[0].rut)}</span></span><b>${clp(suma(g))}</b></div>
      ${g.map(x => `<label class="row" style="gap:10px;padding:6px 0;border-top:1px solid var(--line,#e5e2de)"><input type="checkbox" data-k="${esc(x.clave)}" ${sel.has(x.clave) ? 'checked' : ''}>
        <span class="grow">${esc(x.documento)} ${esc(x.folio)} <span class="muted">· ${fcorta(x.fecha)} · ${esc(x.vendedor)}</span>${x.nota ? `<div class="muted">${esc(x.nota)}</div>` : ''}</span>
        ${x.estado === 'EMITIDA' ? `<span class="chip ok">NC ${esc(x.ncFolio)}</span>` : '<span class="chip warn">Por emitir</span>'}<b>${clp(x.monto)}</b></label>`).join('')}</div>`).join('')
      : `<div class="empty">${fil === 'pend' ? 'No hay notas de crédito por emitir en ' + esc(nombreMes) + '.' : 'Nada en esta lista.'}</div>`;
    barra();
  };
  const barra = () => { const xs = todos.filter(x => sel.has(x.clave)); $('#ncb').hidden = !xs.length; $('#ncn').textContent = xs.length; $('#nct').textContent = clp(suma(xs));
    const hay = xs.some(x => x.estado === 'EMITIDA'); $('#ncv').hidden = !hay; $('#nce').hidden = false; };
  $('#ncf').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; fil = S.ncFil = b.dataset.f; sel.clear(); $$('#ncf button').forEach(x => x.classList.toggle('on', x === b)); lista(); };
  $('#ncq').oninput = e => { q = e.target.value; lista(); };
  $('#ncl').onchange = e => { const k = e.target.dataset.k; if (k === undefined) return; e.target.checked ? sel.add(k) : sel.delete(k); barra(); };
  $('#ncm').onchange = e => { if (!e.target.value) return; S.ncMes = e.target.value; ir('notascred', true); };
  const marcar = async folio => {
    const xs = [...sel]; if (!xs.length) return;
    if (folio !== '' && !/^\d+$/.test(folio)) return toast('Escribe el N° de la nota de crédito (solo números).', true);
    const bs = [$('#nce'), $('#ncv')]; bs.forEach(b => b.disabled = true);
    try { await api('marcarNotaEmitida', S.sess.token, xs, folio, hoy);
      toast(folio ? 'Marcadas como emitidas' : 'Devueltas a «por emitir»'); olvidarCache(true); ir('notascred', true); } finally { bs.forEach(b => b.disabled = false); }
  };
  $('#nce').onclick = () => marcar($('#ncf2').value.trim());
  $('#ncv').onclick = () => marcar('');
  $('#ncx').onclick = async () => {
    if (!todos.length) return toast('No hay notas de crédito en este mes.', true);
    await cargarXLSX(); const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['Razón social', 'RUT', 'Documento', 'Folio', 'Fecha', 'Vendedor', 'Monto NC', 'Motivo', 'Estado', 'N° NC emitida']]
      .concat(todos.map(x => [x.cliente, x.rut, x.documento, x.folio, x.fecha, x.vendedor, x.monto, x.nota, x.estado === 'EMITIDA' ? 'Emitida' : 'Por emitir', x.ncFolio])));
    ws['!cols'] = [{ wch: 40 }, { wch: 13 }, { wch: 20 }, { wch: 9 }, { wch: 11 }, { wch: 18 }, { wch: 11 }, { wch: 30 }, { wch: 11 }, { wch: 13 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Notas de crédito'); XLSX.writeFile(wb, 'Notas de credito ' + mes + '.xlsx');
  };
  lista();
}

/* ===== CAJA CHICA (v148): saldo, gastos por reponer y movimientos ===== */
function pedirMonto(titulo, detalle, monto, conNota, alOk) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="grip"></div><div class="body">
    <div style="font-weight:700;font-size:19px;margin-bottom:4px">${esc(titulo)}</div><div class="muted" style="margin-bottom:10px">${esc(detalle)}</div>
    <label class="f" for="pmM">Monto</label><input class="in n gmon" id="pmM" inputmode="numeric" autocomplete="off" value="${monto || ''}" placeholder="$ 0">
    ${conNota ? '<label class="f" for="pmN" style="margin-top:10px">Nota <span class="muted">(opcional)</span></label><input class="in" id="pmN" autocomplete="off" placeholder="Ej.: retiro del banco">' : ''}
    <div class="row" style="margin-top:14px;gap:8px"><button class="btn ghost" id="pmX" type="button">Cancelar</button><span class="grow"></span><button class="btn cu" id="pmOk" type="button">Guardar</button></div></div></div>`;
  document.body.appendChild(ov);
  const cerrar = () => cerrarHoja(ov);
  $('#pmX', ov).onclick = cerrar; ov.onclick = e => { if (e.target === ov) cerrar(); };
  setTimeout(() => $('#pmM', ov).focus(), 60);
  $('#pmOk', ov).onclick = async () => {
    const m = Number(soloDigitos($('#pmM', ov).value)); if (!(m > 0)) return toast('Escribe un monto.', true);
    const b = $('#pmOk', ov), fin = botonOcupado(b, 'Guardando…');
    try { await alOk(m, conNota ? $('#pmN', ov).value : ''); cerrar(); } catch (e) { fin(); throw e; }
  };
}
/** v150: elegir un día, ver cuánto efectivo se recaudó y sacar un monto para la caja chica. */
function sacarCajaChica(fecha0, alOk) {
  const ov = document.createElement('div'); ov.className = 'ov'; const hoy = hoyCL();
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Sacar caja chica"><div class="grip"></div><div class="body">
    <div style="font-weight:700;font-size:19px;margin-bottom:4px">Sacar caja chica del efectivo</div>
    <div class="muted" style="margin-bottom:10px">Elige el día y cuánto sacas de lo recaudado en efectivo. Se descuenta del efectivo a depositar de ese día.</div>
    <label class="f" for="scD">Día</label><input class="in" type="date" id="scD" max="${hoy}" value="${fecha0 || hoy}">
    <div class="dbox" style="margin:10px 0"><span>Efectivo disponible ese día</span><b id="scE">…</b><small id="scS"></small></div>
    <label class="f" for="scM">Monto</label><input class="in n gmon" id="scM" inputmode="numeric" autocomplete="off" placeholder="$ 0">
    <label class="f" for="scN" style="margin-top:10px">Para qué <span class="muted">(opcional)</span></label><input class="in" id="scN" autocomplete="off" placeholder="Ej.: fondo para gastos">
    <div class="row" style="margin-top:14px;gap:8px"><button class="btn ghost" id="scX" type="button">Cancelar</button><span class="grow"></span><button class="btn cu" id="scOk" type="button">Guardar</button></div></div></div>`;
  document.body.appendChild(ov);
  const cerrar = () => cerrarHoja(ov); $('#scX', ov).onclick = cerrar; ov.onclick = e => { if (e.target === ov) cerrar(); };
  let disp = 0;
  const cargar = async () => { $('#scE', ov).textContent = '…'; $('#scS', ov).textContent = '';
    try { const e = await api('efectivoCajaChica', S.sess.token, $('#scD', ov).value); disp = e.disponible; $('#scE', ov).textContent = clp(e.disponible);
      $('#scS', ov).textContent = 'Recaudado ' + clp(e.total) + (e.ya ? ' · ya sacado ' + clp(e.ya) : ''); } catch (x) { $('#scE', ov).textContent = '—'; $('#scS', ov).textContent = String(x.message || x); } };
  $('#scD', ov).onchange = cargar; cargar(); setTimeout(() => $('#scM', ov).focus(), 60);
  $('#scOk', ov).onclick = async () => {
    const mt = Number(soloDigitos($('#scM', ov).value)); if (!(mt > 0)) return toast('Escribe un monto.', true);
    if (mt > disp) return toast('Ese día solo hay ' + clp(disp) + ' disponibles.', true);
    const b = $('#scOk', ov), fin = botonOcupado(b, 'Guardando…');
    try { const o = await api('guardarCajaChica', S.sess.token, 'INGRESO', { fecha: $('#scD', ov).value, monto: mt, obs: $('#scN', ov).value }); olvidarCache(true); purgarListas(); toast(o.aviso || 'Caja chica anotada', !!o.aviso); cerrar(); await alOk(); } catch (e) { fin(); throw e; }
  };
}
async function vCajaChica(m) {
  const r = await api('getCajaChica', S.sess.token), puede = S.sess.rol !== 'GERENCIA';
  const llamar = async (fn, ...a) => { const x = await api(fn, S.sess.token, ...a); olvidarCache(true); purgarListas(); return x; };
  render(m, `<h2>Caja chica</h2>
    <p class="lead" style="margin:0 0 12px">El gasto del día se resta de lo que entrega el vendedor. La caja chica se saca del efectivo recaudado de un día cualquiera (se descuenta de lo que se deposita ese día). Los gastos se reponen desde aquí y la reposición se suma a la rendición del día del gasto.</p>
    <div class="kpis"><div class="cash"><span>Saldo de caja chica</span><b>${clp(r.saldo)}</b>${r.saldo < 0 ? '<small>Falta anotar plata que entró a la caja</small>' : ''}</div>
      <div><span>Ha entrado</span><b>${clp(r.ingresos)}</b></div><div><span>Se ha repuesto</span><b>${clp(r.repuesto)}</b></div></div>
    ${puede ? '<div class="row" style="margin:12px 0"><button class="btn cu" id="ccIn" type="button">+ Sacar caja chica del efectivo de un día</button></div>' : ''}
    <h3>Gastos por reponer ${r.pendientes.length ? `<small class="muted">(${r.pendientes.length})</small>` : ''}</h3>
    ${r.pendientes.length ? r.pendientes.map((x, i) => `<div class="cfac" style="display:block;margin-bottom:8px"><div class="row" style="gap:10px;flex-wrap:wrap">
      <span class="grow"><b>${esc(x.nombre)}</b> <span class="muted">· ${fechaCortaTxt(x.fecha)}${x.estado === 'CERRADA' ? ' · día cerrado' : ''}</span>
        <div class="muted">Gastó ${clp(x.gastos)}${x.repuesto ? ' · ya repuesto ' + clp(x.repuesto) : ''}</div></span>
      <b>${clp(x.falta)}</b>${puede ? `<button class="btn cu" type="button" data-i="${i}">Reponer</button>` : ''}</div></div>`).join('')
      : '<div class="empty">No hay gastos por reponer.</div>'}
    <h3 style="margin-top:18px">Movimientos</h3>
    ${r.movimientos.length ? `<table class="t"><thead><tr><th>Día</th><th>Qué</th><th>Detalle</th><th class="m">Monto</th><th></th></tr></thead><tbody>${r.movimientos.map(x => `<tr>
      <td>${fcorta(x.fecha)}</td><td>${x.tipo === 'INGRESO' ? 'Sacada del efectivo del día' : 'Reposición de gastos'}</td>
      <td>${x.tipo === 'REPOSICION' ? esc(x.nombre) + ' · gasto del ' + fcorta(x.fechaGasto) : ''}${x.obs ? ' ' + esc(x.obs) : ''}<div class="muted">${esc(x.por)}</div></td>
      <td class="m"><b>${x.tipo === 'INGRESO' ? '+' : '−'} ${clp(x.monto)}</b></td>${puede ? `<td><button class="x" type="button" data-d="${esc(x.id)}" aria-label="Borrar">×</button></td>` : '<td></td>'}</tr>`).join('')}</tbody></table>`
      : '<div class="empty">Aún no hay movimientos.</div>'}`);
  const bi = $('#ccIn', m);
  if (bi) bi.onclick = () => sacarCajaChica(S.fecha, async () => ir('cajachica', true));
  $$('[data-i]', m).forEach(b => b.onclick = () => { const x = r.pendientes[b.dataset.i];
    pedirMonto('Reponer gastos de ' + x.nombre, 'Gastos del ' + fechaCortaTxt(x.fecha) + '. Se suma a la rendición de ese día y baja el saldo de la caja chica.', x.falta, false,
      async mt => { const o = await llamar('guardarCajaChica', 'REPOSICION', { fechaGasto: x.fecha, vendedor: x.vendedor, monto: mt }); toast(o.aviso || 'Reposición anotada', !!o.aviso); ir('cajachica', true); }); });
  $$('[data-d]', m).forEach(b => b.onclick = async () => { if (!confirm('¿Borrar este movimiento?')) return; await llamar('borrarCajaChica', b.dataset.d); toast('Movimiento borrado'); ir('cajachica', true); });
}

/* ===== EDITAR LA PLANILLA DE INVENTARIO (v149): el bodeguero agrega, renombra, oculta y reordena productos y columnas de salida ===== */
async function abrirEditorPlanilla(alGuardar) {
  const cfg = await api('getConfigInventario', S.sess.token);
  const prods = cfg.productos.map(p => Object.assign({}, p)), dest = JSON.parse(JSON.stringify(cfg.destinos));
  let sec = S.secInv || 'TERMINADOS', cambio = false;
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet ancha" role="dialog" aria-modal="true" aria-label="Editar planilla"><div class="grip"></div><div class="body">
    <div style="font-weight:700;font-size:19px">Editar planilla de inventario</div>
    <p class="muted" style="margin:4px 0 10px">Cambia el orden con ▲ ▼, corrige el nombre, oculta lo que ya no usas (no se borra: se puede volver a mostrar) o muévelo de sección. Abajo están las columnas de salida de cada sección.</p>
    <div class="seg" id="edS" style="margin-bottom:10px"></div><div id="edL"></div><div id="edD"></div></div>
    <div class="foot"><button class="btn ghost" id="edX" type="button">Cancelar</button><span class="grow"></span><button class="btn cu" id="edOk" type="button">Guardar</button></div></div>`;
  document.body.appendChild(ov);
  const cerrar = () => cerrarHoja(ov);
  $('#edX', ov).onclick = () => { if (cambio && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return; cerrar(); };
  const secs = cfg.secciones;
  const pintar = () => {
    $('#edS', ov).innerHTML = secs.map(x => `<button type="button" data-s="${x.id}" class="${x.id === sec ? 'on' : ''}">${esc(x.nombre)}</button>`).join('');
    const xs = prods.filter(p => p.seccion === sec);
    $('#edL', ov).innerHTML = xs.map((p, i) => `<div class="edr${p.oculto ? ' of' : ''}" data-c="${esc(p.codigo)}">
      <span class="edb"><button type="button" data-m="-1" aria-label="Subir"${i === 0 ? ' disabled' : ''}>▲</button><button type="button" data-m="1" aria-label="Bajar"${i === xs.length - 1 ? ' disabled' : ''}>▼</button></span>
      <input class="in grow" data-n value="${esc(p.nombre)}" autocomplete="off">
      <select class="in" data-sec aria-label="Sección">${secs.map(q => `<option value="${q.id}"${q.id === p.seccion ? ' selected' : ''}>${esc(q.nombre)}</option>`).join('')}</select>
      <label class="edv"><input type="checkbox" data-v${p.oculto ? '' : ' checked'}> Se ve</label></div>`).join('') || '<div class="empty">No hay productos en esta sección.</div>';
    const dl = dest[sec];
    $('#edD', ov).innerHTML = `<div class="edadd"><input class="in grow" id="edNN" placeholder="Producto nuevo en esta sección" autocomplete="off"><select class="in" id="edNU" style="width:auto"><option>KG</option><option>UN</option></select><button class="btn ghost sm" id="edNA" type="button">Agregar producto</button></div>
      ${dl ? `<h3 style="margin-top:18px">Columnas de salida de ${esc((secs.find(q => q.id === sec) || {}).nombre)}</h3>
      <p class="muted" style="margin:2px 0 8px">Son las columnas a la derecha de los vendedores en la planilla. «Supermercado» va siempre al final.</p>
      ${dl.map((d, i) => `<div class="edr" data-d="${i}"><span class="edb"><button type="button" data-dm="-1"${i === 0 ? ' disabled' : ''}>▲</button><button type="button" data-dm="1"${i === dl.length - 1 ? ' disabled' : ''}>▼</button></span>
        <input class="in grow" data-dn value="${esc(d)}" autocomplete="off"><button type="button" class="x" data-dx aria-label="Quitar">×</button></div>`).join('')}
      <div class="edadd"><input class="in grow" id="edDN" placeholder="Columna nueva (ej.: DEGUSTACION)" autocomplete="off"><button class="btn ghost sm" id="edDA" type="button">Agregar columna</button></div>`
      : '<p class="muted" style="margin-top:14px">La cámara de carnes usa siempre las columnas Sale a fábrica y Sale a vendedores.</p>'}`;
  };
  ov.addEventListener('click', e => {
    const bs = e.target.closest('[data-s]'); if (bs) { sec = bs.dataset.s; pintar(); return; }
    const bm = e.target.closest('[data-m]');
    if (bm) { const c = bm.closest('[data-c]').dataset.c, xs = prods.filter(p => p.seccion === sec), i = xs.findIndex(p => p.codigo === c), j = i + Number(bm.dataset.m);
      if (j < 0 || j >= xs.length) return; const a = prods.indexOf(xs[i]), b = prods.indexOf(xs[j]); [prods[a], prods[b]] = [prods[b], prods[a]]; cambio = true; pintar(); return; }
    const dm = e.target.closest('[data-dm]');
    if (dm) { const i = Number(dm.closest('[data-d]').dataset.d), j = i + Number(dm.dataset.dm), l = dest[sec]; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; cambio = true; pintar(); return; }
    const dx = e.target.closest('[data-dx]'); if (dx) { dest[sec].splice(Number(dx.closest('[data-d]').dataset.d), 1); cambio = true; pintar(); return; }
    if (e.target.closest('#edDA')) { const n = $('#edDN', ov).value.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); if (!n) return;
      if (n === 'SUPERMERCADO' || dest[sec].indexOf(n) >= 0) return toast('Esa columna ya existe.', true); dest[sec].push(n); cambio = true; pintar(); return; }
    if (e.target.closest('#edNA')) agregarNuevo();
  });
  ov.addEventListener('input', e => { const r = e.target.closest('[data-c]'); if (r && e.target.matches('[data-n]')) { prods.find(p => p.codigo === r.dataset.c).nombre = e.target.value; cambio = true; }
    const d = e.target.closest('[data-d]'); if (d && e.target.matches('[data-dn]')) { dest[sec][Number(d.dataset.d)] = e.target.value; cambio = true; } });
  ov.addEventListener('change', e => { const r = e.target.closest('[data-c]'); if (!r) return; const p = prods.find(x => x.codigo === r.dataset.c);
    if (e.target.matches('[data-v]')) { p.oculto = !e.target.checked; cambio = true; r.classList.toggle('of', p.oculto); }
    if (e.target.matches('[data-sec]')) { p.seccion = e.target.value; cambio = true; sec = p.seccion; pintar(); toast('Movido a ' + (secs.find(q => q.id === p.seccion) || {}).nombre); } });
  const datos = () => ({ productos: prods.map(p => ({ codigo: p.codigo, nombre: p.nombre, seccion: p.seccion, oculto: p.oculto })),
    destinos: Object.fromEntries(Object.keys(dest).map(k => [k, dest[k].map(x => String(x).trim()).filter(Boolean)])) });
  async function agregarNuevo() {
    const n = $('#edNN', ov).value.trim(); if (!n) return toast('Escribe el nombre del producto.', true);
    const b = $('#edNA', ov); b.disabled = true;
    try { if (cambio) await api('guardarConfigInventario', S.sess.token, datos());      // primero se guarda lo ya editado
      await api('agregarProductoInv', S.sess.token, { nombre: n, seccion: sec, unidad: $('#edNU', ov).value });
      const c2 = await api('getConfigInventario', S.sess.token); prods.length = 0; c2.productos.forEach(p => prods.push(Object.assign({}, p))); cambio = false; olvidarCache(true);
      toast('Producto agregado al final de la sección'); pintar();
    } finally { b.disabled = false; }
  }
  $('#edOk', ov).onclick = async () => {
    const b = $('#edOk', ov), fin = botonOcupado(b, 'Guardando…');
    try { await api('guardarConfigInventario', S.sess.token, datos()); olvidarCache(true); purgarListas(); toast('Planilla actualizada'); cambio = false; cerrar(); if (alGuardar) alGuardar(); } catch (e) { fin(); throw e; }
  };
  pintar();
}
