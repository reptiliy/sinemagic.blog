import {settings,validated,persist} from './branding.mjs';
import {documentBody,checkDocument,prepareUpload,withMedia} from './media.mjs';
const env=process.env;
const configured=()=>Boolean(env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY&&env.SUPABASE_PUBLISHABLE_KEY);
const currencies=['USD','EUR'];
const priceId=c=>env['STRIPE_PRICE_'+c];
class Failure extends Error{constructor(status,message){super(message);this.status=status}}
async function payload(req){
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>250000)throw new Failure(413,'Слишком большой текст');chunks.push(chunk)}
 try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw new Failure(400,'Некорректный запрос')}
}
async function remote(url,options={}){
 const res=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw new Failure(502,'Сервис временно недоступен');
 return res.json();
}
function db(query,options={}){
 return remote(env.SUPABASE_URL+'/rest/v1/journal_articles?'+query,{...options,headers:{apikey:env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',Prefer:'return=representation'}});
}
async function identity(req){
 const token=req.headers.authorization;
 if(!token?.startsWith('Bearer '))throw new Failure(401,'Сначала войдите в аккаунт');
 const r=await fetch(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:token},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Failure(401,'Войдите в аккаунт ещё раз');
 return r.json();
}
function stripe(path,params,key){
 const headers={Authorization:'Bearer '+env.STRIPE_SECRET_KEY};
 if(key)headers['Idempotency-Key']=key;
 return remote('https://api.stripe.com/v1/'+path,params?{method:'POST',headers,body:new URLSearchParams(params)}:{headers});
}
async function subscription(user){
 if(!env.STRIPE_SECRET_KEY)return false;
 const search=new URLSearchParams({query:"status:'active' AND metadata['journal_user']:'"+user.id+"'",limit:'100'});
 const result=await stripe('subscriptions/search?'+search);
 for(const match of result.data){
  const live=await stripe('subscriptions/'+encodeURIComponent(match.id)+'?expand[]=latest_invoice');
  if(live.metadata.journal_user===user.id&&live.status==='active'&&live.latest_invoice?.status==='paid'&&live.items.data.some(i=>currencies.some(c=>priceId(c)===i.price.id)))return true;
 }
 return false;
}
async function route(req,path){
 if(path==='/api/config')return {connected:configured(),url:env.SUPABASE_URL,key:env.SUPABASE_PUBLISHABLE_KEY,billing:Boolean(env.STRIPE_SECRET_KEY&&env.SITE_URL&&currencies.every(priceId))};
 if(!configured())throw new Failure(503,'Подключите проект Supabase');
 if(path==='/api/prices'){
  return Promise.all(currencies.map(async currency=>{
   const p=await stripe('prices/'+encodeURIComponent(priceId(currency)));
   if(!p.active||p.currency!==currency.toLowerCase()||p.recurring?.interval!=='month'||p.recurring.interval_count!==1||!Number.isInteger(p.unit_amount))throw new Failure(503,'Тариф ещё не настроен');
   return {currency,amount:p.unit_amount/100};
  }));
 }
 const cols='id,title,summary,category,paid,published,created_at';
 if(path==='/api/articles'&&req.method==='GET'){
  const rows=await db('published=eq.true&order=created_at.desc&select='+cols+',body');
  return rows.map(({body,...row})=>{
   const doc=documentBody(body);
   return {...row,cover:doc?.cover||'',coverPosition:doc?.coverPosition||'center'};
  });
 }
 if(/^\/api\/read\/[a-f0-9-]{36}$/.test(path)&&req.method==='GET'){
  const [article]=await db('id=eq.'+path.split('/').pop()+'&published=eq.true&select=body,paid');
  if(!article)throw new Failure(404,'Статья недоступна');
  if(article.paid){const u=await identity(req);if(u.id!==env.ADMIN_USER_ID&&!await subscription(u))throw new Failure(403,'Требуется подписка')}
  return withMedia(article.body);
 }
 const user=await identity(req);
 if(path==='/api/admin/media'&&req.method==='POST'){
  if(user.id!==env.ADMIN_USER_ID)throw new Failure(403,'Доступ только для редактора');
  try{return await prepareUpload(await payload(req))}catch(error){throw new Failure(400,error.message)}
 }
 if(/^\/api\/admin\/preview\/[a-f0-9-]{36}$/.test(path)&&req.method==='GET'){
  if(user.id!==env.ADMIN_USER_ID)throw new Failure(403,'Доступ только для редактора');
  const [row]=await db('id=eq.'+path.split('/').pop()+'&select=body');
  if(!row)throw new Failure(404,'Материал не найден');
  return withMedia(row.body);
 }
 if(path==='/api/admin/settings'){
  if(user.id!==env.ADMIN_USER_ID)throw new Failure(403,'Доступ только для редактора');
  if(req.method==='GET')return settings();
  if(req.method==='POST'){
   const input=await payload(req);let value;
   try{value=validated(input)}catch{throw new Failure(400,'Проверьте название, длину текста и размер изображений')}
   await persist(value);return settings();
  }
 }
 if(path==='/api/admin/overview'&&req.method==='GET'){
  if(user.id!==env.ADMIN_USER_ID)throw new Failure(403,'Доступ только для редактора');
  const readers=[];
  for(let page=1;;page++){
   const result=await remote(env.SUPABASE_URL+'/auth/v1/admin/users?page='+page+'&per_page=200',{headers:{apikey:env.SUPABASE_SECRET_KEY}});
   readers.push(...result.users.map(u=>({id:u.id,email:u.email,joined:u.created_at})));
   if(result.users.length<200)break;
  }
  const payments=[],active=new Set();
  async function scan(resource,visit){
   let cursor='';
   do{
    const result=await stripe(resource+'&limit=100'+(cursor?'&starting_after='+encodeURIComponent(cursor):''));
    result.data.forEach(visit);
    cursor=result.has_more?result.data.at(-1).id:'';
   }while(cursor);
  }
  let billing='off';
  if(env.STRIPE_SECRET_KEY){
   try{
    await Promise.all([
     scan('subscriptions?status=active',s=>{if(s.metadata?.journal_user&&s.items.data.some(i=>currencies.some(c=>priceId(c)===i.price.id)))active.add(s.metadata.journal_user)}),
     scan('invoices?status=paid',i=>{
      const uid=(i.parent?.subscription_details||i.subscription_details)?.metadata?.journal_user;
      const time=i.status_transitions?.paid_at*1000;
      if(uid&&i.amount_paid>0&&time>=Date.now()-30*86400000)payments.push({id:i.id,uid,time,amount:i.amount_paid,currency:i.currency.toUpperCase()});
     })
    ]);billing='ready';
   }catch{billing='error'}
  }
  return {readers,billing,active:billing==='ready'?[...active]:[],payments:billing==='ready'?payments.sort((a,b)=>b.time-a.time):[]};
 }
 if(path==='/api/admin'){
  if(user.id!==env.ADMIN_USER_ID)throw new Failure(403,'Доступ только для редактора');
  if(req.method==='GET')return db('select=*&order=created_at.desc');
  if(req.method==='POST'){
   const input=await payload(req);
   const {title,body,summary,category,paid,published,id}=input;
   if(typeof title!=='string'||!title.trim()||title.length>200||typeof body!=='string'||!body.trim()||typeof summary!=='string'||!['practice','analysis'].includes(category)||typeof paid!=='boolean'||typeof published!=='boolean'||(id&&!/^[a-f0-9-]{36}$/.test(id)))throw new Failure(400,'Проверьте поля материала');
   try{checkDocument(body)}catch(error){throw new Failure(400,error.message)}
   const [row]=await db(id?'id=eq.'+id:'',{method:id?'PATCH':'POST',body:JSON.stringify({title,body,summary,category,paid,published})});
   if(!row)throw new Failure(404,'Материал не найден');return row;
  }
 }
 if(path==='/api/checkout'&&req.method==='POST'){
  const {currency}=await payload(req);
  if(!currencies.includes(currency)||!priceId(currency)||!env.STRIPE_SECRET_KEY||!env.SITE_URL)throw new Failure(503,'Оплата пока недоступна');
  if(await subscription(user))throw new Failure(409,'Подписка уже действует');
  const origin=new URL(env.SITE_URL).origin;
  const session=await stripe('checkout/sessions',{mode:'subscription','line_items[0][price]':priceId(currency),'line_items[0][quantity]':'1','subscription_data[metadata][journal_user]':user.id,customer_email:user.email,success_url:origin+'/?payment=return',cancel_url:origin+'/'},'journal-'+user.id+'-'+currency+'-'+Math.floor(Date.now()/86400000));
  return {url:session.url};
 }
 throw new Failure(404,'Не найдено');
}
export async function platform(req,res,path){
 try{const value=await route(req,path);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(value))}
 catch(e){res.writeHead(e.status||503,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:e instanceof Failure?e.message:'Сервис недоступен'}))}
}
