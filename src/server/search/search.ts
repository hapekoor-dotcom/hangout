import {createHash} from 'node:crypto'
import {database} from '../db/client.ts'
import {embed} from '../ai/client.ts'
import {parseAIIntent} from './parseIntent.ts'
import {hardFilters} from './hardFilters.ts'
import {retrieveCandidates} from './retrieveCandidates.ts'
import {rerank} from './rerank.ts'
import type {Position,Bounds,EventItem} from '../../lib/search/types.ts'
export async function search(query:string,position:Position,bounds?:Bounds){
 const db=database(),key=createHash('sha256').update(JSON.stringify({query:query.trim().toLowerCase(),position,bounds,bucket:Math.floor(Date.now()/300000)})).digest('hex')
 const cached=await db.query('SELECT payload FROM search_cache WHERE cache_key=$1 AND expires_at>now()',[key]);if(cached.rows.length)return cached.rows[0].payload
 const intent=await parseAIIntent(query)
 const stored=await db.query("SELECT data FROM events WHERE active AND data->>'date'>=to_char(now() AT TIME ZONE 'Europe/Tallinn','YYYY-MM-DD')")
 const records:EventItem[]=stored.rows.map(row=>({...row.data,venue:row.data.venue||'Venue on Fienta'}))
 const eligible=hardFilters(records,intent,position,new Date(),bounds)
 const candidates=eligible.length?await retrieveCandidates(eligible,await embed(query)):[]
 const reranked=await rerank(query,intent,candidates,position)
 // Revalidate after reranking; only deterministic-approved IDs can reach the UI.
 const approved=new Set(hardFilters(candidates,intent,position,new Date(),bounds).map(e=>e.id))
 const payload={intent,results:reranked.filter(r=>approved.has(r.event.id)),mode:'ai'}
 await db.query("INSERT INTO search_cache(cache_key,payload,expires_at) VALUES($1,$2,now()+interval '5 minutes') ON CONFLICT(cache_key) DO UPDATE SET payload=$2,expires_at=now()+interval '5 minutes'",[key,JSON.stringify(payload)])
 return payload
}
