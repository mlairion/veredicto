const DEFAULT_URL = 'https://mlairion.github.io/veredicto';

let currentTab = null;
let extractedData = null;

function $(id) { return document.getElementById(id); }

function setStatus(html, type = '') {
  const el = $('status-msg');
  el.innerHTML = html;
  el.className = 'status' + (type ? ' ' + type : '');
}

async function getSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(['ml_comparador_url', 'ml_comparador_count'], resolve);
  });
}

async function getComparadorUrl() {
  const s = await getSettings();
  return (s.ml_comparador_url || DEFAULT_URL).replace(/\/$/, '');
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────

function showSettings() {
  $('main-wrapper').style.display = 'none';
  $('settings-panel').classList.add('visible');
  getComparadorUrl().then(url => { $('cfg-url').value = url; });
}

function showMain() {
  $('settings-panel').classList.remove('visible');
  $('main-wrapper').style.display = 'block';
}

async function saveSettings() {
  const url = $('cfg-url').value.trim();
  await chrome.storage.local.set({ ml_comparador_url: url });
  $('settings-status').textContent = '✓ Guardado';
  setTimeout(() => { $('settings-status').textContent = ''; showMain(); }, 1000);
}

// ── OPEN COMPARADOR ────────────────────────────────────────────────────────────

async function openComparador() {
  const url = await getComparadorUrl();
  const tabs = await chrome.tabs.query({ url: url + '*' });
  if (tabs.length > 0) {
    chrome.tabs.update(tabs[0].id, { active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url });
  }
  window.close();
}

// ── ADD PRODUCT ────────────────────────────────────────────────────────────────

async function addToComparador() {
  if (!extractedData) return;

  const btn = $('btn-add');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Agregando...';
  setStatus('');

  try {
    const url = await getComparadorUrl();
    const encoded = encodeURIComponent(JSON.stringify(extractedData));
    const targetUrl = `${url}#import=${encoded}`;

    // Look for an already open comparador tab
    const tabs = await chrome.tabs.query({ url: url + '*' });
    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { url: targetUrl, active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: targetUrl });
    }

    btn.innerHTML = '✅ Agregado';
    btn.style.background = '#052010';
    btn.style.color = '#22c55e';
    setStatus('Abriendo el comparador...', 'ok');

    setTimeout(() => window.close(), 1200);
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = '📦 Agregar al comparador';
    setStatus('❌ ' + e.message, 'err');
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────

async function init() {
  const settings = await getSettings();
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];
  const url = currentTab?.url || '';

  const isProduct =
    /mercadolibre\.com\.ar\/MLA/i.test(url) ||
    /mercadolibre\.com\.ar\/p\/MLA/i.test(url);

  $('state-loading').style.display = 'none';

  if (!isProduct) {
    $('state-no-product').style.display = 'block';
    return;
  }

  // Try to extract product data
  try {
    let response;
    try {
      response = await chrome.tabs.sendMessage(currentTab.id, { action: 'extractProduct' });
    } catch (e) {
      // Content script not yet injected — inject it
      await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ['content.js'] });
      await new Promise(r => setTimeout(r, 400));
      response = await chrome.tabs.sendMessage(currentTab.id, { action: 'extractProduct' });
    }

    if (!response?.success) throw new Error(response?.error || 'No se pudo leer la página');

    extractedData = response.data;

    // Show preview
    const preview = $('product-preview');
    $('prev-name').textContent = extractedData.title || 'Sin título';
    $('prev-price').textContent = extractedData.price ? `$ ${extractedData.price}` : '';
    $('prev-rating').textContent =
      extractedData.rating
        ? `★ ${extractedData.rating}${extractedData.reviews ? ` · ${extractedData.reviews} opiniones` : ''}`
        : '';
    preview.style.display = 'block';

    // Show product count if any
    const countKey = 'ml_comparador_count';
    if (settings.ml_comparador_count > 0) {
      $('current-count').textContent = settings.ml_comparador_count;
      $('count-badge').style.display = 'flex';
    }

    $('state-ready').style.display = 'block';
  } catch (e) {
    $('state-ready').style.display = 'block';
    setStatus('⚠️ No se pudo leer el producto. Intentá recargar la página.', 'err');
    $('btn-add').disabled = true;
  }
}

// ── EVENTS ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  $('btn-settings').addEventListener('click', showSettings);
  $('btn-back').addEventListener('click', showMain);
  $('btn-save-settings').addEventListener('click', saveSettings);
  $('btn-add').addEventListener('click', addToComparador);
  $('btn-open-comparador').addEventListener('click', openComparador);
  $('btn-open-comparador2').addEventListener('click', openComparador);
  init();
});
