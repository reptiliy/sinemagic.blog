import {settings,branded} from './branding.mjs';
import {platform} from './platform.mjs';
import {billingConfiguration} from './billing.mjs';
import { readFile } from 'node:fs/promises';

const files=new Map(['index.html','styles.css','script.js','journal.css','journal.js','help.js','help.css'].map(name=>['/'+name,name]));
const types={html:'text/html',css:'text/css',js:'text/javascript'};
const billing=billingConfiguration().stripe||billingConfiguration().paypal;
const instructions='Ты помощник SineMagic. Отвечай на языке читателя. Бесплатные статьи открываются в журнале и слайд-шоу. У тебя нет доступа к счетам и транзакциям. Не запрашивай платёжные реквизиты. '+(billing?'Доступные способы оплаты показаны в окне подписки. Нужно войти и выбрать тариф в USD или EUR.':'Приём платежей пока закрыт.');
export async function handler(req,res){
  try{
    if(req.url==='/api/help'&&req.method==='POST'){
      if(!process.env.OPENAI_API_KEY){res.writeHead(503).end();return}
      if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host){res.writeHead(403).end();return}
      let body='';
      for await(const chunk of req){body+=chunk;if(body.length>32000){res.writeHead(413).end();return}}
      const {messages}=JSON.parse(body);
      if(!Array.isArray(messages)||!messages.length||messages.length>9||messages.some(m=>!['user','assistant'].includes(m?.role)||typeof m.content!=='string'||m.content.length>4000)){res.writeHead(400).end();return}
      const upstream=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',messages:[{role:'system',content:instructions},...messages.map(({role,content})=>({role,content}))],max_tokens:450}),signal:AbortSignal.timeout(20000)});
      if(!upstream.ok){res.writeHead(503).end();return}
      res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({answer:(await upstream.json()).choices[0].message.content}));return;
    }
    const path=new URL(req.url,'http://localhost').pathname;
    if(['/favicon.png','/favicon-v2.png','/favicon.ico'].includes(path)&&req.method==='GET'){
      res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'}).end(await readFile(new URL('./dist/favicon-v2.png',import.meta.url)));
      return;
    }
    if(path==='/admin/'&&req.method==='GET'){
      const query=new URL(req.url,'http://localhost').search;
      res.writeHead(308,{'Location':'/admin'+query}).end();
      return;
    }
    if(path==='/default-news.png'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'}).end(await readFile(new URL('./dist/default-news.png',import.meta.url)));return}
    if(path==='/grok-watermark.png'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'image/png'}).end(await readFile(new URL('./dist/grok-watermark.png',import.meta.url)));return}
    if(path.startsWith('/api/'))return platform(req,res,path);
    const extra=['admin.html','admin.css','admin.js','account.js','account.css','catalog.js','overview.js','settings.js','samples.js','article.js','article.css','content.js','composer.js','library.js','subscription.js','management.js','pricing.js','site-menu.js'];
    const file=/^\/articles\/[a-z0-9-]+\/?$/.test(path)?'article.html':path==='/admin'?'admin.html':path==='/'?'index.html':extra.includes(path.slice(1))?path.slice(1):files.get(path);
    if(!file||req.method!=='GET'){res.writeHead(404).end();return}
    const bytes=await readFile(new URL('./dist/'+file,import.meta.url));
    const output=file.endsWith('.html')?branded(bytes.toString(),await settings(),file==='admin.html'):bytes;
    res.writeHead(200,{'Content-Type':types[file.split('.').pop()]+'; charset=utf-8'}).end(output);
  }catch{res.writeHead(400).end()}
}
