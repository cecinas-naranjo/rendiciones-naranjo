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
const CATS = { PROPIOS: 'Productos propios', CARNICOS: 'Cárnicos', CONGELADOS: 'Congelados', LACTEOS: 'Lácteos', REVISAR: 'Por clasificar' };
const ROL = { ADMIN: 'Administración', SUPERVISOR: 'Supervisión', RENDICION: 'Rendición', BODEGA: 'Bodega', VENDEDOR: 'Vendedor' };

const IC = {
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  receipt: '<path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3z"/><path d="M9 9h6M9 13h6"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
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
const skeleton = n => Array.from({ length: n }, () => '<div class="sk"></div>').join('');
function render(el, html) { el.innerHTML = html; el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }

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

async function api(fn, ...args) {
  busy(true);
  try {
    let r;
    try {
      const res = await fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn, args }) });
      r = await res.json();
    } catch (e) { throw new Error('Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.'); }
    if (!r.ok) throw new Error(r.error);
    return r.data;
  } catch (e) {
    const m = String(e.message || e);
    if (m.indexOf('SESION') >= 0) salir(true);
    toast(m.replace('SESION: ', ''), true);
    throw e;
  } finally { busy(false); }
}

/* ---------- estado ---------- */
const S = { sess: null, cat: null, fecha: null, tab: null, vend: '', filtro: 'pend' };
try { S.sess = JSON.parse(localStorage.getItem('rn_sess') || 'null'); } catch (e) {}

const TABS = {
  VENDEDOR: [['folios', 'Mis folios', 'list'], ['COBRANZA', 'Cobranza', 'cash'], ['depositos', 'Depósitos', 'bank'], ['GASTOS', 'Gastos', 'receipt']],
  BODEGA: [['despacho', 'Despacho', 'box']],
  RENDICION: [['resumen', 'Rendición'], ['importar', 'Importar Mi DTE'], ['folios', 'Folios'], ['despacho', 'Kilos'], ['COBRANZA', 'Cobranza'],
    ['depositos', 'Depósitos'], ['PROVEEDORES', 'Proveedores'], ['CONSUMO', 'Consumo'], ['GASTOS', 'Gastos'], ['historial', 'Historial']]
};
TABS.SUPERVISOR = TABS.RENDICION.slice(0, 1).concat([['descuentos', 'Descuentos']], TABS.RENDICION.slice(1));
TABS.ADMIN = TABS.SUPERVISOR;

function salir(expirada) {
  if (!expirada && S.sess) api('logout', S.sess.token).catch(() => {});
  S.sess = null; S.cat = null; S.tab = null;
  try { localStorage.removeItem('rn_sess'); } catch (e) {}
  document.body.classList.remove('has-bottom');
  pantallaLogin();
}

/* ---------- ingreso ---------- */
async function pantallaLogin() {
  const app = $('#app');
  render(app, `<div class="login"><img class="logo" src="icon-512.png" alt="Cecinas Naranjo">
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
  S.fecha = S.fecha || S.cat.hoy;
  const tabs = TABS[S.sess.rol] || [];
  S.tab = S.tab && tabs.some(t => t[0] === S.tab) ? S.tab : tabs[0][0];
  const unica = tabs.length === 1;          // bodega: una sola pantalla, sin menú
  const abajo = !unica && tabs.length <= 4;
  document.body.classList.toggle('has-bottom', abajo);
  app.innerHTML = `<header>
      <div class="hbar"><div class="brand"><img src="logo.png" alt=""><div><b>Naranjo</b><small>${esc(S.sess.nombre)}</small></div></div>
        <div class="sp"></div>
        <div class="day"><button id="prev" aria-label="Día anterior">‹</button><input type="date" id="fecha" value="${S.fecha}" aria-label="Fecha">
          <button id="next" aria-label="Día siguiente">›</button></div>
        <button class="icon-btn" id="out">Salir</button></div>
      ${abajo || unica ? '<div class="progress" aria-hidden="true"><i id="prog"></i></div>' : `<nav class="top" id="nav">${tabs.map(t => `<button data-t="${t[0]}">${t[1]}</button>`).join('')}</nav>`}
    </header>
    <main id="main"></main>
    ${abajo ? `<nav class="bottom" id="nav">${tabs.map(t => `<button data-t="${t[0]}">${icon(t[2])}${t[1]}</button>`).join('')}</nav>` : ''}`;
  $('#out').onclick = () => salir();
  const cambiarFecha = f => { S.fecha = f; $('#fecha').value = f; ir(S.tab); };
  $('#fecha').onchange = e => e.target.value && cambiarFecha(e.target.value);
  $('#prev').onclick = () => cambiarFecha(sumarDias(S.fecha, -1));
  $('#next').onclick = () => cambiarFecha(sumarDias(S.fecha, 1));
  if ($('#nav')) $('#nav').onclick = e => { const b = e.target.closest('button'); if (b) ir(b.dataset.t); };
  ir(S.tab);
}
function ir(t) {
  S.tab = t;
  $$('#nav button').forEach(b => { b.classList.toggle('on', b.dataset.t === t); if (b.dataset.t === t) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  const m = $('#main'); m.onclick = null; m.innerHTML = skeleton(4);
  const v = { folios: vFolios, despacho: vDespacho, resumen: vResumen, importar: vImportar, depositos: vDepositos, historial: vHistorial, descuentos: vDescuentos }[t] || vMov;
  v(m, t);
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
    if (typeof XLSX === 'undefined') return toast('Cargando el lector de Excel, intenta en unos segundos.', true);
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
  render(m, `<div class="row"><div class="grow"><h2>Rendición</h2><p class="lead" style="margin:0">${fechaLarga(S.fecha)}</p></div>
      <span class="chip ${cerrada ? 'ok' : 'cu'}">${cerrada ? 'Cerrada' : 'Abierta'}</span></div>
    <div class="kpis" style="margin-top:14px"><div><span>Venta documentada</span><b>${clp(t.venta)}</b></div><div><span>A crédito</span><b>${clp(t.credito)}</b></div>
      <div><span>Cobranza</span><b>${clp(t.cobranza)}</b></div><div><span>Gastos</span><b>${clp(t.gastos)}</b></div>
      <div class="cash"><span>Efectivo a recibir</span><b>${clp(t.efectivo)}</b></div></div>
    ${r.alertas.length ? `<div class="alert"><b>Antes de cerrar</b><ul>${r.alertas.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`
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
  $('#app').innerHTML = '<div class="login"><img class="logo" src="icon-512.png" alt=""><h1>Falta configurar</h1><p class="lead">Pega la URL de la implementación de Apps Script en <b>config.js</b>.</p></div>';
else S.sess ? iniciar().catch(() => salir(true)) : pantallaLogin();

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
