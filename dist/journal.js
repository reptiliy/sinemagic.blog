// Открытые публикации имеют o:1. Закрытые тексты на клиент не отправляем.
data[0].body='Когда музыка обрывается, зритель начинает слушать комнату. Шорох одежды и вдох перед репликой вдруг сообщают больше, чем сама реплика. Попробуйте задержать склейку на один вдох: смысл сместится со сказанных слов на человека, который их услышал.';
data.push({t:'Что рассказывает тень за окном',k:'practice',l:'Практика',d:'18 ОКТЯБРЯ 2026',p:'Небольшой этюд о свете из одного окна.',o:1,body:'Поставьте чашку на стол у окна. В полдень короткая тень почти сливается с донышком; к вечеру она пересекает стол как стрелка. Снимите оба кадра с одной точки. Без часов и пояснений зритель почувствует, что прошло время.'});
const hero=document.querySelector('.visual'), modal=document.querySelector('#reader'),panel=document.querySelector('#panel');
const free=data.filter(x=>x.o);let slide=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
function displayArticle(x){
 panel.replaceChildren();
 function line(tag,value,cls){const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;panel.append(e);return e}
 line('div',x?.o?'Свободное чтение':'SineMagic / Подписка','eyebrow');
 line('h3',x?.o?x.t:'Доступ к журналу').id='dialogTitle';
 if(x?.o)line('p',x.body);
 else{
  if(x)line('p','Вы выбрали: «'+x.t+'»');
  line('div','Подписка читателя · Все закрытые статьи и архив журнала','plan');
  line('p','Пример цены за месяц');
  line('strong','5,00 USD ($)  /  5,00 EUR (€)');
  line('p','Приём платежей пока не открыт.');
  line('button','Перейти к оплате','pay').disabled=true
  line('button','Помощь с оплатой').onclick=()=>{modal.close();toggleHelp(true);answer('Не получается оплатить подписку')};
 }
 modal.showModal()
}
modal.onclick=e=>{if(e.target===modal&&!panel.contains(e.target)){const b=modal.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)modal.close()}};
hero.setAttribute('aria-label','Слайд-шоу открытых статей');
hero.innerHTML='<p class="eyebrow">✦ Открытая статья</p><p class="count"></p><h3></h3><div class="rail"><button>Читать →</button><button aria-label="Предыдущая статья">←</button><button class="pause"></button><button aria-label="Следующая статья">→</button></div>';
function paint(){hero.dataset.tone=slide%2;hero.querySelector('h3').textContent=free[slide].t;hero.querySelector('.count').textContent=String(slide+1).padStart(2,'0')+' / '+String(free.length).padStart(2,'0');const b=hero.querySelector('.pause');b.textContent=paused?'▶':'Ⅱ';b.setAttribute('aria-label',paused?'Продолжить показ':'Приостановить показ')}
function move(n){slide=(slide+n+free.length)%free.length;paint()}
const [read,prev,pause,next]=hero.querySelectorAll('button');read.onclick=()=>displayArticle(free[slide]);prev.onclick=()=>move(-1);next.onclick=()=>move(1);pause.onclick=()=>{paused=!paused;paint()};paint();
setInterval(()=>{if(!paused&&!document.hidden&&!modal.open&&!hero.matches(':hover,:focus-within'))move(1)},6500);
const baseRender=render;render=function(){baseRender();grid.querySelectorAll('.link').forEach(link=>{const x=data.find(a=>a.t===link.closest('article').querySelector('h3').textContent);const b=document.createElement('button');b.className='link';b.textContent=link.textContent;b.onclick=()=>displayArticle(x);link.replaceWith(b)})};document.querySelector('#search').oninput=render;render();document.querySelector('#subscribe').onclick=()=>displayArticle(null);
