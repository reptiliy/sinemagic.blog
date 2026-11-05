async function membershipWindow(title, billing=false, articleId, contentKind='статью'){
 const modal=document.querySelector('#reader'),panel=document.querySelector('#panel');
 panel.innerHTML='<section class="pass"><div class="eyebrow">✦　SineMagic Journal</div><h3 id="dialogTitle">Подписка читателя</h3><p class="intro"></p><div class="pass-plan"><small>ЕЖЕМЕСЯЧНЫЙ ДОСТУП</small><div class="currency" aria-label="Валюта тарифа"></div><div class="rate" aria-live="polite"></div><ul><li>Все статьи по подписке</li><li>Полный архив журнала</li></ul></div><p class="terms" role="status"></p><button class="join" disabled></button><button class="assist">Помощь с подпиской</button></section>';
 const box=panel.firstChild,terms=box.querySelector('.terms'),join=box.querySelector('.join');
 box.querySelector('.intro').textContent=title?'Откройте '+contentKind+' «'+title+'» и остальные материалы журнала.':'Читайте закрытые статьи и смотрите видеоуроки.';
 const lessonBenefit=document.createElement('li');lessonBenefit.textContent='Видеоуроки для подписчиков';box.querySelector('ul').append(lessonBenefit);
 box.querySelector('.assist').onclick=()=>{modal.close();if(typeof toggleHelp==='function')toggleHelp(true);else location.assign('/?help=subscription')};
 join.textContent=billing?'Загружаем тариф…':'Оформление скоро откроется';
 if(!modal.open)modal.showModal();
 const configuration=await platformConfig;
 try{
  const quote=await journalApi('/api/exchange');
  const reference=[{currency:'EUR',amount:quote.eurCents/100},{currency:'USD',amount:quote.baseUsdCents/100}];
  const prices=billing?await journalApi('/api/prices'):[];
  const rateNote=document.createElement('p');rateNote.className='exchange-note';
  const source=document.createElement('a');
  source.href='https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html';
  source.target='_blank';source.rel='noopener noreferrer';source.textContent='Курс ЕЦБ';
  const date=new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(quote.date+'T00:00:00Z'));
  rateNote.append('Базовая цена — 5 USD. ',source,' на '+date+': 1 EUR = '+quote.usdPerEur+' USD. Справочный пересчёт.');
  box.querySelector('.rate').after(rateNote);
  let selected;
  const provider=document.createElement('select');
  provider.className='payment-provider';provider.setAttribute('aria-label','Способ оплаты');
  for(const name of ['stripe','paypal']){
   const option=document.createElement('option');option.value=name;option.textContent=name==='paypal'?'PayPal':'Карта · Stripe';provider.append(option);
  }
  provider.value=prices.find(price=>price.provider)?.provider||'stripe';
  box.querySelector('.currency').before(provider);
  function paymentTerms(){
   const name=provider.value==='paypal'?'PayPal':'Stripe';
   terms.textContent=selected.available?'Ежемесячная подписка с автопродлением. Цена фиксируется при оформлении. Оплата через '+name+'.':configuration.providers?.[provider.value]?'Тариф выбранного сервиса обновляется. Оплата временно недоступна.':'Предварительная цена. '+name+' пока не подключён.';
   join.disabled=!selected.available;
   join.textContent=selected.available?(sessionStorage.getItem(tokenKey)?'Оформить подписку →':'Войти и оформить подписку →'):'Оформление скоро откроется';
  }
  function select(price){
   const actual=prices.find(item=>item.currency===price.currency&&item.provider===provider.value);
   const converted=reference.find(item=>item.currency===price.currency);
   selected={...converted,provider:provider.value,available:Boolean(actual&&configuration.providers?.[provider.value]&&Math.round(actual.amount*100)===Math.round(converted.amount*100))};
   box.querySelector('.rate').textContent=new Intl.NumberFormat('ru',{style:'currency',currency:selected.currency,maximumFractionDigits:2,minimumFractionDigits:2}).format(selected.amount)+' / месяц';
   for(const b of box.querySelectorAll('.currency button'))b.setAttribute('aria-pressed',String(b.textContent===selected.currency));
   paymentTerms();
  }
  for(const currency of ['EUR','USD']){const b=document.createElement('button');b.textContent=currency;b.onclick=()=>select({currency});box.querySelector('.currency').append(b)}
  provider.onchange=()=>select(selected);
  select({currency:'EUR'});
  if(billing){
   join.onclick=async()=>{if(!selected.available)return;if(!sessionStorage.getItem(tokenKey)){modal.close();account();return}join.disabled=true;try{const session=await journalApi('/api/checkout','POST',{currency:selected.currency,provider:selected.provider,articleId});location.assign(session.url)}catch(err){terms.textContent=err.message;join.disabled=false}};
  }
 }catch(err){terms.textContent=err.message;join.textContent='Тариф недоступен'}
}
const subscriptionDialog=document.querySelector("#reader");
subscriptionDialog.addEventListener("click",event=>{if(event.target!==subscriptionDialog)return;const rect=subscriptionDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)subscriptionDialog.close()});
