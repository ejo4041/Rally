import {AppError} from './core.js';
export function repo(db){
  const decode=r=>r?{...JSON.parse(r.payload),version:r.version}:null;
  return {
    async list(){const r=await db.prepare('SELECT id,title,created_at,updated_at,phase,payload FROM meetings ORDER BY updated_at DESC LIMIT 60').all();return r.results.map(r=>({id:r.id,title:r.title,createdAt:r.created_at,updatedAt:r.updated_at,phase:r.phase,kind:JSON.parse(r.payload).kind}));},
    async get(id){return decode(await db.prepare('SELECT * FROM meetings WHERE id=?').bind(id).first());},
    async create(m){await db.prepare('INSERT INTO meetings (id,title,created_at,updated_at,phase,payload,version) VALUES (?,?,?,?,?,?,0)').bind(m.id,m.title,m.createdAt,m.updatedAt,m.phase,JSON.stringify(m)).run();return {...m,version:0};},
    async save(m){const updatedAt=new Date().toISOString();const r=await db.prepare('UPDATE meetings SET title=?,updated_at=?,phase=?,payload=?,version=version+1 WHERE id=? AND version=?').bind(m.title,updatedAt,m.phase,JSON.stringify({...m,updatedAt}),m.id,m.version).run();if(r.meta.changes!==1)throw new AppError('Meeting changed in another session. Refresh to continue.',409);m.version++;m.updatedAt=updatedAt;return m;},
    async lease(id,leaseId){const now=Date.now();const r=await db.prepare('UPDATE meetings SET lease_id=?,lease_until=? WHERE id=? AND (lease_until<? OR lease_id=?) AND NOT EXISTS (SELECT 1 FROM meetings WHERE id<>? AND lease_until>?)').bind(leaseId,now+45000,id,now,leaseId,id,now).run();return r.meta.changes===1;},
    async renew(id,leaseId){const r=await db.prepare('UPDATE meetings SET lease_until=? WHERE id=? AND lease_id=?').bind(Date.now()+45000,id,leaseId).run();return r.meta.changes===1;},
    async release(id,leaseId){await db.prepare('UPDATE meetings SET lease_id=NULL,lease_until=0 WHERE id=? AND lease_id=?').bind(id,leaseId).run();},
    async remove(id){
      const row=await db.prepare('SELECT lease_until,payload FROM meetings WHERE id=?').bind(id).first();
      if(!row)return;
      const now=Date.now(),m=JSON.parse(row.payload);
      if(row.lease_until>now)throw new AppError('End the active meeting or review before deleting it.',409);
      if(m.kind==='teams'){
        const job=await db.prepare('SELECT slot FROM teams_jobs WHERE id=?').bind(id).first();
        if(job?.slot)throw new AppError('Wait for Rally to leave Teams before deleting this record.',409);
      }
      const statements=[];
      if(m.accountingWarning){
        const e={id:crypto.randomUUID(),meetingId:id,createdAt:new Date(now).toISOString(),model:'muse-voice-transcribe-1.0',status:'accounting_unreconciled',estimatedCost:null,costBasis:'unknown_after_storage_failure'};
        statements.push(db.prepare(`INSERT INTO usage_events(id,meeting_id,created_at,model,status,estimated_cost,payload)
          SELECT ?,?,?,?,?,NULL,? WHERE EXISTS(SELECT 1 FROM meetings WHERE id=? AND lease_until<=?)
          AND NOT EXISTS(SELECT 1 FROM usage_events WHERE meeting_id=? AND estimated_cost IS NULL)`)
          .bind(e.id,id,e.createdAt,e.model,e.status,JSON.stringify(e),id,now,id));
      }
      if(m.kind==='teams')statements.push(db.prepare(`UPDATE teams_jobs SET transcript='[]',partial='' WHERE id=?
        AND EXISTS(SELECT 1 FROM meetings WHERE id=? AND lease_until<=?)`).bind(id,id,now));
      // Recheck the lease inside the atomic batch: a review may have acquired
      // it since the preflight read. Usage rows deliberately survive deletion.
      statements.push(db.prepare('DELETE FROM meetings WHERE id=? AND lease_until<=?').bind(id,now));
      const results=await db.batch(statements);
      if(results.at(-1).meta.changes!==1)throw new AppError('This record became busy. Refresh before deleting it.',409);
    },
    async usage(event){await db.prepare('INSERT INTO usage_events (id,meeting_id,created_at,model,status,estimated_cost,payload) VALUES (?,?,?,?,?,?,?)').bind(event.id,event.meetingId||null,event.createdAt,event.model,event.status,event.estimatedCost??null,JSON.stringify(event)).run();},
    async reserveReasoning(event,{projected,buildBudget,meetingBudget}){
      if(![projected,buildBudget,meetingBudget].every(Number.isFinite)||projected<0)throw new AppError('Invalid reasoning budget.',409);
      const row=await db.prepare(`INSERT INTO usage_events(id,meeting_id,created_at,model,status,estimated_cost,payload)
        SELECT ?,?,?,?,'reasoning_reserved',NULL,? WHERE NOT EXISTS(SELECT 1 FROM usage_events WHERE estimated_cost IS NULL)
        AND NOT EXISTS(SELECT 1 FROM meetings WHERE json_extract(payload,'$.accountingWarning')=1)
        AND (SELECT COALESCE(SUM(estimated_cost),0) FROM usage_events)+?<=?
        AND (SELECT COALESCE(SUM(estimated_cost),0) FROM usage_events WHERE meeting_id=?)+?<=? RETURNING id`)
        .bind(event.id,event.meetingId,event.createdAt,event.model,JSON.stringify({...event,status:'reasoning_reserved'}),projected,buildBudget,event.meetingId,projected,meetingBudget).first();
      if(!row)throw new AppError('Review stopped before sending: budget is exhausted or a charge needs reconciliation.',409);
    },
    async finishReasoning(event){
      const result=await db.prepare('UPDATE usage_events SET status=?,estimated_cost=?,payload=? WHERE id=? AND estimated_cost IS NULL')
        .bind(event.status,event.estimatedCost??null,JSON.stringify(event),event.id).run();
      if(result.meta.changes!==1)throw new AppError('Reasoning reservation could not be reconciled.',503);
    },
    async costs(meetingId){const q=meetingId?'SELECT COALESCE(SUM(estimated_cost),0) total,SUM(CASE WHEN estimated_cost IS NULL THEN 1 ELSE 0 END) unknown FROM usage_events WHERE meeting_id=?':'SELECT COALESCE(SUM(estimated_cost),0) total,SUM(CASE WHEN estimated_cost IS NULL THEN 1 ELSE 0 END) unknown FROM usage_events';const stmt=db.prepare(q),cost=(await(meetingId?stmt.bind(meetingId):stmt).first())||{total:0,unknown:0};const warning=db.prepare(`SELECT COUNT(*) n FROM meetings m WHERE json_extract(m.payload,'$.accountingWarning')=1 AND NOT EXISTS (SELECT 1 FROM usage_events u WHERE u.meeting_id=m.id AND u.estimated_cost IS NULL)${meetingId?' AND m.id=?':''}`);const unrecorded=await(meetingId?warning.bind(meetingId):warning).first();cost.unknown=Number(cost.unknown||0)+Number(unrecorded?.n||0);return cost;},
    async usageList(){const r=await db.prepare('SELECT payload FROM usage_events ORDER BY created_at ASC LIMIT 2000').all();return r.results.map(r=>JSON.parse(r.payload));}
  };
}
