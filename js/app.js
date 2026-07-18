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
    openBtn:      document.getElementById('open-btn'),
    archiveSelect: document.getElementById('archive-select'),
    archiveRemove: document.getElementById('archive-remove'),
    searchBox:    document.getElementById('search-box'),
    searchBtn:    document.getElementById('search-btn'),
    homeBtn:      document.getElementById('home-btn'),
    archiveName:  document.getElementById('archive-name'),
    sidebar:      document.getElementById('sidebar'),
    sidebarTitle: document.getElementById('sidebar-title'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    sidebarClear: document.getElementById('sidebar-clear'),
    resultsScope: document.getElementById('results-scope'),
    tocSection:   document.getElementById('toc-section'),
    tocToggle:    document.getElementById('toc-toggle'),
    tocList:      document.getElementById('toc-list'),
    tocArrow:     document.getElementById('toc-arrow'),
    suggestions:  document.getElementById('suggestions'),
    welcome:      document.getElementById('welcome'),
    iframe:       document.getElementById('article-frame'),
    matchNav:     document.getElementById('match-nav'),
    matchInput:   document.getElementById('match-input'),
    matchPrev:    document.getElementById('match-prev'),
    matchNext:    document.getElementById('match-next'),
    matchClose:   document.getElementById('match-close'),
    matchCount:   document.getElementById('match-count'),
    findInPage:   document.getElementById('find-in-page'),
    status:       document.getElementById('status'),
    dlMilon:      document.getElementById('dl-milon'),
    dlSugya:      document.getElementById('dl-sugya'),
    dlYeshiva:    document.getElementById('dl-yeshiva'),
    dlOtzaria:    document.getElementById('dl-otzaria'),
    downloadsToggle: document.getElementById('downloads-toggle'),
    drawer:       document.getElementById('download-drawer'),
    drawerOverlay: document.getElementById('drawer-overlay'),
    drawerClose:  document.getElementById('drawer-close')
  };

  // -----------------------------------------------------------------------
  // Ready-made archive downloads (hosted as GitHub Release assets).
  // -----------------------------------------------------------------------
  // These open in the browser (GitHub Release assets download fine even behind
  // content filters, unlike raw.githubusercontent.com), so no network
  // permission is needed. Update the URLs if the release moves.
  const DL_BASE = 'https://github.com/YairDaniel11/otzaria-zim-plugin/releases/download/v0.5.0/';
  const DOWNLOADS = [
    {
      btn: 'dlMilon',
      title: 'ויקימילון כלי קודש',
      filename: 'milon-klei-kodesh.zim',
      url: DL_BASE + 'milon-klei-kodesh.zim'
    },
    {
      btn: 'dlSugya',
      title: 'ויקיסוגיה',
      filename: 'wikisugya.zim',
      url: DL_BASE + 'wikisugya.zim'
    },
    {
      btn: 'dlYeshiva',
      title: 'ויקישיבה',
      filename: 'wikishiva.zim',
      url: DL_BASE + 'wikishiva.zim'
    },
    {
      btn: 'dlOtzaria',
      title: 'ויקיאוצריא',
      filename: 'otzaria-wiki.zim',
      url: DL_BASE + 'otzaria-wiki.zim'
    }
  ];

  // -----------------------------------------------------------------------
  // Internal integrity / capability helpers
  // -----------------------------------------------------------------------
  var _c9 = 1 << 20;
  var _q7 = [198,101,13,187,240,82,142,44,113,191,202,73,38,80,168,130,79,19,225,57,186,32,21,118];
  var _k3 = 'R+DuFrZs0ZjPI/Ob5N4iI45HlGyoCFKVRfpNSRHCfcDlx3qHvx88nVE/pG6Z+gmewIN5m1cc7xA+s2IZI1DpBzGxxGOlQxvbv+sb6DPOZLHHGTwbbS1B6+G/dnpB7Z7rnb0uAwDgEHoaxRBxKg2K1CQhavUxIbrmW0GXNt/jD4k=';

  function _h9(b) {
    var T = new Uint32Array([
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
    function r(n, x) { return (x >>> n) | (x << (32 - n)); }
    var v0=0x6a09e667,v1=0xbb67ae85,v2=0x3c6ef372,v3=0xa54ff53a,
        v4=0x510e527f,v5=0x9b05688c,v6=0x1f83d9ab,v7=0x5be0cd19;
    var l = b.length;
    var qh = Math.floor(l / 0x20000000);
    var ql = (l * 8) >>> 0;
    var w1 = l + 1;
    var pd = (56 - (w1 % 64) + 64) % 64;
    var tt = w1 + pd + 8;
    var m = new Uint8Array(tt);
    m.set(b);
    m[l] = 0x80;
    var dv = new DataView(m.buffer);
    dv.setUint32(tt - 8, qh, false);
    dv.setUint32(tt - 4, ql, false);
    var W = new Uint32Array(64), i, o;
    for (o = 0; o < tt; o += 64) {
      for (i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4, false);
      for (i = 16; i < 64; i++) {
        var x = W[i-15], y = W[i-2];
        var d0 = r(7,x) ^ r(18,x) ^ (x >>> 3);
        var d1 = r(17,y) ^ r(19,y) ^ (y >>> 10);
        W[i] = (W[i-16] + d0 + W[i-7] + d1) | 0;
      }
      var a=v0,bb=v1,c=v2,d=v3,e=v4,f=v5,g=v6,h=v7;
      for (i = 0; i < 64; i++) {
        var P1 = r(6,e) ^ r(11,e) ^ r(25,e);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + P1 + ch + T[i] + W[i]) | 0;
        var P0 = r(2,a) ^ r(13,a) ^ r(22,a);
        var mj = (a & bb) ^ (a & c) ^ (bb & c);
        var t2 = (P0 + mj) | 0;
        h=g; g=f; f=e; e=(d + t1)|0; d=c; c=bb; bb=a; a=(t1 + t2)|0;
      }
      v0=(v0+a)|0; v1=(v1+bb)|0; v2=(v2+c)|0; v3=(v3+d)|0;
      v4=(v4+e)|0; v5=(v5+f)|0; v6=(v6+g)|0; v7=(v7+h)|0;
    }
    var oo = [v0,v1,v2,v3,v4,v5,v6,v7], s = '', z;
    for (z = 0; z < 8; z++) s += (oo[z] >>> 0).toString(16).padStart(8, '0');
    return s;
  }

  async function _rw(o, s, e) {
    if (o.file) {
      var bl = o.file.slice(s, e + 1);
      return new Uint8Array(await bl.arrayBuffer());
    }
    if (o.url) {
      // Guard the fetch with a hard timeout so a range read that never
      // responds turns into a clear error instead of an unbounded hang.
      var ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var tm = ac ? setTimeout(function () { try { ac.abort(); } catch (_e) {} }, 30000) : null;
      try {
        var rp = await fetch(o.url, {
          headers: { Range: 'bytes=' + s + '-' + e },
          cache: 'no-store',
          signal: ac ? ac.signal : undefined
        });
        if (rp.status !== 206 && rp.status !== 200) throw new Error('HTTP ' + rp.status);
        var bf = new Uint8Array(await rp.arrayBuffer());
        if (rp.status === 200 && bf.length > (e - s + 1)) return bf.subarray(s, e + 1);
        return bf;
      } catch (_err) {
        if (_err && _err.name === 'AbortError') throw new Error('קריאת הקובץ נתקעה (timeout)');
        throw _err;
      } finally {
        if (tm) clearTimeout(tm);
      }
    }
    throw new Error('אין מקור קריאה');
  }

  async function _fp(o) {
    var sz = o.size || (o.file && o.file.size) || 0;
    if (!sz) throw new Error('גודל הקובץ אינו ידוע');
    var N = _c9, hd, tl;
    if (sz <= 2 * N) { hd = await _rw(o, 0, sz - 1); tl = new Uint8Array(0); }
    else { hd = await _rw(o, 0, N - 1); tl = await _rw(o, sz - N, sz - 1); }
    var sb = new TextEncoder().encode(String(sz));
    var bu = new Uint8Array(hd.length + tl.length + sb.length);
    bu.set(hd, 0); bu.set(tl, hd.length); bu.set(sb, hd.length + tl.length);
    return _h9(bu);
  }

  function _u8(s) {
    var bn = atob(s), u = new Uint8Array(bn.length), i;
    for (i = 0; i < bn.length; i++) u[i] = bn.charCodeAt(i);
    return u;
  }

  // Membership test: is SHA-256(salt || s) present in the packed blob?
  function _mt(s) {
    var q = new Uint8Array(_q7.length), i;
    for (i = 0; i < _q7.length; i++) q[i] = _q7[i] ^ 0x5a;
    var m = new Uint8Array(q.length + s.length);
    m.set(q, 0);
    for (i = 0; i < s.length; i++) m[q.length + i] = s.charCodeAt(i);
    var got = _h9(m);
    var raw = _u8(_k3), o2, j, hh;
    for (o2 = 0; o2 + 32 <= raw.length; o2 += 32) {
      hh = '';
      for (j = 0; j < 32; j++) hh += raw[o2 + j].toString(16).padStart(2, '0');
      if (hh === got) return true;
    }
    return false;
  }

  function _u64(dv, p) {
    return dv.getUint32(p, true) + dv.getUint32(p + 4, true) * 4294967296;
  }
  var _td = new TextDecoder('utf-8');

  // Read one dirent straight from raw bytes, given the position of the URL
  // pointer table and an index into it. Shared by the metadata reader (_nm)
  // and the main-page resolver (_mp).
  async function _de(o, urlPtrPos, idx) {
    var pb = await _rw(o, urlPtrPos + idx * 8, urlPtrPos + idx * 8 + 7);
    var off = _u64(new DataView(pb.buffer, pb.byteOffset, 8), 0);
    var eb = await _rw(o, off, off + 1023);
    var edv = new DataView(eb.buffer, eb.byteOffset, eb.byteLength);
    var mt = edv.getUint16(0, true);
    var ns = String.fromCharCode(eb[3]);
    var p = 8, cl = null, bl = null, redTo = null, red = (mt === 0xffff);
    if (red) { redTo = edv.getUint32(p, true); p += 4; } else { cl = edv.getUint32(p, true); bl = edv.getUint32(p + 4, true); p += 8; }
    var e = p;
    while (e < eb.length && eb[e] !== 0) e++;
    return { ns: ns, url: _td.decode(eb.subarray(p, e)), cl: cl, bl: bl, red: red, redTo: redTo };
  }

  // Read the ZIM "Name" metadata straight from raw bytes (no libzim needed).
  // Metadata lives in the 'M' namespace; openZIM keeps it in an uncompressed
  // cluster, so we only support uncompressed clusters here (else -> null).
  async function _nm(o) {
    var hb = await _rw(o, 0, 79);
    var hd = new DataView(hb.buffer, hb.byteOffset, hb.byteLength);
    if (hd.getUint32(0, true) !== 0x044d495a) return null;
    var entryCount = hd.getUint32(24, true);
    var urlPtrPos = _u64(hd, 32);
    var clusterPtrPos = _u64(hd, 48);
    function de(idx) { return _de(o, urlPtrPos, idx); }

    var lo = 0, hi = entryCount, mid, d;
    while (lo < hi) { mid = (lo + hi) >> 1; d = await de(mid); if (d.ns < 'M') lo = mid + 1; else hi = mid; }
    var i = lo;
    while (i < entryCount) {
      d = await de(i);
      if (d.ns !== 'M') break;
      if (d.url === 'Name' && !d.red) {
        var pb = await _rw(o, clusterPtrPos + d.cl * 8, clusterPtrPos + d.cl * 8 + 15);
        var pdv = new DataView(pb.buffer, pb.byteOffset, pb.byteLength);
        var coff = _u64(pdv, 0), noff = _u64(pdv, 8);
        var info = (await _rw(o, coff, coff))[0];
        var comp = info & 0x0f, ext = (info & 0x10) !== 0;
        if (comp !== 0 && comp !== 1) return null;         // compressed → unsupported here
        if (noff <= coff + 1) return null;
        var data = await _rw(o, coff + 1, noff - 1);
        var ddv = new DataView(data.buffer, data.byteOffset, data.byteLength);
        var osz = ext ? 8 : 4;
        var s = ext ? _u64(ddv, d.bl * osz) : ddv.getUint32(d.bl * osz, true);
        var en = ext ? _u64(ddv, (d.bl + 1) * osz) : ddv.getUint32((d.bl + 1) * osz, true);
        if (en < s || en > data.length) return null;
        return _td.decode(data.subarray(s, en));
      }
      i++;
    }
    return null;
  }

  // Resolve the archive's declared main page straight from the ZIM header
  // (offset 64 = uint32 index into the URL pointer list; 0xFFFFFFFF = none).
  // Needed because that entry is often an old-style 'W' namespace alias
  // (e.g. "W/mainPage") which getEntryByPath cannot look up by name at all —
  // only the header's direct index reaches it. We follow any redirect chain
  // ourselves and return the final content dirent, whose bare url IS
  // reachable via getEntryByPath.
  async function _mp(o) {
    var hb = await _rw(o, 0, 79);
    var hd = new DataView(hb.buffer, hb.byteOffset, hb.byteLength);
    if (hd.getUint32(0, true) !== 0x044d495a) return null;
    var urlPtrPos = _u64(hd, 32);
    var mainIdx = hd.getUint32(64, true);
    if (mainIdx === 0xffffffff) return null;
    var d = await _de(o, urlPtrPos, mainIdx);
    var hops = 0;
    while (d && d.red && hops++ < 5) { d = await _de(o, urlPtrPos, d.redTo); }
    if (!d || d.red) return null;
    return { ns: d.ns, url: d.url };
  }

  async function _gk(o) {
    var sz = o.size || (o.file && o.file.size) || 0;
    if (!sz) return false;
    var fp = await _fp(o);
    if (_mt(fp)) return true;                    // exact content match (stable files)
    try {                                        // else allow by stable metadata Name
      var nm = await _nm(o);
      if (nm && _mt('name:' + nm)) return true;
    } catch (_e) { /* fall through to block */ }
    return false;
  }

  // Quick integrity probe from raw bytes — catches damaged/incomplete files
  // (e.g. a truncated download whose index tables & checksum are zeroed) so we
  // can report a clear error instead of libzim hanging until the init timeout.
  // Returns a Hebrew reason string if the file is unusable, else null.
  async function _ck(o) {
    try {
      var hb = await _rw(o, 0, 79);
      var hd = new DataView(hb.buffer, hb.byteOffset, hb.byteLength);
      if (hd.getUint32(0, true) !== 0x044d495a) return 'הקובץ אינו קובץ ZIM תקין.';
      var entryCount = hd.getUint32(24, true);
      var urlPtrPos = _u64(hd, 32);
      var checksumPos = _u64(hd, 72);
      if (entryCount > 0 && urlPtrPos > 0) {
        var pb = await _rw(o, urlPtrPos, urlPtrPos + 7);
        var p0 = _u64(new DataView(pb.buffer, pb.byteOffset, 8), 0);
        if (p0 === 0) return 'טבלת האינדקס של הקובץ ריקה — הקובץ פגום או הורד באופן חלקי.';
      }
      if (checksumPos > 0) {
        var mb = await _rw(o, checksumPos, checksumPos + 15);
        var allz = true, i;
        for (i = 0; i < mb.length; i++) { if (mb[i] !== 0) { allz = false; break; } }
        if (allz) return 'סכום הביקורת של הקובץ ריק — הקובץ פגום או לא הושלם.';
      }
      return null;
    } catch (_e) {
      return null;   // never block on a probe error — let init try normally
    }
  }

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let worker = null;
  let workerReady = false;
  let currentArchiveName = null;
  let currentArchiveObj = null;        // {file|url,size} of the loaded archive — for raw header reads (e.g. _mp)
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
        // The worker reports recoverable failures as { __workerError } instead
        // of throwing (which would surface as an uncaught worker error).
        if (e.data && e.data.__workerError) {
          reject(new Error(e.data.__workerError));
        } else {
          resolve(e.data);
        }
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
  // Legacy File-based open (fallback when the native picker is unavailable).
  // The whole File is handed to WORKERFS, which lazy-reads via Blob.slice.
  function loadArchive(file) {
    return startArchive({ file: file, name: file.name });
  }

  // Load-cancellation: every load takes a sequence number; if a newer load
  // starts (or the view is reset) mid-flight, the stale one aborts quietly
  // instead of re-populating the UI over the new state.
  let loadSeq = 0;
  function cancelActiveLoad() { loadSeq++; }

  // Unified archive opener.
  //   opts.url + size  — a localhost file-server URL streamed via HTTP Range
  //                      (createLazyFile) with a known size → opens instantly,
  //                      nothing is downloaded up front. (preferred)
  //   opts.file        — a File object handed to WORKERFS (fallback).
  async function startArchive(opts) {
    const displayName = opts.name || (opts.file && opts.file.name) || 'archive.zim';
    const mySeq = ++loadSeq;

    // Content gate — only pre-approved archives may be opened. Verified BEFORE
    // the current worker is torn down, so a rejected file leaves the currently
    // open archive fully intact.
    setStatus('בודק את הקובץ…', true);
    try {
      const _ok = await _gk(opts);
      if (mySeq !== loadSeq) return;                 // superseded / cancelled
      if (!_ok) {
        console.warn('[ZIM] archive not permitted');
        notifyError('הקובץ "' + displayName + '" אינו ברשימת הקבצים המורשים לטעינה בתוסף זה.');
        setStatus('הטעינה נחסמה — הקובץ אינו מורשה.', false);
        if (opts.token) removeFromLibrary(opts.token);
        return;
      }
    } catch (err) {
      if (mySeq !== loadSeq) return;
      notifyError('בדיקת הקובץ נכשלה: ' + (err && err.message ? err.message : err));
      setStatus('הטעינה בוטלה.', false);
      if (opts.token) removeFromLibrary(opts.token);
      return;
    }

    // Integrity probe — fail fast (with a clear message) on damaged files
    // instead of letting libzim hang until the 180s init timeout.
    try {
      const bad = await _ck(opts);
      if (mySeq !== loadSeq) return;
      if (bad) {
        notifyError('לא ניתן לפתוח את הקובץ "' + displayName + '": ' + bad);
        setStatus('הקובץ פגום — ' + bad, false);
        return;
      }
    } catch (_e) { /* probe failure is non-fatal */ }

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

    let w;
    try {
      await ensureWorkerBlobs();
      if (mySeq !== loadSeq) return;            // superseded / cancelled
      w = new Worker(workerBlobUrl);
      worker = w;
    } catch (err) {
      if (mySeq !== loadSeq) return;
      notifyError('לא ניתן ליצור Web Worker: ' + err.message);
      return;
    }

    w.onerror = (e) => {
      if (mySeq !== loadSeq) return;
      console.error('[ZIM worker error]', e);
      notifyError('שגיאה ב-Worker: ' + (e.message || 'לא ידועה'));
    };

    try {
      // Send a *copy* of the wasm bytes so subsequent loads can reuse the
      // cached `wasmBinary` Uint8Array (transferring would neuter it).
      const wasmCopy = new Uint8Array(wasmBinary.byteLength);
      wasmCopy.set(wasmBinary);

      const initPayload = { action: 'init', wasmBinary: wasmCopy };
      const initTransfer = [wasmCopy.buffer];
      const sizeKnown = opts.size || (opts.file && opts.file.size) || 0;
      if (opts.url) {
        // Strategy by size:
        //  • ≤ FULL_LOAD_MAX  → pull the whole file into memory and mount via
        //    WORKERFS. Lazy Range open() issues many tiny synchronous XHRs;
        //    for older (v5) ZIMs that pattern can make init crawl until it
        //    times out. A full in-memory mount opens instantly & reliably.
        //  • larger           → keep lazy Range streaming (no huge download).
        const FULL_LOAD_MAX = 600 * 1048576;
        if (sizeKnown && sizeKnown <= FULL_LOAD_MAX) {
          setStatus('טוען את הקובץ לזיכרון…', true);
          let fb = null;
          try {
            const r = await fetch(opts.url, { cache: 'no-store' });
            if (mySeq !== loadSeq) { try { w.terminate(); } catch (_) {} return; }
            if (!r.ok && r.status !== 200 && r.status !== 206) throw new Error('HTTP ' + r.status);
            fb = await r.blob();
          } catch (_e) { fb = null; }
          if (mySeq !== loadSeq) { try { w.terminate(); } catch (_) {} return; }
          if (fb) {
            let f;
            try { f = new File([fb], displayName); }
            catch (_e) { f = fb; try { fb.name = displayName; } catch (_e2) {} }
            initPayload.files = [f];
          } else {
            // download failed → fall back to lazy streaming
            initPayload.files = [{ name: displayName }];
            initPayload.url = opts.url;
            initPayload.size = sizeKnown;
          }
        } else {
          initPayload.files = [{ name: displayName }];
          initPayload.url = opts.url;
          initPayload.size = sizeKnown;
        }
      } else if (opts.file) {
        initPayload.files = [opts.file];
      } else {
        throw new Error('לא נמצא קובץ לטעינה');
      }

      setStatus('טוען ארכיון…', true);
      const initResp = await workerCall(initPayload, initTransfer);
      if (mySeq !== loadSeq) { try { w.terminate(); } catch (_) {} return; }
      console.log('[ZIM] worker init:', initResp);
      workerReady = true;
      currentArchiveName = displayName;
      els.archiveName.textContent = displayName;

      els.searchBox.disabled = false;
      els.searchBtn.disabled = false;
      els.homeBtn.disabled = false;
      if (els.findInPage) els.findInPage.disabled = false;
      els.searchBox.focus();

      try {
        const cnt = await workerCall({ action: 'getArticleCount' });
        if (mySeq !== loadSeq) return;
        setStatus('הארכיון נטען. ' + (typeof cnt === 'number' ? cnt.toLocaleString('he-IL') + ' ערכים' : 'מוכן'), false);
      } catch (_) {
        if (mySeq !== loadSeq) return;
        setStatus('הארכיון נטען.', false);
      }

      // Remember which archive is active, then reopen its last-read article.
      currentArchiveObj = opts;
      activeToken = opts.token || null;
      Otz.call('storage.set', { key: 'lastArchiveName', value: displayName }).catch(() => {});
      if (activeToken) Otz.call('storage.set', { key: ACTIVE_KEY, value: activeToken }).catch(() => {});
      updateArchiveSelect();

      await openInitialEntry(activeToken);
      if (mySeq !== loadSeq) return;
      // If a search term is still active after switching archives, refresh the
      // results against the newly loaded archive instead of leaving the old ones.
      if (els.searchBox.value.trim()) onSuggestInput();
    } catch (err) {
      if (mySeq !== loadSeq) return;             // stale error from a cancelled load
      console.error(err);
      notifyError('טעינת ארכיון נכשלה: ' + (err && err.message ? err.message : err));
      worker = null;
      workerReady = false;
    }
  }

  // -----------------------------------------------------------------------
  // Archive library, session persistence & per-archive position
  //
  // Otzaria's fs.pickUserFile returns { token, url, name }: `url` is a
  // localhost file-server address (Range-enabled) that libzim streams from,
  // and `token` is persisted so the file re-opens next launch via
  // fs.resolveFileUrl (the server port changes every run).
  //
  // We keep a *library* of opened archives (like Kiwix), a pointer to the
  // active one, and — per token — the path of the last article read.
  // -----------------------------------------------------------------------
  const ZIM_EXTENSIONS = ['zim', 'zimaa', 'zimab'];
  const LIBRARY_KEY = 'zimLibrary';       // JSON array of { token, name }
  const ACTIVE_KEY  = 'zimActiveToken';   // token of the active archive
  const POS_PREFIX  = 'zimPos:';          // + token → last article path

  let library = [];        // [{ token, name }]
  let activeToken = null;

  function saveLibrary() {
    Otz.call('storage.set', { key: LIBRARY_KEY, value: JSON.stringify(library) }).catch(() => {});
  }

  async function loadLibrary() {
    try {
      const g = await Otz.call('storage.get', { key: LIBRARY_KEY });
      const raw = g && g.success ? g.data : null;
      const arr = raw ? JSON.parse(raw) : null;
      library = Array.isArray(arr) ? arr.filter((a) => a && a.token) : [];
    } catch (_) {
      library = [];
    }
  }

  function addToLibrary(token, name) {
    if (!token) return;
    const i = library.findIndex((a) => a.token === token);
    if (i >= 0) library[i].name = name;
    else library.push({ token: token, name: name });
    saveLibrary();
  }

  function removeFromLibrary(token) {
    if (!token) return;
    library = library.filter((a) => a.token !== token);
    saveLibrary();
    Otz.call('storage.remove', { key: POS_PREFIX + token }).catch(() => {});
    Otz.call('fs.revokeFile', { token: token }).catch(() => {});
    if (token === activeToken) activeToken = null;
    updateArchiveSelect();
  }

  // Tear everything down and return to the initial welcome screen.
  function resetToWelcome() {
    cancelActiveLoad();   // abort any in-flight load so it can't repaint the UI
    if (worker) { try { worker.terminate(); } catch (_) {} worker = null; workerReady = false; }
    blobCache.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) {} });
    blobCache.clear();
    currentArticlePath = null;
    currentArchiveName = null;
    currentArchiveObj = null;
    activeToken = null;
    try { els.iframe.srcdoc = ''; } catch (_) {}
    els.iframe.style.display = 'none';
    els.welcome.style.display = '';
    hlSpans = []; hlIndex = 0; updateMatchNav();
    els.archiveName.textContent = 'קורא קבצי ZIM';
    els.searchBox.value = '';
    els.searchBox.disabled = true;
    els.searchBtn.disabled = true;
    els.homeBtn.disabled = true;
    if (els.findInPage) els.findInPage.disabled = true;
    findBarOpen = false;
    panelOpen = false;
    clearPanel();
    Otz.call('storage.remove', { key: ACTIVE_KEY }).catch(() => {});
    setStatus('מוכן. בחר/י קובץ ZIM כדי להתחיל.', false);
  }

  function updateArchiveSelect() {
    const sel = els.archiveSelect;
    if (!sel) return;
    if (!library.length) {
      sel.hidden = true;
      if (els.archiveRemove) els.archiveRemove.hidden = true;
      return;
    }
    sel.innerHTML = '';
    library.forEach((a) => {
      const o = document.createElement('option');
      o.value = a.token;
      o.textContent = a.name;
      if (a.token === activeToken) o.selected = true;
      sel.appendChild(o);
    });
    sel.hidden = false;
    if (els.archiveRemove) els.archiveRemove.hidden = false;
  }

  // Remember / restore the last article per archive.
  function savePosition(path) {
    if (activeToken && path) {
      Otz.call('storage.set', { key: POS_PREFIX + activeToken, value: path }).catch(() => {});
    }
  }

  async function openInitialEntry(token) {
    if (token) {
      try {
        const g = await Otz.call('storage.get', { key: POS_PREFIX + token });
        const path = g && g.success ? g.data : null;
        if (path) {
          // Verify the saved article still exists and is HTML before rendering;
          // otherwise fall back to the archive's main page.
          const resp = await fetchEntry(path, true);
          if (resp && resp.content && resp.content.length && /html/i.test(resp.mimetype || '')) {
            await renderArticle(path, resp);
            return;
          }
        }
      } catch (_) { /* fall through to main page */ }
    }
    tryOpenMainPage();
  }

  async function resolveAndStart(token) {
    const r = await Otz.call('fs.resolveFileUrl', { token: token });
    if (r && r.success && r.data && r.data.url) {
      await startArchive({ url: r.data.url, name: r.data.name, token: token, size: r.data.size });
      return true;
    }
    return false;
  }

  async function openViaPicker() {
    try {
      const res = await Otz.call('fs.pickUserFile', {
        title: 'בחר קובץ ZIM',
        extensions: ZIM_EXTENSIONS
      });
      if (!res || !res.success || !res.data) return false;
      if (res.data.cancelled) return true;            // user cancelled — handled
      const { token, url, name, size } = res.data;
      if (!url) return false;
      addToLibrary(token, name);
      updateArchiveSelect();     // show the switcher/remove controls right away
      await startArchive({ url: url, name: name, token: token, size: size });
      return true;
    } catch (err) {
      console.warn('[ZIM] fs.pickUserFile unavailable, falling back to <input>', err);
      return false;
    }
  }

  async function switchToToken(token) {
    if (!token || token === activeToken) return;
    try {
      const ok = await resolveAndStart(token);
      if (!ok) {
        notifyError('הקובץ אינו זמין (אולי נמחק) — מוסר מהרשימה');
        removeFromLibrary(token);
      }
    } catch (err) {
      notifyError('מעבר לקובץ נכשל: ' + (err && err.message ? err.message : err));
    }
  }

  // Boot restore: rebuild the library, then reopen the active archive.
  async function restoreLibraryAndActive() {
    try {
      const g = await Otz.call('storage.get', { key: 'zimSearchInContent' });
      if (g && g.success && g.data === '1') { searchInContent = true; updateScopeBtn(); }
    } catch (_) { /* ignore */ }
    await loadLibrary();
    let token = null;
    try {
      const g = await Otz.call('storage.get', { key: ACTIVE_KEY });
      token = g && g.success ? g.data : null;
    } catch (_) { /* ignore */ }
    if (!token && library.length) token = library[library.length - 1].token;
    updateArchiveSelect();
    if (!token) return;
    try {
      const ok = await resolveAndStart(token);
      if (!ok) removeFromLibrary(token);
    } catch (err) {
      console.warn('[ZIM] restore failed', err);
    }
  }

  async function tryOpenMainPage() {
    if (!workerReady) return;            // guard: no archive loaded yet
    // ZIM main page path varies. Try a few common candidates.
    const candidates = [
      'mainPage', 'index', 'index.html',
      'A/mainPage', 'A/index', 'A/index.html',
      'A/Main_Page', 'A/Welcome', 'home'
    ];
    // The header's own main-page pointer is authoritative and often lands on
    // a legacy 'W' namespace alias (e.g. "W/mainPage") that getEntryByPath
    // cannot find by name at all — only reading the header directly reaches
    // it. Resolve it (following redirects) and try its real target first,
    // since the fixed guesses above miss custom-built archives entirely.
    if (currentArchiveObj) {
      try {
        const mp = await _mp(currentArchiveObj);
        if (mp) candidates.unshift(mp.url, mp.ns + '/' + mp.url);
      } catch (_) { /* unsupported/failed → rely on the guesses */ }
    }
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
  // Side panel: suggestions / search results  ⇄  table of contents
  //
  // The panel stays hidden (article gets full width) until it has something
  // useful to show: live suggestions, full-text results, or the current
  // article's table of contents.
  // -----------------------------------------------------------------------
  let tocHeadings = [];       // heading elements of the current article
  let panelOpen = false;      // user-controlled open/closed state (☰ toggle)
  let panelHasContent = false;
  let searchInContent = false; // false = title suggestions; true = full-text (in-content) results
  let hlSpans = [];            // highlighted <span> elements in the current article (doc order)
  let hlIndex = 0;            // currently-focused highlight for prev/next navigation

  function applySidebar() {
    const open = panelOpen && panelHasContent;
    if (els.sidebar) els.sidebar.hidden = !open;
    const m = document.querySelector('main');
    if (m) m.classList.toggle('with-sidebar', open);
    if (els.sidebarToggle) {
      els.sidebarToggle.hidden = !panelHasContent;   // ☰ shows only when there's content
      els.sidebarToggle.classList.toggle('active', open);
    }
  }

  // Populate the panel. autoOpen=true forces it visible (active searches);
  // otherwise the current open/closed state is preserved.
  function setPanel(title, autoOpen) {
    if (els.sidebarTitle && title) els.sidebarTitle.textContent = title;
    panelHasContent = true;
    if (autoOpen) panelOpen = true;
    applySidebar();
  }

  function clearPanel() {
    panelHasContent = false;
    els.suggestions.innerHTML = '';
    applySidebar();
  }

  function toggleSidebar() {
    if (!panelHasContent) return;
    panelOpen = !panelOpen;
    applySidebar();
  }

  // One full-text search against libzim (snippets if available).
  async function libzimSearch(q, numResults) {
    let r;
    try { r = await workerCall({ action: 'searchWithSnippets', text: q, numResults: numResults }); }
    catch (_) { r = await workerCall({ action: 'search', text: q, numResults: numResults }); }
    return (r && r.results) || [];
  }
  // Smart full-text: finalize word endings; if nothing found, try an acronym
  // (gershayim) variant before giving up.
  async function smartSearch(text, numResults) {
    let results = await libzimSearch(hebFinalize(text), numResults);
    if (!results.length) {
      const av = acronymVariant(text);
      if (av) { const r2 = await libzimSearch(av, numResults); if (r2.length) results = r2; }
    }
    return results;
  }

  // Title suggestions that also try the final-letter-corrected form and merge,
  // so "כלומ" surfaces "כלום" without losing prefix matches like "כלומר".
  async function smartSuggest(text, numResults) {
    const r1 = await workerCall({ action: 'suggest', text: text, numResults: numResults });
    let items = (r1 && r1.suggestions) || [];
    const fin = hebFinalize(text);
    if (fin !== text) {
      try {
        const r2 = await workerCall({ action: 'suggest', text: fin, numResults: numResults });
        const s2 = (r2 && r2.suggestions) || [];
        const seen = new Set(items.map((x) => x.path));
        for (const it of s2) { if (!seen.has(it.path)) { items.push(it); seen.add(it.path); } }
      } catch (_) { /* ignore */ }
    }
    return items;
  }

  const onSuggestInput = debounce(async function () {
    if (!workerReady) return;
    const text = els.searchBox.value.trim();
    if (!text) {
      renderTOC();                       // empty box → back to the page's TOC
      return;
    }
    const seq = ++suggestSeq;
    try {
      if (searchInContent) {
        // Full-text: matches inside article content (with snippets).
        const results = await smartSearch(text, 40);
        if (seq !== suggestSeq) return; // stale
        renderSearchResults(results, text);
      } else {
        // Titles only (fast suggestions on entry titles).
        const items = await smartSuggest(text, 25);
        if (seq !== suggestSeq) return; // stale
        renderSuggestions(items);
      }
    } catch (err) {
      console.error(err);
    }
  }, 260);

  function updateScopeBtn() {
    if (!els.resultsScope) return;
    els.resultsScope.classList.toggle('on', searchInContent);
    els.resultsScope.textContent = (searchInContent ? '☑' : '☐') + ' בתוכן';
  }

  // Enter/leave "search results" mode. In results mode a collapsible in-page
  // heading-navigation section is offered alongside the results, and a
  // "cancel search" button returns to the table of contents.
  function setResultsMode(on) {
    if (els.sidebarClear) els.sidebarClear.hidden = !on;
    if (els.resultsScope) els.resultsScope.hidden = !on;
    if (els.tocSection) els.tocSection.hidden = !on;
    if (!on && els.tocList) { els.tocList.hidden = true; if (els.tocArrow) els.tocArrow.textContent = '▸'; }
  }

  function renderSuggestions(items) {
    els.suggestions.innerHTML = '';
    setPanel('תוצאות', true);            // active typing → auto-open the panel
    setResultsMode(true);
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state small';
      empty.textContent = 'לא נמצאו תוצאות';
      els.suggestions.appendChild(empty);
      return;
    }
    for (const it of items) {
      const div = document.createElement('div');
      div.className = 'suggestion';
      div.textContent = it.title || it.path;
      div.title = it.path;
      div.addEventListener('click', () => openByPath(it.path, els.searchBox.value.trim()));
      els.suggestions.appendChild(div);
    }
  }

  // Build a ~3-line context excerpt (before / match / after) straight from the
  // article text — used when libzim doesn't supply a snippet for a result.
  async function buildContextSnippet(path, query) {
    try {
      const resp = await fetchEntry(path, true);
      if (!resp || !resp.content || !resp.content.length) return null;
      const html = new TextDecoder('utf-8').decode(resp.content);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style').forEach((e) => e.remove());
      const text = ((doc.body && doc.body.textContent) || '').replace(/\s+/g, ' ').trim();
      if (!text) return null;
      // Fold text (niqqud/final-form insensitive) with an index map back to orig.
      let norm = '';
      const map = [];
      for (let i = 0; i < text.length; i++) {
        const f = foldChar(text[i]);
        if (f) { norm += f; map.push(i); }
      }
      const terms = query.split(/\s+/).map((t) => normHeb(t)).filter((t) => t.length >= 2);
      let nIdx = -1, term = '';
      for (const q of terms) { const ms = wordMatches(norm, q); if (ms.length) { nIdx = ms[0]; term = q; break; } }
      let oStart, oEnd;
      const matched = nIdx >= 0;
      if (matched) {
        oStart = map[nIdx];
        oEnd = (nIdx + term.length < map.length) ? map[nIdx + term.length] : text.length;
      } else { oStart = 0; oEnd = 0; }
      const start = Math.max(0, oStart - 90);
      const end = Math.min(text.length, (matched ? oEnd : oStart) + 160);
      const seg = text.slice(start, end);
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const lead = start > 0 ? '… ' : '';
      const trail = end < text.length ? ' …' : '';
      if (matched) {
        const rs = oStart - start, re2 = oEnd - start;
        return lead + esc(seg.slice(0, rs)) + '<b>' + esc(seg.slice(rs, re2)) +
               '</b>' + esc(seg.slice(re2)) + trail;
      }
      return lead + esc(seg) + trail;
    } catch (_) { return null; }
  }

  // Render full-text results (title + a 3-line content excerpt) into the panel.
  function renderSearchResults(results, query) {
    query = (query || (els.searchBox && els.searchBox.value) || '').trim();
    els.suggestions.innerHTML = '';
    setPanel('תוצאות', true);
    setResultsMode(true);
    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state small';
      empty.textContent = 'לא נמצאו תוצאות';
      els.suggestions.appendChild(empty);
      return;
    }
    const RICH = 10;   // build a full 3-line context excerpt for the top results
    results.forEach((it, idx) => {
      const div = document.createElement('div');
      div.className = 'suggestion';
      const title = document.createElement('div');
      title.textContent = it.title || it.path;
      div.appendChild(title);

      const willBuild = !!(query && idx < RICH);
      const sn = document.createElement('div');
      sn.className = 'snippet';
      if (it.snippet) sn.innerHTML = it.snippet;      // libzim snippet (already <b>-escaped)
      else if (willBuild) sn.textContent = '…';        // placeholder until context builds
      if (it.snippet || willBuild) div.appendChild(sn);

      // Try to enrich the top results with a 3-line context, but NEVER drop a
      // working libzim snippet if the fetch fails.
      if (willBuild) {
        buildContextSnippet(it.path, query).then((h) => {
          if (h) sn.innerHTML = h;
          else if (!it.snippet) sn.remove();
        }).catch(() => { if (!it.snippet) sn.remove(); });
      }

      div.addEventListener('click', () => openByPath(it.path, els.searchBox.value.trim()));
      els.suggestions.appendChild(div);
    });
  }

  // Collect the current article's headings (shared helper).
  function collectHeadings() {
    let idoc = null;
    try { idoc = els.iframe.contentDocument; } catch (_) { idoc = null; }
    const heads = idoc ? idoc.querySelectorAll('h1, h2, h3, h4') : [];
    const items = [];
    heads.forEach((h) => {
      const txt = (h.textContent || '').replace(/\[[^\]]*\]/g, '').trim();
      if (txt) items.push({ el: h, level: parseInt(h.tagName.substring(1), 10) || 2, text: txt });
    });
    return items;
  }

  // Render a heading list into `container`; wires clicks to scroll the iframe.
  // Returns the number of headings found.
  function renderHeadingsInto(container) {
    container.innerHTML = '';
    tocHeadings = [];
    const items = collectHeadings();
    if (items.length <= 1) return items.length;
    const minLevel = items.reduce((m, it) => Math.min(m, it.level), 6);
    items.forEach((it) => {
      const idx = tocHeadings.push(it.el) - 1;
      const div = document.createElement('div');
      div.className = 'toc-item toc-l' + Math.min(it.level - minLevel, 3);
      div.textContent = it.text;
      div.title = it.text;
      div.addEventListener('click', () => {
        const target = tocHeadings[idx];
        if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      container.appendChild(div);
    });
    return items.length;
  }

  // Table-of-contents mode: the panel's main list shows the page's headings.
  // Does NOT force the panel open (kept collapsed by default; ☰ toggles it).
  function renderTOC() {
    setResultsMode(false);
    const n = renderHeadingsInto(els.suggestions);
    if (n <= 1) { clearPanel(); return; }   // nothing worth navigating
    setPanel('תוכן העניינים', false);
  }

  // -----------------------------------------------------------------------
  // Full text search
  // -----------------------------------------------------------------------
  async function runFullTextSearch() {
    if (!workerReady) return;
    const text = els.searchBox.value.trim();
    if (!text) return;
    // An explicit search implies the user wants in-content results — reflect
    // that in the toggle so subsequent typing keeps searching the content.
    if (!searchInContent) { searchInContent = true; updateScopeBtn(); }
    setStatus('מחפש: ' + text, true);
    const seq = ++suggestSeq;
    try {
      const results = await smartSearch(text, 50);
      if (seq !== suggestSeq) return;   // a newer query superseded this one
      renderSearchResults(results, text);
      setStatus(results.length
        ? (results.length + ' תוצאות עבור: ' + text)
        : ('לא נמצאו תוצאות עבור: ' + text), false);
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
      // decodeURI leaves reserved characters (":", "/", "?", …) percent-encoded,
      // so any title containing one (e.g. MediaWiki namespaces like "פרשני:…")
      // would stay as "%3A" and fail to match the archive's real dirent path.
      // decodeURIComponent decodes everything — correct here since the whole
      // string is one flat archive path, not a structured URI.
      let p = decodeURIComponent(u.pathname.replace(/^\//, ''));
      return p;
    } catch (_) {
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Article rendering
  // -----------------------------------------------------------------------
  async function openByPath(path, highlight) {
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
      await renderArticle(path, resp, highlight);
    } catch (err) {
      notifyError('פתיחת ערך נכשלה: ' + err.message);
    }
  }

  // -----------------------------------------------------------------------
  // Hebrew-aware text folding for smart matching:
  //   • drop niqqud / cantillation / geresh / gershayim / maqaf
  //   • unify final letters (ך→כ ם→מ ן→נ ף→פ ץ→צ)
  //   • lowercase Latin
  // Substring matching on the folded text then also covers prefix letters
  // (ו/ה/ב/כ/ל/מ/ש), e.g. query "ריבית" matches "הריבית".
  // -----------------------------------------------------------------------
  const _HEB_FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  function foldChar(ch) {
    const c = ch.charCodeAt(0);
    if (c >= 0x0591 && c <= 0x05c7) return '';          // niqqud, te'amim, maqaf…
    if (c === 0x05f3 || c === 0x05f4) return '';         // geresh, gershayim
    if (ch === "'" || ch === '"' || ch === '`' || ch === '’' || ch === '”' || ch === '‘') return '';
    if (_HEB_FINAL[ch]) return _HEB_FINAL[ch];
    return ch.toLowerCase();
  }
  function normHeb(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) out += foldChar(s[i]);
    return out;
  }

  // Convert a word-final medial letter to its final form so the query matches
  // libzim's index (which stores canonical Hebrew), e.g. "סתומימ" → "סתומים".
  const _MED2FIN = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };
  function hebFinalize(q) {
    return q.replace(/([כמנפצ])(?=\s|$)/g, (m) => _MED2FIN[m] || m);
  }
  // Word-aware matching on folded text: require the match to END at a word
  // boundary, and allow only a Hebrew prefix letter (or a boundary) right
  // before it — so "שאין" won't match inside "שאינם", while "הדבר" still hits
  // the query "דבר". Returns start indices (in the folded string).
  function _isWordChar(c) { return !!c && /[א-תa-z0-9]/.test(c); }
  const _PREFIX_LETTERS = { 'ה': 1, 'ו': 1, 'ב': 1, 'כ': 1, 'ל': 1, 'מ': 1, 'ש': 1, 'ד': 1 };
  function wordMatches(norm, q) {
    const out = [];
    if (!q) return out;
    let from = 0, i;
    while ((i = norm.indexOf(q, from)) !== -1) {
      const before = i > 0 ? norm[i - 1] : '';
      const after = norm[i + q.length];
      const startOk = !_isWordChar(before) || _PREFIX_LETTERS[before] === 1;
      const endOk = !_isWordChar(after);
      if (startOk && endOk) out.push(i);
      from = i + 1;
    }
    return out;
  }

  // Acronym guess: a single 2–6 letter Hebrew word with no gershayim likely
  // stands for an abbreviation → try inserting ״ before the last letter
  // ("רמבם" → "רמב״ם") as a fallback when the plain query finds nothing.
  function acronymVariant(q) {
    const w = q.trim();
    if (!/^[א-ת]{2,6}$/.test(w)) return null;
    return hebFinalize(w.slice(0, -1)) + '״' + w.slice(-1);
  }

  // Remove any existing highlight wrappers so the page can be re-searched.
  function clearHighlights(idoc) {
    const marks = idoc.querySelectorAll('.zim-hl');
    if (!marks.length) return;
    marks.forEach((m) => {
      const t = idoc.createTextNode(m.textContent);
      if (m.parentNode) m.parentNode.replaceChild(t, m);
    });
    try { idoc.body.normalize(); } catch (_) { /* ignore */ }
  }

  // Highlight query terms inside the loaded article (niqqud/final-form/prefix
  // insensitive), collect the marks for prev/next navigation, jump to the first.
  function highlightInIframe(query) {
    hlSpans = []; hlIndex = 0;
    let idoc;
    try { idoc = els.iframe.contentDocument; } catch (_) { idoc = null; }
    if (idoc && idoc.body) clearHighlights(idoc);
    updateMatchNav();
    if (!query) return;
    if (!idoc || !idoc.body) return;
    const terms = query.split(/\s+/).map((t) => normHeb(t)).filter((t) => t.length >= 2);
    if (!terms.length) { updateMatchNav(); return; }
    try {
      if (!idoc.getElementById('zim-hl-style')) {
        const st = idoc.createElement('style');
        st.id = 'zim-hl-style';
        st.textContent =
          '.zim-hl{background:#ffe15a !important;color:#000 !important;border-radius:2px;padding:0 1px;}' +
          '.zim-hl-current{background:#ff9800 !important;box-shadow:0 0 0 2px #ff9800;}';
        idoc.head.appendChild(st);
      }
    } catch (_) { /* ignore */ }

    const walker = idoc.createTreeWalker(idoc.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const tag = n.parentNode && n.parentNode.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const targets = [];
    let node;
    while ((node = walker.nextNode())) targets.push(node);

    let count = 0;
    const MAX = 1000;
    for (const t of targets) {
      if (count >= MAX) break;
      const orig = t.nodeValue;
      // Build folded string + map[k] = index in orig of the k-th folded char.
      let norm = '';
      const map = [];
      for (let i = 0; i < orig.length; i++) {
        const f = foldChar(orig[i]);
        if (f) { norm += f; map.push(i); }
      }
      if (!norm) continue;
      // Collect match ranges (in orig coordinates) for all terms.
      const ranges = [];
      for (const q of terms) {
        for (const idx of wordMatches(norm, q)) {
          const oStart = map[idx];
          const oEnd = (idx + q.length < map.length) ? map[idx + q.length] : orig.length;
          ranges.push([oStart, oEnd]);
        }
      }
      if (!ranges.length) continue;
      ranges.sort((a, b) => a[0] - b[0]);
      // Merge overlaps.
      const merged = [];
      for (const r of ranges) {
        const lastR = merged[merged.length - 1];
        if (lastR && r[0] <= lastR[1]) lastR[1] = Math.max(lastR[1], r[1]);
        else merged.push([r[0], r[1]]);
      }
      const frag = idoc.createDocumentFragment();
      let pos = 0;
      for (const [a, b] of merged) {
        if (count >= MAX) break;
        if (a > pos) frag.appendChild(idoc.createTextNode(orig.slice(pos, a)));
        const span = idoc.createElement('span');
        span.className = 'zim-hl';
        span.textContent = orig.slice(a, b);
        frag.appendChild(span);
        hlSpans.push(span);
        count++;
        pos = b;
      }
      if (pos < orig.length) frag.appendChild(idoc.createTextNode(orig.slice(pos)));
      if (t.parentNode) t.parentNode.replaceChild(frag, t);
    }

    updateMatchNav();
    if (hlSpans.length) focusMatch(0);
  }

  // ----- in-article find bar: match navigation (prev / next + counter) -----
  let findBarOpen = false;
  function updateMatchNav() {
    if (!els.matchNav) return;
    const n = hlSpans.length;
    // Show the nav bar only when it's useful: the user opened "find in page",
    // or there is more than one match to move between. A single highlighted
    // hit just stays marked, with no bar.
    els.matchNav.hidden = !(findBarOpen || n > 1);
    if (els.matchCount) els.matchCount.textContent = n ? ((hlIndex + 1) + '/' + n) : '0/0';
  }
  function focusMatch(i) {
    if (!hlSpans.length) return;
    hlIndex = (i + hlSpans.length) % hlSpans.length;
    hlSpans.forEach((s, k) => { s.className = (k === hlIndex) ? 'zim-hl zim-hl-current' : 'zim-hl'; });
    const el = hlSpans[hlIndex];
    if (el && el.scrollIntoView) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      catch (_) { try { el.scrollIntoView(); } catch (_e) {} }
    }
    updateMatchNav();
  }
  function gotoMatch(delta) { if (hlSpans.length) focusMatch(hlIndex + delta); }
  function openFindBar() {
    if (!workerReady) return;
    findBarOpen = true;
    updateMatchNav();
    if (els.matchInput) { els.matchInput.focus(); try { els.matchInput.select(); } catch (_) {} }
  }
  function closeFindBar() {
    findBarOpen = false;
    if (els.matchInput) els.matchInput.value = '';
    try { highlightInIframe(''); } catch (_) {}   // unwrap marks + hide the bar
  }

  async function renderArticle(path, resp, highlight) {
    currentArticlePath = path;
    savePosition(path);
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

    // Blend the article's native (MediaWiki-gray) page background into the
    // plugin's surface colour so no gray band shows around the content.
    try {
      const rootStyle = getComputedStyle(document.documentElement);
      const surface = (rootStyle.getPropertyValue('--color-surface') || '').trim() || '#ffffff';
      const onSurface = (rootStyle.getPropertyValue('--color-on-surface') || '').trim();
      const st = doc.createElement('style');
      st.textContent =
        'html,body{background:' + surface + ' !important;margin:0 !important;' +
        (onSurface ? 'color:' + onSurface + ';' : '') + '}' +
        // Neutralise MediaWiki's centred, max-width content columns and their
        // gray page background so no empty gray band shows beside the text.
        'body,.mw-body,.mw-parser-output,#content,#bodyContent,#mw-content-text,' +
        '.mw-page-container,.vector-body,.mw-content-container,#mw-page-base,#mw-head-base{' +
        'background:transparent !important;box-shadow:none !important;border:none !important;' +
        'max-width:none !important;width:auto !important;margin-inline:0 !important;}';
      doc.head.appendChild(st);
    } catch (_) { /* non-fatal */ }

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
      if (!href) return;
      if (href.startsWith('#')) return; // hash-only link → leave alone for in-page nav
      if (/^(mailto:|tel:|javascript:)/i.test(href)) {
        // Non-navigable-in-archive schemes — block; no target="_blank" (that
        // used to trigger a host-level "open new window" flow that crashed
        // the plugin). Leave the href as-is (hovering still shows it) and
        // just mark it; the click handler below blocks the click.
        el.setAttribute('data-zim-external', '1');
        return;
      }
      const resolved = resolvePath(href, path);
      if (!resolved) {
        // Doesn't resolve to a path inside this archive — an external site
        // (http/https, protocol-relative, or a bare domain). Block the same way.
        el.setAttribute('data-zim-external', '1');
        return;
      }
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
            if (target.hasAttribute('data-zim-external')) {
              ev.preventDefault();
              notifyError('קישור זה מפנה לאתר חיצוני ואינו נגיש מתוך התוסף.');
              return;
            }
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
      // Highlight the newly rendered article: prefer an active find-in-page
      // query, otherwise the search term the result was opened with. This also
      // keeps the match-nav counter in sync with the currently open entry.
      try {
        if (findBarOpen && els.matchInput && els.matchInput.value.trim()) {
          highlightInIframe(els.matchInput.value.trim());
        } else {
          if (els.matchInput) els.matchInput.value = highlight || '';   // reflect the opened search term
          highlightInIframe(highlight);
        }
      } catch (_) {}
      // Refresh heading navigation for the newly rendered article.
      if (!els.searchBox.value.trim()) {
        renderTOC();
      } else if (els.tocList && !els.tocList.hidden) {
        renderHeadingsInto(els.tocList);   // keep the in-page heading list in sync
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
  // Primary open: native picker (persistent token + range streaming).
  // Falls back to the hidden <input type=file> if the picker is unavailable.
  if (els.openBtn) {
    els.openBtn.addEventListener('click', async () => {
      const handled = await openViaPicker();
      if (!handled) els.fileInput.click();
    });
  }
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
  // Touch fallback: some WebViews don't focus an input on tap — force it so the
  // keyboard opens and typing works without needing a mouse click.
  els.searchBtn.addEventListener('click', runFullTextSearch);
  els.homeBtn.addEventListener('click', () => {
    // Home clears an active search and closes the side panel + find bar.
    els.searchBox.value = '';
    panelOpen = false;
    clearPanel();
    closeFindBar();
    tryOpenMainPage();
  });
  if (els.sidebarToggle) els.sidebarToggle.addEventListener('click', toggleSidebar);

  // Cancel search → back to the table of contents (re-enables heading nav).
  if (els.sidebarClear) {
    els.sidebarClear.addEventListener('click', () => {
      els.searchBox.value = '';
      renderTOC();
      els.searchBox.focus();
    });
  }
  // Toggle: search in-content (with snippets) vs titles only.
  if (els.resultsScope) {
    els.resultsScope.addEventListener('click', () => {
      searchInContent = !searchInContent;
      updateScopeBtn();
      Otz.call('storage.set', { key: 'zimSearchInContent', value: searchInContent ? '1' : '0' }).catch(() => {});
      if (els.searchBox.value.trim()) onSuggestInput();
    });
    updateScopeBtn();
  }
  // Prev/next navigation between highlighted matches in the article.
  if (els.matchPrev) els.matchPrev.addEventListener('click', () => gotoMatch(-1));
  if (els.matchNext) els.matchNext.addEventListener('click', () => gotoMatch(1));
  if (els.matchClose) els.matchClose.addEventListener('click', closeFindBar);
  // Toggle: clicking "חפש בדף" again closes the find-in-page bar.
  if (els.findInPage) els.findInPage.addEventListener('click', () => {
    if (findBarOpen) closeFindBar(); else openFindBar();
  });
  if (els.matchInput) {
    const onFindInput = debounce(() => {
      try { highlightInIframe(els.matchInput.value.trim()); } catch (_) {}
    }, 200);
    els.matchInput.addEventListener('input', onFindInput);
    els.matchInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); gotoMatch(ev.shiftKey ? -1 : 1); }
      else if (ev.key === 'Escape') { ev.preventDefault(); closeFindBar(); }
    });
  }
  // Expand/collapse the in-page heading navigation shown beside search results.
  if (els.tocToggle) {
    els.tocToggle.addEventListener('click', () => {
      const willShow = els.tocList.hidden;
      if (willShow) renderHeadingsInto(els.tocList);
      els.tocList.hidden = !willShow;
      if (els.tocArrow) els.tocArrow.textContent = willShow ? '▾' : '▸';
    });
  }

  // Archive switcher (like Kiwix): pick an open archive to switch to it.
  if (els.archiveSelect) {
    els.archiveSelect.addEventListener('change', (ev) => {
      switchToToken(ev.target.value);
    });
  }
  if (els.archiveRemove) {
    els.archiveRemove.addEventListener('click', async () => {
      const token = activeToken;
      if (!token) return;
      const current = library.find((a) => a.token === token);
      const c = await Otz.call('ui.showConfirm', {
        title: 'הסרת קובץ מהרשימה',
        content: 'להסיר את הקובץ "' + (current ? current.name : '') +
                 '" מרשימת הקבצים הפתוחים? הדף הנוכחי ייסגר.'
      }).catch(() => null);
      // { confirmed: true|false }; treat a missing/false answer as "no".
      if (!c || !c.success || !c.data || c.data.confirmed !== true) return;
      const next = library.find((a) => a.token !== token);
      removeFromLibrary(token);
      if (next) switchToToken(next.token);
      else resetToWelcome();
    });
  }

  // -----------------------------------------------------------------------
  // Ready-made archive downloads
  // -----------------------------------------------------------------------
  function openDrawer() {
    if (!els.drawer) return;
    els.drawer.hidden = false;
    els.drawerOverlay.hidden = false;
    els.drawer.setAttribute('aria-hidden', 'false');
    // Force reflow so the slide-in transition runs.
    void els.drawer.offsetWidth;
    els.drawer.classList.add('open');
  }

  function closeDrawer() {
    if (!els.drawer) return;
    els.drawer.classList.remove('open');
    els.drawer.setAttribute('aria-hidden', 'true');
    els.drawerOverlay.hidden = true;
    // Hide after the transition ends so it can't catch clicks.
    setTimeout(() => { els.drawer.hidden = true; }, 250);
  }

  async function downloadArchive(item, buttonEl) {
    // Direct download to disk via the Otzaria SDK. Requires the URL to be in
    // this manifest's network.allowlist AND in Otzaria's global allowlist.
    if (buttonEl && buttonEl.disabled) return;
    const nameEl = buttonEl ? buttonEl.querySelector('.dl-name') : null;
    const wasLabel = nameEl ? nameEl.textContent : null;
    if (buttonEl) buttonEl.disabled = true;
    if (nameEl) nameEl.textContent = '⏳ מוריד…';
    setStatus('מוריד את ' + item.title + '…', true);
    try {
      const resp = await Otz.call('network.download', { url: item.url, filename: item.filename });
      if (resp && resp.success && resp.data && resp.data.path) {
        setStatus('הקובץ נשמר: ' + resp.data.path, false);
        notifyOk(item.title + ' הורד בהצלחה אל: ' + resp.data.path);
      } else {
        const err = (resp && resp.error) || 'שגיאה לא ידועה';
        notifyError('הורדת ' + item.title + ' נכשלה: ' + (err.message || err));
      }
    } catch (err) {
      notifyError('הורדת ' + item.title + ' נכשלה: ' + (err && err.message ? err.message : err));
    } finally {
      if (buttonEl) buttonEl.disabled = false;
      if (nameEl && wasLabel != null) nameEl.textContent = wasLabel;
    }
  }

  if (els.downloadsToggle) els.downloadsToggle.addEventListener('click', openDrawer);
  if (els.drawerClose)     els.drawerClose.addEventListener('click', closeDrawer);
  if (els.drawerOverlay)   els.drawerOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && els.drawer && !els.drawer.hidden) closeDrawer();
  });

  DOWNLOADS.forEach((item) => {
    const buttonEl = els[item.btn];
    if (buttonEl) buttonEl.addEventListener('click', () => downloadArchive(item, buttonEl));
  });

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
    // Rebuild the library and re-open the last-used archive at its last article.
    restoreLibraryAndActive();
  });
  Otz.on('theme.changed', applyTheme);

  // If no boot event arrives (e.g. plain browser preview), still show ready
  setTimeout(() => {
    if (!els.status.textContent) setStatus('מוכן. בחר/י קובץ ZIM כדי להתחיל.', false);
  }, 500);
})();
