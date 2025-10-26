import { connect } from '/js/ws.js';

const btnStart    = document.getElementById('btnStart');
const btnRead     = document.getElementById('btnRead');
const btnReadDone = document.getElementById('btnReadDone');
const btnGood     = document.getElementById('btnGood');
const btnBad      = document.getElementById('btnBad');
const btnNext     = document.getElementById('btnNext');
const btnReset    = document.getElementById('btnReset');
const btnNew      = document.getElementById('btnNew');
const btnSelectQuestion = document.getElementById('btnSelectQuestion');

const phaseEl     = document.getElementById('phase');
const statPlayers = document.getElementById('statPlayers');
const statAnswerTime = document.getElementById('statAnswerTime');

const ansAv   = document.getElementById('ansAv');
const ansName = document.getElementById('ansName');
const ansSeat = document.getElementById('ansSeat');
const ansTime = document.getElementById('ansTime');
const ansJudge= document.getElementById('ansJudge');

const badgeDifficulty = document.getElementById('badgeDifficulty');
const badgeCategory   = document.getElementById('badgeCategory');
const questionLabel   = document.getElementById('questionLabel');
const questionText    = document.getElementById('questionText');
const questionAnswer  = document.getElementById('questionAnswer');

const flowStatus = document.getElementById('flowStatus');
const flowAction = document.getElementById('flowAction');
const flowHint   = document.getElementById('flowHint');

const welcomeOverlay  = document.getElementById('welcomeOverlay');
const welcomeTitle    = document.getElementById('welcomeTitle');
const welcomeSubtitle = document.getElementById('welcomeSubtitle');
const welcomeCta      = document.getElementById('btnOverlayStart');

const difficultyList  = document.getElementById('difficultyList');
const categoryList    = document.getElementById('categoryList');
const questionList    = document.getElementById('questionList');
const categoryHeader  = document.getElementById('categoryHeader');
const questionModal   = document.getElementById('questionModal');
const btnCloseModal   = document.getElementById('btnCloseModal');

const metricRuntime = document.getElementById('metricRuntime');
const metricCount   = document.getElementById('metricCount');
const metricAverage = document.getElementById('metricAverage');
const metricLast    = document.getElementById('metricLast');

let state = null;
let catalog = null;
let activeDifficulty = null;
let activeCategory = null;
let runtimeTimer = null;
let lastMetrics = null;
let readingStarted = false;
let currentQuestionId = null;
let questionPrompted = false;

const bus = connect({
  onState: s => { state = s; render(); },
  onEvent: ev => handleEvent(ev),
  onTimer: t => handleTimer(t),
});

loadCatalog();

async function loadCatalog(){
  try {
    const res = await fetch('/api/questions');
    if (!res.ok) return;
    catalog = await res.json();
    buildDifficultyList();
  } catch (e){ console.error('Nie udało się pobrać pytań', e); }
}

function buildDifficultyList(){
  const diffs = catalog?.difficulties || [];
  difficultyList.innerHTML = '';
  diffs.forEach((diff, idx) => {
    const btn = document.createElement('button');
    btn.className = 'difficulty-btn' + (idx === 0 ? ' active' : '');
    btn.textContent = diff.label || diff.id;
    btn.addEventListener('click', ()=>selectDifficulty(diff));
    difficultyList.appendChild(btn);
    if (idx === 0){ activeDifficulty = diff; }
  });
  if (diffs.length > 0){ selectDifficulty(activeDifficulty || diffs[0]); }
}

function selectDifficulty(diff){
  activeDifficulty = diff;
  activeCategory = null;
  Array.from(difficultyList.children).forEach(btn=>{
    btn.classList.toggle('active', btn.textContent === (diff.label || diff.id));
  });
  buildCategoryList();
}

function buildCategoryList(){
  categoryList.innerHTML = '';
  questionList.innerHTML = '';
  const cats = activeDifficulty?.categories || [];
  if (cats.length === 0){ categoryHeader.textContent = 'Brak kategorii'; return; }
  categoryHeader.textContent = 'Kategorie';
  cats.forEach((cat, idx) => {
    const pill = document.createElement('div');
    pill.className = 'category-pill' + (idx === 0 ? ' active':'');
    pill.textContent = cat.label || cat.id;
    pill.addEventListener('click', ()=>selectCategory(cat));
    categoryList.appendChild(pill);
    if (idx === 0){ activeCategory = cat; }
  });
  if (cats.length > 0){ selectCategory(activeCategory || cats[0]); }
}

function selectCategory(cat){
  activeCategory = cat;
  Array.from(categoryList.children).forEach(pill=>{
    pill.classList.toggle('active', pill.textContent === (cat.label || cat.id));
  });
  buildQuestionList();
}

function buildQuestionList(){
  questionList.innerHTML = '';
  const questions = activeCategory?.questions || [];
  questions.forEach(q => {
    const item = document.createElement('div');
    item.className = 'question-item';
    item.innerHTML = `<strong>${escapeHtml(q.display || q.id)}</strong><span>${escapeHtml(truncate(q.display || '', 120))}</span>`;
    item.addEventListener('click', ()=>confirmQuestion(q));
    questionList.appendChild(item);
  });
}

function confirmQuestion(q){
  if (!activeDifficulty || !activeCategory) return;
  send('/app/host/selectQuestion', {
    difficulty: activeDifficulty.id,
    category: activeCategory.id,
    questionId: q.id,
  });
  closeModal();
}

function openModal(){
  if (!catalog){ loadCatalog(); }
  questionModal.classList.remove('hidden');
}
function closeModal(){ questionModal.classList.add('hidden'); }

btnSelectQuestion.addEventListener('click', openModal);
btnCloseModal.addEventListener('click', closeModal);
questionModal.addEventListener('click', e=>{ if (e.target === questionModal) closeModal(); });

function send(dest, body={}){ try{ bus.send(dest, body);}catch(e){ console.error(e); } }

function startOrNext(){
  if (!state) return;
  const phase = state.phase;
  if (phase === 'IDLE') {
    if (!hasReadyPlayers()) return;
    send('/app/host/start');
  } else if (phase === 'READING' || phase === 'SELECTING') {
    send('/app/host/next');
  }
}

/* ====== UI actions ====== */
btnStart.addEventListener('click',     startOrNext);
btnRead.addEventListener('click',      beginReading);
btnReadDone.addEventListener('click',  completeReading);
btnGood.addEventListener('click',      ()=> judge(true));
btnBad.addEventListener('click',       ()=> judge(false));
btnNext.addEventListener('click',      ()=> send('/app/host/next'));
btnReset.addEventListener('click',     ()=> send('/app/reset'));
btnNew.addEventListener('click',       ()=> send('/app/newGame'));
welcomeCta.addEventListener('click', startOrNext);

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
  if (!p) return false;
  if (typeof p.joined === 'boolean') return p.joined;
  const nm = (p.name||'').trim();
  if (!nm) return false;
  return nm.toLowerCase() !== (`gracz ${p.id}`).toLowerCase();
}

function render(){
  const st = state; if (!st) return;

  const joined = (st.players||[]).filter(isJoined);
  const joinedCount = joined.length;
  statPlayers.textContent = joinedCount;
  phaseEl.textContent = st.phase;
  const answerSeconds = Math.round((st.settings?.answerTimerMs||0)/1000);
  statAnswerTime.textContent = `${answerSeconds} s`;

  const activeQuestion = st.hostDashboard?.activeQuestion || null;
  const activeId = activeQuestion?.id || null;
  if (activeId !== currentQuestionId){
    currentQuestionId = activeId;
    readingStarted = false;
  }
  if (st.phase !== 'READING'){
    readingStarted = false;
  }

  updateButtons(st.phase, joinedCount);
  updateQuestion(activeQuestion);
  updateWelcome(st, joinedCount);
  updateMetrics(st.hostDashboard?.metrics);
  updateFlow(st, activeQuestion, joinedCount);
  maybePromptQuestion(st, activeQuestion);

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
}

function updateButtons(phase, joinedCount){
  const allowStart = phase === 'IDLE' ? joinedCount > 0 : (phase==='READING' || phase==='SELECTING');
  btnStart.disabled    = !allowStart;
  btnSelectQuestion.disabled = !(phase==='READING' || phase==='INTRO');
  btnRead.disabled     = (phase!=='READING' && phase!=='SELECTING');
  if (phase === 'READING' && !state?.hostDashboard?.activeQuestion){
    btnRead.disabled = true;
  }
  btnReadDone.disabled = (phase!=='READING') || !readingStarted;
  btnGood.disabled     = (phase!=='ANSWERING') || !state?.answeringId;
  btnBad.disabled      = (phase!=='ANSWERING') || !state?.answeringId;
  btnNext.disabled     = !(phase==='IDLE' || phase==='SELECTING');
}

function updateQuestion(active){
  if (active){
    badgeDifficulty.textContent = active.difficulty || '—';
    badgeCategory.textContent   = active.category || '—';
    questionLabel.textContent   = `#${active.order?.toString().padStart(2,'0') || '--'} • ${active.id || ''}`;
    questionText.textContent    = active.question || '—';
    questionAnswer.textContent  = `Odpowiedź: ${active.answer || '—'}`;
    questionPrompted = false;
  } else {
    badgeDifficulty.textContent = '—';
    badgeCategory.textContent   = '—';
    questionLabel.textContent   = 'Brak wybranego pytania';
    questionText.textContent    = 'Wybierz pytanie, aby rozpocząć.';
    questionAnswer.textContent  = 'Odpowiedź: —';
  }
}

function updateWelcome(st, joinedCount){
  const dash = st.hostDashboard || {};
  const hostName = dash.hostName || 'Prowadzący';
  const waitingForPlayers = joinedCount === 0;
  const showOverlay = st.phase === 'IDLE' && (dash.metrics?.askedCount || 0) === 0;

  welcomeTitle.textContent = dash.welcomeTitle || `Witaj ${hostName}!`;

  if (waitingForPlayers){
    welcomeSubtitle.textContent = 'Czekamy aż gracze dołączą i zajmą stanowiska.';
    welcomeCta.textContent = 'Oczekiwanie na graczy';
    welcomeCta.disabled = true;
  } else {
    const readyLine = joinedCount === 1 ? '1 gracz czeka.' : `${joinedCount} graczy czeka.`;
    const baseSubtitle = (dash.welcomeSubtitle || 'Zaraz zaczynamy — przygotuj się.').trim();
    welcomeSubtitle.textContent = `${baseSubtitle} ${readyLine}`.trim();
    welcomeCta.textContent = 'Rozpocznij rozgrywkę';
    welcomeCta.disabled = false;
  }

  welcomeOverlay.classList.toggle('hidden', !showOverlay);
}

function updateMetrics(metrics){
  lastMetrics = metrics || null;
  if (!metrics){
    metricRuntime.textContent = '00:00';
    metricCount.textContent   = '0';
    metricAverage.textContent = '0,0 s';
    metricLast.textContent    = '0,0 s';
    clearRuntimeTimer();
    return;
  }
  metricCount.textContent = metrics.askedCount ?? 0;
  metricAverage.textContent = formatSeconds(metrics.averageQuestionTimeMs || 0);
  metricLast.textContent    = formatSeconds(metrics.lastQuestionTimeMs || 0);
  refreshRuntime();
  if (!runtimeTimer){ runtimeTimer = setInterval(refreshRuntime, 1000); }
}

function updateFlow(st, activeQuestion, joinedCount){
  const phase = st.phase;
  const players = st.players || [];
  const answering = st.answeringId ? players.find(x => x.id === st.answeringId) : null;

  if (phase === 'IDLE'){
    if (joinedCount === 0){
      setFlow('Czekamy na graczy', [], 'Poproś graczy o dołączenie przez player.html.');
    } else {
      setFlow('Wszyscy gotowi', [
        { label: 'Rozpocznij rozgrywkę', handler: startOrNext, variant: 'primary' }
      ], 'Gdy jesteś gotowy, rozpocznij program.');
    }
    return;
  }

  if (phase === 'INTRO'){
    if (!activeQuestion){
      setFlow('Intro programu', [
        { label: 'Wybierz pytanie', handler: openModal, variant: 'primary' }
      ], 'W czasie muzyki wybierz kategorię i pytanie.');
    } else {
      setFlow('Intro programu', [
        { label: 'Zmień pytanie', handler: openModal, variant: 'ghost' }
      ], 'Trwa muzyka otwarcia — przygotuj się do czytania.');
    }
    return;
  }

  if (phase === 'READING'){
    if (!activeQuestion){
      setFlow('Wybierz pytanie', [
        { label: 'Przeglądaj pytania', handler: openModal, variant: 'primary' }
      ], 'Wybierz kategorię i numer pytania dla Marcela.');
      return;
    }

    if (!readingStarted){
      setFlow('Zacznij czytać pytanie', [
        { label: 'Czytam', handler: beginReading, variant: 'primary' },
        { label: 'Zmień pytanie', handler: openModal, variant: 'ghost' }
      ], 'Kliknij, gdy zaczynasz czytać na głos.');
      return;
    }

    setFlow('Czytasz pytanie', [
      { label: 'Przeczytałem', handler: completeReading, variant: 'primary' }
    ], 'Wciśnij, gdy kończysz czytać i chcesz pokazać treść.');
    return;
  }

  if (phase === 'ANSWERING'){
    const hint = answering ? `${answering.id}. ${(answering.name||'').trim()}` : null;
    setFlow('Gracz odpowiada', [
      { label: '✓ Dobra odpowiedź', handler: ()=>judge(true), variant: 'good' },
      { label: '✗ Zła odpowiedź', handler: ()=>judge(false), variant: 'bad' }
    ], hint ? `Odpowiada ${hint}. Oceń jego wypowiedź.` : 'Oceń odpowiedź gracza.');
    return;
  }

  if (phase === 'BUZZING'){
    setFlow('Oczekiwanie na zgłoszenie', [], 'Gracze zgłaszają się do odpowiedzi.');
    return;
  }

  if (phase === 'SELECTING'){
    setFlow('Zwycięzca wybiera przeciwnika', [], 'Poczekaj na zatwierdzenie wyboru kolejnego gracza.');
    return;
  }

  if (phase === 'COOLDOWN'){
    setFlow('Chwila przerwy', [], 'Za moment ponownie otworzymy zgłoszenia.');
    return;
  }

  setFlow('Sterowanie', [], '');
}

function maybePromptQuestion(st, activeQuestion){
  const phase = st.phase;
  const canSelect = phase === 'READING' || phase === 'INTRO';
  const needQuestion = canSelect && !activeQuestion;
  if (needQuestion && !questionPrompted){
    questionPrompted = true;
    openModal();
  }
  if (!needQuestion){
    questionPrompted = false;
  }
}

function hasReadyPlayers(){
  if (!state) return false;
  return (state.players || []).some(isJoined);
}

function clearRuntimeTimer(){ if (runtimeTimer){ clearInterval(runtimeTimer); runtimeTimer = null; } }

function refreshRuntime(){
  if (!lastMetrics){ metricRuntime.textContent = '00:00'; return; }
  const start = lastMetrics.startedAt || 0;
  if (!start){ metricRuntime.textContent = '00:00'; return; }
  const diff = Date.now() - start;
  metricRuntime.textContent = formatDuration(diff);
}

function formatDuration(ms){
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms/1000);
  const minutes = Math.floor(totalSeconds/60).toString().padStart(2,'0');
  const seconds = (totalSeconds%60).toString().padStart(2,'0');
  return `${minutes}:${seconds}`;
}

function formatSeconds(ms){
  const sec = Math.max(0, ms/1000);
  return `${sec.toFixed(1)} s`;
}

function setFlow(status, actions=[], hint=''){
  flowStatus.textContent = status;
  flowAction.innerHTML = '';
  const hasActions = Array.isArray(actions) && actions.length > 0;

  if (hasActions){
    actions.forEach(act => {
      if (!act || typeof act.handler !== 'function') return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      const variant = act.variant || 'primary';
      if (variant){ btn.classList.add(variant); }
      btn.textContent = act.label || 'Akcja';
      btn.addEventListener('click', act.handler);
      flowAction.appendChild(btn);
    });
  }

  flowAction.classList.toggle('empty', !hasActions);

  if (hint && hint.trim()){
    flowHint.textContent = hint;
    flowHint.classList.remove('hidden');
  } else {
    flowHint.textContent = '';
    flowHint.classList.add('hidden');
  }
}

function beginReading(){
  if (!state || state.phase !== 'READING') return;
  if (!state.hostDashboard?.activeQuestion) return;
  readingStarted = true;
  send('/app/host/next');
  updateFlow(state, state.hostDashboard?.activeQuestion || null);
}

function completeReading(){
  if (!state || state.phase !== 'READING') return;
  send('/app/host/readDone');
}

/* ====== events & timer ====== */
function handleEvent(ev){
  if (!ev) return;
  if (ev.type === 'JUDGE'){
    ansJudge.textContent = ev.value==='CORRECT' ? '✓' : '✗';
    ansJudge.className   = 'judge show ' + (ev.value==='CORRECT'?'good':'bad');
    setTimeout(()=> ansJudge.className='judge', 1000);
  }
  if (ev.type === 'QUESTION_SELECTED'){
    readingStarted = false;
    questionLabel.classList.add('pulse');
    setTimeout(()=>questionLabel.classList.remove('pulse'), 600);
  }
}
function handleTimer(t){
  if (state?.phase === 'ANSWERING'){
    const left = Math.max(0, t.remainingMs||0);
    ansTime.textContent = `Czas: ${((state.settings?.answerTimerMs||0 - left)/1000).toFixed(1)} s`;
  } else {
    ansTime.textContent = 'Czas: 0.0 s';
  }
}

function truncate(text, max){
  if (!text) return '';
  return text.length > max ? text.slice(0,max-1)+'…' : text;
}
function escapeHtml(s){
  return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}
