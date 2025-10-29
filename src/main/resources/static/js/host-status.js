import { connect } from '/js/ws.js';

const statusPhaseEl = document.getElementById('statusPhase');
const statusBuzzRow = document.getElementById('statusBuzzRow');
const statusBuzzValue = document.getElementById('statusBuzz');
const statusAnswerRow = document.getElementById('statusAnswerRow');
const statusAnswerValue = document.getElementById('statusAnswering');
const statusNextRow = document.getElementById('statusNextRow');
const statusNextValue = document.getElementById('statusNext');
const statusLogList = document.getElementById('statusLog');
const logMetaEl = document.getElementById('logMeta');

const MAX_STATUS_LOG_ITEMS = 12;
const STATUS_LOG_TYPES = new Set(['info', 'buzz', 'answer', 'warning', 'phase']);

const PHASE_LABELS = {
  IDLE: 'Czekamy',
  INTRO: 'Wybór pytania',
  READING: 'Czytanie',
  BUZZING: 'Zgłoszenia',
  ANSWERING: 'Odpowiedź',
  ANNOTATION: 'Adnotacja',
  SELECTING: 'Wybór',
};

const PHASE_STATUS_MESSAGES = {
  IDLE: 'Gra oczekuje na rozpoczęcie.',
  INTRO: 'Trwa wybór pytania.',
  READING: 'Pytanie jest czytane na głos.',
  BUZZING: 'Otwarta runda zgłoszeń — czekamy na graczy.',
  ANSWERING: 'Gracz udziela odpowiedzi.',
  ANNOTATION: 'Czytana jest adnotacja do pytania.',
  SELECTING: 'Zwycięzca wskazuje kolejnego odpowiadającego.',
};

let state = null;
let lastBuzzPlayerId = null;
let lastAnsweringPlayerId = null;
let lastNextStepKey = null;
let lastLoggedPhase = null;
const statusLogEntries = [];

connect({
  onState: payload => {
    state = payload;
    renderState();
  },
  onEvent: ev => handleEvent(ev),
});

function renderState(){
  if (!state) return;
  const counts = stageCounts(state);
  const answering = counts.answeringPlayer;
  const uiPhase = resolveUiPhase(state, counts.activeQuestion, answering);
  const steps = buildStageSteps(state, counts.activeQuestion, answering, counts.currentChooser, uiPhase);

  updateStatusPanel(uiPhase, answering, steps);
  updateDocumentTitle(uiPhase);

  if (uiPhase !== lastLoggedPhase){
    const message = PHASE_STATUS_MESSAGES[uiPhase] || `Faza: ${phaseLabel(uiPhase)}.`;
    appendStatusLog(message, 'phase');
    highlightPhase();
    lastLoggedPhase = uiPhase;
  }
}

function updateDocumentTitle(phase){
  const label = phaseLabel(phase);
  document.title = `1 z 10 — ${label} (podgląd)`;
}

function phaseLabel(phase){
  if (!phase) return '—';
  return PHASE_LABELS[phase] || phase;
}

function stageCounts(st){
  const players = Array.isArray(st?.players) ? st.players : [];
  const joined = joinedPlayers(players);
  const joinedCount = joined.length;
  const totalSlots = players.length || 10;
  const activeQuestion = st?.hostDashboard?.activeQuestion || null;
  const answeringPlayer = players.find(p => p.id === st?.answeringId) || null;
  const currentChooser = typeof st?.currentChooserId === 'number' ? st.currentChooserId : null;
  return { players, joined, joinedCount, totalSlots, activeQuestion, answeringPlayer, currentChooser };
}

function joinedPlayers(list){
  if (!Array.isArray(list)) return [];
  return list.filter(isJoined);
}

function isJoined(player){
  if (!player) return false;
  const explicit = coerceJoinedFlag(player.joined);
  if (explicit != null) return explicit;
  return !looksLikePlaceholder(player);
}

function looksLikePlaceholder(player){
  const nm = normalizeName(player);
  if (!nm) return true;
  return nm.toLowerCase() === (`gracz ${player?.id}`).toLowerCase();
}

function normalizeName(player){
  return (player?.name || '').trim();
}

function coerceJoinedFlag(value){
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number'){ return Number.isFinite(value) ? value > 0 : null; }
  if (typeof value === 'string'){
    const norm = value.trim().toLowerCase();
    if (!norm) return null;
    if (['false','0','no','n','f','off'].includes(norm)) return false;
    if (['true','1','yes','y','t','on','joined','connected','ready'].includes(norm)) return true;
  }
  return null;
}

function resolveUiPhase(st, activeQuestion, answering){
  const rawPhase = st?.phase || 'IDLE';
  if (rawPhase === 'READING' && !activeQuestion){
    return 'INTRO';
  }
  if (rawPhase === 'BUZZING' && answering){
    return 'ANSWERING';
  }
  return rawPhase;
}

function buildStageSteps(st, activeQuestion, answering, currentChooserId, phase){
  const steps = [
    { number: 1, title: 'Wybierz pytanie', desc: 'Otwórz katalog pytań i wskaż numer.', status: 'pending' },
    { number: 2, title: 'Kliknij „Czytam”, gdy jesteś gotowy', desc: 'Rozpocznij czytanie pytania na głos.', status: 'pending' },
    { number: 3, title: 'Kliknij „Przeczytałem” po lekturze', desc: 'Odsłoń pytanie na ekranie.', status: 'pending' },
    { number: 4, title: 'Oczekiwanie na zgłoszenie gracza', desc: 'Gracze wciskają przyciski, aby się zgłosić.', status: 'pending' },
    { number: 5, title: 'Oceń odpowiedź gracza', desc: 'Wybierz „Dobra” lub „Zła”.', status: 'pending' },
    { number: 6, title: 'Przeczytaj adnotację', desc: 'Zapoznaj się z adnotacją przed kolejnym krokiem.', status: 'pending' },
  ];

  const hasQuestion = !!activeQuestion;
  const isPreparing = !!activeQuestion?.preparing;

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
      } else {
        steps[1].status = 'done';
        steps[2].status = 'active';
      }
    } else if (phase !== 'INTRO' && phase !== 'IDLE'){
      steps[1].status = 'done';
      steps[2].status = 'done';
    }
  }

  if (phase === 'READING' && hasQuestion && !isPreparing){
    steps[3].status = 'active';
    steps[3].desc = 'Kończymy etap czytania… chwilę cierpliwości.';
  }

  if (phase === 'BUZZING'){
    steps[3].status = 'active';
  }

  if (phase === 'ANSWERING'){
    steps[3].status = 'done';
    steps[4].status = 'active';
  }

  if (phase === 'ANNOTATION'){
    steps[3].status = 'done';
    steps[4].status = 'done';
    steps[5].status = 'active';
  }

  if (phase === 'SELECTING'){
    steps[3].status = 'done';
    steps[4].status = 'done';
    steps[5].status = 'done';
    steps[4].desc = 'Zwycięzca wskazuje kolejnego gracza.';
  }

  if (answering){
    const label = formatPlayerLabel(answering);
    if (phase === 'ANSWERING'){
      steps[4].desc = `${label} odpowiada. Oceń jego wypowiedź.`;
    } else if (phase === 'READING' || phase === 'INTRO'){
      steps[4].desc = `${label} przygotowuje się do odpowiedzi.`;
    } else if (phase === 'ANNOTATION'){
      steps[5].desc = `${label} zakończył pytanie. Przeczytaj adnotację.`;
    }
  } else if (phase === 'ANSWERING'){
    steps[4].desc = 'Oczekujemy na ocenę odpowiedzi.';
  }

  if (phase === 'ANNOTATION' && typeof currentChooserId === 'number'){
    const chooser = st?.players?.find(p => p.id === currentChooserId) || null;
    if (chooser){
      steps[5].desc = `${formatPlayerLabel(chooser)} wskaże kolejnego zawodnika po potwierdzeniu.`;
    }
  }

  return steps;
}

function updateStatusPanel(uiPhase, answering, steps){
  if (statusPhaseEl){
    statusPhaseEl.textContent = phaseLabel(uiPhase);
  }

  const answeringId = answering?.id ?? null;
  if (statusAnswerValue){
    if (answeringId != null){
      statusAnswerValue.textContent = `${formatPlayerLabel(answering)} — Stanowisko ${answeringId}`;
    } else {
      statusAnswerValue.textContent = 'Nikt nie odpowiada.';
    }
  }
  if (answeringId !== lastAnsweringPlayerId){
    if (answeringId != null){
      highlightRow(statusAnswerRow);
    }
    lastAnsweringPlayerId = answeringId;
  }

  if (statusBuzzValue){
    if (typeof lastBuzzPlayerId === 'number'){
      const buzzPlayer = state?.players?.find(p => p.id === lastBuzzPlayerId) || null;
      const buzzSeat = buzzPlayer?.id != null ? buzzPlayer.id : lastBuzzPlayerId;
      const buzzLabel = buzzPlayer ? formatPlayerLabel(buzzPlayer) : `Gracz ${buzzSeat}`;
      statusBuzzValue.textContent = `${buzzLabel} — Stanowisko ${buzzSeat}`;
    } else {
      statusBuzzValue.textContent = 'Brak zgłoszeń.';
    }
  }

  if (statusNextValue){
    let nextStep = null;
    if (Array.isArray(steps)){
      nextStep = steps.find(step => step.status === 'active') || steps.find(step => step.status === 'pending');
    }
    if (nextStep){
      const title = (nextStep.title || '').trim();
      const desc = (nextStep.desc || '').trim();
      const combined = desc ? `${title}: ${desc}` : title || desc || '—';
      statusNextValue.textContent = combined || '—';
      const key = `${nextStep.number ?? ''}|${title}|${desc}|${nextStep.status || ''}`;
      if (key !== lastNextStepKey){
        lastNextStepKey = key;
        highlightRow(statusNextRow);
      }
    } else {
      const fallback = PHASE_STATUS_MESSAGES[uiPhase] || '—';
      statusNextValue.textContent = fallback;
      const key = `fallback::${uiPhase || ''}`;
      if (key !== lastNextStepKey){
        lastNextStepKey = key;
        highlightRow(statusNextRow);
      }
    }
  }
}

function highlightRow(row){
  if (!row) return;
  row.classList.remove('flash');
  void row.offsetWidth;
  row.classList.add('flash');
}

function highlightPhase(){
  if (!statusPhaseEl) return;
  statusPhaseEl.classList.remove('flash');
  void statusPhaseEl.offsetWidth;
  statusPhaseEl.classList.add('flash');
}

function appendStatusLog(message, type = 'info'){
  if (!message) return;
  const normalizedMessage = String(message).trim();
  if (!normalizedMessage) return;
  const normalizedType = STATUS_LOG_TYPES.has(type) ? type : 'info';
  const timestamp = new Date();
  const lastEntry = statusLogEntries[0];
  if (lastEntry && lastEntry.message === normalizedMessage && lastEntry.type === normalizedType){
    lastEntry.timestamp = timestamp;
    renderStatusLog();
    return;
  }
  statusLogEntries.unshift({ message: normalizedMessage, type: normalizedType, timestamp });
  if (statusLogEntries.length > MAX_STATUS_LOG_ITEMS){
    statusLogEntries.length = MAX_STATUS_LOG_ITEMS;
  }
  renderStatusLog();
}

function renderStatusLog(){
  if (!statusLogList) return;
  statusLogList.innerHTML = '';
  if (!statusLogEntries.length){
    const empty = document.createElement('li');
    empty.className = 'status-log-empty';
    empty.textContent = 'Brak zdarzeń.';
    statusLogList.appendChild(empty);
    if (logMetaEl){
      logMetaEl.textContent = 'Ostatnie wpisy pojawią się poniżej.';
    }
    return;
  }
  statusLogEntries.forEach(entry => {
    const li = document.createElement('li');
    li.className = `status-log-item status-${entry.type}`;
    li.innerHTML = `
      <span class="status-log-time">${escapeHtml(formatLogTime(entry.timestamp))}</span>
      <span class="status-log-message">${escapeHtml(entry.message)}</span>
    `;
    statusLogList.appendChild(li);
  });
  if (logMetaEl){
    const newest = statusLogEntries[0];
    logMetaEl.textContent = `Wyświetlanych wpisów: ${statusLogEntries.length}. Ostatnia aktualizacja ${formatLogTime(newest.timestamp)}.`;
  }
}

function formatLogTime(date){
  const dt = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dt.getTime())) return '--:--:--';
  const hours = dt.getHours().toString().padStart(2, '0');
  const minutes = dt.getMinutes().toString().padStart(2, '0');
  const seconds = dt.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function escapeHtml(value){
  if (value == null) return '';
  return String(value).replace(/[&<>]/g, ch => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    return ch;
  });
}

function setLastBuzzPlayer(id, context){
  if (typeof id !== 'number' || Number.isNaN(id)) return;
  lastBuzzPlayerId = id;
  const player = state?.players?.find(p => p.id === id) || null;
  const seat = player?.id != null ? player.id : id;
  const label = player ? formatPlayerLabel(player) : `Gracz ${seat}`;
  let message;
  switch (context){
    case 'START':
      message = `${label} rozpoczyna grę jako pierwszy.`;
      break;
    case 'MANUAL':
      message = `${label} został ustawiony jako odpowiadający.`;
      break;
    case 'ROUND':
      message = `${label} wygrał rundę i rozpoczyna kolejne pytanie.`;
      break;
    default:
      message = `${label} zgłosił się do odpowiedzi.`;
      break;
  }
  appendStatusLog(message, 'buzz');
  highlightRow(statusBuzzRow);
  refreshStatusPanel();
}

function resetStatusTracking(message){
  lastBuzzPlayerId = null;
  lastAnsweringPlayerId = null;
  lastNextStepKey = null;
  lastLoggedPhase = null;
  statusLogEntries.length = 0;
  renderStatusLog();
  if (message){
    appendStatusLog(message, 'info');
  }
  refreshStatusPanel();
}

function refreshStatusPanel(){
  if (!state) return;
  const counts = stageCounts(state);
  const answering = counts.answeringPlayer;
  const uiPhase = resolveUiPhase(state, counts.activeQuestion, answering);
  const steps = buildStageSteps(state, counts.activeQuestion, answering, counts.currentChooser, uiPhase);
  updateStatusPanel(uiPhase, answering, steps);
  updateDocumentTitle(uiPhase);
}

function handleEvent(ev){
  if (!ev) return;
  if (ev.type === 'RESET' || ev.type === 'NEW_GAME'){
    const message = ev.type === 'RESET'
      ? 'Gra została zresetowana.'
      : 'Rozpoczynamy nową grę.';
    resetStatusTracking(message);
    return;
  }
  if (ev.type === 'ROUND_WINNER'){
    setLastBuzzPlayer(ev.playerId, 'ROUND');
    return;
  }
  if (ev.type === 'BUZZ_RESULT'){
    setLastBuzzPlayer(ev.playerId, 'START');
    return;
  }
  if (ev.type === 'ANSWERING_STARTED'){
    setLastBuzzPlayer(ev.playerId, 'MANUAL');
    return;
  }
  if (ev.type === 'JUDGE'){
    const player = state?.players?.find(p => p.id === ev.playerId) || null;
    const label = player ? formatPlayerLabel(player) : (ev.playerId != null ? `Gracz ${ev.playerId}` : 'Gracz');
    const correct = ev.value === 'CORRECT';
    appendStatusLog(correct ? `${label} odpowiedział poprawnie.` : `${label} odpowiedział błędnie.`, correct ? 'answer' : 'warning');
    highlightRow(statusAnswerRow);
    refreshStatusPanel();
    return;
  }
  if (ev.type === 'QUESTION_SELECTED'){
    const active = state?.hostDashboard?.activeQuestion;
    if (active){
      const parts = [];
      if (active.difficulty) parts.push(active.difficulty);
      if (active.category) parts.push(active.category);
      if (active.id) parts.push(`#${active.id}`);
      const details = parts.length ? parts.join(' • ') : null;
      appendStatusLog(details ? `Wybrano pytanie ${details}.` : 'Wybrano pytanie.', 'info');
    } else {
      appendStatusLog('Wybrano pytanie.', 'info');
    }
    refreshStatusPanel();
    return;
  }
  if (ev.type === 'TARGET_PROPOSED'){
    const fromId = ev.playerId;
    const toId = parseInt(ev.value || '0', 10);
    const from = state?.players?.find(p => p.id === fromId) || null;
    const to = state?.players?.find(p => p.id === toId) || null;
    const fromLabel = from ? formatPlayerLabel(from) : (fromId != null ? `Gracz ${fromId}` : 'Gracz');
    const toLabel = to ? formatPlayerLabel(to) : (Number.isFinite(toId) ? `Gracz ${toId}` : 'Gracz');
    appendStatusLog(`${fromLabel} wskazuje ${toLabel}.`, 'info');
    refreshStatusPanel();
    return;
  }
  if (ev.type === 'TARGET_ACCEPTED'){
    const chooserId = parseInt(ev.value || '0', 10);
    const chooser = state?.players?.find(p => p.id === chooserId) || null;
    const chosen = state?.players?.find(p => p.id === ev.playerId) || null;
    const chooserLabel = chooser ? formatPlayerLabel(chooser) : (Number.isFinite(chooserId) ? `Gracz ${chooserId}` : 'Gracz');
    const chosenLabel = chosen ? formatPlayerLabel(chosen) : (ev.playerId != null ? `Gracz ${ev.playerId}` : 'Gracz');
    appendStatusLog(`${chooserLabel} wybiera ${chosenLabel} do odpowiedzi.`, 'info');
    highlightRow(statusAnswerRow);
    refreshStatusPanel();
    return;
  }
  if (ev.type === 'TARGET_REJECTED'){
    appendStatusLog('Wybór przeciwnika został odrzucony.', 'warning');
    refreshStatusPanel();
    return;
  }
}

function formatPlayerLabel(player){
  if (!player) return '—';
  const nm = normalizeName(player);
  return nm ? `${player.id}. ${nm}` : `Gracz ${player.id}`;
}

renderStatusLog();
refreshStatusPanel();
