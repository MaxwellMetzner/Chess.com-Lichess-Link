const HASH_PREFIX = '#chesscom-import=';
const PGN_TEXTAREA_SELECTOR = 'textarea[name="pgn"]';
const IMPORT_FORM_SELECTOR = 'main form[action="/import"]';

function getImportId() {
  if (!window.location.hash.startsWith(HASH_PREFIX)) {
    return null;
  }

  return decodeURIComponent(window.location.hash.slice(HASH_PREFIX.length));
}

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitForElement(selector, timeoutMs = 5000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const element = document.querySelector(selector);

    if (element) {
      return element;
    }

    await wait(100);
  }

  return null;
}

function setTextareaValue(textarea, value) {
  const prototype = Object.getPrototypeOf(textarea);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

async function importPendingPgn() {
  const importId = getImportId();

  if (!importId) {
    return;
  }

  const form = await waitForElement(IMPORT_FORM_SELECTOR, 5000);
  const textarea = await waitForElement(PGN_TEXTAREA_SELECTOR, 5000);

  if (!form || !textarea) {
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: 'GET_PENDING_IMPORT',
    importId
  });
  const pendingImport = response?.pendingImport;

  if (!response?.ok || !pendingImport?.pgn) {
    return;
  }

  setTextareaValue(textarea, pendingImport.pgn);
  await chrome.runtime.sendMessage({
    type: 'CLEAR_PENDING_IMPORT',
    importId
  });

  window.history.replaceState({}, document.title, window.location.pathname);
  form.requestSubmit();
}

void importPendingPgn();