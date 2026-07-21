const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// Each message has a duration roughly matching the real backend phase it
// covers: parsing is fast, the AI call is the bulk of the latency.
const CHAOS_LOADING_MESSAGES = [
  { text: 'Uploading your CV securely…', ms: 1500 },
  { text: 'Parsing document structure…', ms: 1800 },
  { text: 'Detecting sections and skills…', ms: 1800 },
  { text: 'Cross-referencing 1.2M+ successful CVs…', ms: 2500 },
  { text: 'Running neural enhancement engine…', ms: 3500 },
  { text: 'Optimizing keyword density…', ms: 2500 },
  { text: 'Calibrating recruiter response signals…', ms: 2500 },
  { text: 'Validating against Fortune 500 standards…', ms: 2000 },
  { text: 'Running ATS-Bypass™ compatibility checks…', ms: 2000 },
  { text: 'Finalizing your enhanced CV…', ms: 2500 },
];

const PORTFOLIO_LOADING_MESSAGES = [
  { text: 'Uploading your CV securely…', ms: 1500 },
  { text: 'Parsing document structure…', ms: 1800 },
  { text: 'Identifying the real person behind the page headers…', ms: 2500 },
  { text: 'AI-curating experience and project highlights…', ms: 3500 },
  { text: 'Checking the rewrite against source facts…', ms: 2500 },
  { text: 'Selecting a visual direction…', ms: 1800 },
  { text: 'Publishing your shareable page…', ms: 1800 },
];

const dropzone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const loadingEl = document.getElementById('loading');
const loadingMsg = document.getElementById('loading-msg');
const errorEl = document.getElementById('error');
const styleDialog = document.getElementById('style-dialog');
const styleForm = document.getElementById('style-form');
const styleCancel = document.getElementById('style-cancel');
const selectedFile = document.getElementById('selected-file');
let pendingFile = null;
let loadingTimer = null;

browseBtn.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('click', (e) => {
  if (e.target === browseBtn) return;
  fileInput.click();
});

['dragover', 'dragenter'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
  })
);

dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer && e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) handleFile(file);
});

styleForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!pendingFile) return;
  const file = pendingFile;
  const mode = new FormData(styleForm).get('presentation') || 'modern';
  pendingFile = null;
  styleDialog.close();
  uploadFile(file, mode);
});

styleCancel.addEventListener('click', () => {
  pendingFile = null;
  styleDialog.close();
  fileInput.click();
});

styleDialog.addEventListener('cancel', () => {
  pendingFile = null;
});

// When the browser restores this page from the back/forward cache
// (e.g. user clicks Back from /cv/{id}), the dropzone is still hidden
// from the previous upload. Reset UI state and clear the input so the
// next file selection fires a `change` event.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  dropzone.hidden = false;
  loadingEl.hidden = true;
  clearError();
  fileInput.value = '';
  styleForm.reset();
  pendingFile = null;
  stopLoadingMessages();
  if (styleDialog.open) styleDialog.close();
});

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  loadingEl.hidden = true;
  stopLoadingMessages();
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

function handleFile(file) {
  clearError();

  if (file.size > MAX_BYTES) {
    showError('Your CV is too thicc. Max 5MB.');
    return;
  }
  const lowerName = file.name.toLowerCase();
  const isAccepted =
    ACCEPTED.includes(file.type) ||
    lowerName.endsWith('.pdf') ||
    lowerName.endsWith('.docx');
  if (!isAccepted) {
    showError('We only accept PDF or DOCX. Did you try to upload a JPEG of a JPEG?');
    return;
  }

  pendingFile = file;
  styleForm.reset();
  selectedFile.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MiB`;
  if (!styleDialog.open) styleDialog.showModal();
}

async function uploadFile(file, mode) {
  dropzone.hidden = true;
  loadingEl.hidden = false;
  cycleLoadingMessages(mode);

  const fd = new FormData();
  fd.append('file', file);
  fd.append('presentation', mode);

  try {
    const resp = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.message || 'Enhancement failed. Recruiters definitely noticed.');
    }
    const { url } = await resp.json();
    stopLoadingMessages();
    window.location.href = url;
  } catch (err) {
    dropzone.hidden = false;
    showError(err.message);
  }
}

function cycleLoadingMessages(mode) {
  stopLoadingMessages();
  const messages = mode === 'chaos' ? CHAOS_LOADING_MESSAGES : PORTFOLIO_LOADING_MESSAGES;
  let i = 0;
  loadingMsg.textContent = messages[0].text;
  const tick = () => {
    if (loadingEl.hidden) return;
    i = (i + 1) % messages.length;
    loadingMsg.textContent = messages[i].text;
    loadingTimer = setTimeout(tick, messages[i].ms);
  };
  loadingTimer = setTimeout(tick, messages[0].ms);
}

function stopLoadingMessages() {
  if (loadingTimer !== null) clearTimeout(loadingTimer);
  loadingTimer = null;
}
