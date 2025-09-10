// /js/display.js — SAFE MODE z animacją 3-2-1 (lokalny rAF) i strażnikami

import { connect } from '/js/ws.js';

(function start() {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

function init() {
  /* ====================== DOM ====================== */
  const gridWrap = byId('gridWrap');
  const grid     = byId('grid');
  const banner   = byId('banner');
  const pb       = byId('pb');

  const stage      = byId('stage');
  const stageName  = byId('stageName');
  const stageAv    = byId('stageAv');
  const stageSeat  = byId('stageSeat');
  const stagePb    = byId('stagePb');
  const stageJudge = byId('stageJudge');

  // Jeżeli kluczowe elementy nie istnieją — nie uruchamiaj
  if (!grid || !banner || !pb || !stage || !stageName || !stageAv || !stageSeat || !stagePb || !stageJudge) {
    console.error('[display] Brak wymaganych elementów DOM. Sprawdź display.html (id: gridWrap, grid, banner, pb, stage*).');
    return;
  }

  /* ===================== AUDIO ===================== */
  const sounds = {
    INTRO:  byId('sndIntro'),
    GOOD:   byId('sndGood'),
    WRONG:  byId('sndWrong'),
    BOOM:   byId('sndBoom'),
    START_Q:null
  };

  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
  }
  function beep(freq=880, ms=120){
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms/1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(t0 + ms/1000 + 0.02);
  }

  const unlockBtn = byId('unlock');
  unlockBtn?.addEventListener('click', async () => {
    try { await sounds.INTRO?.play(); sounds.INTRO.pause(); sounds.INTRO.currentTime = 0; } catch {}
    try { await sounds.BOOM?.play();  sounds.BOOM.pause();  sounds.BOOM.currentTime  = 0; } catch {}
    ensureAudio();
    alert('Dźwięk odblokowany.');
  });

  /* ===================== STAN ====================== */
  let state = null;
  const TOTAL_ANS_MS = 10_000;
  const COOLDOWN_MS  = 3_000;

  const lastScores = new Map();
  const lastLives  = new Map();

  /* ===== Lokalny cooldown + animacje ===== */
  let cooldownActive     = false;
  let cdEndAt            = 0;        // performance.now() + ms
  let cdRaf              = null;     // requestAnimationFrame id
  let cooldownFallback   = null;
  let prevSec            = null;

  // Overlay cooldown
  let cd = byId('cd');
  if (!cd){
    cd = document.createElement('div');
    cd.id = 'cd';
    cd.style.cssText = `
      position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index:25;
      pointer-events:none;
      background:radial-gradient(ellipse at center, rgba(0,0,0,.55), rgba(0,0,0,.85));
      backdrop-filter: blur(1px);
    `;
    cd.innerHTML = `
      <div id="cdFlash" style="position:absolute; inset:0; background:rgba(255,255,255,0); pointer-events:none;"></div>
      <div id="cdRing" style="
        width:min(32vmin, 280px); height:min(32vmin, 280px); border-radius:50%;
        background:conic-gradient(var(--accent, #4ea1ff) 0%, transparent 0%);
        display:grid; place-items:center;
        box-shadow: 0 0 0 0 rgba(33,150,243,0.0);
      ">
        <div style="
          width:86%; height:86%; border-radius:50%;
          background:rgba(5,10,20,.85); border:1px solid #20304b;
          display:grid; place-items:center; position:relative; overflow:hidden;">
          <div id="cdNum" style="font-size:min(18vmin, 150px); line-height:1; font-weight:900; letter-spacing:.02em;
            color:#eaf2ff; text-shadow:0 10px 35px rgba(0,0,0,.55), 0 0 20px rgba(80,140,255,.25);
            transform:scale(1); opacity:.98;">3</div>
        </div>
      </div>
    `;
    document.body.appendChild(cd);
  }
  const cdRing  = cd.querySelector('#cdRing');
  const cdNum   = cd.querySelector('#cdNum');
  const cdFlash = cd.querySelector('#cdFlash');

  injectCss(`
    @keyframes cdNumPop { 0%{transform:scale(1.25);opacity:0} 20%{opacity:1} 100%{transform:scale(1);opacity:.98} }
    @keyframes cdRingPulse { 0%{box-shadow:0 0 0 0 rgba(80,140,255,.55)} 100%{box-shadow:0 0 0 22px rgba(80,140,255,0)} }
    @keyframes cdFlash { 0%{background:rgba(255,255,255,.22)} 100%{background:rgba(255,255,255,0)} }
    @keyframes shockwave { 0%{transform:scale(.4);opacity:.35;filter:blur(0)} 100%{transform:scale(2.2);opacity:0;filter:blur(2px)} }
    @keyframes shake { 0%,100%{transform:translate3d(0,0,0)} 25%{transform:translate3d(-2px,1px,0)} 50%{transform:translate3d(2px,-1px,0)} 75%{transform:translate3d(-1px,2px,0)} }
    .cd-shake { animation: shake .28s ease-in-out; }
  `);

  /* ================= WEBSOCKET BUS ================= */
  let bus;
  try {
    bus = connect({
      onState: s => { state = s; render(); },
      onEvent: ev => handleEvent(ev),
      onTimer: t => handleTimer(t),
    });
  } catch (e) {
    console.error('[display] Błąd połączenia WS:', e);
    return;
  }

  sounds.INTRO?.addEventListener('ended', () => { try { bus.send('/app/introDone', {}); } catch(e) {} });
  sounds.BOOM ?.addEventListener('ended',  () => { try { bus.send('/app/boomDone',  {}); } catch(e) {} });

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
      startLocalCooldown(COOLDOWN_MS);
    } else if (st.phase === 'BUZZING') {
      stopLocalCooldown(true);
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

  /* ================== STAGE ================== */
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

  /* ================== EVENTS ================== */
  function handleEvent(ev){
    if (ev.type === 'JUDGE') {
      const el = byId('judge-'+ev.playerId);
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
        startLocalCooldown(COOLDOWN_MS);
      } else if (ev.value === 'READING') {
        stopLocalCooldown(true);
        showBanner('Prowadzący czyta pytanie…');
      } else if (ev.value === 'BUZZING') {
        stopLocalCooldown(true);
        showBanner('Gracze mogą się zgłaszać — „Znam odpowiedź!”');
      }
    }
  }

  /* ================= TIMER ================= */
  function handleTimer(t){
    const ms = t?.remainingMs ?? 0, active = !!t?.active;

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

    // Delikatna synchronizacja lokalnego cooldownu do backendu
    if (cooldownActive && state?.phase === 'COOLDOWN' && Number.isFinite(ms)){
      const now = performance.now();
      const targetEnd = now + Math.max(0, Math.min(COOLDOWN_MS, ms));
      if (Math.abs(targetEnd - cdEndAt) > 80) cdEndAt = targetEnd;
    }
  }

  /* ====== Lokalny cooldown – animacja ====== */
  function startLocalCooldown(ms){
    ensureAudio();
    cooldownActive = true;
    prevSec = null;
    banner.classList.remove('show');
    cd.style.display = 'flex';
    cdEndAt = performance.now() + (ms ?? COOLDOWN_MS);

    clearTimeout(cooldownFallback);
    cooldownFallback = setTimeout(() => {
      if (!cooldownActive) return;
      stopLocalCooldown(false);
      showBanner('Gracze mogą się zgłaszać — „Znam odpowiedź!”');
    }, (ms ?? COOLDOWN_MS) + 300);

    if (cdRaf) cancelAnimationFrame(cdRaf);
    const step = () => {
      if (!cooldownActive) return;
      const now = performance.now();
      const left = Math.max(0, cdEndAt - now);
      const sec  = Math.max(1, Math.ceil(left/1000));

      if (sec !== prevSec){
        prevSec = sec;
        cdNum.textContent = String(sec);
        playNumFx(sec);
      }

      const prog = 100 - Math.round((left/(COOLDOWN_MS))*100);
      cdRing.style.background = `conic-gradient(var(--accent, #4ea1ff) ${prog}%, transparent ${prog}%)`;

      if (left > 0) {
        cdRaf = requestAnimationFrame(step);
      } else {
        stopLocalCooldown(false);
        showBanner('Gracze mogą się zgłaszać — „Znam odpowiedź!”');
      }
    };
    step();
  }

  function stopLocalCooldown(hideBannerToo){
    cooldownActive = false;
    if (cdRaf) { cancelAnimationFrame(cdRaf); cdRaf = null; }
    clearTimeout(cooldownFallback);
    cd.style.display = 'none';
    if (hideBannerToo) banner.classList.remove('show');
  }

  function playNumFx(sec){
    // cyfrowy „pop”
    cdNum.style.animation = 'none'; cdNum.offsetHeight;
    cdNum.style.animation = 'cdNumPop .28s ease-out';
    // puls pierścienia
    cdRing.style.animation = 'none'; cdRing.offsetHeight;
    cdRing.style.animation = 'cdRingPulse .45s ease-out';
    // flash
    cdFlash.style.animation = 'none'; cdFlash.offsetHeight;
    cdFlash.style.animation = 'cdFlash 180ms ease-out';
    // shockwave
    const shock = document.createElement('div');
    shock.style.cssText = `
      position:absolute; inset:0; margin:auto; width:min(32vmin, 280px); height:min(32vmin, 280px);
      border-radius:50%; border:2px solid rgba(120,180,255,.45);
      animation: shockwave .5s ease-out forwards;
    `;
    cd.appendChild(shock);
    setTimeout(()=> shock.remove(), 520);
    // beep i shake
    const base = 720, stepHz = 90;
    beep(base + (3-sec)*stepHz, 120);
    if (sec === 1) {
      cdRing.classList.add('cd-shake');
      setTimeout(()=> cdRing.classList.remove('cd-shake'), 300);
    }
  }

  /* =================== HELPERS ==================== */
  function byId(id){ return document.getElementById(id); }
  function play(cue){ const a = sounds[cue]; if (!a) return; try { a.currentTime = 0; a.play(); } catch {} }
  function showBanner(t){ banner.textContent = t; banner.classList.add('show'); }
  function hideBanner(){ banner.classList.remove('show'); }
  function heartsHtml(l){ let s=''; for(let i=0;i<3;i++) s += `<svg class="heart ${i>=l?'dead':''}" viewBox="0 0 32 29"><path fill="#ff4757" d="M23.6 0c-2.7 0-5 1.6-7.6 4.7C13.4 1.6 11.1 0 8.4 0 3.8 0 0 3.7 0 8.2 0 16.1 15.9 29 16 29s16-12.9 16-20.8C32 3.7 28.2 0 23.6 0z"/></svg>`; return s; }
  function escapeHtml(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
  function injectCss(css){
    let st = document.getElementById('cd-anim-style');
    if (!st){ st = document.createElement('style'); st.id='cd-anim-style'; document.head.appendChild(st); }
    st.textContent = css;
  }
}
