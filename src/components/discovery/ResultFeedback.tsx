import {useState} from 'react'
import {aiConfigured,feedbackAPI} from '@/lib/search/api'
export function ResultFeedback({eventId,query}:{eventId:string;query:string}){
 const [state,setState]=useState<'idle'|'reason'|'saving'|'saved'|'error'>('idle')
 if(!aiConfigured)return null
 const save=async(verdict:'good'|'not_for_me',reason?:string)=>{setState('saving');try{await feedbackAPI(eventId,query,verdict,reason);setState('saved')}catch{setState('error')}}
 return <div className="result-feedback">{state==='saved'?<p role="status">Thanks, feedback saved.</p>:state==='saving'?<p role="status">Saving…</p>:state==='reason'?<><p>What didn’t fit?</p><div>{[['too_far','Too far'],['too_expensive','Too expensive'],['wrong_vibe','Wrong vibe'],['wrong_type','Wrong type'],['not_what_i_asked','Not what I asked for']].map(([value,label])=><button key={value} onClick={()=>save('not_for_me',value)}>{label}</button>)}<button onClick={()=>save('not_for_me')}>Skip reason</button></div></>:<><button onClick={()=>save('good')}>Good suggestion</button><button onClick={()=>setState('reason')}>Not for me</button>{state==='error'&&<p role="alert">Couldn’t save feedback. Please try again.</p>}</>}</div>
}
