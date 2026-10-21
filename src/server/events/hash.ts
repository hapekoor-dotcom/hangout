import {createHash} from 'node:crypto'
function canonical(value:any):any{
 if(Array.isArray(value))return value.map(canonical)
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]))
 return value
}
export const stableContentHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
// Existing indexed rows can keep their legacy hash until their actual source content changes.
export const legacyContentHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
