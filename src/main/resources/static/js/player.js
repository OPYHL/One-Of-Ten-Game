import { connect } from '/js/ws.js';
import { loadInitialData, getAnswerTimerMs, setAnswerTimerMs } from '/js/dataStore.js';
import { getAvatarImage, getAvatarLabel, resolveAvatarImage, listAvatarOptions, isCustomAvatar } from '/js/avatarCatalog.js';

const AVATAR_PLACEHOLDER = '/img/avatar-placeholder.svg';
const CUSTOM_AVATAR_CARD_KEY = 'custom-photo';
const CUSTOM_AVATAR_SIZE = 384;

/* ====== DOM ====== */
const qs = new URLSearchParams(location.search);
const slotInput = document.getElementById('slot'); if (qs.get('slot')) slotInput.value = qs.get('slot');
const nameInput = document.getElementById('name');
const genderSel = document.getElementById('gender');
const btnNext1  = document.getElementById('next1');
const btnNext2  = document.getElementById('next2');
const btnNext3  = document.getElementById('next3');
const btnJoin   = document.getElementById('join');
const btnKnow   = document.getElementById('know');

const seatButtons = Array.from(document.querySelectorAll('[data-seat]'));
const seatViewport = document.getElementById('seatViewport');
const seatTrack = document.getElementById('seatTrack');
const seatPrev = document.getElementById('seatPrev');
const seatNext = document.getElementById('seatNext');
const genderCards = Array.from(document.querySelectorAll('[data-gender]'));
const avatarGrid = document.getElementById('avatarGrid');
let avatarCards = [];
const cameraModal = document.getElementById('cameraModal');
const cameraDialog = cameraModal ? cameraModal.querySelector('.cameraDialog') : null;
const cameraVideo = document.getElementById('cameraVideo');
const cameraPreviewCanvas = document.getElementById('cameraPreview');
const cameraStatus = document.getElementById('cameraStatus');
const cameraCaptureBtn = document.getElementById('cameraCapture');
const cameraRetakeBtn = document.getElementById('cameraRetake');
const cameraUseBtn = document.getElementById('cameraUse');
const cameraCloseBtn = document.getElementById('cameraClose');
const backButtons = Array.from(document.querySelectorAll('[data-back-step]'));

genderCards.forEach(card => card.setAttribute('aria-pressed', 'false'));

const seatHint = document.getElementById('seatHint');
const nameHint = document.getElementById('nameHint');
const genderHint = document.getElementById('genderHint');
const avatarHint = document.getElementById('avatarHint');
const summarySeat = document.getElementById('summarySeat');
const summaryName = document.getElementById('summaryName');
const summaryGender = document.getElementById('summaryGender');
const summaryAvatar = document.getElementById('summaryAvatar');
const avatarPreview = document.getElementById('avatarPreview');
const avatarPreviewImg = document.getElementById('avatarPreviewImg');

const stepOrder = ['stepSeat','stepName','stepGender','stepAvatar','stepGame'];
let currentStep = 'stepSeat';

const livesEl   = document.getElementById('lives');
const scoreEl   = document.getElementById('score');
const statusEl  = document.getElementById('status');
const seatEl    = document.getElementById('seat');
const phaseEl   = document.getElementById('phase');
const avImg     = document.getElementById('av');
const pb        = document.getElementById('pb');
const playerBarEl = pb ? pb.parentElement : null;
const questionWrap = document.getElementById('questionWrap');
const questionTextEl = document.getElementById('questionText');
const avatarFx  = document.getElementById('avatarFx');
const avatarFxResult = document.getElementById('avatarFxResult');
const avatarFxResultIcon = document.getElementById('avatarFxResultIcon');

const outOverlay = document.getElementById('outOverlay');
const outStats   = document.getElementById('outStats');
const outPlace   = document.getElementById('outPlace');

/* Modal wyboru */
const chooseBackdrop = document.getElementById('chooseBackdrop');
const chooseGrid     = document.getElementById('chooseGrid');

/* ====== LOCAL STATE ====== */
let myId = null, myGender = genderSel?.value || '', phase = 'IDLE';
let myLives = 3, myScore = 0, answeredTotal = 0, correctTotal = 0;
let lastState = null;
let totalAnswerMs = 10000;
let latestTimerRemainingMs = 0;
let resultHideTimer = null;
let clockActive = false;
let iAmOut = false;

let selectedSeat = slotInput?.value ? parseInt(slotInput.value, 10) || null : null;
let focusedSeatIndex = (() => {
  if (!seatButtons.length) return 0;
  if (Number.isInteger(selectedSeat)){
    const idx = seatButtons.findIndex(btn => parseInt(btn.dataset.seat, 10) === selectedSeat);
    if (idx >= 0) return idx;
  }
  return 0;
})();
let selectedAvatarKey = null;
let selectedAvatarCardKey = null;
let selectedAvatarImage = null;
let selectedAvatarLabel = '';
let seatTrackOffset = 0;
let customAvatarDataUrl = null;
let customAvatarLabel = 'Moje zdjęcie';
let cameraStream = null;
let cameraModalOpen = false;
let cameraHasCapture = false;
let cameraProcessing = false;
let cameraCaptureDataUrl = null;
let cameraReady = false;
let selfieSegmentationInstance = null;
let selfieSegmentationPromise = null;
const loadedScripts = new Map();
let cameraKeydownHandler = null;

function normalizeGender(value){
  return (value || '').toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE';
}

function loadScriptOnce(url){
  if (loadedScripts.has(url)) return loadedScripts.get(url);
  const promise = new Promise((resolve, reject) => {
    const existing = Array.from(document.getElementsByTagName('script')).find(s => s.src === url);
    if (existing && existing.dataset.loaded === 'true'){
      resolve();
      return;
    }
    const script = existing || document.createElement('script');
    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
    function onLoad(){
      cleanup();
      script.dataset.loaded = 'true';
      resolve();
    }
    function onError(){
      cleanup();
      reject(new Error('Nie udało się wczytać biblioteki: ' + url));
    }
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    if (!existing){
      script.async = true;
      script.src = url;
      document.head.appendChild(script);
    }
  });
  loadedScripts.set(url, promise);
  promise.catch(() => loadedScripts.delete(url));
  return promise;
}

async function ensureSelfieSegmentation(){
  if (selfieSegmentationInstance) return selfieSegmentationInstance;
  if (!selfieSegmentationPromise){
    selfieSegmentationPromise = (async () => {
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js');
      const SelfieSegmentationCtor = window.SelfieSegmentation?.SelfieSegmentation || window.SelfieSegmentation;
      if (typeof SelfieSegmentationCtor !== 'function'){
        throw new Error('Biblioteka SelfieSegmentation nie jest dostępna');
      }
      const instance = new SelfieSegmentationCtor({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });
      instance.setOptions({ modelSelection: 1 });
      if (typeof instance.initialize === 'function'){
        await instance.initialize();
      }
      selfieSegmentationInstance = instance;
      return instance;
    })();
    selfieSegmentationPromise.catch(() => {
      selfieSegmentationInstance = null;
      selfieSegmentationPromise = null;
    });
  }
  return selfieSegmentationPromise;
}

async function segmentCameraImage(videoEl){
  const segmenter = await ensureSelfieSegmentation();
  return new Promise((resolve, reject) => {
    const cleanup = () => segmenter.onResults(() => {});
    segmenter.onResults(results => {
      cleanup();
      resolve(results);
    });
    segmenter.send({ image: videoEl }).catch(err => {
      cleanup();
      reject(err);
    });
  });
}

function smoothSegmentationMask(maskPixels, width, height){
  const kernel = [
    1, 4, 7, 4, 1,
    4,16,26,16, 4,
    7,26,41,26, 7,
    4,16,26,16, 4,
    1, 4, 7, 4, 1,
  ];
  const kernelSize = 5;
  const kernelSum = 273;
  const output = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++){
    for (let x = 0; x < width; x++){
      let acc = 0;
      for (let ky = 0; ky < kernelSize; ky++){
        const sampleY = Math.min(height - 1, Math.max(0, y + ky - 2));
        for (let kx = 0; kx < kernelSize; kx++){
          const sampleX = Math.min(width - 1, Math.max(0, x + kx - 2));
          const srcIndex = (sampleY * width + sampleX) * 4;
          acc += kernel[ky * kernelSize + kx] * maskPixels[srcIndex];
        }
      }
      output[y * width + x] = Math.min(255, Math.max(0, Math.round(acc / kernelSum)));
    }
  }
  return output;
}

function featherAlpha(maskValue){
  const normalized = Math.max(0, Math.min(1, maskValue / 255));
  const expanded = Math.min(1, normalized * 1.1);
  const eased = Math.pow(expanded, 1.35);
  if (eased <= 0.28) return 0;
  if (eased >= 0.82) return 255;
  return Math.round(((eased - 0.28) / 0.54) * 255);
}

function compositeAvatarFromMask(results, videoEl){
  const width = videoEl.videoWidth || 640;
  const height = videoEl.videoHeight || 640;
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const srcCtx = sourceCanvas.getContext('2d');
  srcCtx.drawImage(videoEl, 0, 0, width, height);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');
  maskCtx.drawImage(results.segmentationMask, 0, 0, width, height);

  const maskData = maskCtx.getImageData(0, 0, width, height);
  const frame = srcCtx.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const maskPixels = maskData.data;
  const smoothedMask = smoothSegmentationMask(maskPixels, width, height);

  for (let i = 0, p = 0; i < pixels.length; i += 4, p++){
    const maskValue = smoothedMask[p];
    pixels[i + 3] = featherAlpha(maskValue);
  }
  srcCtx.putImageData(frame, 0, 0);

  const squareSize = Math.min(width, height);
  const sx = (width - squareSize) / 2;
  const sy = (height - squareSize) / 2;
  const targetSize = CUSTOM_AVATAR_SIZE;
  const output = document.createElement('canvas');
  output.width = targetSize;
  output.height = targetSize;
  const outCtx = output.getContext('2d');
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.clearRect(0, 0, targetSize, targetSize);
  outCtx.drawImage(sourceCanvas, sx, sy, squareSize, squareSize, 0, 0, targetSize, targetSize);

  return output.toDataURL('image/png');
}

function setSeatTrackPosition(target, smooth){
  if (!seatTrack || !seatViewport) return;
  const trackWidth = seatTrack.scrollWidth || seatTrack.offsetWidth || 0;
  const viewportWidth = seatViewport.clientWidth || 0;
  const maxScroll = Math.max(0, trackWidth - viewportWidth);
  const clamped = Math.max(0, Math.min(maxScroll, target));
  if (!smooth){
    seatTrack.classList.add('noTransition');
  } else {
    seatTrack.classList.remove('noTransition');
  }
  seatTrack.style.setProperty('--seat-track-offset', `${clamped}px`);
  seatTrackOffset = clamped;
  if (!smooth){
    requestAnimationFrame(() => seatTrack.classList.remove('noTransition'));
  }
}

function createAvatarCard({ cardKey, image, label, extraClasses = '', isCustom = false }){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `choiceCard avatarCard ${extraClasses}`.trim();
  btn.dataset.avatarCardKey = cardKey;
  if (!isCustom && image) btn.dataset.avatarImg = image;
  if (label && !isCustom) btn.dataset.avatarLabel = label;
  if (isCustom) btn.classList.add('hasCustomImage');
  btn.setAttribute('aria-pressed', 'false');

  const thumb = document.createElement('img');
  thumb.className = 'avatarThumb';
  thumb.loading = 'lazy';
  thumb.decoding = 'async';
  thumb.src = image || AVATAR_PLACEHOLDER;
  thumb.alt = label ? `Podgląd awatara ${label}` : 'Podgląd awatara';

  const caption = document.createElement('div');
  caption.className = 'choiceLabel';
  caption.textContent = label || 'Avatar';

  btn.appendChild(thumb);
  btn.appendChild(caption);
  btn.addEventListener('click', () => selectAvatar(cardKey));
  return btn;
}

function rebuildAvatarGrid(opts = {}){
  if (!avatarGrid) return;
  const gender = normalizeGender(opts.gender || genderSel?.value || myGender || 'MALE');
  const options = listAvatarOptions(gender);
  avatarGrid.innerHTML = '';
  avatarCards = [];

  if (customAvatarDataUrl){
    const customBtn = createAvatarCard({
      cardKey: CUSTOM_AVATAR_CARD_KEY,
      image: customAvatarDataUrl,
      label: customAvatarLabel || 'Moje zdjęcie',
      extraClasses: 'isCustom',
      isCustom: true,
    });
    avatarGrid.appendChild(customBtn);
    avatarCards.push(customBtn);
  }

  options.forEach(option => {
    const card = createAvatarCard({
      cardKey: option.key,
      image: option.image,
      label: option.label,
    });
    avatarGrid.appendChild(card);
    avatarCards.push(card);
  });

  const cameraCard = document.createElement('button');
  cameraCard.type = 'button';
  cameraCard.className = 'choiceCard avatarCard avatarCameraCard';
  cameraCard.setAttribute('aria-pressed', 'false');
  cameraCard.innerHTML = `
    <div class="avatarCameraIcon" aria-hidden="true"></div>
    <div class="choiceLabel">Zrób zdjęcie</div>
  `;
  cameraCard.addEventListener('click', openCameraModal);
  avatarGrid.appendChild(cameraCard);

  const stillAvailable = avatarCards.some(card => card.dataset.avatarCardKey === selectedAvatarCardKey);
  if (selectedAvatarCardKey && stillAvailable){
    selectAvatar(selectedAvatarCardKey);
  } else if (!stillAvailable){
    selectedAvatarCardKey = null;
    selectedAvatarKey = null;
    selectedAvatarImage = null;
    selectedAvatarLabel = '';
    avatarCards.forEach(card => {
      card.classList.remove('selected');
      card.setAttribute('aria-pressed', 'false');
    });
    updateAvatarPreview();
    updateAvatarHint();
    updateSummary();
    updateStepButtons();
  }
}

function setCameraStatus(text){
  if (cameraStatus) cameraStatus.textContent = text || '';
}

function updateCameraControls(){
  if (cameraCaptureBtn) cameraCaptureBtn.disabled = !cameraReady || cameraProcessing;
  if (cameraRetakeBtn) cameraRetakeBtn.disabled = !cameraHasCapture || cameraProcessing;
  if (cameraUseBtn) cameraUseBtn.disabled = !cameraHasCapture || cameraProcessing;
}

function resetCameraPreview(){
  cameraHasCapture = false;
  cameraCaptureDataUrl = null;
  if (cameraPreviewCanvas){
    const ctx = cameraPreviewCanvas.getContext('2d');
    if (ctx){
      ctx.clearRect(0, 0, cameraPreviewCanvas.width || 0, cameraPreviewCanvas.height || 0);
    }
    cameraPreviewCanvas.hidden = true;
  }
  if (cameraVideo){
    cameraVideo.hidden = false;
  }
}

function focusCameraCard(){
  const card = avatarGrid?.querySelector('.avatarCameraCard');
  if (card && typeof card.focus === 'function') card.focus();
}

async function startCamera(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    cameraReady = false;
    setCameraStatus('Twoje urządzenie nie pozwala na użycie aparatu w przeglądarce.');
    updateCameraControls();
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (cameraVideo){
      cameraVideo.srcObject = cameraStream;
      cameraVideo.playsInline = true;
      cameraVideo.muted = true;
      await cameraVideo.play().catch(()=>{});
      cameraVideo.hidden = false;
    }
    cameraReady = true;
    setCameraStatus('Ustaw się w kadrze i kliknij „Zrób zdjęcie”.');
  } catch (err) {
    console.warn('Nie udało się włączyć aparatu', err);
    cameraReady = false;
    setCameraStatus('Nie udało się włączyć aparatu. Sprawdź uprawnienia.');
    stopCamera();
  }
  updateCameraControls();
}

function stopCamera(){
  if (cameraStream){
    cameraStream.getTracks().forEach(track => track.stop());
  }
  cameraStream = null;
  cameraReady = false;
  if (cameraVideo){
    cameraVideo.srcObject = null;
    if (typeof cameraVideo.pause === 'function') cameraVideo.pause();
  }
  updateCameraControls();
}

function prepareCameraPreview(dataUrl){
  if (!cameraPreviewCanvas) return;
  cameraPreviewCanvas.width = CUSTOM_AVATAR_SIZE;
  cameraPreviewCanvas.height = CUSTOM_AVATAR_SIZE;
  const ctx = cameraPreviewCanvas.getContext('2d');
  if (ctx){
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, cameraPreviewCanvas.width, cameraPreviewCanvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, cameraPreviewCanvas.width, cameraPreviewCanvas.height);
    };
    img.src = dataUrl;
  }
  cameraPreviewCanvas.hidden = false;
  if (cameraVideo) cameraVideo.hidden = true;
}

async function openCameraModal(){
  if (!cameraModal || cameraModalOpen) return;
  cameraModalOpen = true;
  document.body.classList.add('camera-open');
  cameraModal.classList.add('show');
  cameraModal.removeAttribute('aria-hidden');
  resetCameraPreview();
  cameraProcessing = false;
  updateCameraControls();
  setCameraStatus('Łączenie z aparatem…');
  await startCamera();
  if (!cameraKeydownHandler){
    cameraKeydownHandler = ev => {
      if (ev.key === 'Escape'){
        ev.preventDefault();
        closeCameraModal();
        focusCameraCard();
      }
    };
  }
  document.addEventListener('keydown', cameraKeydownHandler);
  setTimeout(() => cameraCaptureBtn?.focus(), 80);
}

function closeCameraModal(){
  if (!cameraModalOpen) return;
  cameraModalOpen = false;
  stopCamera();
  resetCameraPreview();
  cameraProcessing = false;
  cameraHasCapture = false;
  updateCameraControls();
  setCameraStatus('');
  if (cameraModal){
    cameraModal.classList.remove('show');
    cameraModal.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('camera-open');
  if (cameraKeydownHandler){
    document.removeEventListener('keydown', cameraKeydownHandler);
  }
}

async function captureCameraPhoto(){
  if (!cameraModalOpen || cameraProcessing) return;
  if (!cameraVideo || !cameraReady){
    setCameraStatus('Poczekaj, aż aparat będzie gotowy.');
    return;
  }
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight){
    setCameraStatus('Chwila… obraz jeszcze się ustawia.');
    return;
  }
  cameraProcessing = true;
  cameraHasCapture = false;
  updateCameraControls();
  setCameraStatus('Usuwanie tła ze zdjęcia…');
  try {
    const results = await segmentCameraImage(cameraVideo);
    const dataUrl = compositeAvatarFromMask(results, cameraVideo);
    cameraCaptureDataUrl = dataUrl;
    cameraHasCapture = true;
    prepareCameraPreview(dataUrl);
    setCameraStatus('Podgląd gotowy. Jeśli Ci odpowiada, wybierz „Użyj jako avatar”.');
  } catch (err) {
    console.error('Błąd podczas segmentacji zdjęcia', err);
    cameraHasCapture = false;
    cameraCaptureDataUrl = null;
    setCameraStatus('Nie udało się przetworzyć zdjęcia. Spróbuj ponownie.');
    resetCameraPreview();
  } finally {
    cameraProcessing = false;
    updateCameraControls();
  }
}

function handleCameraRetake(){
  if (!cameraModalOpen) return;
  cameraHasCapture = false;
  cameraCaptureDataUrl = null;
  resetCameraPreview();
  setCameraStatus('Ustaw się ponownie w kadrze i spróbuj jeszcze raz.');
  updateCameraControls();
  setTimeout(() => cameraCaptureBtn?.focus(), 50);
}

function applyCapturedAvatar(){
  if (!cameraHasCapture || !cameraCaptureDataUrl) return;
  customAvatarDataUrl = cameraCaptureDataUrl;
  customAvatarLabel = 'Moje zdjęcie';
  selectedAvatarCardKey = CUSTOM_AVATAR_CARD_KEY;
  selectedAvatarKey = cameraCaptureDataUrl;
  selectedAvatarImage = cameraCaptureDataUrl;
  selectedAvatarLabel = customAvatarLabel;
  rebuildAvatarGrid({ gender: genderSel?.value || myGender || 'MALE' });
  closeCameraModal();
  showToast('Dodano zdjęcie jako avatar', 'ok');
}

function showStep(stepId){
  if (!stepId || !stepOrder.includes(stepId)) return;
  stepOrder.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === stepId ? 'block' : 'none';
  });
  currentStep = stepId;
  if (stepId === 'stepAvatar'){
    rebuildAvatarGrid();
  }
}

function seatTakenByOther(id){
  if (!lastState || !Number.isInteger(id)) return false;
  const pl = lastState.players?.find(p => p.id === id);
  if (!pl) return false;
  if (!isSeatJoined(pl)) return false;
  if (myId && myId === id) return false;
  const nm = (nameInput?.value || '').trim().toLowerCase();
  const plName = (pl.name || '').trim().toLowerCase();
  if (nm && plName && nm === plName) return false;
  return true;
}

function updateSeatButtons(opts={}){
  const smooth = !!opts.smooth;
  const total = seatButtons.length;
  if (focusedSeatIndex >= total){
    focusedSeatIndex = total > 0 ? total - 1 : 0;
  }
  seatButtons.forEach((btn, idx) => {
    const id = parseInt(btn.dataset.seat, 10);
    if (!Number.isInteger(id)) return;
    const taken = seatTakenByOther(id);
    const distance = Math.abs(idx - focusedSeatIndex);
    btn.classList.toggle('selected', id === selectedSeat);
    btn.classList.toggle('taken', taken);
    btn.classList.toggle('focus', idx === focusedSeatIndex);
    btn.classList.toggle('adjacent', distance === 1);
    btn.classList.toggle('faded', distance > 1);
    btn.setAttribute('aria-checked', id === selectedSeat ? 'true' : 'false');
    btn.setAttribute('aria-label', `Stanowisko ${id}${taken ? ' — zajęte' : ''}`);
    btn.setAttribute('tabindex', idx === focusedSeatIndex ? '0' : '-1');
  });
  if (seatPrev) seatPrev.disabled = focusedSeatIndex <= 0;
  if (seatNext) seatNext.disabled = focusedSeatIndex >= (total - 1);
  const focusBtn = seatButtons[focusedSeatIndex];
  if (!focusBtn) return;
  if (seatViewport && seatTrack){
    const viewportWidth = seatViewport.clientWidth || 1;
    const targetLeft = focusBtn.offsetLeft - (viewportWidth / 2 - focusBtn.offsetWidth / 2);
    setSeatTrackPosition(targetLeft, smooth);
  } else if (seatViewport){
    const viewportWidth = seatViewport.clientWidth || 1;
    const targetLeft = focusBtn.offsetLeft - (viewportWidth / 2 - focusBtn.offsetWidth / 2);
    const maxScroll = Math.max(0, seatViewport.scrollWidth - viewportWidth);
    const clamped = Math.max(0, Math.min(maxScroll, targetLeft));
    seatViewport.scrollTo({ left: clamped, behavior: smooth ? 'smooth' : 'auto' });
  }
}

function updateSeatHint(){
  if (!seatHint) return;
  if (!selectedSeat){
    seatHint.textContent = 'Wybierz wolne stanowisko, z którego będziesz grać.';
    return;
  }
  seatHint.textContent = seatTakenByOther(selectedSeat)
    ? 'Stanowisko jest już zajęte. Jeśli to Ty, przejdź dalej i potwierdź dane.'
    : `Wybrane stanowisko ${selectedSeat}.`;
}

function updateNameHint(){
  if (!nameHint) return;
  const nm = (nameInput?.value || '').trim();
  nameHint.textContent = nm
    ? 'Świetnie, dane zostaną pokazane prowadzącemu.'
    : 'To dane, które zobaczy prowadzący.';
}

function updateGenderHint(){
  if (!genderHint) return;
  const val = genderSel?.value || '';
  if (!val){
    genderHint.textContent = 'Wybierz, która wersja avatara pasuje do Ciebie.';
    return;
  }
  genderHint.textContent = val === 'FEMALE'
    ? 'Wybrałaś wersję damską avataru.'
    : 'Wybrałeś wersję męską avataru.';
}

function updateAvatarHint(){
  if (!avatarHint) return;
  if (!selectedAvatarKey){
    avatarHint.textContent = 'Wybierz wygląd, a następnie dołącz do gry.';
    return;
  }
  avatarHint.textContent = selectedAvatarLabel
    ? `Wybrano avatar „${selectedAvatarLabel}”.`
    : 'Wybrano avatar.';
}

function updateSummary(){
  if (summarySeat) summarySeat.textContent = selectedSeat ? selectedSeat.toString() : '—';
  if (summaryName) summaryName.textContent = (nameInput?.value || '').trim() || '—';
  if (summaryGender){
    const val = genderSel?.value || '';
    summaryGender.textContent = val ? (val === 'FEMALE' ? 'Kobieta' : 'Mężczyzna') : '—';
  }
  if (summaryAvatar) summaryAvatar.textContent = selectedAvatarLabel || '—';
}

function updateAvatarPreview(){
  if (!avatarPreviewImg) return;
  const genderForFallback = genderSel?.value || myGender || 'MALE';
  const hasSelection = !!selectedAvatarKey;
  const src = hasSelection
    ? (selectedAvatarImage || resolveAvatarImage(selectedAvatarKey, 'idle', genderForFallback))
    : AVATAR_PLACEHOLDER;
  if (hasSelection && !selectedAvatarImage){
    selectedAvatarImage = src;
  }
  avatarPreviewImg.src = src;
  avatarPreviewImg.classList.toggle('isPlaceholder', !hasSelection);
  const altLabel = hasSelection && selectedAvatarLabel
    ? `Podgląd avataru ${selectedAvatarLabel}`
    : 'Podgląd avataru';
  avatarPreviewImg.alt = altLabel;
}

function updateStepButtons(){
  const nm = (nameInput?.value || '').trim();
  if (btnNext1) btnNext1.disabled = !selectedSeat;
  if (btnNext2) btnNext2.disabled = !nm;
  if (btnNext3) btnNext3.disabled = !genderSel?.value;
  if (btnJoin) btnJoin.disabled = !selectedAvatarKey || !nm || !selectedSeat;
}

function selectSeat(id, opts={}){
  if (!Number.isInteger(id) || id < 1 || id > 10) return;
  const smooth = opts.smooth !== undefined ? !!opts.smooth : true;
  selectedSeat = id;
  if (slotInput) slotInput.value = id;
  const idx = seatButtons.findIndex(btn => parseInt(btn.dataset.seat, 10) === id);
  if (idx >= 0) focusedSeatIndex = idx;
  updateSeatButtons({smooth});
  updateSeatHint();
  updateSummary();
  updateStepButtons();
}

function selectGender(val){
  if (!val) return;
  if (genderSel) genderSel.value = val;
  myGender = val;
  genderCards.forEach(card => {
    const active = card.dataset.gender === val;
    card.classList.toggle('selected', active);
    card.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  rebuildAvatarGrid({ gender: val });
  updateGenderHint();
  updateAvatarPreview();
  updateSummary();
  updateStepButtons();
}

function selectAvatar(cardKey){
  if (!cardKey) return;
  const card = avatarCards.find(c => c.dataset.avatarCardKey === cardKey);
  if (!card) return;

  let avatarValue = cardKey;
  let avatarImage = null;
  let avatarLabel = card.dataset.avatarLabel || getAvatarLabel(cardKey) || card.querySelector('.choiceLabel')?.textContent?.trim() || '';

  if (cardKey === CUSTOM_AVATAR_CARD_KEY){
    if (!customAvatarDataUrl) return;
    avatarValue = customAvatarDataUrl;
    avatarImage = customAvatarDataUrl;
    avatarLabel = customAvatarLabel || 'Moje zdjęcie';
  } else {
    avatarImage = card.dataset.avatarImg || getAvatarImage(cardKey) || resolveAvatarImage(cardKey, 'idle', genderSel?.value || myGender || 'MALE');
  }

  selectedAvatarCardKey = cardKey;
  selectedAvatarKey = avatarValue;
  selectedAvatarImage = avatarImage;
  selectedAvatarLabel = avatarLabel;

  avatarCards.forEach(c => {
    const active = c.dataset.avatarCardKey === cardKey;
    c.classList.toggle('selected', active);
    c.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  updateAvatarPreview();
  updateAvatarHint();
  updateSummary();
  updateStepButtons();
}

seatButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const id = parseInt(btn.dataset.seat, 10);
    if (!Number.isInteger(id)) return;
    selectSeat(id);
  });
  btn.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight'){
      ev.preventDefault();
      moveSeatFocus(1);
      seatButtons[focusedSeatIndex]?.focus();
    } else if (ev.key === 'ArrowLeft'){
      ev.preventDefault();
      moveSeatFocus(-1);
      seatButtons[focusedSeatIndex]?.focus();
    }
  });
});

function moveSeatFocus(delta){
  if (!seatButtons.length) return;
  const nextIdx = Math.min(Math.max(focusedSeatIndex + delta, 0), seatButtons.length - 1);
  const target = seatButtons[nextIdx];
  if (!target) return;
  const id = parseInt(target.dataset.seat, 10);
  if (!Number.isInteger(id)) return;
  selectSeat(id);
  seatButtons[focusedSeatIndex]?.focus();
}

if (seatPrev){
  seatPrev.addEventListener('click', () => moveSeatFocus(-1));
}
if (seatNext){
  seatNext.addEventListener('click', () => moveSeatFocus(1));
}

genderCards.forEach(card => {
  card.addEventListener('click', () => selectGender(card.dataset.gender));
});

backButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.backStep;
    if (target && stepOrder.includes(target)) showStep(target);
  });
});

if (cameraCloseBtn){
  cameraCloseBtn.addEventListener('click', () => {
    closeCameraModal();
    focusCameraCard();
  });
}
if (cameraCaptureBtn){
  cameraCaptureBtn.addEventListener('click', captureCameraPhoto);
}
if (cameraRetakeBtn){
  cameraRetakeBtn.addEventListener('click', handleCameraRetake);
}
if (cameraUseBtn){
  cameraUseBtn.addEventListener('click', () => {
    applyCapturedAvatar();
    if (btnJoin) btnJoin.focus();
  });
}
if (cameraModal){
  cameraModal.addEventListener('click', ev => {
    if (ev.target === cameraModal){
      closeCameraModal();
      focusCameraCard();
    }
  });
}

if (nameInput){
  nameInput.addEventListener('input', () => {
    updateNameHint();
    updateSeatButtons();
    updateSeatHint();
    updateSummary();
    updateStepButtons();
  });
}

if (slotInput){
  slotInput.addEventListener('change', () => {
    const id = parseInt(slotInput.value, 10);
    if (Number.isInteger(id)) selectSeat(id);
  });
}

selectGender(myGender);
updateAvatarPreview();
updateAvatarHint();
if (Number.isInteger(selectedSeat)){
  selectSeat(selectedSeat, {smooth:false});
} else {
  const initialFocusBtn = seatButtons[focusedSeatIndex];
  const initialSeatId = initialFocusBtn ? parseInt(initialFocusBtn.dataset.seat, 10) : null;
  if (Number.isInteger(initialSeatId) && !seatTakenByOther(initialSeatId)){
    selectSeat(initialSeatId, {smooth:false});
  } else {
    updateSeatButtons();
    updateSeatHint();
  }
}
updateNameHint();
updateSummary();
updateStepButtons();
rebuildAvatarGrid();
showStep(currentStep);
updateCameraControls();

function updateClockProgress(pct){
  const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(1, pct)) : 0;
  if (pb){
    pb.setAttribute('aria-valuenow', Math.round(clamped * 100));
  }
  document.body.style.setProperty('--player-clock-progress', clamped.toFixed(4));
}

function setClockActive(active){
  const shouldActivate = !!active;
  if (shouldActivate === clockActive) return;
  clockActive = shouldActivate;
  document.body.classList.toggle('clock-active', shouldActivate);
}

function updateProgressBar(totalMs, remainingMs){
  const total = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 10000;
  const remaining = Math.max(0, Math.min(Number.isFinite(remainingMs) ? remainingMs : total, total));
  const pct = total > 0 ? Math.max(0, Math.min(1, (total - remaining) / total)) : 0;
  pb.style.width = (pct * 100).toFixed(1) + '%';
  updateClockProgress(pct);
}

async function ensureInitialData(){
  try {
    await loadInitialData();
  } catch (e) {
    console.warn('Nie udało się wczytać danych operatora', e);
  }
  totalAnswerMs = getAnswerTimerMs();
  latestTimerRemainingMs = totalAnswerMs;
  updateProgressBar(totalAnswerMs, totalAnswerMs);
}

ensureInitialData();

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
  const host = document.getElementById('stepGame') || document.body;
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

    updateSeatButtons();
    updateSeatHint();
    updateSummary();
    updateStepButtons();

    const settingsTotal = st?.settings?.answerTimerMs;
    setAnswerTimerMs(settingsTotal);
    totalAnswerMs = getAnswerTimerMs();
    const stateRemaining = Number.isFinite(st?.timerRemainingMs) ? st.timerRemainingMs : null;
    if (st?.timerActive && stateRemaining != null){
      latestTimerRemainingMs = Math.max(0, stateRemaining);
    } else if (!st?.timerActive){
      latestTimerRemainingMs = totalAnswerMs;
    }
    updateProgressBar(totalAnswerMs, latestTimerRemainingMs);

    if (myId){
      const me = st.players.find(p=>p.id===myId);
      if (me){
        if (me.gender && me.gender !== myGender){
          selectGender(me.gender);
        }
        const genderForAvatar = me.gender || myGender || 'MALE';
        const avatarValue = me.avatar || null;
        const resolvedAvatarSrc = avatarValue
          ? resolveAvatarImage(avatarValue, 'idle', genderForAvatar)
          : AVATAR_PLACEHOLDER;
        if (avatarValue){
          const isCustom = isCustomAvatar(avatarValue);
          if (isCustom){
            customAvatarDataUrl = avatarValue;
            customAvatarLabel = 'Moje zdjęcie';
          }
          const expectedCardKey = isCustom ? CUSTOM_AVATAR_CARD_KEY : avatarValue;
          const hasCard = avatarCards.some(c => c.dataset.avatarCardKey === expectedCardKey);
          if (avatarValue !== selectedAvatarKey || selectedAvatarCardKey !== expectedCardKey){
            selectedAvatarKey = avatarValue;
            selectedAvatarCardKey = expectedCardKey;
            if (hasCard){
              selectAvatar(expectedCardKey);
            } else {
              rebuildAvatarGrid({ gender: genderForAvatar });
            }
          } else if (isCustom && !hasCard){
            rebuildAvatarGrid({ gender: genderForAvatar });
          } else {
            selectedAvatarImage = resolvedAvatarSrc;
            selectedAvatarLabel = getAvatarLabel(avatarValue) || (isCustom ? 'Moje zdjęcie' : selectedAvatarLabel);
            updateAvatarPreview();
            updateAvatarHint();
            updateSummary();
            updateStepButtons();
          }
        } else if (selectedAvatarKey){
          selectedAvatarCardKey = null;
          selectedAvatarKey = null;
          selectedAvatarImage = null;
          selectedAvatarLabel = '';
          avatarCards.forEach(c => {
            c.classList.remove('selected');
            c.setAttribute('aria-pressed', 'false');
          });
          updateAvatarPreview();
          updateAvatarHint();
          updateSummary();
          updateStepButtons();
        }
        if (avImg) avImg.src = resolvedAvatarSrc;
        if (me.score !== myScore){
          scoreEl.textContent = me.score;
          scoreEl.parentElement.classList.add('scorePulse');
          setTimeout(()=>scoreEl.parentElement.classList.remove('scorePulse'), 500);
          myScore = me.score;
        }
        const prevLives = myLives;
        if (me.lives !== myLives){
          livesEl.textContent = me.lives;
          livesEl.parentElement.classList.add('lifeShake');
          setTimeout(()=>livesEl.parentElement.classList.remove('lifeShake'), 600);
          myLives = me.lives;
          if (!me.eliminated && prevLives === 0 && me.lives > prevLives){
            answeredTotal = 0;
            correctTotal = 0;
          }
        }
        if (me.eliminated){
          showOutOverlay(me);
          resetResultFx();
        } else {
          hideOutOverlay();
        }
      }
    }

    if (iAmOut){
      setStatus('Odpadasz z gry — dziękujemy za udział!');
      updateProgressBar(totalAnswerMs, totalAnswerMs);
      return;
    }

    renderQuestion(st);

    // Fazy – status i highlighty
    if (phase === 'READING'){
      const meAns = st.answeringId === myId;
      setStatus(meAns ? 'Twoje pytanie — słuchaj prowadzącego…' : 'Prowadzący czyta pytanie…');
      lockKnow(true);
      if (meAns) { showRole('Odpowiadasz', 'ok'); }
      else { hideRole(); }
      resetResultFx();
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
      resetResultFx();
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
        resetResultFx();
      } else {
        document.body.classList.remove('me-answering');
        avImg.classList.remove('ping');
        setKnowLabel('Znam odpowiedź!');
        setClockActive(false);
      }
      document.body.classList.remove('me-won','me-pending','me-choosing','me-picked');
      pendingBuzz = false;
    }
    else if (phase === 'SELECTING'){
      setStatus('Zwycięzca wybiera przeciwnika…');
      lockKnow(true);
      setClockActive(false);
      // rola i highlighty ustawią się w onEvent
    }
    else if (phase === 'ANNOTATION'){
      setStatus('Prowadzący omawia adnotację…');
      lockKnow(true);
      document.body.classList.remove('me-won','me-pending','me-answering','me-choosing','me-picked');
      avImg.classList.remove('ping');
      setClockActive(false);
    }
    else if (phase === 'INTRO'){
      setStatus('Intro…');
      lockKnow(true);
      document.body.classList.remove('me-won','me-pending','me-answering','me-choosing','me-picked','me-banned');
      avImg.classList.remove('ping');
      hideRole();
      setKnowLabel('Znam odpowiedź!');
      resetResultFx();
    }
    else {
      setStatus('Czekaj na kolejne pytanie…');
      lockKnow(true);
      pb.style.width='0%';
      document.body.classList.remove('me-won','me-pending','me-answering','me-choosing','me-picked','me-banned');
      avImg.classList.remove('ping');
      hideRole();
      setKnowLabel('Znam odpowiedź!');
      setClockActive(false);
    }
  },
  onEvent: ev => {
    if (iAmOut) return;
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
      if (ev.value === 'CORRECT'){ correctTotal++; showToast('✓ DOBRA ODPOWIEDŹ', 'ok'); showResultFx('ok'); }
      else { showToast('✗ ZŁA ODPOWIEDŹ', 'bad'); shakeToast(); showResultFx('bad'); }
      document.body.classList.remove('me-won','me-answering','me-choosing','me-picked');
      setKnowLabel('Znam odpowiedź!');
    }
  },
  onTimer: t => {
    if (Number.isFinite(t?.remainingMs)) {
      latestTimerRemainingMs = Math.max(0, t.remainingMs);
    }
    totalAnswerMs = getAnswerTimerMs();
    updateProgressBar(totalAnswerMs, latestTimerRemainingMs);
  }
});

/* ====== FORM STEPS ====== */
if (btnNext1){
  btnNext1.onclick = () => {
    if (!Number.isInteger(selectedSeat)){
      updateStepButtons();
      return;
    }
    myId = selectedSeat;
    seatEl.textContent = 'Stanowisko ' + selectedSeat;
    showStep('stepName');
    setTimeout(() => nameInput?.focus(), 50);
  };
}

if (btnNext2){
  btnNext2.onclick = () => {
    const nm = (nameInput?.value || '').trim();
    if (!nm){
      updateStepButtons();
      updateNameHint();
      return;
    }
    updateSummary();
    showStep('stepGender');
  };
}

if (btnNext3){
  btnNext3.onclick = () => {
    if (!genderSel?.value){
      updateStepButtons();
      return;
    }
    showStep('stepAvatar');
  };
}

if (btnJoin){
  btnJoin.onclick = () => {
    if (!Number.isInteger(selectedSeat) || selectedSeat < 1 || selectedSeat > 10){
      alert('Wybierz stanowisko 1–10.');
      return;
    }
    const nm = (nameInput?.value || '').trim();
    if (!nm){
      alert('Podaj imię i nazwisko.');
      return;
    }
    if (!myGender){
      alert('Wybierz płeć.');
      return;
    }
    if (!selectedAvatarKey){
      alert('Wybierz avatar.');
      return;
    }
    const existing = lastState?.players?.find(p => p.id === selectedSeat && isSeatJoined(p));
    if (existing){
      const currentName = (existing.name||'').trim().toLowerCase();
      if (!currentName || currentName !== nm.toLowerCase()){
        alert('To stanowisko jest już zajęte. Wybierz inne lub poproś o zmianę u operatora.');
        return;
      }
    }
    myId = selectedSeat;
    seatEl.textContent = 'Stanowisko ' + selectedSeat;
    bus.send('/app/setName', {playerId:selectedSeat, name:nm});
    bus.send('/app/setGender', {playerId:selectedSeat, gender:myGender});
    bus.send('/app/setAvatar', {playerId:selectedSeat, avatar:selectedAvatarKey});
    const resolvedAvatar = selectedAvatarKey
      ? (selectedAvatarImage || resolveAvatarImage(selectedAvatarKey, 'idle', myGender))
      : AVATAR_PLACEHOLDER;
    selectedAvatarImage = resolvedAvatar;
    avImg.src = resolvedAvatar;
    showStep('stepGame');
    updateSeatButtons();
    updateSummary();
  };
}

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

  // pozostali aktywni i nieeliminowani gracze
  st.players
    .filter(p => !p.eliminated && p.id !== myId && isSeatJoined(p))
    .forEach(p=>{
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

function renderQuestion(st){
  if (!questionWrap || !questionTextEl) return;
  if (iAmOut){
    questionTextEl.textContent = '—';
    questionWrap.style.display = 'none';
    return;
  }
  const active = st?.hostDashboard?.activeQuestion;
  if (active && active.revealed){
    questionTextEl.textContent = active.question || '—';
    questionWrap.style.display = '';
  } else {
    questionTextEl.textContent = '—';
    questionWrap.style.display = 'none';
  }
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
function closeChoosePopup(){ if (chooseBackdrop) chooseBackdrop.classList.remove('show'); }
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

function showOutOverlay(me){
  iAmOut = true;
  if (outOverlay) outOverlay.style.display = 'block';
  if (outStats){
    let statsHtml = `Wynik: <b>${myScore}</b> pkt`;
    if (answeredTotal > 0){
      statsHtml += `<br>Odpowiedzi: <b>${correctTotal}</b> z ${answeredTotal}`;
    } else {
      statsHtml += `<br>Odpowiedzi: —`;
    }
    outStats.innerHTML = statsHtml;
  }
  if (outPlace){
    const place = Number(me?.finalRank);
    if (Number.isFinite(place) && place > 0){
      outPlace.innerHTML = `Zająłeś <b>${formatPlace(place)}</b>.`;
    } else {
      outPlace.textContent = 'Miejsce zostanie ogłoszone przez prowadzącego.';
    }
  }
  lockKnow(true);
  setKnowLabel('Poza grą');
  if (btnKnow) btnKnow.style.display = 'none';
  if (playerBarEl) playerBarEl.style.display = 'none';
  if (questionWrap) questionWrap.style.display = 'none';
  if (pb) pb.style.width = '0%';
  pendingBuzz = false;
  document.body.classList.remove('me-won','me-pending','me-answering','me-choosing','me-picked','me-banned');
  document.body.classList.add('me-out');
  hideRole();
  closeChoosePopup();
}

function hideOutOverlay(){
  if (outOverlay) outOverlay.style.display = 'none';
  if (outStats) outStats.innerHTML = '';
  if (outPlace) outPlace.textContent = '';
  if (btnKnow) btnKnow.style.removeProperty('display');
  if (playerBarEl) playerBarEl.style.removeProperty('display');
  setKnowLabel('Znam odpowiedź!');
  document.body.classList.remove('me-out');
  iAmOut = false;
}

function formatPlace(place){
  const n = Math.max(1, Math.round(place));
  return `${n}. miejsce`;
}

/* ====== AVATAR FX (wynik odpowiedzi) ====== */
function stopResultFxTimer(){
  if (resultHideTimer){
    clearTimeout(resultHideTimer);
    resultHideTimer = null;
  }
}

function resetResultFx(){
  if (!avatarFx) return;
  stopResultFxTimer();
  avatarFx.classList.remove('show-result','result-ok','result-bad');
  if (avatarFxResult) avatarFxResult.classList.remove('pulse');
  if (avatarFxResultIcon) avatarFxResultIcon.classList.remove('pop');
}

function showResultFx(kind){
  if (!avatarFx) return;
  resetResultFx();
  avatarFx.classList.add('show-result');
  avatarFx.classList.add(kind === 'ok' ? 'result-ok' : 'result-bad');
  if (avatarFxResult){
    avatarFxResult.classList.remove('pulse');
    void avatarFxResult.offsetWidth;
    avatarFxResult.classList.add('pulse');
  }
  if (avatarFxResultIcon){
    avatarFxResultIcon.classList.remove('pop');
    void avatarFxResultIcon.offsetWidth;
    avatarFxResultIcon.classList.add('pop');
  }
  resultHideTimer = setTimeout(()=>{
    if (avatarFxResult) avatarFxResult.classList.remove('pulse');
    if (avatarFxResultIcon) avatarFxResultIcon.classList.remove('pop');
    avatarFx.classList.remove('show-result','result-ok','result-bad');
    resultHideTimer = null;
  }, 1600);
}
