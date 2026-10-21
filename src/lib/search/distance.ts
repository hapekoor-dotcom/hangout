import type {Position} from './types.ts'
export const MOCK_POSITION:Position={latitude:59.437,longitude:24.7453}
export function distanceKm(a:Position,b:Position){const rad=(n:number)=>n*Math.PI/180;const dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);return 6371*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2))}
export const formatDistance=(km?:number)=>km===undefined?'Distance unknown':km<1?`${Math.round(km*1000/50)*50||50} m`:`${km.toFixed(1)} km`
export const priceLabel=(price?:number)=>price===undefined?'Price on Fienta':price===0?'Free':`€${price}`
export function tallinnNow(now=new Date()){const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Tallinn',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Tallinn',hour:'2-digit',minute:'2-digit',hour12:false}).format(now);return {date,time}}
export function offsetDate(date:string,offset:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
export const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5))

export function friendlyDate(date:string,now=new Date()){const today=tallinnNow(now).date;return date===today?'Today':date===offsetDate(today,1)?'Tomorrow':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'Europe/Tallinn'}).format(new Date(date+'T12:00:00Z'))}
