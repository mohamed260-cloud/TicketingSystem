import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

if(!stdin.isTTY){console.error('Run npm run setup:local in an interactive terminal.');process.exit(1);}
if(!existsSync('node_modules/wrangler/bin/wrangler.js')){console.error('Run npm install first.');process.exit(1);}
const rl=createInterface({input:stdin,output:stdout});
const username=(await rl.question('Admin username [Mohamed ashraf]: ')).trim()||'Mohamed ashraf';rl.close();
if(username.length>100||/[\r\n]/.test(username))throw Error('Invalid username.');
function hiddenPassword(){return new Promise((resolve,reject)=>{
 stdout.write('Admin password (hidden): ');let value='';stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');
 function done(){stdin.off('data',read);stdin.setRawMode(false);stdin.pause();stdout.write('\n');}
 function read(chunk){for(const char of chunk){if(char==='\u0003'){done();reject(Error('Setup cancelled.'));return;}if(char==='\r'||char==='\n'){done();resolve(value);return;}if(char==='\u007f'||char==='\b'){value=value.slice(0,-1);}else if(char>=' '){value+=char;}}}
 stdin.on('data',read);
 });}
const password=await hiddenPassword();if(password.length<8||password.length>256)throw Error('Use a password between 8 and 256 characters.');
const salt=randomBytes(24).toString('hex');const hash=salt+':'+pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');
const migration=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local'],{stdio:['ignore','inherit','inherit'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
if(migration.status!==0)process.exit(migration.status||1);
writeFileSync('.dev.vars','ADMIN_USERNAME='+JSON.stringify(username)+'\nADMIN_PASSWORD_HASH='+JSON.stringify(hash)+'\n',{mode:0o600});
console.log('Local database and admin credentials are ready. Run npm run dev, then open http://127.0.0.1:8787/admin');
