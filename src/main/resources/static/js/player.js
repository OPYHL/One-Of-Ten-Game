import { connect } from '/js/ws.js';

/* ====== DOM ====== */
const qs = new URLSearchParams(location.search);
const slotInput = document.getElementById('slot'); if (qs.get('slot')) slotInput.value = qs.get('slot');
const nameInput = document.getElementById('name');
const genderSel = document.getElementById('gender');
const btnNext1  = document.getElementById('next1');
const btnNext2  = document.getElementById('next2');
const btnKnow   = document.getElementById('know');

const livesEl   = document.getElementById('lives');
const scoreEl   = document.getElementById('score');
const statusEl  = document.getElementById('status');
const seatEl    = document.getElementById('seat');
const phaseEl   = document.getElementById('phase');
const avImg     = document.getElementById('av');
const pb        = document.getElementById('pb');

const outOverlay = document.getElementById('outOverlay');
const outStats   = document.getElementById('outStats');

/* Modal wyboru */
const chooseBackdrop = document.getElementById('chooseBackdrop');
const chooseGrid     = document.getElementById('chooseGrid');

/* ====== LOCAL STATE ====== */
let myId = null, myGender = 'MALE', phase = 'IDLE';
let myLives = 3, myScore = 0, answeredTotal = 0, correctTotal = 0;
let lastState = null;
const TOTAL = 10000;

function isSeatJoined(p){
  if (!p) return false;
  if (typeof p.joined === 'boolean') return p.joined;
  const nm = (p.name||'').trim();
  if (!nm) return false;
  return nm.toLowerCase() !== (`gracz ${p.id}`).toLowerCase();
}

// flaga: czekam na wynik po kliknięciu "Znam odpowiedź!"
let pendingBuzz = false;

/* ====== ROLE BADGE (odznaka roli) ====== */
ensureRoleBadge();
function ensureRoleBadge(){
  if (document.getElementById('roleBadge')) return;
  const host = document.getElementById('step3') || document.body;
  if (!host.style.position) host.style.position = 'relative';
  const el = document.createElement('div');
  el.id = 'roleBadge';
  el.className = 'role-badge';
  host.appendChild(el);
}
function showRole(text, kind='info'){
  const el = document.getElementById('roleBadge'); if (!el) return;
  el.textContent = text;
  el.className = 'role-badge show ' + kind;
}
function hideRole(){
  const el = document.getElementById('roleBadge'); if (!el) return;
  el.className = 'role-badge';
}

/* ====== TOAST ====== */
let toastEl = null;
injectToastCss();

function ensureToast() {
  if (toastEl) return toastEl;
  toastEl = document.createElement('div');
  toastEl.id = 'playerToast';
  toastEl.innerHTML = `<span id="playerToastText"></span>`;
  document.body.appendChild(toastEl);
  return toastEl;
}
function showToast(text, kind='info') {
  const el = ensureToast();
  const txt = document.getElementById('playerToastText');
  txt.textContent = text;
  el.classList.remove('ok','bad','info','shake');
  el.classList.add(kind);
  void el.offsetWidth; // restart animacji
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 1600);
}
function shakeToast() {
  const el = ensureToast();
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
}
function injectToastCss(){
  if (document.getElementById('playerToastCSS')) return;
  const css = document.createElement('style');
  css.id = 'playerToastCSS';
  css.textContent = `
#playerToast{
  position: fixed; top: -80px; left: 50%; transform: translateX(-50%);
  background: linear-gradient(180deg, #122035, #0b1424);
  border: 1px solid #233452; color: #dbe7ff;
  padding: 10px 16px; border-radius: 14px;
  box-shadow: 0 12px 50px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.03);
  font-weight: 800; letter-spacing: .2px; z-index: 50;
  transition: transform .55s cubic-bezier(.2,.8,.2,1), opacity .35s ease;
  opacity: 0; display: grid; place-items: center; pointer-events: none;
}
#playerToast.show{ transform: translate(-50%, 20px); opacity: 1; }
#playerToast.ok{ background: linear-gradient(180deg, #0f2d1c, #0a1e14); border-color:#1e4730; color:#d6ffe9 }
#playerToast.bad{ background: linear-gradient(180deg, #2e1518, #1c0f11); border-color:#5a2b33; color:#ffd6db }
#playerToast.shake{ animation: toastShake .5s ease }
@keyframes toastShake{
  0%,100%{ transform: translate(-50%, 20px) }
  20%{ transform: translate(calc(-50% - 6px), 20px) }
  40%{ transform: translate(calc(-50% + 6px), 20px) }
  60%{ transform: translate(calc(-50% - 3px), 20px) }
  80%{ transform: translate(calc(-50% + 3px), 20px) }
}
  `;
  document.head.appendChild(css);
}

/* ====== WS BUS ====== */
const bus = connect({
  onState: st => {
    lastState = st;
    phase = st.phase; phaseEl.textContent = 'Faza: ' + phase;

    if (myId){
      const me = st.players.find(p=>p.id===myId);
      if (me){
        if (me.score !== myScore){
          scoreEl.textContent = me.score;
          scoreEl.parentElement.classList.add('scorePulse');
          setTimeout(()=>scoreEl.parentElement.classList.remove('scorePulse'), 500);
          myScore = me.score;
        }
        if (me.lives !== myLives){
          livesEl.textContent = me.lives;
          livesEl.parentElement.classList.add('lifeShake');
          setTimeout(()=>livesEl.parentElement.classList.remove('lifeShake'), 600);
          myLives = me.lives;
        }
        if (me.eliminated){
          outOverlay.style.display='block';
          outStats.textContent = `Wynik: ${myScore} pkt • Poprawne: ${correctTotal}/${answeredTotal}`;
          btnKnow.disabled = true;
        }
      }
    }

    // Fazy – status i highlighty
    if (phase === 'READING'){
      const meAns = st.answeringId === myId;
      setStatus(meAns ? 'Twoje pytanie — słuchaj prowadzącego…' : 'Prowadzący czyta pytanie…');
      lockKnow(true);
      if (meAns) { showRole('Odpowiadasz', 'ok'); }
      else { hideRole(); }
      document.body.classList.remove('me-won','me-pending','me-answering','me-choosing','me-picked','me-banned');
      avImg.classList.remove('ping');
      setKnowLabel('Znam odpowiedź!');
    }
    else if (phase === 'BUZZING'){
      setStatus('Kliknij „Znam odpowiedź!”, jeśli znasz!');
      const banned = document.body.classList.contains('me-banned');
      lockKnow(banned);
      if (!banned){
        pendingBuzz = false;
        document.body.classList.remove('me-won','me-answering','me-choosing','me-picked');
        setKnowLabel('Znam odpowiedź!');
      } else {
        setKnowLabel('Już odpowiadałeś');
        showRole('Nie możesz w tej rundzie odpowiadać', 'bad');
      }
    }
    else if (phase === 'ANSWERING'){
      const meAns = st.answeringId === myId;
      setStatus(meAns ? 'ODPOWIADASZ — masz 10 sekund!' : 'Ktoś inny odpowiada…');
      lockKnow(true);
      if (meAns){
        answeredTotal++;
        showRole('Odpowiadasz', 'ok');
        document.body.classList.add('me-answering');
        avImg.classList.add('ping');
        if (navigator.vibrate) try{ navigator.vibrate([90,40,90]); }catch{}
        setKnowLabel('ODPOWIADASZ!');
      } else {
        document.body.classList.remove('me-answering');
        avImg.classList.remove('ping');
        setKnowLabel('Znam odpowiedź!');
      }
      document.body.classList.remove('me-won','me-pending','me-choosing','me-picked');
      pendingBuzz = false;
    }
    else if (phase === 'SELECTING'){
      setStatus('Zwycięzca wybiera przeciwnika…');
      lockKnow(true);
      // rola i highlighty ustawią się w onEvent
    }
    else if (phase === 'INTRO'){
      setStatus('Intro…');
      lockKnow(true);
      document.body.classList.remove('me-won','me-pending','me-answering','me-choosing','me-picked','me-banned');
      avImg.classList.remove('ping');
      hideRole();
      setKnowLabel('Znam odpowiedź!');
    }
    else {
      setStatus('Czekaj na kolejne pytanie…');
      lockKnow(true);
      pb.style.width='0%';
      document.body.classList.remove('me-won','me-pending','me-answering','me-choosing','me-picked','me-banned');
      avImg.classList.remove('ping');
      hideRole();
      setKnowLabel('Znam odpowiedź!');
    }
  },
  onEvent: ev => {
    // Masz prawo wybierać
    if (ev.type === 'SELECT_START' && ev.playerId === myId){
      document.body.classList.add('me-choosing');
      showRole('Wybierasz', 'warn');
      openChoosePopup();
      showToast('Wybierz przeciwnika', 'info');
      shakeToast();
    }

    // Propozycja celu (przed akceptacją)
    if (ev.type === 'TARGET_PROPOSED'){
      const fromId = ev.playerId;
      const toId = parseInt(ev.value||'0',10);
      if (myId === fromId){
        if (toId === myId){ showRole('Odpowiadasz', 'ok'); }
        else { showRole(`Wskazałeś #${toId}`, 'info'); }
      }
      if (myId === toId){
        document.body.classList.add('me-picked');
        showRole('Wybrano Cię — czekaj…', 'warn');
        showToast('Wybrano Cię — czekaj na akceptację', 'info');
      }
    }

    // Decyzja operatora/hosta
    if (ev.type === 'TARGET_REJECTED'){
      const chooserId = parseInt(ev.value||'0',10);
      if (myId === chooserId){
        showRole('Odrzucono — wybierz ponownie', 'bad');
        shakeToast();
        setTimeout(openChoosePopup, 500);
      }
      if (document.body.classList.contains('me-picked')) {
        document.body.classList.remove('me-picked');
        hideRole();
      }
    }
    if (ev.type === 'TARGET_ACCEPTED'){
      const chosenId = ev.playerId;         // kto będzie odpowiadał
      const chooserId = parseInt(ev.value||'0',10);
      document.body.classList.remove('me-choosing');
      if (myId === chooserId){
        showRole(`Wybrano: #${chosenId}`, 'ok');
      }
      if (myId === chosenId){
        document.body.classList.add('me-picked');
        showRole('Za chwilę Twoje pytanie', 'ok');
        showToast('ZA CHWILĘ TWOJE PYTANIE', 'info');
        avImg.classList.add('ping');
        setTimeout(()=> avImg.classList.remove('ping'), 800);
      } else {
        document.body.classList.remove('me-picked');
      }
      closeChoosePopup();
    }

    // Kto pierwszy z buzzera
    if (ev.type === 'ROUND_WINNER'){
      document.body.classList.remove('me-pending');
      pendingBuzz = false;
      if (ev.playerId === myId){
        document.body.classList.add('me-won');
        showRole('Masz pierwszeństwo', 'ok');
        setKnowLabel('Masz pierwszeństwo!');
        showToast('JESTEŚ PIERWSZY!', 'ok');
        if (navigator.vibrate) try{ navigator.vibrate([130,60,130]); }catch{}
      } else {
        document.body.classList.remove('me-won');
        hideRole();
        setKnowLabel('Znam odpowiedź!');
      }
    }

    // BAN na to pytanie (po złej odp./timeout w trybie otwartym)
    if (ev.type === 'BUZZ_BAN' && ev.playerId === myId){
      document.body.classList.add('me-banned');
      lockKnow(true);
      setKnowLabel('Już odpowiadałeś');
      showRole('Nie możesz w tej rundzie odpowiadać', 'bad');
      showToast('Nie możesz zgłosić się ponownie w tym pytaniu', 'bad');
      if (navigator.vibrate) try{ navigator.vibrate([60, 40, 60]); }catch{}
    }

    // Kliknięcie mimo bana (dla jasności UX)
    if (ev.type === 'BUZZ_BLOCKED' && ev.playerId === myId){
      document.body.classList.add('me-banned');
      lockKnow(true);
      setKnowLabel('Już odpowiadałeś');
      showRole('Nie możesz w tej rundzie odpowiadać', 'bad');
      showToast('Nie możesz zgłosić się ponownie w tym pytaniu', 'bad');
      shakeToast();
      if (navigator.vibrate) try{ navigator.vibrate([60, 40, 60]); }catch{}
    }

    // Ocena (dla mnie)
    if (ev.type === 'JUDGE' && ev.playerId === myId){
      if (ev.value === 'CORRECT'){ correctTotal++; showToast('✓ DOBRA ODPOWIEDŹ', 'ok'); }
      else { showToast('✗ ZŁA ODPOWIEDŹ', 'bad'); shakeToast(); }
      document.body.classList.remove('me-won','me-answering','me-choosing','me-picked');
      setKnowLabel('Znam odpowiedź!');
    }
  },
  onTimer: t => {
    const ms = t.remainingMs||0; const pct = Math.max(0, Math.min(1, (TOTAL - ms)/TOTAL));
    pb.style.width = (pct*100).toFixed(1)+'%';
  }
});

/* ====== FORM STEPS ====== */
btnNext1.onclick = () => {
  const id = parseInt(slotInput.value,10);
  const nm = (nameInput.value||'').trim();
  if (!id || id<1 || id>10) { alert('Podaj numer 1–10'); return; }
  if (!nm) { alert('Podaj imię i nazwisko'); return; }
  const existing = lastState?.players?.find(p => p.id === id && isSeatJoined(p));
  if (existing){
    const currentName = (existing.name||'').trim().toLowerCase();
    if (!currentName || currentName !== nm.toLowerCase()){
      alert('To stanowisko jest już zajęte. Wybierz inne.');
      return;
    }
  }
  myId = id;
  bus.send('/app/setName', {playerId:id, name:nm});
  document.getElementById('step1').style.display='none';
  document.getElementById('step2').style.display='block';
  seatEl.textContent = 'Stanowisko ' + id;
};

btnNext2.onclick = () => {
  if (!myId) return;
  myGender = genderSel.value;
  bus.send('/app/setGender', {playerId:myId, gender:myGender});
  avImg.src = myGender === 'FEMALE' ? '/img/female.png' : '/img/male.png';
  document.getElementById('step2').style.display='none';
  document.getElementById('step3').style.display='block';
};

btnKnow.onclick = () => {
  if (!myId) return;
  bus.send('/app/roundBuzz', {playerId:myId});
  pendingBuzz = true;
  document.body.classList.add('me-pending');
  setKnowLabel('Zgłaszam…');
  btnKnow.disabled = true;
};

/* ====== POPUP WYBORU PRZECIWNIKA ====== */
function openChoosePopup(){
  const st = lastState; chooseGrid.innerHTML = ''; if (!st) return;

  // „Wezmę pytanie na siebie”
  const self = document.createElement('div');
  self.className = 'item';
  self.innerHTML = `
    <div style="font-weight:700" title="Wezmę pytanie na siebie">Wezmę pytanie na siebie</div>
    <div class="mini">Stanowisko ${myId}</div>
  `;
  self.onclick = () => submitProposal(myId);
  chooseGrid.appendChild(self);

  // pozostali nieeliminowani
  st.players.filter(p=>!p.eliminated && p.id!==myId).forEach(p=>{
    const b = document.createElement('div');
    b.className = 'item';
    b.innerHTML = `
      <div style="font-weight:700" title="${escapeHtml(p.name||'')}">
        ${p.id}. ${escapeHtml(p.name||'')}
      </div>
      <div class="mini">${p.gender==='FEMALE'?'Kobieta':'Mężczyzna'}</div>
    `;
    b.onclick = () => submitProposal(p.id);
    chooseGrid.appendChild(b);
  });

  chooseBackdrop.classList.add('show');
}
function submitProposal(toId){
  disableChooseGrid();
  bus.send('/app/proposeTarget', {fromId: myId, toId});
  if (toId === myId) { showRole('Odpowiadasz', 'ok'); }
  else { showRole(`Wskazałeś #${toId}`, 'info'); }
  chooseGrid.innerHTML = `
    <div class="item" style="min-height:100px; width:100%; grid-column: 1 / -1; cursor:default">
      Wybrałeś — czekaj na akceptację operatora…
    </div>
  `;
}
function closeChoosePopup(){ chooseBackdrop.classList.remove('show'); }
function disableChooseGrid(){
  Array.from(chooseGrid.children).forEach(x => x.style.pointerEvents = 'none');
}

/* ====== HELPERS ====== */
function setStatus(t){ statusEl.textContent = t; }
function lockKnow(lock){
  btnKnow.disabled = !!lock;
  btnKnow.classList.toggle('locked', !!lock); // CSS dopisuje kłódkę itp.
}
function setKnowLabel(t){
  const span = btnKnow.querySelector('span');
  if (span) span.textContent = t; else btnKnow.textContent = t;
}
function escapeHtml(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
