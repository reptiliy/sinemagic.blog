async function membershipWindow(title, billing=false, articleId){
 const modal=document.querySelector('#reader'),panel=document.querySelector('#panel');
 panel.innerHTML='<section class="pass"><div class="eyebrow">✦　SineMagic Journal</div><h3 id="dialogTitle">Подписка читателя</h3><p class="intro"></p><div class="pass-plan"><small>ЕЖЕМЕСЯЧНЫЙ ДОСТУП</small><div class="currency" aria-label="Валюта тарифа"></div><div class="rate" aria-live="polite"></div><ul><li>Все статьи по подписке</li><li>Полный архив журнала</li></ul></div><p class="terms" role="status"></p><button class="join" disabled></button><button class="assist">Помощь с подпиской</button></section>';
 const box=panel.firstChild,terms=box.querySelector('.terms'),join=box.querySelector('.join');
 box.querySelector('.intro').textContent=title?'Откройте статью «'+title+'» и остальные материалы журнала.':'Читайте закрытые разборы и практикумы журнала.';
 box.querySelector('.assist').onclick=()=>{modal.close();if(typeof toggleHelp==='function')toggleHelp(true);else location.assign('/?help=subscription')};
 join.textContent=billing?'Загружаем тариф…':'Оформление скоро откроется';
 if(!modal.open)modal.showModal();
 try{
  const prices=billing?await journalApi('/api/prices'):[{currency:'EUR',amount:5},{currency:'USD',amount:5}];
  if(!prices.length)throw Error('Тариф пока недоступен.');
  let selected;
  const provider=document.createElement('select');
  provider.hidden=!billing;
  provider.className='payment-provider';provider.setAttribute('aria-label','Способ оплаты');
  for(const name of new Set(prices.map(price=>price.provider||'stripe'))){
   const option=document.createElement('option');option.value=name;option.textContent=name==='paypal'?'PayPal':'Карта · Stripe';provider.append(option);
  }
  box.querySelector('.currency').before(provider);
  function paymentTerms(){
   terms.textContent=billing?'Ежемесячная подписка с автопродлением. Оплата через '+(selected.provider==='paypal'?'PayPal':'Stripe')+'.':'Предварительная цена. Приём платежей пока закрыт.';
  }
  function select(price){
   selected=prices.find(item=>item.currency===price.currency&&(item.provider||'stripe')===provider.value)||prices.find(item=>(item.provider||'stripe')===provider.value);
   box.querySelector('.rate').textContent=new Intl.NumberFormat('ru',{style:'currency',currency:selected.currency,maximumFractionDigits:2,minimumFractionDigits:0}).format(selected.amount)+' / месяц';
   for(const b of box.querySelectorAll('.currency button'))b.setAttribute('aria-pressed',String(b.textContent===selected.currency));
   paymentTerms();
  }
  for(const currency of new Set(prices.map(price=>price.currency))){const b=document.createElement('button');b.textContent=currency;b.onclick=()=>select({currency});box.querySelector('.currency').append(b)}
  provider.onchange=()=>select(selected);
  select(prices.find(p=>p.currency==='EUR')||prices[0]);
  if(billing){
   join.disabled=false;join.textContent=sessionStorage.getItem(tokenKey)?'Оформить подписку →':'Войти и оформить подписку →';
   join.onclick=async()=>{if(!sessionStorage.getItem(tokenKey)){modal.close();account();return}join.disabled=true;try{const session=await journalApi('/api/checkout','POST',{currency:selected.currency,provider:selected.provider||'stripe',articleId});location.assign(session.url)}catch(err){terms.textContent=err.message;join.disabled=false}};
  }
 }catch(err){terms.textContent=err.message;join.textContent='Тариф недоступен'}
}
const subscriptionDialog=document.querySelector("#reader");
subscriptionDialog.addEventListener("click",event=>{if(event.target!==subscriptionDialog)return;const rect=subscriptionDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)subscriptionDialog.close()});
