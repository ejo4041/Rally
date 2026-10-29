// Optional native capture QA against the already-authorized restricted Site.
// The fixture uses a real browser picker but a mocked model socket.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runNativeCapture} from '../apps/rally/tests/native-tab-browser.mjs';
const base='https://rally-meeting-moderator.excavator3496.chatgpt.site';
const settings=Object.fromEntries((await readFile(new URL('../.env.local',import.meta.url),'utf8')).split('\n').map(line=>{const i=line.indexOf('=');return i<0?[]:[line.slice(0,i),line.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}).filter(pair=>pair.length));
assert.ok(settings.RALLY_SITES_SERVICE_TOKEN,'Existing protected Site credential is required');
const headers={'OAI-Sites-Authorization':'Bearer '+settings.RALLY_SITES_SERVICE_TOKEN};
async function usage(){const response=await fetch(base+'/api/usage',{headers,redirect:'error'});assert.ok(response.ok);return(await response.json()).events.map(e=>e.id).sort();}
const before=await usage();
const report=await runNativeCapture({base,headers,checkOnly:true,reportFile:'test-results/hosted-tab-browser.json',target:'restricted deployed Site'});
assert.deepEqual(await usage(),before);report.usageUnchanged=true;
await writeFile(new URL('../docs/research/native-tab-hosted-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
