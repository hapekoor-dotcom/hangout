import type {NormalizedEvent,EventSourceAdapter} from '../types.ts'
export const FIENTA_API='https://fienta.com/api/v1/public/events'
const clean=(value:unknown)=>typeof value==='string'?value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/\s+/g,' ').trim():''
export function parseFienta(data:any):NormalizedEvent[]{
 return (Array.isArray(data.events)?data.events:[]).flatMap((e:any)=>{
  if(!e.is_public||e.attendance_mode==='online'||!e.title||!e.starts_at||!e.url)return []
  const locality=[e.city,e.address,e.venue].filter(Boolean).join(' ')
  if(!/tallinn/i.test(locality))return []
  const amount=typeof e.price==='number'?e.price:typeof e.price_from==='number'?e.price_from:undefined
  const priceText=String(e.price_from_string||'');const priceMatch=priceText.match(/(?:from\s*)?(\d+(?:[.,]\d+)?)\s*(?:EUR|€)/i)
  const price=amount??(priceMatch?Number(priceMatch[1].replace(',','.')):/^(free|tasuta)$/i.test(priceText)?0:undefined)
  return [{id:'fienta-'+e.id,title:clean(e.title),description:clean(e.description),rawDescription:typeof e.description==='string'?e.description:undefined,date:e.starts_at.slice(0,10),startTime:e.starts_at.slice(11,16),endTime:e.ends_at?.slice(11,16),endDate:e.ends_at?.slice(0,10),venue:clean(e.venue)||undefined,address:clean(e.address)||undefined,price,currency:price!==undefined?'EUR' as const:undefined,categories:Array.isArray(e.categories)?e.categories.filter((x:any)=>typeof x==='string'):[],tags:[],latitude:typeof e.latitude==='number'?e.latitude:undefined,longitude:typeof e.longitude==='number'?e.longitude:undefined,image:e.image_url||undefined,source:'fienta' as const,sourceUrl:e.url}]
 })
}
async function get(url:string){const r=await fetch(url,{headers:{'User-Agent':'HangoutPreview/1.0','Accept':'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`Fienta HTTP ${r.status}; request stopped, no retries or bypass`);return r}
const fienta:EventSourceAdapter={id:'fienta',async fetchEvents(){
 const robots=await (await get('https://fienta.com/robots.txt')).text()
 if(/Disallow:\s*\/(?:api(?:\/|\s)|\s*$)/im.test(robots))throw new Error('Fienta robots restriction; ingestion stopped')
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Tallinn',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const all:NormalizedEvent[]=[]
 for(let page=1;page<=3;page++){
  const url=new URL(FIENTA_API);Object.entries({country:'EE',city:'Tallinn',locale:'en',starts_from:today,page:String(page),per_page:'100'}).forEach(([k,v])=>url.searchParams.set(k,v))
  const data=await (await get(url.href)).json();all.push(...parseFienta(data));if(!data.pagination?.next_page_url)break
 }
 return all
}}
export default fienta
