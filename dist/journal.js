const hero=document.querySelector('.visual'), modal=document.querySelector('#reader'),panel=document.querySelector('#panel');
const free=data.filter(x=>x.o);let slide=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
function displayArticle(x){
 if(!x?.o)return membershipWindow(x?.t);
 location.assign('/articles/'+encodeURIComponent(x.id));
}
hero.setAttribute('aria-label','Слайд-шоу открытых статей');
hero.innerHTML='<p class="eyebrow">✦ Открытая статья</p><p class="count"></p><h3></h3><div class="rail"><button>Читать →</button><button aria-label="Предыдущая статья">←</button><button class="pause"></button><button aria-label="Следующая статья">→</button></div>';
function paint(){hero.dataset.tone=slide%2;hero.style.background='linear-gradient(0deg,#090c12ef,transparent),url(/default-news.png) center/cover';hero.querySelector('h3').textContent=free[slide].t;hero.querySelector('.count').textContent=String(slide+1).padStart(2,'0')+' / '+String(free.length).padStart(2,'0');const b=hero.querySelector('.pause');b.textContent=paused?'▶':'Ⅱ';b.setAttribute('aria-label',paused?'Продолжить показ':'Приостановить показ')}
function move(n){slide=(slide+n+free.length)%free.length;paint()}
const [read,prev,pause,next]=hero.querySelectorAll('button');read.onclick=()=>displayArticle(free[slide]);prev.onclick=()=>move(-1);next.onclick=()=>move(1);pause.onclick=()=>{paused=!paused;paint()};paint();
setInterval(()=>{if(!paused&&!document.hidden&&!modal.open&&!hero.matches(':hover,:focus-within'))move(1)},6500);
const baseRender=render;render=function(){baseRender();grid.querySelectorAll('.link').forEach(link=>{const x=data.find(a=>a.t===link.closest('article').querySelector('h3').textContent);const b=document.createElement('button');b.className='link';b.textContent=link.textContent;b.onclick=()=>displayArticle(x);link.replaceWith(b)})};document.querySelector('#search').oninput=render;render();document.querySelector('#subscribe').onclick=()=>displayArticle(null);
