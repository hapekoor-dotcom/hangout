import {useMemo} from 'react'
import {sanitizeDescription} from '@/lib/content/sanitizeDescription'
export function RichEventDescription({source}:{source:string}){const html=useMemo(()=>sanitizeDescription(source),[source]);return <div className="rich-event-description" dangerouslySetInnerHTML={{__html:html}}/>}
