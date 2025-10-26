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
const timerBoxEl = document.getElementById('timerBox');
const timerRemainingEl = document.getElementById('timerRemaining');
const timerTotalEl = document.getElementById('timerTotal');
const timerBarEl = document.getElementById('timerBar');
const timerFillEl = document.getElementById('timerFill');

const badgeDifficulty = document.getElementById('badgeDifficulty');
const badgeCategory   = document.getElementById('badgeCategory');
const questionLabel   = document.getElementById('questionLabel');
const questionText    = document.getElementById('questionText');
const questionAnswer  = document.getElementById('questionAnswer');

const stagePhaseEl = document.getElementById('stagePhase');
const stageTitleEl = document.getElementById('stageTitle');
const stageSubEl   = document.getElementById('stageSub');
const stageActionEl= document.getElementById('stageAction');
const stageStepsEl = document.getElementById('stageSteps');

const toastEl = document.getElementById('toast');

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
let latestTimerRemainingMs = 0;
let toastTimer = null;
let toastHideTimer = null;

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
    if (!hasReadyPlayers()) {
      showToast('Potrzebujemy co najmniej jednego gracza, aby rozpocząć.');
      return;
    }
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
  if (!state?.answeringId) {
    showToast('Nikt teraz nie odpowiada.');
    return;
  }
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
  const answerMs = st.settings?.answerTimerMs || 0;
  statAnswerTime.textContent = `${formatSecondsShort(answerMs)} s`;

  const activeQuestion = st.hostDashboard?.activeQuestion || null;
  const activeId = activeQuestion?.id || null;
  if (activeId !== currentQuestionId){
    currentQuestionId = activeId;
    readingStarted = false;
  }
  if (st.phase !== 'READING'){
    readingStarted = false;
  }
  if (st.phase !== 'ANSWERING'){
    latestTimerRemainingMs = answerMs;
  }

  updateButtons(st.phase, joinedCount, !!activeQuestion);
  updateQuestion(activeQuestion);
  updateWelcome(st, joinedCount);
  updateMetrics(st.hostDashboard?.metrics);
  updateStage(st);
  maybePromptQuestion(st, activeQuestion);
  updateTimerDisplay();

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

function updateButtons(phase, joinedCount, hasQuestion){
  const canStart = phase === 'IDLE' && joinedCount > 0;
  toggleActionButton(btnStart, phase === 'IDLE');
  btnStart.disabled = !canStart;

  const showRead = phase === 'READING' && hasQuestion && !readingStarted;
  toggleActionButton(btnRead, showRead);
  btnRead.disabled = !showRead;

  const showReadDone = phase === 'READING' && readingStarted;
  toggleActionButton(btnReadDone, showReadDone);
  btnReadDone.disabled = !showReadDone;

  const showJudge = phase === 'ANSWERING' && !!state?.answeringId;
  toggleActionButton(btnGood, showJudge);
  toggleActionButton(btnBad, showJudge);
  btnGood.disabled = !showJudge;
  btnBad.disabled  = !showJudge;

  const showNext = phase === 'SELECTING';
  toggleActionButton(btnNext, showNext);
  btnNext.disabled = !showNext;

  btnSelectQuestion.disabled = !(phase==='READING' || phase==='INTRO');
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

function updateStage(st){
  if (!st) return;
  const phase = st.phase;
  const players = st.players || [];
  const joinedCount = players.filter(isJoined).length;
  const activeQuestion = st.hostDashboard?.activeQuestion || null;
  const answering = st.answeringId ? players.find(x => x.id === st.answeringId) : null;

  const stage = {
    badge: '',
    title: '',
    message: '',
    actions: [],
    steps: buildStageSteps(st, activeQuestion, answering),
  };

  switch (phase){
    case 'IDLE':
      if (joinedCount === 0){
        stage.badge = 'Oczekiwanie';
        stage.title = 'Czekamy na graczy';
        stage.message = 'Poproś zawodników o dołączenie i zajęcie stanowisk.';
      } else {
        const readyHint = joinedCount === 1 ? 'Dołączył 1 gracz — możesz zaczynać.' : `${joinedCount} graczy czeka na start.`;
        stage.badge = 'Start';
        stage.title = 'Gotowy do rozpoczęcia';
        stage.message = readyHint;
        stage.actions.push({ label: 'Rozpocznij', handler: startOrNext, variant: 'primary' });
      }
      break;
    case 'INTRO':
      stage.badge = 'Intro';
      if (!activeQuestion){
        stage.title = 'Wybierz pytanie';
        stage.message = 'Podczas muzyki wskaż kategorię i numer pytania.';
        stage.actions.push({ label: 'Wybierz pytanie', handler: openModal, variant: 'primary' });
      } else {
        stage.title = 'Intro trwa';
        stage.message = 'Możesz jeszcze zmienić pytanie przed ciszą.';
        stage.actions.push({ label: 'Zmień pytanie', handler: openModal, variant: 'ghost' });
      }
      break;
    case 'READING':
      stage.badge = 'Czytanie';
      if (!activeQuestion){
        stage.title = 'Przygotuj pytanie';
        stage.message = 'Wybierz kategorię oraz numer zanim zaczniesz czytać.';
        stage.actions.push({ label: 'Przeglądaj pytania', handler: openModal, variant: 'primary' });
      } else if (!readingStarted){
        stage.title = 'Czas czytać';
        stage.message = 'Gdy zaczynasz mówić na głos, kliknij „Czytam”.';
        stage.actions.push({ label: 'Czytam', handler: beginReading, variant: 'primary' });
        stage.actions.push({ label: 'Zmień pytanie', handler: openModal, variant: 'ghost' });
      } else {
        stage.title = 'Odsłoń pytanie';
        stage.message = 'Po lekturze kliknij „Przeczytałem”, aby pokazać treść na ekranie.';
        stage.actions.push({ label: 'Przeczytałem', handler: completeReading, variant: 'primary' });
      }
      break;
    case 'BUZZING':
      stage.badge = 'Zgłoszenia';
      stage.title = 'Oczekiwanie na zgłoszenie';
      stage.message = 'Gracze wciskają przyciski, aby się zgłosić.';
      break;
    case 'ANSWERING':
      if (answering){
        const nm = (answering.name || '').trim();
        const label = nm ? `${answering.id}. ${nm}` : `Gracz ${answering.id}`;
        stage.badge = `Gracz ${answering.id}`;
        stage.title = `${label} odpowiada`;
        stage.message = 'Słuchaj uważnie i oceń odpowiedź.';
      } else {
        stage.badge = 'Ocena';
        stage.title = 'Oceń odpowiedź';
        stage.message = 'Kliknij „Dobra” lub „Zła”, aby zamknąć pytanie.';
      }
      stage.actions.push({ label: '✓ Dobra odpowiedź', handler: ()=>judge(true), variant: 'good' });
      stage.actions.push({ label: '✗ Zła odpowiedź', handler: ()=>judge(false), variant: 'bad' });
      break;
    case 'SELECTING':
      stage.badge = 'Wybór';
      stage.title = 'Czekamy na wybór gracza';
      stage.message = 'Zwycięzca wskazuje kolejnego odpowiadającego — obserwuj ekran operatora.';
      break;
    case 'COOLDOWN':
      stage.badge = 'Przerwa';
      stage.title = 'Chwila przerwy';
      stage.message = 'Za moment przygotujemy kolejne pytanie.';
      break;
    default:
      stage.badge = 'Sterowanie';
      stage.title = 'Sterowanie';
      stage.message = 'Działania pojawią się w odpowiednim momencie.';
  }

  renderStage(stage);
}

function buildStageSteps(st, activeQuestion, answering){
  const steps = [
    { number: 1, title: 'Wybierz pytanie', desc: 'Otwórz katalog pytań i wskaż numer.', status: 'pending' },
    { number: 2, title: 'Kliknij „Czytam”, gdy jesteś gotowy', desc: 'Rozpocznij czytanie pytania na głos.', status: 'pending' },
    { number: 3, title: 'Kliknij „Przeczytałem” po lekturze', desc: 'Odsłoń pytanie na ekranie.', status: 'pending' },
    { number: 4, title: 'Oczekiwanie na zgłoszenie gracza', desc: 'Gracze wciskają przyciski, aby się zgłosić.', status: 'pending' },
    { number: 5, title: 'Oceń odpowiedź gracza', desc: 'Wybierz „Dobra” lub „Zła”.', status: 'pending' }
  ];

  const phase = st.phase;
  const hasQuestion = !!activeQuestion;

  if (!hasQuestion){
    if (phase === 'INTRO' || phase === 'READING'){
      steps[0].status = 'active';
    }
  } else {
    steps[0].status = 'done';
    const details = [];
    if (activeQuestion.difficulty) details.push(activeQuestion.difficulty);
    if (activeQuestion.category)   details.push(activeQuestion.category);
    if (activeQuestion.id)         details.push(`#${activeQuestion.id}`);
    if (details.length){
      steps[0].desc = details.join(' • ');
    } else {
      steps[0].desc = 'Pytanie gotowe do czytania.';
    }
  }

  if (hasQuestion){
    if (phase === 'READING'){
      if (!readingStarted){
        steps[1].status = 'active';
        steps[2].status = 'pending';
      } else {
        steps[1].status = 'done';
        steps[2].status = 'active';
      }
    } else if (phase !== 'INTRO' && phase !== 'IDLE'){
      steps[1].status = 'done';
      steps[2].status = 'done';
    }
  }

  if (!hasQuestion){
    steps[1].status = steps[1].status === 'done' ? 'done' : 'pending';
    steps[2].status = steps[2].status === 'done' ? 'done' : 'pending';
  } else if (phase === 'READING' && !readingStarted){
    steps[2].status = steps[2].status === 'active' ? 'active' : 'pending';
  }

  if (phase === 'BUZZING'){
    steps[3].status = 'active';
  } else if (phase === 'ANSWERING' || phase === 'SELECTING'){
    steps[3].status = 'done';
  } else if (phase === 'COOLDOWN'){
    steps[3].status = 'active';
    steps[3].desc = 'Krótka przerwa przed kolejnym pytaniem.';
  }

  if (phase === 'ANSWERING'){
    steps[4].status = 'active';
    if (answering){
      const nm = (answering.name || '').trim();
      const label = nm ? `${answering.id}. ${nm}` : `Gracz ${answering.id}`;
      steps[4].desc = `${label} odpowiada. Oceń jego wypowiedź.`;
    }
  } else if (phase === 'SELECTING' || phase === 'COOLDOWN'){
    steps[4].status = 'done';
    if (phase === 'SELECTING'){
      steps[4].desc = 'Ocena zakończona. Czekamy na wybór kolejnego gracza.';
    }
  }

  return steps;
}

function renderStage(stage){
  if (!stagePhaseEl || !stageTitleEl || !stageSubEl || !stageActionEl) return;
  stagePhaseEl.textContent = stage.badge || 'Sterowanie';
  stageTitleEl.textContent = stage.title || 'Sterowanie';
  stageSubEl.textContent = stage.message || 'Sterowanie pojawi się po rozpoczęciu gry.';
  stageActionEl.innerHTML = '';

  const acts = Array.isArray(stage.actions) ? stage.actions : [];
  if (!acts.length){
    const placeholder = document.createElement('div');
    placeholder.className = 'stage-placeholder';
    placeholder.textContent = 'Sterowanie pojawi się automatycznie w kolejnym kroku.';
    stageActionEl.appendChild(placeholder);
  } else {
    acts.forEach(act => {
      const btn = createActionButton(act);
      if (!btn) return;
      btn.classList.add('stage-btn');
      stageActionEl.appendChild(btn);
    });
  }

  renderStageSteps(Array.isArray(stage.steps) ? stage.steps : []);
}

function renderStageSteps(steps){
  if (!stageStepsEl) return;
  stageStepsEl.innerHTML = '';
  if (!steps.length){
    const placeholder = document.createElement('li');
    placeholder.className = 'stage-step';
    placeholder.innerHTML = `
      <div class="stage-step-number">–</div>
      <div>
        <div class="stage-step-title">Sterowanie</div>
        <div class="stage-step-desc">Kroki pojawią się po rozpoczęciu gry.</div>
      </div>
    `;
    stageStepsEl.appendChild(placeholder);
    return;
  }

  steps.forEach((step, idx) => {
    const li = document.createElement('li');
    const status = step.status || 'pending';
    li.className = `stage-step ${status}`;
    const number = step.number ?? (idx + 1);
    li.innerHTML = `
      <div class="stage-step-number">${escapeHtml(String(number))}</div>
      <div>
        <div class="stage-step-title">${escapeHtml(step.title || '')}</div>
        <div class="stage-step-desc">${escapeHtml(step.desc || '')}</div>
      </div>
    `;
    stageStepsEl.appendChild(li);
  });
}

function createActionButton(act){
  if (!act || typeof act.handler !== 'function') return null;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  if (act.variant){ btn.classList.add(act.variant); }
  btn.textContent = act.label || 'Akcja';
  if (act.disabled){ btn.disabled = true; }
  btn.addEventListener('click', act.handler);
  return btn;
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

function formatSecondsShort(ms){
  return (Math.max(0, ms)/1000).toFixed(1);
}

function toggleActionButton(btn, visible){
  if (!btn) return;
  btn.classList.toggle('is-hidden', !visible);
  if (!visible){ btn.disabled = true; }
}

function showToast(message){
  if (!toastEl) return;
  if (toastTimer){ clearTimeout(toastTimer); toastTimer = null; }
  if (toastHideTimer){ clearTimeout(toastHideTimer); toastHideTimer = null; }
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  requestAnimationFrame(()=> toastEl.classList.add('show'));
  toastTimer = setTimeout(()=>{
    toastEl.classList.remove('show');
    toastHideTimer = setTimeout(()=>{
      toastEl.classList.add('hidden');
      toastHideTimer = null;
    }, 300);
    toastTimer = null;
  }, 2600);
}

function beginReading(){
  if (!state){ return; }
  if (state.phase !== 'READING'){
    showToast('Poczekaj na sygnał „Czytanie”.');
    return;
  }
  if (!state.hostDashboard?.activeQuestion){
    showToast('Najpierw wybierz pytanie.');
    return;
  }
  if (readingStarted){ return; }
  readingStarted = true;
  send('/app/host/next');
  updateStage(state);
}

function completeReading(){
  if (!state){ return; }
  if (state.phase !== 'READING'){
    showToast('Nie jesteśmy w trakcie czytania.');
    return;
  }
  if (!readingStarted){
    showToast('Najpierw kliknij „Czytam”.');
    return;
  }
  send('/app/host/readDone');
  updateStage(state);
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
    updateStage(state);
  }
}
function handleTimer(t){
  if (!state) return;
  if (state.phase === 'ANSWERING'){
    latestTimerRemainingMs = Math.max(0, t?.remainingMs || 0);
  } else {
    latestTimerRemainingMs = state.settings?.answerTimerMs || 0;
  }
  updateTimerDisplay();
}

function updateTimerDisplay(){
  const total = Math.max(0, state?.settings?.answerTimerMs || 0);
  const isAnswering = state?.phase === 'ANSWERING';

  if (total === 0){
    timerRemainingEl.textContent = '0.0';
    timerTotalEl.textContent = '/ 0.0 s';
    timerFillEl.style.width = '0%';
    timerBarEl.classList.remove('critical');
    if (timerBoxEl){ timerBoxEl.classList.remove('critical'); }
    ansTime.textContent = 'Czas odpowiedzi nie został ustawiony.';
    return;
  }

  const remaining = Math.min(total, Math.max(0, isAnswering ? latestTimerRemainingMs : total));
  timerRemainingEl.textContent = formatSecondsShort(remaining);
  timerTotalEl.textContent = `/ ${formatSecondsShort(total)} s`;
  const percent = total > 0 ? (remaining / total) * 100 : 0;
  timerFillEl.style.width = `${percent}%`;
  const critical = isAnswering && remaining <= Math.min(total, 2000);
  timerBarEl.classList.toggle('critical', critical);
  if (timerBoxEl){ timerBoxEl.classList.toggle('critical', critical); }

  if (isAnswering){
    ansTime.textContent = remaining > 0 ? 'Czekamy na odpowiedź gracza.' : 'Czas minął — oceń odpowiedź.';
  } else {
    ansTime.textContent = `Czas odpowiedzi ustawiony na ${formatSecondsShort(total)} s`;
  }
}

function truncate(text, max){
  if (!text) return '';
  return text.length > max ? text.slice(0,max-1)+'…' : text;
}
function escapeHtml(s){
  return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}
