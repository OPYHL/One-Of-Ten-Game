const data = {
  answerTimerMs: null,
  configLoaded: false,
  loadingPromise: null,
};

function normalizeMs(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export async function loadInitialData() {
  if (data.loadingPromise) {
    return data.loadingPromise;
  }
  data.loadingPromise = fetch('/api/operator/config', { cache: 'no-store' })
    .then(res => (res.ok ? res.json() : null))
    .then(json => {
      const seconds = json?.answer?.defaultSeconds;
      const ms = normalizeMs(seconds) ? seconds * 1000 : null;
      if (ms) {
        data.answerTimerMs = ms;
      }
      data.configLoaded = true;
      return data;
    })
    .catch(() => {
      data.configLoaded = true;
      return data;
    });
  return data.loadingPromise;
}

export function setAnswerTimerMs(ms) {
  const normalized = normalizeMs(ms);
  if (normalized) {
    data.answerTimerMs = normalized;
  }
}

export function getAnswerTimerMs() {
  return normalizeMs(data.answerTimerMs) ?? 10000;
}

export function getDataSnapshot() {
  return { ...data };
}
