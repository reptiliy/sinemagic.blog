const hero=document.querySelector('.visual'), modal=document.querySelector('#reader'),panel=document.querySelector('#panel');
const free=data.filter(x=>x.o);let slide=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
function displayArticle(x){
 if(!x?.o)return membershipWindow(x?.t);
 location.assign('/articles/'+encodeURIComponent(x.id));
}
async function membershipWindow(title, billing=false){
 panel.innerHTML='<section class="pass"><div class="eyebrow">✦　SineMagic Journal</div><h3 id="dialogTitle">Подписка читателя</h3><p class="intro"></p><div class="pass-plan"><small>ЕЖЕМЕСЯЧНЫЙ ДОСТУП</small><div class="currency" aria-label="Валюта тарифа"></div><div class="rate" aria-live="polite"></div><ul><li>Все статьи по подписке</li><li>Полный архив журнала</li></ul></div><p class="terms" role="status"></p><button class="join" disabled></button><button class="assist">Помощь с подпиской</button></section>';
 const box=panel.firstChild,terms=box.querySelector('.terms'),join=box.querySelector('.join');
 box.querySelector('.intro').textContent=title?'Откройте статью «'+title+'» и остальные материалы журнала.':'Читайте закрытые разборы и практикумы журнала.';
 box.querySelector('.assist').onclick=()=>{modal.close();toggleHelp(true)};
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
modal.onclick=e=>{if(e.target===modal&&!panel.contains(e.target)){const b=modal.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)modal.close()}};
hero.setAttribute('aria-label','Слайд-шоу открытых статей');
hero.innerHTML='<p class="eyebrow">✦ Открытая статья</p><p class="count"></p><h3></h3><div class="rail"><button>Читать →</button><button aria-label="Предыдущая статья">←</button><button class="pause"></button><button aria-label="Следующая статья">→</button></div>';
function paint(){hero.dataset.tone=slide%2;hero.querySelector('h3').textContent=free[slide].t;hero.querySelector('.count').textContent=String(slide+1).padStart(2,'0')+' / '+String(free.length).padStart(2,'0');const b=hero.querySelector('.pause');b.textContent=paused?'▶':'Ⅱ';b.setAttribute('aria-label',paused?'Продолжить показ':'Приостановить показ')}
function move(n){slide=(slide+n+free.length)%free.length;paint()}
const [read,prev,pause,next]=hero.querySelectorAll('button');read.onclick=()=>displayArticle(free[slide]);prev.onclick=()=>move(-1);next.onclick=()=>move(1);pause.onclick=()=>{paused=!paused;paint()};paint();
setInterval(()=>{if(!paused&&!document.hidden&&!modal.open&&!hero.matches(':hover,:focus-within'))move(1)},6500);
const baseRender=render;render=function(){baseRender();grid.querySelectorAll('.link').forEach(link=>{const x=data.find(a=>a.t===link.closest('article').querySelector('h3').textContent);const b=document.createElement('button');b.className='link';b.textContent=link.textContent;b.onclick=()=>displayArticle(x);link.replaceWith(b)})};document.querySelector('#search').oninput=render;render();document.querySelector('#subscribe').onclick=()=>displayArticle(null);
