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
    PANEL_WIDTH_MIN_PX: 276,
    PANEL_WIDTH_MAX_PX: 900,
    PANEL_WIDTH_STORAGE_KEY: 'quick-tr-panel-width',
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
  // Panel width (persisted across all sites via GM storage)
  // =========================
  function clampPanelWidth(width) {
    const max = Math.min(CONFIG.PANEL_WIDTH_MAX_PX, window.innerWidth * 0.8);
    return Math.max(CONFIG.PANEL_WIDTH_MIN_PX, Math.min(max, width));
  }

  function getSavedPanelWidth() {
    let saved = CONFIG.PANEL_WIDTH_PX;
    if (typeof GM_getValue === 'function') {
      saved = GM_getValue(
        CONFIG.PANEL_WIDTH_STORAGE_KEY,
        CONFIG.PANEL_WIDTH_PX,
      );
    }
    return clampPanelWidth(Number(saved) || CONFIG.PANEL_WIDTH_PX);
  }

  function savePanelWidth(width) {
    if (typeof GM_setValue === 'function') {
      GM_setValue(CONFIG.PANEL_WIDTH_STORAGE_KEY, width);
    }
  }

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
        panelBg: '#0e0f13',
        panelFg: '#f4f4f6',
        border: 'rgba(255,255,255,0.14)',
        borderSoft: 'rgba(255,255,255,0.10)',
        cardBg: 'rgba(255,255,255,0.04)',
        cardShadow: '0 0 0 1px rgba(255,255,255,0.06)',
        divider: 'rgba(255,255,255,0.08)',
        badgeBorder: 'rgba(255,255,255,0.18)',
        subtle: 'rgba(255,255,255,0.55)',
        subtle2: 'rgba(255,255,255,0.55)',
        meta: 'rgba(255,255,255,0.38)',
        accent: '#8b7dff',
        accentHover: '#7a6cf0',
        accentSoft: 'rgba(139,125,255,0.16)',
        badgeBg: 'rgba(255,255,255,0.08)',
        badgeFg: 'rgba(255,255,255,0.55)',
        errorFg: '#f87171',
        hoverSoft: 'rgba(255,255,255,0.10)',
      };
    }
    return {
      panelBg: '#ffffff',
      panelFg: '#1a1a1e',
      border: 'rgba(0,0,0,0.14)',
      borderSoft: 'rgba(0,0,0,0.10)',
      cardBg: '#ffffff',
      cardShadow: '0 2px 10px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
      divider: 'rgba(0,0,0,0.07)',
      badgeBorder: 'rgba(0,0,0,0.16)',
      subtle: 'rgba(0,0,0,0.55)',
      subtle2: 'rgba(0,0,0,0.55)',
      meta: 'rgba(0,0,0,0.40)',
      accent: '#6d5ef0',
      accentHover: '#5d4ee0',
      accentSoft: 'rgba(109,94,240,0.10)',
      badgeBg: 'rgba(0,0,0,0.06)',
      badgeFg: 'rgba(0,0,0,0.55)',
      errorFg: '#dc2626',
      hoverSoft: 'rgba(0,0,0,0.04)',
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
        : '0 0 0 1px rgba(0,0,0,0.08), 0 12px 28px rgba(0,0,0,0.18)',
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
      const isPrimary = btn.dataset.variant === 'primary';

      btn.style.setProperty('padding', '7px 11px');
      btn.style.setProperty('font-size', '12.5px');
      btn.style.setProperty('font-weight', isPrimary ? '600' : '500');
      btn.style.setProperty('font-family', 'inherit');
      btn.style.setProperty('border', `1px solid ${v.border}`);
      btn.style.setProperty('border-radius', '9px');
      btn.style.setProperty('box-sizing', 'border-box');
      btn.style.setProperty('cursor', 'pointer');
      btn.style.setProperty('display', 'inline-flex');
      btn.style.setProperty('align-items', 'center');
      btn.style.setProperty('justify-content', 'center');
      btn.style.setProperty('gap', '4px');

      if (isPrimary) {
        btn.style.setProperty('color', '#ffffff');
        btn.style.setProperty('background', v.accent);
        btn.style.setProperty('border-color', v.accent);
      } else {
        btn.style.setProperty('color', v.panelFg);
        btn.style.setProperty('background', 'transparent');
      }

      if (!btn.dataset.hoverListener) {
        btn.dataset.hoverListener = 'true';
        btn.addEventListener('mouseenter', function () {
          const tv = themeVars(panelEl?.dataset.theme || getTheme());
          this.style.setProperty(
            'background',
            this.dataset.variant === 'primary' ? tv.accentHover : tv.hoverSoft,
          );
        });
        btn.addEventListener('mouseleave', function () {
          const tv = themeVars(panelEl?.dataset.theme || getTheme());
          this.style.setProperty(
            'background',
            this.dataset.variant === 'primary' ? tv.accent : 'transparent',
          );
        });
      }
    });

    panelEl.querySelectorAll('[data-role="logo-icon"]').forEach((el) => {
      el.style.setProperty('background-color', v.accent);
    });
    panelEl.querySelectorAll('[data-role="card"]').forEach((card) => {
      card.style.setProperty('background', v.cardBg);
      card.style.setProperty('box-shadow', v.cardShadow);
      card.style.setProperty('color', v.panelFg);
    });
    panelEl.querySelectorAll('[data-role="dst-row"]').forEach((row) => {
      row.style.setProperty('border-top-color', v.divider);
    });
    panelEl.querySelectorAll('[data-role="lang-en"]').forEach((el) => {
      el.style.setProperty('background', v.badgeBg);
      el.style.setProperty('color', v.badgeFg);
    });
    panelEl.querySelectorAll('[data-role="lang-ko"]').forEach((el) => {
      el.style.setProperty('background', v.accentSoft);
      el.style.setProperty('color', v.accent);
    });
    panelEl.querySelectorAll('[data-role="source-text"]').forEach((el) => {
      el.style.setProperty('color', v.subtle);
    });
    panelEl.querySelectorAll('[data-role="result-text"]').forEach((el) => {
      const st = el.dataset.status;
      el.style.setProperty(
        'color',
        st === 'error' ? v.errorFg : st === 'loading' ? v.subtle : v.panelFg,
      );
    });
    panelEl.querySelectorAll('[data-role="meta"]').forEach((el) => {
      el.style.setProperty('color', v.meta);
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
    panelEl.querySelectorAll('textarea').forEach((textarea) => {
      textarea.style.setProperty('border-color', v.border);
      textarea.style.setProperty('color', v.panelFg);
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

  // Lucide 아이콘 (mask-image 방식: 색은 버튼 글자색 currentColor를 따라감)
  const ICON_SVG = {
    globe:
      "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><path d='M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20'/><path d='M2 12h20'/></svg>",
    close:
      "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M18 6 6 18'/><path d='m6 6 12 12'/></svg>",
    trash:
      "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 6h18'/><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/><line x1='10' x2='10' y1='11' y2='17'/><line x1='14' x2='14' y1='11' y2='17'/></svg>",
    translate:
      "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m5 8 6 6'/><path d='m4 14 6-6 2-3'/><path d='M2 5h12'/><path d='M7 2h1'/><path d='m22 22-5-10-5 10'/><path d='M14 18h6'/></svg>",
  };

  function makeButtonIcon(name, size = 14) {
    const uri = `data:image/svg+xml,${encodeURIComponent(ICON_SVG[name])}`;
    const span = document.createElement('span');
    span.dataset.role = 'btn-icon';
    span.style.cssText = `
      display: inline-block;
      width: ${size}px;
      height: ${size}px;
      flex: none;
      background-color: currentColor;
      -webkit-mask: url("${uri}") center / contain no-repeat;
      mask: url("${uri}") center / contain no-repeat;
    `;
    return span;
  }

  function setButtonContent(btn, iconName, label) {
    btn.textContent = '';
    btn.appendChild(makeButtonIcon(iconName));
    const text = document.createElement('span');
    text.textContent = label;
    btn.appendChild(text);
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
      width: ${getSavedPanelWidth()}px;
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
        
        #__tm_translate_panel__ textarea {
          box-sizing: border-box;
          font-family: inherit;
          font-size: inherit;
          line-height: inherit;
        }
        
        /* Scrollbar styling */
        #__tm_translate_panel__ * {
          scrollbar-width: thin;
        }
        
        #__tm_translate_panel__[data-theme="dark"] * {
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }
        
        #__tm_translate_panel__[data-theme="light"] * {
          scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
        }
        
        #__tm_translate_panel__ *::-webkit-scrollbar {
          width: 3px;
          height: 3px;
        }
        
        #__tm_translate_panel__ *::-webkit-scrollbar-track {
          background: transparent;
        }
        
        #__tm_translate_panel__[data-theme="dark"] *::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        
        #__tm_translate_panel__[data-theme="light"] *::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
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
    title.style.cssText = `
      font-weight: 700;
      font-size: 14px;
      flex: 1;
      margin: 0;
      padding: 0;
      border: none;
      line-height: 1.4;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    const logoIcon = makeButtonIcon('globe', 18);
    logoIcon.dataset.role = 'logo-icon';
    const titleText = document.createElement('span');
    titleText.textContent = 'QUICK-TR';
    title.appendChild(logoIcon);
    title.appendChild(titleText);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.dataset.role = 'btn';
    clearBtn.dataset.variant = 'secondary';
    setButtonContent(clearBtn, 'trash', '히스토리 삭제');
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

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.dataset.role = 'btn';
    closeBtn.dataset.variant = 'secondary';
    setButtonContent(closeBtn, 'close', '닫기');
    closeBtn.addEventListener('click', () => closePanel());

    header.appendChild(title);

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
      padding: 12px;
      padding-bottom: 10px;
      display: flex;
      flex-direction: column;
      gap: 9px;
      box-sizing: border-box;
      margin: 0;
      border: none;
    `;

    const textarea = document.createElement('textarea');
    textarea.placeholder =
      '문구를 직접 입력하려면 작성 후 [번역] 버튼 또는 Enter 키를 눌러주세요.';
    textarea.rows = 3;
    textarea.id = 'quick-tr-textarea';
    textarea.style.cssText = `
      width: 100%;
      padding: 8px;
      font-size: 13px;
      font-family: inherit;
      border: 1px solid transparent;
      border-radius: 8px;
      resize: none;
      box-sizing: border-box;
      line-height: 1.4;
      color: inherit;
    `;

    if (!document.getElementById('quick-tr-textarea-style')) {
      const style = document.createElement('style');
      style.id = 'quick-tr-textarea-style';
      style.textContent = `
        #quick-tr-textarea::placeholder {
          opacity: 0.8;
        }
      `;
      document.head.appendChild(style);
    }

    // Handle Enter key (translate) and Shift+Enter (newline)
    textarea.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = textarea.value.trim();
        if (text) {
          await translateText(text);
          textarea.value = '';
        }
      }
      // Shift+Enter allows default behavior (newline)
    });

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.dataset.role = 'btn';
    submitBtn.dataset.variant = 'primary';
    setButtonContent(submitBtn, 'translate', '번역');
    submitBtn.onclick = async () => {
      const text = textarea.value.trim();
      if (text) {
        await translateText(text);
        textarea.value = '';
      }
    };

    const footerButtonGroup = document.createElement('div');
    footerButtonGroup.style.cssText = `
      display: flex;
      gap: 7px;
      justify-content: space-between;
      align-items: center;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      border: none;
    `;

    const footerRightGroup = document.createElement('div');
    footerRightGroup.style.cssText = `
      display: flex;
      gap: 7px;
      align-items: center;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      border: none;
    `;
    footerRightGroup.appendChild(clearBtn);
    footerRightGroup.appendChild(submitBtn);

    footerButtonGroup.appendChild(closeBtn);
    footerButtonGroup.appendChild(footerRightGroup);
    footer.appendChild(textarea);
    footer.appendChild(footerButtonGroup);

    // Resize handle (left edge — drag to adjust panel width)
    const resizeHandle = document.createElement('div');
    resizeHandle.dataset.role = 'resize-handle';
    resizeHandle.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 6px;
      height: 100%;
      cursor: ew-resize;
      z-index: 1;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
    `;
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = panelEl.getBoundingClientRect().width;
      const prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';

      const onMouseMove = (moveEvent) => {
        // Panel is anchored to the right, so dragging left widens it.
        const nextWidth = clampPanelWidth(
          startWidth + (startX - moveEvent.clientX),
        );
        panelEl.style.width = `${nextWidth}px`;
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.userSelect = prevUserSelect;
        savePanelWidth(panelEl.getBoundingClientRect().width);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    panelEl.appendChild(resizeHandle);
    panelEl.appendChild(header);
    panelEl.appendChild(body);
    panelEl.appendChild(footer);
    document.body.appendChild(panelEl);

    applyTheme();
  }

  function updateTranslationText(el, resultText, status = 'completed') {
    const isError = status === 'error';
    const isLoading = status === 'loading';
    const displayText = resultText || (isLoading ? '번역 중…' : '결과 없음');

    el.dataset.status = status;
    el.textContent = displayText;

    const v = themeVars(panelEl?.dataset.theme || getTheme());
    el.style.setProperty(
      'color',
      isError ? v.errorFg : isLoading || !resultText ? v.subtle : v.panelFg,
    );

    if (!isError && resultText) {
      el.dataset.copyText = resultText;
      if (!el.dataset.copyBound) {
        el.dataset.copyBound = 'true';
        el.addEventListener('click', async () => {
          await copyToClipboard(el.dataset.copyText || '');
        });
      }
    }
  }

  function addHistoryItem({ sourceText, resultText, status, meta }) {
    ensurePanel();

    const LANG_BADGE_CSS = `
      flex: none;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 2px 5px;
      border-radius: 5px;
      height: fit-content;
      margin-top: 2px;
      line-height: 1.4;
      box-sizing: border-box;
    `;

    const item = document.createElement('div');
    item.dataset.role = 'card';
    item.dataset.status = status;
    item.style.cssText = `
      position: relative;
      border-radius: 15px;
      padding: 14px 15px 13px;
      box-sizing: border-box;
      margin: 0;
      border: none;
    `;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', 'remove');
    removeBtn.style.cssText = `
      position: absolute;
      top: 9px;
      right: 10px;
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
      opacity: 0.4;
    `;
    removeBtn.appendChild(removeBtnText);
    removeBtn.addEventListener('mouseenter', () => {
      removeBtnText.style.setProperty('opacity', '1');
    });
    removeBtn.addEventListener('mouseleave', () => {
      removeBtnText.style.setProperty('opacity', '0.4');
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

    // 원문 행 (EN 배지 + 원문)
    const srcRow = document.createElement('div');
    srcRow.style.cssText = `
      display: flex;
      gap: 9px;
      align-items: flex-start;
      padding-right: 18px;
      box-sizing: border-box;
    `;
    const enBadge = document.createElement('span');
    enBadge.dataset.role = 'lang-en';
    enBadge.textContent = 'EN';
    enBadge.style.cssText = LANG_BADGE_CSS;
    const srcContent = document.createElement('div');
    srcContent.dataset.role = 'source-text';
    srcContent.textContent = sourceText || '';
    srcContent.style.cssText = `
      flex: 1;
      min-width: 0;
      font-size: 12.5px;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.5;
      font-family: inherit;
    `;
    if (sourceText) {
      srcContent.addEventListener('click', async () => {
        await copyToClipboard(sourceText);
      });
    }
    srcRow.appendChild(enBadge);
    srcRow.appendChild(srcContent);

    // 번역 행 (divider + KO 배지 + 번역문)
    const dstRow = document.createElement('div');
    dstRow.dataset.role = 'dst-row';
    dstRow.style.cssText = `
      display: flex;
      gap: 9px;
      align-items: flex-start;
      margin-top: 11px;
      padding-top: 11px;
      border-top: 1px solid transparent;
      box-sizing: border-box;
    `;
    const koBadge = document.createElement('span');
    koBadge.dataset.role = 'lang-ko';
    koBadge.textContent = 'KO';
    koBadge.style.cssText = LANG_BADGE_CSS;
    const dst = document.createElement('div');
    dst.dataset.role = 'result-text';
    dst.style.cssText = `
      flex: 1;
      min-width: 0;
      font-size: 14.5px;
      font-weight: 500;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.55;
      letter-spacing: -0.01em;
      font-family: inherit;
    `;
    updateTranslationText(dst, resultText || '', status);
    dstRow.appendChild(koBadge);
    dstRow.appendChild(dst);

    // 메타 (소요 시간)
    const metaLine = document.createElement('div');
    metaLine.dataset.role = 'meta';
    metaLine.textContent = meta || '';
    metaLine.style.cssText = `
      font-size: 10px;
      line-height: 1.4;
      margin-top: 10px;
      text-align: right;
    `;

    item.appendChild(removeBtn);
    item.appendChild(srcRow);
    item.appendChild(dstRow);
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
            'ko-KR',
          )}자입니다.`,
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
    true,
  );

  // ESC closes panel (optional)
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') closePanel();
    },
    true,
  );
})();
