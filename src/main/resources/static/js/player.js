// /js/player.js (fixed) — blokada buzzera poza fazą BUZZING + solidny UX
import { connect } from '/js/ws.js';

/* ===================== DOM ===================== */
const form       = document.getElementById('joinForm');
const seatInput  = document.getElementById('seat');
const nameInput  = document.getElementById('name');
const genderBox  = document.getElementById('gender');
const joinBtn    = document.getElementById('joinBtn');

const joinCard   = document.getElementById('joinCard');
const gameCard   = document.getElementById('gameCard');

const phasePill  = document.getElementById('phasePill');
const avImg      = document.getElementById('av');
const seatBadge  = document.getElementById('seatBadge');
const nameBadge  = document.getElementById('nameBadge');

const livesEl    = document.getElementById('lives');
const scoreEl    = document.getElementById('score');
const statusEl   = document.getElementById('status');

const btnKnow    = document.getElementById('btnKnow');

const outOverlay = document.getElementById('outOverlay');
const outStats   = document.getElementById('outStats');

const chooseBackdrop = document.getElementById('chooseBackdrop');
const chooseGrid     = document.getElementById('chooseGrid');

/* ===================== STAN ===================== */
let state = null;
let mySeat = null;
let myGender = 'MALE';
let myLives = 3, myScore = 0, answeredTotal = 0, correctTotal = 0;
let pendingBuzz = false;

if (outOverlay) outOverlay.style.display = 'none';
if (btnKnow) { btnKnow.disabled = true; btnKnow.classList.add('locked'); }

/* =================== ROLE BADGE ================= */
function ensureRoleBadge(){
  if (document.getElementById('roleBadge')) return;
  const host = gameCard || document.body;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const el = document.createElement('div');
  el.id = 'roleBadge';
  el.className = 'role-badge';
  host.appendChild(el);
}
ensureRoleBadge();
function showRole(text, kind='info'){
  const el = document.getElementById('roleBadge'); if (!el) return;
  el.textContent = text;
  el.className = 'role-badge show ' + kind;
}
function hideRole(){ const el = document.getElementById('roleBadge'); if (el) el.className='role-badge'; }

/* =================== TOAST (UX) ================= */
let toastEl = null;
function ensureToast(){
  if (toastEl) return toastEl;
  toastEl = document.createElement('div');
  toastEl.id = 'playerToast';
  toastEl.innerHTML = `<span id="playerToastText"></span>`;
  document.body.appendChild(toastEl);
  const css = document.createElement('style');
  css.textContent = `#playerToast{position:fixed;top:-80px;left:50%;transform:translateX(-50%);background:#111a2c;border:1px solid #233452;color:#eaf2ff;padding:10px 14px;border-radius:14px;box-shadow:0 12px 50px rgba(0,0,0,.55);font-weight:800;z-index:50;transition:transform .5s,opacity .35s;opacity:0}#playerToast.show{transform:translate(-50%,20px);opacity:1}#playerToast.ok{background:#0f2d1c;border-color:#1e4730;color:#d6ffe9}#playerToast.bad{background:#2e1518;border-color:#5a2b33;color:#ffd6db}`;
  document.head.appendChild(css);
  return toastEl;
}
function showToast(text, kind='info'){ const el=ensureToast(); document.getElementById('playerToastText').textContent=text; el.className=''; el.classList.add(kind); requestAnimationFrame(()=> el.classList.add('show')); setTimeout(()=> el.classList.remove('show'), 1600); }

/* ======= wybór płci (kafelki) ======= */
if (genderBox){
  genderBox.addEventListener('click',(e)=>{
    const tile=e.target.closest('.gopt'); if(!tile) return;
    genderBox.querySelectorAll('.gopt.selected').forEach(x=>x.classList.remove('selected'));
    tile.classList.add('selected'); myGender=(tile.dataset.val||'MALE').toUpperCase();
  },{passive:true});
}

/* ===================== WS BUS ===================== */
const bus = connect({
  onState: s => {
    state = s;
    if (!mySeat && outOverlay) outOverlay.style.display='none';

    // blokuj buzzer we WSZYSTKICH fazach poza BUZZING
    const canBuzz = s.phase === 'BUZZING' && !document.body.classList.contains('me-banned');
    lockKnow(!canBuzz);

    if (phasePill) phasePill.textContent = `Faza: ${s.phase}`;

    if (mySeat){
      const me = s.players?.find(p => p.id === mySeat);
      if (me){
        nameBadge && (nameBadge.textContent = me.name || '');
        seatBadge && (seatBadge.textContent = `Stanowisko ${me.id}`);
        avImg && (avImg.src = (me.gender==='FEMALE')?'/img/female.png':'/img/male.png');

        if (typeof me.lives==='number' && me.lives!==myLives){ myLives=me.lives; livesEl&&(livesEl.textContent=myLives); }
        if (typeof me.score==='number' && me.score!==myScore){ myScore=me.score; scoreEl&&(scoreEl.textContent=myScore); }

        if (mySeat && me.eliminated){
          outOverlay && (outOverlay.style.display='block');
          outStats && (outStats.textContent = `Wynik: ${myScore} pkt • Poprawne: ${correctTotal}/${answeredTotal}`);
          btnKnow && (btnKnow.disabled = true);
        }
      }
    }

    // statusy
    switch(s.phase){
      case 'IDLE':
        setStatus('Czekamy na rozpoczęcie…');
        break;
      case 'READING': {
        const meAns = s.answeringId === mySeat;
        setStatus(meAns ? 'Twoje pytanie — słuchaj!' : 'Prowadzący czyta pytanie…');
        break;
      }
      case 'COOLDOWN':
        setStatus('Chwila przerwy…');
        break;
      case 'BUZZING':
        setStatus('Kliknij „Znam odpowiedź!”, jeśli znasz!');
        break;
      case 'ANSWERING': {
        const meAns = s.answeringId === mySeat;
        if (meAns){ answeredTotal++; showRole('Odpowiadasz','ok'); }
        else hideRole();
        setStatus(meAns ? 'ODPOWIADASZ — masz 10 sekund!' : 'Ktoś inny odpowiada…');
        break;
      }
      case 'SELECTING':
        setStatus('Zwycięzca wybiera przeciwnika…');
        break;
    }
  },
  onEvent: ev => {
    if (ev?.type === 'SELECT_START' && ev.playerId === mySeat) openChoosePopup();
    if (ev?.type === 'TARGET_ACCEPTED' || ev?.type === 'TARGET_REJECTED') closeChoosePopup();
    if (ev?.type === 'JUDGE' && ev.playerId === mySeat){
      if (ev.value === 'CORRECT') { correctTotal++; showToast('✓ DOBRA', 'ok'); }
      else { showToast('✗ ZŁA', 'bad'); }
    }
    if (ev?.type === 'BUZZ_BAN' && ev.playerId === mySeat){
      document.body.classList.add('me-banned'); lockKnow(true);
    }
    if (ev?.type === 'ROUND_WINNER' && ev.playerId === mySeat){
      showRole('Masz pierwszeństwo','ok');
    }
  },
  onTimer: () => {}
});

/* ================== DOŁĄCZANIE ================== */
function getGender(){
  const sel = genderBox?.querySelector('.gopt.selected');
  if (sel?.dataset?.val) return sel.dataset.val.toUpperCase();
  const radio = document.querySelector('input[name="gender"]:checked');
  if (radio) return (radio.value||'MALE').toUpperCase();
  return myGender;
}

function validateAndJoin(e){
  if (e) e.preventDefault();
  const seat = Number((seatInput?.value || '').trim());
  const name = (nameInput?.value || '').trim();
  const gender = getGender();
  if (!seat || seat<1 || seat>10){ bump(seatInput); showToast('Stanowisko 1–10','bad'); return; }
  if (!name){ bump(nameInput); showToast('Podaj imię i nazwisko','bad'); return; }

  mySeat = seat; myGender = gender;
  nameBadge && (nameBadge.textContent = name);
  seatBadge && (seatBadge.textContent = `Stanowisko ${seat}`);
  avImg && (avImg.src = gender==='FEMALE' ? '/img/female.png' : '/img/male.png');

  bus.send('/app/setName',   { playerId: seat, name });
  bus.send('/app/setGender', { playerId: seat, gender });

  if (joinCard) joinCard.classList.add('hide');
  if (gameCard) gameCard.classList.add('show');

  // Do momentu BUZZING — buzzer zablokowany
  lockKnow(true);
}
form?.addEventListener('submit', validateAndJoin);
joinBtn?.addEventListener('click', validateAndJoin);

/* ================== BUZZER ================== */
btnKnow?.addEventListener('click', () => {
  if (!mySeat) return;
  if (state?.phase !== 'BUZZING'){
    showToast('Jeszcze nie można się zgłaszać','bad');
    return;
  }
  if (document.body.classList.contains('me-banned')){
    showToast('Nie możesz w tej rundzie','bad'); return;
  }
  bus.send('/app/roundBuzz', { playerId: mySeat });
  pendingBuzz = true; btnKnow.disabled = true; setKnowLabel('Zgłaszam…');
});

/* =========== POPUP WYBORU PRZECIWNIKA =========== */
function openChoosePopup(){
  if (!chooseGrid || !chooseBackdrop || !state) return;
  chooseGrid.innerHTML='';

  const self = document.createElement('button');
  self.className='item';
  self.innerHTML=`<div class="title">Wezmę pytanie na siebie</div><div class="mini">Stanowisko ${mySeat}</div>`;
  self.onclick=()=> submitProposal(mySeat);
  chooseGrid.appendChild(self);

  state.players.filter(p=>!p.eliminated && p.id!==mySeat && (p.name||'').trim().length>0)
    .forEach(p=>{
      const b=document.createElement('button');
      b.className='item';
      b.innerHTML=`<div class="title">${p.id}. ${escapeHtml(p.name||'')}</div><div class="mini">${p.gender==='FEMALE'?'Kobieta':'Mężczyzna'}</div>`;
      b.onclick=()=> submitProposal(p.id);
      chooseGrid.appendChild(b);
    });
  chooseBackdrop.classList.add('show');
}
function submitProposal(toId){
  disableChooseGrid();
  bus.send('/app/proposeTarget', { fromId: mySeat, toId });
  chooseGrid.innerHTML = `<div class="item wait">Wybrałeś — czekaj na akceptację…</div>`;
}
function closeChoosePopup(){ chooseBackdrop?.classList.remove('show'); }
function disableChooseGrid(){ if (!chooseGrid) return; Array.from(chooseGrid.children).forEach(x=>x.disabled=true); }

/* =================== HELPERS =================== */
function setStatus(t){ statusEl && (statusEl.textContent = t || ''); }
function lockKnow(lock){ if (!btnKnow) return; btnKnow.disabled=!!lock; btnKnow.classList.toggle('locked',!!lock); }
function setKnowLabel(t){ if (!btnKnow) return; const span=btnKnow.querySelector('span'); if (span) span.textContent=t; else btnKnow.textContent=t; }
function bump(el){ if(!el) return; el.classList.add('bump'); setTimeout(()=>el.classList.remove('bump'),400); el.focus(); }
function escapeHtml(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
