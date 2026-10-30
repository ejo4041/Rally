import {HttpError} from './auth.ts';
// Bound password hashing independently of caller-controlled proxy headers.
export class AuthLimit {
 private entries=new Map<string,{count:number;until:number}>();private active=0;
 enter(kind:'login'|'signup',username:string){
  const now=Date.now();for(const [key,value]of this.entries)if(value.until<=now)this.entries.delete(key);
  if(this.active>=2)throw new HttpError('Sign-in service busy. Try again shortly.',429);
  const keys=kind==='signup'?[['signup',30,3600000] as const]:[['login',200,600000] as const,[`user:${username}`,20,600000] as const];
  for(const [key,max]of keys)if((this.entries.get(key)?.count??0)>=max)throw new HttpError('Too many sign-in attempts. Try again later.',429);
  for(const [key,,window]of keys){const value=this.entries.get(key)??{count:0,until:now+window};value.count++;this.entries.set(key,value);}
  this.active++;let released=false;
  return ()=>{if(!released){released=true;this.active--;}};
 }
}
