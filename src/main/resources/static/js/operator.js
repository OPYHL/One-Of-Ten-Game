import { connect } from '/js/ws.js';

const ph = document.getElementById('ph');
const ti = document.getElementById('ti');
const who = document.getElementById('who');
const reaction = document.getElementById('reaction');
const grid = document.getElementById('grid');
const pb = document.getElementById('pb');

const btnBuzzStart = document.getElementById('btnBuzzStart');
const btnHostStart = document.getElementById('btnHostStart');
const btnReadDone  = document.getElementById('btnReadDone');
const btnIntro     = document.getElementById('btnIntro');
const btnStartQ    = document.getElementById('btnStartQ');
const btnBoom      = document.getElementById('btnBoom');
const btnSave      = document.getElementById('btnSave');
const btnReset     = document.getElementById('btnReset');
const btnNewGame   = document.getElementById('btnNewGame');
const btnResetQuestions = document.getElementById('btnResetQuestions');

const answerSlider = document.getElementById('answerSlider');
const answerValue  = document.getElementById('answerValue');
const answerHint   = document.getElementById('answerHint');
const answerMini   = document.getElementById('answerMini');

const approveBackdrop = document.getElementById('approveBackdrop');
const approveText     = document.getElementById('approveText');
const btnApprove      = document.getElementById('btnApprove');
const btnReject       = document.getElementById('btnReject');

let st = null, timer = {remainingMs:0, active:false};
let pending = { fromId:null, toId:null };
let lockNext = false;
let totalAnswerMs = 10000;
let sliderConfig = null;
let suppressSlider = false;

const normName = p => (p?.name || '').trim();
const looksLikePlaceholder = p => {
  const nm = normName(p);
  if (!nm) return true;
  return nm.toLowerCase() === (`gracz ${p?.id}`).toLowerCase();
};
function coerceJoinedFlag(val){
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number'){
    if (!Number.isFinite(val)) return null;
    return val > 0;
  }
  if (typeof val === 'string'){
    const norm = val.trim().toLowerCase();
    if (!norm) return null;
    if (['false','0','no','n','f','off'].includes(norm)) return false;
    if (['true','1','yes','y','t','on','joined','connected','ready'].includes(norm)) return true;
  }
  return null;
}
function isJoined(p){
  if (!p) return false;
  const explicit = coerceJoinedFlag(p.joined);
  if (explicit != null) return explicit;
  return !looksLikePlaceholder(p);
}
function joinedPlayers(list){
  if (!Array.isArray(list)) return [];
  return list.filter(isJoined);
}

const bus = connect({
  onState: s => { st = s; render(); },
  onTimer: t => { timer = t; render(); },
  onEvent: ev => {
    if (ev.type === 'ROUND_WINNER'){
      const ms = (ev.reactionMs ?? parseInt(ev.value||'0',10)) || 0;
      reaction.textContent = (ms/1000).toFixed(1) + ' s';
    } else if (ev.type === 'RESULTS_SAVED'){
      alert('Wyniki zapisane: ' + ev.value);
    } else if (ev.type === 'NEW_GAME'){
      reaction.textContent = '—'; who.textContent='—'; pb.style.width='0%';
      lockNext=false; render();
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
      lockNext = true; render();
    } else if (ev.type === 'BOOM_DONE' || (ev.type==='LOCK_NEXT' && ev.value==='OFF')){
      lockNext = false; render();
    } else if (ev.type === 'LOCK_NEXT' && ev.value==='ON'){
      lockNext = true; render();
    }
  }
});
loadOperatorConfig();

async function loadOperatorConfig(){
  if (!answerSlider) return;
  try{
    const res = await fetch('/api/operator/config');
    if (!res.ok) return;
    sliderConfig = await res.json();
    setupSlider(sliderConfig);
  } catch (e){ console.error('Nie udało się pobrać konfiguracji operatora', e); }
}

function setupSlider(cfg){
  if (!answerSlider) return;
  const ans = cfg?.answer || {};
  if (ans.minSeconds) answerSlider.min = ans.minSeconds;
  if (ans.maxSeconds) answerSlider.max = ans.maxSeconds;
  if (ans.stepSeconds) answerSlider.step = ans.stepSeconds;
  const def = ans.defaultSeconds || parseInt(answerSlider.value,10) || 10;
  suppressSlider = true;
  answerSlider.value = def;
  suppressSlider = false;
  updateSliderLabel(def);
  if (answerHint){ answerHint.textContent = `Zakres: ${answerSlider.min}–${answerSlider.max} s`; }
}

function updateSliderLabel(sec){
  if (!answerValue) return;
  answerValue.textContent = `${sec} s`;
}

function syncSlider(seconds){
  if (!answerSlider) return;
  const sec = Math.round(seconds);
  if (Number(answerSlider.value) !== sec){
    suppressSlider = true;
    answerSlider.value = sec;
    suppressSlider = false;
  }
  updateSliderLabel(sec);
}

if (answerSlider){
  answerSlider.addEventListener('input', () => updateSliderLabel(Number(answerSlider.value)));
  answerSlider.addEventListener('change', () => {
    if (suppressSlider) return;
    const sec = Number(answerSlider.value);
    if (Number.isFinite(sec)){ send('/app/operator/answerTimer', { seconds: sec }); }
  });
}


btnBuzzStart.onclick = () => send('/app/openBuzzers');
btnHostStart.onclick = () => {
  if (!st) return;
  if (st.phase === 'IDLE') {
    send('/app/host/start');
  } else if (st.phase === 'READING') {
    if (st.hostDashboard?.activeQuestion?.preparing){
      send('/app/host/readingStart');
    } else {
      send('/app/host/next');
    }
  }
};
btnReadDone.onclick  = () => send('/app/host/readDone');
btnIntro.onclick     = () => send('/app/playCue',{cue:'INTRO'});
btnStartQ.onclick    = () => send('/app/playCue',{cue:'START_Q'});
btnBoom.onclick      = () => send('/app/playCue',{cue:'BOOM'});
btnSave.onclick      = () => send('/app/saveResults');
btnReset.onclick     = () => send('/app/reset');
btnNewGame.onclick   = () => { if (confirm('NOWA GRA – wyczyści wszystko. Kontynuować?')) send('/app/newGame'); };
if (btnResetQuestions){
  btnResetQuestions.onclick = async () => {
    if (!confirm('Zresetować listę wykorzystanych pytań?')) return;
    try{
      const res = await fetch('/api/questions/usage/reset', { method: 'POST' });
      if (!res.ok){
        throw new Error(`HTTP ${res.status}`);
      }
      alert('Wykorzystane pytania zostały zresetowane.');
    } catch (error){
      console.error('Nie udało się zresetować pytań', error);
      alert('Nie udało się zresetować pytań. Sprawdź konsolę.');
    }
  };
}

btnApprove.onclick   = () => send('/app/approveTarget', {accept:true});
btnReject.onclick    = () => send('/app/approveTarget', {accept:false});

function send(dest, body){ bus.send(dest, body || {}); }

function render(){
  if(!st) return;
  if (st.settings?.answerTimerMs){
    totalAnswerMs = st.settings.answerTimerMs;
    syncSlider(totalAnswerMs/1000);
    if (answerMini){
      const sec = Math.round(totalAnswerMs/1000);
      answerMini.textContent = `W ANSWERING pasek pokazuje upływ ${sec} s. W BUZZING czekamy na „Znam odpowiedź!”.`;
    }
  }
  ph.textContent = 'Faza: ' + st.phase;
  ti.textContent = 'Timer: ' + (timer.remainingMs/1000).toFixed(1) + 's';
  const pct = totalAnswerMs > 0 ? Math.max(0, Math.min(1, (totalAnswerMs - (timer.remainingMs||0))/totalAnswerMs)) : 0;
  pb.style.width = (pct*100).toFixed(1)+'%';

  const prepping = st.phase === 'READING' && st.hostDashboard?.activeQuestion?.preparing;
  btnHostStart.textContent = st.phase === 'READING'
    ? (prepping ? 'Rozpocznij czytanie' : 'Kolejne pytanie')
    : 'Rozpocznij rundę';
  const inIntro = st.phase==='INTRO';
  btnHostStart.disabled = !(st.phase==='IDLE' || st.phase==='READING') || inIntro || lockNext;
  btnReadDone.disabled  = !(st.phase==='READING');

  const p = st.players.find(x=>x.id===st.answeringId);
  who.textContent = p ? (p.id+'. '+(p.name||'')) : '—';

  grid.innerHTML = '';
  const players = joinedPlayers(st.players);
  if (!players.length){
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.style.gridColumn = '1 / -1';
    empty.innerHTML = '<div class="mini">Brak aktywnych graczy.</div>';
    grid.appendChild(empty);
    return;
  }
  players.forEach(pl => {
    const card = document.createElement('div'); card.className='card' + (pl.id===st.answeringId?' answering':'');
    card.innerHTML = `
      <div class="row">
        <b>${pl.id}.</b>
        <input class="input" type="text" value="${pl.name||''}" size="14" onchange="this.blur(); rename(${pl.id}, this.value)" />
        <select class="input" onchange="setGender(${pl.id}, this.value)">
          <option value="MALE" ${pl.gender==='MALE'?'selected':''}>M</option>
          <option value="FEMALE" ${pl.gender==='FEMALE'?'selected':''}>K</option>
        </select>
      </div>
      <div class="row mini">Życia: ${pl.lives} • Punkty: ${pl.score} ${pl.eliminated?'• ❌ OUT':''}</div>
      <div class="row" style="gap:8px; margin-top:8px">
        <button ${disableSetAnswering(st)} onclick="setAns(${pl.id})">Ustaw adresata</button>
        <button onclick="judge(${pl.id}, true)">✓ Dobra</button>
        <button onclick="judge(${pl.id}, false)">✗ Zła</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

window.rename    = (id, name)   => send('/app/setName',{playerId:id, name, force:true});
window.setGender = (id, gender) => send('/app/setGender',{playerId:id, gender});
window.setAns    = (id)         => send('/app/setAnswering',{playerId:id});
window.judge     = (id, ok)     => send('/app/judge',{playerId:id, correct:ok});

function disableSetAnswering(state){
  return (state.phase==='BUZZING' || (timer.active)) ? 'disabled' : '';
}
