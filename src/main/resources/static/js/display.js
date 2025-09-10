import { connect } from '/js/ws.js';

/* ====================== DOM ====================== */
const gridWrap = document.getElementById('gridWrap');
const grid     = document.getElementById('grid');
const banner   = document.getElementById('banner');
const pb       = document.getElementById('pb');

const stage      = document.getElementById('stage');
const stageName  = document.getElementById('stageName');
const stageAv    = document.getElementById('stageAv');
const stageSeat  = document.getElementById('stageSeat');
const stagePb    = document.getElementById('stagePb');
const stageJudge = document.getElementById('stageJudge');

/* ===================== AUDIO ===================== */
const sounds = {
  INTRO:  document.getElementById('sndIntro'),
  GOOD:   document.getElementById('sndGood'),
  WRONG:  document.getElementById('sndWrong'),
  BOOM:   document.getElementById('sndBoom'),
  START_Q:null
};

document.getElementById('unlock')?.addEventListener('click', async () => {
  try { await sounds.INTRO.play(); sounds.INTRO.pause(); sounds.INTRO.currentTime = 0; } catch {}
  try { await sounds.BOOM.play();  sounds.BOOM.pause();  sounds.BOOM.currentTime  = 0; } catch {}
  alert('Dźwięk odblokowany.');
});

let bus;
sounds.INTRO?.addEventListener('ended', () => { try { bus.send('/app/introDone', {}); } catch(e) {} });
sounds.BOOM ?.addEventListener('ended',  () => { try { bus.send('/app/boomDone',  {}); } catch(e) {} });

/* ===================== STAN ====================== */
let state = null;
const TOTAL_ANS_MS = 10_000;
const COOLDOWN_MS  = 3_000;

let lastScores = new Map();
let lastLives  = new Map();

/* ===== Fallback anty-zawieszka cooldownu ===== */
let lastCooldownTickAt = 0;
let cooldownFallback   = null;

/* ============ Overlays: cooldown 3-2-1 ============ */
let cd = document.getElementById('cd');
if (!cd){
  cd = document.createElement('div');
  cd.id = 'cd';
  cd.style.cssText = `
    position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index:25;
    pointer-events:none; background:rgba(0,0,0,0);
  `;
  cd.innerHTML = `
    <div id="cdRing" style="
      width:min(32vmin, 280px); height:min(32vmin, 280px); border-radius:50%;
      background:conic-gradient(var(--accent) 0%, transparent 0%);
      display:grid; place-items:center;
      filter: drop-shadow(0 10px 30px rgba(0,0,0,.6));
    ">
      <div style="
        width:86%; height:86%; border-radius:50%;
        background:rgba(5,10,20,.85); border:1px solid #20304b;
        display:grid; place-items:center;">
        <div id="cdNum" style="font-size:min(18vmin, 150px); line-height:1; font-weight:800; color:#dbe7ff; text-shadow:0 8px 30px rgba(0,0,0,.45)">3</div>
      </div>
    </div>
  `;
  document.body.appendChild(cd);
}
const cdRing = cd.querySelector('#cdRing');
const cdNum  = cd.querySelector('#cdNum');

/* ================= WEBSOCKET BUS ================= */
bus = connect({
  onState: s => { state = s; render(); },
  onEvent: ev => handleEvent(ev),
  onTimer: t => handleTimer(t),
});

/* ==================== RENDER ===================== */
function render(){
  const st = state; if (!st) return;

  grid.innerHTML = '';
  st.players.forEach(p=>{
    const card = document.createElement('div');
    card.className =
      'card' +
      (st.answeringId === p.id ? ' answering' : '') +
      (p.eliminated ? ' eliminated' : '');
    const lives = Math.max(0, p.lives);

    const diffScore = (lastScores.get(p.id) ?? p.score) !== p.score;
    const diffLives = (lastLives.get(p.id)  ?? p.lives) !== p.lives;

    card.innerHTML = `
      <div class="name ${diffScore?'scorePulse':''}">${p.id}. ${escapeHtml(p.name||'')}</div>
      <div class="avatar ${diffLives?'lifeShake':''}">
        <img src="${p.gender==='FEMALE'?'/img/female.png':'/img/male.png'}" onerror="this.style.opacity=.2">
      </div>
      <div class="meta">
        <span>Pkt: <b>${p.score}</b></span>
        <div class="lives">${heartsHtml(lives)}</div>
      </div>
      <div class="judge" id="judge-${p.id}"></div>
    `;
    grid.appendChild(card);

    lastScores.set(p.id, p.score);
    lastLives.set(p.id, p.lives);
  });

  if (st.phase === 'INTRO') {
    showBanner('Intro…');
  } else if (st.phase === 'READING') {
    showBanner('Prowadzący czyta pytanie…');
  } else if (st.phase === 'COOLDOWN') {
    banner.classList.remove('show');
    cd.style.display = 'flex';
    cdNum.textContent = '3';
    cdRing.style.background = `conic-gradient(var(--accent) 0%, transparent 0%)`;

    // Fallback: jeśli tik nie dojdzie, po 3.2 s zwijamy overlay
    clearTimeout(cooldownFallback);
    lastCooldownTickAt = Date.now();
    cooldownFallback = setTimeout(() => {
      if (Date.now() - lastCooldownTickAt > 3000){
        hideCooldown();
        showBanner('Gracze mogą się zgłaszać — „Znam odpowiedź!”');
      }
    }, 3200);

  } else if (st.phase === 'BUZZING') {
    clearTimeout(cooldownFallback);
    hideCooldown();
    showBanner('Gracze mogą się zgłaszać — „Znam odpowiedź!”');
  } else if (st.phase === 'ANSWERING') {
    banner.classList.remove('show');
  } else {
    banner.classList.remove('show');
  }

  const p = st.players.find(x=>x.id===st.answeringId);
  if (p && (st.phase==='ANSWERING' || st.phase==='SELECTING' || st.phase==='READING')){
    showStage(p);
  } else if (st.phase!=='SELECTING') {
    hideStage();
  }
}

/* ================== STAGE (środek) ================== */
function showStage(p){
  stageName.textContent = `${p.id}. ${p.name || ''}`;
  stageSeat.textContent = `Stanowisko ${p.id}`;
  stageAv.src = p.gender==='FEMALE'?'/img/female.png':'/img/male.png';
  gridWrap.classList.add('below');
  stage.classList.add('show');
}
function hideStage(){
  gridWrap.classList.remove('below');
  stage.classList.remove('show');
  stageJudge.className = 'judge';
}

/* ================== EVENTS HANDLER ================== */
function handleEvent(ev){
  if (ev.type === 'JUDGE') {
    const el = document.getElementById('judge-'+ev.playerId);
    if (el){
      el.textContent = ev.value === 'CORRECT' ? '✓' : '✗';
      el.className = 'judge show ' + (ev.value === 'CORRECT' ? 'good':'bad');
      setTimeout(()=>{ el.className = 'judge'; }, 1200);
    }
    stageJudge.textContent = ev.value === 'CORRECT' ? '✓' : '✗';
    stageJudge.className = 'judge show ' + (ev.value === 'CORRECT' ? 'good':'bad');
    play(ev.value === 'CORRECT' ? 'GOOD' : 'WRONG');
    if (ev.value === 'WRONG') setTimeout(hideStage, 700);
  }

  else if (ev.type === 'CUE') {
    play(ev.value);
    if (ev.value === 'START_Q') showBanner('Prowadzący czyta pytanie…');
    if (ev.value === 'BOOM')     showBanner('Cisza – wybór / przygotowanie…');
  }

  else if (ev.type === 'RESET') {
    showBanner('Reset gry'); setTimeout(hideBanner, 800);
  }

  else if (ev.type === 'NEW_GAME') {
    showBanner('Nowa gra – skonfiguruj zawodników i otwórz buzzery startowe');
    pb.style.width='0%'; setTimeout(hideBanner, 1500);
  }

  else if (ev.type === 'ROUND_WINNER') {
    hideBanner();
    if (state){
      const p = state.players.find(x=>x.id===ev.playerId);
      if (p) showStage(p);
    }
  }

  else if (ev.type === 'SELECT_START'){
    if (state){
      const p = state.players.find(x=>x.id===ev.playerId);
      if (p){ showStage(p); showBanner(`${p.name || ('Gracz '+p.id)} wybiera przeciwnika…`); }
    }
  }

  else if (ev.type === 'TARGET_REJECTED'){
    showBanner('Wybór odrzucony – wybierz ponownie');
  }

  else if (ev.type === 'TARGET_ACCEPTED'){
    if (state){
      const chosen = state.players.find(x=>x.id===ev.playerId);
      if (chosen){
        showStage(chosen);
        showBanner(`Następny odpowiada: ${chosen.name || ('Gracz '+chosen.id)}`);
        setTimeout(hideBanner, 1200);
      }
    }
  }

  else if (ev.type === 'PHASE'){
    if (ev.value === 'COOLDOWN') {
      hideBanner();
      cd.style.display = 'flex';
      cdNum.textContent = '3';
      cdRing.style.background = `conic-gradient(var(--accent) 0%, transparent 0%)`;

      // Fallback po wejściu w COOLDOWN
      clearTimeout(cooldownFallback);
      lastCooldownTickAt = Date.now();
      cooldownFallback = setTimeout(() => {
        if (Date.now() - lastCooldownTickAt > 3000){
          hideCooldown();
          showBanner('Gracze mogą się zgłaszać — „Znam odpowiedź!”');
        }
      }, 3200);

    } else if (ev.value === 'READING') {
      clearTimeout(cooldownFallback);
      hideCooldown();
      showBanner('Prowadzący czyta pytanie…');
    } else if (ev.value === 'BUZZING') {
      clearTimeout(cooldownFallback);
      hideCooldown();
      showBanner('Gracze mogą się zgłaszać — „Znam odpowiedź!”');
    }
  }
}

/* ================= TIMER HANDLER ================= */
function handleTimer(t){
  const ms = t.remainingMs||0, active = !!t.active;

  // Pasek 10 s tylko dla ANSWERING
  if (state?.phase === 'ANSWERING'){
    const pct = Math.max(0, Math.min(1, (TOTAL_ANS_MS - ms)/TOTAL_ANS_MS));
    pb.style.width = (pct*100).toFixed(1)+'%';
    stagePb.style.width = (pct*100).toFixed(1)+'%';
    const col = active ? 'var(--ok)' : (ms===0 ? 'var(--bad)' : 'var(--ok)');
    pb.style.background = col; stagePb.style.background = col;
  } else {
    pb.style.width = '0%';
    stagePb.style.width = '0%';
  }

  // COOLDOWN – 3…2…1 zsynchronizowane z tickiem backendu
  if (state?.phase === 'COOLDOWN'){
    // rejestruj ostatni tik (dla fallbacku)
    lastCooldownTickAt = Date.now();

    const clampedMs = Math.max(0, Math.min(COOLDOWN_MS, ms));
    const sec = Math.max(1, Math.ceil(clampedMs/1000));
    cd.style.display = 'flex';
    cdNum.textContent = String(sec);
    cdNum.style.transform = 'scale(1.15)'; cdNum.style.opacity = '1';
    setTimeout(()=>{ cdNum.style.transform='scale(1)'; cdNum.style.opacity='0.95'; }, 120);
    const prog = 100 - Math.round((clampedMs/COOLDOWN_MS)*100);
    cdRing.style.background = `conic-gradient(var(--accent) ${prog}%, transparent ${prog}%)`;

    if (!active || clampedMs === 0){
      hideCooldown();
      showBanner('Gracze mogą się zgłaszać — „Znam odpowiedź!”');
    }
  }
}

/* =================== HELPERS ==================== */
function play(cue){ const a = sounds[cue]; if (!a) return; try { a.currentTime = 0; a.play(); } catch {} }
function showBanner(t){ banner.textContent = t; banner.classList.add('show'); }
function hideBanner(){ banner.classList.remove('show'); }
function hideCooldown(){ cd.style.display = 'none'; }
function heartsHtml(l){ let s=''; for(let i=0;i<3;i++) s += `<svg class="heart ${i>=l?'dead':''}" viewBox="0 0 32 29"><path fill="#ff4757" d="M23.6 0c-2.7 0-5 1.6-7.6 4.7C13.4 1.6 11.1 0 8.4 0 3.8 0 0 3.7 0 8.2 0 16.1 15.9 29 16 29s16-12.9 16-20.8C32 3.7 28.2 0 23.6 0z"/></svg>`; return s; }
function escapeHtml(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
