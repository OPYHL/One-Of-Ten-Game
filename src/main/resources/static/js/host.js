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
const btnOverlayStart = document.getElementById('btnOverlayStart');

const phaseEl     = document.getElementById('phase');
const statPlayers = document.getElementById('statPlayers');
const statAnswerTime = document.getElementById('statAnswerTime');

const ansAv   = document.getElementById('ansAv');
const ansName = document.getElementById('ansName');
const ansSeat = document.getElementById('ansSeat');
const ansTime = document.getElementById('ansTime');
const ansJudge= document.getElementById('ansJudge');

const plist   = document.getElementById('plist');

const badgeDifficulty = document.getElementById('badgeDifficulty');
const badgeCategory   = document.getElementById('badgeCategory');
const questionLabel   = document.getElementById('questionLabel');
const questionText    = document.getElementById('questionText');
const questionAnswer  = document.getElementById('questionAnswer');

const welcomeOverlay  = document.getElementById('welcomeOverlay');
const welcomeTitle    = document.getElementById('welcomeTitle');
const welcomeSubtitle = document.getElementById('welcomeSubtitle');

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
btnOverlayStart.addEventListener('click', startOrNext);

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
  statPlayers.textContent = joined.length;
  phaseEl.textContent = st.phase;
  const answerSeconds = Math.round((st.settings?.answerTimerMs||0)/1000);
  statAnswerTime.textContent = `${answerSeconds} s`;

  updateButtons(st.phase);
  updateQuestion(st);
  updateWelcome(st);
  updateMetrics(st.hostDashboard?.metrics);

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
        <div class="name">${pp.id}. ${escapeHtml((pp.name||'').trim())}</div>
        <div class="sub">Życia: ${pp.lives} • Punkty: ${pp.score}</div>
      </div>
      <div class="cta">Ustaw</div>
    `;
    row.addEventListener('click', ()=> send('/app/setAnswering', { playerId: pp.id }));
    plist.appendChild(row);
  });
}

function updateButtons(phase){
  btnStart.disabled    = !(phase==='IDLE' || phase==='READING' || phase==='SELECTING');
  btnRead.disabled     = (phase!=='READING' && phase!=='SELECTING');
  btnReadDone.disabled = (phase!=='READING');
  btnGood.disabled     = (phase!=='ANSWERING');
  btnBad.disabled      = (phase!=='ANSWERING');
  btnNext.disabled     = !(phase==='IDLE' || phase==='SELECTING');
}

function updateQuestion(st){
  const active = st.hostDashboard?.activeQuestion;
  if (active){
    badgeDifficulty.textContent = active.difficulty || '—';
    badgeCategory.textContent   = active.category || '—';
    questionLabel.textContent   = `#${active.order?.toString().padStart(2,'0') || '--'} • ${active.id || ''}`;
    questionText.textContent    = active.question || '—';
    questionAnswer.textContent  = `Odpowiedź: ${active.answer || '—'}`;
  } else {
    badgeDifficulty.textContent = '—';
    badgeCategory.textContent   = '—';
    questionLabel.textContent   = 'Brak wybranego pytania';
    questionText.textContent    = 'Wybierz pytanie, aby rozpocząć.';
    questionAnswer.textContent  = 'Odpowiedź: —';
  }
}

function updateWelcome(st){
  const dash = st.hostDashboard || {};
  welcomeTitle.textContent = dash.welcomeTitle || `Witaj ${dash.hostName||'Prowadzący'}!`;
  welcomeSubtitle.textContent = dash.welcomeSubtitle || 'Zaraz zaczynamy — przygotuj się.';
  const showOverlay = st.phase === 'IDLE' && (dash.metrics?.askedCount || 0) === 0;
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

/* ====== events & timer ====== */
function handleEvent(ev){
  if (!ev) return;
  if (ev.type === 'JUDGE'){
    ansJudge.textContent = ev.value==='CORRECT' ? '✓' : '✗';
    ansJudge.className   = 'judge show ' + (ev.value==='CORRECT'?'good':'bad');
    setTimeout(()=> ansJudge.className='judge', 1000);
  }
  if (ev.type === 'QUESTION_SELECTED'){
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
