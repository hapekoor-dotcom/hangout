import {aiConfigured,searchAPI} from '@/lib/search/api'
import {getEventFeed} from '@/lib/events'
import type {EventItem} from '@/lib/search/types'
import {useEffect,useMemo,useRef,useState} from 'react'
import {parseIntent} from '@/lib/search/parseIntent'
import {rankEvents} from '@/lib/search/rankEvents'
import {MOCK_POSITION,tallinnNow} from '@/lib/search/distance'
import type {Bounds,RankedEvent,Intent} from '@/lib/search/types'
import {EventCard} from '@/components/discovery/EventCard'
import {EventMap} from '@/components/discovery/EventMap'
import {EventDetail} from '@/components/discovery/EventDetail'
import './discovery.css'
export default function Discovery(){
 const [draft,setDraft]=useState(''),[query,setQuery]=useState('tonight'),[searched,setSearched]=useState(false),[view,setView]=useState<'list'|'map'>('list'),[selectedId,setSelectedId]=useState<string|null>(null),[detail,setDetail]=useState<RankedEvent|null>(null),[area,setArea]=useState<Bounds|undefined>()
 const [liveEvents,setLiveEvents]=useState<EventItem[]>([])
 const [feedUpdated,setFeedUpdated]=useState('')
 const [actualClock]=useState(()=>new Date())
 useEffect(()=>{let active=true;getEventFeed().then(feed=>{if(active){setLiveEvents(feed.events.map(e=>({...e,venue:e.venue||'Venue on Fienta'})));setFeedUpdated(feed.fetchedAt)}});return()=>{active=false}},[])
 const [serverResults,setServerResults]=useState<RankedEvent[]>([])
 const [serverIntent,setServerIntent]=useState<Intent|null>(null)
 const [searching,setSearching]=useState(false),[searchError,setSearchError]=useState('')
 const requestVersion=useRef(0)
 useEffect(()=>{if(!aiConfigured||!searched)return;const version=++requestVersion.current;setSearching(true);setSearchError('');setServerResults([]);searchAPI(query,MOCK_POSITION,area).then(data=>{if(version===requestVersion.current){setServerResults(data.results);setServerIntent(data.intent)}}).catch(error=>{if(version===requestVersion.current)setSearchError(error.message)}).finally(()=>{if(version===requestVersion.current)setSearching(false)})},[query,area,searched])
 const input=useRef<HTMLTextAreaElement>(null)
 const localIntent=useMemo(()=>parseIntent(query),[query]);const intent=aiConfigured&&serverIntent?serverIntent:localIntent;const localResults=useMemo(()=>rankEvents(liveEvents,intent,MOCK_POSITION,actualClock,area),[intent,actualClock,area,liveEvents]);const results=aiConfigured?serverResults:localResults
 const submit=(value=draft)=>{if(!value.trim()){input.current?.focus();return}setQuery(value.trim());setDraft(value);setSearched(true);setArea(undefined);setSelectedId(null)}
 const showMap=(item:RankedEvent)=>{setSelectedId(item.event.id);setView('map');setDetail(null)}
 return <div className={`discovery-app ${searched?'has-results':'is-start'}`}>
  <header className="discovery-header"><a href="?app=discover" className="discovery-brand">hangout <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19 19 5M5 5h14v14"/></svg></a><span>Tallinn <span className="city-dot"/></span></header>
  <main className="discovery-main">
   <section className="discovery-search" aria-labelledby="discovery-heading"><h1 id="discovery-heading">Find something to do</h1>
    <form onSubmit={e=>{e.preventDefault();submit()}}><label htmlFor="evening-query" className="sr-only">What would you like to do?</label><div className="query-box"><textarea ref={input} id="evening-query" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="e.g. something to do with friends" rows={2} maxLength={400} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}}}/><button className="discover-primary" type="submit" disabled={searching}>{searching?'Finding…':'Find something'}</button></div></form>
    <p className="search-helper">Tell us what kind of plan you want.</p>
   </section>
   {searched&&<section className="discovery-results" aria-label="Discovery results"><div className="results-content">
    {searching&&<p role="status" className="search-status">Finding a few good options…</p>}
    {searchError&&<p role="alert" className="search-status">{searchError}</p>}
    {!searching&&!searchError&&!results.length&&<div className="discovery-empty"><h3>No strong matches right now.</h3><p>{area?'Try widening the map area or clearing it.':'Try a wider area or a different time.'}</p><button onClick={()=>{setArea(undefined);setQuery('');setDraft('');setSearched(false)}}>Show all ideas</button></div>}
    <div hidden={view!=='list'} className="discovery-list">{results.map(item=><EventCard key={item.event.id} item={item} query={query} onOpen={()=>{setSelectedId(item.event.id);setDetail(item)}} onMap={()=>showMap(item)}/>)}</div>
    <div hidden={view!=='map'}>{view==='map'&&<button className="clear-area" onClick={()=>setView('list')}>Back to results</button>}<EventMap items={results} selectedId={selectedId} onSelect={setSelectedId} onOpen={setDetail} onArea={setArea} visible={view==='map'}/></div>
   </div></section>}
   {searched&&<footer className="discovery-footer">{liveEvents.length?`Fienta · ${liveEvents.length} events · updated ${feedUpdated?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Tallinn',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(feedUpdated)):''}`:'Fienta feed unavailable · no events loaded'}<span>{aiConfigured?'AI search':'Rules search · AI connection pending'}</span><a href="?app=about">About hangout ↗</a></footer>}
  </main>{detail&&<EventDetail key={detail.event.id} item={detail} onClose={()=>setDetail(null)} onMap={()=>showMap(detail)}/>}
 </div>
}
