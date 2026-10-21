import React, {lazy,Suspense} from 'react'
import { createRoot } from 'react-dom/client'
import HeroSection from './components/hero-section-four'
import './styles.css'
const Discovery=lazy(()=>import('./pages/discovery'))
const discovery=new URLSearchParams(location.search).get('app')!=='about'
if(discovery)document.title='hangout — Find something to do'
createRoot(document.getElementById('root')!).render(<React.StrictMode><Suspense fallback={<p style={{padding:24}}>Opening hangout…</p>}>{discovery?<Discovery/>:<HeroSection/>}</Suspense></React.StrictMode>)
