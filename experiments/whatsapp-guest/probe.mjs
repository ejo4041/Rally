// Link is read from stdin; it never appears in argv, logs or persisted reports.
import {createInterface} from 'node:readline/promises';
import {writeFile,mkdir} from 'node:fs/promises';
import {createGuest,callLink} from './guest.mjs';
const rl=createInterface({input:process.stdin,output:process.stdout,terminal:false});
console.log('Ready for one JSON line: {"url":"WhatsApp call link","consented":true}');
const line=await new Promise(resolve=>rl.once('line',resolve));rl.close();
let input;try{input=JSON.parse(line);}catch{throw Error('Expected JSON input.');}
if(input.consented!==true)throw Error('Host/participant consent is required.');
const url=callLink(input.url),guest=await createGuest();
const report={startedAt:new Date().toISOString(),stage:'opening',joined:false,paidModelCalls:0,rawAudioSaved:false};
try{
 await guest.page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 const current=new URL(guest.page.url());
 if(!['call.whatsapp.com','web.whatsapp.com','www.whatsapp.com'].includes(current.hostname)||current.protocol!=='https:')throw Error('Unexpected navigation destination.');
 // Observe first: production selectors require a real guest page. Do not guess
 // a Join button, accept account sign-in, or bypass a challenge automatically.
 report.stage='page-opened-awaiting-ui-inspection';
 const fields=await guest.page.locator('input').evaluateAll(nodes=>nodes.map(n=>({type:n.type,placeholder:n.placeholder,ariaLabel:n.getAttribute('aria-label')})));
 const buttons=await guest.page.getByRole('button').allTextContents();
 console.log(JSON.stringify({stage:report.stage,fields,buttons:buttons.map(v=>v.trim()).filter(Boolean).slice(0,20),deadlineSeconds:180}));
 console.log('Guest page opened without pressing Join. Prototype waits up to 180 seconds and then closes.');
 while(!guest.closed())await new Promise(r=>setTimeout(r,1000));
 report.stage='closed-at-deadline';
} catch{report.stage='failed-or-closed';console.error('Guest probe could not continue. No automatic retry.');process.exitCode=1;}
finally{await guest.close();report.endedAt=new Date().toISOString();await mkdir(new URL('./test-results/',import.meta.url),{recursive:true});await writeFile(new URL('./test-results/guest-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');}
