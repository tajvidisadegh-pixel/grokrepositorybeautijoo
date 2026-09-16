#!/usr/bin/env python3
"""Restore panel-api.ts from main if corrupted, then fix media upload path."""
import urllib.request
from pathlib import Path

p = Path('frontend/src/lib/panel-api.ts')
text = p.read_text() if p.exists() else ''
if 'PLACEHOLDER' in text or 'uploadMyMedia' not in text or len(text) < 1000:
    url = 'https://raw.githubusercontent.com/tajvidisadegh-pixel/grokrepositorybeautijoo/main/frontend/src/lib/panel-api.ts'
    text = urllib.request.urlopen(url, timeout=60).read().decode()
    print('restored from main', len(text))

old = '''  const res = await fetch(`${API_URL}/professionals/me/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });'''
new = '''  const res = await fetch(`${API_URL}/professionals/me/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    credentials: 'include',
  });'''

if '/professionals/me/media/upload' not in text:
    if old not in text:
        raise SystemExit('upload fetch pattern not found')
    text = text.replace(old, new, 1)
    print('path fixed')
else:
    print('path already correct')

if 'PLACEHOLDER' in text:
    raise SystemExit('still placeholder')
p.write_text(text)
print('OK', len(text))
