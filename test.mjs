import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{passwordHash} from './worker/index.js';
const password='Example-password-for-tests';
const stored='test-salt:'+await passwordHash(password,'test-salt');
function fixture(){
 const db=new DatabaseSync(':memory:');
 for(const f of ['0000_helpdesk.sql','0001_admin_access.sql'])db.exec(readFileSync('drizzle/'+f,'utf8'));
 const DB={prepare(sql){let values=[];return {bind(...v){values=v;return this},async first(){return db.prepare(sql).get(...values)},async all(){return {results:db.prepare(sql).all(...values)}},async run(){return db.prepare(sql).run(...values)}}},async batch(s){db.exec('BEGIN');try{const r=await Promise.all(s.map(x=>x.run()));db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
 const env={DB,ADMIN_USERNAME:'Test administrator',ADMIN_PASSWORD_HASH:stored};
 async function call(path,{user='employee',method='GET',body,cookie,origin='https://helpdesk.test'}={}){
 const r=await worker.fetch(new Request('https://helpdesk.test'+path,{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),...(cookie?{cookie}:{}),origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
 return {status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():await r.text(),cookie:r.headers.get('set-cookie')};
 }
 async function login(user='administrator'){const r=await call('/api/admin/login',{user,method:'POST',body:{username:'Test administrator',password}});assert.equal(r.status,200);return r.cookie.split(';')[0]}
 return {db,env,call,login};
}
test('employee and admin pages exist with distinct portals and dark styling',async()=>{
 const {call}=fixture();const employee=await call('/employee'),admin=await call('/admin');
 assert.equal(employee.status,200);assert.match(employee.data,/data-portal="employee"/);assert.match(admin.data,/data-portal="admin"/);assert.match(admin.data,/Administrator sign in/);assert.match(admin.data,/#0d1729/);
 for(const page of [employee.data,admin.data])new Function(page.match(/<script>([\s\S]*)<\/script>/)[1]);
 assert.equal((await call('/missing')).status,404);
});
test('no visitor becomes admin automatically and employee isolation holds',async()=>{
 const {call}=fixture();assert.equal((await call('/api/tickets',{user:null})).status,200);
 assert.equal((await call('/api/session')).data.admin,false);
 assert.equal((await call('/api/admin/tickets')).status,401);
 assert.equal((await call('/api/tickets',{method:'POST',body:{name:' ',issue:'x'}})).status,400);
 const created=await call('/api/tickets',{method:'POST',body:{name:'Alex',issue:'Wi-Fi does not connect'}});assert.equal(created.status,201);const id=created.data.id;
 assert.equal((await call('/api/tickets/'+id,{user:'someone-else'})).status,404);
 assert.equal((await call('/api/tickets',{user:'someone-else'})).data.length,0);
 assert.equal((await call('/api/tickets/'+id,{method:'PATCH',body:{status:'Resolved',priority:'Normal'}})).status,403);
});
test('password sign-in, admin workflow, session identity binding, and logout',async()=>{
 const {call,login}=fixture();
 const id=(await call('/api/tickets',{method:'POST',body:{name:'Alex',issue:'Laptop issue'}})).data.id;
 assert.equal((await call('/api/admin/login',{user:'administrator',method:'POST',body:{username:'Test administrator',password:'incorrect'}})).status,401);
 const cookie=await login();assert.equal((await call('/api/session',{user:'administrator',cookie})).data.admin,true);
 assert.equal((await call('/api/admin/tickets',{user:'other-user',cookie})).status,401);
 assert.equal((await call('/api/tickets',{user:'administrator',cookie})).data.length,0);
 assert.equal((await call('/api/admin/tickets',{user:'administrator',cookie})).data.length,1);
 assert.equal((await call('/api/admin/tickets/'+id,{user:'administrator',cookie,method:'PATCH',body:{status:'In progress',priority:'High',assignee:'Sam'}})).status,200);
 assert.equal((await call('/api/admin/tickets/'+id+'/messages',{user:'administrator',cookie,method:'POST',body:{body:'We are looking into it.'}})).status,200);
 assert.equal((await call('/api/tickets/'+id+'/messages',{method:'POST',body:{body:'Thank you.'}})).status,200);
 const detail=(await call('/api/tickets/'+id)).data;assert.equal(detail.ticket.status,'In progress');assert.equal(detail.messages.length,2);
 const logout=await call('/api/admin/logout',{user:'administrator',cookie,method:'POST',body:{}});assert.equal(logout.status,200);assert.match(logout.cookie,/Max-Age=0/);
 assert.equal((await call('/api/admin/tickets',{user:'administrator',cookie})).status,401);
});
test('admin cookies use secure flags; expired and forged sessions are rejected',async()=>{
 const {call,db}=fixture();const r=await call('/api/admin/login',{method:'POST',body:{username:'Test administrator',password}});
 assert.match(r.cookie,/HttpOnly/);assert.match(r.cookie,/Secure/);assert.match(r.cookie,/SameSite=Strict/);
 const cookie=r.cookie.split(';')[0];db.exec('UPDATE admin_sessions SET expires=0');
 assert.equal((await call('/api/admin/tickets',{cookie})).status,401);
 assert.equal((await call('/api/admin/tickets',{cookie:'__Host-helpdesk-admin='+'a'.repeat(64)})).status,401);
});
test('five failed attempts trigger a database-backed cooldown',async()=>{
 const {call,db}=fixture();for(let i=0;i<5;i++)assert.equal((await call('/api/admin/login',{method:'POST',body:{username:'Test administrator',password:'wrong'}})).status,401);
 assert.equal((await call('/api/admin/login',{method:'POST',body:{username:'Test administrator',password}})).status,429);
 db.exec('UPDATE login_attempts SET window_start=0');
 assert.equal((await call('/api/admin/login',{method:'POST',body:{username:'Test administrator',password}})).status,200);
});
test('cross-origin writes fail and credential rotation invalidates sessions',async()=>{
 const {call,login,env}=fixture();assert.equal((await call('/api/tickets',{method:'POST',origin:'https://other.test',body:{name:'Alex',issue:'x'}})).status,403);
 const cookie=await login();env.ADMIN_PASSWORD_HASH='new-salt:changed';assert.equal((await call('/api/admin/tickets',{user:'administrator',cookie})).status,401);
});

test('password login works without platform headers and retains the admin session',async()=>{
 const {call}=fixture();
 const initial=await call('/api/session',{user:null});assert.equal(initial.status,200);assert.equal(initial.data.admin,false);
 const browser=initial.cookie.split(';')[0];assert.match(browser,/__Host-helpdesk-browser=/);
 const login=await call('/api/admin/login',{user:null,cookie:browser,method:'POST',body:{username:'Test administrator',password}});assert.equal(login.status,200);
 const cookies=browser+'; '+login.cookie.split(';')[0];
 assert.equal((await call('/api/session',{user:null,cookie:cookies})).data.admin,true);
 assert.equal((await call('/api/admin/tickets',{user:null,cookie:cookies})).status,200);
 assert.equal((await call('/api/admin/tickets',{user:null,cookie:browser})).status,401);
 const ticket=await call('/api/tickets',{user:null,cookie:browser,method:'POST',body:{name:'Alex',issue:'Browser-only issue'}});assert.equal(ticket.status,201);
 assert.equal((await call('/api/tickets',{user:null,cookie:browser})).data.length,1);
 assert.equal((await call('/api/tickets',{user:null})).data.length,0);
 const logout=await call('/api/admin/logout',{user:null,cookie:cookies,method:'POST',body:{}});assert.equal(logout.status,200);
 assert.equal((await call('/api/admin/tickets',{user:null,cookie:cookies})).status,401);
});
test('clearing browser cookies cannot reset the unauthenticated login cooldown',async()=>{
 const {call}=fixture();for(let i=0;i<5;i++)assert.equal((await call('/api/admin/login',{user:null,method:'POST',body:{username:'Test administrator',password:'wrong'}})).status,401);
 assert.equal((await call('/api/admin/login',{user:null,method:'POST',body:{username:'Test administrator',password}})).status,429);
});
