import {createClient} from '@supabase/supabase-js';
import Stripe from 'stripe';
import {randomUUID} from 'node:crypto';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const env=process.env;
const client=()=>createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const stripe=()=>new Stripe(env.STRIPE_SECRET_KEY);
export function billingConfiguration(){
 return {
  stripe:Boolean(env.STRIPE_SECRET_KEY&&env.STRIPE_WEBHOOK_SECRET&&env.STRIPE_PRICE_USD&&env.STRIPE_PRICE_EUR&&env.SITE_URL),
  paypal:Boolean(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET&&env.PAYPAL_WEBHOOK_ID&&env.PAYPAL_PLAN_USD&&env.PAYPAL_PLAN_EUR&&env.SITE_URL),
  paypalMode:env.PAYPAL_MODE==='live'?'live':'sandbox'
 };
}
function paypalOrigin(){return env.PAYPAL_MODE==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com'}
export function moneyCents(value){
 if(typeof value!=='string'||!/^\d+(\.\d{1,2})?$/.test(value))throw Error('Неверная сумма');
 const [whole,fraction='']=value.split('.');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents))throw Error('Неверная сумма');
 return cents;
}
async function paypal(path,method='GET',body){
 const response=await fetch(paypalOrigin()+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(env.PAYPAL_CLIENT_ID+':'+env.PAYPAL_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('PayPal временно недоступен');
 const token=(await response.json()).access_token;
 const result=await fetch(paypalOrigin()+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','PayPal-Request-Id':randomUUID()},body:body&&JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!result.ok)throw Error('PayPal временно недоступен');
 return result.json();
}
export async function paypalPrices(){
 if(!billingConfiguration().paypal)return [];
 return Promise.all(['EUR','USD'].map(async currency=>{
  const plan=await paypal('/v1/billing/plans/'+encodeURIComponent(env['PAYPAL_PLAN_'+currency]));
  const cycle=plan.billing_cycles?.find(c=>c.tenure_type==='REGULAR');
  const price=cycle?.pricing_scheme?.fixed_price;
  if(plan.status!=='ACTIVE'||!cycle||cycle.frequency.interval_unit!=='MONTH'||cycle.frequency.interval_count!==1||price?.currency_code!==currency||moneyCents(price.value)<=0)throw Error('Проверьте месячные тарифы PayPal');
  return {currency,amount:moneyCents(price.value)/100,provider:'paypal'};
 }));
}
export async function paypalCheckout(user,currency,articleId){
 if(!billingConfiguration().paypal||!['USD','EUR'].includes(currency))throw Error('PayPal пока не подключён');
 await paypalPrices();
 const result=await paypal('/v1/billing/subscriptions','POST',{
  plan_id:env['PAYPAL_PLAN_'+currency],
  custom_id:user.id+(articleId?':'+articleId:''),
  application_context:{user_action:'SUBSCRIBE_NOW',return_url:new URL('/?payment=paypal-return',env.SITE_URL).href,cancel_url:new URL('/?payment=cancel',env.SITE_URL).href}
 });
 const link=result.links?.find(link=>link.rel==='approve');
 if(!link||!new URL(link.href).hostname.endsWith('paypal.com'))throw Error('PayPal не вернул страницу оплаты');
 return {url:link.href};
}
async function allRows(table){
 const rows=[];
 for(let page=0;;page++){
  const result=await client().from(table).select(table==='journal_articles'?'id,title':'*').range(page*1000,page*1000+999);
  if(result.error)throw Error('Данные платежей временно недоступны');
  rows.push(...result.data);if(result.data.length<1000)return rows;
 }
}
export async function billingOverview(){
 const [payments,subscriptions,profiles,articles]=await Promise.all(['journal_payments','journal_subscriptions','journal_profiles','journal_articles'].map(table=>allRows(table)));
 return {
  providers:billingConfiguration(),subscriptions,profiles,
  payments:payments.map(p=>({id:p.provider+':'+p.provider_id,uid:p.user_id,time:Date.parse(p.paid_at),amount:p.amount_cents,currency:p.currency,provider:p.provider,method:p.method,mode:p.mode,articleId:p.article_id,subscriptionId:p.subscription_id})).sort((a,b)=>b.time-a.time),
  active:[...new Set(subscriptions.filter(s=>s.mode==='live'&&s.active&&Date.parse(s.expires_at)>Date.now()).map(s=>s.user_id))],
  articles:articles.map(({id,title})=>({id,title}))
 };
}
export async function saveReaderName(userId,name){
 if(!uuid.test(userId)||typeof name!=='string'||name.trim().length>100)throw Error('Проверьте имя');
 const result=await client().from('journal_profiles').upsert({user_id:userId,display_name:name.trim(),updated_at:new Date().toISOString()}).select('user_id,display_name').single();
 if(result.error)throw Error('Не удалось сохранить имя');
 return result.data;
}
export async function hasBillingAccess(userId){
 const result=await client().from('journal_subscriptions').select('provider,mode').eq('user_id',userId).eq('active',true).gt('expires_at',new Date().toISOString());
 if(result.error)throw Error('Проверка подписки временно недоступна');
 return result.data.some(row=>row.provider==='paypal'?row.mode===(env.PAYPAL_MODE==='live'?'live':'test'):row.mode===(env.STRIPE_SECRET_KEY?.startsWith('sk_test_')?'test':'live'));
}
export async function applyBillingEvent(provider,eventId,subscription,payment){
 const result=await client().rpc('journal_billing_event',{provider_name:provider,event_key:eventId,subscription_data:subscription,payment_data:payment});
 if(result.error)throw Error('Не удалось сохранить подтверждённый платёж');
 return result.data;
}
function validArticle(value){return uuid.test(value||'')?value:null}
async function stripeEvent(event){
 const object=event.data.object;
 if(!event.type.startsWith('customer.subscription.')&&!['invoice.paid','invoice.payment_failed'].includes(event.type))return;
 const subId=event.type.startsWith('customer.subscription.')?object.id:object.parent?.subscription_details?.subscription||object.subscription;
 if(typeof subId!=='string')return;
 const subscription=await stripe().subscriptions.retrieve(subId,{expand:['latest_invoice','default_payment_method']});
 const userId=subscription.metadata.journal_user;
 if(!uuid.test(userId||''))return;
 const allowed=subscription.items.data.filter(item=>[env.STRIPE_PRICE_USD,env.STRIPE_PRICE_EUR].includes(item.price.id));
 if(!allowed.length)return;
 const expires=Math.min(...allowed.map(item=>item.current_period_end||subscription.current_period_end||0));
 const paid=subscription.latest_invoice?.status==='paid';
 const articleId=validArticle(subscription.metadata.article_id);
 const state={id:subscription.id,user_id:userId,article_id:articleId,status:subscription.status,active:subscription.status==='active'&&paid&&expires*1000>Date.now(),expires_at:expires?new Date(expires*1000).toISOString():null,renews:!subscription.cancel_at_period_end,event_at:new Date(event.created*1000).toISOString()};
 let payment=null;
 if(event.type==='invoice.paid'&&object.status==='paid'&&['usd','eur'].includes(object.currency)&&object.amount_paid>0){
  let method='Способ не передан Stripe';
  try{
   const invoicePayments=await stripe().invoicePayments.list({invoice:object.id,status:'paid',limit:100});
   const methods=[];
   for(const entry of invoicePayments.data){
    if(entry.payment?.type!=='payment_intent')continue;
    const intent=await stripe().paymentIntents.retrieve(entry.payment.payment_intent,{expand:['payment_method','latest_charge']});
    const details=intent.latest_charge?.payment_method_details;
    if(details?.card?.wallet?.type)methods.push(details.card.wallet.type);
    else if(details?.type)methods.push(details.type);
   }
   if(methods.length)method=[...new Set(methods)].join(', ');
  }catch{}
  payment={id:object.id,user_id:userId,article_id:articleId,subscription_id:subscription.id,amount_cents:object.amount_paid,currency:object.currency.toUpperCase(),method,paid_at:new Date(object.status_transitions.paid_at*1000).toISOString()};
 }
 state.mode=event.livemode?'live':'test';
 if(payment)payment.mode=state.mode;
 await applyBillingEvent('stripe',event.id,state,payment);
}
async function paypalEvent(event){
 const resource=event.resource;
 const id=event.event_type.startsWith('BILLING.SUBSCRIPTION.')?resource.id:resource.billing_agreement_id;
 if(!id)return;
 const subscription=await paypal('/v1/billing/subscriptions/'+encodeURIComponent(id));
 const [userId,article]=String(subscription.custom_id||'').split(':');
 if(!uuid.test(userId))return;
 if(![env.PAYPAL_PLAN_USD,env.PAYPAL_PLAN_EUR].includes(subscription.plan_id))return;
 const end=subscription.billing_info?.next_billing_time;
 const hasPayment=Number(subscription.billing_info?.last_payment?.amount?.value)>0;
 const state={id,user_id:userId,article_id:validArticle(article),status:subscription.status,active:subscription.status==='ACTIVE'&&hasPayment&&Date.parse(end)>Date.now(),expires_at:end||null,renews:subscription.status==='ACTIVE',event_at:event.create_time};
 let payment=null;
 if(event.event_type==='PAYMENT.SALE.COMPLETED'&&resource.state==='completed'&&['USD','EUR'].includes(resource.amount?.currency)){
  const amount=resource.amount.total;
  payment={id:resource.id,user_id:userId,article_id:state.article_id,subscription_id:id,amount_cents:moneyCents(amount),currency:resource.amount.currency,method:'PayPal',paid_at:resource.create_time};
 }
 state.mode=env.PAYPAL_MODE==='live'?'live':'test';
 if(payment)payment.mode=state.mode;
 await applyBillingEvent('paypal',event.id,state,payment);
}
export async function handleBillingWebhook(req,res,provider){
 try{
  if(req.method!=='POST'){res.writeHead(405).end();return}
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>1048576){res.writeHead(413).end();return}chunks.push(chunk)}
  const raw=Buffer.concat(chunks);
  let event;
  if(provider==='stripe'){
   if(!env.STRIPE_WEBHOOK_SECRET||!env.STRIPE_SECRET_KEY){res.writeHead(503).end();return}
   try{event=stripe().webhooks.constructEvent(raw,req.headers['stripe-signature'],env.STRIPE_WEBHOOK_SECRET)}catch{res.writeHead(400).end();return}
   await stripeEvent(event);
  }else{
   if(!billingConfiguration().paypal){res.writeHead(503).end();return}
   try{event=JSON.parse(raw.toString())}catch{res.writeHead(400).end();return}
   const verified=await paypal('/v1/notifications/verify-webhook-signature','POST',{
    auth_algo:req.headers['paypal-auth-algo'],cert_url:req.headers['paypal-cert-url'],
    transmission_id:req.headers['paypal-transmission-id'],transmission_sig:req.headers['paypal-transmission-sig'],
    transmission_time:req.headers['paypal-transmission-time'],webhook_id:env.PAYPAL_WEBHOOK_ID,webhook_event:event
   });
   if(verified.verification_status!=='SUCCESS'){res.writeHead(400).end();return}
   await paypalEvent(event);
  }
  res.writeHead(200,{'Content-Type':'application/json'}).end('{"received":true}');
 }catch{res.writeHead(503).end()}
}
