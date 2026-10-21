import {createServer} from 'node:http'
import {handler} from './handler.ts'
createServer(handler).listen(Number(process.env.PORT||8787),process.env.API_HOST||'127.0.0.1')
