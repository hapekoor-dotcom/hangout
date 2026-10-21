import {AISummary} from './AISummary'
import {ResultFeedback} from './ResultFeedback'
import type {RankedEvent} from '@/lib/search/types'
import {formatDistance,priceLabel,friendlyDate} from '@/lib/search/distance'
function shortDescription(text:string){const sentences=text.match(/[^.!?]+[.!?]+(?:\s|$)/g);const snippet=sentences?sentences.slice(0,2).join('').trim():text;if(snippet.length<=340)return snippet;const cut=snippet.slice(0,337);return cut.slice(0,cut.lastIndexOf(' '))+'…'}
export function EventCard({item,onOpen,onMap,compact=false,query=''}:{query?:string;item:RankedEvent;onOpen:()=>void;onMap?:()=>void;compact?:boolean}){
 const e=item.event
 const tags=[...e.categories.filter(c=>!['social','music','food'].includes(c)).slice(0,1),...(e.noiseLevel==='low'?['Quiet']:[]),...(e.soloFriendly?['Solo-friendly']:[]),...(e.kidFriendly?['Kids welcome']:[])].slice(0,3)
 return <article className={`discovery-card ${compact?'compact':''}`}>
  <img className="event-thumbnail" src={e.image||(e.categories.includes('board games')||e.categories.includes('games')?'assets/board-games.jpeg':e.categories.includes('music')?'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=500&fit=crop':e.categories.includes('beer')?'https://images.unsplash.com/photo-1513558161293-cdaf765edfd7?w=400&h=500&fit=crop':'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=500&fit=crop')} alt={e.source==='fienta'&&e.image?`Event poster: ${e.title}`:'Temporary illustrative photo, not the actual event or venue'} loading="lazy" width="160" height="200" onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src='assets/board-games.jpeg'}}/>
  <div className="event-card-copy"><h3 className="result-event-title">{e.title}</h3>
  <p className="event-place">{e.venue.replace(/ · demo.*$/,'')}</p>
  <p className="event-facts">{friendlyDate(e.date)} · {e.startTime}{item.distanceKm!==undefined?` · ${formatDistance(item.distanceKm)}`:''} · {priceLabel(e.price)}</p>
  <div className="event-traits">{tags.map(tag=><span key={tag}>{tag}</span>)}</div>
  </div>
  <div className="event-description">{e.aiSummary?<AISummary text={e.aiSummary}/>:<p>{shortDescription(item.summary)}</p>}</div>
  <p className="event-match-reason">{item.matchReason}</p>
  <p className="event-rank-label">{item.label}</p>
  <div className="card-actions"><button onClick={onOpen}>View event</button>{onMap&&e.latitude!==undefined&&e.longitude!==undefined&&<button onClick={onMap}>Show on map</button>}</div>
 <ResultFeedback key={query} eventId={e.id} query={query}/>
 </article>
}
