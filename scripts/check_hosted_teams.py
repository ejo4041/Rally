#!/usr/bin/env python3
"""Read-only Teams deployment/runner check; credentials read from ignored env."""
import json
from pathlib import Path
import re
import urllib.request
from check_hosted_rally import SameOriginRedirect

root = Path(__file__).resolve().parents[1]
settings = {}
for line in (root / '.env.local').read_text().splitlines():
    match = re.fullmatch(r'([A-Z_]+)=(.*)', line)
    if match:
        settings[match[1]] = match[2].strip().strip('"\'')
base = 'https://rally-meeting-moderator.excavator3496.chatgpt.site'
opener = urllib.request.build_opener(SameOriginRedirect())
def get(path):
    req = urllib.request.Request(base + path, headers={
        'OAI-Sites-Authorization': 'Bearer ' + settings['RALLY_SITES_SERVICE_TOKEN'],
        'Origin': base,
    })
    with opener.open(req, timeout=20) as response:
        return response.read().decode()

html = get('/')
assert 'Invite Rally to Teams' in html
assert 'teams-connection' in html
assert 'teams-form' in get('/teams-client.js')
status = json.loads(get('/api/teams/status'))
assert status['enabled'] is True
assert status['online'] is True
result = {'passed': True, 'panelDeployed': True, 'runnerOnline': status['online'],
          'credentialsConfigured': status['credentialsConfigured'], 'testMinutes': status['testMinutes'],
          'realMeetingJoinedByCheck': False, 'museCalls': 0}
(root / 'docs/research/teams-hosted-check.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
