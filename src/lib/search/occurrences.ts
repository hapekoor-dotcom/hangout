import {tallinnNow,offsetDate} from './distance.ts'
export type Occurrence={id:string;title:string;date:string;startTime:string}
export function normalizedTitle(title:string){
 return title.normalize('NFKC').toLowerCase().replace(/['’‘`ʼ]/gu,'').replace(/[\p{P}\p{S}]/gu,char=>/[+#&/@%*=]/u.test(char)?char:' ').replace(/\s*([+#&/@%*=])\s*/gu,'$1').replace(/\s+/gu,' ').trim()
}
export function wantsOccurrences(query:string){
 const q=query.normalize('NFKC').toLowerCase()
 return /\bnext\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\bevery\s+|\b(?:recurring|occurrences)\b|\bdates?\s+(?:for|of)\b|\ball\s+(?:upcoming|future|dates|sessions|instances)\b|\btomorrow\b|\bthis\s+weekend\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\b|следующ\S*\s+недел|кажд(?:ую|ый|ое)|все\s+(?:даты|предстоящие)|даты\s+(?:для|этого)|järgmisel\s+nädalal|iga\s+(?:reede|nädal)|kõik\s+kuupäevad/u.test(q)
}
export function occurrenceOrder(a:Occurrence,b:Occurrence){return (a.date+'T'+a.startTime).localeCompare(b.date+'T'+b.startTime)||a.id.localeCompare(b.id)}
export function nearestOccurrences<T extends Occurrence>(events:T[],query=''):T[]{
 if(wantsOccurrences(query))return [...events].sort(occurrenceOrder)
 const groups=new Map<string,T>()
 for(const event of events){const key=normalizedTitle(event.title)||'id:'+event.id,old=groups.get(key);if(!old||occurrenceOrder(event,old)<0)groups.set(key,event)}
 return [...groups.values()]
}
// Explicit date/weekday requests are applied before deciding which instances are eligible.
export function filterOccurrenceDates<T extends Occurrence>(events:T[],query:string,now=new Date()):T[]{
 const q=query.toLowerCase();let filtered=events
 if(/\bnext\s+week\b|следующ\S*\s+недел|järgmisel\s+nädalal/u.test(q)){
  const today=tallinnNow(now).date,day=new Date(today+'T12:00:00Z').getUTCDay(),start=offsetDate(today,(8-day)%7||7),end=offsetDate(start,6)
  filtered=filtered.filter(event=>event.date>=start&&event.date<=end)
 }
 const weekday=q.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)
 if(weekday){const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],day=days.indexOf(weekday[1]);filtered=filtered.filter(event=>new Date(event.date+'T12:00:00Z').getUTCDay()===day)}
 return filtered
}
