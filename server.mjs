import http from 'node:http';
import {handler} from './journal-handler.mjs';
export default http.createServer(handler).listen(Number(process.env.PORT||4173),'127.0.0.1');
