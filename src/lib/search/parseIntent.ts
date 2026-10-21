import type {Intent} from './types.ts'
export function parseIntent(query:string):Intent{
 const q=query.toLowerCase().replace(/€/g,'€ ').replace(/\s+/g,' ').trim()
 const intent:Intent={date:null,time:null,startTime:null,endTime:null,categories:[],excludedCategories:[],budgetMin:null,budgetMax:null,noiseLevel:null,kidFriendly:null,soloFriendly:null,socialContext:null,durationHours:null,nearby:false,maxDistanceKm:null,keywords:[],requiredTerms:[]}
 if(/tomorrow/.test(q))intent.date='tomorrow';else if(/weekend/.test(q))intent.date='weekend';else if(/today|tonight|\bnow\b|next \d+ hours?/.test(q))intent.date='today'
 if(/\bnow\b|next \d+ hours?/.test(q))intent.time='now';else if(/tonight|evening/.test(q))intent.time='evening'
 const after=q.match(/after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);const before=q.match(/before\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
 const clock=(m:RegExpMatchArray)=>`${String((Number(m[1])%12+(m[3]==='pm'?12:0))||(Number(m[1])===12&&!m[3]?12:0)).padStart(2,'0')}:${m[2]||'00'}`
 if(after)intent.startTime=after[3]?clock(after):`${after[1].padStart(2,'0')}:${after[2]||'00'}`
 if(before)intent.endTime=before[3]?clock(before):`${before[1].padStart(2,'0')}:${before[2]||'00'}`
 const budget=q.match(/(?:under|below|less than|up to|max)\s*€?\s*(\d+)/)
 if(budget)intent.budgetMax=Number(budget[1]);if(/\bfree\b/.test(q))intent.budgetMax=0
 if(/not (?:too )?loud|not noisy|quiet|chill|relaxed/.test(q))intent.noiseLevel='low';else if(/loud|energetic/.test(q))intent.noiseLevel='high'
 const terms:[string,RegExp][]=[['beer',/beer|taproom|brewery|breweries|pubs?\b/],['coffee',/coffee/],['tea',/\btea\b/],['live music',/live music|acoustic|live show/],['techno',/techno/],['electronic',/electronic/],['board games',/board games?|настол/],['games',/\bgames?\b/],['quiz',/quiz|kahoot/],['food',/food|dinner|eat|market/],['museum',/museum/],['cinema',/cinema|film|movie/],['comedy',/comedy|stand.up/],['outdoor',/outdoor|walk/],['family',/\bfamily\b/],['social',/social|meet people/],['culture',/culture|exhibition|art/],['music',/music/]]
 const positive=q.replace(/\b(?:not|no)\s+(?:a\s+)?(coffee|tea|club|kids|children|techno)\b/g,'')
 for(const [name,re] of terms)if(re.test(positive))intent.categories.push(name)
 for(const match of q.matchAll(/\b(?:not|no)\s+(?:a\s+)?(coffee|tea|club|kids|children|techno)\b/g))intent.excludedCategories.push(['kids','children'].includes(match[1])?'family':match[1])
 if(/not (?:a )?club/.test(q))intent.excludedCategories.push('club')
 if(/not techno/.test(q)){intent.excludedCategories.push('techno');intent.categories=intent.categories.filter(c=>c!=='techno')}
 if(/with kids|with children|family|kids welcome/.test(q))intent.kidFriendly=true
 if(/alone|solo/.test(q))intent.soloFriendly=true
 if(/girlfriend|boyfriend|partner|couple|date night/.test(q))intent.socialContext='couple';else if(/friends/.test(q))intent.socialContext='friends'
 if(/nearby|walking distance|close to me|around me/.test(q)){intent.nearby=true;intent.maxDistanceKm=/walking/.test(q)?1.5:3}
 const km=q.match(/within\s+(\d+(?:\.\d+)?)\s*km/);if(km){intent.nearby=true;intent.maxDistanceKm=Number(km[1])}
 const duration=q.match(/(?:next |for )?(\d+)\s*hours?/);if(duration)intent.durationHours=Number(duration[1]);else if(/two hours/.test(q))intent.durationHours=2;else if(/one hour|quick/.test(q))intent.durationHours=1;else if(/whole evening/.test(q))intent.durationHours=5
 if(/not until (?:6|06)(?:am|:00)?/.test(q))intent.endTime='02:00'
 intent.keywords=positive.split(/\W+/).filter(w=>['acoustic','jazz','coffee','workshop','market','exhibition','techno','quiz'].includes(w))
 const covered=new Set('something somewhere anything things thing to do with my me i can want feel like find show us a an the and or but not no too for of in on at is it that some any go going get places place event events activity activities around happening near tonight today tomorrow now this weekend after before next hours hour one two quick whole evening under below less than up max free chill quiet loud noisy relaxed energetic music live acoustic show techno electronic games game board quiz kahoot food dinner eat market museum cinema film movie comedy stand up outdoor walk family kids children welcome social meet people alone solo friendly girlfriend boyfriend partner couple date night friends nearby walking distance close within km beer craft taproom brewery breweries pub pubs coffee tea euros euro'.split(' '))
 intent.requiredTerms=q.match(/[a-z]+/g)?.filter(w=>w.length>2&&!covered.has(w))||[]
 return intent
}
export function summarizeIntent(i:Intent){const bits:string[]=[];if(i.date)bits.push(i.time==='evening'&&i.date==='today'?'Tonight':i.date==='weekend'?'This weekend':i.date[0].toUpperCase()+i.date.slice(1));if(i.time==='now')bits.push('happening soon');if(i.nearby)bits.push(i.maxDistanceKm===1.5?'walking distance':'nearby');if(i.budgetMax!==null)bits.push(i.budgetMax===0?'free':`under €${i.budgetMax}`);if(i.noiseLevel)bits.push(i.noiseLevel==='low'?'quieter places':'energetic');if(i.kidFriendly)bits.push('kids welcome');if(i.soloFriendly)bits.push('solo-friendly');if(i.startTime)bits.push(`after ${i.startTime}`);if(i.endTime)bits.push(`ends before ${i.endTime}`);if(i.durationHours)bits.push(`${i.durationHours} hour${i.durationHours===1?'':'s'}`);bits.push(...i.categories.filter(c=>!['music','games','family'].includes(c)).slice(0,2));return bits.length?bits.join(' · '):'A few ideas around Tallinn'}
