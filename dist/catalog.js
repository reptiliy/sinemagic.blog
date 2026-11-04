platformConfig.then(async config=>{
 if(new URLSearchParams(location.search).get('subscribe')==='1')membershipWindow(null,config.billing);
 if(!config.connected)return;
 const element=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node};
 const subscribe=title=>membershipWindow(title,config.billing);
 function open(row){if(row)location.assign('/articles/'+row.id)}
 let rows=[];
 const grokId='1a32f300-772e-4b93-b088-d87cff332168';
 const coverStyle='linear-gradient(0deg,#090c12df,transparent),url(/grok-watermark.png) center/cover';
 const originalPaint=paint;
 paint=()=>{originalPaint();hero.style.background=free[slide]?.id===grokId?coverStyle:''};
 render=function(){
  const q=document.querySelector('#search').value.trim().toLowerCase();
  const listed=rows.filter(r=>(filter==='all'||filter===r.category)&&(r.title+' '+r.summary).toLowerCase().includes(q));
  grid.replaceChildren();document.querySelector('#empty').hidden=Boolean(listed.length);
  for(const row of listed){
   const card=element('article','');card.className='card'+(row.paid?' locked':'');
   const cover=element('div','');cover.className='cover';
   if(row.id===grokId)cover.style.background=coverStyle;
   const b=element('a',row.paid?'Открыть по подписке →':'Читать статью →');b.className='link';b.href='/articles/'+row.id;
   if(row.paid&&!sessionStorage.getItem(tokenKey))b.onclick=e=>{e.preventDefault();subscribe(row.title)};
   card.append(cover,element('span',row.category==='practice'?'Практика':'Разбор'),element('h3',row.title),element('p',row.summary),b);grid.append(card);
  }
 };
 document.querySelector('#subscribe').onclick=()=>subscribe();document.querySelector('#search').oninput=render;
 const originalMove=move;move=n=>{if(free.length)originalMove(n)};
 free.length=0;hero.style.display='none';render();
 try{rows=await journalApi('/api/articles');render();free.push(...rows.filter(r=>!r.paid).map(r=>({...r,t:r.title})));if(free.length){hero.style.display='';slide=0;paint();read.onclick=()=>open(free[slide])}}
 catch(err){document.querySelector('#empty').textContent=err.message}
});
