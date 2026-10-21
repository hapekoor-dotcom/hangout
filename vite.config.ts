import {buildEventSnapshot} from './src/lib/events/aggregate.ts'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({base:'./',server:{proxy:{'/api':'http://127.0.0.1:8787'}},plugins:[react(),tailwindcss(),{name:'fienta-ingestion',async generateBundle(){const snapshot=await buildEventSnapshot();console.info('Fienta snapshot:',snapshot.events.length,snapshot.mode,snapshot.failures);this.emitFile({type:'asset',fileName:'fienta-events.json',source:JSON.stringify(snapshot)})}}],resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}}})
