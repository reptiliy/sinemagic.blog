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
  const body=sample?sample.body:(await journalApi('/api/read/'+id)).body;
  const grok=id==='1a32f300-772e-4b93-b088-d87cff332168';
  if(grok){const image=document.createElement('img');image.src='/grok-watermark.png';image.alt='Иллюстрация к статье о маркировке текста';prose.append(image)}
  for(const paragraph of body.split(/\n\s*\n/)){const p=document.createElement('p');p.textContent=paragraph;prose.append(p)}
  if(grok){const source=document.createElement('a');source.href='https://docs.x.ai/developers/advanced-api-usage/watermarking';source.textContent='Документация Grok ↗';prose.append(source)}
 }catch(error){
  if(headline.textContent==='Загрузка статьи…')headline.textContent='Статья недоступна';
  prose.textContent=error.message;
  if(error.status===401||error.status===403){const link=document.createElement('a');link.href='/?subscribe=1';link.textContent=' Посмотреть подписку →';prose.append(link)}
 }
}
readPage();
