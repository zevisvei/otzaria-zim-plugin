#!/usr/bin/env python3
"""
Build otzaria_wiki.zim from the live GitHub wiki (Otzaria/otzaria.wiki.git).

Usage:
  python build_wiki_zim.py --wiki-dir <path to a checkout of otzaria.wiki.git> --output <out.zim>

Every page gets a fixed Hebrew footer pointing back at its own page on the
live wiki, so readers always know where to report a fix. GitHub wiki
"[[Display|Target]]" / "[[Target]]" links are rewritten to local ZIM paths
matching each page's filename (without ".md").

Requires: pip install libzim markdown
"""
import argparse
import datetime
import os
import re
import sys

from libzim.writer import Creator, Item, StringProvider, Hint, Compression
import markdown

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(SCRIPT_DIR, 'wiki-zim-assets')
ICON_48 = os.path.join(ASSETS_DIR, 'icon-48.png')
ICON_96 = os.path.join(ASSETS_DIR, 'icon-96.png')
LOGO_PNG = os.path.join(ASSETS_DIR, 'logo.png')
STYLE_CSS = os.path.join(ASSETS_DIR, 'style.css')

WIKI_REPO_URL = 'https://github.com/Otzaria/otzaria/wiki'
MAIN_PAGE = 'Home'
SIDEBAR_PAGE = '_Sidebar'
ZIM_NAME = 'otzaria_wiki'

WIKILINK_RE = re.compile(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]')


def wiki_page_title(md_text, fallback):
    m = re.search(r'^\s*#\s+(.+)$', md_text, re.MULTILINE)
    if m:
        return m.group(1).strip()
    return fallback.replace('-', ' ')


def rewrite_wikilinks(md_text, known_pages):
    def repl(m):
        first, second = m.group(1), m.group(2)
        if second:
            display, target = first, second
        else:
            display, target = first, first
        target = target.strip()
        if target not in known_pages:
            # Unknown target — leave the display text but don't link it,
            # rather than ship a link that 404s inside the archive.
            return display
        return '[%s](%s)' % (display, target)
    return WIKILINK_RE.sub(repl, md_text)


DIV_WRAP_RE = re.compile(r'^\s*<div dir="rtl">\s*\n(.*)\n\s*</div>\s*$', re.DOTALL)


def strip_rtl_div_wrapper(md_text):
    # Every page wraps its whole body in <div dir="rtl">...</div> just for
    # direction — redundant since we set dir="rtl" on <html> ourselves, and
    # markdown parsers don't reliably process Markdown syntax nested inside
    # a raw HTML block, which would otherwise leave the whole page unrendered.
    m = DIV_WRAP_RE.match(md_text)
    return m.group(1) if m else md_text


def markdown_to_html(md_text, known_pages):
    md_text = strip_rtl_div_wrapper(md_text)
    md_text = rewrite_wikilinks(md_text, known_pages)
    return markdown.markdown(md_text, extensions=['extra', 'sane_lists', 'md_in_html', 'toc'])


def build_page_html(page_name, md_text, known_pages, sidebar_html):
    body_html = markdown_to_html(md_text, known_pages)
    title = wiki_page_title(md_text, page_name)
    edit_url = WIKI_REPO_URL + '/' + page_name
    footer = (
        '<div class="footer">'
        'דף זה הוא מתוך הפרוייקט של ויקי אוצריא ב-GitHub. '
        'מצאתם טעות או רוצים להוסיף? '
        '<a href="%s">ערכו את הדף בוויקי</a> — '
        'ובעז"ה בהמשך הקובץ יתעדכן, והתיקון יופיע כאן.'
        '</div>'
    ) % edit_url
    html = (
        '<!DOCTYPE html>\n'
        '<html lang="he" dir="rtl">\n'
        '<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<title>%(title)s — ויקי אוצריא</title>\n'
        '<link rel="icon" type="image/png" href="logo.png">\n'
        '<link rel="apple-touch-icon" href="logo.png">\n'
        '<link rel="stylesheet" href="style.css">\n'
        '</head>\n'
        '<body>\n'
        '<div class="topbar"><a href="Home"><img src="logo.png" class="logo" alt="">ויקי אוצריא</a></div>\n'
        '<div class="wrap">\n'
        '<main class="content">\n'
        '%(body)s\n'
        '%(footer)s\n'
        '</main>\n'
        '<nav class="sidebar">%(sidebar)s</nav>\n'
        '</div>\n'
        '</body>\n'
        '</html>\n'
    ) % {'title': title, 'body': body_html, 'footer': footer, 'sidebar': sidebar_html}
    return html, title


class HtmlPage(Item):
    def __init__(self, path, title, html):
        super().__init__()
        self.path = path
        self.title = title
        self.html = html

    def get_path(self):
        return self.path

    def get_title(self):
        return self.title

    def get_mimetype(self):
        return 'text/html'

    def get_contentprovider(self):
        return StringProvider(self.html)

    def get_hints(self):
        return {Hint.FRONT_ARTICLE: True}


class BinaryAsset(Item):
    def __init__(self, path, mimetype, data):
        super().__init__()
        self.path = path
        self.mimetype = mimetype
        self.data = data

    def get_path(self):
        return self.path

    def get_title(self):
        return self.path

    def get_mimetype(self):
        return self.mimetype

    def get_contentprovider(self):
        return StringProvider(self.data)

    def get_hints(self):
        return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--wiki-dir', required=True, help='Path to a checkout of otzaria.wiki.git')
    ap.add_argument('--output', required=True, help='Output .zim path')
    args = ap.parse_args()

    md_files = sorted(f for f in os.listdir(args.wiki_dir) if f.endswith('.md'))
    if not md_files:
        print('No .md files found in %s' % args.wiki_dir, file=sys.stderr)
        sys.exit(1)
    known_pages = {f[:-3] for f in md_files}
    if MAIN_PAGE not in known_pages:
        print('Expected a %s.md main page, found: %s' % (MAIN_PAGE, sorted(known_pages)), file=sys.stderr)
        sys.exit(1)

    if os.path.exists(args.output):
        os.remove(args.output)

    creator = Creator(args.output)
    creator.config_compression(Compression.zstd)
    creator.config_indexing(True, 'heb')
    creator.set_mainpath(MAIN_PAGE)

    sidebar_html = ''
    sidebar_path = os.path.join(args.wiki_dir, SIDEBAR_PAGE + '.md')
    if os.path.exists(sidebar_path):
        with open(sidebar_path, 'r', encoding='utf-8') as fh:
            sidebar_html = markdown_to_html(fh.read(), known_pages)

    with creator:
        for fname in md_files:
            page_name = fname[:-3]
            with open(os.path.join(args.wiki_dir, fname), 'r', encoding='utf-8') as fh:
                md_text = fh.read()
            html, title = build_page_html(page_name, md_text, known_pages, sidebar_html)
            creator.add_item(HtmlPage(page_name, title, html))

        with open(LOGO_PNG, 'rb') as fh:
            creator.add_item(BinaryAsset('logo.png', 'image/png', fh.read()))
        with open(STYLE_CSS, 'rb') as fh:
            creator.add_item(BinaryAsset('style.css', 'text/css', fh.read()))

        with open(ICON_48, 'rb') as fh:
            creator.add_illustration(48, fh.read())
        with open(ICON_96, 'rb') as fh:
            creator.add_illustration(96, fh.read())

        creator.add_metadata('Name', ZIM_NAME)
        creator.add_metadata('Title', 'ויקי אוצריא')
        creator.add_metadata('Description', 'התיעוד הרשמי של אפליקציית אוצריא — מדריך למשתמש ותיעוד למפתחים')
        creator.add_metadata('Language', 'heb')
        creator.add_metadata('Creator', 'Otzaria Wiki contributors')
        creator.add_metadata('Publisher', 'Otzaria')
        creator.add_metadata('Date', datetime.date.today().isoformat())
        creator.add_metadata('Scraper', 'build_wiki_zim.py')
        creator.add_metadata('Flavour', 'wiki')

    print('Built %s (%d pages)' % (args.output, len(md_files)))


if __name__ == '__main__':
    main()
