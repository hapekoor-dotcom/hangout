import {readFile,writeFile,mkdir} from 'node:fs/promises'
import type {EventSnapshot} from './types.ts'
const path=new URL('../../../.cache/fienta-v1.json',import.meta.url)
export async function readCache(){try{return JSON.parse(await readFile(path,'utf8')) as EventSnapshot}catch{return null}}
export async function writeCache(value:EventSnapshot){await mkdir(new URL('.',path),{recursive:true});await writeFile(path,JSON.stringify(value))}
