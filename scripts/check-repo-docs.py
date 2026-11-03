"""Offline checks for public-facing guides/media; no packages or model calls."""
from pathlib import Path
import hashlib,json,re,struct,sys,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
PAGES=['README.md','CONTRIBUTING.md','SECURITY.md','CHANGELOG.md','docs/README.md','docs/judge-quickstart.md','docs/architecture-overview.md','docs/capabilities.md','docs/faq.md','docs/assets/README.md']
errors=[]
for name in PAGES:
    text=(ROOT/name).read_text()
    links=re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',text)+re.findall(r'(?:src|href)="([^"#]+)"',text)
    for target in links:
        if re.match(r'^(?:https?://|mailto:|#)',target):continue
        target=target.split('#',1)[0].split('?',1)[0]
        if target and not (ROOT/name).parent.joinpath(target).exists():errors.append(f'{name}: missing target {target}')
    if re.search(r'(?:AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{30,}|-----BEGIN (?:OPENSSH |RSA )?PRIVATE KEY-----)',text):errors.append(f'{name}: possible credential; inspect privately')
assets=ROOT/'docs/assets'
manifest=json.loads((assets/'provenance.json').read_text())
for name,expected in manifest['files'].items():
    data=(assets/name).read_bytes()
    if hashlib.sha256(data).hexdigest()!=expected:errors.append(f'{name}: provenance hash mismatch')
    if len(data)>3_000_000:errors.append(f'{name}: keep README media below3MB')
gif=(assets/'workspace-tour.gif').read_bytes()
if gif[:6] not in (b'GIF87a',b'GIF89a') or struct.unpack('<HH',gif[6:10])!=(1000,714):errors.append('Unexpected GIF header/dimensions')
svg=ET.parse(assets/'rally-banner.svg')
for element in svg.iter():
    if element.tag.rsplit('}',1)[-1] in ('script','foreignObject'):errors.append('Executable SVG content is not allowed')
    if any('http' in value for key,value in element.attrib.items() if key.rsplit('}',1)[-1] in ('href','src')):errors.append('External SVG resource is not allowed')
if errors:
    print('\n'.join(errors),file=sys.stderr);sys.exit(1)
print(f'PASS: {len(PAGES)} curated guides, local links, media hashes/size, GIF dimensions and SVG content. No network or dependencies used.')
