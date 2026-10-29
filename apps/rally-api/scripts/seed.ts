import {loadEnvironment,environmentConfig} from '../src/config.ts';
import {Store} from '../src/store.ts';
import {createUser} from '../src/auth.ts';
loadEnvironment();const password=process.env.RALLY_DEMO_PASSWORD;
if(!password||password.length<10)throw new Error('Set RALLY_DEMO_PASSWORD (at least ten characters) in shared local secrets.');
const store=new Store(environmentConfig().dbPath);
try{for(const username of ['demo','demo2']){if(store.db.prepare('SELECT id FROM users WHERE username=?').get(username))continue;await createUser(store,username,password);console.log(`Created ${username}`);}}finally{store.close();}
