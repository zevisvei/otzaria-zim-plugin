#!/usr/bin/env python3
"""
Recompute the plugin's ZIM allowlist blob (_k3 in js/app.js) after rebuilding
one of the approved archives.

The allowlist is a set-membership test: js/app.js hashes SHA256(salt || s)
for a candidate string s (a whole-file fingerprint) and checks whether that
32-byte digest appears anywhere in the base64-packed _k3 blob. This script
updates one named entry in zim-allowlist-entries.json (keyed by archive,
e.g. "milon", "otzaria_wiki") to a freshly computed fingerprint, then
rebuilds the full _k3 blob from every entry in that file — so each archive
stays pinned to its own exact, individually-approved fingerprint.

Requires the ZIM_ALLOWLIST_SALT env var (hex-encoded).

Usage:
  python update_allowlist.py --zim otzaria_wiki.zim --app-js js/app.js --entries-key otzaria_wiki
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
    ap.add_argument('--zim', required=True, help='Path to the freshly built .zim')
    ap.add_argument('--app-js', required=True, help='Path to js/app.js to patch in place')
    ap.add_argument('--entries-key', required=True, help='Which entry in zim-allowlist-entries.json to update')
    args = ap.parse_args()

    salt_hex = os.environ.get('ZIM_ALLOWLIST_SALT')
    if not salt_hex:
        print('ZIM_ALLOWLIST_SALT env var is required', file=sys.stderr)
        sys.exit(1)

    with open(ENTRIES_JSON, encoding='utf-8') as fh:
        entries = json.load(fh)

    new_fp = fingerprint(args.zim)
    print('%s fingerprint: %s' % (args.zim, new_fp))
    entries[args.entries_key] = new_fp

    with open(ENTRIES_JSON, 'w', encoding='utf-8') as fh:
        json.dump(entries, fh, ensure_ascii=False, indent=2)
        fh.write('\n')

    blob = b''.join(stored_bytes(salt_hex, e) for e in entries.values())
    packed = base64.b64encode(blob).decode('ascii')

    with open(args.app_js, encoding='utf-8') as fh:
        src = fh.read()
    new_src, n = re.subn(r"var _k3 = '[^']*';", "var _k3 = '%s';" % packed, src, count=1)
    if n != 1:
        print('Could not find the _k3 assignment in %s' % args.app_js, file=sys.stderr)
        sys.exit(1)
    with open(args.app_js, 'w', encoding='utf-8') as fh:
        fh.write(new_src)

    print('Updated _k3 in %s (%d entries)' % (args.app_js, len(entries)))


if __name__ == '__main__':
    main()
