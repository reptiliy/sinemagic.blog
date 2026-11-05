const lessonForm=document.getElementById('lessonEditor'),lessonNotice=document.getElementById('lessonEditorStatus');
let lessonRows=[],selectedLesson=null,lessonCoverId=null,lessonBusy=false,lessonReady=false;
function editLesson(row={}){
 if(lessonBusy)return;
 lessonForm.reset();selectedLesson=row.id||null;lessonCoverId=row.cover_id||null;
 lessonForm.elements.title.value=row.title||'';
 lessonForm.elements.description.value=row.description||'';
 lessonForm.elements.paid.checked=row.paid!==false;
 lessonForm.elements.published.checked=Boolean(row.published);
 lessonForm.elements.videoId.value=row.video_id||'';
 const poster=document.getElementById('lessonPosterPreview');
 poster.src=row.cover||'/default-news.png';poster.hidden=false;
 const link=document.getElementById('lessonReadLink');
 link.hidden=!row.id||!row.published;
 if(row.id)link.href='/lessons/'+row.id;
 lessonNotice.textContent=row.id?'Редактирование урока':'Новый урок · доступ по подписке';
}
async function loadLessonVideos(keepValue=true){
 const selected=keepValue?lessonForm.elements.videoId.value:'';
 const videos=await journalApi('/api/admin/lesson-videos');
 const select=lessonForm.elements.videoId;
 select.replaceChildren(new Option('Выберите загруженное видео',''));
 for(const video of videos)select.append(new Option(video.original_name+' · '+(video.size_bytes/1048576).toFixed(1)+' МБ',video.id));
 select.value=selected;
}
async function loadLessons(){
 if(lessonBusy)return;
 try{
  lessonRows=await journalApi('/api/admin/lessons');
  await loadLessonVideos();
  const list=document.getElementById('lessonList');list.replaceChildren();
  for(const row of lessonRows){
   const button=document.createElement('button');button.type='button';button.className='lesson-edit';
   const title=document.createElement('strong'),state=document.createElement('small');
   title.textContent=row.title;state.textContent=(row.published?'Опубликован':'Черновик')+' · '+(row.paid?'По подписке':'Бесплатный');
   button.append(title,state);button.onclick=()=>editLesson(row);list.append(button);
  }
  if(!lessonRows.length)list.textContent='Уроков пока нет. Создайте первый.';
  lessonReady=true;lessonForm.querySelector('fieldset').disabled=false;
  if(!selectedLesson)editLesson();
 }catch(error){lessonNotice.textContent=error.message}
}
async function uploadLessonFile(file,kind){
 if(!file||lessonBusy||!lessonReady)return;
 const types=kind==='lesson'?['video/mp4','video/webm']:['image/jpeg','image/png','image/webp'];
 if(!types.includes(file.type)||file.size>50*1048576){lessonNotice.textContent='Выберите допустимый файл до 50 МБ.';return}
 lessonBusy=true;lessonForm.querySelector('fieldset').disabled=true;
 const progress=document.getElementById('lessonProgress');progress.hidden=false;progress.value=0;
 try{
  lessonNotice.textContent='Подготовка загрузки…';
  const asset=await journalApi('/api/admin/media','POST',{kind,type:file.type,name:file.name,size:file.size});
  await new Promise((resolve,reject)=>{
   const request=new XMLHttpRequest();request.open('PUT',asset.uploadUrl);request.setRequestHeader('Content-Type',file.type);request.timeout=300000;
   request.upload.onprogress=event=>{if(event.lengthComputable)progress.value=Math.round(event.loaded/event.total*100);lessonNotice.textContent='Загрузка: '+progress.value+'%'};
   request.onerror=request.ontimeout=()=>reject(Error('Загрузка прервалась. Попробуйте снова.'));
   request.onload=()=>request.status>=200&&request.status<300?resolve():reject(Error('Хранилище не приняло файл.'));
   request.send(file);
  });
  await journalApi('/api/admin/media/complete','POST',{id:asset.id});
  if(kind==='lesson'){await loadLessonVideos();lessonForm.elements.videoId.value=asset.id}
  else{lessonCoverId=asset.id;const image=document.getElementById('lessonPosterPreview');image.src=asset.url;image.hidden=false}
  lessonNotice.textContent='✓ Файл сохранён. Сохраните урок, чтобы связать его с видео.';
 }catch(error){lessonNotice.textContent=error.message}
 finally{lessonBusy=false;progress.hidden=true;lessonForm.querySelector('fieldset').disabled=false}
}
document.querySelector('[data-tab="lessons"]').addEventListener('click',loadLessons);
document.getElementById('newLesson').onclick=()=>{if(lessonReady)editLesson()};
document.getElementById('reloadLessonVideos').onclick=()=>loadLessonVideos().catch(error=>{lessonNotice.textContent=error.message});
document.getElementById('clearLessonPoster').onclick=()=>{lessonCoverId=null;document.getElementById('lessonPosterPreview').src='/default-news.png'};
for(const [id,kind] of [['lessonUpload','lesson'],['lessonPoster','cover']]){
 document.getElementById(id).onchange=async event=>{await uploadLessonFile(event.target.files[0],kind);event.target.value=''};
}
lessonForm.onsubmit=async event=>{
 event.preventDefault();if(lessonBusy||!lessonReady)return;
 lessonBusy=true;lessonForm.querySelector('fieldset').disabled=true;
 const fields=lessonForm.elements;
 try{
  const row=await journalApi('/api/admin/lessons','POST',{id:selectedLesson,title:fields.title.value,description:fields.description.value,videoId:fields.videoId.value,coverId:lessonCoverId,paid:fields.paid.checked,published:fields.published.checked});
  lessonBusy=false;await loadLessons();
  editLesson(lessonRows.find(item=>item.id===row.id)||row);
  lessonNotice.textContent='✓ Урок сохранён · '+(row.published?'Опубликован':'Черновик')+' · '+(row.paid?'По подписке':'Бесплатный');
 }catch(error){lessonNotice.textContent=error.message}
 finally{lessonBusy=false;lessonForm.querySelector('fieldset').disabled=false}
};
