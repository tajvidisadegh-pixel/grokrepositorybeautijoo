#!/usr/bin/env python3
from pathlib import Path

auth = Path('frontend/src/lib/auth-storage.ts')
at = auth.read_text()

# Restore optional second param; mark intentionally unused
old1 = 'export function setTokens(accessToken: string): void {\n  accessTokenMemory = accessToken;\n}'
new1 = '''export function setTokens(accessToken: string, _refreshToken?: string): void {
  // refresh token is httpOnly cookie managed by backend; second arg kept for call-site compatibility
  void _refreshToken;
  accessTokenMemory = accessToken;
}'''

if old1 in at:
    auth.write_text(at.replace(old1, new1))
    print('setTokens restored with void')
elif 'setTokens(accessToken: string, _refreshToken?: string)' in at:
    print('already has two-arg form')
elif 'setTokens(accessToken: string)' in at:
    # broader replace
    at2 = at.replace(
        'export function setTokens(accessToken: string): void {',
        'export function setTokens(accessToken: string, _refreshToken?: string): void {',
    )
    if 'void _refreshToken' not in at2:
        at2 = at2.replace(
            'export function setTokens(accessToken: string, _refreshToken?: string): void {\n  accessTokenMemory = accessToken;',
            'export function setTokens(accessToken: string, _refreshToken?: string): void {\n  void _refreshToken;\n  accessTokenMemory = accessToken;',
        )
    auth.write_text(at2)
    print('setTokens patched broad')
else:
    print('pattern miss')
    print(at)
print('DONE')
