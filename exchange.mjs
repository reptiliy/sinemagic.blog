const source='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
let cached,pending;
export function parseExchange(xml){
 const date=xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/i)?.[1];
 const usd=xml.match(/currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/i)?.[1];
 const rate=Number(usd);
 if(!date||!Number.isFinite(rate)||rate<=0||rate>100)throw Error('Не удалось прочитать курс ЕЦБ');
 if(Date.now()-Date.parse(date+'T00:00:00Z')>8*86400000||Date.parse(date+'T00:00:00Z')>Date.now()+86400000)throw Error('ЕЦБ вернул неактуальную дату курса');
 const euroCents=Math.round(500/rate);
 return {date,usdPerEur:rate,source,baseUsdCents:500,eurCents:euroCents};
}
export async function exchangeQuote(){
 if(cached&&Date.now()-cached.fetchedAt<3600000)return cached.quote;
 if(!pending)pending=(async()=>{
  const response=await fetch(source,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Курс ЕЦБ временно недоступен');
  const quote=parseExchange(await response.text());
  cached={quote,fetchedAt:Date.now()};return quote;
 })().finally(()=>{pending=null});
 return pending;
}
export function quoteCents(quote,currency){
 if(currency==='USD')return quote.baseUsdCents;
 if(currency==='EUR')return quote.eurCents;
 throw Error('Неподдерживаемая валюта');
}
