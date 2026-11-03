// One-time local configuration only: never calls providers or creates passwords.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const destination = new URL('.env.local', root);
const template = readFileSync(new URL('.env.example', root), 'utf8');
try {
  writeFileSync(destination, template.replace('GENERATE_WITH_INIT_LOCAL', randomBytes(32).toString('hex')), {flag:'wx',mode:0o600});
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('.env.local already exists; preserved it. Follow docs/judge-quickstart.md.');
    process.exit(1);
  }
  throw error;
}
mkdirSync(new URL('apps/rally-api/.data/', root), {recursive:true,mode:0o700});
console.log(`Created private configuration at ${fileURLToPath(destination)}. Paid processing is off. Follow docs/judge-quickstart.md to invite your administrator.`);
