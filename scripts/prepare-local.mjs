import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
function run(args){const child=spawnSync(process.execPath,args,{stdio:['ignore','inherit','inherit'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});if(child.status!==0)process.exit(child.status||1);}
if(!existsSync('node_modules/wrangler/bin/wrangler.js')){console.error('Dependencies are missing. Run npm install.');process.exit(1);}
if(!existsSync('.dev.vars')){console.error('Local administrator settings are missing. Run npm run setup:local once.');process.exit(1);}
console.log('Checking local database migrations before starting Helpdesk...');
run(['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local']);
