import {AppError,confirmOutcome,createMeeting,markdown,scorecard} from './core.js';
import {confirmedFollowup} from './followup.js';
import {repo} from './store.js';
import {attachSession} from './live.js';
import {modelConfig,publicModels} from './models.js';
import {speechApi} from './speech.js';
import {teamsApi} from './teams.js';
import {editTeamsRecord,reviewTeamsRecord} from './teams-review.js';
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':'no-store'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...security,'Content-Type':'application/json; charset=utf-8'}});
async function input(request,limit=20000){const raw=await request.text();if(raw.length>limit)throw new AppError('Request too large.',413);try{return JSON.parse(raw);}catch{throw new AppError('Invalid JSON.');}}
function sameOrigin(request){const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)throw new AppError('Cross-origin requests are not accepted.',403);if(request.headers.get('Sec-Fetch-Site')==='cross-site')throw new AppError('Cross-site requests are not accepted.',403);}
export default {async fetch(request,env,ctx){
  try{
    const url=new URL(request.url),path=url.pathname;
    if(path==='/'&&request.method==='GET')return new Response(__HTML__,{headers:{...security,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'",'Permissions-Policy':'microphone=(self), display-capture=(self)'}});
    if(path==='/style.css')return new Response(__CSS__,{headers:{...security,'Content-Type':'text/css; charset=utf-8'}});
    if(path==='/client.js')return new Response(__CLIENT__,{headers:{...security,'Content-Type':'text/javascript; charset=utf-8'}});
    if(path==='/audio-input.js')return new Response(__AUDIO_INPUT__,{headers:{...security,'Content-Type':'text/javascript; charset=utf-8'}});
    if(path==='/mms-speech.js')return new Response(__MMS_CLIENT__,{headers:{...security,'Content-Type':'text/javascript; charset=utf-8'}});
    if(path==='/teams-client.js')return new Response(__TEAMS_CLIENT__,{headers:{...security,'Content-Type':'text/javascript; charset=utf-8'}});
    if(path==='/pcm-worklet.js')return new Response(__WORKLET__,{headers:{...security,'Content-Type':'text/javascript; charset=utf-8'}});
    if(path==='/favicon.svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#efb543"/><path d="M12 25V15m6 14V11m6 14V15m6 7v-4" stroke="#172f38" stroke-width="3" stroke-linecap="round"/></svg>',{headers:{'Content-Type':'image/svg+xml'}});
    if(!path.startsWith('/api/'))return json({error:'Not found'},404);
    sameOrigin(request);
    // Hosted access is enforced by Sites' owner-private boundary. Local preview
    // binds loopback only. Do not deploy this shared workspace as an anonymous site.
    if(!env.DB)throw new AppError('Workspace storage is unavailable.',503);
    if(path.startsWith('/api/speech/')){const result=await speechApi(request,env,request.method==='POST'?await input(request,path==='/api/speech/runner/finish'?1400000:20000):{});return result instanceof Response?result:json(result);}
    if(path.startsWith('/api/teams/'))return json(await teamsApi(request,env,request.method==='POST'?await input(request):{}));
    const r=repo(env.DB);
    if(path==='/api/config'&&request.method==='GET'){const models=modelConfig(env);return json({models:publicModels(models),liveAvailable:!!env.MODEL_API_KEY&&env.RALLY_PAID_ENABLED==='1',mmsAvailable:env.RALLY_MMS_ENABLED==='1',deviceVoiceAvailable:env.RALLY_DEVICE_VOICE_ENABLED==='1',baselineSpend:Number(env.RALLY_BASELINE_SPEND||.0517416),meetingBudget:Number(env.RALLY_MEETING_BUDGET||.25),buildBudget:Number(env.RALLY_BUILD_BUDGET||.5),model:models.reasoning.model,asr:models.transcription.model,maxMinutes:55});}
    if(path==='/api/costs'&&request.method==='GET'){const c=await r.costs();return json({...c,baseline:Number(env.RALLY_BASELINE_SPEND||.0517416),conditionalRemainder:150-Number(env.RALLY_BASELINE_SPEND||.0517416)-Number(c.total||0)});}
    if(path==='/api/usage'&&request.method==='GET')return json({events:await r.usageList()});
    if(path==='/api/meetings'&&request.method==='GET')return json({meetings:await r.list()});
    if(path==='/api/meetings'&&request.method==='POST'){
      const data=await input(request);
      if(data.kind==='walkthrough'){data.participants=['Alex','Priya','Sam'];data.agenda=['Decide Friday release scope','Confirm rollback owner and deadline'];data.title=data.title||'Friday release · walkthrough';}
      return json({meeting:await r.create(createMeeting(data))},201);
    }
    const match=path.match(/^\/api\/meetings\/([a-zA-Z0-9-]+)(?:\/(export|connect|confirm|record|review|followup))?$/);
    if(!match)return json({error:'Not found'},404);
    const [,id,action]=match,m=await r.get(id);if(!m)throw new AppError('Meeting not found.',404);
    if(action==='followup'&&request.method==='POST')return json(confirmedFollowup(m));
    if(action==='record'&&request.method==='POST')return json(await editTeamsRecord(r,id,await input(request)));
    if(action==='review'&&request.method==='POST')return json(await reviewTeamsRecord(env,r,id,await input(request)));
    if(action==='connect'){
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')throw new AppError('WebSocket required.',426);
      if(!['draft'].includes(m.phase))throw new AppError('This meeting is already started or ended. Its saved record is still available.',409);
      const leaseId=crypto.randomUUID();if(!(await r.lease(id,leaseId)))throw new AppError('This meeting is open in another window.',409);
      const pair=new WebSocketPair(),[client,server]=Object.values(pair);server.binaryType='arraybuffer';server.accept();
      attachSession(server,m,r,env,ctx,leaseId);return new Response(null,{status:101,webSocket:client});
    }
    if(action==='export'&&request.method==='GET')return new Response(markdown(m),{headers:{...security,'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="rally-${m.id}.md"`}});
    if(!action&&request.method==='GET')return json({meeting:m,scorecard:scorecard(m)});
    if(!action&&request.method==='DELETE'){await r.remove(id);return json({deleted:true});}
    if(action==='confirm'&&request.method==='POST'){
      if(['live','wrapping'].includes(m.phase))throw new AppError('Use the active meeting connection for confirmation.',409);
      const data=await input(request);if(m.kind==='teams')return json(await editTeamsRecord(r,id,{...data,action:'confirm'}));confirmOutcome(m,data.id,{owner:data.owner,dueDate:data.dueDate,actor:'Meeting host',note:'Explicit host confirmation on saved record'});await r.save(m);return json({meeting:m,scorecard:scorecard(m)});
    }
    return json({error:'Method not allowed'},405);
  }catch(e){return json({error:e instanceof AppError?e.message:'The workspace could not complete that operation. Please retry.',code:e instanceof AppError?e.status:500},e instanceof AppError?e.status:500);}
}};
