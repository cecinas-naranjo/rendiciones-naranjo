/* ============================================================
   Rendiciones Naranjo — app (frontend)
   Todos los datos pasan por Apps Script (CONFIG.APPS_SCRIPT_URL).
   ============================================================ */

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clp = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
const kg = n => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'
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
}

/* ---------- fotos y archivos de respaldo ---------- */
const ADJ = { GASTOS: 1, COBRANZA: 1, PROVEEDORES: 1, DEPOSITOS: 1 };
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
  'getResumen', 'descuentosPendientes', 'efectivoParaDepositar', 'historial', 'listarMov']);
const MSG = { login: 'Ingresando…', catalogo: 'Preparando la app…', importarDTE: 'Importando ventas de Mi DTE…', importarDetalle: 'Importando detalle de productos…',
  cerrarRendicion: 'Generando el archivo de rendición…', vistaPreviaRendicion: 'Armando el borrador…', generarPlanillaInventario: 'Armando la planilla de inventario…',
  subirAdjunto: 'Subiendo archivo…', getResumen: 'Calculando la rendición…', getInventario: 'Calculando el inventario…', getSaldosClientes: 'Calculando saldos…',
  misDocumentos: 'Cargando folios…', xlsx: 'Preparando el lector de Excel…', getDespacho: 'Cargando despacho…', listarMov: 'Cargando…', historial: 'Cargando historial…' };
const textoBoton = fn => /^(guardar|save|resolver|asignar)/.test(fn) ? 'Guardando…' : /^importar/.test(fn) ? 'Importando…' : /^borrar/.test(fn) ? 'Borrando…'
  : /^cerrar/.test(fn) ? 'Cerrando…' : /^(generar|vista)/.test(fn) ? 'Generando…' : /^subir/.test(fn) ? 'Subiendo…' : fn === 'login' ? 'Ingresando…' : 'Procesando…';

const CACHE = new Map();
try { Object.entries(JSON.parse(localStorage.getItem('rn_cache') || '{}')).forEach(([k, v]) => CACHE.set(k, v)); } catch (e) {}
let tGuardarCache = 0;
function guardarCache() {
  clearTimeout(tGuardarCache);
  tGuardarCache = setTimeout(() => {
    const ult = [...CACHE.entries()].sort((a, b) => b[1].t - a[1].t).slice(0, 30);
    try { localStorage.setItem('rn_cache', JSON.stringify(Object.fromEntries(ult))); }
    catch (e) { try { localStorage.removeItem('rn_cache'); } catch (e2) {} }
  }, 400);
}
function olvidarCache(todo) {
  [...CACHE.keys()].forEach(k => { if (todo || !/^listaUsuarios\|/.test(k)) CACHE.delete(k); });
  guardarCache();
}

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

async function llamar(fn, args) {
  let r;
  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn, args }) });
    r = await res.json();
  } catch (e) { throw new Error('Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.'); }
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
const EN_CURSO = new Map();
function pedir(fn, args, key) {                    // si ya se está pidiendo lo mismo, se reutiliza esa respuesta
  if (EN_CURSO.has(key)) return EN_CURSO.get(key);
  const p = llamar(fn, args).then(d => { if (LECTURA.has(fn)) { CACHE.set(key, { t: Date.now(), d }); guardarCache(); } return d; })
    .finally(() => EN_CURSO.delete(key));
  EN_CURSO.set(key, p); return p;
}
const copia = d => JSON.parse(JSON.stringify(d));
function errorApi(e) {
  const m = String(e.message || e);
  if (m.indexOf('SESION') >= 0) salir(true);
  toast(m.replace('SESION: ', ''), true);
}

async function api(fn, ...args) {
  const lectura = LECTURA.has(fn), key = fn + '|' + JSON.stringify(args);
  if (lectura && CACHE.has(key) && Date.now() - CACHE.get(key).t < 12 * 3600e3) {
    revalidar(fn, args, key);
    return copia(CACHE.get(key).d);
  }
  if (!lectura) olvidarCache(false);
  const fin = trabajando(fn, !lectura);
  try { return copia(await pedir(fn, args, key)); }
  catch (e) { errorApi(e); throw e; }
  finally { fin(); }
}
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
/** Deja listas en memoria las pantallas vecinas para que abran al instante. */
function precargar(tabs) {
  const tok = S.sess && S.sess.token, F = S.fecha, esV = S.sess && S.sess.rol === 'VENDEDOR';
  const q = { folios: ['misDocumentos', [tok, F, S.vend]], inventario: ['getInventario', [tok, F]], resumen: ['getResumen', [tok, F]],
    saldos: ['getSaldosClientes', [tok]], descuentos: ['descuentosPendientes', [tok]], depositos: ['efectivoParaDepositar', [tok, F, esV ? '' : S.vend]],
    despacho: S.vend ? ['getDespacho', [tok, F, S.vend]] : null };
  let cadena = Promise.resolve();
  tabs.forEach(t => {
    const x = q[t] || (/^[A-Z]+$/.test(t) ? ['listarMov', [tok, t, F]] : null);
    if (!x) return;
    const key = x[0] + '|' + JSON.stringify(x[1]);
    if (CACHE.has(key) && Date.now() - CACHE.get(key).t < 120e3) return;
    cadena = cadena.then(() => pedir(x[0], x[1], key)).catch(() => {});
  });
}

/** El lector de Excel pesa ~900 KB: se descarga solo cuando alguien va a importar. */
let xlsxP = null;
function cargarXLSX() {
  if (typeof XLSX !== 'undefined') return Promise.resolve();
  if (!xlsxP) xlsxP = new Promise((ok, mal) => {
    const fin = trabajando('xlsx', false);
    const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    sc.onload = () => { fin(); ok(); };
    sc.onerror = () => { fin(); xlsxP = null; mal(new Error('No se pudo descargar el lector de Excel. Revisa tu internet.')); };
    document.head.appendChild(sc);
  });
  return xlsxP;
}

/* ---------- estado ---------- */
const S = { sess: null, cat: null, fecha: null, tab: null, vend: '', filtro: 'pend', vistaId: 0, tocado: false, silencio: false };
const hoyCL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
try { S.sess = JSON.parse(localStorage.getItem('rn_sess') || 'null'); } catch (e) {}

const TABS = {
  VENDEDOR: [['folios', 'Mis folios', 'list'], ['COBRANZA', 'Cobranza', 'cash'], ['depositos', 'Depósitos', 'bank'], ['GASTOS', 'Gastos', 'receipt']],
  BODEGA: [['despacho', 'Despacho', 'box'], ['inventario', 'Inventario', 'stack']],
  RENDICION: [['resumen', 'Rendición'], ['importar', 'Importar Mi DTE'], ['folios', 'Folios'], ['despacho', 'Kilos'], ['inventario', 'Inventario'], ['COBRANZA', 'Cobranza'], ['saldos', 'Saldos clientes'],
    ['depositos', 'Depósitos'], ['PROVEEDORES', 'Proveedores'], ['CONSUMO', 'Consumo'], ['GASTOS', 'Gastos'], ['historial', 'Historial']]
};
TABS.SUPERVISOR = TABS.RENDICION.slice(0, 1).concat([['descuentos', 'Descuentos']], TABS.RENDICION.slice(1));
TABS.ADMIN = TABS.SUPERVISOR;
// En oficina, las pestañas se agrupan en 5 secciones para no tener 12 opciones a la vista
const GRUPOS = [['g-rend', 'Rendición', ['resumen']], ['g-ventas', 'Ventas', ['importar', 'folios', 'descuentos']],
  ['g-bodega', 'Bodega', ['despacho', 'inventario']], ['g-dinero', 'Dinero', ['COBRANZA', 'saldos', 'depositos', 'PROVEEDORES', 'GASTOS', 'CONSUMO']],
  ['g-hist', 'Historial', ['historial']]];
const grupoDe = t => GRUPOS.find(g => g[2].indexOf(t) >= 0);

function salir(expirada) {
  if (!expirada && S.sess) api('logout', S.sess.token).catch(() => {});
  S.sess = null; S.cat = null; S.tab = null;
  olvidarCache(false);
  try { localStorage.removeItem('rn_sess'); } catch (e) {}
  document.body.classList.remove('has-bottom');
  pantallaLogin();
}

/* ---------- ingreso ---------- */
async function pantallaLogin() {
  const app = $('#app');
  render(app, `<div class="login"><img class="logo" src="icon-192.png" alt="Cecinas Naranjo" width="96" height="96">
    <h1>Rendiciones</h1><p class="lead">Elige tu nombre e ingresa tu PIN.</p>
    <div class="who" id="who">${skeleton(1)}</div>
    <label class="sr" for="pin">PIN</label>
    <input id="pin" class="in pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="off">
    <button class="btn cu block" style="margin-top:12px" id="go">Ingresar</button></div>`);
  let sel = null;
  const us = await api('listaUsuarios');
  $('#who').innerHTML = us.map(u => `<button type="button" data-u="${esc(u.usuario)}">${esc(u.nombre)}<small>${ROL[u.rol] || u.rol}</small></button>`).join('');
  $('#who').onclick = e => { const b = e.target.closest('button'); if (!b) return; sel = b.dataset.u;
    $$('#who button').forEach(x => x.classList.toggle('on', x === b)); $('#pin').focus(); };
  const go = async () => {
    if (!sel) return toast('Elige tu nombre primero', true);
    try {
      const s = await api('login', sel, $('#pin').value);
      S.sess = s; try { localStorage.setItem('rn_sess', JSON.stringify(s)); } catch (e) {}
      iniciar();
    } catch (e) { const p = $('#pin'); p.value = ''; p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); }
  };
  $('#go').onclick = go; $('#pin').onkeydown = e => { if (e.key === 'Enter') go(); };
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
  const abajo = !unica && tabs.length <= 4;
  const grupos = !unica && !abajo ? GRUPOS.map(g => [g[0], g[1], g[2].filter(t => tabs.some(x => x[0] === t))]).filter(g => g[2].length) : null;
  S.grupos = grupos; S.ultimoDeGrupo = S.ultimoDeGrupo || {};
  document.body.classList.toggle('has-bottom', abajo);
  app.innerHTML = `<header>
      <div class="hbar"><div class="brand"><img src="logo-96.png" alt="" width="42" height="42"><div><b>Naranjo</b><small>${esc(S.sess.nombre)}</small></div></div>
        <div class="sp"></div>
        <div class="day"><button id="prev" aria-label="Día anterior">‹</button><input type="date" id="fecha" value="${S.fecha}" aria-label="Fecha">
          <button id="next" aria-label="Día siguiente">›</button></div>
        <button class="icon-btn" id="out">Salir</button></div>
      ${abajo || unica ? '<div class="progress" aria-hidden="true"><i id="prog"></i></div>'
        : `<nav class="top" id="nav">${grupos.map(g => `<button data-g="${g[0]}">${g[1]}</button>`).join('')}</nav><nav class="sub" id="sub"></nav>`}
      <div class="otrodia" id="otrodia" hidden><span></span><button type="button" id="hoyBtn">Volver a hoy</button></div>
    </header>
    <main id="main"></main>
    ${abajo ? `<nav class="bottom" id="nav">${tabs.map(t => `<button data-t="${t[0]}">${icon(t[2])}${t[1]}</button>`).join('')}</nav>` : ''}`;
  $('#out').onclick = () => salir();
  const cambiarFecha = f => { S.fecha = f; $('#fecha').value = f; ir(S.tab); };
  $('#fecha').onchange = e => e.target.value && cambiarFecha(e.target.value);
  $('#prev').onclick = () => cambiarFecha(sumarDias(S.fecha, -1));
  $('#next').onclick = () => cambiarFecha(sumarDias(S.fecha, 1));
  $('#hoyBtn').onclick = () => cambiarFecha(hoyCL());
  if ($('#nav')) $('#nav').onclick = e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t) return ir(b.dataset.t);
    const g = grupos.find(x => x[0] === b.dataset.g); ir(S.ultimoDeGrupo[g[0]] || g[2][0]); };
  if ($('#sub')) $('#sub').onclick = e => { const b = e.target.closest('button'); if (b) ir(b.dataset.t); };
  // si la persona escribe algo, no se le cambia la pantalla por una actualización de fondo
  $('#main').addEventListener('input', () => { S.tocado = true; });
  ir(S.tab);
}
function ir(t, silencioso) {
  S.tab = t;
  const tabs = TABS[S.sess.rol] || [];
  if (S.grupos) {
    const g = S.grupos.find(x => x[2].indexOf(t) >= 0);
    S.ultimoDeGrupo[g[0]] = t;
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.g === g[0]));
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
  const v = { folios: vFolios, despacho: vDespacho, resumen: vResumen, importar: vImportar, depositos: vDepositos, inventario: vInventario, saldos: vSaldos, historial: vHistorial, descuentos: vDescuentos }[t] || vMov;
  Promise.resolve(v(m, t)).catch(() => {
    if (!silencioso && m.querySelector('.sk')) m.innerHTML = `<div class="empty"><b>No se pudo cargar</b>Revisa tu conexión.<br><button class="btn ghost sm" style="margin-top:10px" onclick="ir(S.tab)">Reintentar</button></div>`;
  }).finally(() => {
    S.silencio = false;
    if (silencioso) window.scrollTo(0, y);
    else setTimeout(() => precargar((S.grupos ? (S.grupos.find(x => x[2].indexOf(t) >= 0) || [0, 0, []])[2] : tabs.map(x => x[0]))
      .filter(x => x !== t).concat(t === 'resumen' ? ['folios', 'despacho'] : [])), 800);
  });
}
const progreso = p => { const i = $('#prog'); if (i) i.style.width = Math.round(p * 100) + '%'; };
const opcVend = (sel, todos) => (todos ? '<option value="">Todos los vendedores</option>' : '') +
  S.cat.vendedores.map(v => `<option value="${esc(v.usuario)}" ${v.usuario === sel ? 'selected' : ''}>${esc(v.nombre)}</option>`).join('');

/* ============ FOLIOS ============ */
async function vFolios(m) {
  const esV = S.sess.rol === 'VENDEDOR';
  let docs = [], estadoDia = '', q = '';
  const r = await api('misDocumentos', S.sess.token, S.fecha, S.vend);
  docs = r.docs; estadoDia = r.estadoDia;
  render(m, `<h2>${esV ? 'Mis folios' : 'Folios'}</h2><p class="lead">${fechaLarga(S.fecha)}</p>
    <div class="row">
      ${esV ? '' : `<select class="in" style="width:auto" id="fv">${opcVend(S.vend, true)}</select>`}
      <div class="seg" id="seg"><button data-f="pend">Por detallar</button><button data-f="det">Detallados</button><button data-f="todos">Todos</button></div>
      <div class="search grow" style="min-width:180px">${icon('search')}<input class="in" id="q" placeholder="Cliente o folio" type="search"></div>
    </div>
    <div class="meter" id="meter"><div class="bar"><i></i></div><b></b></div><div id="fl"></div>`);
  if (!esV) $('#fv').onchange = e => { S.vend = e.target.value; ir('folios'); };
  $('#seg').onclick = e => { const b = e.target.closest('button'); if (b) { S.filtro = b.dataset.f; pintar(); } };
  $('#q').oninput = e => { q = norm(e.target.value); pintar(); };

  function pintar(recienGuardado) {
    $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.f === S.filtro));
    const hechos = docs.filter(d => d.estado === 'DETALLADO').length;
    const p = docs.length ? hechos / docs.length : 0;
    progreso(p);
    const mt = $('#meter'); mt.classList.toggle('done', docs.length > 0 && hechos === docs.length);
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
      const d = docs.find(x => x.folio_key === b.dataset.k);
      abrirDetalle(d, estadoDia, nuevo => { const i = docs.findIndex(x => x.folio_key === nuevo.folio_key); docs[i] = nuevo; pintar(nuevo.folio_key); }); };
  }
  pintar();
}
function chipsEstado(d) {
  let h = d.estado === 'DETALLADO' ? '<span class="chip ok">Detallado</span>' : '<span class="chip cu">Por detallar</span>';
  h += d.pagos.map(p => `<span class="chip">${FL[p.forma]}${p.banco ? ' ' + esc(p.banco) : ''}</span>`).join('');
  d.descuentos.forEach(x => h += `<span class="chip ${x.estado === 'APROBADO' ? 'ok' : x.estado === 'RECHAZADO' ? 'bad' : 'warn'}">Desc. ${clp(x.monto)} ${x.estado.toLowerCase()}</span>`);
  return h;
}

function cerrarHoja(ov) { ov.classList.add('closing'); setTimeout(() => ov.remove(), 190); }

function abrirDetalle(d, estadoDia, alGuardar) {
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
      <select class="in banco" data-k="banco" aria-label="Banco" ${conBanco(l.forma) && !cerrada ? '' : 'disabled'}><option value="">${conBanco(l.forma) ? 'Banco' : '—'}</option>${S.cat.bancos.map(b => `<option ${b === l.banco ? 'selected' : ''}>${b}</option>`).join('')}</select>
      <input class="in n mto" data-k="monto" inputmode="numeric" aria-label="Monto" value="${l.monto}" ${cerrada ? 'disabled' : ''}>
      <button class="x" data-del="${i}" aria-label="Quitar" ${cerrada || lineas.length < 2 ? 'disabled' : ''}>×</button></div>`).join('');
    saldo();
  }
  function saldo() {
    const dif = d.total - lineas.reduce((a, l) => a + soloDigitos(l.monto), 0) - descMonto();
    $('#sal', ov).innerHTML = `<div class="saldo ${dif === 0 ? 'ok' : 'no'}"><span>${dif === 0 ? 'Cuadra con el documento' : dif > 0 ? 'Falta asignar' : 'Te pasaste por'}</span><span>${clp(Math.abs(dif))}</span></div>`;
    const ok = $('#ok', ov); if (ok) ok.disabled = dif !== 0;
    return dif;
  }
  ls.oninput = ls.onchange = e => { const r = e.target.closest('.linea'); if (!r) return; const l = lineas[r.dataset.i];
    l[e.target.dataset.k] = e.target.value;
    if (e.target.dataset.k === 'forma') { if (!conBanco(l.forma)) l.banco = ''; dibujar(); } else saldo(); };
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
    ok.disabled = true;
    try {
      const nuevo = await api('guardarDetalle', S.sess.token, S.fecha, d.folio_key,
        lineas.map(l => ({ forma: l.forma, banco: l.banco, monto: soloDigitos(l.monto), referencia: l.referencia || '' })),
        desc.on ? { monto: soloDigitos(desc.monto), motivo: desc.motivo } : null);
      toast('Folio ' + d.folio + ' guardado'); cerrarHoja(ov); alGuardar(nuevo);
    } catch (e) { ok.disabled = false; }
  };
  dibujar();
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
async function vSaldos(m) {
  const r = await api('getSaldosClientes', S.sess.token);
  const fc = iso => { const [a, mm, d] = String(iso).split('-'); return d + '-' + mm + '-' + a.slice(2); };
  const edad = d => d > 60 ? 'bad' : d > 30 ? 'warn' : 'ok';
  const vends = [...new Set(r.clientes.flatMap(c => c.vendedores))].sort();
  const conDeuda = r.clientes.filter(c => c.deuda > 0);
  render(m, `<h2>Saldos de clientes</h2>
    <p class="lead" style="margin:0 0 12px">Facturas a crédito menos los pagos anotados en Cobranza.</p>
    <div class="kpis"><div><span>Total adeudado</span><b>${clp(r.total)}</b></div>
      <div><span>Clientes con deuda</span><b>${conDeuda.length}</b></div>
      <div><span>Con facturas de más de 30 días</span><b>${conDeuda.filter(c => c.diasMax > 30).length}</b></div></div>
    <div class="row" style="margin:14px 0 10px;flex-wrap:wrap">
      <input class="in grow" id="bq" placeholder="Buscar cliente o RUT" style="min-width:200px">
      <select class="in" id="bv" style="width:auto"><option value="">Todos los vendedores</option>${vends.map(v => `<option>${esc(v)}</option>`).join('')}</select>
      <label class="muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="bp"> Ver también los al día</label></div>
    <div id="sl"></div>
    <p class="muted" style="margin-top:14px">Al registrar un pago en Cobranza, anota el folio de la factura para que se descuente de esa. Sin folio, se descuenta de la factura más antigua del cliente.</p>`);
  const abiertos = {};
  const pintar = () => {
    const q = normTxt($('#bq').value), v = $('#bv').value, todos = $('#bp').checked;
    const lista = r.clientes.filter(c => (todos || c.deuda > 0) && (!v || c.vendedores.indexOf(v) >= 0) &&
      (!q || normTxt(c.cliente).indexOf(q) >= 0 || String(c.rut).replace(/\W/g, '').indexOf(q.replace(/\W/g, '')) >= 0));
    $('#sl').innerHTML = lista.length ? lista.map(c => `<div class="card sc" data-k="${esc(c.clave)}" style="margin-bottom:8px;cursor:pointer">
      <div class="row"><div class="grow"><b>${esc(c.cliente)}</b><div class="muted">${esc(c.rut || 'Sin RUT')} · ${esc(c.vendedores.join(', '))}</div></div>
        <div style="text-align:right"><b style="font-size:20px">${clp(c.deuda)}</b><div>${c.pendientes
          ? `<span class="chip ${edad(c.diasMax)}">${c.pendientes} pendiente${c.pendientes > 1 ? 's' : ''} · ${c.diasMax} días</span>` : '<span class="chip ok">Al día</span>'}</div></div></div>
      ${abiertos[c.clave] ? `<div style="margin-top:10px;border-top:1px solid var(--line-2);padding-top:8px">
        ${c.facturas.map(f => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line-2)">
          <div class="grow">${esc(f.tipo)} N° ${esc(f.folio)} <span class="muted">· ${fc(f.fecha)} · ${esc(f.vendedorNombre)}</span>
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

/* ============ IMPORTAR MI DTE ============ */
const serialAFecha = v => { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); };
const CANON = { 'rut': 'RUT', 'datos rut': 'RUT', 'documento': 'Documento', 'folio': 'Folio', 'fecha': 'Fecha', 'condicion': 'Condicion',
  'nombre cliente': 'Nombre Cliente', 'emitido en': 'Emitido en', 'codigo': 'Codigo', 'descripcion': 'Descripcion', 'cantidad': 'Cantidad',
  'precio': 'Precio', 'nombre': 'Nombre', 'razon social': 'Razon social', 'pago': 'Pago', 'equipo': 'Equipo', 'neto': 'NETO', 'productos': 'PRODUCTOS' };

/** Busca en todas las hojas del Excel la tabla con encabezado "Folio" y reconoce si es Ventas Diarias o Informe de ventas. */
function leerLibro(buf) {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  for (const nombre of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: true, defval: '' });
    const hi = rows.findIndex(r => r.some(c => norm(c) === 'folio'));
    if (hi < 0) continue;
    const head = rows[hi].map(h => norm(h));
    const tipo = head.includes('descripcion') && head.includes('cantidad') ? 'detalle' : head.includes('documento') && head.includes('total') ? 'dte' : null;
    if (!tipo) continue;
    const keys = head.map(h => h === 'total' ? (tipo === 'dte' ? 'Total' : 'TOTAL') : CANON[h] || h);
    const filas = rows.slice(hi + 1).map(r => { const o = {}; keys.forEach((k, j) => { let v = r[j]; if (k === 'Fecha' && typeof v === 'number') v = serialAFecha(v); o[k] = v; }); return o; })
      .filter(o => o.Folio !== '' && (tipo === 'dte' ? o.Documento : o.Descripcion));
    return { tipo, filas };
  }
  throw new Error('No reconozco este archivo. Debe ser "Ventas Diarias" o "Informe de ventas" de Mi DTE.');
}

async function vImportar(m) {
  cargarXLSX().catch(() => {});                 // se empieza a descargar mientras la encargada elige los archivos
  render(m, `<h2>Importar desde Mi DTE</h2>
    <p class="lead">Sube los dos informes del día: <b>Ventas Diarias</b> (los folios y sus totales) y el <b>Informe de ventas</b> (kilos por producto). Puedes subirlos juntos. Los documentos repetidos se ignoran.</p>
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

  async function procesar(files) {
    await cargarXLSX();
    const leidos = [];
    for (const f of files) {
      try { leidos.push(Object.assign({ nombre: f.name }, leerLibro(await f.arrayBuffer()))); }
      catch (e) { leidos.push({ nombre: f.name, error: e.message }); }
    }
    leidos.sort((a, b) => (a.tipo === 'dte' ? 0 : 1) - (b.tipo === 'dte' ? 0 : 1)); // primero los folios
    $('#pv').innerHTML = leidos.map((l, i) => {
      if (l.error) return `<div class="card fcard"><b>${esc(l.nombre)}</b><div class="alert" style="margin-bottom:0">${esc(l.error)}</div></div>`;
      const esG = x => /gu[ií]a/i.test(l.tipo === 'dte' ? x.Documento : x.Nombre);
      const g = l.filas.filter(esG).length, v = l.filas.length - g;
      const fechas = [...new Set(l.filas.map(x => String(x.Fecha)))].join(', ');
      return `<div class="card fcard"><div class="row"><div class="grow"><b>${l.tipo === 'dte' ? 'Ventas Diarias' : 'Informe de ventas (kilos)'}</b>
        <div class="muted">${esc(l.nombre)} · ${esc(fechas)}</div></div>
        <span class="chip">${l.tipo === 'dte' ? v + ' documentos' : v + ' líneas de producto'}</span>${g ? `<span class="chip">${g} ${l.tipo === 'dte' ? 'guías (se omiten)' : 'líneas de guía'}</span>` : ''}</div>
        <div id="res${i}"></div></div>`;
    }).join('') + (leidos.some(l => !l.error) ? '<button class="btn cu block" id="imp">Importar</button>' : '');
    const b = $('#imp'); if (!b) return;
    b.onclick = async () => {
      b.disabled = true; const sinT = new Set(); let fechas = [];
      for (const [i, l] of leidos.entries()) {
        if (l.error) continue;
        try {
          const r = await api(l.tipo === 'dte' ? 'importarDTE' : 'importarDetalle', S.sess.token, l.filas);
          (r.terminalesSinAsignar || []).forEach(t => sinT.add(t)); fechas = fechas.concat(r.fechas);
          $('#res' + i).innerHTML = `<div class="alert ok" style="margin-bottom:0">` + (l.tipo === 'dte'
            ? `Importados <b>${r.importados}</b> documentos. ${r.repetidos ? r.repetidos + ' ya existían. ' : ''}${r.sinVendedor ? `<b>${r.sinVendedor}</b> sin vendedor.` : ''}`
            : `Importadas <b>${r.lineas}</b> líneas de venta y ${r.guias} de guías. ${r.omitidas ? r.omitidas + ' líneas de documentos ya importados se omitieron. ' : ''}` +
              (r.productosNuevos.length ? `<br>Productos nuevos agregados como inactivos (revísalos en la hoja PRODUCTOS): ${esc(r.productosNuevos.join(', '))}.` : '')) + '</div>';
        } catch (e) { $('#res' + i).innerHTML = `<div class="alert" style="margin-bottom:0">${esc(e.message)}</div>`; }
      }
      b.remove();
      const f = [...new Set(fechas)];
      if (f.length === 1 && f[0] !== S.fecha) { S.fecha = f[0]; $('#fecha').value = S.fecha; toast('Mostrando el ' + fechaLarga(S.fecha)); }
      if (sinT.size) toast('Hay terminales sin vendedor: ' + [...sinT].join(', ') + '. Asígnalos abajo.', true);
      cargarTerminales([...sinT]);
    };
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
    <h3>Por vendedor</h3>
    ${r.porVendedor.length ? `<div class="vcards">${r.porVendedor.map(v => `<div class="vcard">
      <div class="row"><b class="grow" style="font-size:17px">${esc(v.vendedor)}</b>${v.pendientes ? `<span class="chip cu">${v.pendientes} por detallar</span>` : '<span class="chip ok">Detallado</span>'}</div>
      <dl><dt>Venta (${v.documentos} docs)</dt><dd>${clp(v.venta)}</dd><dt>Crédito</dt><dd>${clp(v.credito)}</dd>
        <dt>Transferencias y depósitos</dt><dd>${clp(v.TRANSFERENCIA + v.DEP_EFECTIVO)}</dd>${v.CHEQUE ? `<dt>Cheques</dt><dd>${clp(v.CHEQUE)}</dd>` : ''}
        ${v.descuentos ? `<dt>Descuentos</dt><dd>${clp(v.descuentos)}</dd>` : ''}<dt>Efectivo ventas</dt><dd>${clp(v.EFECTIVO)}</dd>
        ${v.cobranza ? `<dt>Cobranza</dt><dd>${clp(v.cobranza)}</dd>` : ''}${v.gastos ? `<dt>Gastos</dt><dd>− ${clp(v.gastos)}</dd>` : ''}
        ${v.depositos ? `<dt>Depositado a la empresa</dt><dd>− ${clp(v.depositos)}${v.depositoDif ? ` <span class="chip bad">dif. ${clp(v.depositoDif)}</span>` : ''}</dd>` : ''}
        <dt class="tot">Efectivo a entregar</dt><dd>${clp(v.efectivoEntregar)}</dd>
        ${v.kilos.salida ? `<dt>Kilos salida / retorno</dt><dd>${kg(v.kilos.salida)} / ${kg(v.kilos.retorno)}</dd>
          <dt>Kilos vendidos${r.hayDetalle ? ' / facturados' : ''}</dt><dd>${kg(v.kilos.vendido)}${r.hayDetalle ? ' / ' + kg(v.kilos.facturado) : ''}</dd>
          ${r.hayDetalle ? `<dt>Diferencia kilos</dt><dd class="${difCls(v) === 'neg' ? 'chip bad' : difCls(v) === 'pos' ? 'chip warn' : ''}" style="justify-self:end">${v.kilos.diferencia > 0 ? '+' : ''}${kg(v.kilos.diferencia)}</dd>` : ''}` : ''}
      </dl></div>`).join('')}</div>` : '<div class="empty"><b>Sin movimientos este día</b>Parte importando los informes de Mi DTE.</div>'}
    ${r.sinAsignar.length ? `<h3>Documentos sin vendedor</h3><div class="tw"><table><thead><tr><th>Documento</th><th>Cliente</th><th>Terminal</th><th class="r">Total</th><th>Asignar a</th></tr></thead><tbody>
      ${r.sinAsignar.map(d => `<tr><td>${esc(d.tipo.replace(' Electrónica', ''))} ${esc(d.folio)}</td><td>${esc(d.cliente)}</td><td>${esc(d.terminal)}</td><td class="r">${clp(d.total)}</td>
        <td><select class="in" style="min-height:38px" data-fk="${esc(d.folio_key)}"><option value="">Elegir…</option>${opcVend('')}</select></td></tr>`).join('')}</tbody></table></div>
      <p class="muted">Si todos vienen del mismo terminal, es más rápido asignarlo una vez en Importar Mi DTE → Terminales.</p>` : ''}
    <h3>Otros movimientos</h3><div class="kpis"><div><span>Proveedores</span><b>${clp(t.proveedores)}</b></div><div><span>Consumo (venta en bodega)</span><b>${clp(t.consumo)}</b></div></div>
    <div class="row" style="margin-top:18px;justify-content:flex-end">
      ${cerrada ? (S.sess.rol === 'ADMIN' ? '<button class="btn ghost" id="re">Reabrir rendición</button>' : '')
        : '<button class="btn ghost" id="pv">Ver cómo quedaría</button><button class="btn cu" id="cl">Cerrar y generar archivo de rendición</button>'}</div>
    <div id="lnk"></div>`);
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
async function vDepositos(m) {
  const esV = S.sess.rol === 'VENDEDOR';
  if (!esV && !S.vend) S.vend = S.cat.vendedores[0] && S.cat.vendedores[0].usuario;
  const r = await api('efectivoParaDepositar', S.sess.token, S.fecha, esV ? '' : S.vend);
  const cerrada = r.estadoDia === 'CERRADA';
  const libres = r.folios.filter(x => !x.deposito).map(x => Object.assign({ tipo: 'f' }, x))
    .concat(r.cobranzas.filter(x => !x.deposito).map(x => Object.assign({ tipo: 'c' }, x)));
  render(m, `<h2>Depósitos de efectivo</h2>
    <p class="lead">Si depositas o transfieres a la empresa el efectivo que te pagaron, regístralo aquí, marca qué folios incluye y saca una foto al comprobante. Ese monto ya no se entrega en la rendición.</p>
    ${esV ? '' : `<div class="row" style="margin-bottom:12px"><select class="in" style="width:auto" id="dv">${opcVend(S.vend)}</select></div>`}
    ${cerrada ? '<div class="alert">La rendición de este día está cerrada. Solo lectura.</div>' : libres.length ? `<div class="card">
      <div class="row"><b class="grow">Efectivo por depositar</b><button class="btn ghost sm" id="all">Marcar todos</button></div>
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
      <div class="big" style="font-size:22px">${clp(d.monto)}</div>${cerrada ? '' : `<button class="x" style="width:42px" data-del="${d.id}" aria-label="Borrar depósito">×</button>`}</div></div>`).join('')
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
      const nuevo = await api('guardarDeposito', S.sess.token, S.fecha, { vendedor: esV ? '' : S.vend, banco: $('#db').value, monto: soloDigitos(dm.value), referencia: $('#dr').value,
        folios: s2.filter(x => x.tipo === 'f').map(x => x.key), cobranzas: s2.filter(x => x.tipo === 'c').map(x => x.key) });
      toast('Depósito registrado');
      const fs = [...$('#dfile').files];
      if (fs.length) { try { await subirArchivos('DEPOSITOS', nuevo.id, fs); } catch (e) { toast('El depósito quedó guardado, pero el comprobante no subió. Usa "Adjuntar".', true); } }
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

/* ============ COBRANZA, PROVEEDORES, CONSUMO, GASTOS ============ */
const MOV = {
  COBRANZA: { t: 'Cobranza', d: 'Pagos recibidos de facturas a crédito de días anteriores.',
    f: [['cliente', 'Cliente'], ['folio', 'Folio que paga'], ['monto', 'Monto', 'n'], ['forma', 'Forma de pago', 'forma'], ['banco', 'Banco', 'banco'], ['vendedor', 'Vendedor', 'vend']] },
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
    <div class="card"><div class="grid g3" id="fm">${campos.map(c => `<div><label class="f" for="m_${c[0]}">${c[1]}</label>${inp(c)}</div>`).join('')}${conAdj ? campoArchivos('mf') : ''}</div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn cu" id="ad">Agregar</button></div></div>
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
  if (conAdj) { enlazarCampoArchivos('mf'); activarAdjuntarDespues($('#ml'), recargar); }
  $('#ml').onclick = async e => { const id = e.target.dataset.id; if (!id || !confirm('¿Borrar este registro?')) return;
    await api('borrarMov', S.sess.token, tabla, id); lista(await api('listarMov', S.sess.token, tabla, S.fecha)); };
  $('#ad').onclick = async () => {
    const o = {}; $$('[name]', $('#fm')).forEach(x => o[x.name] = x.value);
    o.monto = String(soloDigitos(o.monto));
    if (o.monto === '0') return toast('Ingresa el monto.', true);
    if ((o.forma === 'TRANSFERENCIA' || o.forma === 'DEP_EFECTIVO') && 'banco' in o && !o.banco) return toast('Indica el banco.', true);
    const b = $('#ad'); b.disabled = true;
    try {
      const nuevo = await api('guardarMov', S.sess.token, tabla, S.fecha, o); toast('Agregado');
      const fs = conAdj ? [...$('#mf').files] : [];
      if (fs.length) { try { await subirArchivos(tabla, nuevo.id, fs); } catch (e) { toast('El registro quedó guardado, pero el archivo no subió. Usa "Adjuntar" en la fila.', true); } }
      $$('input', $('#fm')).forEach(x => x.value = ''); if (conAdj) $('#mf').onchange();
      await recargar();
    } finally { b.disabled = false; }
  };
}

/* ---------- arranque ---------- */
if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.indexOf('PEGA_AQUI') >= 0)
  $('#app').innerHTML = '<div class="login"><img class="logo" src="icon-192.png" alt=""><h1>Falta configurar</h1><p class="lead">Pega la URL de la implementación de Apps Script en <b>config.js</b>.</p></div>';
else S.sess ? iniciar().catch(() => salir(true)) : pantallaLogin();

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
