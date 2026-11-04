async function readPage(){
 const id=location.pathname.split('/').filter(Boolean).pop();
 const prose=document.getElementById('prose'),headline=document.getElementById('headline');
 const sample=data.find(item=>item.id===id&&item.o);
 try{
  const article=sample?{title:sample.t,summary:sample.p,category:sample.k}: (await journalApi('/api/articles')).find(row=>row.id===id);
  if(!article)throw Error('Эта статья не опубликована.');
  headline.textContent=article.title;document.title=article.title+' · '+document.title;
  const time=document.getElementById('added');
  if(sample){
   time.textContent=sample.d.toLocaleLowerCase('ru');
  }else if(article.created_at&&Number.isFinite(Date.parse(article.created_at))){
   time.dateTime=article.created_at;
   time.textContent=new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date(article.created_at));
  }
  document.getElementById('dateGroup').hidden=!time.textContent;
  document.getElementById('byline').hidden=false;
  document.getElementById('summary').textContent=article.summary;
  document.getElementById('rubric').textContent=article.category==='practice'?'Практика':'Разбор';
  const result=sample?{body:sample.body}:await journalApi('/api/read/'+id);
  const body=result.body;
  const doc=result.document||parseContent(body);
  const grok=id==='1a32f300-772e-4b93-b088-d87cff332168';
  const cover=doc.cover||article.cover||(grok?'/grok-watermark.png':'/default-news.png');
  if(cover){
   const intro=document.createElement('div');intro.className='article-intro '+(doc.coverPosition==='side'?'side':'center');
   const image=document.createElement('img');image.src=cover;image.alt=article.title;
   const summary=document.getElementById('summary');
   summary.before(intro);intro.append(image,summary);
  }
  for(const block of doc.blocks){
   if(block.type==='text'){const section=document.createElement('section');section.append(formattedText(block.html));prose.append(section);continue}
   if(!block.url)continue;
   const figure=document.createElement('figure'),media=document.createElement(block.type==='video'?'video':'img');
   media.src=block.url;
   if(block.type==='video'){media.controls=true;media.preload='metadata'}else{media.alt=block.caption||article.title;media.loading='lazy'}
   figure.append(media);
   if(block.caption){const caption=document.createElement('figcaption');caption.textContent=block.caption;figure.append(caption)}
   prose.append(figure);
  }
  if(grok){const source=document.createElement('a');source.href='https://docs.x.ai/developers/advanced-api-usage/watermarking';source.textContent='Документация Grok ↗';prose.append(source)}
 }catch(error){
  if(headline.textContent==='Загрузка статьи…')headline.textContent='Статья недоступна';
  prose.textContent=error.message;
  if(error.status===401||error.status===403){
   prose.textContent='Эта статья доступна по подписке.';
   const openSubscription=async()=>membershipWindow(headline.textContent,(await platformConfig).billing,id);
   const button=document.createElement('button');button.className='cta';button.textContent='Оформить подписку →';button.onclick=openSubscription;prose.append(document.createElement('br'),button);
   await openSubscription();
  }
 }
}
readPage();
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});
