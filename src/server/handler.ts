import type {IncomingMessage,ServerResponse} from 'node:http'
import {createHash,timingSafeEqual} from 'node:crypto'
import {configured} from './env.ts'
import {health} from './health.ts'
import {search} from './search/search.ts'
import {supabase} from './db/supabase.ts'
import {ingest,indexEvents,type StoredEvent} from './events/ingest.ts'
export async function handler(req:IncomingMessage&{body?:any},res:ServerResponse){
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store')
 const send=(status:number,body:unknown)=>{res.writeHead(status);res.end(JSON.stringify(body))}
 const path=new URL(req.url||'/','https://hangout.invalid').pathname
 try{
  if(req.method==='GET'&&path==='/api/health'){const result=await health();send(result.ready?200:503,result);return}
  if(!configured()){send(503,{error:'Server configuration is incomplete.'});return}
  if(path==='/api/ingest'&&req.method==='POST'){
   const secret=process.env.CRON_SECRET,auth=req.headers.authorization||'',expected='Bearer '+secret
   if(!secret||auth.length!==expected.length||!timingSafeEqual(Buffer.from(auth),Buffer.from(expected))){send(401,{error:'Unauthorized'});return}
   const result=await ingest(true),rows=await supabase().request<StoredEvent[]>('events?active=eq.true&select=id,data,content_hash,embedding_model,enrichment_version&order=data->>date.asc&limit=1000')
   send(200,{...result,...await indexEvents(rows,10)});return
  }
  if(req.method!=='POST'||!['/api/search','/api/feedback'].includes(path)){send(404,{error:'Not found'});return}
  // Browser callers must be same-origin; no permissive CORS with service-role access.
  const origin=req.headers.origin,host=req.headers.host
  if(origin&&new URL(origin).host!==host){send(403,{error:'Origin not allowed'});return}
  let raw=''
  if(!req.body){for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000){send(413,{error:'Request too large'});return}}}
  const body=req.body?(typeof req.body==='string'?JSON.parse(req.body):req.body):JSON.parse(raw||'{}')
  if(!body||typeof body!=='object'){send(400,{error:'Invalid request'});return}
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0]
  const allowed=await supabase().rpc<boolean>('hangout_allow_request',{bucket_key:createHash('sha256').update(ip).digest('hex'),request_limit:20})
  if(!allowed){res.setHeader('Retry-After','60');send(429,{error:'Please try again shortly.'});return}
  if(path==='/api/search'){
   if(typeof body.query!=='string'||!body.query.trim()||body.query.length>400){send(400,{error:'Enter a short search query.'});return}
   const p=body.position||{latitude:59.437,longitude:24.7536},b=body.bounds
   if(!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||b&&(!['north','south','east','west'].every(k=>Number.isFinite(b[k]))||b.north<b.south||b.east<b.west||Math.abs(b.north)>90||Math.abs(b.south)>90||Math.abs(b.east)>180||Math.abs(b.west)>180)){send(400,{error:'Invalid location'});return}
   send(200,await search(body.query.trim(),p,b));return
  }
  if(typeof body.eventId!=='string'||body.eventId.length>200||typeof body.query!=='string'||body.query.length>400||!['good','not_for_me'].includes(body.verdict)||body.reason&&!['too_far','too_expensive','wrong_vibe','wrong_type','not_what_i_asked'].includes(body.reason)){send(400,{error:'Invalid feedback'});return}
  await supabase().request('feedback','POST',{event_id:body.eventId,query:body.query,verdict:body.verdict,reason:body.reason||null},'return=minimal');send(201,{saved:true})
 }catch(error){send(error instanceof SyntaxError?400:503,{error:error instanceof SyntaxError?'Invalid request':'Search is unavailable right now. Please try again.'})}
}
