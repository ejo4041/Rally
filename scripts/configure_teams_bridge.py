#!/usr/bin/env python3
"""Store runner service secrets from hidden stdin, never arguments or stdout."""
import json
import os
from pathlib import Path
import re
import sys
import termios

root = Path(__file__).resolve().parents[1]
path = root / '.env.local'
previous = None
if sys.stdin.isatty():
    previous = termios.tcgetattr(sys.stdin.fileno())
    hidden = previous.copy()
    hidden[3] &= ~termios.ECHO
    termios.tcsetattr(sys.stdin.fileno(), termios.TCSANOW, hidden)
print('Ready for runner settings on hidden stdin.', flush=True)
try:
    values = json.loads(sys.stdin.readline())
finally:
    if previous is not None:
        termios.tcsetattr(sys.stdin.fileno(), termios.TCSANOW, previous)
allowed = {'RALLY_TEAMS_SITE_URL', 'RALLY_TEAMS_BRIDGE_SECRET', 'RALLY_SITES_SERVICE_TOKEN'}
if set(values) != allowed:
    raise ValueError('Expected only runner connection settings.')
text = path.read_text() if path.exists() else ''
for key, value in values.items():
    if not isinstance(value, str) or not value or any(char in value for char in '\n\r"'):
        raise ValueError('Invalid runner setting.')
    line = key + '="' + value + '"'
    pattern = r'^' + re.escape(key) + r'=.*$'
    if re.search(pattern, text, re.MULTILINE):
        text = re.sub(pattern, lambda match: line, text, flags=re.MULTILINE)
    else:
        text = text.rstrip('\n') + '\n' + line + '\n'
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as stream:
    stream.write(text)
os.chmod(path, 0o600)
print('Runner settings saved to ignored .env.local; secret values omitted.')
