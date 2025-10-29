import { connect } from '/js/ws.js';

const btnStart    = document.getElementById('btnStart');
const btnIntroDone= document.getElementById('btnIntroDone');
const btnQuestion = document.getElementById('btnQuestion');
const btnRead     = document.getElementById('btnRead');
const btnReadDone = document.getElementById('btnReadDone');
const btnGood     = document.getElementById('btnGood');
const btnBad      = document.getElementById('btnBad');
const btnNext     = document.getElementById('btnNext');
const btnReset    = document.getElementById('btnReset');
const btnNew      = document.getElementById('btnNew');
const btnSelectQuestion = document.getElementById('btnSelectQuestion');
const btnHudToggle = document.getElementById('btnHudToggle');
const topbarEl       = document.getElementById('topbar');
const hudMenu        = document.getElementById('hudMenu');
const hudExtras      = document.getElementById('hudExtras');
const topActionsEl   = document.querySelector('.top-actions');
const topActionsHome = topActionsEl ? topActionsEl.parentElement : null;
const TOPBAR_COLLAPSE_WIDTH = 560;

const phaseEl       = document.getElementById('phase');
const statPlayers   = document.getElementById('statPlayers');
const statPlayersMax= document.getElementById('statPlayersMax');
const statAnswerTime= document.getElementById('statAnswerTime');
const statAsked     = document.getElementById('statAsked');
const hostClockEl   = document.getElementById('hostClock');

const ansAv   = document.getElementById('ansAv');
const ansName = document.getElementById('ansName');
const ansSeat = document.getElementById('ansSeat');
const ansTime = document.getElementById('ansTime');
const ansJudge= document.getElementById('ansJudge');
const timerBoxEl = document.getElementById('timerBox');
const timerSummaryEl = document.getElementById('timerSummary');
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
const stagePlaceholderEl = document.getElementById('stagePlaceholder');
const stageStepsEl = document.getElementById('stageSteps');
const answerActionsEl = document.querySelector('.answer-actions');
const answerJudgeWrap = document.querySelector('.answer-judge');
const stageCardEl = document.querySelector('.stage-card');

const stageButtons = {};
[btnStart, btnIntroDone, btnQuestion, btnRead, btnReadDone, btnGood, btnBad, btnNext].forEach(btn => {
  if (!btn) return;
  const baseClasses = (btn.className || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter(cls => cls !== 'primary' && cls !== 'ghost');
  const base = baseClasses.length ? baseClasses.join(' ') : 'btn';
  btn.dataset.available = btn.dataset.available || 'false';
  stageButtons[btn.id] = {
    el: btn,
    base,
    label: btn.dataset?.label || btn.textContent,
  };
});

const toastEl = document.getElementById('toast');

const welcomeOverlay  = document.getElementById('welcomeOverlay');
const welcomeHeading  = document.getElementById('welcomeHeading');
const welcomeTitle    = document.getElementById('welcomeTitle');
const welcomeSubtitle = document.getElementById('welcomeSubtitle');
const welcomeCta      = document.getElementById('btnOverlayStart');
const welcomeCard     = welcomeOverlay ? welcomeOverlay.querySelector('.welcome-card') : null;
const welcomeCount    = document.getElementById('welcomeCount');
const welcomeHint     = document.getElementById('welcomeHint');
const welcomeClock    = document.getElementById('welcomeClock');

const difficultyList  = document.getElementById('difficultyList');
const categoryList    = document.getElementById('categoryList');
const questionList    = document.getElementById('questionList');
const categoryHeader  = document.getElementById('categoryHeader');
const questionModal   = document.getElementById('questionModal');
const btnCloseModal   = document.getElementById('btnCloseModal');
const usageFilterEl   = document.getElementById('usageFilter');
const modeToggleEl    = document.getElementById('questionModeToggle');
const randomPanel     = document.getElementById('randomPanel');
const listPanel       = document.getElementById('listPanel');
const btnRandomQuestion = document.getElementById('btnRandomQuestion');
const randomNotice    = document.getElementById('randomNotice');

const metricRuntime = document.getElementById('metricRuntime');
const metricCount   = document.getElementById('metricCount');
const metricAverage = document.getElementById('metricAverage');
const metricLast    = document.getElementById('metricLast');

const targetOverlay = document.getElementById('targetOverlay');
const targetMessage = document.getElementById('targetMessage');
const btnTargetApprove = document.getElementById('btnTargetApprove');
const btnTargetReject  = document.getElementById('btnTargetReject');

if (btnHudToggle && topbarEl){
  const hudMedia = window.matchMedia(`(max-width: ${TOPBAR_COLLAPSE_WIDTH}px)`);
  const closeHud = () => {
    topbarEl.classList.remove('hud-open');
    btnHudToggle.setAttribute('aria-expanded', 'false');
  };
  btnHudToggle.addEventListener('click', event => {
    event.stopPropagation();
    const expanded = btnHudToggle.getAttribute('aria-expanded') === 'true';
    if (expanded){
      closeHud();
    } else {
      topbarEl.classList.add('hud-open');
      btnHudToggle.setAttribute('aria-expanded', 'true');
    }
  });
  document.addEventListener('click', event => {
    if (!topbarEl.classList.contains('hud-open')) return;
    if (!topbarEl.contains(event.target)){
      closeHud();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape'){
      closeHud();
    }
  });
  const handleMedia = event => {
    if (!event.matches){
      closeHud();
    }
    updateTopbarLayout();
  };
  if (hudMedia.addEventListener){
    hudMedia.addEventListener('change', handleMedia);
  } else if (hudMedia.addListener){
    hudMedia.addListener(handleMedia);
  }
}

function ensureTopActionsHome(){
  if (!topActionsEl || !topActionsHome) return;
  if (topActionsEl.parentElement !== topActionsHome){
    topActionsHome.appendChild(topActionsEl);
  }
}

function ensureTopActionsInHud(){
  if (!hudExtras || !topActionsEl) return;
  if (hudExtras.contains(topActionsEl)) return;
  hudExtras.appendChild(topActionsEl);
}

function measureCollapseNeeded(){
  if (!topbarEl || !topActionsEl) return false;

  const wasCollapsed = topbarEl.classList.contains('topbar-collapsed');
  let movedToHud = false;
  if (wasCollapsed){
    topbarEl.classList.remove('topbar-collapsed');
    if (hudExtras && hudExtras.contains(topActionsEl)){
      ensureTopActionsHome();
      movedToHud = true;
    }
  }

  const style = window.getComputedStyle(topbarEl);
  const gapRaw = style.columnGap || style.gap || '0';
  const gap = parseFloat(gapRaw) || 0;

  const brandEl = topbarEl.querySelector('.brand');
  const brandRect = brandEl ? brandEl.getBoundingClientRect() : { width: 0, top: 0 };
  const actionsRect = topActionsEl.getBoundingClientRect();
  const availableWidth = topbarEl.clientWidth;

  const topbarRect = topbarEl.getBoundingClientRect();
  const wrapDetected = brandRect.width > 0
    ? (actionsRect.top - brandRect.top) > 8
    : (actionsRect.top - topbarRect.top) > 8;

  const baseGap = (brandRect.width > 0 && actionsRect.width > 0) ? gap : 0;
  const essentialWidth = brandRect.width + actionsRect.width + baseGap;
  const topRowOverflow = essentialWidth > (availableWidth + 2);

  const shouldCollapse = topRowOverflow || wrapDetected;

  if (wasCollapsed){
    if (movedToHud && hudExtras){
      hudExtras.appendChild(topActionsEl);
    }
    topbarEl.classList.add('topbar-collapsed');
  }

  return shouldCollapse;
}

function updateTopbarLayout(){
  if (!topbarEl || !topActionsEl) return;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || topbarEl.clientWidth;
  if (viewportWidth > TOPBAR_COLLAPSE_WIDTH){
    if (topbarEl.classList.contains('topbar-collapsed')){
      topbarEl.classList.remove('topbar-collapsed');
      topbarEl.classList.remove('hud-open');
      if (btnHudToggle){
        btnHudToggle.setAttribute('aria-expanded', 'false');
      }
    }
    ensureTopActionsHome();
    return;
  }
  const shouldCollapse = measureCollapseNeeded();
  if (shouldCollapse){
    topbarEl.classList.add('topbar-collapsed');
    ensureTopActionsInHud();
  } else {
    if (topbarEl.classList.contains('topbar-collapsed')){
      topbarEl.classList.remove('topbar-collapsed');
      topbarEl.classList.remove('hud-open');
      if (btnHudToggle){
        btnHudToggle.setAttribute('aria-expanded', 'false');
      }
    }
    ensureTopActionsHome();
  }
}

if (topbarEl){
  updateTopbarLayout();
  window.addEventListener('resize', updateTopbarLayout);
  if ('ResizeObserver' in window){
    const topbarObserver = new ResizeObserver(() => updateTopbarLayout());
    topbarObserver.observe(topbarEl);
    if (hudMenu){
      topbarObserver.observe(hudMenu);
    }
  }
}

if (welcomeOverlay){
  welcomeOverlay.classList.remove('hidden');
  if (document.body){
    document.body.classList.add('welcome-active');
  }
}

let state = null;
let catalog = null;
let activeDifficulty = null;
let activeCategory = null;
let runtimeTimer = null;
let lastMetrics = null;
let currentQuestionId = null;
let questionCatalogManualUnlock = false;
let latestTimerRemainingMs = 0;
let toastTimer = null;
let toastHideTimer = null;
let autoAdvanceIntroPending = false;
let readingStartPending = false;
let readingFinishPending = false;
let targetProposal = null;
let clockTimer = null;

const QUESTION_MODE = { RANDOM: 'RANDOM', LIST: 'LIST' };
const USAGE_FILTER = { UNUSED: 'UNUSED', USED: 'USED', ALL: 'ALL' };
let questionMode = QUESTION_MODE.LIST;
let questionUsageFilter = USAGE_FILTER.UNUSED;
const usedQuestions = loadUsedQuestions();

const PHASE_LABELS = {
  IDLE: 'Czekamy',
  INTRO: 'Wybór pytania',
  READING: 'Czytanie',
  BUZZING: 'Zgłoszenia',
  ANSWERING: 'Odpowiedź',
  SELECTING: 'Wybór',
};

const bus = connect({
  onState: s => { state = s; render(); },
  onEvent: ev => handleEvent(ev),
  onTimer: t => handleTimer(t),
});

loadCatalog();
startClock();

function usageKey(difficultyId, categoryId){
  return `${difficultyId || ''}::${categoryId || ''}`;
}

function loadUsedQuestions(){
  const store = new Map();
  try {
    if (typeof window === 'undefined' || !window.localStorage){
      return store;
    }
    const raw = window.localStorage.getItem('oneoften.usedQuestions');
    if (!raw) return store;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return store;
    Object.entries(parsed).forEach(([key, list]) => {
      if (!Array.isArray(list)) return;
      const normalized = list
        .map(val => (val != null ? String(val) : null))
        .filter(Boolean);
      if (normalized.length){
        store.set(key, new Set(normalized));
      }
    });
  } catch (error){
    console.warn('Nie udało się odczytać stanu pytań', error);
  }
  return store;
}

function persistUsedQuestions(){
  try {
    if (typeof window === 'undefined' || !window.localStorage){
      return;
    }
    const payload = {};
    usedQuestions.forEach((set, key) => {
      if (set && set.size){
        payload[key] = Array.from(set);
      }
    });
    if (Object.keys(payload).length){
      window.localStorage.setItem('oneoften.usedQuestions', JSON.stringify(payload));
    } else {
      window.localStorage.removeItem('oneoften.usedQuestions');
    }
  } catch (error){
    console.warn('Nie udało się zapisać stanu pytań', error);
  }
}

function markQuestionUsed(difficultyId, categoryId, questionId){
  if (!difficultyId || !categoryId || !questionId) return;
  const key = usageKey(difficultyId, categoryId);
  let set = usedQuestions.get(key);
  if (!set){
    set = new Set();
    usedQuestions.set(key, set);
  }
  const normalizedId = String(questionId);
  if (set.has(normalizedId)) return;
  set.add(normalizedId);
  persistUsedQuestions();
  refreshQuestionLists();
}

function isQuestionUsed(difficultyId, categoryId, questionId){
  if (!difficultyId || !categoryId || !questionId) return false;
  const key = usageKey(difficultyId, categoryId);
  const set = usedQuestions.get(key);
  if (!set) return false;
  return set.has(String(questionId));
}

function clearQuestionUsage(){
  if (usedQuestions.size === 0) return;
  usedQuestions.clear();
  persistUsedQuestions();
  refreshQuestionLists();
}

function refreshQuestionLists(){
  if (questionMode === QUESTION_MODE.LIST){
    buildQuestionList();
  }
  updateRandomNotice();
}

function buildQuestionPool(){
  const diff = activeDifficulty;
  if (!diff || !Array.isArray(diff?.categories)) return [];
  const pool = [];
  diff.categories.forEach(cat => {
    const questions = Array.isArray(cat?.questions) ? cat.questions : [];
    questions.forEach(q => {
      const used = isQuestionUsed(diff.id, cat.id, q.id);
      if (questionUsageFilter === USAGE_FILTER.UNUSED && used) return;
      if (questionUsageFilter === USAGE_FILTER.USED && !used) return;
      pool.push({ difficulty: diff, category: cat, question: q, used });
    });
  });
  if (questionUsageFilter === USAGE_FILTER.ALL){
    pool.sort((a, b) => {
      if (a.used === b.used){
        const ao = a.question?.order ?? 0;
        const bo = b.question?.order ?? 0;
        return ao - bo;
      }
      return a.used ? 1 : -1;
    });
  }
  return pool;
}

function updateRandomNotice(){
  if (!randomNotice || !btnRandomQuestion){
    return;
  }
  const diff = activeDifficulty;
  const pool = buildQuestionPool();
  const count = pool.length;
  btnRandomQuestion.disabled = count === 0 || !diff;
  if (!diff){
    randomNotice.textContent = 'Wybierz poziom trudności, aby losować pytania.';
    return;
  }
  if (count === 0){
    if (questionUsageFilter === USAGE_FILTER.UNUSED){
      randomNotice.textContent = 'Brak niewykorzystanych pytań w tym poziomie.';
    } else if (questionUsageFilter === USAGE_FILTER.USED){
      randomNotice.textContent = 'Brak wykorzystanych pytań w tym poziomie.';
    } else {
      randomNotice.textContent = 'Brak pytań spełniających kryteria.';
    }
    return;
  }
  randomNotice.textContent = `Dostępnych pytań: ${count}.`;
}

function setQuestionMode(mode){
  const upper = typeof mode === 'string' ? mode.toUpperCase() : '';
  const next = upper === QUESTION_MODE.RANDOM ? QUESTION_MODE.RANDOM : QUESTION_MODE.LIST;
  if (next === questionMode){
    updateModeButtons();
    return;
  }
  questionMode = next;
  updateModeButtons();
  if (questionMode === QUESTION_MODE.LIST){
    buildCategoryList();
    buildQuestionList();
  }
  updateRandomNotice();
}

function updateModeButtons(){
  if (modeToggleEl){
    const buttons = modeToggleEl.querySelectorAll('button');
    buttons.forEach(btn => {
      const btnMode = (btn.dataset?.mode || '').toUpperCase();
      const active = btnMode === questionMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  if (listPanel){
    listPanel.classList.toggle('hidden', questionMode !== QUESTION_MODE.LIST);
  }
  if (randomPanel){
    randomPanel.classList.toggle('hidden', questionMode !== QUESTION_MODE.RANDOM);
  }
}

function setUsageFilter(filter){
  const upper = typeof filter === 'string' ? filter.toUpperCase() : '';
  const resolved = USAGE_FILTER[upper] || USAGE_FILTER.UNUSED;
  if (resolved === questionUsageFilter){
    updateUsageButtons();
    return;
  }
  questionUsageFilter = resolved;
  updateUsageButtons();
  refreshQuestionLists();
}

function updateUsageButtons(){
  if (!usageFilterEl) return;
  const buttons = usageFilterEl.querySelectorAll('button');
  buttons.forEach(btn => {
    const val = (btn.dataset?.filter || '').toUpperCase();
    const active = val === questionUsageFilter;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function randomQuestion(){
  const pool = buildQuestionPool();
  if (!pool.length){
    updateRandomNotice();
    return;
  }
  const idx = Math.floor(Math.random() * pool.length);
  const choice = pool[idx];
  if (!choice) return;
  const question = choice.question;
  const context = { difficulty: choice.difficulty, category: choice.category };
  if (question?.display){
    showToast('Wylosowano pytanie ' + question.display + '.');
  } else {
    showToast('Wylosowano pytanie.');
  }
  confirmQuestion(question, context);
}

function recordActiveQuestionUsage(active){
  if (!active) return;
  markQuestionUsed(active.difficulty, active.category, active.id);
}

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
  if (!difficultyList) return;
  const prevId = activeDifficulty?.id;
  difficultyList.innerHTML = '';
  diffs.forEach(diff => {
    const btn = document.createElement('button');
    btn.className = 'difficulty-btn';
    btn.dataset.difficultyId = diff.id;
    btn.textContent = diff.label || diff.id;
    btn.addEventListener('click', ()=>selectDifficulty(diff, { force: true }));
    difficultyList.appendChild(btn);
  });
  const fallback = diffs.find(d => d.id === prevId) || diffs[0] || null;
  if (fallback){
    selectDifficulty(fallback, { force: true, preferredCategoryId: activeCategory?.id || null });
  } else {
    activeDifficulty = null;
    if (categoryList){ categoryList.innerHTML = ''; }
    if (questionList){ questionList.innerHTML = ''; }
    updateRandomNotice();
  }
}

function selectDifficulty(diff, opts = {}){
  if (!diff || !difficultyList) return;
  const prevId = activeDifficulty?.id || null;
  activeDifficulty = diff;
  const buttons = Array.from(difficultyList.children);
  buttons.forEach(btn => {
    const btnId = btn.dataset?.difficultyId || btn.textContent;
    btn.classList.toggle('active', btnId === diff.id || btn.textContent === (diff.label || diff.id));
  });
  const same = prevId === diff.id;
  const force = !!opts.force;
  const preferredCategoryId = opts.preferredCategoryId || null;
  if (!same || force || !categoryList?.children?.length){
    buildCategoryList({ preferredCategoryId });
  }
  updateRandomNotice();
}

function buildCategoryList(opts = {}){
  if (!categoryList) return;
  categoryList.innerHTML = '';
  if (questionList){ questionList.innerHTML = ''; }
  const diff = activeDifficulty;
  const cats = Array.isArray(diff?.categories) ? diff.categories : [];
  if (cats.length === 0){
    if (categoryHeader){ categoryHeader.textContent = 'Brak kategorii'; }
    activeCategory = null;
    if (questionList){
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Brak pytań dla tego poziomu trudności.';
      questionList.appendChild(empty);
    }
    updateRandomNotice();
    return;
  }
  if (categoryHeader){ categoryHeader.textContent = 'Kategorie'; }
  const preferredId = opts.preferredCategoryId || activeCategory?.id || null;
  let initial = null;
  cats.forEach((cat, idx) => {
    const pill = document.createElement('div');
    pill.className = 'category-pill';
    pill.dataset.categoryId = cat.id;
    pill.textContent = cat.label || cat.id;
    pill.addEventListener('click', ()=>selectCategory(cat));
    categoryList.appendChild(pill);
    if (!initial){
      if (preferredId && cat.id === preferredId){
        initial = cat;
      } else if (!preferredId && idx === 0){
        initial = cat;
      }
    }
  });
  if (!initial && cats.length > 0){
    initial = cats[0];
  }
  if (initial){
    selectCategory(initial, { skipQuestionBuild: true });
  } else {
    activeCategory = null;
  }
  if (questionMode === QUESTION_MODE.LIST){
    buildQuestionList();
  } else {
    updateRandomNotice();
  }
}

function selectCategory(cat, opts = {}){
  activeCategory = cat;
  if (categoryList){
    Array.from(categoryList.children).forEach(pill => {
      const id = pill.dataset?.categoryId || pill.textContent;
      const match = cat ? (id === cat.id || pill.textContent === (cat.label || cat.id)) : false;
      pill.classList.toggle('active', !!match);
    });
  }
  if (!opts.skipQuestionBuild && questionMode === QUESTION_MODE.LIST){
    buildQuestionList();
  }
}

function buildQuestionList(){
  if (!questionList) return;
  questionList.innerHTML = '';
  if (questionMode !== QUESTION_MODE.LIST){
    return;
  }
  const diffId = activeDifficulty?.id;
  const catId  = activeCategory?.id;
  const questions = Array.isArray(activeCategory?.questions) ? activeCategory.questions : [];
  const decorated = questions.map(q => ({
    ...q,
    used: isQuestionUsed(diffId, catId, q.id),
  }));
  let filtered = decorated;
  if (questionUsageFilter === USAGE_FILTER.UNUSED){
    filtered = decorated.filter(q => !q.used);
  } else if (questionUsageFilter === USAGE_FILTER.USED){
    filtered = decorated.filter(q => q.used);
  } else {
    filtered = decorated.slice().sort((a, b) => {
      if (a.used === b.used){
        const ao = a.order ?? 0;
        const bo = b.order ?? 0;
        return ao - bo;
      }
      return a.used ? 1 : -1;
    });
  }
  if (!filtered.length){
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    if (questionUsageFilter === USAGE_FILTER.USED){
      empty.textContent = 'W tej kategorii nie ma jeszcze wykorzystanych pytań.';
    } else if (questionUsageFilter === USAGE_FILTER.UNUSED){
      empty.textContent = 'Brak dostępnych niewykorzystanych pytań.';
    } else {
      empty.textContent = 'Brak pytań spełniających kryteria.';
    }
    questionList.appendChild(empty);
    return;
  }
  filtered.forEach(q => {
    const item = document.createElement('div');
    item.className = 'question-item' + (q.used ? ' used' : '');
    const title = escapeHtml(q.display || q.id);
    const preview = escapeHtml(truncate(q.display || '', 120));
    const flag = q.used ? '<span class="question-flag">Wykorzystane</span>' : '';
    item.innerHTML = `<strong>${title}</strong><span>${preview}</span>${flag}`;
    item.addEventListener('click', ()=>confirmQuestion(q, { difficulty: activeDifficulty, category: activeCategory }));
    questionList.appendChild(item);
  });
}

function confirmQuestion(q, context = {}){
  if (!q) return;
  let diff = context.difficulty || activeDifficulty;
  let cat  = context.category || activeCategory;
  if (!diff || !cat){ return; }
  if (context.difficulty && context.difficulty.id !== activeDifficulty?.id){
    diff = context.difficulty;
    selectDifficulty(diff, { force: true, preferredCategoryId: context.category?.id || null });
  }
  if (context.category && context.category.id !== activeCategory?.id){
    cat = context.category;
    selectCategory(cat, { skipQuestionBuild: questionMode !== QUESTION_MODE.LIST });
    if (questionMode === QUESTION_MODE.LIST){
      buildQuestionList();
    }
  }
  if (!diff || !cat) return;
  const inIntro = state?.phase === 'INTRO';
  send('/app/host/selectQuestion', {
    difficulty: diff.id,
    category: cat.id,
    questionId: q.id,
  });
  if (inIntro){
    autoAdvanceIntroPending = true;
  }
  closeModal();
}

function openModal(opts = {}){
  if (!questionModal) return;
  const manual = !!opts.manual;
  const force = !!opts.force;
  if (manual){
    questionCatalogManualUnlock = true;
  }
  if (!force && !questionCatalogManualUnlock){
    return;
  }
  questionCatalogManualUnlock = false;
  if (!catalog){ loadCatalog(); }
  questionModal.classList.remove('hidden');
}
function closeModal(){
  questionCatalogManualUnlock = false;
  if (!questionModal) return;
  questionModal.classList.add('hidden');
}

if (btnQuestion) btnQuestion.addEventListener('click', () => openModal({ manual: true }));
if (btnSelectQuestion) btnSelectQuestion.addEventListener('click', () => openModal({ manual: true }));
if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
if (questionModal) {
  questionModal.addEventListener('click', e => {
    if (e.target === questionModal) closeModal();
  });
}

if (usageFilterEl){
  usageFilterEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => setUsageFilter(btn.dataset?.filter));
  });
}

if (modeToggleEl){
  modeToggleEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => setQuestionMode(btn.dataset?.mode));
  });
}

if (btnRandomQuestion){
  btnRandomQuestion.addEventListener('click', randomQuestion);
}

updateModeButtons();
updateUsageButtons();
updateRandomNotice();

function send(dest, body={}){ try{ bus.send(dest, body);}catch(e){ console.error(e); } }

function startOrNext(){
  if (!state){
    showToast('Łączenie z serwerem… spróbuj ponownie za moment.');
    return;
  }
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

function proceedToReadingPhase(){
  if (!state) return;
  if (state.phase !== 'INTRO') {
    showToast('Przejście do czytania będzie dostępne po rozpoczęciu gry.');
    return;
  }
  if (!state.hostDashboard?.activeQuestion){
    showToast('Najpierw wybierz pytanie z katalogu.');
    return;
  }
  send('/app/introDone');
}

/* ====== UI actions ====== */
btnStart.addEventListener('click',     startOrNext);
if (btnIntroDone) btnIntroDone.addEventListener('click', proceedToReadingPhase);
btnRead.addEventListener('click',      beginReading);
btnReadDone.addEventListener('click',  completeReading);
btnGood.addEventListener('click',      ()=> judge(true));
btnBad.addEventListener('click',       ()=> judge(false));
btnNext.addEventListener('click',      ()=> send('/app/host/next'));
btnReset.addEventListener('click',     ()=> send('/app/reset'));
btnNew.addEventListener('click',       ()=> send('/app/newGame'));
if (welcomeCta) welcomeCta.addEventListener('click', startOrNext);
if (btnTargetApprove) btnTargetApprove.addEventListener('click', ()=> respondTarget(true));
if (btnTargetReject)  btnTargetReject.addEventListener('click', ()=> respondTarget(false));

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

function respondTarget(accept){
  hideTargetOverlay();
  send('/app/approveTarget', { accept: !!accept });
}

/* ====== render ====== */
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
    if (['false', '0', 'no', 'n', 'f', 'off'].includes(norm)) return false;
    if (['true', '1', 'yes', 'y', 't', 'on', 'joined', 'connected', 'ready'].includes(norm)) return true;
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
function stageCounts(st = state){
  const players = Array.isArray(st?.players) ? st.players : [];
  const joined = joinedPlayers(players);
  const joinedCount = joined.length;
  const totalSlots = players.length || 10;
  const activeQuestion = st?.hostDashboard?.activeQuestion || null;
  const answeringPlayer = players.find(p => p.id === st?.answeringId) || null;
  return { players, joined, joinedCount, totalSlots, activeQuestion, answeringPlayer };
}

function refreshStageCard(){
  if (!state) return;
  const snap = stageCounts(state);
  const uiPhase = resolveUiPhase(state, snap.activeQuestion, snap.answeringPlayer);
  if (phaseEl){ phaseEl.textContent = phaseLabel(uiPhase); }
  updateStage(state, snap.joinedCount, snap.totalSlots, snap.activeQuestion, snap.answeringPlayer, uiPhase);
}

function render(){
  const st = state; if (!st) return;

  const counts = stageCounts(st);
  const { players, joined, joinedCount, totalSlots, activeQuestion, answeringPlayer } = counts;
  const uiPhase = resolveUiPhase(st, activeQuestion, answeringPlayer);
  if (st.phase !== 'SELECTING' && targetOverlay && !targetOverlay.classList.contains('hidden')){
    hideTargetOverlay();
  }
  if (statPlayers){ statPlayers.textContent = joinedCount; }
  if (statPlayersMax){ statPlayersMax.textContent = totalSlots || 10; }
  if (phaseEl){ phaseEl.textContent = phaseLabel(uiPhase); }
  const answerMs = st.settings?.answerTimerMs || 0;
  if (statAnswerTime){ statAnswerTime.textContent = `${formatSecondsShort(answerMs)} s`; }

  const activeId = activeQuestion?.id || null;
  if (activeId !== currentQuestionId){
    currentQuestionId = activeId;
    readingStartPending = false;
    readingFinishPending = false;
  }
  const inReadingPhase = st.phase === 'READING';
  if (!inReadingPhase){
    readingStartPending = false;
    readingFinishPending = false;
  }
  if (activeQuestion && !activeQuestion.preparing){
    readingStartPending = false;
    readingFinishPending = false;
  }
  if (st.phase !== 'ANSWERING'){
    latestTimerRemainingMs = answerMs;
  }
  if (st.phase !== 'INTRO'){
    autoAdvanceIntroPending = false;
  }

  updateQuestion(activeQuestion);
  recordActiveQuestionUsage(activeQuestion);
  updateWelcome(st, joinedCount, totalSlots || 10);
  updateMetrics(st.hostDashboard?.metrics);
  updateStage(st, joinedCount, totalSlots || 10, activeQuestion, answeringPlayer, uiPhase);
  tryAutoAdvanceIntro(st, activeQuestion);
  updateTimerDisplay();

  /* current answering */
  const p = answeringPlayer;
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

function updateQuestion(active){
  if (!badgeDifficulty || !badgeCategory || !questionLabel || !questionText || !questionAnswer){
    return;
  }
  if (active){
    badgeDifficulty.textContent = active.difficulty || '—';
    badgeCategory.textContent   = active.category || '—';
    questionLabel.textContent   = `#${active.order?.toString().padStart(2,'0') || '--'} • ${active.id || ''}`;
    questionText.textContent    = active.question || '—';
    questionAnswer.textContent  = active.answer || '—';
  } else {
    badgeDifficulty.textContent = '—';
    badgeCategory.textContent   = '—';
    questionLabel.textContent   = 'Brak wybranego pytania';
    questionText.textContent    = 'Wybierz pytanie, aby rozpocząć.';
    questionAnswer.textContent  = '—';
  }
}

function updateWelcome(st, joinedCount, totalSlots){
  if (!welcomeSubtitle || !welcomeCta) return;
  const dash = st.hostDashboard || {};
  const hostName = dash.hostName || 'Prowadzący';
  const resolvedTotalSlots = Array.isArray(st.players) && st.players.length ? st.players.length : 10;
  const waitingForPlayers = joinedCount === 0;
  const everyoneReady = joinedCount >= resolvedTotalSlots && resolvedTotalSlots > 0;
  const askedCount = dash.metrics?.askedCount || 0;
  const showOverlay = st.phase === 'IDLE' && (waitingForPlayers || askedCount === 0);

  if (welcomeHeading){
    const heading = dash.welcomeHeading || 'Witaj w „1 z 10”';
    welcomeHeading.textContent = heading;
  }
  const greetTitle = dash.welcomeTitle || `Witaj ${hostName}`;
  welcomeTitle.textContent = greetTitle;
  const baseHint = (dash.welcomeSubtitle || '').trim();
  const freeSeats = Math.max(0, resolvedTotalSlots - joinedCount);

  if (welcomeCount){ welcomeCount.textContent = `${joinedCount}/${resolvedTotalSlots}`; }
  if (welcomeCard){
    welcomeCard.classList.toggle('ready', joinedCount > 0);
    welcomeCard.classList.toggle('full', everyoneReady);
  }

  if (waitingForPlayers){
    welcomeSubtitle.textContent = 'Oczekiwanie na dołączenie graczy…';
    welcomeCta.textContent = 'Rozpocznij';
    welcomeCta.disabled = true;
    if (welcomeHint){
      const parts = [];
      parts.push(baseHint || 'Zaproś uczestników do pokoju gry.');
      welcomeHint.textContent = parts.join(' ').trim();
    }
  } else if (!everyoneReady){
    welcomeSubtitle.textContent = 'Oczekiwanie na dołączenie reszty graczy…';
    const tail = freeSeats === 1 ? 'Pozostało 1 wolne miejsce.' : `Pozostało ${freeSeats} wolnych miejsc.`;
    if (welcomeHint){
      const parts = [];
      if (baseHint) parts.push(baseHint);
      parts.push(tail);
      welcomeHint.textContent = parts.join(' ').trim();
    }
    welcomeCta.textContent = 'Rozpocznij';
    welcomeCta.disabled = false;
  } else {
    welcomeSubtitle.textContent = 'Oczekiwanie na rozpoczęcie przez gospodarza.';
    if (welcomeHint){
      const parts = [];
      parts.push(baseHint || 'Wszyscy gracze są na stanowiskach.');
      welcomeHint.textContent = parts.join(' ').trim();
    }
    welcomeCta.textContent = 'Rozpocznij';
    welcomeCta.disabled = false;
  }

  if (welcomeOverlay){ welcomeOverlay.classList.toggle('hidden', !showOverlay); }
  if (document.body){
    document.body.classList.toggle('welcome-active', showOverlay);
  }
}

function updateMetrics(metrics){
  lastMetrics = metrics || null;
  if (!metricRuntime || !metricCount || !metricAverage || !metricLast){
    return;
  }

  if (!metrics){
    metricRuntime.textContent = '00:00';
    metricCount.textContent   = '0';
    metricAverage.textContent = '0,0 s';
    metricLast.textContent    = '0,0 s';
    if (statAsked){ statAsked.textContent = '0'; }
    clearRuntimeTimer();
    return;
  }
  metricCount.textContent = metrics.askedCount != null ? metrics.askedCount : 0;
  if (statAsked){ statAsked.textContent = metrics.askedCount != null ? metrics.askedCount : 0; }
  metricAverage.textContent = formatSeconds(metrics.averageQuestionTimeMs || 0);
  metricLast.textContent    = formatSeconds(metrics.lastQuestionTimeMs || 0);
  refreshRuntime();
  if (!runtimeTimer){ runtimeTimer = setInterval(refreshRuntime, 1000); }
}

function updateStage(st, joinedCount, totalSlots, activeQuestion, answering, uiPhase){
  if (!stagePhaseEl || !stageTitleEl || !stageSubEl || !stageActionEl){
    return;
  }
  if (!st) return;
  const actualPhase = st.phase;
  const phase = uiPhase || actualPhase;
  const isPreparing = !!activeQuestion?.preparing;
  const stage = {
    badge: 'Sterowanie',
    title: 'Sterowanie',
    message: 'Działania pojawią się w odpowiednim momencie.',
    buttons: [],
    steps: buildStageSteps(st, activeQuestion, answering, phase, actualPhase),
  };

  const allowQuestionPick = phase === 'INTRO' || phase === 'READING';
  if (btnSelectQuestion){ btnSelectQuestion.disabled = !allowQuestionPick; }

  if (stageCardEl){
    stageCardEl.classList.toggle('idle', phase === 'IDLE');
    stageCardEl.classList.toggle('ready', phase === 'IDLE' && joinedCount > 0);
    stageCardEl.classList.toggle('active', phase !== 'IDLE');
  }

  switch (phase){
    case 'IDLE': {
      stage.badge = 'Oczekiwanie';
      if (joinedCount === 0){
        stage.title = 'Czekamy na graczy';
        stage.message = 'Poproś zawodników o dołączenie i zajęcie stanowisk.';
        stage.buttons.push({ id: 'btnStart', label: 'Rozpocznij', variant: 'primary', disabled: true });
      } else {
        const remaining = Math.max(0, totalSlots - joinedCount);
        const readyHint = remaining === 0
          ? `${joinedCount} graczy czeka na sygnał.`
          : (joinedCount === 1 ? 'Dołączył 1 gracz — możesz zaczynać.' : `${joinedCount} graczy czeka na start.`);
        stage.badge = 'Start';
        stage.title = 'Gotowy do rozpoczęcia';
        stage.message = readyHint;
        stage.buttons.push({ id: 'btnStart', label: 'Rozpocznij', variant: 'primary' });
      }
      break;
    }
    case 'INTRO': {
      stage.badge = 'Intro';
      if (!activeQuestion){
        stage.title = 'Wybierz pytanie';
        stage.message = 'Podczas muzyki wskaż kategorię i numer pytania.';
        stage.buttons.push({ id: 'btnQuestion', label: 'Wybierz pytanie', variant: 'primary' });
      } else {
        stage.title = 'Intro gotowe';
        stage.message = 'Gdy muzyka ucichnie, kliknij „Rozpocznij czytanie”, aby przejść dalej.';
        stage.buttons.push({ id: 'btnIntroDone', label: 'Rozpocznij czytanie', variant: 'primary' });
        stage.buttons.push({ id: 'btnQuestion', label: 'Zmień pytanie', variant: 'ghost' });
      }
      break;
    }
    case 'READING': {
      stage.badge = 'Czytanie';
      if (!activeQuestion){
        stage.title = 'Przygotuj pytanie';
        stage.message = 'Wybierz kategorię oraz numer zanim zaczniesz czytać.';
        stage.buttons.push({ id: 'btnQuestion', label: 'Przeglądaj pytania', variant: 'primary' });
      } else if (isPreparing && !readingStartPending){
        stage.title = 'Czas czytać';
        stage.message = 'Gdy zaczynasz mówić na głos, kliknij „Czytam”.';
        stage.buttons.push({ id: 'btnRead', label: 'Czytam', variant: 'primary', disabled: readingStartPending });
        stage.buttons.push({ id: 'btnQuestion', label: 'Zmień pytanie', variant: 'ghost' });
      } else {
        stage.title = 'Odsłoń pytanie';
        stage.message = readingFinishPending
          ? 'Kończymy etap czytania… chwilę cierpliwości.'
          : 'Po lekturze kliknij „Przeczytałem”, aby pokazać treść na ekranie.';
        stage.buttons.push({ id: 'btnReadDone', label: 'Przeczytałem', variant: 'primary', disabled: readingFinishPending });
      }
      break;
    }
    case 'BUZZING': {
      stage.badge = 'Zgłoszenia';
      stage.title = 'Oczekiwanie na zgłoszenie';
      stage.message = 'Gracze wciskają przyciski, aby się zgłosić.';
      break;
    }
    case 'ANSWERING': {
      if (answering){
        const nm = (answering.name || '').trim();
        const label = nm ? `${answering.id}. ${nm}` : `Gracz ${answering.id}`;
        stage.badge = `Gracz ${answering.id}`;
        stage.title = `${label} odpowiada`;
        stage.message = 'Słuchaj uważnie i oceń odpowiedź.';
        stage.buttons.push({ id: 'btnGood', label: '✓ Dobra', variant: 'good' });
        stage.buttons.push({ id: 'btnBad', label: '✗ Zła', variant: 'bad' });
      } else {
        stage.badge = 'Ocena';
        stage.title = 'Oczekiwanie na odpowiedź';
        stage.message = 'Przyciski oceny pojawią się, gdy ktoś będzie odpowiadał.';
      }
      break;
    }
    case 'SELECTING': {
      stage.badge = 'Wybór';
      if (targetProposal){
        const chooser = st.players?.find(p=>p.id===targetProposal.fromId);
        const target = st.players?.find(p=>p.id===targetProposal.toId);
        stage.title = 'Potwierdź wybór gracza';
        stage.message = `${formatPlayerLabel(chooser)} wskazał ${formatPlayerLabel(target)}. Potwierdź wybór, aby przejść dalej.`;
        stage.buttons.push({ id: 'btnNext', label: 'Kolejne pytanie', variant: 'primary', disabled: true });
      } else {
        stage.title = 'Czekamy na wybór gracza';
        stage.message = 'Zwycięzca wskazuje kolejnego odpowiadającego — poczekaj na potwierdzenie operatora.';
        stage.buttons.push({ id: 'btnNext', label: 'Kolejne pytanie', variant: 'primary', disabled: true });
      }
      break;
    }
    default:
      break;
  }

  if (answering){
    const nm = (answering.name || '').trim();
    const label = nm ? `${answering.id}. ${nm}` : `Gracz ${answering.id}`;
    const isJudgingPhase = actualPhase === 'ANSWERING';
    const waitingForQuestion = actualPhase === 'READING' && (!activeQuestion || !!activeQuestion.preparing);

    if (isJudgingPhase){
      stage.badge = `Gracz ${answering.id}`;
      stage.title = `${label} odpowiada`;
      stage.message = 'Słuchaj uważnie i oceń odpowiedź.';
    } else if (waitingForQuestion || phase === 'INTRO' || phase === 'READING'){
      stage.badge = `Gracz ${answering.id}`;
      stage.title = `${label} będzie odpowiadać`;
      stage.message = 'Wybierz pytanie i przygotuj się na ocenę odpowiedzi.';
    }

    if (isJudgingPhase){
      if (!stage.buttons.some(btn => btn?.id === 'btnGood')){
        stage.buttons.push({ id: 'btnGood', label: '✓ Dobra', variant: 'good' });
      }
      if (!stage.buttons.some(btn => btn?.id === 'btnBad')){
        stage.buttons.push({ id: 'btnBad', label: '✗ Zła', variant: 'bad' });
      }
    }
  }

  applyStage(stage);
}

function buildStageSteps(st, activeQuestion, answering, phase, actualPhase){
  const steps = [
    { number: 1, title: 'Wybierz pytanie', desc: 'Otwórz katalog pytań i wskaż numer.', status: 'pending' },
    { number: 2, title: 'Kliknij „Czytam”, gdy jesteś gotowy', desc: 'Rozpocznij czytanie pytania na głos.', status: 'pending' },
    { number: 3, title: 'Kliknij „Przeczytałem” po lekturze', desc: 'Odsłoń pytanie na ekranie.', status: 'pending' },
    { number: 4, title: 'Oczekiwanie na zgłoszenie gracza', desc: 'Gracze wciskają przyciski, aby się zgłosić.', status: 'pending' },
    { number: 5, title: 'Oceń odpowiedź gracza', desc: 'Wybierz „Dobra” lub „Zła”.', status: 'pending' }
  ];

  const hasQuestion = !!activeQuestion;
  const isPreparing = !!activeQuestion?.preparing;
  const readingStarted = hasQuestion && !isPreparing;
  const readingWrapUp = (actualPhase === 'READING' || phase === 'READING') && readingStarted && !!readingFinishPending;

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
    steps[0].desc = details.length ? details.join(' • ') : 'Pytanie gotowe do czytania.';
  }

  if (hasQuestion){
    if (phase === 'READING'){
      if (isPreparing){
        steps[1].status = 'active';
      } else if (readingWrapUp){
        steps[1].status = 'done';
        steps[2].status = 'done';
      } else {
        steps[1].status = 'done';
        steps[2].status = readingStarted ? 'active' : 'done';
      }
    } else if (phase !== 'INTRO' && phase !== 'IDLE'){
      steps[1].status = 'done';
      steps[2].status = 'done';
    }
  }

  if (!hasQuestion){
    steps[1].status = steps[1].status === 'done' ? 'done' : 'pending';
    steps[2].status = steps[2].status === 'done' ? 'done' : 'pending';
  }

  if (readingWrapUp){
    steps[3].status = 'active';
    steps[3].desc = 'Kończymy etap czytania… chwilę cierpliwości.';
  }

  switch (phase){
    case 'BUZZING':
      steps[3].status = 'active';
      break;
    case 'ANSWERING':
      steps[3].status = 'done';
      steps[4].status = 'active';
      break;
    case 'SELECTING':
      steps[3].status = 'done';
      steps[4].status = 'done';
      steps[4].desc = targetProposal
        ? 'Zwycięzca wskazał gracza — potwierdź wybór.'
        : 'Ocena zakończona. Czekamy na wybór kolejnego gracza.';
      break;
    default:
      break;
  }

  if (answering){
    const nm = (answering.name || '').trim();
    const label = nm ? `${answering.id}. ${nm}` : `Gracz ${answering.id}`;
    const isJudgingPhase = actualPhase === 'ANSWERING';
    steps[3].status = 'done';
    if (isJudgingPhase){
      steps[4].status = 'active';
      steps[4].desc = `${label} odpowiada. Oceń jego wypowiedź.`;
    } else if (actualPhase === 'READING' || phase === 'INTRO' || phase === 'READING'){
      steps[4].status = steps[4].status === 'done' ? 'done' : 'pending';
      steps[4].desc = `${label} będzie odpowiadać w tej turze.`;
    }
  } else if (phase === 'ANSWERING'){
    steps[4].status = 'active';
  }

  return steps;
}

function resolveUiPhase(st, activeQuestion, answering){
  const rawPhase = st?.phase || 'IDLE';
  if (rawPhase === 'READING'){
    if (!activeQuestion){
      return 'INTRO';
    }
    if (readingFinishPending){
      return answering ? 'ANSWERING' : 'BUZZING';
    }
  }
  if (rawPhase === 'BUZZING' && answering){
    return 'ANSWERING';
  }
  return rawPhase;
}
function applyStage(stage){
  if (!stagePhaseEl || !stageTitleEl || !stageSubEl || !stageActionEl) return;
  stagePhaseEl.textContent = stage.badge || 'Sterowanie';
  stageTitleEl.textContent = stage.title || 'Sterowanie';
  stageSubEl.textContent = stage.message || 'Sterowanie pojawi się po rozpoczęciu gry.';
  updateStageButtons(Array.isArray(stage.buttons) ? stage.buttons : []);
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
    const number = step.number != null ? step.number : (idx + 1);
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

function updateStageButtons(buttons){
  if (!stageButtons) return;
  const configs = {};
  buttons.forEach(btn => { if (btn?.id){ configs[btn.id] = btn; } });
  let visible = 0;
  Object.values(stageButtons).forEach(cfg => {
    const el = cfg.el;
    if (!el) return;
    const def = configs[el.id];
    el.className = cfg.base;
    el.textContent = def?.label || cfg.label;
    const isJudgeBtn = el.id === 'btnGood' || el.id === 'btnBad';
    if (!def){
      el.disabled = true;
      el.dataset.available = 'false';
      if (isJudgeBtn){
        el.classList.remove('is-hidden');
        el.classList.add('is-idle');
      } else {
        el.classList.add('is-hidden');
      }
      return;
    }
    el.disabled = !!def.disabled;
    el.dataset.available = def.disabled ? 'false' : 'true';
    el.classList.remove('is-hidden');
    if (isJudgeBtn){
      el.classList.toggle('is-idle', !!def.disabled);
    }
    if (def?.variant && !el.classList.contains(def.variant)){
      el.classList.add(def.variant);
    }
    visible++;
  });
  if (stagePlaceholderEl){
    stagePlaceholderEl.classList.toggle('hidden', visible > 0);
  }
  if (stageActionEl){
    stageActionEl.classList.toggle('empty', visible === 0);
  }
  if (answerJudgeWrap){
    const goodEl = stageButtons.btnGood?.el;
    const badEl  = stageButtons.btnBad?.el;
    const judgeActive = !!(goodEl && goodEl.dataset.available === 'true') || !!(badEl && badEl.dataset.available === 'true');
    answerJudgeWrap.classList.remove('hidden');
    answerJudgeWrap.classList.toggle('is-idle', !judgeActive);
  }
  if (answerActionsEl){
    const nextEl = stageButtons.btnNext?.el;
    const nextVisible = !!(nextEl && !nextEl.classList.contains('is-hidden'));
    const goodEl = stageButtons.btnGood?.el;
    const badEl  = stageButtons.btnBad?.el;
    const judgeActive = !!(goodEl && goodEl.dataset.available === 'true') || !!(badEl && badEl.dataset.available === 'true');
    answerActionsEl.classList.toggle('hidden', !nextVisible && !judgeActive);
  }
}

function tryAutoAdvanceIntro(st, activeQuestion){
  if (!autoAdvanceIntroPending) return;
  if (!st || st.phase !== 'INTRO') return;
  if (!activeQuestion) return;
  autoAdvanceIntroPending = false;
  proceedToReadingPhase();
}

function hasReadyPlayers(){
  if (!state) return false;
  return joinedPlayers(state.players).length > 0;
}

function clearRuntimeTimer(){ if (runtimeTimer){ clearInterval(runtimeTimer); runtimeTimer = null; } }

function refreshRuntime(){
  if (!metricRuntime){ return; }
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

function phaseLabel(phase){
  if (!phase) return '—';
  return PHASE_LABELS[phase] || phase;
}

function startClock(){
  if (!hostClockEl && !welcomeClock) return;
  if (clockTimer){ clearInterval(clockTimer); }
  const tick = ()=>{
    const now = new Date();
    const hours = now.getHours().toString().padStart(2,'0');
    const minutes = now.getMinutes().toString().padStart(2,'0');
    if (hostClockEl){ hostClockEl.textContent = `${hours}:${minutes}`; }
    if (welcomeClock){ welcomeClock.textContent = `${hours}:${minutes}`; }
  };
  tick();
  clockTimer = setInterval(tick, 15000);
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

function showTargetOverlay(fromPlayer, toPlayer){
  if (!targetOverlay || !targetMessage) return;
  const fromLabel = formatPlayerLabel(fromPlayer);
  const toLabel = formatPlayerLabel(toPlayer);
  targetMessage.textContent = `${fromLabel} wskazuje ${toLabel}. Potwierdź wybór poniżej.`;
  targetOverlay.classList.remove('hidden');
  requestAnimationFrame(()=> targetOverlay.classList.add('show'));
}

function hideTargetOverlay(){
  if (!targetOverlay) return;
  targetOverlay.classList.remove('show');
  setTimeout(()=> targetOverlay?.classList.add('hidden'), 220);
  targetProposal = null;
}

function beginReading(){
  if (!state){ return; }
  if (state.phase !== 'READING'){
    showToast('Poczekaj na sygnał „Czytanie”.');
    return;
  }
  const active = state.hostDashboard?.activeQuestion;
  if (!active){
    showToast('Najpierw wybierz pytanie.');
    return;
  }
  if (!active.preparing){
    showToast('To pytanie jest już w trakcie czytania.');
    return;
  }
  if (readingStartPending){ return; }
  readingStartPending = true;
  readingFinishPending = false;
  send('/app/host/readingStart');
  refreshStageCard();
}

function completeReading(){
  if (!state){ return; }
  if (state.phase !== 'READING'){
    showToast('Nie jesteśmy w trakcie czytania.');
    return;
  }
  const active = state.hostDashboard?.activeQuestion;
  if (!active || (active.preparing && !readingStartPending)){
    showToast('Najpierw kliknij „Czytam”.');
    return;
  }
  if (readingFinishPending){ return; }
  readingFinishPending = true;
  send('/app/host/readDone');
  refreshStageCard();
}

/* ====== events & timer ====== */
function handleEvent(ev){
  if (!ev) return;
  if (ev.type === 'RESET' || ev.type === 'NEW_GAME'){
    clearQuestionUsage();
  }
  if (ev.type === 'JUDGE'){
    ansJudge.textContent = ev.value==='CORRECT' ? '✓' : '✗';
    ansJudge.className   = 'judge show ' + (ev.value==='CORRECT'?'good':'bad');
    setTimeout(()=> ansJudge.className='judge', 1000);
  }
  if (ev.type === 'QUESTION_SELECTED'){
    readingStartPending = false;
    readingFinishPending = false;
    questionLabel.classList.add('pulse');
    setTimeout(()=>questionLabel.classList.remove('pulse'), 600);
    if (state?.phase === 'INTRO'){
      autoAdvanceIntroPending = true;
    }
    refreshStageCard();
  }
  if (ev.type === 'TARGET_PROPOSED'){
    const fromId = ev.playerId;
    const toId = parseInt(ev.value||'0', 10);
    const from = state?.players?.find(p=>p.id===fromId);
    const to   = state?.players?.find(p=>p.id===toId);
    showTargetOverlay(from, to);
    targetProposal = { fromId, toId };
  }
  if (ev.type === 'TARGET_ACCEPTED'){
    hideTargetOverlay();
    const chosen = state?.players?.find(p=>p.id===ev.playerId);
    showToast(`Następny odpowiada ${formatPlayerLabel(chosen)}.`);
    targetProposal = null;
  }
  if (ev.type === 'TARGET_REJECTED'){
    hideTargetOverlay();
    showToast('Wybór odrzucony. Poproś o inną osobę.');
    targetProposal = null;
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
    if (timerSummaryEl){ timerSummaryEl.textContent = '0.0 s'; }
    timerFillEl.style.width = '0%';
    timerBarEl.classList.remove('critical');
    if (timerBoxEl){ timerBoxEl.classList.remove('critical'); }
    ansTime.textContent = 'Czas odpowiedzi nie został ustawiony.';
    return;
  }

  const remaining = Math.min(total, Math.max(0, isAnswering ? latestTimerRemainingMs : total));
  if (timerSummaryEl){ timerSummaryEl.textContent = `${formatSecondsShort(remaining)} s`; }
  const percent = total > 0 ? (remaining / total) * 100 : 0;
  timerFillEl.style.width = `${percent}%`;
  const critical = isAnswering && remaining <= Math.min(total, 2000);
  timerBarEl.classList.toggle('critical', critical);
  if (timerBoxEl){ timerBoxEl.classList.toggle('critical', critical); }

  if (isAnswering){
    ansTime.textContent = remaining > 0 ? 'Czekamy na odpowiedź gracza.' : 'Czas minął — oceń odpowiedź.';
  } else if (state?.phase === 'READING' && state?.hostDashboard?.activeQuestion?.preparing){
    ansTime.textContent = 'Przygotuj pytanie i kliknij „Czytam”.';
  } else {
    ansTime.textContent = `Czas odpowiedzi ustawiony na ${formatSecondsShort(total)} s`;
  }
}

function truncate(text, max){
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
function escapeHtml(s){
  if (s == null) return '';
  return String(s).replace(/[&<>]/g, ch => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    return ch;
  });
}

function formatPlayerLabel(player){
  if (!player) return '—';
  const nm = (player.name || '').trim();
  return nm ? `${player.id}. ${nm}` : `Gracz ${player.id}`;
}
