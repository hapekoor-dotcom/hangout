import {createServer} from 'node:http'
import {search} from './search/search.ts'
import {database} from './db/client.ts'
const rate=new Map<string,{count:number;until:number}>()
const ready=()=>!!(process.env.DATABASE_URL&&process.env.OPENAI_API_KEY&&process.env.OPENAI_TEXT_MODEL&&process.env.OPENAI_EMBEDDING_MODEL)
createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store')
 const origin=req.headers.origin;if(origin&&origin!==process.env.APP_ORIGIN){res.writeHead(403).end(JSON.stringify({error:'Origin not allowed'}));return}
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin)
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST,GET,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.writeHead(204).end();return}
 if(req.url==='/api/health'){res.end(JSON.stringify({configured:ready(),mode:ready()?'ai':'not_configured'}));return}
 if(!ready()){res.writeHead(503).end(JSON.stringify({error:'AI search is not connected yet.'}));return}
 const ip=req.socket.remoteAddress||'local',now=Date.now();let bucket=rate.get(ip);if(!bucket||bucket.until<now){bucket={count:0,until:now+60000};rate.set(ip,bucket)}
 if(++bucket.count>20){res.setHeader('Retry-After','60');res.writeHead(429).end(JSON.stringify({error:'Please try again shortly.'}));return}
 if(rate.size>10000)for(const [key,value]of rate)if(value.until<now)rate.delete(key)
 try{
  if(req.method!=='POST'||!['/api/search','/api/feedback'].includes(req.url||'')){res.writeHead(404).end('{}');return}
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000){res.writeHead(413).end('{}');return}}
  const body=JSON.parse(raw||'{}')
  if(req.url==='/api/search'){
   if(typeof body.query!=='string'||!body.query.trim()||body.query.length>400){res.writeHead(400).end('{}');return}
   const p=body.position;if(!p||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180){res.writeHead(400).end('{}');return}
   const bounds=body.bounds;if(bounds&&(!['north','south','east','west'].every(k=>Number.isFinite(bounds[k]))||bounds.north<bounds.south||bounds.east<bounds.west)){res.writeHead(400).end('{}');return}
   res.end(JSON.stringify(await search(body.query.trim(),p,bounds)));return
  }
  const allowed=['too_far','too_expensive','wrong_vibe','wrong_type','not_what_i_asked']
  if(typeof body.eventId!=='string'||typeof body.query!=='string'||body.query.length>400||!['good','not_for_me'].includes(body.verdict)||(body.reason&&!allowed.includes(body.reason))){res.writeHead(400).end('{}');return}
  await database().query('INSERT INTO feedback(event_id,query,verdict,reason) VALUES($1,$2,$3,$4)',[body.eventId,body.query,body.verdict,body.reason||null]);res.writeHead(201).end('{"saved":true}')
 }catch{res.writeHead(503).end(JSON.stringify({error:'Search is unavailable right now. Please try again.'}))}
}).listen(Number(process.env.PORT||8787),process.env.API_HOST||'127.0.0.1')
