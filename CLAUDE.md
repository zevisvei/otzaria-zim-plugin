# CLAUDE.md — Otzaria ZIM Reader Plugin

מסמך טכני למפתחים. מיועד גם ל-Claude/Copilot כדי להבין את ההקשר במהירות.

---

## 1. מה זה

תוסף (`.otzplugin`) לאפליקציית [Otzaria](https://github.com/Sivan22/otzaria) שמאפשר לקרוא קבצי **ZIM** (פורמט הארכיון של פרויקט [Kiwix](https://www.kiwix.org)) — ויקיפדיה offline, ויקיטקסט, פרויקט גוטנברג ועוד.

קוד ה-WebAssembly של libzim עצמו מועתק as-is מ-[kiwix/kiwix-js](https://github.com/kiwix/kiwix-js); כל השאר נכתב מאפס לסביבת הפלאגין של אוצריא.

---

## 2. למה זה לא "סתם kiwix-js בתוך plugin"

הניסיון הראשון היה לפתוח את `kiwix-js/www/index.html` בתוך WebView של אוצריא. זה לא עובד מכמה סיבות:

| בעיה | kiwix-js מסתמך על... | אצלנו |
|------|--------------------|-------|
| **טעינת UI מורכבת** | jQuery, Bootstrap, FontAwesome, מערכת ניתוב פנימית, Service Worker | UI מינימלי vanilla-JS, ללא תלויות |
| **Service Worker / Cache API** | משתמש ב-SW לשרת תוכן `<iframe>` בנתיבים יחסיים, או ב-`MessageChannel` mode מוגבל | אסור — `file://` עם origin=`null` לא תומך ב-SW; וגם אם היה תומך, אוצריא לא חושף scope. נטען HTML ל-iframe דרך `srcdoc` עם rewrites ידני של נכסים. |
| **`new Worker('js/lib/libzim-wasm.js')`** | עובד מ-`http(s)://` או מ-`chrome-extension://` | **נכשל** מ-`file://` ב-WebView: `Script at 'file://...' cannot be accessed from origin 'null'` |
| **`fetch('js/lib/libzim-wasm.wasm')`** | עובד באותם פרוטוקולים | **נכשל** עם `Failed to fetch` ב-origin=null |
| **Emscripten `locateFile` → fetch של `.wasm`** | מבצע `fetch(blobUrl)` בתוך ה-Worker | בתוך worker שנוצר מ-Blob, גישה ל-Blob URL אחר עלולה להיכשל בשקט (ה-promise של `onRuntimeInitialized` פשוט לא מופעל → timeout) |
| **Multiple namespaces, settings UI, library scanner, multiple archives, PWA installation, dark mode toggle, language switcher, content injection mode picker, Cache API status panel** | חלק אינטגרלי מ-kiwix-js | לא רלוונטי לפלאגין שמתארח בתוך אוצריא — מקבל ערכת נושא וגדלי טקסט מהמארח |
| **תאימות IE11, polyfills, FxOS, Ubuntu Touch** | קוד תאימות בכל מקום | אוצריא = WebView מודרני בלבד; קוד נקי |
| **קבצי ZIM מפוצלים (`.zimaa`/`.zimab`)** | תומך | כרגע **לא** תומך (`<input type="file">` יחיד) — ראה §10 |

### הבחירה הארכיטקטונית

נשמרים **רק** שני קבצים מ-kiwix-js: `libzim-wasm.js` (מ-emscripten) ו-`libzim-wasm.wasm`. כל השאר נזרק. הם לא מועתקים ישירות לתוך הפלאגין שנארז (`.otzplugin`) אלא עוטפים אותם:

- `libzim-wasm.js` → טקסט בתוך template-literal בקובץ `js/libzim-wasm-source.js`
- `libzim-wasm.wasm` → base64 ב-`js/libzim-wasm-data.js`

הסיבה: ב-`file://` (origin=null) ה-WebView לא מאפשר `new Worker(url)` ולא `fetch(url)` של קבצים יחסיים. שני הקבצים העוטפים נטענים דרך `<script src="...">` רגיל (שכן עובד מ-`file://`), ובזמן ריצה ה-JS הראשי בונה Blob URL ל-Worker ושולח את ה-WASM כ-`ArrayBuffer` עם הודעת ה-`init` ישירות לזיכרון של ה-Worker. ה-Worker קובע `Module.wasmBinary = ...` כך ש-Emscripten מדלג על כל ה-`fetch`.

זאת הסיבה המרכזית לכך שאי אפשר היה לקחת את kiwix-js כמו שהוא.

---

## 3. מבנה הקבצים

```
otzaria-zim-plugin/
├── manifest.json                   ← מטא-דאטה לפלאגין של אוצריא
├── index.html                      ← נקודת הכניסה (entrypoint)
├── css/
│   └── style.css                   ← UI; משתנה לפי colorScheme של אוצריא
├── icon/                           ← אופציונלי
├── js/
│   ├── app.js                      ← הקוד הראשי של הפלאגין (UI + RPC ל-Worker)
│   ├── libzim-wasm.js              ← מקור (לא נארז ב-.otzplugin)
│   ├── libzim-wasm.wasm            ← מקור (לא נארז)
│   ├── libzim-wasm-source.js       ← נוצר ע"י wrap-assets.ps1 — עטוף כמחרוזת
│   └── libzim-wasm-data.js         ← נוצר ע"י wrap-assets.ps1 — base64
├── tools/
│   └── wrap-assets.ps1             ← עוטף את ה-.js וה-.wasm לקבצים שנטענים ב-<script>
├── build.ps1                       ← מריץ את wrap-assets.ps1 ואורז .otzplugin
├── README.md                       ← למשתמש קצה
└── CLAUDE.md                       ← אתה כאן
```

> `kiwix-zim-reader.otzplugin` (תוצר הבילד) ו-`.build-stage/` (תיקיית staging) לא נכנסים ל-git.

---

## 4. זרימת ההפעלה (sequence)

```
plugin.boot (Otzaria SDK)
    └─ applyTheme(theme.colorScheme) → CSS vars
משתמש בוחר .zim ב-<input type="file">
    └─ loadArchive(file)
        ├─ ensureWorkerBlobs()
        │     ├─ base64ToUint8Array(__libzimWasmBase64) → wasmBinary (Uint8Array)
        │     ├─ patch __libzimWasmSource:
        │     │     'Module={};Module["onRuntimeInitialized"]='
        │     │     →
        │     │     'Module={wasmBinary:self.__libzimWasmBinary,locateFile:p=>p};Module["onRuntimeInitialized"]='
        │     ├─ הוסף shim שמיירט addEventListener('message') כדי לתפוס
        │     │   את wasmBinary מההודעה הראשונה לפני שהקוד המקורי רץ
        │     └─ workerBlobUrl = URL.createObjectURL(new Blob([shim + js]))
        ├─ worker = new Worker(workerBlobUrl)
        ├─ workerCall({action:'init', files:[file], wasmBinary: wasmCopy}, [wasmCopy.buffer])
        │     ↓ ב-Worker:
        │     ├─ shim תופס wasmBinary → self.__libzimWasmBinary
        │     ├─ ה-handler המקורי מוקרא: Module = {wasmBinary:..., locateFile:p=>p}
        │     ├─ FS.mount(WORKERFS, {files:[file]}, '/work')
        │     ├─ Module.onRuntimeInitialized → Module.loadArchive('/work/' + name)
        │     └─ postMessage('runtime initialized')
        ├─ workerCall({action:'getArticleCount'}) → סטטוס
        └─ tryOpenMainPage() → fallback של paths נפוצים
```

הקריאה ל-Worker היא תמיד דרך `MessageChannel` (כפי ש-`libzim-wasm.js` של Kiwix מצפה — `e.ports[0]`).

---

## 5. רינדור ערכים (HTML של ZIM ב-iframe)

ערכי ZIM הם HTML עם הפניות יחסיות (תמונות, CSS) לערכים אחרים בארכיון. אנחנו לא יכולים לתת ל-iframe את ה-HTML כפי שהוא — אין שרת.

הזרימה ב-`renderArticle(path, resp)`:

1. UTF-8 decode של `resp.content` → DOM ב-`DOMParser`.
2. **הסרה מוחלטת של כל `<script>`** (אבטחה — הערכים מתוך ZIM יכולים להכיל JS שרירותי).
3. הוספת `<base target="_self">` כדי שקליקים יישארו ב-iframe.
4. עבור כל `<img src>`, `<source src>`, `<video src>`, `<audio src>`, `<track src>`:
   - `resolvePath(href, articlePath)` → נתיב ZIM
   - `getBlobUrl(zimPath)` → `getEntryByPath` → `Blob` → `URL.createObjectURL`
   - החלף את ה-`src` ל-Blob URL (מנוצל cache לפי path)
5. עבור כל `<link rel="stylesheet" href>`:
   - `loadStyleSheet(zimPath)` → fetch entry, decode, scan `url(...)` בתוך ה-CSS, החלף כל אחד ל-Blob URL רקורסיבית, ארוז כ-`Blob('text/css')`.
6. עבור כל `<a href>`:
   - href שמתחיל ב-`http(s):/mailto:/tel:/javascript:` → `target=_blank` (יסתום ע"י sandbox)
   - href שמתחיל ב-`#` → השאר (ניווט בעמוד)
   - אחרת → קבע `data-zim-path` על האלמנט, נטרל `href="#"`
7. `iframe.srcdoc = '<!DOCTYPE html>' + doc.documentElement.outerHTML`
8. ב-`iframe.onload`, התקן `click` listener ב-capture mode:
   - אם נלחץ `<a>` עם `data-zim-path` → `preventDefault` + `openByPath(zimPath)` ב-parent.

`<iframe sandbox="allow-same-origin allow-popups">` — בלי `allow-scripts`, JS לא יכול לרוץ. עדיין נדרש `allow-same-origin` כדי שנוכל לגשת ל-`contentDocument` של ה-iframe ולקבל קליקים.

`blobCache` הוא `Map<zimPath, blobUrl>` שמתאפס ב-`loadArchive` חדש (`URL.revokeObjectURL` על כל אחד).

---

## 6. אינטגרציה עם אוצריא (SDK)

אוצריא מזריק `window.Otzaria` אוטומטית ל-WebView של פלאגינים (מתועד ב-[`docs/plugin-development-guide.md`](https://github.com/Sivan22/otzaria/blob/main/docs/plugin-development-guide.md)).

מה מנוצל כרגע:

| API | שימוש |
|-----|-------|
| `Otzaria.on('plugin.boot', cb)` | קבלת `theme.colorScheme` ראשוני |
| `Otzaria.on('theme.changed', cb)` | עדכון CSS vars בזמן אמת |
| `Otzaria.call('ui.showError', {message})` | הצגת שגיאות למשתמש |
| `Otzaria.call('ui.showMessage', {message})` | toast חיובי |
| `Otzaria.call('storage.set', {key, value})` | זיכרון של שם הקובץ האחרון |

**לא בשימוש (מודע):** `library.*`, `search.*`, `reader.*`, `notes.*`, `calendar.*`, `published_data.*`, `navigation.*` — כי תוכן ZIM הוא מקור חיצוני שאין לו `bookId` של אוצריא, ולכן אי אפשר לפתוח אותו ב-reader של אוצריא או לרשום עליו הערות. ראה §10.

יש fallback ב-`app.js` שמייצר `window.Otzaria` דמה אם רצים ב-browser רגיל (לבדיקות).

---

## 7. בנייה

### דרישות
- PowerShell 5.1+ (Windows; macOS/Linux לא נתמכים על ידי הסקריפט הנוכחי — אבל קל להמיר)
- שום dependency נוסף — אין `npm install`

### צעדים

```powershell
cd otzaria-zim-plugin
.\build.ps1
```

מה קורה בפועל:

1. `tools\wrap-assets.ps1` קורא את `js\libzim-wasm.js` ועוטף אותו ב-`self.__libzimWasmSource = ` + template-literal (אסקייפ של `\`, `` ` ``, `${`).
2. אותו דבר עם `js\libzim-wasm.wasm` → base64 → `self.__libzimWasmBase64 = "..."`.
3. נוצרים `js\libzim-wasm-source.js` (~137 KB) ו-`js\libzim-wasm-data.js` (~2.9 MB).
4. `build.ps1` מעתיק רק את הקבצים שנדרשים בריצה לתיקיית staging (`.build-stage`):
   - `manifest.json`, `index.html`, `README.md`
   - `css/style.css`
   - `js/app.js`, `js/libzim-wasm-source.js`, `js/libzim-wasm-data.js`
   - `icon/*` (אם קיים)

   הקבצים `libzim-wasm.js` ו-`libzim-wasm.wasm` המקוריים **לא** נארזים.
5. `Compress-Archive` → `kiwix-zim-reader.zip` → `Rename-Item` → `kiwix-zim-reader.otzplugin`.

תוצאה: `kiwix-zim-reader.otzplugin` (~1 MB).

### `.otzplugin` הוא ZIP

זה רק ZIP עם סיומת אחרת. אפשר לבדוק:

```powershell
Add-Type -Assembly System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead('kiwix-zim-reader.otzplugin')
$z.Entries | Select-Object FullName, Length
$z.Dispose()
```

`manifest.json` חייב להיות בשורש ה-ZIP (לא בתיקיית-מעטפת).

---

## 8. הרצה ובדיקה

### התקנה באוצריא

1. **כלים → 🧩 תוספים → ⊕ התקן תוסף חדש**
2. בחר את `kiwix-zim-reader.otzplugin`
3. אשר את ההרשאות (`ui.feedback`, `plugin.storage.read/write`)
4. תופיע לשונית "ZIM"

### בדיקה ב-browser רגיל (פיתוח מהיר)

הפלאגין כולל fallback ל-`window.Otzaria` כשהוא לא קיים, אז אפשר לפתוח את `index.html` ישירות ב-Chrome/Edge **דרך שרת מקומי**:

```powershell
# מתוך תיקיית הפלאגין
python -m http.server 8000
# גש ל-http://localhost:8000/
```

⚠️ **אסור לפתוח את `index.html` כ-`file://` ישירות בדפדפן.** אותן בעיות שיש לנו ב-WebView של אוצריא יקרו גם שם, אבל בלי ה-workaround של `<script>`+blob, כי `<script src="js/libzim-wasm-source.js">` מ-`file://` עובד אבל `new Worker(blobUrl)` ב-Chrome מ-`file://` נחסם בשם CSP.

### Debugging בתוך אוצריא

האפשרויות (לפי סדר עדיפות):

#### 1. מצב פיתוח של אוצריא (Hot-reload + DevTools) — מומלץ

זה המסלול הנוח ביותר. ה-Plugin SDK של אוצריא מספק "מצב פיתוח" שטוען את התוסף **ישירות מתיקייה מקומית** ללא אריזה ל-`.otzplugin`, ועם hot-reload בכל שמירה ([תיעוד מקור](https://github.com/Sivan22/otzaria/blob/main/docs/plugin-sdk/README.md#מצב-פיתוח-development-mode)):

1. הרץ את אוצריא ב-debug mode:
   ```bash
   cd path\to\otzaria
   flutter run -d windows   # או -d android / -d macos / -d linux
   ```
2. באוצריא: **כלים → 🧩 תוספים** → אייקון התיקייה בסרגל העליון (מופיע **רק** במצב debug).
3. בחר את `otzaria-zim-plugin/` (התיקייה הזו, **לא** את ה-`.otzplugin`).
4. התוסף יופיע עם תג `DEV`.

מה שמתקבל:
- **Hot-reload**: כל שמירה של `app.js`/`index.html`/`style.css` מרעננת אוטומטית את ה-WebView. cache מכובה.
- **DevTools מלאים** — `flutter_inappwebview` נטען עם `isInspectable: kDebugMode` (ראה [`plugin_tab_page.dart:314`](https://github.com/Sivan22/otzaria/blob/main/lib/plugins/view/plugin_tab_page.dart#L314)). אופן הגישה תלוי-פלטפורמה:
  - **Android**: עם הטלפון מחובר ב-USB ו-USB debugging פעיל, פתח Chrome במחשב → `chrome://inspect/#devices` → לחץ "inspect" על ה-WebView של אוצריא. (הדגל מופעל ב-[`plugin_tab_page.dart:535`](https://github.com/Sivan22/otzaria/blob/main/lib/plugins/view/plugin_tab_page.dart#L535) — `setWebContentsDebuggingEnabled(kDebugMode)`).
  - **Windows**: WebView2 (Edge). פתח חלון Edge חדש → `edge://inspect/#devices` → ה-WebView יופיע תחת "Remote Targets". מדבאג כמו דף Edge רגיל.
  - **macOS / iOS**: Safari → Develop → [Device Name] → בחר את ה-WebView של אוצריא.
  - **Linux**: GTK WebView, נדרש Chromium מתאים; פחות נוח.
- **Console messages** מהתוסף נכתבים גם ל-DB של אוצריא (`PluginSystemDatabase.writeLog`, ראה [`plugin_tab_page.dart:506-516`](https://github.com/Sivan22/otzaria/blob/main/lib/plugins/view/plugin_tab_page.dart#L506)) **וגם** ל-`debugPrint` של Flutter — כלומר מופיעים ב-stdout של `flutter run`. ניתן לראות אותם גם בהגדרות התוסף בתוך אוצריא (לוגים נשמרים בין הרצות).

#### 2. הרצת אוצריא release + לוגים

בלי debug mode, אין DevTools (`isInspectable: kDebugMode` יחזיר `false`). אבל `console.log/warn/error` עדיין נכתבים ל-DB דרך `onConsoleMessage`. אפשר לראות אותם ב:
- אוצריא → **כלים → תוספים → [שם התוסף] → ⚙ הגדרות → לוגים**
- או ישירות ב-DB של אוצריא (SQLite, טבלת `plugin_system_log`).

#### 3. Browser רגיל (Chrome / Edge) — בדיקות UI בלבד

הפלאגין כולל fallback ל-`window.Otzaria` כשהוא לא קיים. אבל **אסור** לפתוח את `index.html` כ-`file://` — אותן בעיות origin=null. במקום זאת:

```powershell
cd otzaria-zim-plugin
python -m http.server 8000
# פתח http://localhost:8000/
```

כאן `new Worker`, `fetch`, ו-WASM יעבדו בלי כל ה-workarounds (כי origin הוא `http://localhost`). שים לב ש-flow הבדיקה כאן שונה מהריצה האמיתית באוצריא (ב-`file://`), אז בעיות origin **לא יתפסו כאן**. השתמש לבדיקות UI/CSS/לוגיקה בלבד; תמיד לאמת ב-flow אמיתי באוצריא.

#### 4. דיבאג של ה-Worker עצמו

ב-DevTools של אוצריא במצב debug — לשונית **Sources / Debugger** מציגה גם את ה-Worker (`workerBlobUrl`). חיפוש לפי `addEventListener("message"` או `loadArchive` יביא אותך לקוד של libzim. אפשר לשים breakpoints.

הודעות שגיאה מה-Worker עוברות גם ל-`worker.onerror` בקוד שלנו ומשם ל-`notifyError` (toast באוצריא דרך `ui.showError`).


---

## 9. Pitfalls שנתקלנו בהם

### "Script at 'file://...' cannot be accessed from origin 'null'"
לא ניתן ליצור `new Worker(relativeUrl)` מ-`file://`. **פתרון:** Worker מ-Blob URL.

### "Failed to fetch" בעת `fetch('js/libzim-wasm.wasm')`
לא ניתן לעשות `fetch` של קבצים מקומיים מ-origin null. **פתרון:** טעינה דרך `<script>` (עוטף לתוך משתנה גלובלי).

### "Worker call timed out: init"
Emscripten ניסה `fetch(blobUrl)` ל-WASM מתוך worker שנוצר מ-Blob — נכשל בשקט ב-WebView, ה-`onRuntimeInitialized` לא הופעל לעולם. **פתרון:** העברת הבייטים של ה-WASM ישירות עם הודעת `init` כ-`ArrayBuffer` (transferable), והגדרת `Module.wasmBinary` כך ש-Emscripten ידלג על כל `fetch`.

### `transferable` נצרך
שולחים `wasmBinary` כ-Uint8Array ועם `[buffer]` ב-transfer. אחרי `postMessage`, ה-buffer בצד השולח **neutered** (`byteLength === 0`). לכן יוצרים copy לפני כל `init` חדש.

### Template-literal escaping ב-PowerShell
לעטוף את `libzim-wasm.js` (~137 KB) בתוך `` `...` `` של JS דורש לאסקייפ:
- `\` → `\\`
- `` ` `` → `` \` ``
- `${` → `\${`

**הסדר חשוב!** קודם backslash, אחרת תאסקייפ פעמיים. ראה `tools\wrap-assets.ps1`.

### CSS עם `url(...)`
גיליונות סגנון של ויקיפדיה כוללים `url(...)` להפניות לפונטים/אייקונים יחסיים. אם לא רוקדים אותם ל-Blob URLs, ה-iframe מחפש אותם ב-`null` origin ונכשל. ראה `loadStyleSheet`.

### iframe sandbox
`sandbox="allow-same-origin allow-popups"` — לא `allow-scripts` (הסרנו את כל ה-`<script>` בלאו הכי). שינוי כאן יכול לפתוח חור אבטחה רציני.

---

## 10. מגבלות ידועות + roadmap

| נושא | מצב | פתרון אפשרי |
|------|-----|------------|
| ZIM מפוצל (`.zimaa`/`.zimab`) | ❌ | החלף ל-`<input multiple>`, מיין לפי שם, העבר את כולם ב-`init.files` |
| גילוי "main page" של ZIM | חצי | מנסים paths ידועים; libzim חושף `getMainPage` ב-API שלא הותאם לעבודה ב-Web Worker של kiwix-js. אפשר להוסיף action חדש ל-libzim-wasm.js |
| תוכן ZIM ב-reader של אוצריא | ❌ | דורש שינוי בגרעין אוצריא — API ל-virtual books |
| חיפוש משולב עם `search.fullText` של אוצריא | ❌ | אותה סיבה |
| הערות (`notes.*`) על ערכי ZIM | ❌ | אין `bookId` |
| Service Worker לרינדור (במקום `srcdoc`) | ❌ | לא רלוונטי ב-WebView של פלאגין |
| ZIM בגדלים של GBs | ✅ | WORKERFS של emscripten עושה random reads דרך File API — לא נטען לזיכרון |

---

## 11. רישוי

- **קוד הפלאגין** (`app.js`, `index.html`, `style.css`, `build.ps1`, `wrap-assets.ps1`): GPL v3
- **`libzim-wasm.js` + `libzim-wasm.wasm`**: GPL v3, copyright Kiwix — מועתקים מ-[kiwix/kiwix-js](https://github.com/kiwix/kiwix-js)

ראה [LICENSE-GPLv3.txt](https://github.com/kiwix/kiwix-js/blob/main/LICENSE-GPLv3.txt).

---

## 12. עדכון libzim

כשיוצא גרסה חדשה של [kiwix-js](https://github.com/kiwix/kiwix-js):

```powershell
Copy-Item path\to\kiwix-js\www\js\lib\libzim-wasm.js   .\js\libzim-wasm.js
Copy-Item path\to\kiwix-js\www\js\lib\libzim-wasm.wasm .\js\libzim-wasm.wasm
.\build.ps1
```

**בדוק שה-`needle` עדיין נמצא** ב-`app.js` (`ensureWorkerBlobs`):

```js
const needle = 'Module={};Module["onRuntimeInitialized"]=';
```

אם Emscripten שינה את הפלט שלו — ה-needle יזוז. תקבל אזהרה בקונסולה: `[ZIM] could not patch libzim-wasm.js init handler`. תצטרך לעדכן את ה-needle לפלט החדש.

---

## 13. CI/CD

יש GitHub Action ב-`.github/workflows/release.yml` שמתפעל ב-push של תג בצורה `v*` (למשל `v0.1.0`):

1. רץ `.\build.ps1` על runner של Windows
2. מעלה `kiwix-zim-reader.otzplugin` כ-asset של GitHub Release

ליצירת רליס:

```bash
git tag v0.1.0
git push origin v0.1.0
```

הרליס ייווצר אוטומטית.
