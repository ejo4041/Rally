import { Miniflare } from 'miniflare';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const settings={};
try {
  const text=await readFile(resolve('../../.env.local'),'utf8');
  for(const line of text.split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)settings[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
} catch {}
await mkdir('.data',{recursive:true});
let baseline=.0746161;
try{const rows=(await readFile(resolve('../../docs/research/muse-call-log.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);baseline=rows.reduce((sum,r)=>sum+(r.estimated_cost_usd||0),0);}catch{}
const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-07-01',host:'127.0.0.1',port:Number(process.env.PORT||8787),d1Databases:{DB:'rally-local'},d1Persist:'.data',bindings:{MODEL_API_KEY:process.env.MODEL_API_KEY||settings.MODEL_API_KEY||'',RALLY_LOCAL:'1',RALLY_TEAMS_BRIDGE_SECRET:process.env.RALLY_TEAMS_BRIDGE_SECRET||settings.RALLY_TEAMS_BRIDGE_SECRET||'',RALLY_PAID_ENABLED:process.env.RALLY_PAID_ENABLED||'0',RALLY_MEETING_BUDGET:'0.25',RALLY_BUILD_BUDGET:'0.50',RALLY_BASELINE_SPEND:process.env.RALLY_BASELINE_SPEND||String(baseline)}});
const db=await mf.getD1Database('DB');
const exists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meetings'").first();
if(!exists){const sql=await readFile('drizzle/0000_rally.sql','utf8');for(const stmt of sql.split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(stmt).run();}
if(!(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='teams_jobs'").first())){const sql=await readFile('drizzle/0001_teams.sql','utf8');for(const stmt of sql.split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(stmt).run();}
if(!(await db.prepare('PRAGMA table_info(teams_jobs)').all()).results.some(c=>c.name==='transcribe')){for(const stmt of (await readFile('drizzle/0002_teams_transcription.sql','utf8')).split(';').map(s=>s.replaceAll('--> statement-breakpoint','').trim()).filter(Boolean))await db.prepare(stmt).run();}
console.log('Rally local preview:',(await mf.ready).href);
console.log('Paid Muse calls:',process.env.RALLY_PAID_ENABLED==='1'?'enabled (capped)':'disabled; use the labeled walkthrough');
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await mf.dispose();process.exit(0)});
