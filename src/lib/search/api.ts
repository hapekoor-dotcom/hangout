import type {Intent,RankedEvent,Bounds,Position} from './types'
export const aiConfigured=import.meta.env.VITE_AI_SEARCH==='1'
const base=import.meta.env.VITE_API_URL||''
async function post(path:string,body:unknown){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Search is unavailable right now. Please try again.');return response.json()}
export async function searchAPI(query:string,position:Position,bounds?:Bounds):Promise<{results:RankedEvent[];intent:Intent}>{return post('/api/search',{query,position,bounds})}
export async function feedbackAPI(eventId:string,query:string,verdict:'good'|'not_for_me',reason?:string){return post('/api/feedback',{eventId,query,verdict,reason})}
