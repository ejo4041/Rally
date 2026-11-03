type Agenda={plan?:{topics:{title:string;status?:string}[]}|null;agenda?:string};
const clean=(text:string)=>text.replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().replace(/[.;:!?]+$/,'');
export function meetingGreeting(m:Agenda){
 const intro="Hi team, Rally here. Let's get this meeting started. Here is the agenda: ";
 const topics=m.plan?.topics.filter(t=>t.status!=='parked').map(t=>clean(t.title)).filter(Boolean)??[];
 if(!topics.length&&m.agenda)topics.push(clean(m.agenda));
 if(!topics.length)return "Hi team, Rally here. Let's get this meeting started. Your meeting plan is on screen.";
 const chosen:string[]=[];let omitted=false;
 for(const topic of topics){if((intro+chosen.concat(topic).join('; ')).length>250){omitted=true;break;}chosen.push(topic);}
 if(!chosen.length){const first=topics[0].slice(0,Math.max(20,245-intro.length));chosen.push(first.replace(/\s+\S*$/,'')||first);omitted=true;}
 return intro+chosen.join('; ')+(omitted?'. The full agenda is on screen.':'.');
}
export const sampleGreeting=meetingGreeting({plan:{topics:[{title:'Readiness and performance'},{title:'Blockers and release gates'},{title:'Owners and next steps'}]}});
