import { connect } from '/js/ws.js';

/* ================= DOM ================= */
const hudPlayers = document.getElementById('statPlayers');
const hudQ       = document.getElementById('statQuestions');
const hudPhase   = document.getElementById('statPhase');
const setPhasePill = v => { if (hudPhase) hudPhase.textContent = v || '—'; };

const body     = document.body;
const gridWrap = document.getElementById('gridWrap');
const gridClamp = document.getElementById('gridClamp');
const grid     = document.getElementById('grid');
const banner   = document.getElementById('banner');

const stage       = document.getElementById('stage');
const stageName   = document.getElementById('stageName');
const stageAv     = document.getElementById('stageAv');
const stageSeat   = document.getElementById('stageSeat');
const stageJudge  = document.getElementById('stageJudge');
const stageCd     = document.getElementById('stageCountdown');
const stageScore  = document.getElementById('stageScore');
const stageLives  = document.getElementById('stageLives');
const stageTimer  = document.getElementById('stageTimer');

const questionBoard = document.getElementById('questionBoard');
const qDiff = document.getElementById('qDiff');
const qCat  = document.getElementById('qCat');
const qId   = document.getElementById('qId');
const qText = document.getElementById('qText');
const qAnswer = document.getElementById('qAnswer');

const audioOverlay = document.getElementById('audioOverlay');
const audioUnlockBtn = document.getElementById('audioUnlock');
const audioSkipBtn   = document.getElementById('audioSkip');

const waitingBox    = document.getElementById('waitingBox');
const waitingStatus = document.getElementById('waitingStatus');
const waitingHint   = document.getElementById('waitingHint');
const waitingCount  = document.getElementById('waitingCount');
const waitingRoster = document.getElementById('waitingRoster');

/* ===== Full-width timebar (tworzymy, jeśli brak) ===== */
let timebarWrap = document.getElementById('timebarWrap');
if (!timebarWrap){
  timebarWrap = document.createElement('div');
  timebarWrap.id = 'timebarWrap';
  timebarWrap.innerHTML = `<div id="pb"></div>`;
  document.body.appendChild(timebarWrap);
}
const pb = document.getElementById('pb');

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

let TOTAL_ANS_MS = 10_000;

let lastIds    = [];
let lastScores = new Map();
let lastLives  = new Map();

let lastHud = { players:0, q:0, phase:'' };

/* ===== Odblokowanie dźwięku & ekran powitalny ===== */
let audioUnlocked = false;
let waitingEnabled = false;
let waitingIsFull = false;

function hideAudioOverlay(){
  if (!audioOverlay) return;
  audioOverlay.classList.add('hidden');
  waitingEnabled = true;
  applyWaitingVisibility();
}

if (audioUnlockBtn){
  audioUnlockBtn.addEventListener('click', async ()=>{
    try { await sounds.INTRO?.play(); sounds.INTRO.pause(); sounds.INTRO.currentTime = 0; } catch {}
    try { await sounds.BOOM ?.play();  sounds.BOOM .pause();  sounds.BOOM .currentTime  = 0; } catch {}
    audioUnlocked = true;
    hideAudioOverlay();
  });
}

if (audioSkipBtn){
  audioSkipBtn.addEventListener('click', ()=>{
    audioUnlocked = false;
    hideAudioOverlay();
  });
}

if (!audioOverlay || audioOverlay.classList.contains('hidden')){
  waitingEnabled = true;
  applyWaitingVisibility();
}

function updateWaitingCard(joinedCount = 0, totalSlots = 10, players = []){
  if (!waitingBox) return;
  const joined = Math.max(0, joinedCount);
  const total  = Math.max(joined, totalSlots || 10);

  if (waitingCount) waitingCount.textContent = `${joined}/${total}`;

  let status = 'Oczekiwanie na dołączenie graczy…';
  let hint   = 'Połącz urządzenia graczy i poproś o wpisanie imion.';
  if (joined > 0 && joined < total){
    status = 'Oczekiwanie na dołączenie reszty graczy…';
    const left = Math.max(0, total - joined);
    hint = left === 1 ? 'Pozostało 1 wolne miejsce.' : `Pozostało ${left} wolnych miejsc.`;
  } else if (joined >= total && total > 0){
    status = 'Oczekiwanie na rozpoczęcie przez gospodarza.';
    hint = 'Gospodarz może teraz rozpocząć rozgrywkę w panelu sterowania.';
  }

  if (waitingStatus) waitingStatus.textContent = status;
  if (waitingHint)   waitingHint.textContent   = hint;

  waitingIsFull = joined >= total && total > 0;
  renderWaitingPlayers(players);
  applyWaitingVisibility();
}

function applyWaitingVisibility(){
  if (!waitingBox) return;
  const shouldShow = waitingEnabled && (!state || state.phase === 'IDLE');
  waitingBox.classList.toggle('show', shouldShow);
  waitingBox.classList.toggle('full', waitingIsFull);
  if (waitingRoster){
    waitingRoster.classList.toggle('show', shouldShow);
  }
  if (body){
    body.classList.toggle('waiting-mode', shouldShow);
  }
}

function renderWaitingPlayers(players = []){
  if (!waitingRoster) return;
  waitingRoster.innerHTML = '';
  const joined = (players || [])
    .filter(isJoined)
    .sort((a, b) => (a?.id || 0) - (b?.id || 0));
  waitingBox?.classList.toggle('has-players', joined.length > 0);
  if (!joined.length){
    waitingRoster.classList.add('empty');
    const empty = document.createElement('div');
    empty.className = 'waiting-empty';
    empty.textContent = 'Czekamy na pierwszego gracza…';
    waitingRoster.appendChild(empty);
    return;
  }
  waitingRoster.classList.remove('empty');
  joined.forEach(p => {
    const item = document.createElement('div');
    item.className = 'waiting-roster-item';
    const name = normName(p) || `Gracz ${p.id}`;
    item.innerHTML = `
      <div class="avatar"><img src="${avatarFor(p, 'idle')}" alt=""></div>
      <div class="meta">
        <div class="name">${escapeHtml(name)}</div>
        <div class="seat">Stanowisko ${p.id}</div>
      </div>
    `;
    waitingRoster.appendChild(item);
  });
}

/* ===== Centralne komunikaty ===== */
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
  centerCard.classList.toggle('xl',  !!buzz);   // większa wersja dla BUZZING
  centerBox.classList.add('show');
}
function hideCenter(){ centerBox.classList.remove('show'); centerCard.classList.remove('buzz','xl'); }
function showBuzzingCallout(){
  showCenter('Gracze, zgłaszamy się!', 'Kliknij „Znam odpowiedź!” na swoim urządzeniu.', true);
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
    setTimeout(()=>{ try{ bus.send(ackEndpoint, {});}catch{} }, 400);
    return;
  }
  audio.onended = () => { try{ bus.send(ackEndpoint, {});}catch{} };
}

/* ============== Helpers ============== */
const escapeHtml = s => (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const normName   = p => (p?.name||'').trim();
const looksLikePlaceholder = p => { const nm = normName(p); return !nm || nm.toLowerCase()===`gracz ${p.id}`; };
const isJoined   = p => (typeof p.joined === 'boolean') ? p.joined : !looksLikePlaceholder(p);
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

/* ===== Layout siatki ===== */
function computeLayout(n, containerWidth, containerHeight){
  const gap = 18;
  const sidePad = 56;
  const maxW = 360, minW = 240;

  if (n <= 0) return { rows:0, scale:1, widthTop:0, widthBottom:0, height:0, gap };

  let rows = 1, colsTop = n, colsBottom = 0;
  if (n >= 6){ rows = 2; colsTop = Math.floor(n/2); colsBottom = n - colsTop; }
  if (n === 9){ rows = 2; colsTop = 4; colsBottom = 5; }
  if (n === 10){ rows = 2; colsTop = 5; colsBottom = 5; }

  const wTop = Math.floor((containerWidth - sidePad - (colsTop-1)*gap) / colsTop);
  const wBot = rows===2 ? Math.floor((containerWidth - sidePad - (colsBottom-1)*gap) / colsBottom) : wTop;

  const widthTop    = Math.max(minW, Math.min(maxW, wTop));
  const widthBottom = Math.max(minW, Math.min(maxW, wBot));
  const cardHTop    = Math.round(widthTop * 0.56) + 78;  // niższa karta
  const cardHBot    = Math.round(widthBottom * 0.56) + 78;

  const desiredH = rows===1 ? cardHTop : (Math.max(cardHTop, cardHBot) * 2 + gap);

  // siatka zajmuje ok. 40% wysokości ekranu
  const maxH = Math.max(220, Math.round(containerHeight * 0.40));
  const dynamicScale = Math.min(1, maxH / desiredH);

  // Przy większej liczbie graczy (2 rzędy) zmniejszamy całą siatkę do ~60%,
  // natomiast przy jednym rzędzie utrzymujemy ją w okolicach 80%.
  const preferredScale = rows === 1 ? 0.8 : 0.6;

  const scale = Math.min(preferredScale, dynamicScale);

  return { rows, colsTop, colsBottom, widthTop, widthBottom, height: desiredH, scale, gap };
}

/* ============== Render ============== */
function render(){
  const st = state; if (!st) return;

  const joined = (st.players||[]).filter(isJoined);
  const totalSlots = Array.isArray(st.players) && st.players.length ? st.players.length : 10;
  updateWaitingCard(joined.length, totalSlots, st.players || []);
  applyWaitingVisibility();
  TOTAL_ANS_MS = st.settings?.answerTimerMs ?? TOTAL_ANS_MS;

  renderQuestionBoard(st);

  // HUD – animacje przy zmianie
  if (hudPlayers && joined.length !== lastHud.players){ hudPlayers.textContent = joined.length; hudPlayers.parentElement.classList.add('bump'); setTimeout(()=>hudPlayers.parentElement.classList.remove('bump'), 260); lastHud.players = joined.length; }
  if (st.phase !== lastHud.phase){ setPhasePill(st.phase); hudPhase?.parentElement.classList.add('bump'); setTimeout(()=>hudPhase?.parentElement.classList.remove('bump'), 260); lastHud.phase = st.phase; }
  if (st.phase === 'READING' && lastPhase !== 'READING'){ askedCount++; }
  if (hudQ && askedCount !== lastHud.q){ hudQ.textContent = askedCount; hudQ.parentElement.classList.add('bump'); setTimeout(()=>hudQ.parentElement.classList.remove('bump'), 260); lastHud.q = askedCount; }
  lastPhase = st.phase;

  renderGrid(joined, st);
  lastIds = joined.map(p=>p.id);

  // Komunikaty globalne
  if (st.phase === 'INTRO') {
    hideCenter(); showBanner('Intro…');
  } else if (st.phase === 'READING') {
    hideCenter();
    if (st.hostDashboard?.activeQuestion?.preparing){
      showBanner('Prowadzący przygotowuje pytanie…');
    } else {
      showBanner('Prowadzący czyta pytanie…');
    }
  } else if (st.phase === 'BUZZING') {
    showBuzzingCallout();
  } else if (st.phase === 'ANSWERING') {
    hideCenter(); banner.classList.remove('show');
  } else {
    hideCenter();
    hideBanner();
    applyWaitingVisibility();
  }

  // Scena – pokaż tylko kiedy wiadomo kto
  const p = st.players?.find(x=>x.id===st.answeringId);
  if (p && (st.phase==='ANSWERING' || st.phase==='SELECTING' || st.phase==='READING')){
    showStage(p, st.phase);
  } else if (st.phase!=='SELECTING') {
    hideStage();
  }
}

function renderQuestionBoard(st){
  if (!questionBoard) return;
  const active = st.hostDashboard?.activeQuestion;
  if (!active){
    qDiff.textContent = '—';
    qCat.textContent = '—';
    qId.textContent = 'Pytanie —';
    qText.textContent = 'Czekamy na pytanie prowadzącego…';
    qAnswer.textContent = 'Odpowiedź pojawi się po werdykcie.';
    qAnswer.classList.add('hidden');
    questionBoard.classList.remove('revealed');
    return;
  }
  qDiff.textContent = active.difficulty || '—';
  qCat.textContent  = active.category || '—';
  const orderNum = typeof active.order === 'number' ? active.order : null;
  qId.textContent   = orderNum ? `Pytanie ${orderNum.toString().padStart(2,'0')}` : 'Pytanie —';
  if (active.revealed){
    qText.textContent = active.question || '—';
    questionBoard.classList.add('revealed');
  } else if (active.preparing){
    qText.textContent = 'Prowadzący przygotowuje pytanie…';
    questionBoard.classList.remove('revealed');
  } else {
    qText.textContent = 'Prowadzący czyta pytanie…';
    questionBoard.classList.remove('revealed');
  }
  if (shouldShowAnswer(st.phase)){
    qAnswer.textContent = `Odpowiedź: ${active.answer || '—'}`;
    qAnswer.classList.remove('hidden');
  } else {
    qAnswer.textContent = 'Odpowiedź pojawi się po werdykcie.';
    qAnswer.classList.add('hidden');
  }
}

function shouldShowAnswer(phase){
  if (phase === 'IDLE' && body?.classList.contains('waiting-mode')){
    return false;
  }
  return phase === 'SELECTING' || phase === 'IDLE';
}

function renderGrid(players, st){
  grid.className = '';
  grid.innerHTML = '';

  const n  = players.length;
  const cw = grid.clientWidth || window.innerWidth;
  const ch = window.innerHeight;
  const baseFloor = 18;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const layoutForMargin = margin => {
    const usableHeight = Math.max(0, ch - margin);
    return computeLayout(n, cw, usableHeight);
  };

  const baseMargin = n > 0
    ? clamp(Math.round(ch * 0.04), 24, 48)
    : baseFloor;

  let bottomMargin = baseMargin;
  let L = layoutForMargin(bottomMargin);

  if (n > 0 && L.rows > 1){
    const extraBoost = Math.round(ch * 0.02);
    const preferredMultiRow = clamp(Math.round(ch * 0.052), baseFloor + extraBoost, 72);
    const marginForRows = Math.max(bottomMargin, preferredMultiRow);
    if (marginForRows !== bottomMargin){
      bottomMargin = marginForRows;
      L = layoutForMargin(bottomMargin);
    }

    const marginFloor = clamp(Math.round(ch * 0.038), baseFloor + extraBoost, 64);
    if (bottomMargin < marginFloor){
      bottomMargin = marginFloor;
      L = layoutForMargin(bottomMargin);
    }

    const elevatedFloor = clamp(Math.round(ch * 0.086), marginFloor + extraBoost, Math.round(ch * 0.18));
    if (bottomMargin < elevatedFloor){
      bottomMargin = elevatedFloor;
      L = layoutForMargin(bottomMargin);
    }

    const stackedRowsFloor = clamp(Math.round(ch * 0.12), elevatedFloor + extraBoost, Math.round(ch * 0.26));
    if (bottomMargin < stackedRowsFloor){
      bottomMargin = stackedRowsFloor;
      L = layoutForMargin(bottomMargin);
    }
  }

  const safetyPad = L.rows > 1
    ? Math.max(32, Math.round(ch * 0.045))
    : Math.max(18, Math.round(ch * 0.025));
  const maxVisibleHeight = Math.max(160, ch - bottomMargin - safetyPad);
  const scaleCap = Math.min(1, maxVisibleHeight / Math.max(1, L.height));
  // Allow the grid to shrink more aggressively on short viewports so that
  // player cards stay visible instead of sliding out of frame.
  const minScale = L.rows > 1 ? 0.12 : 0.18;
  if (scaleCap <= 0){
    L = { ...L, scale: minScale };
  } else if (scaleCap < L.scale){
    const safeScale = Math.max(minScale, scaleCap);
    L = { ...L, scale: safeScale };
  }

  grid.style.setProperty('--scale', L.scale.toFixed(3));
  grid.style.setProperty('--grid-gap-x', L.gap + 'px');
  grid.style.setProperty('--grid-gap-y', L.gap + 'px');

  const scaledH = Math.round(L.height * L.scale);
  const baseBottom = baseFloor;
  const lift = L.rows > 0 ? Math.max(0, bottomMargin - baseBottom) : 0;
  const paddingBottom = L.rows > 1
    ? Math.max(18, Math.round((baseBottom + lift) * 0.65))
    : Math.max(0, Math.round((baseBottom + lift) * 0.4));
  const availableWrap = Math.max(0, ch - baseBottom);
  const wrapHeight = L.rows > 0
    ? Math.max(scaledH, Math.min(availableWrap, scaledH + paddingBottom))
    : 0;

  gridWrap.style.height = wrapHeight ? wrapHeight + 'px' : '';
  gridWrap.style.setProperty('--grid-offset', `${lift}px`);
  gridWrap.style.setProperty('--grid-bottom-pad', `${paddingBottom}px`);
  if (gridClamp){
    gridClamp.style.maxHeight = wrapHeight ? wrapHeight + 'px' : '';
  }

  if (!L.rows){
    grid.innerHTML = '';
    return;
  }

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

function heartsSvg(dead, variant='grid'){
  const cls = variant === 'stage' ? 'heart stage' : 'heart';
  return `<svg class="${cls}${dead?' dead':''}" viewBox="0 0 32 29" aria-hidden="true"><path d="M23.6 0c-2.7 0-5 1.6-7.6 4.7C13.4 1.6 11.1 0 8.4 0 3.8 0 0 3.7 0 8.2 0 16.1 15.9 29 16 29s16-12.9 16-20.8C32 3.7 28.2 0 23.6 0z"/></svg>`;
}

function cardFor(p, st, w){
  const el = document.createElement('div');
  el.className = 'card';
  const h = Math.round(w * 0.56) + 78; // niższa karta
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

/* ============== Scena (środek) ============== */
function showStage(p, phase){
  const name = normName(p);
  stageName.textContent = name || `Gracz ${p.id}`;
  stageSeat.textContent = `Stanowisko ${p.id}`;
  stageAv.src = avatarFor(p, phase==='ANSWERING' ? 'knowing' : 'idle');

  if (stageScore){
    const score = typeof p.score === 'number' ? p.score : 0;
    stageScore.textContent = `${score} pkt`;
  }
  if (stageLives){
    const livesRaw = typeof p.lives === 'number' ? p.lives : 3;
    const lives = Math.max(0, Math.min(3, livesRaw));
    let html = '';
    for (let i=0;i<3;i++){ html += heartsSvg(i >= lives, 'stage'); }
    stageLives.innerHTML = html;
  }

  stage.classList.add('show');
  hideCenter();

  const isAnswering = phase === 'ANSWERING';
  stageTimer?.classList.toggle('hidden', !isAnswering);
  stageCd.classList.toggle('hidden', !isAnswering);
}
function hideStage(){
  stage.classList.remove('show');
  stageJudge.className = 'stage-judge';
  stageTimer?.classList.add('hidden');
  stageCd.classList.add('hidden');
}

/* ===== Banery / Cooldown ===== */
function showBanner(t){ banner.textContent = t; banner.classList.add('show'); }
function hideBanner(){ banner.classList.remove('show'); }
/* ============== Events ============== */
function handleEvent(ev){
  if (!ev) return;

  if (ev.type === 'QUESTION_SELECTED'){
    questionBoard?.classList.add('flash');
    setTimeout(()=>questionBoard?.classList.remove('flash'), 600);
  }
  if (ev.type === 'QUESTION_REVEALED' && state){
    renderQuestionBoard(state);
  }

  if (ev.type === 'JUDGE') {
    const el = document.getElementById('judge-'+ev.playerId);
    if (el){
      el.textContent = ev.value === 'CORRECT' ? '✓' : '✗';
      el.className = 'judge show ' + (ev.value === 'CORRECT' ? 'good':'bad');
      setTimeout(()=>{ el.className = 'judge'; }, 1200);
    }
    stageJudge.textContent = ev.value === 'CORRECT' ? '✓' : '✗';
    stageJudge.className = 'stage-judge show ' + (ev.value === 'CORRECT' ? 'good':'bad');
    setTimeout(()=>{ stageJudge.className = 'stage-judge'; }, 1200);

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
    pb.style.width='0%'; timebarWrap.classList.remove('show'); setTimeout(hideBanner,1500); askedCount=0;
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
    if (ev.value === 'READING') {
      hideCenter();
      if (state?.hostDashboard?.activeQuestion?.preparing){
        showBanner('Prowadzący przygotowuje pytanie…');
      } else {
        showBanner('Prowadzący czyta pytanie…');
      }
    } else if (ev.value === 'BUZZING') {
      showBuzzingCallout();
    } else if (ev.value === 'IDLE') {
      showCenter('Czekamy na rozpoczęcie…','Prowadzący może rozpocząć rundę.');
    }
  }
}

/* ============== Timer ============== */
function handleTimer(t){
  const ms = t.remainingMs||0, active = !!t.active;

  // Pasek 10 s – tylko ANSWERING
  if (state?.phase === 'ANSWERING'){
    timebarWrap.classList.add('show');
    const pct = Math.max(0, Math.min(1, (TOTAL_ANS_MS - ms)/Math.max(1, TOTAL_ANS_MS)));
    pb.style.width = (pct*100).toFixed(1)+'%';

    // Kolor paska: H 130 (zielony) → 0 (czerwony) + „żyjący” gradient
    const hue = Math.max(0, Math.min(130, 130 - 130*pct));
    const hue2 = Math.max(0, hue-24);
    pb.style.background = `linear-gradient(90deg, hsl(${hue} 85% 52%), hsl(${hue2} 90% 50%))`;

    const sec = Math.max(0, Math.ceil(ms/1000));
    stageCd.textContent = String(sec);
    stageCd.classList.remove('hidden');
    stageTimer?.classList.remove('hidden');
  } else {
    timebarWrap.classList.remove('show');
    pb.style.width = '0%';
    stageCd.classList.add('hidden');
    stageTimer?.classList.add('hidden');
  }

}

/* ============== Misc ============== */
function play(cue){ const a = sounds[cue]; if (!a) return; try { a.currentTime = 0; a.play(); } catch {} }

let rTO=null;
window.addEventListener('resize',()=>{ clearTimeout(rTO); rTO=setTimeout(()=>render(), 90); });
