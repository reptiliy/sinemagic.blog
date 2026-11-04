platformConfig.then(async config=>{
 if(!config.connected)return;
 const element=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node};
 async function subscribe(){
  panel.replaceChildren(element('h3','Доступ к журналу'),element('p','Все закрытые статьи и архив журнала.'));
  panel.firstChild.id='dialogTitle';
  if(!modal.open)modal.showModal();
  if(config.billing){
   try{
    const prices=await journalApi('/api/prices');
    for(const price of prices){
     const b=element('button',new Intl.NumberFormat('ru',{style:'currency',currency:price.currency}).format(price.amount)+' / месяц');
     b.onclick=async()=>{if(!sessionStorage.getItem(tokenKey)){modal.close();account();return}b.disabled=true;try{const session=await journalApi('/api/checkout','POST',{currency:price.currency});location.assign(session.url)}catch(err){panel.append(element('p',err.message));b.disabled=false}};
     panel.append(b);
    }
   }catch(err){panel.append(element('p',err.message))}
  }else panel.append(element('p','Приём платежей пока закрыт. Пример тарифа — 5 $ или 5 € в месяц.'));
  const help=element('button','Помощь с оплатой');help.onclick=()=>{modal.close();toggleHelp(true)};panel.append(help);
 }
 async function open(row){
  if(!row)return;
  try{const result=await journalApi('/api/read/'+row.id);displayArticle({t:row.title,o:true,body:result.body});panel.lastChild.style.whiteSpace='pre-line';
   if(row.id===grokId){const img=document.createElement('img');img.src='/grok-watermark.png';img.alt='Маркировка текста';img.style.width='100%';panel.insertBefore(img,panel.lastChild);const source=element('a','Документация Grok ↗');source.href='https://docs.x.ai/developers/advanced-api-usage/watermarking';source.style.color='var(--orange)';panel.append(source)}}
  catch(err){if(row.paid)await subscribe();else show(err.message)}
 }
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
   const b=element('button',row.paid?'Открыть по подписке →':'Читать статью →');b.className='link';b.onclick=()=>open(row);
   card.append(cover,element('span',row.category==='practice'?'Практика':'Разбор'),element('h3',row.title),element('p',row.summary),b);grid.append(card);
  }
 };
 document.querySelector('#subscribe').onclick=subscribe;document.querySelector('#search').oninput=render;
 const originalMove=move;move=n=>{if(free.length)originalMove(n)};
 free.length=0;hero.style.display='none';render();
 try{rows=await journalApi('/api/articles');render();free.push(...rows.filter(r=>!r.paid).map(r=>({...r,t:r.title})));if(free.length){hero.style.display='';slide=0;paint();read.onclick=()=>open(free[slide])}}
 catch(err){document.querySelector('#empty').textContent=err.message}
});
