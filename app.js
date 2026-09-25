/* ============ utilidades ============ */
const $ = s => document.querySelector(s);
const clp = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
const kg = n => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('es-CL');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const FL = {EFECTIVO:'Efectivo',TRANSFERENCIA:'Transferencia',DEP_EFECTIVO:'Depósito en efectivo',CHEQUE:'Cheque',CREDITO:'Crédito',NOTA_CREDITO:'Nota de crédito'};
let loading = 0;
function busy(on){ loading += on ? 1 : -1; let b = $('.load'); if (loading > 0 && !b){ b = document.createElement('div'); b.className='load'; document.body.appendChild(b);} if (loading <= 0 && b) b.remove(); }
function toast(msg, err){ const t = document.createElement('div'); t.className = 'toast' + (err ? ' e' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), err ? 5000 : 2500); }
async function api(fn, ...args){
  busy(true);
  try {
    let r;
    try {
      const res = await fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fn, args }) });
      r = await res.json();
    } catch (e) { throw new Error('Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.'); }
    if (!r.ok) throw new Error(r.error);
    return r.data;
  } catch (e) {
    const m = String(e.message || e);
    if (m.indexOf('SESION') >= 0) logout(true);
    toast(m.replace('SESION: ', ''), true);
    throw e;
  } finally { busy(false); }
}

/* ============ estado ============ */
const S = { sess: null, cat: null, fecha: null, tab: null, vend: '' };
try { S.sess = JSON.parse(localStorage.getItem('rn_sess') || 'null'); } catch(e){}

const TABS = {
  VENDEDOR:   [['folios','Mis folios'],['COBRANZA','Cobranza'],['GASTOS','Gastos']],
  BODEGA:     [['despacho','Despacho y retorno'],['CONSUMO','Consumo']],
  RENDICION:  [['resumen','Rendición'],['importar','Importar DTE'],['folios','Folios'],['despacho','Kilos'],['COBRANZA','Cobranza'],['PROVEEDORES','Proveedores'],['CONSUMO','Consumo'],['GASTOS','Gastos'],['historial','Historial']],
};
TABS.SUPERVISOR = TABS.RENDICION.slice(0,1).concat([['descuentos','Descuentos']], TABS.RENDICION.slice(1));
TABS.ADMIN = TABS.SUPERVISOR;

function logout(expirada){
  if (!expirada && S.sess) api('logout', S.sess.token).catch(() => {});
  S.sess = null; S.cat = null; try{ localStorage.removeItem('rn_sess'); }catch(e){} renderLogin();
}

/* ============ login ============ */
async function renderLogin(){
  $('#app').innerHTML = `<div class="login"><img src="logo.png" alt="" width="64" height="64" style="border-radius:14px"><h1>Rendiciones Naranjo</h1>
    <p class="muted">Elige tu nombre e ingresa tu PIN.</p><div class="who" id="who"></div>
    <input id="pin" class="in pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN" autocomplete="off">
    <button class="btn nar" style="width:100%;margin-top:10px" id="go">Ingresar</button></div>`;
  let sel = null;
  const us = await api('listaUsuarios');
  const R = {ADMIN:'Administración',SUPERVISOR:'Supervisión',RENDICION:'Rendición',BODEGA:'Bodega',VENDEDOR:'Vendedor'};
  $('#who').innerHTML = us.map(u => `<button data-u="${esc(u.usuario)}">${esc(u.nombre)}<small>${R[u.rol]||u.rol}</small></button>`).join('');
  $('#who').onclick = e => { const b = e.target.closest('button'); if(!b) return; sel = b.dataset.u;
    [...$('#who').children].forEach(x => x.classList.toggle('on', x === b)); $('#pin').focus(); };
  const go = async () => { if(!sel) return toast('Elige tu nombre primero', true);
    const s = await api('login', sel, $('#pin').value); S.sess = s; try{ localStorage.setItem('rn_sess', JSON.stringify(s)); }catch(e){} start(); };
  $('#go').onclick = go; $('#pin').onkeydown = e => { if (e.key === 'Enter') go(); };
}

/* ============ shell ============ */
async function start(){
  S.cat = await api('catalogo', S.sess.token);
  S.fecha = S.fecha || S.cat.hoy;
  const tabs = TABS[S.sess.rol] || [];
  S.tab = S.tab && tabs.some(t => t[0] === S.tab) ? S.tab : tabs[0][0];
  $('#app').innerHTML = `<header><div class="hbar"><div class="brand">Naranjo<small>${esc(S.sess.nombre)}</small></div><div class="sp"></div>
    <input type="date" id="fecha" value="${S.fecha}" aria-label="Fecha de la rendición"><button class="out" id="out">Salir</button></div>
    <nav id="nav">${tabs.map(t => `<button data-t="${t[0]}">${t[1]}</button>`).join('')}</nav></header><main id="main"></main>`;
  $('#out').onclick = () => logout();
  $('#fecha').onchange = e => { S.fecha = e.target.value; go(S.tab); };
  $('#nav').onclick = e => { const b = e.target.closest('button'); if (b) go(b.dataset.t); };
  go(S.tab);
}
function go(t){
  S.tab = t;
  [...$('#nav').children].forEach(b => b.classList.toggle('on', b.dataset.t === t));
  const m = $('#main'); m.innerHTML = '';
  ({folios: vFolios, despacho: vDespacho, resumen: vResumen, importar: vImportar, historial: vHistorial, descuentos: vDescuentos}[t] || vMov)(m, t);
}
const vendOpts = (sel, todos) => (todos ? `<option value="">Todos los vendedores</option>` : '') +
  S.cat.vendedores.map(v => `<option value="${esc(v.usuario)}" ${v.usuario === sel ? 'selected' : ''}>${esc(v.nombre)}</option>`).join('');

/* ============ FOLIOS (vendedor detalla cada documento) ============ */
async function vFolios(m){
  const esV = S.sess.rol === 'VENDEDOR';
  m.innerHTML = `<div class="row"><h2 class="grow">${esV ? 'Mis folios del día' : 'Folios por vendedor'}</h2>
    ${esV ? '' : `<select class="in" style="width:auto" id="fv">${vendOpts(S.vend, true)}</select>`}</div><div id="fl"></div>`;
  if (!esV) $('#fv').onchange = e => { S.vend = e.target.value; load(); };
  async function load(){
    const r = await api('misDocumentos', S.sess.token, S.fecha, S.vend);
    const docs = r.docs, pend = docs.filter(d => d.estado !== 'DETALLADO');
    const el = $('#fl');
    if (!docs.length){ el.innerHTML = `<div class="empty">No hay documentos para esta fecha.<br><span class="muted">Los folios aparecen cuando la encargada importa el informe de Mi DTE.</span></div>`; return; }
    el.innerHTML = `<p class="muted">${docs.length} documentos · ${pend.length ? pend.length + ' por detallar' : 'todos detallados'} · venta ${clp(docs.reduce((a,d)=>a+d.total,0))}</p>` +
      docs.sort((a,b) => (a.estado === 'DETALLADO') - (b.estado === 'DETALLADO') || String(a.folio).localeCompare(String(b.folio), 'es', {numeric:true}))
      .map((d,i) => `<button class="folio ${d.estado === 'DETALLADO' ? 'd' : 'p'}" data-i="${i}">
        <div class="grow"><div class="c">${esc(d.cliente)}</div><div class="muted">${esc(d.tipo.replace(' Electrónica',''))} ${esc(d.folio)} · Mi DTE: ${esc(d.condicion_dte)}${esV ? '' : ' · ' + esc(d.vendedor || 'sin vendedor')}</div>
        <div style="margin-top:4px">${estadoChips(d)}</div></div><div class="t num">${clp(d.total)}</div></button>`).join('');
    el.onclick = e => { const b = e.target.closest('.folio'); if (b) detalle(docs[b.dataset.i], r.estadoDia, load); };
  }
  load();
}
function estadoChips(d){
  let h = d.estado === 'DETALLADO' ? '<span class="chip ok">Detallado</span> ' : '<span class="chip nar">Por detallar</span> ';
  h += d.pagos.map(p => `<span class="chip">${FL[p.forma]}${p.banco ? ' ' + esc(p.banco) : ''}</span>`).join(' ');
  d.descuentos.forEach(x => h += ` <span class="chip ${x.estado === 'APROBADO' ? 'ok' : x.estado === 'RECHAZADO' ? 'bad' : 'warn'}">Desc. ${clp(x.monto)} ${x.estado.toLowerCase()}</span>`);
  return h;
}

function detalle(d, estadoDia, onSaved){
  const cerr = estadoDia === 'CERRADA';
  let lineas = d.pagos.length ? d.pagos.map(p => Object.assign({}, p)) :
    [{forma: /cr[ée]dito/i.test(d.condicion_dte) ? 'CREDITO' : 'EFECTIVO', banco:'', monto: d.total, referencia:''}];
  const dPrev = d.descuentos.find(x => x.estado !== 'RECHAZADO');
  let desc = { on: !!dPrev, monto: dPrev ? dPrev.monto : '', motivo: dPrev ? dPrev.motivo : '' };
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-label="Detalle del folio"><div class="row"><div class="grow"><div class="muted">${esc(d.tipo)} ${esc(d.folio)}</div>
    <div style="font-weight:700;font-size:18px">${esc(d.cliente)}</div></div><div class="num" style="font:700 26px var(--fc)">${clp(d.total)}</div></div>
    ${cerr ? '<div class="alert">La rendición de este día está cerrada. Solo lectura.</div>' : `<div class="quick">
      <button class="btn ghost sm" data-q="EFECTIVO">Todo efectivo</button><button class="btn ghost sm" data-q="TRANSFERENCIA">Todo transferencia</button>
      <button class="btn ghost sm" data-q="CREDITO">Todo a crédito</button><button class="btn ghost sm" data-q="CHEQUE">Todo cheque</button></div>`}
    <label class="f">Cómo se pagó</label><div id="ls"></div>
    ${cerr ? '' : '<button class="btn ghost sm" id="add">Agregar otra forma de pago</button>'}
    <h3>Descuento</h3>
    <label class="row"><input type="checkbox" id="don" ${desc.on ? 'checked' : ''} ${cerr ? 'disabled' : ''}> Se aplicó un descuento (requiere autorización)</label>
    <div id="dbox" class="grid g2" style="margin-top:8px;${desc.on ? '' : 'display:none'}">
      <div><label class="f">Monto</label><input class="in n" id="dm" inputmode="numeric" value="${desc.monto}"></div>
      <div><label class="f">Motivo</label><input class="in" id="dmo" value="${esc(desc.motivo)}" placeholder="Ej: producto dañado"></div></div>
    <div id="sal"></div>
    <div class="row"><button class="btn ghost grow" id="cx">Cerrar</button>${cerr ? '' : '<button class="btn nar grow" id="ok">Guardar</button>'}</div></div>`;
  document.body.appendChild(ov);
  const ls = ov.querySelector('#ls');
  const needBank = f => f === 'TRANSFERENCIA' || f === 'DEP_EFECTIVO' || f === 'CHEQUE';
  function draw(){
    ls.innerHTML = lineas.map((l,i) => `<div class="linea" data-i="${i}">
      <select class="in" data-k="forma" ${cerr?'disabled':''}>${S.cat.formas.map(f => `<option value="${f}" ${f===l.forma?'selected':''}>${FL[f]}</option>`).join('')}</select>
      <select class="in" data-k="banco" ${needBank(l.forma)&&!cerr?'':'disabled'}><option value="">${needBank(l.forma)?'Banco':'—'}</option>${S.cat.bancos.map(b => `<option ${b===l.banco?'selected':''}>${b}</option>`).join('')}</select>
      <input class="in n" data-k="monto" inputmode="numeric" value="${l.monto}" ${cerr?'disabled':''}>
      <button class="x" data-del="${i}" aria-label="Quitar" ${cerr||lineas.length<2?'disabled':''}>×</button></div>`).join('');
    saldo();
  }
  function saldo(){
    const pag = lineas.reduce((a,l) => a + (Number(String(l.monto).replace(/\D/g,'')) || 0), 0);
    const ds = desc.on ? (Number(String(desc.monto).replace(/\D/g,'')) || 0) : 0;
    const dif = d.total - pag - ds;
    ov.querySelector('#sal').innerHTML = `<div class="saldo ${dif === 0 ? 'ok' : 'no'}"><span>${dif === 0 ? 'Cuadra con el documento' : dif > 0 ? 'Falta por asignar' : 'Te pasaste por'}</span><span class="num">${clp(Math.abs(dif))}</span></div>`;
    return dif;
  }
  ls.oninput = ls.onchange = e => { const r = e.target.closest('.linea'); if (!r) return; const l = lineas[r.dataset.i];
    l[e.target.dataset.k] = e.target.value; if (e.target.dataset.k === 'forma'){ if(!needBank(l.forma)) l.banco=''; draw(); } else saldo(); };
  ls.onclick = e => { const i = e.target.dataset.del; if (i !== undefined){ lineas.splice(i,1); draw(); } };
  ov.querySelector('.quick') && (ov.querySelector('.quick').onclick = e => { const q = e.target.dataset.q; if(!q) return;
    const ds = desc.on ? (Number(String(desc.monto).replace(/\D/g,''))||0) : 0;
    lineas = [{forma:q, banco:'', monto: d.total - ds, referencia:''}]; draw(); });
  ov.querySelector('#add') && (ov.querySelector('#add').onclick = () => { const dif = saldo();
    lineas.push({forma:'TRANSFERENCIA', banco:'', monto: dif > 0 ? dif : 0, referencia:''}); draw(); });
  ov.querySelector('#don').onchange = e => { desc.on = e.target.checked; ov.querySelector('#dbox').style.display = desc.on ? '' : 'none'; saldo(); };
  ov.querySelector('#dm').oninput = e => { desc.monto = e.target.value; saldo(); };
  ov.querySelector('#dmo').oninput = e => { desc.motivo = e.target.value; };
  ov.querySelector('#cx').onclick = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.querySelector('#ok') && (ov.querySelector('#ok').onclick = async () => {
    if (saldo() !== 0) return toast('El detalle debe cuadrar exactamente con el total.', true);
    if (desc.on && !desc.motivo.trim()) return toast('Escribe el motivo del descuento.', true);
    const miss = lineas.find(l => (l.forma === 'TRANSFERENCIA' || l.forma === 'DEP_EFECTIVO') && !l.banco);
    if (miss) return toast('Indica a qué banco llegó la transferencia o depósito.', true);
    await api('guardarDetalle', S.sess.token, S.fecha, d.folio_key,
      lineas.map(l => ({forma:l.forma, banco:l.banco, monto: Number(String(l.monto).replace(/\D/g,''))||0, referencia:l.referencia||''})),
      desc.on ? {monto: Number(String(desc.monto).replace(/\D/g,''))||0, motivo: desc.motivo} : null);
    toast('Folio ' + d.folio + ' guardado'); ov.remove(); onSaved();
  });
  draw();
}

/* ============ DESPACHO Y RETORNO (bodega) ============ */
async function vDespacho(m){
  if (!S.vend) S.vend = S.cat.vendedores[0] && S.cat.vendedores[0].usuario;
  m.innerHTML = `<div class="row"><h2 class="grow">Despacho y retorno</h2><select class="in" style="width:auto" id="dv">${vendOpts(S.vend)}</select></div>
    <p class="muted">En la mañana anota la salida. En la tarde, al pesar lo que vuelve, anota el retorno en la misma fila.</p><div id="dt"></div>`;
  $('#dv').onchange = e => { S.vend = e.target.value; load(); };
  async function load(){
    const reg = await api('getDespacho', S.sess.token, S.fecha, S.vend); const map = {}; reg.forEach(r => map[r.codigo] = r);
    const v = x => x === '' || x == null ? '' : x;
    $('#dt').innerHTML = `<div class="tw"><table><thead><tr><th>Producto</th><th>Un.</th><th class="r">Salida</th><th class="r">Retorno</th><th class="r">Vendido</th></tr></thead><tbody>` +
      S.cat.productos.map(p => { const r = map[p.codigo] || {}; return `<tr data-c="${esc(p.codigo)}"><td>${esc(p.nombre)}${p.tipo==='REVENTA'?' <span class="chip">reventa</span>':''}</td><td>${esc(p.unidad)}</td>
        <td class="r"><input class="in n" data-k="salida" inputmode="decimal" value="${v(r.salida)}"></td>
        <td class="r"><input class="in n" data-k="retorno" inputmode="decimal" value="${v(r.retorno)}"></td><td class="r vend"></td></tr>`; }).join('') +
      `</tbody><tfoot><tr><td>Total kilos</td><td></td><td class="r" id="ts"></td><td class="r" id="tr"></td><td class="r" id="tv"></td></tr></tfoot></table></div>
      <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn nar" id="sv">Guardar</button></div>`;
    const tb = $('#dt tbody');
    const n = s => Number(String(s).replace(',', '.')) || 0;
    const calc = () => { let S1=0,S2=0; [...tb.rows].forEach(tr => { const s = tr.querySelector('[data-k=salida]').value, r = tr.querySelector('[data-k=retorno]').value;
      tr.querySelector('.vend').textContent = s !== '' ? kg(n(s) - n(r)) : ''; const p = S.cat.productos.find(x => x.codigo === tr.dataset.c);
      if (p.unidad !== 'UN'){ S1 += n(s); S2 += n(r); } });
      $('#ts').textContent = kg(S1); $('#tr').textContent = kg(S2); $('#tv').textContent = kg(S1 - S2); };
    tb.oninput = calc; calc();
    $('#sv').onclick = async () => {
      const filas = [...tb.rows].map(tr => ({codigo: tr.dataset.c, salida: tr.querySelector('[data-k=salida]').value.replace(',', '.'), retorno: tr.querySelector('[data-k=retorno]').value.replace(',', '.')}));
      await api('saveDespacho', S.sess.token, S.fecha, S.vend, filas); toast('Despacho de ' + S.vend + ' guardado'); };
  }
  load();
}

/* ============ IMPORTAR DTE ============ */
function vImportar(m){
  m.innerHTML = `<h2>Importar ventas de Mi DTE</h2><div class="card"><p style="margin-top:0">Descarga desde Mi DTE el informe de <b>ventas diarias</b> (Excel o CSV) y súbelo aquí.
    Cada folio queda asignado a su vendedor según el terminal “Emitido en”. Las guías de despacho se omiten y los folios repetidos se ignoran.</p>
    <input type="file" id="fi" accept=".xlsx,.xls,.csv" class="in"><div id="pv" style="margin-top:12px"></div></div>`;
  $('#fi').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
    rd.onload = ev => { try {
      const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array', cellDates:true});
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, raw:false, dateNF:'dd-mm-yyyy', defval:''});
      const hi = rows.findIndex(r => r.some(c => /^folio$/i.test(String(c).trim())) && r.some(c => /documento/i.test(c)));
      if (hi < 0) throw new Error('No encontré las columnas Folio y Documento. ¿Es el informe de ventas de Mi DTE?');
      const head = rows[hi].map(h => { h = String(h).trim(); return /rut/i.test(h) ? 'RUT' : /emitido/i.test(h) ? 'Emitido en' : /nombre/i.test(h) ? 'Nombre Cliente' : /condici/i.test(h) ? 'Condicion' : h; });
      const data = rows.slice(hi + 1).map(r => { const o = {}; head.forEach((h,i) => o[h] = r[i]); return o; }).filter(o => o.Documento && o.Folio);
      const g = data.filter(o => /gu[ií]a/i.test(o.Documento)).length;
      const term = {}; data.forEach(o => { if(!/gu[ií]a/i.test(o.Documento)) term[o['Emitido en']] = (term[o['Emitido en']]||0) + 1; });
      $('#pv').innerHTML = `<p><b>${data.length - g}</b> documentos de venta · ${g} guías que se omitirán</p>
        <div class="tw"><table><thead><tr><th>Terminal</th><th class="r">Docs</th><th>Vendedor</th></tr></thead><tbody>${Object.keys(term).map(t => {
          const v = S.cat.vendedores.find(v => String(v.terminales||'').toUpperCase().split(',').map(s=>s.trim()).includes(String(t).toUpperCase()));
          return `<tr><td>${esc(t)}</td><td class="r">${term[t]}</td><td>${v ? esc(v.nombre) : '<span class="chip bad">sin asignar</span>'}</td></tr>`; }).join('')}</tbody></table></div>
        <p class="muted">Si un terminal aparece sin asignar, agrégalo en la hoja USUARIOS (columna terminales) o asigna los folios a mano después.</p>
        <button class="btn nar" id="imp">Importar ${data.length - g} documentos</button>`;
      $('#imp').onclick = async () => { const r = await api('importarDTE', S.sess.token, data);
        $('#pv').innerHTML = `<div class="saldo ok"><span>Importados ${r.importados} documentos (${r.fechas.join(', ')})</span></div>
          <p class="muted">${r.repetidos} ya existían · ${r.guias} guías omitidas · ${r.sinVendedor} sin vendedor</p>`;
        if (r.fechas.length === 1){ S.fecha = r.fechas[0]; $('#fecha').value = S.fecha; } };
    } catch(err){ $('#pv').innerHTML = `<div class="alert">${esc(err.message)}</div>`; } };
    rd.readAsArrayBuffer(f); };
}

/* ============ RESUMEN / CIERRE ============ */
async function vResumen(m){
  const r = await api('getResumen', S.sess.token, S.fecha);
  const t = r.totales, cerrada = r.estado === 'CERRADA';
  m.innerHTML = `<div class="row"><h2 class="grow">Rendición del ${S.fecha.split('-').reverse().join('-')}</h2>
      <span class="chip ${cerrada ? 'ok' : 'nar'}">${cerrada ? 'Cerrada' : 'Abierta'}</span></div>
    <div class="cierre"><div><span>Venta documentada</span><b class="num">${clp(t.venta)}</b></div><div><span>A crédito</span><b class="num">${clp(t.credito)}</b></div>
      <div><span>Cobranza</span><b class="num">${clp(t.cobranza)}</b></div><div><span>Gastos</span><b class="num">${clp(t.gastos)}</b></div>
      <div class="cash"><span>Efectivo a recibir</span><b class="num">${clp(t.efectivo)}</b></div></div>
    ${r.alertas.length ? `<div class="alert"><b>Antes de cerrar</b><ul style="margin:6px 0 0;padding-left:18px">${r.alertas.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    <h3>Por vendedor</h3>
    ${r.porVendedor.length ? `<div class="tw"><table><thead><tr><th>Vendedor</th><th class="r">Docs</th><th class="r">Venta</th><th class="r">Crédito</th><th class="r">Efectivo</th><th class="r">Transf.</th><th class="r">Dep. ef.</th><th class="r">Cheque</th><th class="r">Desc.</th><th class="r">Cobranza</th><th class="r">Gastos</th><th class="r">Entrega efectivo</th><th class="r">Kg salida</th><th class="r">Kg retorno</th><th class="r">Kg vendidos</th></tr></thead><tbody>
      ${r.porVendedor.map(v => `<tr><td><b>${esc(v.vendedor)}</b> ${v.pendientes ? `<span class="chip nar">${v.pendientes} pend.</span>` : ''}</td><td class="r">${v.documentos}</td><td class="r">${clp(v.venta)}</td><td class="r">${clp(v.credito)}</td>
        <td class="r">${clp(v.EFECTIVO)}</td><td class="r">${clp(v.TRANSFERENCIA)}</td><td class="r">${clp(v.DEP_EFECTIVO)}</td><td class="r">${clp(v.CHEQUE)}</td><td class="r">${clp(v.descuentos)}</td>
        <td class="r">${clp(v.cobranza)}</td><td class="r">${clp(v.gastos)}</td><td class="r"><b>${clp(v.efectivoEntregar)}</b></td><td class="r">${kg(v.kilos.salida)}</td><td class="r">${kg(v.kilos.retorno)}</td><td class="r">${kg(v.kilos.vendido)}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Aún no hay movimientos para esta fecha. Parte importando el informe de Mi DTE.</div>'}
    ${r.sinAsignar.length ? `<h3>Documentos sin vendedor</h3><div class="tw"><table><thead><tr><th>Documento</th><th>Cliente</th><th>Terminal</th><th class="r">Total</th><th>Asignar a</th></tr></thead><tbody>
      ${r.sinAsignar.map(d => `<tr><td>${esc(d.tipo)} ${esc(d.folio)}</td><td>${esc(d.cliente)}</td><td>${esc(d.terminal)}</td><td class="r">${clp(d.total)}</td>
        <td><select class="in" data-fk="${esc(d.folio_key)}"><option value="">Elegir…</option>${vendOpts('')}</select></td></tr>`).join('')}</tbody></table></div>` : ''}
    <h3>Otros movimientos del día</h3><div class="cierre"><div><span>Proveedores</span><b class="num">${clp(t.proveedores)}</b></div><div><span>Consumo (venta en bodega)</span><b class="num">${clp(t.consumo)}</b></div></div>
    <div class="row" style="margin-top:16px;justify-content:flex-end">
      ${cerrada ? (S.sess.rol === 'ADMIN' ? '<button class="btn ghost" id="re">Reabrir rendición</button>' : '') : '<button class="btn nar" id="cl">Cerrar y generar archivo de rendición</button>'}</div>`;
  m.querySelectorAll('select[data-fk]').forEach(s => s.onchange = async () => { if (!s.value) return;
    await api('asignarVendedor', S.sess.token, s.dataset.fk, s.value); toast('Asignado'); go('resumen'); });
  $('#re') && ($('#re').onclick = async () => { await api('reabrirRendicion', S.sess.token, S.fecha); go('resumen'); });
  $('#cl') && ($('#cl').onclick = async () => {
    let res = await api('cerrarRendicion', S.sess.token, S.fecha, false);
    if (!res.ok){ if (!confirm('Hay pendientes:\n\n- ' + res.alertas.join('\n- ') + '\n\n¿Cerrar de todas formas?')) return;
      res = await api('cerrarRendicion', S.sess.token, S.fecha, true); }
    toast('Rendición cerrada'); window.open(res.url, '_blank'); go('resumen'); });
}

/* ============ DESCUENTOS (autorización) ============ */
async function vDescuentos(m){
  const ds = await api('descuentosPendientes', S.sess.token);
  m.innerHTML = `<h2>Descuentos por autorizar</h2>` + (ds.length ? ds.map(d => `<div class="card" style="margin-bottom:8px"><div class="row">
      <div class="grow"><b>${esc(d.cliente)}</b><div class="muted">${esc(d.folio_key)} · ${esc(d.vendedor)} · ${esc(d.fecha)}</div><div>${esc(d.motivo)}</div></div>
      <div class="num" style="font:700 22px var(--fc)">${clp(d.monto)}</div></div>
      <div class="row" style="margin-top:10px;justify-content:flex-end"><button class="btn ghost sm" data-no="${d.id}">Rechazar</button><button class="btn nar sm" data-si="${d.id}">Autorizar</button></div></div>`).join('')
    : '<div class="empty">No hay descuentos esperando autorización.</div>');
  m.onclick = async e => { const si = e.target.dataset.si, no = e.target.dataset.no; if (!si && !no) return;
    await api('resolverDescuento', S.sess.token, si || no, !!si); toast(si ? 'Descuento autorizado' : 'Descuento rechazado'); m.onclick = null; go('descuentos'); };
}

/* ============ HISTORIAL ============ */
async function vHistorial(m){
  const h = await api('historial', S.sess.token);
  m.innerHTML = `<h2>Rendiciones cerradas</h2>` + (h.length ? `<div class="tw"><table><thead><tr><th>Fecha</th><th>Estado</th><th>Cerrada por</th><th>Archivo</th></tr></thead><tbody>
    ${h.map(x => `<tr><td>${esc(x.fecha)}</td><td>${esc(x.estado)}</td><td>${esc(x.cerrado_por)}</td><td>${x.url ? `<a href="${esc(x.url)}" target="_blank">Abrir</a>` : ''}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty">Todavía no se ha cerrado ninguna rendición.</div>');
}

/* ============ MOVIMIENTOS: cobranza, proveedores, consumo, gastos ============ */
const MOV = {
  COBRANZA: { t:'Cobranza', d:'Pagos recibidos de facturas a crédito de días anteriores.',
    f:[['cliente','Cliente'],['folio','Folio que paga'],['monto','Monto','n'],['forma','Forma','forma'],['banco','Banco','banco'],['vendedor','Vendedor','vend']] },
  PROVEEDORES: { t:'Proveedores', d:'Pagos y documentos de proveedores del día.',
    f:[['proveedor','Proveedor'],['documento','Documento'],['folio','Folio'],['monto','Monto','n'],['forma','Forma','forma'],['obs','Observación']] },
  CONSUMO: { t:'Consumo', d:'Ventas hechas directamente en la bodega.',
    f:[['cliente','Cliente'],['folio','Folio'],['monto','Monto','n'],['forma','Forma','forma'],['obs','Observación']] },
  GASTOS: { t:'Gastos', d:'Gastos del día (combustible, peajes, etc.). Descuentan del efectivo a entregar.',
    f:[['concepto','Concepto'],['monto','Monto','n'],['respaldo','N° boleta o respaldo'],['responsable','Responsable','vend'],['obs','Observación']] }
};
async function vMov(m, tabla){
  const cfg = MOV[tabla], esV = S.sess.rol === 'VENDEDOR';
  const campos = cfg.f.filter(c => !(esV && c[2] === 'vend'));
  const inp = c => c[2] === 'forma' ? `<select class="in" name="${c[0]}">${S.cat.formas.filter(f => f !== 'CREDITO').map(f => `<option value="${f}">${FL[f]}</option>`).join('')}</select>`
    : c[2] === 'banco' ? `<select class="in" name="${c[0]}"><option value="">—</option>${S.cat.bancos.map(b => `<option>${b}</option>`).join('')}</select>`
    : c[2] === 'vend' ? `<select class="in" name="${c[0]}">${tabla === 'GASTOS' ? '<option value="GENERAL">General / planta</option>' : ''}${vendOpts(S.vend)}</select>`
    : `<input class="in ${c[2]==='n'?'n':''}" name="${c[0]}" ${c[2]==='n'?'inputmode="numeric"':''}>`;
  m.innerHTML = `<h2>${cfg.t}</h2><p class="muted">${cfg.d}</p><div class="card"><div class="grid g3" id="fm">${campos.map(c => `<div><label class="f">${c[1]}</label>${inp(c)}</div>`).join('')}</div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn nar" id="ad">Agregar</button></div></div><div id="ml" style="margin-top:14px"></div>`;
  async function load(){
    const rows = await api('listarMov', S.sess.token, tabla, S.fecha);
    const cols = campos.map(c => c[0]);
    $('#ml').innerHTML = rows.length ? `<div class="tw"><table><thead><tr>${campos.map(c => `<th class="${c[2]==='n'?'r':''}">${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>
      ${rows.map(r => `<tr>${cols.map(k => `<td class="${k==='monto'?'r':''}">${k==='monto' ? clp(r[k]) : k==='forma' ? (FL[r[k]]||esc(r[k])) : esc(r[k])}</td>`).join('')}<td><button class="x" data-id="${r.id}" aria-label="Borrar">×</button></td></tr>`).join('')}
      </tbody><tfoot><tr>${cols.map(k => `<td class="r">${k==='monto' ? clp(rows.reduce((a,r)=>a+r.monto,0)) : ''}</td>`).join('')}<td></td></tr></tfoot></table></div>`
      : '<div class="empty">Sin registros para esta fecha.</div>';
  }
  $('#ml').onclick = async e => { const id = e.target.dataset.id; if (!id || !confirm('¿Borrar este registro?')) return; await api('borrarMov', S.sess.token, tabla, id); load(); };
  $('#ad').onclick = async () => { const o = {}; $('#fm').querySelectorAll('[name]').forEach(x => o[x.name] = x.value);
    o.monto = String(o.monto).replace(/\D/g,'');
    if ((o.forma === 'TRANSFERENCIA' || o.forma === 'DEP_EFECTIVO') && 'banco' in o && !o.banco) return toast('Indica el banco.', true);
    await api('guardarMov', S.sess.token, tabla, S.fecha, o); toast('Agregado');
    $('#fm').querySelectorAll('input').forEach(x => x.value = ''); load(); };
  load();
}

/* ============ inicio ============ */
if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.indexOf('PEGA_AQUI') >= 0)
  $('#app').innerHTML = '<div class="login"><h1>Falta configurar</h1><p>Pega la URL de la implementación de Apps Script en <b>config.js</b>.</p></div>';
else S.sess ? start().catch(() => logout(true)) : renderLogin();

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
