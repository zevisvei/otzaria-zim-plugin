# קורא ZIM — תוסף לאוצריא

תוסף שמאפשר לקרוא קבצי **ZIM** (Kiwix) בתוך אוצריא: ויקיפדיה offline, ויקיטקסט, פרויקט גוטנברג ועוד. מבוסס על ספריית **libzim** (WebAssembly) של פרויקט [Kiwix](https://www.kiwix.org).

## אפשרויות

- פתיחת קובץ `.zim` מקומי (כולל ארכיוני Wikipedia גדולים — נטען ב-streaming, לא מועלה לזיכרון)
- חיפוש לפי כותר עם הצעות אוטומטיות
- חיפוש טקסט מלא (Xapian) — כאשר הארכיון תומך בכך
- ניווט פנימי בין ערכים, כולל קישורים, תמונות וגיליונות סגנון
- הסרה אוטומטית של JavaScript מתוך ערכים (מטעמי אבטחה)

## הרשאות נדרשות

| הרשאה | למה |
|-------|-----|
| `ui.feedback` | הצגת הודעות שגיאה למשתמש |
| `plugin.storage.read` / `plugin.storage.write` | זכירת שם הקובץ האחרון שנפתח |

> התוסף **אינו** ניגש לרשת ואינו ניגש לקבצים מחוץ לתיקיית התוסף — מלבד קובץ ה-ZIM שהמשתמש בוחר במפורש דרך File Picker.

## בנייה

מתוך תיקיית `otzaria-zim-plugin/`:

### Windows (PowerShell)

```powershell
.\build.ps1
```

יווצר הקובץ `kiwix-zim-reader.otzplugin` בשורש התיקייה.

### macOS / Linux

```bash
zip -r kiwix-zim-reader.otzplugin manifest.json index.html css/ js/ icon/ \
  -x "*.DS_Store" -x "__MACOSX/*"
```

## התקנה

1. פתח/י את אוצריא, עבור/י ל**כלים → 🧩 תוספים → ⊕ התקן תוסף חדש**
2. בחר/י את `kiwix-zim-reader.otzplugin`
3. אשר/י את ההרשאות
4. בלשונית "ZIM" שתופיע — לחץ/י על "פתח קובץ ZIM…"

## הורדת קבצי ZIM

קבצי ZIM ניתן להוריד מ-<https://library.kiwix.org>. לדוגמה:

- ויקיפדיה עברית (גרסה מצומצמת ~1GB / מלאה ~30GB)
- ויקיטקסט עברית
- פרויקט גוטנברג

> **טיפ:** קבצים גדולים מאוד (מעל ~4GB) עשויים להיות איטיים לטעינה הראשונית. WORKERFS של emscripten משתמש ב-File API לקריאה אקראית, כך שאין צורך לטעון את כל הקובץ לזיכרון.

## רישוי

- קוד התוסף: GPL v3 (כמו kiwix-js)
- libzim WebAssembly: GPL v3 — Copyright Kiwix
- ראה [LICENSE-GPLv3.txt](https://github.com/kiwix/kiwix-js/blob/main/LICENSE-GPLv3.txt)

## מקורות וקרדיטים

תוסף זה מסתמך על קוד ה-WebAssembly שנבנה על ידי פרויקט Kiwix:
<https://github.com/kiwix/kiwix-js>

הקבצים `js/libzim-wasm.js` ו-`js/libzim-wasm.wasm` הועתקו ללא שינוי מ-`kiwix-js/www/js/lib/`.
