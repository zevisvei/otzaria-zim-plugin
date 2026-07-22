#!/usr/bin/env python3
"""
Build milon-klei-kodesh.zim from the KleiKodeshProject Dictionary.db.

Usage:
  python build_milon_zim.py --db Dictionary.db --output milon-klei-kodesh.zim

Source: https://github.com/KleiKodesh/KleiKodeshProject
  KitveiHakodesh/CSharpBackend/KitveiHakodeshService/Dictionary/Dictionary.db
(a SQLite DB with tables word/sense/link/link_kind/source_kind)

One page per headword that has at least one sense (a bare cross-reference
target with no definition of its own isn't worth a page). Each page lists
every definition (with nikud and source) and, if any, the word's outgoing
links (shown as plain text, matching the original template — not clickable,
since a link's target may not have a page of its own).

Requires: pip install libzim
"""
import argparse
import base64
import datetime
import html
import os
import sqlite3
import sys

from libzim.writer import Creator, Item, StringProvider, Hint, Compression

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(SCRIPT_DIR, 'milon-zim-assets')
ICON_48 = os.path.join(ASSETS_DIR, 'icon-48.png')
LOGO_B64_FILE = os.path.join(ASSETS_DIR, 'logo_b64.txt')

SOURCE_REPO = 'https://github.com/KleiKodesh'
ZIM_NAME = 'kk_dictionary_he'
MAIN_PAGE = 'index'

ENTRY_CSS = (
    "body{font-family:'David',Georgia,serif;direction:rtl;line-height:1.75;max-width:820px;"
    "margin:0 auto;padding:16px;color:#1f1a12}"
    "h1{font-size:1.7rem;color:#5a3d1a;border-bottom:2px solid #a5794a;padding-bottom:6px;margin-bottom:.4em}"
    "h1 .nikud{font-size:1.35rem;color:#a5794a;font-weight:700}"
    ".meta{color:#8a6a45;font-size:.95rem;margin:.2em 0 1em}"
    ".sense{margin:14px 0;padding:12px 14px;background:#faf6f0;border-inline-start:3px solid #a5794a;border-radius:8px}"
    ".sense+.sense{margin-top:10px}"
    "ol.defs{margin:.4em 0;padding-inline-start:22px}ol.defs>li{margin:.5em 0}"
    "ul.examples{margin:.3em 0;padding-inline-start:18px;list-style:'— '}"
    "ul.examples li{color:#4a3a25;font-size:.95rem}"
    ".exsrc{color:#a5794a;font-size:.85rem}"
    "h3{font-size:1.05rem;color:#5a3d1a;margin:.8em 0 .2em}"
    ".src{font-size:.85rem;color:#8a6a45;margin-top:6px}"
    ".links li{margin:4px 0}.kind{color:#a5794a;font-weight:700}"
    ".nk{font-size:1.2rem;font-weight:700;color:#5a3d1a;margin-inline-end:8px}"
)

INDEX_CSS = (
    "body{font-family:'David',Georgia,serif;direction:rtl;margin:0;min-height:100vh;display:flex;"
    "align-items:center;justify-content:center;background:linear-gradient(135deg,#f7f2ea,#e7dccb);"
    "color:#3a2b16;padding:24px;box-sizing:border-box}"
    ".card{background:#fff;max-width:560px;width:100%;border-radius:18px;"
    "box-shadow:0 12px 40px rgba(90,61,26,.18);padding:38px 30px;text-align:center;border-top:6px solid #a5794a}"
    ".card h1{font-size:2rem;margin:.1em 0;color:#5a3d1a}"
    ".sub{color:#8a6a45;font-size:1.05rem;margin-bottom:24px}"
    ".count{font-size:3.1rem;font-weight:800;color:#a5794a;line-height:1;font-variant-numeric:tabular-nums}"
    ".count small{display:block;font-size:1rem;font-weight:400;color:#8a6a45;margin-top:6px}"
    ".desc{margin:24px 0;line-height:1.75}"
    ".hint{background:#faf6f0;border-radius:12px;padding:14px;color:#5a3d1a;font-size:1.05rem}"
    ".foot{margin-top:22px;font-size:.85rem;color:#a08a6a}"
    ".logo{width:72px;height:72px;border-radius:16px;object-fit:contain;margin-bottom:10px;"
    "box-shadow:0 3px 10px rgba(0,0,0,.15)}"
    ".gh{margin-top:12px;font-size:.9rem}"
    ".gh a{color:#5a3d1a;text-decoration:none;border-bottom:1px dashed #a5794a}"
    ".gh a:hover{color:#a5794a}"
)


def load_words(db_path):
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    cur.execute("select id, headword from word")
    words = {row[0]: row[1] for row in cur.fetchall()}

    senses = {}
    cur.execute("select word_id, nikud, text, source_id from sense order by id")
    for word_id, nikud, text, source_id in cur.fetchall():
        senses.setdefault(word_id, []).append((nikud, text, source_id))

    links = {}
    cur.execute("select word_id, target_id, kind_id from link order by rowid")
    for word_id, target_id, kind_id in cur.fetchall():
        links.setdefault(word_id, []).append((target_id, kind_id))

    cur.execute("select id, name from source_kind")
    source_names = dict(cur.fetchall())
    cur.execute("select id, name from link_kind")
    link_kind_names = dict(cur.fetchall())

    con.close()
    return words, senses, links, source_names, link_kind_names


def build_entry_html(headword, word_senses, word_links, words, source_names, link_kind_names):
    h = html.escape(headword)
    parts = [
        "<!DOCTYPE html><html lang='he' dir='rtl'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<style>%s</style><title>%s</title></head><body><h1>%s</h1>" % (ENTRY_CSS, h, h)
    ]
    for nikud, text, source_id in word_senses:
        parts.append("<div class='sense'>")
        if nikud:
            parts.append("<span class='nk'>%s</span>" % html.escape(nikud))
        parts.append("<span>%s</span>" % html.escape(text))
        src_name = source_names.get(source_id)
        if src_name:
            parts.append("<div class='src'>מקור: %s</div>" % html.escape(src_name))
        parts.append("</div>")
    if word_links:
        parts.append("<h3>קישורים</h3><ul class='links'>")
        for target_id, kind_id in word_links:
            target_word = words.get(target_id)
            kind_name = link_kind_names.get(kind_id)
            if not target_word or not kind_name:
                continue
            parts.append(
                "<li><span class='kind'>%s</span>: %s</li>"
                % (html.escape(kind_name), html.escape(target_word))
            )
        parts.append("</ul>")
    parts.append("</body></html>")
    return "".join(parts)


def build_index_html(entry_count, logo_b64, build_date):
    return (
        "<!DOCTYPE html><html lang='he' dir='rtl'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<style>%(css)s</style><title>מילון</title></head><body>"
        "<div class='card'>"
        "<img class='logo' src='data:image/png;base64,%(logo)s' alt='מילון' />"
        "<h1>מילון</h1>"
        "<div class='sub'>מילון מפרויקט כלי קודש</div>"
        "<div class='count'>%(count)s<small>ערכים</small></div>"
        "<p class='desc'>לכל ערך מופיעים הניקוד, פירוש/י המילה, המקור, וקישורים למילים נרדפות וקשורות.</p>"
        "<div class='hint'>\U0001F50D השתמשו בתיבת החיפוש כדי למצוא ערך</div>"
        "<div class='foot'>מקור: כלי קודש · עודכן %(date)s</div>"
        "<div class='gh'><a href='%(repo)s' target='_blank' rel='noopener'>\U0001F517 %(repo)s</a></div>"
        "</div></body></html>"
        % {
            'css': INDEX_CSS,
            'logo': logo_b64,
            'count': '{:,}'.format(entry_count),
            'date': build_date,
            'repo': SOURCE_REPO,
        }
    )


class HtmlPage(Item):
    def __init__(self, path, title, html_content):
        super().__init__()
        self.path = path
        self.title = title
        self.html_content = html_content

    def get_path(self):
        return self.path

    def get_title(self):
        return self.title

    def get_mimetype(self):
        return 'text/html'

    def get_contentprovider(self):
        return StringProvider(self.html_content)

    def get_hints(self):
        return {Hint.FRONT_ARTICLE: True}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', required=True, help='Path to Dictionary.db')
    ap.add_argument('--output', required=True, help='Output .zim path')
    args = ap.parse_args()

    words, senses, links, source_names, link_kind_names = load_words(args.db)

    headwords = sorted((wid, hw) for wid, hw in words.items() if wid in senses)
    if not headwords:
        print('No words with senses found in %s' % args.db, file=sys.stderr)
        sys.exit(1)

    if os.path.exists(args.output):
        os.remove(args.output)

    creator = Creator(args.output)
    creator.config_compression(Compression.zstd)
    creator.config_indexing(True, 'heb')
    creator.set_mainpath(MAIN_PAGE)

    with open(LOGO_B64_FILE, encoding='ascii') as fh:
        logo_b64 = fh.read().strip()
    build_date = datetime.date.today().isoformat()

    with creator:
        for word_id, headword in headwords:
            entry_html = build_entry_html(
                headword,
                senses.get(word_id, []),
                links.get(word_id, []),
                words,
                source_names,
                link_kind_names,
            )
            creator.add_item(HtmlPage(headword, headword, entry_html))

        creator.add_item(HtmlPage(MAIN_PAGE, 'מילון', build_index_html(len(headwords), logo_b64, build_date)))

        with open(ICON_48, 'rb') as fh:
            creator.add_illustration(48, fh.read())

        creator.add_metadata('Name', ZIM_NAME)
        creator.add_metadata('Title', 'מילון')
        creator.add_metadata('Description', 'מילון מפרויקט כלי קודש')
        creator.add_metadata('Language', 'heb')
        creator.add_metadata('Creator', 'KleiKodeshProject contributors')
        creator.add_metadata('Publisher', 'Otzaria')
        creator.add_metadata('Date', build_date)
        creator.add_metadata('Scraper', 'build_milon_zim.py')
        creator.add_metadata('Flavour', 'dictionary')

    print('Built %s (%d entries)' % (args.output, len(headwords)))


if __name__ == '__main__':
    main()
