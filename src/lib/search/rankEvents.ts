import {summarizeEvent} from './summarizeEvent.ts'
import type {Bounds,EventItem,Intent,Position,RankedEvent} from './types.ts'
import {distanceKm,minutes,offsetDate,tallinnNow} from './distance.ts'
export function rankEvents(events:EventItem[],intent:Intent,position:Position,now=new Date(),bounds?:Bounds):RankedEvent[]{
 const {date:today,time}=tallinnNow(now);const current=minutes(time);const weekday=new Date(today+'T12:00:00Z').getUTCDay();const friday=offsetDate(today,(5-weekday+7)%7);const weekendStart=weekday===0?offsetDate(today,-2):weekday===6?offsetDate(today,-1):friday
 return events.flatMap(event=>{
  const start=minutes(event.startTime),endRaw=minutes(event.endTime||event.startTime),daySpan=event.endDate?Math.max(0,Math.round((Date.parse(event.endDate)-Date.parse(event.date))/86400000)):0,end=daySpan?endRaw+daySpan*1440:endRaw<start?endRaw+1440:endRaw;const distance=event.latitude!==undefined&&event.longitude!==undefined?distanceKm(position,{latitude:event.latitude,longitude:event.longitude}):undefined
  if(event.date<today||(event.date===today&&end<=current))return []
  if(intent.date==='today'&&event.date!==today||intent.date==='tomorrow'&&event.date!==offsetDate(today,1)||intent.date==='weekend'&&(event.date<weekendStart||event.date>offsetDate(weekendStart,2)))return []
  if(intent.budgetMax!==null&&(event.price===undefined||event.price>intent.budgetMax)||intent.kidFriendly&&event.kidFriendly!==true||intent.soloFriendly&&event.soloFriendly!==true)return []
  if(intent.noiseLevel==='low'&&event.noiseLevel==='high'||intent.excludedCategories.some(c=>event.categories.includes(c)))return []
  if(intent.startTime&&start<minutes(intent.startTime)||intent.time==='evening'&&start<17*60)return []
  if(intent.endTime){let limit=minutes(intent.endTime);if(limit<6*60&&start>=17*60)limit+=1440;if(end>limit)return []}
  if(intent.time==='now'&&(event.date!==today||start>current+(intent.durationHours||2)*60||end<=current||(intent.durationHours!==null&&end>current+intent.durationHours*60)))return []
  if(intent.durationHours&&end-start>intent.durationHours*60)return []
  if(intent.nearby&&(distance===undefined||distance>(intent.maxDistanceKm||3)))return []
  if(bounds&&(event.latitude===undefined||event.longitude===undefined||event.latitude<bounds.south||event.latitude>bounds.north||event.longitude<bounds.west||event.longitude>bounds.east))return []
  const haystack=[event.title,event.description,event.venue,...event.categories,...event.tags].join(' ').toLowerCase()
  if(intent.requiredTerms.some(term=>!haystack.includes(term)))return []
  if(intent.keywords.some(term=>!haystack.includes(term)))return []
  if(intent.noiseLevel==='low'&&event.noiseLevel!=='low')return []
  const specific=intent.categories.filter(c=>!['music','games','family','social'].includes(c))
  if(intent.categories.length&&!intent.categories.some(c=>event.categories.includes(c)||((c==='coffee'||c==='tea')&&event.tags.includes(c))))return []
  if(specific.length&&!specific.every(c=>event.categories.includes(c)||((c==='coffee'||c==='tea')&&event.tags.includes(c))))return []
  let score=20;const reasons:string[]=[]
  if(intent.categories.some(c=>event.categories.includes(c))){score+=30;reasons.push('Fits your plan')}
  if(intent.noiseLevel&&event.noiseLevel===intent.noiseLevel){score+=18;reasons.push(intent.noiseLevel==='low'?'Quieter place':'High energy')}
  if(intent.kidFriendly&&event.kidFriendly){score+=20;reasons.push('Kids welcome')}
  if(intent.kidFriendly&&event.categories.includes('family'))score+=20
  if(intent.soloFriendly&&event.soloFriendly){score+=15;reasons.push('Easy to join solo')}
  if(intent.budgetMax!==null){score+=10;reasons.push('Within budget')}
  score+=Math.max(0,10-(distance??4)*3)+(event.date===today?5:0)+intent.keywords.filter(k=>[event.title,...event.tags].join(' ').toLowerCase().includes(k)).length*5
  if(intent.socialContext&&event.tags.includes(intent.socialContext))score+=10
  if(intent.time==='now')score+=Math.max(0,12-Math.abs(start-current)/15)
  const matchReason=event.source==='fienta'&&!intent.categories.length?'Matches your search terms.':intent.categories.includes('beer')?'A beer-focused spot for a casual evening.':intent.soloFriendly?'Easy to join without bringing a group.':intent.kidFriendly?'Kids are welcome at this activity.':intent.noiseLevel==='low'?'A low-key setting where you can hear each other.':intent.categories.includes('techno')?'Techno and an energetic dance floor.':intent.categories.includes('live music')?'A live set that fits your music plans.':intent.budgetMax===0?'Free entry, within your budget.':intent.categories.includes('board games')||intent.categories.includes('games')?'A table and games to join in with.':intent.categories.includes('coffee')?'A coffee spot for an easy catch-up.':intent.socialContext==='friends'?'A relaxed plan to share with friends.':intent.nearby?'Within your requested distance.':'Fits the time and preferences you asked for.'
  return [{event,matchReason,summary:summarizeEvent(event,intent),distanceKm:distance,reasons,score}]
 }).sort((a,b)=>b.score-a.score||a.event.date.localeCompare(b.event.date)||a.event.startTime.localeCompare(b.event.startTime)).map(({score,...rest})=>({...rest,label:score>=48?'Great match':score>=32?'Good match':'Worth a look'}))
}
