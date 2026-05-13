/* eslint-disable no-undef */
/**
 * ZIM Reader Plugin for Otzaria
 *
 * Uses libzim WebAssembly (from the Kiwix project) to read ZIM archives
 * directly in the plugin WebView.
 */

(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // Otzaria SDK — soft fallback so we can also run in a normal browser
  // -----------------------------------------------------------------------
  const Otz = typeof Otzaria !== 'undefined' ? Otzaria : {
    call: async () => ({ success: true, data: null, error: null }),
    on: () => {},
    off: () => {}
  };

  // -----------------------------------------------------------------------
  // DOM refs
  // -----------------------------------------------------------------------
  const els = {
    fileInput:    document.getElementById('zim-file'),
    searchBox:    document.getElementById('search-box'),
    searchBtn:    document.getElementById('search-btn'),
    homeBtn:      document.getElementById('home-btn'),
    archiveName:  document.getElementById('archive-name'),
    suggestions:  document.getElementById('suggestions'),
    suggestionsEmpty: document.getElementById('suggestions-empty'),
    welcome:      document.getElementById('welcome'),
    iframe:       document.getElementById('article-frame'),
    status:       document.getElementById('status')
  };

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let worker = null;
  let workerReady = false;
  let currentArchiveName = null;
  let currentArticlePath = null;       // path of the article currently shown
  const blobCache = new Map();         // path -> blob URL  (cleared on archive change)
  let suggestSeq = 0;                  // for racing suggest requests
  let workerBlobUrl = null;            // cached blob URL for the worker script
  let wasmBinary = null;               // cached Uint8Array of the .wasm binary

  // -----------------------------------------------------------------------
  // Worker bootstrap that survives file:// (origin = null)
  //
  // In a file:// WebView (origin = null) we cannot:
  //   1. Create a Worker from a same-origin URL ("cannot be accessed from
  //      origin null"), nor
  //   2. fetch() local files ("Failed to fetch").
  //
  // Workaround: the libzim worker JS source is shipped as a string in
  // libzim-wasm-source.js (`self.__libzimWasmSource`) and the wasm binary
  // as a base64 blob in libzim-wasm-data.js (`self.__libzimWasmBase64`),
  // both loaded via plain <script> tags (which DO work from file://).
  // We then build a Blob URL for the worker and pass the wasm Blob URL
  // into Emscripten via a `locateFile` override.
  // -----------------------------------------------------------------------
  function base64ToUint8Array(b64) {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function ensureWorkerBlobs() {
    if (workerBlobUrl && wasmBinary) return;

    if (typeof self.__libzimWasmSource !== 'string') {
      throw new Error('libzim-wasm-source.js לא נטען');
    }
    if (typeof self.__libzimWasmBase64 !== 'string') {
      throw new Error('libzim-wasm-data.js לא נטען');
    }

    wasmBinary = base64ToUint8Array(self.__libzimWasmBase64);

    let js = self.__libzimWasmSource;

    // Inject `wasmBinary` (and a no-op locateFile) into the `init` action
    // handler. With Module.wasmBinary set, Emscripten skips network fetch
    // entirely and instantiates from the in-memory bytes — this avoids the
    // "blob URL fetched from null-origin worker" problem.
    const needle = 'Module={};Module["onRuntimeInitialized"]=';
    const patch  = 'Module={wasmBinary:self.__libzimWasmBinary,locateFile:function(p){return p;}};Module["onRuntimeInitialized"]=';
    if (js.indexOf(needle) === -1) {
      console.warn('[ZIM] could not patch libzim-wasm.js init handler — load may fail');
    } else {
      js = js.replace(needle, patch);
    }

    // Prepend a tiny shim that captures the wasm binary on the very first
    // message (so the patched `Module = { wasmBinary: … }` line above can
    // reference it).
    const shim =
      'self.__libzimWasmBinary=null;' +
      'var __origAddEventListener=self.addEventListener.bind(self);' +
      'self.addEventListener=function(type,fn,opts){' +
        'if(type==="message"){' +
          'var wrapped=function(e){' +
            'if(e&&e.data&&e.data.action==="init"&&e.data.wasmBinary){self.__libzimWasmBinary=e.data.wasmBinary;}' +
            'return fn(e);' +
          '};' +
          'return __origAddEventListener(type,wrapped,opts);' +
        '}' +
        'return __origAddEventListener(type,fn,opts);' +
      '};' +
      'self.addEventListener("error",function(e){try{console.error("[ZIM worker error]",e&&(e.message||e));}catch(_){}});';

    workerBlobUrl = URL.createObjectURL(new Blob([shim + js], { type: 'application/javascript' }));

    // Free the (large) source/base64 strings now that we've consumed them.
    try { self.__libzimWasmSource = null; } catch (_) {}
    try { self.__libzimWasmBase64 = null; } catch (_) {}
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  function setStatus(text, busy) {
    els.status.innerHTML = busy ? '<span class="spinner"></span>&nbsp;' + escapeHtml(text) : escapeHtml(text || '');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function notifyError(message) {
    setStatus('שגיאה: ' + message, false);
    Otz.call('ui.showError', { message: 'ZIM: ' + message }).catch(() => {});
  }

  function notifyOk(message) {
    Otz.call('ui.showMessage', { message: message }).catch(() => {});
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms);
    };
  }

  // -----------------------------------------------------------------------
  // Worker RPC — uses MessageChannel as required by libzim-wasm.js
  // -----------------------------------------------------------------------
  function workerCall(payload, transfer) {
    return new Promise((resolve, reject) => {
      if (!worker) { reject(new Error('Worker not initialized')); return; }
      const ch = new MessageChannel();
      const isInit = payload && payload.action === 'init';
      const timeoutMs = isInit ? 180000 : 60000;
      const timeout = setTimeout(() => {
        try { ch.port1.close(); } catch (_) { /* ignore */ }
        reject(new Error('Worker call timed out: ' + payload.action));
      }, timeoutMs);
      ch.port1.onmessage = (e) => {
        clearTimeout(timeout);
        try { ch.port1.close(); } catch (_) { /* ignore */ }
        resolve(e.data);
      };
      try {
        worker.postMessage(payload, transfer ? transfer.concat([ch.port2]) : [ch.port2]);
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  // -----------------------------------------------------------------------
  // Archive loading
  // -----------------------------------------------------------------------
  async function loadArchive(file) {
    setStatus('טוען ארכיון…', true);

    // Tear down previous worker
    if (worker) {
      try { worker.terminate(); } catch (_) { /* ignore */ }
      worker = null;
      workerReady = false;
    }
    blobCache.forEach((url) => { try { URL.revokeObjectURL(url); } catch (_) {} });
    blobCache.clear();
    currentArticlePath = null;
    els.iframe.style.display = 'none';
    els.welcome.style.display = '';

    try {
      await ensureWorkerBlobs();
      worker = new Worker(workerBlobUrl);
    } catch (err) {
      notifyError('לא ניתן ליצור Web Worker: ' + err.message);
      return;
    }

    worker.onerror = (e) => {
      console.error('[ZIM worker error]', e);
      notifyError('שגיאה ב-Worker: ' + (e.message || 'לא ידועה'));
    };

    try {
      // Send a *copy* of the wasm bytes so subsequent loads can reuse the
      // cached `wasmBinary` Uint8Array (transferring would neuter it).
      const wasmCopy = new Uint8Array(wasmBinary.byteLength);
      wasmCopy.set(wasmBinary);
      const initResp = await workerCall(
        { action: 'init', files: [file], wasmBinary: wasmCopy },
        [wasmCopy.buffer]
      );
      // initResp is the string "runtime initialized"
      console.log('[ZIM] worker init:', initResp);
      workerReady = true;
      currentArchiveName = file.name;
      els.archiveName.textContent = '— ' + file.name;

      // Enable UI
      els.searchBox.disabled = false;
      els.searchBtn.disabled = false;
      els.homeBtn.disabled = false;
      els.searchBox.focus();

      // Try to detect article count for status
      try {
        const cnt = await workerCall({ action: 'getArticleCount' });
        setStatus('הארכיון נטען. ' + (typeof cnt === 'number' ? cnt.toLocaleString('he-IL') + ' ערכים' : 'מוכן'), false);
      } catch (_) {
        setStatus('הארכיון נטען.', false);
      }

      // Persist last-opened name (file path is not available, but name helps)
      Otz.call('storage.set', { key: 'lastArchiveName', value: file.name }).catch(() => {});

      // Try to auto-open a main page
      tryOpenMainPage();
    } catch (err) {
      console.error(err);
      notifyError('טעינת ארכיון נכשלה: ' + err.message);
      worker = null;
      workerReady = false;
    }
  }

  async function tryOpenMainPage() {
    // ZIM main page path varies. Try a few common candidates.
    const candidates = [
      'mainPage', 'index', 'index.html',
      'A/mainPage', 'A/index', 'A/index.html',
      'A/Main_Page', 'A/Welcome', 'home'
    ];
    for (const path of candidates) {
      try {
        const resp = await workerCall({ action: 'getEntryByPath', path: path, follow: true });
        if (resp && resp.content && resp.content.length && resp.mimetype && /html/i.test(resp.mimetype)) {
          await renderArticle(path, resp);
          return;
        }
      } catch (_) { /* keep trying */ }
    }
    // Fallback — first suggestion (empty doesn't usually work, try common letter)
    try {
      const r = await workerCall({ action: 'suggest', text: 'a', numResults: 1 });
      if (r && r.suggestions && r.suggestions[0]) {
        await openByPath(r.suggestions[0].path);
        return;
      }
    } catch (_) { /* ignore */ }
    setStatus('הארכיון נטען. הקלד/י חיפוש כדי להתחיל.', false);
  }

  // -----------------------------------------------------------------------
  // Suggestions
  // -----------------------------------------------------------------------
  const onSuggestInput = debounce(async function () {
    if (!workerReady) return;
    const text = els.searchBox.value.trim();
    if (!text) {
      renderSuggestions([]);
      return;
    }
    const seq = ++suggestSeq;
    try {
      const r = await workerCall({ action: 'suggest', text: text, numResults: 25 });
      if (seq !== suggestSeq) return; // stale
      renderSuggestions((r && r.suggestions) || []);
    } catch (err) {
      console.error(err);
    }
  }, 150);

  function renderSuggestions(items) {
    els.suggestions.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'אין הצעות';
      els.suggestions.appendChild(empty);
      return;
    }
    for (const it of items) {
      const div = document.createElement('div');
      div.className = 'suggestion';
      div.textContent = it.title || it.path;
      div.title = it.path;
      div.addEventListener('click', () => openByPath(it.path));
      els.suggestions.appendChild(div);
    }
  }

  // -----------------------------------------------------------------------
  // Full text search
  // -----------------------------------------------------------------------
  async function runFullTextSearch() {
    if (!workerReady) return;
    const text = els.searchBox.value.trim();
    if (!text) return;
    setStatus('מחפש: ' + text, true);
    try {
      // Prefer searchWithSnippets if available
      let r;
      try {
        r = await workerCall({ action: 'searchWithSnippets', text: text, numResults: 50 });
      } catch (_) {
        r = await workerCall({ action: 'search', text: text, numResults: 50 });
      }
      const results = (r && r.results) || [];
      els.suggestions.innerHTML = '';
      if (!results.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'לא נמצאו תוצאות';
        els.suggestions.appendChild(empty);
        setStatus('לא נמצאו תוצאות עבור: ' + text, false);
        return;
      }
      for (const it of results) {
        const div = document.createElement('div');
        div.className = 'suggestion';
        const title = document.createElement('div');
        title.textContent = it.title || it.path;
        div.appendChild(title);
        if (it.snippet) {
          const sn = document.createElement('div');
          sn.className = 'snippet';
          sn.innerHTML = it.snippet; // libzim already escapes; snippet contains <b>
          div.appendChild(sn);
        }
        div.addEventListener('click', () => openByPath(it.path));
        els.suggestions.appendChild(div);
      }
      setStatus(results.length + ' תוצאות עבור: ' + text, false);
    } catch (err) {
      notifyError('חיפוש נכשל: ' + err.message);
    }
  }

  // -----------------------------------------------------------------------
  // Fetch entry & sub-resources
  // -----------------------------------------------------------------------
  async function fetchEntry(path, follow) {
    return workerCall({ action: 'getEntryByPath', path: path, follow: follow !== false });
  }

  async function getBlobUrl(path, mimetype) {
    if (blobCache.has(path)) return blobCache.get(path);
    try {
      const resp = await fetchEntry(path, true);
      if (!resp || !resp.content || !resp.content.length) return null;
      const blob = new Blob([resp.content], { type: resp.mimetype || mimetype || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      blobCache.set(path, url);
      return url;
    } catch (err) {
      console.warn('Failed to load resource', path, err);
      return null;
    }
  }

  function resolvePath(href, basePath) {
    try {
      const u = new URL(href, 'http://zim.local/' + (basePath || ''));
      if (u.host !== 'zim.local') return null; // external
      let p = decodeURI(u.pathname.replace(/^\//, ''));
      return p;
    } catch (_) {
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Article rendering
  // -----------------------------------------------------------------------
  async function openByPath(path) {
    if (!workerReady) return;
    setStatus('טוען: ' + path, true);
    try {
      const resp = await fetchEntry(path, true);
      if (!resp || !resp.content || !resp.content.length) {
        notifyError('לא נמצא: ' + path);
        return;
      }
      if (!/html/i.test(resp.mimetype || '')) {
        // Not HTML — open as a download
        const url = URL.createObjectURL(new Blob([resp.content], { type: resp.mimetype || 'application/octet-stream' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = path.split('/').pop() || 'file';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        setStatus('הורד: ' + path, false);
        return;
      }
      await renderArticle(path, resp);
    } catch (err) {
      notifyError('פתיחת ערך נכשלה: ' + err.message);
    }
  }

  async function renderArticle(path, resp) {
    currentArticlePath = path;
    const html = new TextDecoder('utf-8').decode(resp.content);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Strip scripts entirely (security)
    doc.querySelectorAll('script').forEach((el) => el.remove());

    // Set base target so links stay in the iframe
    let base = doc.querySelector('base');
    if (!base) {
      base = doc.createElement('base');
      doc.head.insertBefore(base, doc.head.firstChild);
    }
    base.setAttribute('target', '_self');

    // Rewrite asset references in parallel
    const tasks = [];

    // <img>, <source>, <video>, <audio>, <track>
    doc.querySelectorAll('img[src], source[src], video[src], audio[src], track[src]').forEach((el) => {
      const src = el.getAttribute('src');
      const resolved = resolvePath(src, path);
      if (!resolved) return;
      tasks.push(getBlobUrl(resolved).then((u) => { if (u) el.setAttribute('src', u); else el.removeAttribute('src'); }));
    });

    // srcset (just take first URL)
    doc.querySelectorAll('img[srcset], source[srcset]').forEach((el) => {
      el.removeAttribute('srcset'); // simpler: rely on src
    });

    // <link rel="stylesheet"> — fetch CSS, rewrite url() inside, swap to blob
    doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach((el) => {
      const href = el.getAttribute('href');
      const resolved = resolvePath(href, path);
      if (!resolved) { el.remove(); return; }
      tasks.push(loadStyleSheet(resolved).then((u) => {
        if (u) el.setAttribute('href', u);
        else el.remove();
      }));
    });

    // <a> — keep href but mark as zim-internal so we can intercept
    doc.querySelectorAll('a[href]').forEach((el) => {
      const href = el.getAttribute('href');
      if (!href || /^(https?:|mailto:|tel:|javascript:)/i.test(href)) {
        el.setAttribute('target', '_blank'); // external — let browser handle (will be blocked by sandbox; still better than nothing)
        return;
      }
      // hash-only link → leave alone for in-page nav
      if (href.startsWith('#')) return;
      const resolved = resolvePath(href, path);
      if (!resolved) return;
      el.setAttribute('data-zim-path', resolved);
      el.setAttribute('href', '#');
    });

    await Promise.all(tasks);

    const finalHtml = '<!DOCTYPE html>' + doc.documentElement.outerHTML;

    // Show iframe
    els.welcome.style.display = 'none';
    els.iframe.style.display = '';
    els.iframe.srcdoc = finalHtml;

    els.iframe.onload = () => {
      try {
        const idoc = els.iframe.contentDocument;
        if (!idoc) return;
        idoc.addEventListener('click', (ev) => {
          let target = ev.target;
          while (target && target !== idoc.documentElement && target.tagName !== 'A') target = target.parentNode;
          if (target && target.tagName === 'A') {
            const zp = target.getAttribute('data-zim-path');
            if (zp) {
              ev.preventDefault();
              openByPath(zp);
            }
          }
        }, true);
      } catch (err) {
        console.warn('Cannot bind iframe click handler:', err);
      }
    };

    setStatus(path, false);
  }

  async function loadStyleSheet(path) {
    if (blobCache.has(path)) return blobCache.get(path);
    try {
      const resp = await fetchEntry(path, true);
      if (!resp || !resp.content || !resp.content.length) return null;
      let cssText = new TextDecoder('utf-8').decode(resp.content);

      // Rewrite url(...) inside CSS — fetch and inline as data URLs (for small assets)
      const urlRegex = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
      const matches = [];
      let m;
      while ((m = urlRegex.exec(cssText)) !== null) {
        matches.push({ full: m[0], raw: m[2] });
      }
      const uniqueRefs = Array.from(new Set(matches.map((x) => x.raw)));
      const replacements = new Map();
      await Promise.all(uniqueRefs.map(async (ref) => {
        if (/^(data:|https?:|blob:)/i.test(ref)) { replacements.set(ref, ref); return; }
        const resolved = resolvePath(ref, path);
        if (!resolved) { replacements.set(ref, ref); return; }
        const u = await getBlobUrl(resolved);
        replacements.set(ref, u || ref);
      }));
      cssText = cssText.replace(urlRegex, (full, q, ref) => {
        const r = replacements.get(ref);
        return 'url("' + (r || ref) + '")';
      });

      const blob = new Blob([cssText], { type: 'text/css' });
      const url = URL.createObjectURL(blob);
      blobCache.set(path, url);
      return url;
    } catch (err) {
      console.warn('CSS load failed', path, err);
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // UI bindings
  // -----------------------------------------------------------------------
  els.fileInput.addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (f) loadArchive(f);
  });

  els.searchBox.addEventListener('input', onSuggestInput);
  els.searchBox.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      runFullTextSearch();
    }
  });
  els.searchBtn.addEventListener('click', runFullTextSearch);
  els.homeBtn.addEventListener('click', tryOpenMainPage);

  // -----------------------------------------------------------------------
  // Theme
  // -----------------------------------------------------------------------
  function applyTheme(theme) {
    if (!theme || !theme.colorScheme) return;
    const cs = theme.colorScheme;
    const root = document.documentElement;
    if (cs.primary)    root.style.setProperty('--primary',   cs.primary);
    if (cs.onPrimary)  root.style.setProperty('--onPrimary', cs.onPrimary);
    if (cs.surface)    root.style.setProperty('--surface',   cs.surface);
    if (cs.onSurface)  root.style.setProperty('--onSurface', cs.onSurface);
    if (cs.surfaceContainerHighest) root.style.setProperty('--surface2', cs.surfaceContainerHighest);
    if (cs.outline)    root.style.setProperty('--outline',   cs.outline);
    if (cs.error)      root.style.setProperty('--error',     cs.error);
    if (theme.typography && theme.typography.fontFamily) {
      root.style.setProperty('--font', "'" + theme.typography.fontFamily + "', serif");
    }
  }

  Otz.on('plugin.boot', (payload) => {
    if (payload && payload.theme) applyTheme(payload.theme);
    setStatus('מוכן. בחר/י קובץ ZIM כדי להתחיל.', false);
  });
  Otz.on('theme.changed', applyTheme);

  // If no boot event arrives (e.g. plain browser preview), still show ready
  setTimeout(() => {
    if (!els.status.textContent) setStatus('מוכן. בחר/י קובץ ZIM כדי להתחיל.', false);
  }, 500);
})();
