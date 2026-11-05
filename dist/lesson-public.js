const lessonContent=document.getElementById('lessonContent');
function lessonElement(tag,text,className){
 const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;
}
async function showLessonCatalog(){
 const rows=await journalApi('/api/lessons');
 lessonContent.replaceChildren(lessonElement('p','Обучение · SineMagic','eyebrow'),lessonElement('h1','Видеоуроки'),lessonElement('p','Практические занятия и авторские ролики. Закрытые уроки доступны по подписке.','lesson-lead'));
 if(!rows.length){lessonContent.append(lessonElement('p','Первые уроки скоро появятся.'));return}
 const grid=lessonElement('div','','lesson-grid');
 for(const row of rows){
  const card=lessonElement('article','','lesson-tile'),image=lessonElement('img');
  image.src=row.cover;image.alt=row.title;image.loading='lazy';
  const label=lessonElement('small',row.paid?'По подписке':'Открытый урок','lesson-access');
  const link=lessonElement('a',row.paid?'Смотреть по подписке ↗':'Смотреть урок ↗','lesson-button');link.href='/lessons/'+row.id;
  card.append(image,label,lessonElement('h2',row.title),lessonElement('p',row.description.slice(0,200)),link);grid.append(card);
 }
 lessonContent.append(grid);
}
async function showVideoLesson(id){
 const lesson=await journalApi('/api/lessons/'+id);
 const back=lessonElement('a','← Все уроки','lesson-back');back.href='/lessons';
 document.title=lesson.title+' · SineMagic';
 const card=lessonElement('article','','lesson-view');
 const heading=lessonElement('h1',lesson.title);
 const state=lessonElement('p','','lesson-player-status');
 const description=lessonElement('p',lesson.description,'lesson-description');
 card.append(lessonElement('p',lesson.paid?'Видеоурок · По подписке':'Видеоурок · Открытый доступ','eyebrow'),heading,description);
 const playerArea=lessonElement('div','','lesson-player');
 const poster=lessonElement('img');poster.src=lesson.cover;poster.alt=lesson.title;playerArea.append(poster);
 const retry=lessonElement('button','Обновить плеер','lesson-button');retry.type='button';retry.hidden=true;
 card.append(playerArea,state,retry);lessonContent.replaceChildren(back,card);
 async function subscription(){
  const config=await platformConfig;
  membershipWindow(lesson.title,config.billing,undefined,'урок');
 }
 async function loadPlayer(){
  retry.hidden=true;state.textContent='Проверяем доступ к уроку…';
  try{
   const access=await journalApi('/api/lessons/'+id+'/video');
   const video=lessonElement('video');video.controls=true;video.preload='metadata';video.poster=lesson.cover;video.src=access.url;video.setAttribute('playsinline','');
   video.onerror=()=>{state.textContent='Не удалось воспроизвести видео. Попробуйте обновить плеер.';retry.hidden=false};
   playerArea.replaceChildren(video);state.textContent='Нажмите ▶, чтобы начать просмотр.';
  }catch(error){
   if(error.status===401||error.status===403){
    state.textContent='Для просмотра этого урока нужна действующая подписка.';
    const button=lessonElement('button','Открыть подписку →','lesson-button');button.type='button';button.onclick=subscription;
    playerArea.replaceChildren(poster,button);await subscription();
   }else{state.textContent=error.message;retry.hidden=false}
  }
 }
 retry.onclick=loadPlayer;
 await loadPlayer();
}
const lessonId=location.pathname.split('/').filter(Boolean)[1];
(lessonId?showVideoLesson(lessonId):showLessonCatalog()).catch(error=>{
 lessonContent.replaceChildren(lessonElement('h1','Урок недоступен'),lessonElement('p',error.message));
});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});
