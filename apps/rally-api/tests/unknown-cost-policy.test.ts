import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.ts';
import {defaults} from '../src/config.ts';
import {UsageLedger} from '../src/muse.ts';

test('opt-in permits new work while unknown charges remain reserved against both caps',()=>{
 const store=new Store(':memory:');
 try{
  store.db.prepare('INSERT INTO usage VALUES(?,?,?,?,?,?,?)').run('failed','old','host',.25,'unknown',null,JSON.stringify({status:'unknown',cost:null}));
  const before=store.db.prepare('SELECT * FROM usage WHERE id=?').get('failed');
  assert.throws(()=>new UsageLedger(store,defaults).check('new',.01),/Unknown provider costs/);
  const ledger=new UsageLedger(store,{...defaults,allowUnknownCostEstimates:true,buildBudget:1,meetingBudget:.5});
  ledger.check('new',.1);ledger.check('old',.25);
  assert.throws(()=>ledger.check('old',.251),/budget exceeded/);
  assert.throws(()=>ledger.check('new',.751),/budget exceeded/);
  assert.deepEqual(store.db.prepare('SELECT * FROM usage WHERE id=?').get('failed'),before);
  const request=ledger.reserve({id:'new',userId:'host'} as Parameters<UsageLedger['reserve']>[0],.4,{kind:'fixture'});
  ledger.update(request,'new',.45);
  assert.throws(()=>ledger.update(request,'new',.501),/budget exceeded/);
  ledger.finish(request,.01,{fixture:true});ledger.check('new',.4);
  assert.deepEqual(store.db.prepare('SELECT * FROM usage WHERE id=?').get('failed'),before);
 }finally{store.close();}
});
