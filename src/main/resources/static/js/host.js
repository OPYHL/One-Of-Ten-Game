import { connect } from '/js/ws.js';

const btnStart    = document.getElementById('btnStart');    // Start/Kolejne pytanie
const btnReadDone = document.getElementById('btnReadDone');
const btnGood     = document.getElementById('btnGood');
const btnWrong    = document.getElementById('btnWrong');

const phaseEl  = document.getElementById('phase');
const winnerEl = document.getElementById('winner');
const currentEl= document.getElementById('current');
const whoEl    = document.getElementById('who');
const ttEl     = document.getElementById('tt');
const pb       = document.getElementById('pb');
const avImg    = document.getElementById('av');
const grid     = document.getElementById('grid');

const approveBackdrop = document.getElementById('approveBackdrop');
const approveText     = document.getElementById('approveText');
const btnApprove      = document.getElementById('btnApprove');
const btnReject       = document.getElementById('btnReject');
let pending = {fromId:null,toId:null};

let st = null, timer = {remainingMs:0, active:false};
let lockNext = false;
const TOTAL = 10000;

const bus = connect({
  onState: s => { st = s; renderState(); },
  onTimer: t => { timer = t; renderTimer(); },
  onEvent: ev => {
    if (ev.type === 'ROUND_WINNER'){
      const ms = (ev.reactionMs ?? parseInt(ev.value||'0',10)) || 0;
      winnerEl.textContent = `Zgłosił się: #${ev.playerId} — ${(ms/1000).toFixed(1)} s`;
    } else if (ev.type === 'RESULTS_SAVED'){
      alert('Wyniki zapisane: ' + ev.value);
    } else if (ev.type === 'NEW_GAME'){
      winnerEl.textContent='Brak zgłoszenia'; currentEl.textContent='Odpowiada: —';
      whoEl.textContent='Nikt nie odpowiada'; avImg.src=''; pb.style.width='0%';
      lockNext = false; renderState();
    } else if (ev.type === 'TARGET_PROPOSED'){
      pending.fromId = ev.playerId;
      pending.toId   = parseInt(ev.value||'0',10);
      const from = st?.players?.find(p=>p.id===pending.fromId);
      const to   = st?.players?.find(p=>p.id===pending.toId);
      approveText.textContent = `${from?.id}. ${from?.name||''} ➜ ${to?.id}. ${to?.name||''}`;
      approveBackdrop.classList.add('show');
    } else if (ev.type === 'TARGET_ACCEPTED' || ev.type === 'TARGET_REJECTED'){
      approveBackdrop.classList.remove('show');
      pending = {fromId:null,toId:null};
    } else if (ev.type === 'CUE' && ev.value === 'BOOM'){
      lockNext = true; renderState();
    } else if (ev.type === 'BOOM_DONE' || (ev.type==='LOCK_NEXT' && ev.value==='OFF')){
      lockNext = false; renderState();
    } else if (ev.type === 'LOCK_NEXT' && ev.value==='ON'){
      lockNext = true; renderState();
    }
  }
});

// Start/Kolejne pytanie – decyduj po fazie
btnStart.onclick = () => {
  if (!st) return;
  if (st.phase === 'IDLE') bus.send('/app/host/start', {});
  else if (st.phase === 'READING') bus.send('/app/host/next', {});
};

btnReadDone.onclick = () => bus.send('/app/host/readDone', {});
btnGood.onclick     = () => judge(true);
btnWrong.onclick    = () => judge(false);

btnApprove.onclick  = () => bus.send('/app/approveTarget', {accept:true});
btnReject.onclick   = () => bus.send('/app/approveTarget', {accept:false});

function judge(ok){
  if (!st || !st.answeringId) return;
  bus.send('/app/judge', {playerId: st.answeringId, correct: ok});
}

function renderState(){
  const s = st; if(!s) return;

  // Etykieta startu
  btnStart.textContent = (s.phase === 'READING') ? 'Kolejne pytanie (S)' : 'Rozpocznij (S)';

  // Blokada podczas INTRO oraz BOOM
  const inIntro = s.phase === 'INTRO';
  btnStart.disabled = !(s.phase==='IDLE' || s.phase==='READING') || inIntro || lockNext;

  btnReadDone.disabled = !(s.phase==='READING');

  const hasAnswering = !!s.answeringId && s.phase === 'ANSWERING';
  btnGood.disabled = !hasAnswering;
  btnWrong.disabled = !hasAnswering;

  phaseEl.textContent  = 'Faza: ' + s.phase;
  const p = s.players.find(x => x.id === s.answeringId);
  currentEl.textContent = 'Odpowiada: ' + (p ? (p.id + '. ' + (p.name || '')) : '—');
  whoEl.textContent = p ? (p.id + '. ' + (p.name||'')) : 'Nikt nie odpowiada';
  avImg.src = p ? (p.gender === 'FEMALE' ? '/img/female.png' : '/img/male.png') : '';

  grid.innerHTML = '';
  s.players.forEach(pl => {
    const b = document.createElement('button');
    b.className = 'card' + (pl.id === s.answeringId ? ' answering' : '');
    b.disabled = pl.eliminated || s.phase === 'BUZZING' || s.phase === 'COOLDOWN' || timer.active;
    b.innerHTML = `<div style="font-weight:700">${pl.id}. ${escapeHtml(pl.name||'')}</div>
                   <div class="mini">Życia: ${pl.lives} • Punkty: ${pl.score} ${pl.eliminated?'• ❌ OUT':''}</div>`;
    b.onclick = () => bus.send('/app/setAnswering', {playerId: pl.id});
    grid.appendChild(b);
  });
}

function renderTimer(){
  const ms = timer.remainingMs || 0;
  ttEl.textContent = (ms/1000).toFixed(1);
  const pct = Math.max(0, Math.min(1, (TOTAL - ms)/TOTAL));
  pb.style.width = (pct*100).toFixed(1) + '%';
  pb.style.background = timer.active ? 'var(--ok)' : (ms===0 ? 'var(--bad)' : 'var(--ok)');
}

document.addEventListener('keydown', (e)=>{
  if (['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName)) return;
  const k = e.key.toLowerCase();
  if (k==='s' && !btnStart.disabled) btnStart.click();
  if (k==='r' && !btnReadDone.disabled) btnReadDone.click();
  if (k==='g' && !btnGood.disabled) btnGood.click();
  if (k==='b' && !btnWrong.disabled) btnWrong.click();
});

function escapeHtml(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
