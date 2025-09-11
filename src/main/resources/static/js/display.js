import { connect } from '/js/ws.js';

/* ================= DOM ================= */
const hudPlayers = document.getElementById('statPlayers');
const hudQ       = document.getElementById('statQuestions');
const hudPhase   = document.getElementById('statPhase'); // sama wartość
function setPhasePill(v){ if (hudPhase) hudPhase.textContent = v || '—'; }

const gridWrap = document.getElementById('gridWrap');
const grid     = document.getElementById('grid');
const banner   = document.getElementById('banner');

const stage      = document.getElementById('stage');
const stageName  = document.getElementById('stageName');
const stageAv    = document.getElementById('stageAv');
const stageSeat  = document.getElementById('stageSeat');
const stageJudge = document.getElementById('stageJudge');
const stageCd    = document.getElementById('stageCountdown');

const pb         = document.getElementById('pb');

/* ================= AUDIO ================= */
const sounds = {
  INTRO:  document.getElementById('sndIntro'),
  GOOD:   document.getElementById('sndGood'),
  WRONG:  document.getElementById('sndWrong'),
  BOOM:   document.getElementById('sndBoom'),
  START_Q:null
};

/* ================ STAN ================== */
let state      = null;
let lastPhase  = 'IDLE';
let askedCount = 0;

const TOTAL_ANS_MS = 10_000;
const COOLDOWN_MS  = 3_000;

let lastIds    = [];
let lastScores = new Map();
let lastLives  = new Map();

/* ===== Popup odblokowania dźwięku ===== */
let audioUnlocked = false;
ensureUnlockModal();
function ensureUnlockModal(){
  if (document.getElementById('unlockModal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'unlockModal';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:200';
  wrap.innerHTML = `
    <div style="background:#111a2c;border:1px solid #23324d;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6);width:min(520px,92vw);padding:18px;text-align:center">
      <h2 style="margin:0 0 8px;color:#eaf2ff">Odblokuj dźwięk</h2>
      <p style="margin:0 12px 14px;color:#9cb2d9">Aby słyszeć intro i sygnały gry, kliknij „Odblokuj”.</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="unlockYes" style="padding:10px 16px;border-radius:12px;border:0;background:#3b6df6;color:#fff;font-weight:800">Odblokuj</button>
        <button id="unlockNo"  style="padding:10px 16px;border-radius:12px;border:1px solid #23324d;background:#0d1526;color:#eaf2ff;font-weight:800">Później</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById('unlockYes').addEventListener('click', async ()=>{
    try { await sounds.INTRO?.play(); sounds.INTRO.pause(); sounds.INTRO.currentTime=0; } catch {}
    try { await sounds.BOOM ?.play();  sounds.BOOM .pause();  sounds.BOOM .currentTime =0; } catch {}
    audioUnlocked = true; wrap.remove();
  });
  document.getElementById('unlockNo').addEventListener('click', ()=>{
    audioUnlocked = false; wrap.remove();
  });
}

/* ===== Centralne komunikaty (host/baner BUZZING) ===== */
let centerBox = document.getElementById('centerBox');
if (!centerBox){
  centerBox = document.createElement('div');
  centerBox.id = 'centerBox';
  centerBox.innerHTML = `
    <div class="centerCard" id="centerCard">
      <div class="hostAv"><img id="hostImg" src="/img/host.png" alt="Prowadzący"></div>
      <div>
        <h3 class="title" id="centerTitle">Czekamy na rozpoczęcie…</h3>
        <div class="subtitle" id="centerSub">Dołącz przez player.html</div>
      </div>
    </div>
  `;
  document.body.appendChild(centerBox);
}
const centerCard = document.getElementById('centerCard');
const centerTitle = document.getElementById('centerTitle');
const centerSub   = document.getElementById('centerSub');

function showCenter(title, sub='', buzz=false){
  centerTitle.textContent = title;
  centerSub.textContent   = sub||'';
  centerCard.classList.toggle('buzz', !!buzz);
  centerBox.classList.add('show');
}
function hideCenter(){ centerBox.classList.remove('show'); centerCard.classList.remove('buzz'); }
function showBuzzingCallout(){
  showCenter('Gracze! Zgłaszamy się…', 'Kliknij „Znam odpowiedź!” na swoim urządzeniu.', true);
}

/* ===== 3…2…1 overlay + lokalny fallback (niezależny od ticków) ===== */
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
      width:min(34vmin, 320px); height:min(34vmin, 320px); border-radius:50%;
      background:conic-gradient(var(--accent) 0%, transparent 0%);
      display:grid; place-items:center; filter: drop-shadow(0 10px 30px rgba(0,0,0,.6));">
      <div style="
        width:86%; height:86%; border-radius:50%;
        background:rgba(5,10,20,.85); border:1px solid #20304b; display:grid; place-items:center;">
        <div id="cdNum" style="font-size:min(18vmin, 170px); line-height:1; font-weight:800; color:#dbe7ff; text-shadow:0 8px 30px rgba(0,0,0,.45)">3</div>
      </div>
    </div>`;
  document.body.appendChild(cd);
}
const cdRing = cd.querySelector('#cdRing');
const cdNum  = cd.querySelector('#cdNum');

let cdRAF = null;
let cdEndTime = 0;
function startLocalCooldown(ms = COOLDOWN_MS){
  stopLocalCooldown();
  cdEndTime = performance.now() + ms;
  cd.style.display = 'flex';
  const tick = () => {
    const now = performance.now();
    const left = Math.max(0, cdEndTime - now);
    const sec = Math.max(1, Math.ceil(left/1000));
    cdNum.textContent = String(sec);
    const prog = 100 - Math.round((left/ms)*100);
    cdRing.style.background = `conic-gradient(var(--accent) ${prog}%, transparent ${prog}%)`;
    if (left <= 0){
      hideCooldown();
      showBuzzingCallout();
      cdRAF = null;
      return;
    }
    cdRAF = requestAnimationFrame(tick);
  };
  cdRAF = requestAnimationFrame(tick);
}
function stopLocalCooldown(){
  if (cdRAF){ cancelAnimationFrame(cdRAF); cdRAF = null; }
  cdEndTime = 0;
}

/* ================= BUS ================= */
const bus = connect({
  onState: s => { state = s; render(); },
  onEvent: ev => handleEvent(ev),
  onTimer: t => handleTimer(t),
});

/* ===== AUDIO z ACK ===== */
async function safePlayWithAck(audio, ackEndpoint){
  if (!audio){ try{ bus.send(ackEndpoint, {});}catch{}; return; }
  try {
    if (!audioUnlocked){ await audio.play(); await audio.pause(); audio.currentTime=0; }
    audio.currentTime=0; await audio.play();
  } catch {
    // jeśli audio zablokowane, nie blokuj gry
    setTimeout(()=>{ try{ bus.send(ackEndpoint, {});}catch{} }, 400);
    return;
  }
  audio.onended = () => { try{ bus.send(ackEndpoint, {});}catch{} };
}

/* ============== Helpers ============== */
function escapeHtml(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function normName(p){ return (p?.name||'').trim(); }
function looksLikePlaceholder(p){ const nm = normName(p); return !nm || nm.toLowerCase()===`gracz ${p.id}`; }
function isJoined(p){ return typeof p.joined === 'boolean' ? p.joined : !looksLikePlaceholder(p); }
function avatarFor(p, mood){
  const base = (p.gender === 'FEMALE') ? 'female' : 'male';
  const map = {
    idle:    `/img/${base}.png`,
    knowing: `/img/${base}-knowing.png`,
    success: `/img/${base}-success.png`,
    wrong:   `/img/${base}-wrong.png`
  };
  return map[mood] || map.idle;
}

/* ===== Layout (szerokość, wysokość, skala siatki) ===== */
function computeLayout(n, containerWidth, containerHeight){
  const sidePad = 56, gap = 16;
  const maxW = 360, minW = 240;   // trochę większe domyślne karty

  if (n <= 0) return { rows:0, scale:1, widthTop:0, widthBottom:0, height:0 };

  let rows = 1, colsTop = n, colsBottom = 0;
  if (n >= 6){ rows = 2; colsTop = Math.floor(n/2); colsBottom = n - colsTop; }
  if (n === 9){ rows = 2; colsTop = 4; colsBottom = 5; }
  if (n === 10){ rows = 2; colsTop = 5; colsBottom = 5; }

  const wTop = Math.floor((containerWidth - sidePad - (colsTop-1)*gap) / colsTop);
  const wBot = rows===2 ? Math.floor((containerWidth - sidePad - (colsBottom-1)*gap) / colsBottom) : wTop;

  const widthTop    = Math.max(minW, Math.min(maxW, wTop));
  const widthBottom = Math.max(minW, Math.min(maxW, wBot));
  const cardHTop    = Math.round(widthTop * 0.72) + 86;
  const cardHBot    = Math.round(widthBottom * 0.72) + 86;

  const desiredH = rows===1
      ? cardHTop
      : (Math.max(cardHTop, cardHBot) * 2 + gap);

  // Limit zajęcia wysokości przez siatkę do ok. 42% ekranu
  const maxH = Math.max(240, Math.round(containerHeight * 0.42));
  const scale = Math.max(0.6, Math.min(1, maxH / desiredH));

  return { rows, colsTop, colsBottom, widthTop, widthBottom, height: desiredH, scale };
}

/* ============== Render ============== */
function render(){
  const st = state; if (!st) return;

  const joined = (st.players||[]).filter(isJoined);
  if (hudPlayers) hudPlayers.textContent = joined.length;

  if (st.phase === 'READING' && lastPhase !== 'READING') askedCount++;
  lastPhase = st.phase;
  if (hudQ) hudQ.textContent = askedCount;
  setPhasePill(st.phase);

  renderGrid(joined, st);
  lastIds = joined.map(p=>p.id);

  if (st.phase === 'INTRO') {
    hideCenter(); showBanner('Intro…');
  } else if (st.phase === 'READING') {
    hideCenter(); showBanner('Prowadzący czyta pytanie…');
  } else if (st.phase === 'COOLDOWN') {
    hideCenter(); hideBanner(); startLocalCooldown(COOLDOWN_MS);
  } else if (st.phase === 'BUZZING') {
    hideCooldown(); showBuzzingCallout(); // zamiast suchego banera
  } else if (st.phase === 'ANSWERING') {
    hideCenter(); banner.classList.remove('show');
  } else {
    showCenter(
      joined.length ? 'Czekamy na rozpoczęcie…' : 'Brak zawodników',
      joined.length ? 'Prowadzący może rozpocząć rundę.' : 'Dołącz przez player.html i wpisz imię.'
    );
  }

  const p = st.players?.find(x=>x.id===st.answeringId);
  if (p && (st.phase==='ANSWERING' || st.phase==='SELECTING' || st.phase==='READING')){
    showStage(p, st.phase);
  } else if (st.phase!=='SELECTING') {
    hideStage();
  }
}

function renderGrid(players, st){
  grid.className = '';
  grid.innerHTML = '';

  const n  = players.length;
  const cw = grid.clientWidth || window.innerWidth;
  const ch = window.innerHeight;
  const L  = computeLayout(n, cw, ch);

  grid.style.setProperty('--scale', L.scale.toFixed(3));
  const scaledH = Math.round(L.height * L.scale);
  gridWrap.style.height = (scaledH + 60) + 'px';

  if (!L.rows){ return; }

  const rowTop    = document.createElement('div');
  const rowBottom = document.createElement('div');
  rowTop.className = 'row top';
  rowBottom.className = 'row bottom';

  if (L.rows === 1){
    rowTop.style.gridTemplateColumns = `repeat(${L.colsTop}, ${L.widthTop}px)`;
    players.forEach(p => rowTop.appendChild(cardFor(p, st, L.widthTop)));
    grid.appendChild(rowTop);
  } else {
    rowTop.style.gridTemplateColumns    = `repeat(${L.colsTop}, ${L.widthTop}px)`;
    rowBottom.style.gridTemplateColumns = `repeat(${L.colsBottom}, ${L.widthBottom}px)`;
    const topPlayers    = players.slice(0, L.colsTop);
    const bottomPlayers = players.slice(L.colsTop, L.colsTop + L.colsBottom);
    topPlayers.forEach(p => rowTop.appendChild(cardFor(p, st, L.widthTop)));
    bottomPlayers.forEach(p => rowBottom.appendChild(cardFor(p, st, L.widthBottom)));
    grid.appendChild(rowTop);
    grid.appendChild(rowBottom);
  }
}

function heartsSvg(dead){ return `<svg class="heart${dead?' dead':''}" viewBox="0 0 32 29" aria-hidden="true"><path d="M23.6 0c-2.7 0-5 1.6-7.6 4.7C13.4 1.6 11.1 0 8.4 0 3.8 0 0 3.7 0 8.2 0 16.1 15.9 29 16 29s16-12.9 16-20.8C32 3.7 28.2 0 23.6 0z"/></svg>`; }

function cardFor(p, st, w){
  const el = document.createElement('div');
  el.className = 'card';
  const h = Math.round(w * 0.72) + 86;
  el.style.setProperty('--w', w+'px');
  el.style.setProperty('--h', h+'px');

  if (st.answeringId === p.id) el.classList.add('answering');
  if (p.eliminated) el.classList.add('eliminated');

  const newJoin = !lastIds.includes(p.id);
  if (newJoin) el.classList.add('cardJoin');

  const lives = Math.max(0, p.lives);
  const name  = normName(p);

  el.innerHTML = `
    <div class="seat" aria-label="Stanowisko">${p.id}</div>
    <div class="name">${escapeHtml(name || '')}</div>
    <div class="avatar"><img src="${avatarFor(p,'idle')}" alt=""></div>

    <div class="ptsBox">
      <span class="medal"><svg viewBox="0 0 24 24"><path d="M12 2l2.4 4.8L20 8l-4 3.9L17 18l-5-2.6L7 18l1-6.1L4 8l5.6-.8L12 2z"/></svg></span>
      <span class="value" id="pts-${p.id}">${p.score}</span>
    </div>

    <div class="livesBox" id="lives-${p.id}">
      ${heartsSvg(false)}${heartsSvg(false)}${heartsSvg(false)}
    </div>

    <div class="judge" id="judge-${p.id}"></div>
  `;

  const hearts = el.querySelectorAll('.livesBox .heart');
  for (let i=0;i<3;i++){ if (i >= lives) hearts[i].classList.add('dead'); }

  const lastS = lastScores.get(p.id);
  if (lastS !== undefined && lastS !== p.score){
    el.querySelector(`#pts-${p.id}`)?.classList.add('scoreBump');
    setTimeout(()=>el.querySelector(`#pts-${p.id}`)?.classList.remove('scoreBump'), 500);
  }
  lastScores.set(p.id, p.score);

  const lastL = lastLives.get(p.id);
  if (lastL !== undefined && lastL !== p.lives){
    el.querySelector(`#lives-${p.id}`)?.classList.add('lifeShake');
    setTimeout(()=>el.querySelector(`#lives-${p.id}`)?.classList.remove('lifeShake'), 600);
  }
  lastLives.set(p.id, p.lives);

  return el;
}

/* ============== Scena ============== */
function showStage(p, phase){
  const name = normName(p);
  stageName.textContent = `${name || ''}`;
  stageSeat.textContent = `Stanowisko ${p.id}`;
  stageAv.src = avatarFor(p, phase==='ANSWERING' ? 'knowing' : 'idle');
  stage.classList.add('show');
  hideCenter();
  stageCd.classList.toggle('hidden', phase!=='ANSWERING');
}
function hideStage(){
  stage.classList.remove('show');
  stageJudge.className = 'judge';
  stageCd.classList.add('hidden');
}

/* ===== Banery / Cooldown ===== */
function showBanner(t){ banner.textContent = t; banner.classList.add('show'); }
function hideBanner(){ banner.classList.remove('show'); }
function hideCooldown(){ cd.style.display = 'none'; stopLocalCooldown(); }

/* ============== Events ============== */
function handleEvent(ev){
  if (!ev) return;

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

    const p = state?.players?.find(x=>x.id===state.answeringId);
    if (p){
      stageAv.src = avatarFor(p, ev.value === 'CORRECT' ? 'success' : 'wrong');
      if (ev.value === 'WRONG') setTimeout(hideStage, 700);
    }
  }

  else if (ev.type === 'CUE') {
    if (ev.value === 'INTRO')  { hideCenter(); showBanner('Intro…');  safePlayWithAck(sounds.INTRO, '/app/introDone'); }
    if (ev.value === 'BOOM')   { showCenter('Za chwilę nowe pytanie…','Prowadzący przygotowuje wybór'); safePlayWithAck(sounds.BOOM,  '/app/boomDone'); }
    if (ev.value === 'START_Q'){ hideCenter(); showBanner('Prowadzący czyta pytanie…'); }
  }

  else if (ev.type === 'RESET') {
    showBanner('Reset gry'); setTimeout(hideBanner, 800); askedCount=0;
  }
  else if (ev.type === 'NEW_GAME') {
    showCenter('Nowa gra','Skonfiguruj zawodników i otwórz buzzery startowe');
    pb.style.width='0%'; setTimeout(hideBanner,1500); askedCount=0;
  }
  else if (ev.type === 'ROUND_WINNER') {
    hideBanner();
    if (state){
      const p = state.players.find(x=>x.id===ev.playerId);
      if (p) showStage(p, 'READING');
    }
  }
  else if (ev.type === 'SELECT_START'){
    if (state){
      const p = state.players.find(x=>x.id===ev.playerId);
      if (p){ showStage(p, 'SELECTING'); showCenter(`${normName(p)||('Gracz '+p.id)} wybiera przeciwnika…`,''); }
    }
  }
  else if (ev.type === 'TARGET_REJECTED'){
    showCenter('Wybór odrzucony','Wybierz ponownie');
  }
  else if (ev.type === 'TARGET_ACCEPTED'){
    if (state){
      const chosen = state.players.find(x=>x.id===ev.playerId);
      if (chosen){
        showStage(chosen, 'READING');
        showCenter(`Następny odpowiada: ${normName(chosen)||('Gracz '+chosen.id)}`,'');

        setTimeout(hideCenter, 1200);
      }
    }
  }
  else if (ev.type === 'PHASE'){
    if (ev.value === 'COOLDOWN') {
      hideBanner(); startLocalCooldown(COOLDOWN_MS);
    } else if (ev.value === 'READING') {
      hideCooldown(); hideCenter(); showBanner('Prowadzący czyta pytanie…');
    } else if (ev.value === 'BUZZING') {
      hideCooldown(); showBuzzingCallout();
    } else if (ev.value === 'IDLE') {
      showCenter('Czekamy na rozpoczęcie…','Prowadzący może rozpocząć rundę.');
    }
  }
}

/* ============== Timer ============== */
function handleTimer(t){
  const ms = t.remainingMs||0, active = !!t.active;

  if (state?.phase === 'ANSWERING'){
    const pct = Math.max(0, Math.min(1, (TOTAL_ANS_MS - ms)/TOTAL_ANS_MS));
    pb.style.width = (pct*100).toFixed(1)+'%';

    // Kolor paska: H 130 (zielony) → 0 (czerwony) + „żyjący” gradient
    const hue = Math.max(0, Math.min(130, 130 - 130*pct));
    const hue2 = Math.max(0, hue-24);
    pb.style.background = `linear-gradient(90deg, hsl(${hue} 85% 52%), hsl(${hue2} 90% 50%))`;

    const sec = Math.max(0, Math.ceil(ms/1000));
    stageCd.textContent = String(sec);
    stageCd.classList.remove('hidden');
  } else {
    pb.style.width = '0%';
    stageCd.classList.add('hidden');
  }

  // COOLDOWN: wspieraj zarówno tick z backendu, jak i fallback lokalny
  if (state?.phase === 'COOLDOWN'){
    if (typeof ms === 'number' && active){
      // priorytet – tick z serwera
      stopLocalCooldown();
      cd.style.display = 'flex';
      const sec = Math.max(1, Math.ceil(ms/1000));
      cdNum.textContent = String(sec);
      const prog = 100 - Math.round((ms/COOLDOWN_MS)*100);
      cdRing.style.background = `conic-gradient(var(--accent) ${prog}%, transparent ${prog}%)`;
    }
    if (!active && cd.style.display === 'flex'){
      hideCooldown();
      showBuzzingCallout();
    }
  }
}

/* ============== Misc ============== */
function play(cue){ const a = sounds[cue]; if (!a) return; try { a.currentTime = 0; a.play(); } catch {} }

let rTO=null;
window.addEventListener('resize',()=>{ clearTimeout(rTO); rTO=setTimeout(()=>render(), 90); });
