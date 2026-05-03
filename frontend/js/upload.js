const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// Each message has a duration roughly matching the real backend phase it
// covers: parsing is fast, the AI call is the bulk of the latency.
const LOADING_MESSAGES = [
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

const dropzone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const loadingEl = document.getElementById('loading');
const loadingMsg = document.getElementById('loading-msg');
const errorEl = document.getElementById('error');

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
  if (e.target.files.length) handleFile(e.target.files[0]);
});

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  loadingEl.hidden = true;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

async function handleFile(file) {
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

  dropzone.hidden = true;
  loadingEl.hidden = false;
  cycleLoadingMessages();

  const fd = new FormData();
  fd.append('file', file);

  try {
    const resp = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.message || 'Enhancement failed. Recruiters definitely noticed.');
    }
    const { url } = await resp.json();
    window.location.href = url;
  } catch (err) {
    dropzone.hidden = false;
    showError(err.message);
  }
}

function cycleLoadingMessages() {
  let i = 0;
  loadingMsg.textContent = LOADING_MESSAGES[0].text;
  const tick = () => {
    if (loadingEl.hidden) return;
    i = (i + 1) % LOADING_MESSAGES.length;
    loadingMsg.textContent = LOADING_MESSAGES[i].text;
    setTimeout(tick, LOADING_MESSAGES[i].ms);
  };
  setTimeout(tick, LOADING_MESSAGES[0].ms);
}
