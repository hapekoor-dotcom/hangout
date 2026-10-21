import {createHash} from 'node:crypto'
import {database} from '../db/client.ts'
let lastRequest=0
export async function geocode(address:string){
 const key=createHash('sha256').update(address.toLowerCase().replace(/\s+/g,' ').trim()).digest('hex')
 const cached=await database().query('SELECT latitude,longitude FROM geocodes WHERE address_key=$1 AND (latitude IS NOT NULL OR checked_at>now()-interval \'7 days\')',[key])
 if(cached.rows.length)return cached.rows[0].latitude===null?undefined:cached.rows[0]
 if(!process.env.OPENCAGE_API_KEY)return undefined
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,1100-(Date.now()-lastRequest))));lastRequest=Date.now()
 const url=new URL('https://api.opencagedata.com/geocode/v1/json');Object.entries({q:address,key:process.env.OPENCAGE_API_KEY,countrycode:'ee',language:'en',limit:'1',no_annotations:'1'}).forEach(([k,v])=>url.searchParams.set(k,v))
 const response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error(`Geocoder returned HTTP ${response.status}`)
 const result=(await response.json()).results?.[0]
 // Do not convert an ambiguous city/region centroid into an event location.
 const point=result?.confidence>=7?result.geometry:undefined
 const latitude=point?.lat,longitude=point?.lng
 await database().query('INSERT INTO geocodes(address_key,latitude,longitude,provider) VALUES($1,$2,$3,$4) ON CONFLICT(address_key) DO UPDATE SET latitude=$2,longitude=$3,checked_at=now()',[key,latitude??null,longitude??null,'opencage'])
 return latitude!==undefined&&longitude!==undefined?{latitude,longitude}:undefined
}
