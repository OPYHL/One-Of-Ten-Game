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

const approveBackdrop = document.getElementById('approveBackdrop');
const approveText     = document.getElementById('approveText');
const btnApprove      = document.getElementById('btnApprove');
const btnReject       = document.getElementById('btnReject');

let st = null, timer = {remainingMs:0, active:false};
let pending = { fromId:null, toId:null };
let lockNext = false;
const TOTAL = 10000;

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

btnBuzzStart.onclick = () => send('/app/openBuzzers');
btnHostStart.onclick = () => {
  if (!st) return;
  if (st.phase === 'IDLE') send('/app/host/start');
  else if (st.phase === 'READING') send('/app/host/next');
};
btnReadDone.onclick  = () => send('/app/host/readDone');
btnIntro.onclick     = () => send('/app/playCue',{cue:'INTRO'});
btnStartQ.onclick    = () => send('/app/playCue',{cue:'START_Q'});
btnBoom.onclick      = () => send('/app/playCue',{cue:'BOOM'});
btnSave.onclick      = () => send('/app/saveResults');
btnReset.onclick     = () => send('/app/reset');
btnNewGame.onclick   = () => { if (confirm('NOWA GRA – wyczyści wszystko. Kontynuować?')) send('/app/newGame'); };

btnApprove.onclick   = () => send('/app/approveTarget', {accept:true});
btnReject.onclick    = () => send('/app/approveTarget', {accept:false});

function send(dest, body){ bus.send(dest, body || {}); }

function render(){
  if(!st) return;
  ph.textContent = 'Faza: ' + st.phase;
  ti.textContent = 'Timer: ' + (timer.remainingMs/1000).toFixed(1) + 's';
  const pct = Math.max(0, Math.min(1, (TOTAL - (timer.remainingMs||0))/TOTAL));
  pb.style.width = (pct*100).toFixed(1)+'%';

  btnHostStart.textContent = st.phase === 'READING' ? 'Kolejne pytanie' : 'Rozpocznij rundę';
  const inIntro = st.phase==='INTRO';
  btnHostStart.disabled = !(st.phase==='IDLE' || st.phase==='READING') || inIntro || lockNext;
  btnReadDone.disabled  = !(st.phase==='READING');

  const p = st.players.find(x=>x.id===st.answeringId);
  who.textContent = p ? (p.id+'. '+(p.name||'')) : '—';

  grid.innerHTML = '';
  st.players.forEach(pl => {
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

window.rename    = (id, name)   => send('/app/setName',{playerId:id, name});
window.setGender = (id, gender) => send('/app/setGender',{playerId:id, gender});
window.setAns    = (id)         => send('/app/setAnswering',{playerId:id});
window.judge     = (id, ok)     => send('/app/judge',{playerId:id, correct:ok});

function disableSetAnswering(state){
  return (state.phase==='BUZZING' || state.phase==='COOLDOWN' || (timer.active)) ? 'disabled' : '';
}
