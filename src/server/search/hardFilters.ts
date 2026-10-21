import {canonicalTaxonomy} from '../events/taxonomy.ts'
import {rankEvents} from '../../lib/search/rankEvents.ts'
import type {EventItem,Bounds,Position} from '../../lib/search/types.ts'
import type {AIIntent} from './parseIntent.ts'
export function hardFilters(events:EventItem[],intent:AIIntent,position:Position,now=new Date(),bounds?:Bounds){
 const factIntent={...intent,noiseLevel:intent.noiseMax?null:intent.noiseLevel,categories:[],requiredTerms:[],keywords:[],nearby:intent.maxDistanceKm!==null,excludedCategories:intent.excludedCategories}
 return rankEvents(events.map(canonicalTaxonomy),factIntent,position,now,bounds).map(i=>i.event).filter(e=>{
  if(intent.noiseMax){const levels={low:1,medium:2,high:3};if(!e.noiseLevel||levels[e.noiseLevel]>levels[intent.noiseMax])return false}
  if(intent.endTime&&!e.endTime)return false
  if(intent.budgetMin!==null&&(e.price===undefined||e.price<intent.budgetMin))return false
  if(intent.excludeKids&&e.kidFriendly!==false)return false
  if(intent.excludedCategories.some(c=>e.categories.includes(c)||e.tags.includes(c)))return false
  // Primary explicit concepts stay mandatory, regardless of embedding similarity.
  if(intent.categories.includes('beer')&&!e.categories.includes('beer'))return false
  if(intent.categories.includes('coffee')&&!e.categories.includes('coffee'))return false
  if(intent.categories.includes('techno')&&!e.categories.includes('techno'))return false
  return true
 })
}
