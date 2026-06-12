(function () {
  if (window.__mlComparadorInjected) return;
  window.__mlComparadorInjected = true;

  function getText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.innerText?.trim()) return el.innerText.trim();
    }
    return null;
  }

  function extractSpecs() {
    const specs = {};

    // Format 1: andes-table rows (most common in ML)
    document.querySelectorAll(
      '.andes-table__row, .ui-pdp-specs__table tr, table tr'
    ).forEach(row => {
      const th = row.querySelector('th, .andes-table__header--left, td:first-child');
      const td = row.querySelector('td:last-child, .andes-table__column--right');
      if (th && td && th !== td) {
        const key = th.innerText.trim();
        const val = td.innerText.trim();
        if (key && val && key !== val) specs[key] = val;
      }
    });

    // Format 2: spec items with label/value structure
    document.querySelectorAll(
      '.ui-pdp-specs__item, [class*="specs__item"], .vpp-specs-detail__specs-item'
    ).forEach(item => {
      const label = item.querySelector(
        '[class*="label"], [class*="title"], dt'
      )?.innerText?.trim();
      const value = item.querySelector(
        '[class*="value"], dd'
      )?.innerText?.trim();
      if (label && value && !specs[label]) specs[label] = value;
    });

    return specs;
  }

  function extractImages() {
    const imgs = [];
    const selectors = [
      '.ui-pdp-gallery__figure img',
      '.ui-pdp-image img',
      '.gallery-image img',
      '[class*="gallery"] img',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(img => {
        const src = img.src || img.dataset.src || img.dataset.lazySrc || '';
        if (src.startsWith('http') && !src.includes('placeholder') && !imgs.includes(src)) {
          imgs.push(src);
        }
      });
      if (imgs.length >= 6) break;
    }
    return imgs.slice(0, 6);
  }

  function extractProductId() {
    // From URL: /MLA-XXXXXXX or /MLA-XXXXXXX-... or /p/MLAXXX
    const match = location.href.match(/\/(?:p\/)?(MLA-?\d+)/i);
    return match ? match[1].replace('-', '') : Date.now().toString();
  }

  function extract() {
    const title = getText([
      'h1.ui-pdp-title',
      '.ui-pdp-title',
      'h1[class*="title"]',
      'h1',
    ]);

    // Price: join fraction + cents
    const fraction = getText([
      '.andes-money-amount__fraction',
      '.price-tag-fraction',
      '[class*="price-tag-fraction"]',
    ]);
    const cents = getText([
      '.andes-money-amount__cents',
      '.price-tag-cents',
    ]);
    const price = fraction
      ? cents
        ? `${fraction},${cents}`
        : fraction
      : null;

    // Rating
    const rating = getText([
      '.ui-pdp-review__rating',
      '.ui-review-capability__rating__average',
      '[class*="review__rating"]',
      '[class*="rating__average"]',
    ]);

    // Review count — extract number from text like "(1.234 opiniones)"
    const reviewsRaw = getText([
      '.ui-pdp-review__amount',
      '.ui-review-capability__rating__label',
      '[class*="review__amount"]',
      '[class*="rating__label"]',
    ]);
    const reviewsMatch = reviewsRaw?.replace(/\./g, '').match(/[\d]+/);
    const reviews = reviewsMatch ? reviewsMatch[0] : null;

    const specs = extractSpecs();
    const photos = extractImages();
    const id = extractProductId();

    return { id, title, price, rating, reviews, specs, photos, link: location.href };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'extractProduct') {
      try {
        sendResponse({ success: true, data: extract() });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    }
    return true;
  });
})();
