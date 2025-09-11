// /js/display.js (fixed) — modal odblokowania dźwięku + fallback ack dla INTRO/BOOM
import { connect } from '/js/ws.js';

const banner = document.getElementById('banner');
const pb     = document.getElementById('pb');

const sounds = {
  INTRO:  document.getElementById('sndIntro'),
  GOOD:   document.getElementById('sndGood'),
  WRONG:  document.getElementById('sndWrong'),
  BOOM:   document.getElementById('sndBoom'),
};

let audioUnlocked = false;
let state = null;
const TOTAL = 10_000;

/* ====== Unlock modal ====== */
ensureUnlockModal();
function ensureUnlockModal(){
  if (document.getElementById('unlockModal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'unlockModal';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:200';
  wrap.innerHTML = `
    <div style="background:#111a2c;border:1px solid #23324d;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6);width:min(460px,92vw);padding:18px;text-align:center">
      <h2 style="margin:0 0 8px;color:#eaf2ff">Odblokuj dźwięk</h2>
      <p style="margin:0 0 14px;color:#9cb2d9">Aby słyszeć intro i sygnały gry, kliknij „Odblokuj”.</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="unlockYes" style="padding:10px 14px;border-radius:12px;border:0;background:#3b6df6;color:#fff;font-weight:800">Odblokuj</button>
        <button id="unlockNo"  style="padding:10px 14px;border-radius:12px;border:1px solid #23324d;background:#0d1526;color:#eaf2ff;font-weight:800">Później</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById('unlockYes').addEventListener('click', async ()=>{
    try { await sounds.INTRO?.play(); sounds.INTRO.pause(); sounds.INTRO.currentTime=0; } catch {}
    try { await sounds.BOOM?.play();  sounds.BOOM.pause();  sounds.BOOM.currentTime=0; } catch {}
    audioUnlocked = true;
    wrap.remove();
  });
  document.getElementById('unlockNo').addEventListener('click', ()=>{ audioUnlocked = false; wrap.remove(); });
}

/* ====== BUS ====== */
const bus = connect({
  onState: s => { state = s; render(); },
  onEvent: ev => handleEvent(ev),
  onTimer: t => handleTimer(t),
});

/* ====== RENDER ====== */
function render(){
  const st = state; if (!st) return;
  if (st.phase === 'READING') showBanner('Prowadzący czyta pytanie…');
  else if (st.phase === 'BUZZING') showBanner('Gracze mogą się zgłaszać — „Znam odpowiedź!”');
  else if (st.phase === 'ANSWERING') hideBanner();
  else if (st.phase === 'COOLDOWN') hideBanner();
  else if (st.phase === 'IDLE') showBanner('Czekamy na rozpoczęcie…');
}

/* ====== EVENTS ====== */
function handleEvent(ev){
  if (!ev) return;
  if (ev.type === 'CUE'){
    if (ev.value === 'START_Q') showBanner('Prowadzący czyta pytanie…');
    if (ev.value === 'BOOM')     showBanner('Cisza — wybór / przygotowanie…');
    playCue(ev.value);
  }
}

async function playCue(cue){
  const a = sounds[cue]; if (!a) return;
  try {
    if (!audioUnlocked){
      // spróbuj i tak — może desktop pozwoli
      await a.play();
      await a.pause(); a.currentTime = 0;
    }
    a.currentTime = 0;
    await a.play();
  } catch(e){
    // brak gestu użytkownika – fallback, żeby host nie utknął
    if (cue === 'INTRO') setTimeout(()=>{ try{ bus.send('/app/introDone', {});}catch{} }, 600);
    if (cue === 'BOOM')  setTimeout(()=>{ try{ bus.send('/app/boomDone',  {});}catch{} }, 400);
    return;
  }

  // po zagraniu sygnału — wyślij done
  a.onended = () => {
    if (cue === 'INTRO') { try{ bus.send('/app/introDone', {});}catch{} }
    if (cue === 'BOOM')  { try{ bus.send('/app/boomDone',  {});}catch{} }
  };
}

/* ====== TIMER ====== */
function handleTimer(t){
  if (state?.phase !== 'ANSWERING'){ if (pb) pb.style.width='0%'; return; }
  const ms = t.remainingMs||0, active = !!t.active;
  const pct = Math.max(0, Math.min(1, (TOTAL - ms)/TOTAL));
  if (pb){
    pb.style.width = (pct*100).toFixed(1)+'%';
    pb.style.background = active ? 'var(--ok)' : (ms===0 ? 'var(--bad)' : 'var(--ok)');
  }
}

/* ====== UI helpers ====== */
function showBanner(t){ if (!banner) return; banner.textContent = t; banner.classList.add('show'); }
function hideBanner(){ if (!banner) return; banner.classList.remove('show'); }
