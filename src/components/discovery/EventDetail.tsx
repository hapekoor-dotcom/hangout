import {useEffect,useRef} from 'react'
import type {RankedEvent} from '@/lib/search/types'
import {formatDistance,priceLabel,friendlyDate} from '@/lib/search/distance'
import {AISummary} from './AISummary'
import {RichEventDescription} from './RichEventDescription'
export function EventDetail({item,onClose,onMap}:{item:RankedEvent;onClose:()=>void;onMap:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);const e=item.event
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close()},[])
 return <dialog ref={ref} className="event-dialog" onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
  <button className="dialog-close" aria-label="Close event details" onClick={onClose}>×</button>
  <p className="demo-eyebrow">Fienta · {item.label}</p><h2>{e.title}</h2>
  <dl><div><dt>When</dt><dd>{friendlyDate(e.date)} · {e.startTime}{e.endTime?`–${e.endTime}`:''}</dd></div><div><dt>Where</dt><dd>{e.venue}{e.address&&<><br/>{e.address}</>}{item.distanceKm!==undefined&&<> · {formatDistance(item.distanceKm)}</>}</dd></div><div><dt>Entry</dt><dd>{priceLabel(e.price)}{e.age&&<> · {e.age}</>}</dd></div></dl>
  <AISummary text={e.aiSummary}/>
  <section className="detail-about"><h3>About this event</h3>{e.rawDescription||e.description?<RichEventDescription source={e.rawDescription||e.description}/>:<p>The organiser’s full description is available on Fienta.</p>}</section>
  <section className="detail-location"><h3>Location</h3><p>{e.venue}{e.address&&<><br/>{e.address}</>}</p>{e.latitude!==undefined&&e.longitude!==undefined&&<button className="detail-map" onClick={onMap}>Show on map</button>}</section>
  {e.sourceUrl&&<a className="discover-primary" href={e.sourceUrl} target="_blank" rel="noopener noreferrer">View on Fienta ↗</a>}
 </dialog>
}
