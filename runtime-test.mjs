import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {passwordHash} from './worker/index.js';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"helpdesk",modules:true,scriptPath:'worker/index.js',compatibilityDate:'2026-11-06',d1Databases:{DB:'test-db'},bindings:{ADMIN_USERNAME:'Mohamed ashraf',ADMIN_PASSWORD_HASH:'test:'+await passwordHash('Test-password-123','test')}}]}));
try{
const {DB}=await mf.getBindings();
for(const file of ['0000_helpdesk.sql','0001_admin_access.sql'])for(const sql of readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint','').split(';').map(x=>x.trim()).filter(Boolean))await DB.prepare(sql).run();
const response=await mf.dispatchFetch('http://127.0.0.1:8787/api/admin/login',{method:'POST',headers:{origin:'http://127.0.0.1:8787','content-type':'application/json'},body:JSON.stringify({username:'mohamed ashraf',password:'Test-password-123'})});assert.equal(response.status,200,await response.clone().text());const authCookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');const inbox=await mf.dispatchFetch('http://127.0.0.1:8787/api/admin/tickets',{headers:{cookie:authCookie}});assert.equal(inbox.status,200,await inbox.clone().text());console.log('Wrangler engine: password login and authenticated inbox passed.');
}finally{await mf.dispose();}
