import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './worker/index.js';
const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_helpdesk.sql','utf8'));
const DB={prepare(sql){let values=[];return {bind(...v){values=v;return this},async first(){return db.prepare(sql).get(...values)},async all(){return {results:db.prepare(sql).all(...values)}},async run(){return db.prepare(sql).run(...values)}}},batch(s){return Promise.all(s.map(x=>x.run()))}};
async function call(path,user='admin',method='GET',body){const r=await worker.fetch(new Request('https://helpdesk.test/api/'+path,{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),origin:'https://helpdesk.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{DB});return {status:r.status,data:await r.json()}}
test('ticket lifecycle and employee authorization',async()=>{
assert.equal((await call('tickets',null)).status,401);
assert.equal((await call('session')).data.admin,true);
assert.equal((await call('session','employee')).data.admin,false);
assert.equal((await call('tickets','employee','POST',{name:' ',issue:'x'})).status,400);
const created=await call('tickets','employee','POST',{name:'Alex',issue:'Laptop cannot connect to Wi-Fi'});assert.equal(created.status,201);const id=created.data.id;
assert.equal((await call('tickets/'+id,'other')).status,404);
assert.equal((await call('tickets','other')).data.length,0);
assert.equal((await call('tickets/'+id,'employee','PATCH',{status:'Resolved',priority:'Normal'})).status,404);
assert.equal((await call('tickets/'+id,'admin','PATCH',{status:'In progress',priority:'High',assignee:'Sam'})).status,200);
assert.equal((await call('tickets/'+id+'/messages','admin','POST',{body:'We are investigating.'})).status,200);
assert.equal((await call('tickets/'+id+'/messages','employee','POST',{body:'Thank you.'})).status,200);
const detail=(await call('tickets/'+id,'employee')).data;assert.equal(detail.ticket.status,'In progress');assert.equal(detail.messages.length,2);
assert.equal((await call('tickets','employee')).data[0].mine,true);assert.equal((await call('tickets','admin')).data[0].mine,false);
assert.equal((await call('tickets/'+id,'admin','PATCH',{status:'Resolved',priority:'High',assignee:'Sam'})).status,200);
});
test('page script compiles',async()=>{const r=await worker.fetch(new Request('https://helpdesk.test/'),{});const html=await r.text();const script=html.match(/<script>([\s\S]*)<\/script>/)[1];new Function(script);assert.ok(html.includes('Your name'));});
