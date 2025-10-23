import { connect } from '/js/ws.js';

const btnStart    = document.getElementById('btnStart');
const btnRead     = document.getElementById('btnRead');
const btnReadDone = document.getElementById('btnReadDone');
const btnGood     = document.getElementById('btnGood');
const btnBad      = document.getElementById('btnBad');
const btnNext     = document.getElementById('btnNext');
const btnReset    = document.getElementById('btnReset');
const btnNew      = document.getElementById('btnNew');

const phaseEl     = document.getElementById('phase');
const statPlayers = document.getElementById('statPlayers');

const ansAv   = document.getElementById('ansAv');
const ansName = document.getElementById('ansName');
const ansSeat = document.getElementById('ansSeat');
const ansTime = document.getElementById('ansTime');
const ansJudge= document.getElementById('ansJudge');

const plist   = document.getElementById('plist');

let state = null;
let ansStartTs = 0;

const bus = connect({
  onState: s => { state = s; render(); },
  onEvent: ev => handleEvent(ev),
  onTimer: t => handleTimer(t),
});

function send(dest, body={}){ try{ bus.send(dest, body);}catch(e){ console.error(e); } }

function startOrNext(){
  if (!state) return;
  const phase = state.phase;
  if (phase === 'IDLE') {
    send('/app/host/start');
  } else if (phase === 'READING' || phase === 'SELECTING') {
    send('/app/host/next');
  }
}

function handleReadingStart(){
  if (!state) return;
  const phase = state.phase;
  if (phase === 'READING' || phase === 'SELECTING') {
    send('/app/host/next');
  }
}

/* ====== UI actions ====== */
btnStart.addEventListener('click',     startOrNext);
btnRead.addEventListener('click',      handleReadingStart);
btnReadDone.addEventListener('click',  ()=> send('/app/host/readDone'));
btnGood.addEventListener('click',      ()=> judge(true));
btnBad.addEventListener('click',       ()=> judge(false));
btnNext.addEventListener('click',      ()=> send('/app/host/next'));
btnReset.addEventListener('click',     ()=> send('/app/reset'));
btnNew.addEventListener('click',       ()=> send('/app/newGame'));

document.addEventListener('keydown', (e)=>{
  if (e.repeat) return;
  const key = e.key.toLowerCase();
  if (key === 's') startOrNext();
  if (key === 'r') btnReadDone.click();
  if (key === 'g') judge(true);
  if (key === 'b') judge(false);
});

function judge(ok){
  if (!state?.answeringId) return;
  send('/app/judge', { playerId: state.answeringId, correct: !!ok });
}

/* ====== render ====== */
function isJoined(p){
  const nm = (p?.name||'').trim();
  if (!nm) return false;
  if (nm.toLowerCase() === (`gracz ${p.id}`).toLowerCase()) return false;
  return true;
}

function render(){
  const st = state; if (!st) return;

  const joined = (st.players||[]).filter(isJoined);
  statPlayers.textContent = joined.length;
  phaseEl.textContent = st.phase;

  /* current answering */
  const p = st.players?.find(x=>x.id===st.answeringId);
  if (p){
    ansAv.src   = (p.gender==='FEMALE') ? '/img/female.png' : '/img/male.png';
    ansName.textContent = `${p.id}. ${(p.name||'').trim()}`;
    ansSeat.textContent = `Stanowisko ${p.id}`;
  } else {
    ansAv.src = '/img/host.png';
    ansName.textContent = '—';
    ansSeat.textContent = 'Stanowisko —';
  }

  /* list */
  plist.innerHTML = '';
  joined.forEach(pp=>{
    const row = document.createElement('div');
    row.className = 'playerRow' + (st.answeringId===pp.id ? ' active':'');

    row.innerHTML = `
      <div class="info">
        <div class="name">${pp.id}. ${(pp.name||'').trim()}</div>
        <div class="sub">Życia: ${pp.lives} • Punkty: ${pp.score}</div>
      </div>
      <div class="cta">Ustaw</div>
    `;
    row.addEventListener('click', ()=> send('/app/setAnswering', { playerId: pp.id }));
    plist.appendChild(row);
  });

  // blokady przycisków zależnie od fazy
  const ph = st.phase;
  btnStart.disabled    = !(ph==='IDLE' || ph==='READING' || ph==='SELECTING');
  btnRead.disabled     = (ph!=='READING' && ph!=='SELECTING');
  btnReadDone.disabled = (ph!=='READING');
  btnGood.disabled     = (ph!=='ANSWERING');
  btnBad.disabled      = (ph!=='ANSWERING');
  btnNext.disabled     = !(ph==='IDLE' || ph==='SELECTING'); // po ciszy i wyborze — kolejne pytanie
}

/* ====== events & timer ====== */
function handleEvent(ev){
  if (!ev) return;
  if (ev.type === 'PHASE'){
    if (ev.value === 'ANSWERING') ansStartTs = performance.now();
  }
  if (ev.type === 'JUDGE'){
    ansJudge.textContent = ev.value==='CORRECT' ? '✓' : '✗';
    ansJudge.className   = 'judge show ' + (ev.value==='CORRECT'?'good':'bad');
    setTimeout(()=> ansJudge.className='judge', 1000);
  }
}
function handleTimer(t){
  if (state?.phase === 'ANSWERING'){
    const left = Math.max(0, t.remainingMs||0);
    ansTime.textContent = `Czas: ${((10_000-left)/1000).toFixed(1)} s`;
  } else {
    ansTime.textContent = 'Czas: 0.0 s';
  }
}
