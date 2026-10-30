import { z } from 'zod';
import { chromium } from 'playwright';
import type { Express,Request } from 'express';
import type { Store } from './store.ts';
import type { Meetings } from './meetings.ts';
import type { Meeting,Turn } from './contracts.ts';
import { userForRequest,HttpError } from './auth.ts';
import { audit } from './security.ts';

const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function sharedReport(m:Meeting,turns:Turn[]) {
 if(m.phase!=='ended'||m.reportStatus!=='ready'||!m.report||m.reportStale)throw new HttpError('The owner must finish and refresh this report before sharing.',409);
 const ids=new Set([...m.report.decisions,...m.report.actions,...m.report.scores,...m.report.speakerTips.flatMap(s=>s.tips)].flatMap(v=>v.evidence));
 const sources=turns.filter(t=>ids.has(t.id));
 return {id:m.id,title:m.title,createdAt:m.createdAt,endedAt:m.endedAt,report:m.report,reportNotes:m.reportNotes??[],speakerNames:m.speakerNames,
  sources:sources.slice(0,50).map(t=>({...t,text:t.text.slice(0,2000),excerptTruncated:t.text.length>2000})),sourcesOmitted:Math.max(0,sources.length-50)};
}
export type SharedReport=ReturnType<typeof sharedReport>;
export function reportHTML(view:SharedReport) {
 const report=view.report;
 const outcome=(title:string,items:typeof report.actions)=>`<h2>${title}</h2>${items.length?items.map(i=>`<section><h3>${escape(i.text)}</h3><p>${escape(i.status.replaceAll('_',' '))} · Owner: ${escape(i.owner??'Unassigned')} · Due: ${escape(i.dueDate??'Unspecified')}</p></section>`).join(''):'<p>None recorded.</p>'}`;
 return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(view.title)} · Rally report</title><style>@page{size:A4;margin:18mm}body{font:12px/1.55 Arial,sans-serif;color:#172127}h1{font-size:28px}h2{font-size:19px;margin-top:24px}h3{font-size:14px}section{break-inside:avoid}p,li{white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px;border-bottom:1px solid #ddd}.muted{color:#58636b}</style><body><p class="muted">RALLY · MEETING REPORT</p><h1>${escape(view.title)}</h1><p>${escape(new Date(view.endedAt??view.createdAt).toLocaleString('en-US',{timeZone:'UTC'}))} UTC</p><p>AI interpretations based on the transcript. Reported agreement is expressed in speech, not independently verified. Unknowns stay unknown.</p><h2>Summary</h2><p>${escape(report.summary)}</p><h2>Meeting quality</h2><p>Overall ${report.overall??'Unscored'}${report.overall===null?'':'/5'} · ${report.coverage}/5 categories assessed</p><table><tr><th>Category</th><th>Score</th><th>Evidence-based assessment</th></tr>${report.scores.map(s=>`<tr><td>${escape(s.category.replaceAll('_',' '))}</td><td>${s.score??'Unknown'}</td><td>${escape(s.reason)}</td></tr>`).join('')}</table>${outcome('Decisions',report.decisions)}${outcome('Due-outs',report.actions)}<h2>Unresolved</h2><ul>${report.unresolved.map(x=>`<li>${escape(x)}</li>`).join('')||'<li>None identified.</li>'}</ul><h2>Speaker notes</h2>${report.speakerTips.map(s=>`<section><h3>${escape(view.speakerNames[s.speakerId]??s.speakerId)}</h3>${s.tips.map(t=>`<p>${escape(t.text)}</p>`).join('')}</section>`).join('')||'<p>No attributable suggestions.</p>'}<h2>Host annotations</h2>${view.reportNotes.map(n=>`<p>${escape(n.text)}</p>`).join('')||'<p>None.</p>'}<h2>Cited transcript excerpts</h2>${view.sources.map(t=>`<section><h3>${escape(view.speakerNames[t.speaker??'']??'Unknown speaker')} · ${escape(t.id)}</h3><p>${escape(t.text)}${t.excerptTruncated?' [Excerpt shortened]':''}</p></section>`).join('')}${view.sourcesOmitted?'<p>Additional cited sources omitted from this bounded export.</p>':''}<p class="muted">Private authenticated report. Recipient access can be revoked; downloaded copies cannot be recalled. Powered by Meta Muse.</p></body></html>`;
}
let activePDF=0;
export async function reportPDF(view:SharedReport) {
 if(activePDF>=1)throw new HttpError('Another PDF is being prepared. Try again shortly.',429);
 activePDF++;
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 const timeout=setTimeout(()=>{void browser?.close();},25000);
 try {
  browser=await chromium.launch({headless:true,timeout:10000,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block'});
  await context.route('**/*',route=>route.abort());
  const html=reportHTML(view);if(Buffer.byteLength(html)>512000)throw new HttpError('Report is too large for PDF export; use the full record export instead.',413);
  const page=await context.newPage();await page.setContent(html,{waitUntil:'domcontentloaded',timeout:10000});
  const bytes=await page.pdf({format:'A4',printBackground:true});
  if(bytes.length>8*1024*1024)throw new HttpError('Report is too large to export as PDF.',413);
  return bytes;
 }finally{clearTimeout(timeout);try{await browser?.close();}finally{activePDF--;}}
}
export function installReportSharing(app:Express,store:Store,meetings:Meetings) {
 store.db.exec('CREATE TABLE IF NOT EXISTS report_shares(meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,recipient TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,PRIMARY KEY(meeting_id,recipient));');
 const owned=(req:Request)=>meetings.get(String(req.params.id),userForRequest(store,req).id);
 const granted=(req:Request,record=true)=>{
  const user=userForRequest(store,req),id=String(req.params.id);
  if(!store.db.prepare('SELECT s.meeting_id FROM report_shares s JOIN meetings m ON m.id=s.meeting_id JOIN user_security owner ON owner.user_id=m.user_id WHERE s.meeting_id=? AND s.recipient=? AND owner.disabled=0').get(id,user.id))throw new HttpError('Shared report not found',404);
  const m=meetings.get(id);if(record)audit(store,user.id,'report.viewed',id);return sharedReport(m,meetings.turns(id));
 };
 app.get('/api/meetings/:id/report-shares',(req,res)=>{const m=owned(req);res.json(store.db.prepare('SELECT u.id,u.username,s.created_at AS createdAt FROM report_shares s JOIN users u ON u.id=s.recipient WHERE meeting_id=? ORDER BY s.created_at').all(m.id));});
 app.post('/api/meetings/:id/report-shares',(req,res)=>{
  const m=owned(req);sharedReport(m,meetings.turns(m.id));
  const {username}=z.object({username:z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{3,40}$/)}).parse(req.body);
  const recipient=store.db.prepare('SELECT u.id,u.username FROM users u JOIN user_security s ON s.user_id=u.id WHERE u.username=? AND s.disabled=0').get(username) as {id:string;username:string}|undefined;
  if(!recipient||recipient.id===m.userId)throw new HttpError('Choose another enabled Rally account.',400);
  if(Number(store.db.prepare('SELECT count(*) AS n FROM report_shares WHERE meeting_id=?').get(m.id)!.n)>=100)throw new HttpError('Report recipient limit reached',409);
  store.db.prepare('INSERT OR IGNORE INTO report_shares VALUES(?,?,?)').run(m.id,recipient.id,Date.now());audit(store,m.userId,'report.shared',m.id,{recipient:recipient.id});res.status(201).json(recipient);
 });
 app.delete('/api/meetings/:id/report-shares/:recipient',(req,res)=>{const m=owned(req),recipient=z.string().uuid().parse(req.params.recipient);store.db.prepare('DELETE FROM report_shares WHERE meeting_id=? AND recipient=?').run(m.id,recipient);audit(store,m.userId,'report.unshared',m.id,{recipient});res.sendStatus(204);});
 app.get('/api/shared-reports',(req,res)=>{
  const user=userForRequest(store,req);
  const rows=store.db.prepare('SELECT m.id,m.body,u.username FROM report_shares s JOIN meetings m ON m.id=s.meeting_id JOIN users u ON u.id=m.user_id JOIN user_security owner ON owner.user_id=u.id WHERE s.recipient=? AND owner.disabled=0 ORDER BY s.created_at DESC LIMIT 100').all(user.id);
  res.json(rows.map(r=>{const m=JSON.parse(String(r.body));return {id:r.id,title:m.title,owner:r.username,createdAt:m.createdAt,available:m.phase==='ended'&&m.reportStatus==='ready'&&!m.reportStale};}));
 });
 app.get('/api/shared-reports/:id',(req,res)=>res.json(granted(req)));
 const limit=new Map<string,number[]>();
 async function pdf(req:Request,res:import('express').Response,shared:boolean) {
  const user=userForRequest(store,req),now=Date.now();for(const [id,times]of limit)if(times.every(t=>t<now-60000))limit.delete(id);
  const times=(limit.get(user.id)??[]).filter(t=>t>now-60000);if(times.length>=3)throw new HttpError('PDF export limit reached. Try again in a minute.',429);times.push(now);limit.set(user.id,times);
  const m=shared?null:owned(req),view=shared?granted(req,false):sharedReport(m!,meetings.turns(m!.id));
  const bytes=await reportPDF(view);
  // Check access again after browser rendering, in case sharing was withdrawn meanwhile.
  if(shared)granted(req,false);else owned(req);
  audit(store,user.id,'report.pdf_exported',view.id);res.setHeader('Content-Disposition',`attachment; filename="rally-report-${view.id}.pdf"`);res.type('application/pdf').send(bytes);
 }
 app.get('/api/meetings/:id/report.pdf',(req,res)=>pdf(req,res,false));
 app.get('/api/shared-reports/:id/pdf',(req,res)=>pdf(req,res,true));
}
