#!/usr/bin/env python3
"""
Recompute the plugin's ZIM allowlist blob (_k3 in js/app.js) after a fresh
otzaria_wiki.zim build.

The allowlist is a set-membership test: js/app.js hashes SHA256(salt || s)
for a candidate string s (either a whole-file fingerprint, or a ZIM "Name"
metadata value) and checks whether that 32-byte digest appears anywhere in
the base64-packed _k3 blob. This script rebuilds that blob from scratch
each run: one entry per fixed fingerprint in zim-allowlist-entries.json,
plus a freshly computed fingerprint for the newly built otzaria_wiki.zim
(so a wiki rebuild is auto-approved without weakening the other files'
exact-fingerprint pinning).

Requires the ZIM_ALLOWLIST_SALT env var (hex-encoded).

Usage:
  python update_allowlist.py --zim otzaria_wiki.zim --app-js js/app.js
"""
import argparse
import base64
import hashlib
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENTRIES_JSON = os.path.join(SCRIPT_DIR, 'zim-allowlist-entries.json')
CHUNK = 1 << 20  # 1 MiB, must match _c9 in app.js


def fingerprint(path):
    size = os.path.getsize(path)
    with open(path, 'rb') as fh:
        if size <= 2 * CHUNK:
            head = fh.read(size)
            tail = b''
        else:
            head = fh.read(CHUNK)
            fh.seek(size - CHUNK)
            tail = fh.read(CHUNK)
    buf = head + tail + str(size).encode('ascii')
    return hashlib.sha256(buf).hexdigest()


def stored_bytes(salt_hex, entry):
    salt = bytes.fromhex(salt_hex)
    return hashlib.sha256(salt + entry.encode('utf-8')).digest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zim', required=True, help='Path to the freshly built otzaria_wiki.zim')
    ap.add_argument('--app-js', required=True, help='Path to js/app.js to patch in place')
    args = ap.parse_args()

    salt_hex = os.environ.get('ZIM_ALLOWLIST_SALT')
    if not salt_hex:
        print('ZIM_ALLOWLIST_SALT env var is required', file=sys.stderr)
        sys.exit(1)

    with open(ENTRIES_JSON, encoding='utf-8') as fh:
        fixed_entries = json.load(fh)['fixed']

    new_fp = fingerprint(args.zim)
    print('otzaria_wiki.zim fingerprint: %s' % new_fp)

    all_entries = fixed_entries + [new_fp]
    blob = b''.join(stored_bytes(salt_hex, e) for e in all_entries)
    packed = base64.b64encode(blob).decode('ascii')

    with open(args.app_js, encoding='utf-8') as fh:
        src = fh.read()
    new_src, n = re.subn(r"var _k3 = '[^']*';", "var _k3 = '%s';" % packed, src, count=1)
    if n != 1:
        print('Could not find the _k3 assignment in %s' % args.app_js, file=sys.stderr)
        sys.exit(1)
    with open(args.app_js, 'w', encoding='utf-8') as fh:
        fh.write(new_src)

    print('Updated _k3 in %s (%d entries)' % (args.app_js, len(all_entries)))


if __name__ == '__main__':
    main()
