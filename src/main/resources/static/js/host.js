# Create a full host.js file for download

host_js = r"""// /js/host.js — panel prowadzącego (TV-like)
import { connect } from '/js/ws.js';

/* ===================== DOM ===================== */
const btnStart    = document.getElementById('btnStart');
const btnReadDone = document.getElementById('btnReadDone');
const btnGood     = document.getElementById('btnGood');
const btnWrong    = document.getElementById('btnWrong');

const playersCounter = document.getElementById('playersCounter');

const phaseEl  = document.getElementById('phase');
const winnerEl = document.getElementById('winner');
const currentEl= document.getElementById('current');
const whoEl    = document.getElementById('who');
const pb       = document.getElementById('pb');
const avImg    = document.getElementById('av');
const grid     = document.getElementById('grid');

const approveBackdrop = document.getElementById('approveBackdrop');
const approveText     = document.getElementById('approveText');
const btnApprove      = document.getElementById('btnApprove');
const btnReject       = document.getElementById('btnReject');

/* ===================== STAN ===================== */
let s = null;
let timer = {remainingMs:0, active:false};
let lockNext = false;               // blokada „Kolejne pytanie” podczas BOOM/Cisza
let pending = {fromId:null,toId:null};
const TOTAL = 10000;                // 10 s pasek dla ANSWERING

/* ===================== BUS ====================== */
const bus = connect({
  onState: st => { s = st; renderState(); },
  onTimer: t => { timer = t; renderTimer(); },
  onEvent: ev => handleEvent(ev),
});

/* ===================== AKCJE ==================== */
btnStart?.addEventListener('click', () => {
  if (!s) return;
  if (s.phase === 'IDLE')     bus.send('/app/host/start', {});
  else if (s.phase === 'READING') bus.send('/app/host/next', {});
});
btnReadDone?.addEventListener('click', () => bus.send('/app/host/readDone', {}));
btnGood?.addEventListener('click', () => judge(true));
btnWrong?.addEventListener('click', () => judge(false));

btnApprove?.addEventListener('click', () => bus.send('/app/approveTarget', {accept:true}));
btnReject ?.addEventListener('click', () => bus.send('/app/approveTarget', {accept:false}));

/* =================== HANDLERS =================== */
function handleEvent(ev){
  if (!ev) return;
  switch (ev.type) {
    case 'PLAYER_JOINED':
      toast(`Dołączył: ${ev.value} (#${ev.playerId})`);
      break;
    case 'ROUND_WINNER': {
      const ms = (ev.reactionMs ?? parseInt(ev.value||'0',10)) || 0;
      winnerEl.textContent = `Zgłosił się: #${ev.playerId} — ${(ms/1000).toFixed(1)} s`;
      break;
    }
    case 'TARGET_PROPOSED':
      pending.fromId = ev.playerId;
      pending.toId   = parseInt(ev.value||'0',10);
      openApproveModal(pending.fromId, pending.toId);
      break;
    case 'TARGET_ACCEPTED':
    case 'TARGET_REJECTED':
      closeApproveModal();
      pending = {fromId:null,toId:null};
      break;
    case 'CUE':
      if (ev.value === 'BOOM') { lockNext = true; renderState(); }
      break;
    case 'LOCK_NEXT':
      lockNext = (String(ev.value).toUpperCase() !== 'OFF');
      renderState();
      break;
  }
}

function judge(ok){
  if (s?.answeringId) bus.send('/app/judge', { playerId: s.answeringId, correct: !!ok });
}

/* ===================== RENDER =================== */
function isJoined(p){
  return p && typeof p.name === 'string' && p.name.trim().length > 0 && !p.placeholder;
}

function renderState(){
  if (!s) return;

  const joined = (s.players || []).filter(isJoined);
  playersCounter && (playersCounter.textContent = `Gracze: ${joined.length}`);

  // przyciski start/next
  if (btnStart){
    btnStart.textContent = (s.phase==='READING') ? 'Kolejne pytanie (S)' : 'Rozpocznij (S)';
    btnStart.disabled = !(s.phase==='IDLE' || s.phase==='READING') || lockNext || joined.length===0;
  }
  if (btnReadDone) btnReadDone.disabled = !(s.phase==='READING');

  const answering = s.players.find(x => x.id === s.answeringId);
  const canJudge = !!answering && s.phase === 'ANSWERING';
  if (btnGood)  btnGood.disabled  = !canJudge;
  if (btnWrong) btnWrong.disabled = !canJudge;

  if (phaseEl)  phaseEl.textContent  = 'Faza: ' + s.phase;
  if (currentEl) currentEl.textContent= 'Odpowiada: ' + (answering ? `${answering.id}. ${answering.name||''}` : '—');
  if (whoEl)     whoEl.textContent    = answering ? `${answering.id}. ${answering.name||''}` : 'Nikt nie odpowiada';
  if (avImg)     avImg.src            = answering ? (answering.gender==='FEMALE'?'/img/female.png':'/img/male.png') : '';

  // lista graczy — tylko dołączeni
  if (grid){
    grid.innerHTML = '';
    joined.forEach(p => {
      const b = document.createElement('button');
      b.className = 'card' + (p.id===s.answeringId ? ' answering' : '');
      b.disabled  = p.eliminated || s.phase==='BUZZING' || s.phase==='COOLDOWN' || timer.active;
      b.innerHTML = `
        <div style="font-weight:800">${p.id}. ${escapeHtml(p.name)}</div>
        <div class="mini">Życia: ${p.lives} • Punkty: ${p.score} ${p.eliminated?'• ❌ OUT':''}</div>`;
      b.addEventListener('click', () => bus.send('/app/setAnswering', { playerId: p.id }));
      grid.appendChild(b);
    });
  }
}

function renderTimer(){
  if (!pb) return;
  const ms = timer.remainingMs || 0;
  const pct = Math.max(0, Math.min(1, (TOTAL - ms)/TOTAL));
  pb.style.width = (pct*100).toFixed(1)+'%';
  pb.style.background = timer.active ? 'var(--ok)' : (ms===0 ? 'var(--bad)' : 'var(--ok)');
}

/* ==================== MODAL ===================== */
function openApproveModal(fromId, toId){
  if (!approveBackdrop) return;
  const from = s?.players?.find(p => p.id === fromId);
  const to   = s?.players?.find(p => p.id === toId);
  const text = `${from ? (from.id+'. '+(from.name||'')) : '#'+fromId} ➜ ${to ? (to.id+'. '+(to.name||'')) : '#'+toId}`;
  if (approveText) approveText.textContent = text;
  approveBackdrop.classList.add('show');
}
function closeApproveModal(){
  if (!approveBackdrop) return;
  approveBackdrop.classList.remove('show');
}

/* =================== SKRÓTY ===================== */
document.addEventListener('keydown', e => {
  const tag = (e.target && e.target.tagName) || '';
  if (['INPUT','SELECT','TEXTAREA'].includes(tag)) return;
  const k = e.key.toLowerCase();
  if (k==='s' && !btnStart?.disabled)    btnStart.click();
  if (k==='r' && !btnReadDone?.disabled) btnReadDone.click();
  if (k==='g' && !btnGood?.disabled)     btnGood.click();
  if (k==='b' && !btnWrong?.disabled)    btnWrong.click();
});

/* ================== POMOCNICZE ================== */
function escapeHtml(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

function toast(t){
  let box = document.getElementById('toasts');
  if(!box){
    box = document.createElement('div'); box.id='toasts';
    box.style.cssText='position:fixed;right:16px;top:16px;display:flex;flex-direction:column;gap:8px;z-index:9999';
    document.body.appendChild(box);
    const css = document.createElement('style');
    css.textContent = `.toast{background:#111a2c;border:1px solid #23324d;color:#eaf2ff;padding:9px 12px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45);opacity:0;transform:translateY(-6px);transition:.2s}.toast.show{opacity:1;transform:translateY(0)}`;
    document.head.appendChild(css);
  }
  const el = document.createElement('div'); el.className='toast'; el.textContent=t; box.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('show'));
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(),220); }, 2200);
}
"""

with open('/mnt/data/host.js', 'w', encoding='utf-8') as f:
    f.write(host_js)

print("Saved to /mnt/data/host.js")
