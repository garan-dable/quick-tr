(function () {
  'use strict';

  // =========================
  // Config
  // =========================
  const CONFIG = {
    HOTKEY: { alt: true, ctrl: false, shift: false, meta: false },
    N8N_WEBHOOK_URL: 'https://teamdable.app.n8n.cloud/webhook/quick-tr',
    API_KEY: 'quick_tr_9f3a1d7c8b4e2a6d0c1f9e7a5b3d2c1a',
    API_KEY_HEADER: 'X-API-Key',
    MAX_CHARS: 3000,
    PANEL_WIDTH_PX: 300,
    Z_INDEX: 9999,
    OPACITY: 0.95,
    TIMEOUT: 20000,
  };

  // =========================
  // State
  // =========================
  let panelEl = null;
  let listEl = null;
  let emptyMessageEl = null;
  let pending = false;

  // =========================
  // Theme helpers
  // =========================
  function getTheme() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function themeVars(theme) {
    if (theme === 'dark') {
      return {
        panelBg: '#141416',
        panelFg: '#ffffff',
        border: 'rgba(255,255,255,0.14)',
        borderSoft: 'rgba(255,255,255,0.10)',
        cardBg: 'rgba(255,255,255,0.06)',
        badgeBorder: 'rgba(255,255,255,0.18)',
        subtle: 'rgba(255,255,255,0.70)',
        subtle2: 'rgba(255,255,255,0.55)',
      };
    }
    return {
      panelBg: '#ffffff',
      panelFg: '#111113',
      border: 'rgba(0,0,0,0.14)',
      borderSoft: 'rgba(0,0,0,0.10)',
      cardBg: 'rgba(0,0,0,0.04)',
      badgeBorder: 'rgba(0,0,0,0.16)',
      subtle: 'rgba(0,0,0,0.70)',
      subtle2: 'rgba(0,0,0,0.55)',
    };
  }

  function applyTheme() {
    if (!panelEl || !document.body.contains(panelEl)) return;
    const theme = getTheme();
    const v = themeVars(theme);

    panelEl.dataset.theme = theme;

    panelEl.style.setProperty('background', v.panelBg, 'important');
    panelEl.style.setProperty('color', v.panelFg, 'important');
    panelEl.style.setProperty(
      'box-shadow',
      theme === 'dark'
        ? '0 0 0 1px rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.40)'
        : '0 0 0 1px rgba(0,0,0,0.08), 0 12px 28px rgba(0,0,0,0.18)',
      'important'
    );

    const header = panelEl.querySelector('[data-role="header"]');
    const footer = panelEl.querySelector('[data-role="footer"]');

    if (header)
      header.style.setProperty(
        'border-bottom',
        `1px solid ${v.borderSoft}`,
        'important'
      );
    if (footer)
      footer.style.setProperty(
        'border-top',
        `1px solid ${v.borderSoft}`,
        'important'
      );

    panelEl.querySelectorAll('button[data-role="btn"]').forEach((btn) => {
      btn.style.setProperty('border', `1px solid ${v.border}`, 'important');
      btn.style.setProperty('color', v.panelFg, 'important');
      btn.style.setProperty('background', 'transparent', 'important');

      if (!btn.dataset.hoverListener) {
        btn.dataset.hoverListener = 'true';
        btn.addEventListener('mouseenter', function () {
          const currentTheme = panelEl?.dataset.theme || getTheme();
          const hoverBg =
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.04)';
          this.style.setProperty('background', hoverBg, 'important');
        });
        btn.addEventListener('mouseleave', function () {
          this.style.setProperty('background', 'transparent', 'important');
        });
      }
    });

    panelEl.querySelectorAll('[data-role="card"]').forEach((card) => {
      card.style.setProperty('border', `1px solid ${v.border}`, 'important');
      card.style.setProperty('background', v.cardBg, 'important');
      card.style.setProperty('color', v.panelFg, 'important');
    });

    panelEl.querySelectorAll('[data-role="subtle"]').forEach((el) => {
      el.style.setProperty('color', v.subtle, 'important');
    });
    panelEl.querySelectorAll('[data-role="subtle2"]').forEach((el) => {
      el.style.setProperty('color', v.subtle2, 'important');
    });
    panelEl.querySelectorAll('[data-role="empty-message"]').forEach((el) => {
      el.style.setProperty('color', v.subtle2, 'important');
    });
  }

  // react to browser theme changes
  const mql = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  if (mql && typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', () => applyTheme());
  }

  // =========================
  // Helpers
  // =========================
  function matchesHotkey(e) {
    return (
      e.code === 'KeyT' &&
      e.altKey === CONFIG.HOTKEY.alt &&
      e.ctrlKey === CONFIG.HOTKEY.ctrl &&
      e.shiftKey === CONFIG.HOTKEY.shift &&
      e.metaKey === CONFIG.HOTKEY.meta
    );
  }

  function getSelectedText() {
    return window.getSelection?.().toString().trim() || '';
  }

  function escapeHtml(str) {
    return str
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function isTypingSurface(target) {
    const tag = target?.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || target?.isContentEditable;
  }

  // =========================
  // Panel (open/close)
  // =========================
  function openPanel() {
    ensurePanel();
    panelEl.style.setProperty('display', 'flex', 'important');
  }

  function closePanel() {
    if (panelEl) panelEl.style.setProperty('display', 'none', 'important');
  }

  function updateEmptyState() {
    if (!emptyMessageEl || !listEl) return;
    const cards = listEl.querySelectorAll('[data-role="card"]');
    const hasCards = cards.length > 0;
    emptyMessageEl.style.setProperty(
      'display',
      hasCards ? 'none' : 'block',
      'important'
    );
  }

  // =========================
  // UI building
  // =========================
  function ensurePanel() {
    if (panelEl && document.body.contains(panelEl)) return;

    // Root panel
    panelEl = document.createElement('div');
    panelEl.id = '__tm_translate_panel__';
    panelEl.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      width: ${CONFIG.PANEL_WIDTH_PX}px;
      z-index: ${CONFIG.Z_INDEX};
      display: none;
      flex-direction: column;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      opacity: ${CONFIG.OPACITY};
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      border: none;
      line-height: 1.4;
    `;

    const STYLE_ID = '__tm_trbot_styles__';
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        /* TR Bot UI: Complete CSS isolation */
        #__tm_translate_panel__,
        #__tm_translate_panel__ *,
        #__tm_translate_panel__ *::before,
        #__tm_translate_panel__ *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          border: 0;
          font-size: inherit;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          line-height: 1.4;
          vertical-align: baseline;
          background: transparent;
          text-decoration: none;
          list-style: none;
          quotes: none;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        #__tm_translate_panel__ {
          all: initial;
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          width: ${CONFIG.PANEL_WIDTH_PX}px;
          z-index: ${CONFIG.Z_INDEX};
          display: none;
          flex-direction: column;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          opacity: ${CONFIG.OPACITY};
          box-sizing: border-box;
        }
        
        #__tm_translate_panel__ button,
        #__tm_translate_panel__ [role="button"],
        #__tm_translate_panel__ [tabindex] {
          -webkit-tap-highlight-color: transparent;
          cursor: pointer;
          user-select: none;
        }
        
        #__tm_translate_panel__ button:focus,
        #__tm_translate_panel__ button:focus-visible,
        #__tm_translate_panel__ [role="button"]:focus,
        #__tm_translate_panel__ [role="button"]:focus-visible,
        #__tm_translate_panel__ [tabindex]:focus,
        #__tm_translate_panel__ [tabindex]:focus-visible {
          outline: none;
          box-shadow: none;
        }
        
        #__tm_translate_panel__ div {
          display: block;
        }
        
        #__tm_translate_panel__ span {
          display: inline;
        }
        
        #__tm_translate_panel__ [data-role="card"] {
          transition: opacity 0.25s ease-out, transform 0.25s ease-out;
          opacity: 0;
          transform: translateY(-8px) scale(0.98);
        }
        
        #__tm_translate_panel__ [data-role="card"].card-enter {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        
        #__tm_translate_panel__ [data-role="card"].card-exit {
          opacity: 0;
          transform: translateY(-8px) scale(0.98);
        }
      `;

      document.head.appendChild(style);
    }

    // Header
    const header = document.createElement('div');
    header.dataset.role = 'header';
    header.style.cssText = `
      padding: 12px 12px 10px;
      display: flex;
      align-items: center;
      box-sizing: border-box;
      margin: 0;
      border: none;
    `;

    const title = document.createElement('div');
    title.textContent = '🌐 QuickTR';
    title.style.cssText = `
      font-weight: 700;
      font-size: 16px;
      flex: 1;
      margin: 0;
      padding: 0;
      border: none;
      line-height: 1.4;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.dataset.role = 'btn';
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText = `
      padding: 6px 10px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 12px;
      margin: 0;
      border: 1px solid transparent;
      box-sizing: border-box;
      line-height: 1.4;
      font-family: inherit;
    `;
    closeBtn.addEventListener('click', () => closePanel());

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 12px;
      box-sizing: border-box;
      margin: 0;
      border: none;
    `;

    listEl = document.createElement('div');
    listEl.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      border: none;
      box-sizing: border-box;
    `;

    body.appendChild(listEl);

    emptyMessageEl = document.createElement('div');
    emptyMessageEl.dataset.role = 'empty-message';
    emptyMessageEl.textContent = '문구를 드래그하고 Alt+T 키를 눌러주세요.';
    emptyMessageEl.style.cssText = `
      text-align: center;
      padding: 40px 0;
      color: inherit;
      font-size: 13px;
      margin: 0;
      border: none;
      box-sizing: border-box;
      line-height: 1.4;
      font-family: inherit;
    `;

    listEl.appendChild(emptyMessageEl);

    const footer = document.createElement('div');
    footer.dataset.role = 'footer';
    footer.style.cssText = `
      padding: 10px 12px;
      display: flex;
      align-items: center;
      box-sizing: border-box;
      margin: 0;
      border: none;
    `;

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.dataset.role = 'btn';
    clearBtn.textContent = '전체 지우기';
    clearBtn.style.cssText = `
      padding: 7px 10px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 12px;
      margin-left: auto;
      margin-top: 0;
      margin-right: 0;
      margin-bottom: 0;
      border: 1px solid transparent;
      box-sizing: border-box;
      line-height: 1.4;
      font-family: inherit;
    `;
    clearBtn.onclick = () => {
      const items = listEl.querySelectorAll('[data-role="card"]');
      items.forEach((item) => {
        if (item.dataset.status !== 'loading') {
          item.classList.remove('card-enter');
          item.classList.add('card-exit');
        }
      });
      setTimeout(() => {
        items.forEach((item) => {
          if (item.dataset.status !== 'loading' && item.parentNode) {
            item.remove();
          }
        });
        updateEmptyState();
      }, 300);
    };

    footer.appendChild(clearBtn);
    panelEl.appendChild(header);
    panelEl.appendChild(body);
    panelEl.appendChild(footer);
    document.body.appendChild(panelEl);

    applyTheme();
  }

  function updateTranslationText(
    dstEl,
    resultText,
    isError = false,
    isLoading = false
  ) {
    const textColor = isError ? 'red' : resultText ? 'blue' : 'inherit';
    const displayText = resultText || (isLoading ? '번역 중…' : '결과 없음');
    dstEl.innerHTML = `<div data-role="subtle2" style="font-size:11px; margin-bottom:2px; margin-top:5px; margin-left:0; margin-right:0; padding:0; border:none; box-sizing:border-box; line-height:1.4; font-family:inherit;">번역</div><div style="margin:0; padding:0; border:none; box-sizing:border-box; line-height:1.4; font-family:inherit; color:${textColor};">${escapeHtml(
      displayText
    )}</div>`;
  }

  function addHistoryItem({ sourceText, resultText, status, meta }) {
    ensurePanel();

    const item = document.createElement('div');
    item.dataset.role = 'card';
    item.dataset.status = status || 'completed';
    item.style.cssText = `
      position: relative;
      border-radius: 14px;
      padding: 10px 13px;
      box-sizing: border-box;
      margin: 0;
      border: 1px solid transparent;
    `;

    const topRow = document.createElement('div');
    topRow.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 0;
      padding: 0;
      border: none;
      box-sizing: border-box;
    `;

    const spacer = document.createElement('div');
    spacer.style.cssText = `
      flex: 1;
      margin: 0;
      padding: 0;
      border: none;
      box-sizing: border-box;
    `;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.dataset.role = 'btn';
    removeBtn.setAttribute('aria-label', 'remove');
    removeBtn.style.cssText = `
      position: absolute;
      top: 6px;
      right: 6px;
      width: 20px;
      height: 20px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 0;
      border: 1px solid transparent;
      box-sizing: border-box;
      line-height: 1;
      font-family: inherit;
    `;
    const removeBtnText = document.createElement('span');
    removeBtnText.textContent = '×';
    removeBtnText.style.cssText = `
      transform: translateY(-1px);
      display: inline-block;
      margin: 0;
      padding: 0;
      border: none;
      box-sizing: border-box;
      line-height: 1;
      font-family: inherit;
    `;
    removeBtn.appendChild(removeBtnText);
    removeBtn.addEventListener('click', () => {
      if (item.dataset.status !== 'loading') {
        item.classList.remove('card-enter');
        item.classList.add('card-exit');
        setTimeout(() => {
          if (item.parentNode) {
            item.remove();
            updateEmptyState();
          }
        }, 300);
      }
    });

    topRow.appendChild(spacer);
    topRow.appendChild(removeBtn);

    const src = document.createElement('div');
    src.style.cssText = `
      margin: 0;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      box-sizing: border-box;
      border: none;
      line-height: 1.4;
      font-family: inherit;
    `;
    src.innerHTML = `<div data-role="subtle2" style="font-size:11px; margin-bottom:2px; margin-top:0; margin-left:0; margin-right:0; padding:0; border:none; box-sizing:border-box; line-height:1.4; font-family:inherit;">원문</div><div style="margin:0; padding:0; border:none; box-sizing:border-box; line-height:1.4; font-family:inherit;">${escapeHtml(
      sourceText || ''
    )}</div>`;

    const dst = document.createElement('div');
    dst.style.cssText = `
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      box-sizing: border-box;
      border: none;
      line-height: 1.4;
      font-family: inherit;
    `;
    updateTranslationText(dst, resultText || '', false, status === 'loading');

    const metaLine = document.createElement('div');
    metaLine.dataset.role = 'subtle2';
    metaLine.textContent = meta || '';
    metaLine.style.cssText = `
      font-size: 11px;
      margin: 0;
      padding: 0;
      border: none;
      box-sizing: border-box;
      line-height: 1.4;
      font-family: inherit;
    `;

    item.appendChild(topRow);
    item.appendChild(src);
    item.appendChild(dst);
    item.appendChild(metaLine);
    listEl.prepend(item);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        item.classList.add('card-enter');
      });
    });

    const body = panelEl.querySelector('div[style*="overflow: auto"]');
    if (body) body.scrollTop = 0;

    updateEmptyState();
    applyTheme();

    return {
      setTranslated(text, isError = false) {
        updateTranslationText(dst, text, isError, false);
        item.dataset.status = isError ? 'error' : 'completed';
        applyTheme();
      },
      setMeta(text) {
        metaLine.textContent = text || '';
        applyTheme();
      },
    };
  }

  // =========================
  // Network
  // =========================
  function requestTranslateTo(text) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        text,
        pageUrl: location.href,
        title: document.title,
      });

      GM_xmlhttpRequest({
        method: 'POST',
        url: CONFIG.N8N_WEBHOOK_URL,
        headers: {
          'Content-Type': 'application/json',
          [CONFIG.API_KEY_HEADER]: CONFIG.API_KEY,
        },
        data: payload,
        timeout: CONFIG.TIMEOUT,
        onload: (res) => {
          if (res.status !== 200) {
            reject(new Error(`${res.status} ${res.statusText || 'Error'}`));
            return;
          }
          try {
            const json = JSON.parse(res.response);
            if (!json.result) throw new Error('Missing or invalid result');
            resolve(json);
          } catch (err) {
            reject(err);
          }
        },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Timeout')),
      });
    });
  }

  // =========================
  // Hotkey
  // =========================
  window.addEventListener(
    'keydown',
    async (e) => {
      if (!matchesHotkey(e)) return;
      if (isTypingSurface(e.target)) return;

      e.preventDefault();
      if (pending) return;

      const selected = getSelectedText();
      if (!selected?.length) {
        openPanel();
        return;
      }

      openPanel();
      pending = true;

      const ui = addHistoryItem({
        sourceText: selected,
        resultText: '',
        status: 'loading',
        meta: '',
      });

      try {
        if (selected.length > CONFIG.MAX_CHARS) {
          throw new Error(
            `최대 번역 가능한 글자수는 ${CONFIG.MAX_CHARS.toLocaleString(
              'ko-KR'
            )}자입니다.`
          );
        }
        const startedAt = Date.now();
        const data = await requestTranslateTo(selected);
        const elapsed = Date.now() - startedAt;

        ui.setTranslated(data.result);

        const parts = [];
        parts.push(`${elapsed}ms`);
        ui.setMeta(parts.join(' · '));
      } catch (err) {
        ui.setTranslated(`에러: ${String(err?.message || err)}`, true);
      } finally {
        pending = false;
      }
    },
    true
  );

  // ESC closes panel (optional)
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') closePanel();
    },
    true
  );
})();
