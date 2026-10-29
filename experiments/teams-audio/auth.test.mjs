import test from 'node:test';
import assert from 'node:assert/strict';
import { callingAuth, identityClient } from './auth.mjs';

const app = {
  AZURE_TENANT_ID:'00000000-0000-0000-0000-000000000001',
  AZURE_CLIENT_ID:'00000000-0000-0000-0000-000000000002',
  AZURE_CLIENT_SECRET:'local-fixture-only',
  AZURE_COMMUNICATION_ENDPOINT:'https://rally-fixture.communication.azure.com/',
};
test('incomplete or untrusted app setup cannot fall back to an old shared key',()=>{
  const legacy={AZURE_COMMUNICATION_CONNECTION_STRING:'endpoint=https://legacy.communication.azure.com/;accesskey=local-fixture'};
  assert.equal(callingAuth(legacy).mode,'connection-string');
  assert.equal(callingAuth({}).configured,false);
  const partial={...legacy,AZURE_CLIENT_ID:app.AZURE_CLIENT_ID};
  assert.equal(callingAuth(partial).configured,false);
  assert.throws(()=>identityClient(partial),/incomplete/);
  for(const endpoint of ['http://rally-fixture.communication.azure.com/','https://evil.example/','https://rally-fixture.communication.azure.com/other','https://user:pass@rally-fixture.communication.azure.com/']) {
    assert.equal(callingAuth({...app,AZURE_COMMUNICATION_ENDPOINT:endpoint}).configured,false);
  }
  assert.equal(callingAuth({...app,...legacy}).mode,'entra');
  assert.equal(callingAuth(app).configured,true);
});

test('actual Identity SDK uses bearer authentication for ACS VoIP identity creation and cleanup',async()=>{
  const requests=[],scopes=[];
  const credential={getToken:async scope=>{
    scopes.push(scope);return{token:'local-access-token',expiresOnTimestamp:Date.now()+60_000};
  }};
  const httpClient={sendRequest:async request=>{
    requests.push({url:request.url,method:request.method,authorization:request.headers.get('authorization'),body:request.body});
    const body=request.method==='POST'?JSON.stringify({identity:{id:'8:acs:local-fixture'},accessToken:{token:'local-voip-token',expiresOn:'2099-01-01T00:00:00Z'}}):'';
    return {request,status:request.method==='POST'?201:204,headers:{get:name=>name.toLowerCase()==='content-type'?'application/json':undefined,toJSON:()=>({'content-type':'application/json'})},bodyAsText:body};
  }};
  const client=identityClient(app,{credential,options:{httpClient}});
  const issued=await client.createUserAndToken(['voip']);
  assert.equal(issued.token,'local-voip-token');
  await client.deleteUser(issued.user);
  assert.deepEqual(requests.map(r=>r.method),['POST','DELETE']);
  assert.ok(requests.every(r=>r.url.startsWith(app.AZURE_COMMUNICATION_ENDPOINT)));
  assert.ok(requests.every(r=>r.authorization==='Bearer local-access-token'));
  assert.deepEqual(JSON.parse(requests[0].body).createTokenWithScopes,['voip']);
  assert.ok(scopes.flat().every(scope=>scope.startsWith('https://communication.azure.com/')));
  assert.ok(!JSON.stringify(requests).includes(app.AZURE_CLIENT_SECRET));
});
