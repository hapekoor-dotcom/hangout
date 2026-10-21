import {supabase} from '../db/supabase.ts'
import {embeddingModel} from '../ai/client.ts'
import type {EventItem} from '../../lib/search/types.ts'
export async function retrieveCandidates(eligible:EventItem[],embedding:number[]):Promise<EventItem[]>{
 if(!eligible.length)return []
 const rows=await supabase().rpc<{data:EventItem}[]>('hangout_match_events',{query_embedding:embedding,eligible_ids:eligible.map(e=>e.id),model_name:embeddingModel(),match_count:25})
 return rows.map(row=>({...row.data,venue:row.data.venue||'Venue on Fienta'}))
}
