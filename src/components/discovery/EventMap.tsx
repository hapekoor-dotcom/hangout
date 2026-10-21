import {useEffect,useRef,useState} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type {Bounds,RankedEvent} from '@/lib/search/types'
import {MOCK_POSITION,priceLabel} from '@/lib/search/distance'
import {EventCard} from './EventCard'
export function EventMap({items,selectedId,onSelect,onOpen,onArea,visible}:{items:RankedEvent[];selectedId:string|null;onSelect:(id:string)=>void;onOpen:(item:RankedEvent)=>void;onArea:(bounds:Bounds)=>void;visible:boolean}){
 const element=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),markers=useRef<L.LayerGroup|null>(null)
 const [pending,setPending]=useState<Bounds|null>(null),[tileError,setTileError]=useState(false)
 const callbacks=useRef({onSelect});callbacks.current={onSelect}
 useEffect(()=>{
  if(!element.current)return
  const m=L.map(element.current,{zoomControl:false,scrollWheelZoom:false}).setView([MOCK_POSITION.latitude,MOCK_POSITION.longitude],14);map.current=m
  L.control.zoom({position:'topright'}).addTo(m)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).on('tileerror',()=>setTileError(true)).on('tileload',()=>setTileError(false)).addTo(m)
  L.circleMarker([MOCK_POSITION.latitude,MOCK_POSITION.longitude],{radius:7,color:'#fffdf8',weight:3,fillColor:'#355c75',fillOpacity:1}).addTo(m).bindTooltip('Demo starting point · central Tallinn')
  markers.current=L.layerGroup().addTo(m)
  const moved=()=>{const b=m.getBounds();setPending({north:b.getNorth(),south:b.getSouth(),east:b.getEast(),west:b.getWest()})}
  m.on('dragend zoomend',moved)
  const observer=new ResizeObserver(()=>m.invalidateSize({pan:false}));observer.observe(element.current)
  return()=>{observer.disconnect();m.remove();map.current=null}
 },[])
 useEffect(()=>{
  const group=markers.current;if(!group)return;group.clearLayers()
  items.forEach((item,index)=>{
   if(item.event.latitude===undefined||item.event.longitude===undefined)return
   const marker=L.marker([item.event.latitude,item.event.longitude],{title:item.event.title,keyboard:true,icon:L.divIcon({className:`discovery-marker ${selectedId===item.event.id?'selected':''}`,html:`<span>${index+1}</span>`,iconSize:[34,34],iconAnchor:[17,17]})})
   marker.bindTooltip(`${item.event.title} · ${priceLabel(item.event.price)}`,{direction:'top'}).on('click',()=>callbacks.current.onSelect(item.event.id)).addTo(group)
  })
 },[items,selectedId])
 useEffect(()=>{if(visible)map.current?.invalidateSize({pan:false})},[visible])
 useEffect(()=>{const selected=items.find(i=>i.event.id===selectedId);if(selected&&selected.event.latitude!==undefined&&selected.event.longitude!==undefined&&map.current)map.current.panTo([selected.event.latitude,selected.event.longitude],{animate:false})},[selectedId])
 const selected=items.find(i=>i.event.id===selectedId)
 return <div className="discovery-map-wrap"><div className="map-stage"><div ref={element} className="discovery-map" aria-label="Interactive map of matching demo events in Tallinn"/>{pending&&<button className="search-area" onClick={()=>{onArea(pending);setPending(null)}}>Search this area</button>}<div className="map-location">Demo starting point · central Tallinn</div></div>{tileError&&<p className="map-fallback" role="status">Map tiles are unavailable. Event markers and the list still work.</p>}{selected?<EventCard item={selected} compact onOpen={()=>onOpen(selected)}/>:<p className="map-hint">Tap a numbered marker. Events without coordinates are available in List.</p>}</div>
}
