import type {NormalizedEvent} from './types.ts'
export function deriveMetadata(event:NormalizedEvent):NormalizedEvent{
 const text=(event.title+' '+event.description).toLowerCase(),categories=new Set(event.categories),tags=new Set(event.tags)
 const technoEvidence=/\btechno\b|\btehno\b|(?:^|\s)техно(?:\s|$|[-,.;:!])/.test(text)
 if(!technoEvidence)categories.delete('techno')
 // Reclassify derived music metadata so older polluted caches heal too.
 if(!technoEvidence&&!/concert|kontsert|live music|dj set|electronic|elektroon|jazz|acoustic|музык|концерт/.test(text)){categories.delete('music');categories.delete('electronic')}
 const rules:[string,RegExp][]=[['beer',/\bbeer\b|taproom|brewery|õlu|õlle/],['coffee',/\bcoffee\b|kohvi/],['techno',/\btechno\b|\btehno\b|(?:^|\s)техно(?:\s|$|[-,.;:!])/],['electronic',/electronic|elektroon/],['music',/concert|kontsert|live music|dj set|\btechno\b|\btehno\b/],['live music',/live music|acoustic|live concert/],['board games',/board games|lauamäng|настольн/],['quiz',/quiz|kahoot|mälumäng/],['cinema',/screening|cinema|film screening/],['museum',/museum|muuseum/],['comedy',/stand.up|comedy/],['outdoor',/guided walk|outdoor|matk/],['family',/family event|kids welcome|children welcome|kogu pere|lapsed on oodatud/]]
 for(const [category,pattern]of rules)if(pattern.test(text))categories.add(category)
 const age=text.match(/(?:age|vanusepiirang|ages|vanus|🔞)\s*[:–-]?\s*(\d{1,2})\s*\+|\b(18|21)\+/)
 const restricted=age?Number(age[1]||age[2])>=18:false
 const family=/all ages|kids welcome|children welcome|children are welcome|lapsed on oodatud|kogu pere/.test(text)
 const noiseLevel=technoEvidence||/heavy metal|drum.and.bass|loud dancefloor/.test(text)?'high':/quiet atmosphere|low volume|not loud|vaikne/.test(text)?'low':undefined
 if(categories.has('techno')){categories.add('electronic');categories.add('music')}
 if(categories.has('board games'))categories.add('games')
 return {...event,categories:[...categories],tags:[...tags],age:event.age||(age?`${age[1]||age[2]}+`:undefined),kidFriendly:restricted?false:family?true:event.kidFriendly,noiseLevel}
}
export function normalizeEvents(events:NormalizedEvent[],now=new Date()):NormalizedEvent[]{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Tallinn',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),seen=new Set<string>()
 return events.filter(e=>{if(!e.title||e.date<today||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!/^https:\/\/fienta.com\//.test(e.sourceUrl))return false;const key=e.sourceUrl+'|'+e.date;if(seen.has(key))return false;seen.add(key);return true}).map(deriveMetadata).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime))
}
