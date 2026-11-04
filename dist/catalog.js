platformConfig.then(async config=>{
 if(new URLSearchParams(location.search).get('subscribe')==='1')membershipWindow(null,config.billing);
 if(!config.connected)return;
 const element=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node};
 const subscribe=title=>membershipWindow(title,config.billing);
 function open(row){if(row)location.assign('/articles/'+row.id)}
 let rows=[];
 const grokId='1a32f300-772e-4b93-b088-d87cff332168';
 const originalPaint=paint;
 paint=()=>{
  originalPaint();
  const row=free[slide];
  const source=row?.cover||(row?.id===grokId?'/grok-watermark.png':'/default-news.png');
  hero.style.background='linear-gradient(0deg,#090c12ef,transparent),url('+JSON.stringify(source)+') center/cover';
 };
 render=function(){
  const q=document.querySelector('#search').value.trim().toLowerCase();
  const listed=rows.filter(r=>(filter==='all'||filter===r.category)&&(r.title+' '+r.summary).toLowerCase().includes(q));
  grid.replaceChildren();document.querySelector('#empty').hidden=Boolean(listed.length);
  for(const row of listed){
   const card=element('article','');card.className='card'+(row.paid?' locked':'');
   const cover=element('div','');cover.className='cover';
   const coverUrl=row.cover||(row.id===grokId?'/grok-watermark.png':'/default-news.png');
   if(coverUrl){
    const image=element('img','');image.src=coverUrl;image.alt=row.title;image.loading='lazy';cover.append(image);
    cover.classList.add('has-image');
    image.onerror=()=>{image.onerror=null;image.src='/default-news.png'};
   }
   const b=element('button',row.paid?'Оплатить':'Читать');
   b.type='button';
   b.className='link article-action'+(row.paid?' article-action-paid':'');
   b.setAttribute('aria-label',(row.paid?'Оплатить доступ к статье «':'Читать статью «')+row.title+'»');
   b.onclick=()=>row.paid&&!sessionStorage.getItem(tokenKey)?subscribe(row.title):open(row);
   card.append(cover,element('span',row.category==='practice'?'Практика':'Разбор'),element('h3',row.title),element('p',row.summary),b);grid.append(card);
  }
 };
 document.querySelector('#subscribe').onclick=()=>subscribe();document.querySelector('#search').oninput=render;
 const originalMove=move;move=n=>{if(free.length)originalMove(n)};
 free.length=0;hero.style.display='none';render();
 try{rows=await journalApi('/api/articles');render();free.push(...rows.filter(r=>!r.paid).map(r=>({...r,t:r.title})));if(free.length){hero.style.display='';slide=0;paint();read.onclick=()=>open(free[slide])}}
 catch(err){document.querySelector('#empty').textContent=err.message}
});
