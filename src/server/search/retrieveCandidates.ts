import {database,vector} from '../db/client.ts'
import type {EventItem} from '../../lib/search/types.ts'
export async function retrieveCandidates(eligible:EventItem[],embedding:number[]):Promise<EventItem[]>{
 if(!eligible.length)return []
 const rows=await database().query('SELECT data FROM events WHERE active AND id=ANY($1::text[]) AND embedding_model=$3 AND embedding IS NOT NULL ORDER BY embedding <=> $2::vector LIMIT 25',[eligible.map(e=>e.id),vector(embedding),process.env.OPENAI_EMBEDDING_MODEL])
 return rows.rows.map(row=>({...row.data,venue:row.data.venue||'Venue on Fienta'}))
}
