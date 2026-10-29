import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Store } from './store.ts';

export class HttpError extends Error { status:number; constructor(message:string,status=400){super(message);this.status=status;} }
export type User = {id:string;username:string};
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,(err,key)=>err?reject(err):resolve(key)));
export async function createUser(store:Store,username:string,password:string):Promise<User> {
  const salt=randomBytes(16).toString('hex');
  const hash=(await derive(password,salt)).toString('hex');
  const user={id:randomUUID(),username};
  try {store.db.prepare('INSERT INTO users VALUES(?,?,?)').run(user.id,user.username,`${salt}:${hash}`);}
  catch(error) {if(String(error).includes('UNIQUE'))throw new HttpError('Username already exists',409);throw error;}
  return user;
}
export async function authenticate(store:Store,username:string,password:string):Promise<User> {
  const row=store.db.prepare('SELECT * FROM users WHERE username=?').get(username) as (User&{password:string})|undefined;
  const [salt,hash]=row?.password.split(':') || ['missing-user','0'.repeat(128)];
  const computed=await derive(password,salt);
  if(!timingSafeEqual(computed,Buffer.from(hash,'hex'))||!row)throw new HttpError('Invalid username or password',401);
  return {id:row.id,username:row.username};
}
export function sessionToken(req:Request) {return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('rally_session='))?.slice(14);}
export function userForRequest(store:Store,req:Request):User {
  const token=sessionToken(req);
  const user=token?store.db.prepare('SELECT users.id,username FROM sessions JOIN users ON users.id=sessions.user_id WHERE hash=? AND expires>?').get(digest(token),Date.now()) as User|undefined:undefined;
  if(!user)throw new HttpError('Sign in required',401);
  return user;
}
export function issueSession(store:Store,res:Response,user:User,secure:boolean) {
  const token=randomBytes(32).toString('hex');
  store.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),user.id,Date.now()+7*86400000);
  res.cookie('rally_session',token,{httpOnly:true,sameSite:'lax',secure,path:'/api',maxAge:7*86400000});
}
export function revokeSession(store:Store,req:Request,res:Response,secure:boolean) {
  const token=sessionToken(req);if(token)store.db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token));
  res.clearCookie('rally_session',{httpOnly:true,sameSite:'lax',secure,path:'/api'});
}
