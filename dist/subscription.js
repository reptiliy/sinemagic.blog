async function membershipWindow(title, billing=false){
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
  function select(price){
   selected=price;
   box.querySelector('.rate').textContent=new Intl.NumberFormat('ru',{style:'currency',currency:price.currency,maximumFractionDigits:2,minimumFractionDigits:0}).format(price.amount)+' / месяц';
   for(const b of box.querySelectorAll('.currency button'))b.setAttribute('aria-pressed',String(b.textContent===price.currency));
  }
  for(const price of prices){const b=document.createElement('button');b.textContent=price.currency;b.onclick=()=>select(price);box.querySelector('.currency').append(b)}
  select(prices.find(p=>p.currency==='EUR')||prices[0]);
  terms.textContent=billing?'Ежемесячная подписка. Оплата на защищённой странице Stripe.':'Предварительная цена. Приём платежей пока закрыт.';
  if(billing){
   join.disabled=false;join.textContent=sessionStorage.getItem(tokenKey)?'Оформить подписку →':'Войти и оформить подписку →';
   join.onclick=async()=>{if(!sessionStorage.getItem(tokenKey)){modal.close();account();return}join.disabled=true;try{const session=await journalApi('/api/checkout','POST',{currency:selected.currency});location.assign(session.url)}catch(err){terms.textContent=err.message;join.disabled=false}};
  }
 }catch(err){terms.textContent=err.message;join.textContent='Тариф недоступен'}
}
const subscriptionDialog=document.querySelector("#reader");
subscriptionDialog.addEventListener("click",event=>{if(event.target!==subscriptionDialog)return;const rect=subscriptionDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)subscriptionDialog.close()});
