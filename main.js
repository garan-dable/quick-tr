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
    Z_INDEX: 9999999,
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

    panelEl.style.setProperty('background', v.panelBg);
    panelEl.style.setProperty('color', v.panelFg);
    panelEl.style.setProperty(
      'box-shadow',
      theme === 'dark'
        ? '0 0 0 1px rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.40)'
        : '0 0 0 1px rgba(0,0,0,0.08), 0 12px 28px rgba(0,0,0,0.18)'
    );

    const header = panelEl.querySelector('[data-role="header"]');
    const footer = panelEl.querySelector('[data-role="footer"]');

    if (header) {
      header.style.setProperty('border-bottom', `1px solid ${v.borderSoft}`);
    }
    if (footer) {
      footer.style.setProperty('border-top', `1px solid ${v.borderSoft}`);
    }

    panelEl.querySelectorAll('button[data-role="btn"]').forEach((btn) => {
      btn.style.setProperty('padding', '4px 10px');
      btn.style.setProperty('font-size', '12px');
      btn.style.setProperty('font-family', 'inherit');
      btn.style.setProperty('border', `1px solid ${v.border}`);
      btn.style.setProperty('border-radius', '8px');
      btn.style.setProperty('color', v.panelFg);
      btn.style.setProperty('background', 'transparent');
      btn.style.setProperty('box-sizing', 'border-box');
      btn.style.setProperty('cursor', 'pointer');

      if (!btn.dataset.hoverListener) {
        btn.dataset.hoverListener = 'true';
        btn.addEventListener('mouseenter', function () {
          const currentTheme = panelEl?.dataset.theme || getTheme();
          const hoverBg =
            currentTheme === 'dark'
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.04)';
          this.style.setProperty('background', hoverBg);
        });
        btn.addEventListener('mouseleave', function () {
          this.style.setProperty('background', 'transparent');
        });
      }
    });

    panelEl.querySelectorAll('[data-role="card"]').forEach((card) => {
      card.style.setProperty('border', `1px solid ${v.border}`);
      card.style.setProperty('background', v.cardBg);
      card.style.setProperty('color', v.panelFg);
    });
    panelEl.querySelectorAll('[data-role="subtle"]').forEach((el) => {
      el.style.setProperty('color', v.subtle);
    });
    panelEl.querySelectorAll('[data-role="subtle2"]').forEach((el) => {
      el.style.setProperty('color', v.subtle2);
    });
    panelEl.querySelectorAll('[data-role="empty-message"]').forEach((el) => {
      el.style.setProperty('color', v.subtle2);
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

  function isTypingSurface(target) {
    const tag = target?.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || target?.isContentEditable;
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        // @ts-ignore - execCommand is deprecated but needed as fallback for older browsers
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }

  // =========================
  // Panel (open/close)
  // =========================
  function openPanel() {
    ensurePanel();
    panelEl.style.setProperty('display', 'flex');
  }

  function closePanel() {
    if (panelEl) panelEl.style.setProperty('display', 'none');
  }

  function updateEmptyState() {
    if (!emptyMessageEl || !listEl) return;
    const cards = listEl.querySelectorAll('[data-role="card"]');
    const hasCards = cards.length > 0;
    emptyMessageEl.style.setProperty('display', hasCards ? 'none' : 'block');
  }

  // =========================
  // UI building
  // =========================
  function ensurePanel() {
    if (panelEl && document.body.contains(panelEl)) return;
    if (panelEl && !document.body.contains(panelEl)) {
      panelEl = null;
      listEl = null;
      emptyMessageEl = null;
    }

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
        
        #__tm_translate_panel__ [data-role="source-text"],
        #__tm_translate_panel__ [data-role="result-text"] {
          margin: 0;
          padding: 0;
          border: none;
          box-sizing: border-box;
          line-height: 1.4;
          font-family: inherit;
          display: inline-block;
          width: 100%;
          position: relative;
        }
        
        #__tm_translate_panel__ [data-role="source-text"]:hover,
        #__tm_translate_panel__ [data-role="result-text"]:not([data-status="error"]):not([data-status="loading"]):hover {
          background: rgba(128, 128, 128, 0.1);
          text-decoration: underline;
          text-decoration-style: dotted;
          cursor: pointer;
        }
        
        #__tm_translate_panel__ [data-role="source-text"]:hover::after,
        #__tm_translate_panel__ [data-role="result-text"]:not([data-status="error"]):not([data-status="loading"]):hover::after {
          content: '';
          display: inline-block;
          width: 10px;
          height: 10px;
          margin-left: 6px;
          vertical-align: middle;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' ry='2'%3E%3C/rect%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'%3E%3C/path%3E%3C/svg%3E");
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          opacity: 0.5;
        }
        
        #__tm_translate_panel__ [data-role="source-text"]:active::after,
        #__tm_translate_panel__ [data-role="result-text"]:not([data-status="error"]):not([data-status="loading"]):active::after {
          opacity: 1;
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
    title.textContent = '🌎 QuickTR';
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
    closeBtn.addEventListener('click', () => closePanel());

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.dataset.role = 'body';
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
    clearBtn.style.cssText = `margin-left: auto;`;
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

  function updateTranslationText(dstEl, resultText, status = 'completed') {
    const isError = status === 'error';
    const isLoading = status === 'loading';
    const textColor = isError ? 'red' : resultText ? 'blue' : 'inherit';
    const displayText = resultText || (isLoading ? '번역 중…' : '결과 없음');

    while (dstEl.firstChild) dstEl.removeChild(dstEl.firstChild);

    const label = document.createElement('div');
    label.dataset.role = 'subtle2';
    label.textContent = '번역';
    label.style.cssText = `
      font-size: 11px;
      margin: 6px 0 2px 0;
      line-height: 1.4;
    `;

    const content = document.createElement('div');
    content.dataset.role = 'result-text';
    content.dataset.status = status;
    content.textContent = displayText;
    content.style.cssText = `color: ${textColor};`;

    if (!isError && resultText) {
      content.addEventListener('click', async () => {
        await copyToClipboard(resultText);
      });
    }

    dstEl.appendChild(label);
    dstEl.appendChild(content);
  }

  function addHistoryItem({ sourceText, resultText, status, meta }) {
    ensurePanel();

    const item = document.createElement('div');
    item.dataset.role = 'card';
    item.dataset.status = status;
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
    removeBtn.setAttribute('aria-label', 'remove');
    removeBtn.style.cssText = `
      position: absolute;
      top: 6px;
      right: 6px;
      width: 20px;
      height: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      font-family: inherit;
    `;
    const removeBtnText = document.createElement('span');
    removeBtnText.textContent = '×';
    removeBtnText.style.cssText = `
      transform: translateY(-1px);
      display: inline-block;
      border: none;
      box-sizing: border-box;
      font-size: 18px;
      line-height: 1;
      font-family: inherit;
      opacity: 0.5;
    `;
    removeBtn.appendChild(removeBtnText);
    removeBtn.addEventListener('mouseenter', () => {
      removeBtnText.style.setProperty('opacity', '1');
    });
    removeBtn.addEventListener('mouseleave', () => {
      removeBtnText.style.setProperty('opacity', '0.5');
    });
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

    const srcLabel = document.createElement('div');
    srcLabel.dataset.role = 'subtle2';
    srcLabel.textContent = '원문';
    srcLabel.style.cssText = `
    font-size: 11px;
    margin-bottom: 2px;
    line-height: 1.4;
  `;

    const srcContent = document.createElement('div');
    srcContent.dataset.role = 'source-text';
    srcContent.textContent = sourceText || '';

    if (sourceText) {
      srcContent.addEventListener('click', async () => {
        await copyToClipboard(sourceText);
      });
    }

    src.appendChild(srcLabel);
    src.appendChild(srcContent);

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
    updateTranslationText(dst, resultText || '', status);

    const metaLine = document.createElement('div');
    metaLine.dataset.role = 'subtle2';
    metaLine.textContent = meta || '';
    metaLine.style.cssText = `
      font-size: 11px;
      line-height: 1.4;
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

    const body = panelEl.querySelector('[data-role="body"]');
    if (body) body.scrollTop = 0;

    updateEmptyState();
    applyTheme();

    return {
      setTranslated(text, status = 'completed') {
        updateTranslationText(dst, text, status);
        item.dataset.status = status;
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
            const error =
              err instanceof Error
                ? err
                : new Error('Failed to parse response');
            reject(error);
          }
        },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Timeout')),
      });
    });
  }

  async function translateText(text) {
    if (pending) {
      openPanel();
      return;
    }
    if (!text?.trim()) return;

    openPanel();
    pending = true;

    const ui = addHistoryItem({
      sourceText: text,
      resultText: '',
      status: 'loading',
      meta: '',
    });

    try {
      if (text.length > CONFIG.MAX_CHARS) {
        throw new Error(
          `최대 번역 가능한 글자수는 ${CONFIG.MAX_CHARS.toLocaleString(
            'ko-KR'
          )}자입니다.`
        );
      }
      const startedAt = Date.now();
      const data = await requestTranslateTo(text);
      const elapsed = Date.now() - startedAt;

      ui.setTranslated(data.result);

      const parts = [];
      parts.push(`${elapsed}ms`);
      ui.setMeta(parts.join(' · '));
    } catch (err) {
      ui.setTranslated(`에러: ${String(err?.message || err)}`, 'error');
    } finally {
      pending = false;
    }
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

      await translateText(selected);
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
