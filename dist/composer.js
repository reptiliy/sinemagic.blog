const composer=document.getElementById('composer');
const coverPreview=document.getElementById('coverPreview');
const mediaStatus=document.getElementById('mediaStatus');
let articleCover='',uploading=false;
function textBlock(html=''){
 const block=document.createElement('section');block.className='compose-block';block.dataset.type='text';
 const field=document.createElement('div');field.className='rich-text';field.contentEditable='true';field.setAttribute('role','textbox');field.setAttribute('aria-label','Текст статьи');field.setAttribute('aria-multiline','true');field.append(formattedText(html));
 field.onpaste=event=>{event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'))};
 block.append(field,removeBlock(block));composer.append(block);return field;
}
function removeBlock(block){
 const button=document.createElement('button');button.type='button';button.className='remove-block';button.textContent='Убрать блок';button.onclick=()=>block.remove();return button;
}
function mediaBlock(block){
 const section=document.createElement('section');section.className='compose-block';section.dataset.type=block.type;section.dataset.path=block.path;
 const media=document.createElement(block.type==='video'?'video':'img');
 if(block.url)media.src=block.url;
 if(block.type==='video')media.controls=true;else media.alt=block.caption||'Изображение статьи';
 const caption=document.createElement('input');caption.placeholder='Подпись к медиа';caption.setAttribute('aria-label','Подпись к медиа');caption.maxLength=500;caption.value=block.caption||'';
 section.append(media,caption,removeBlock(section));composer.append(section);
}
function setCover(url){
 articleCover=url;coverPreview.hidden=!url;
 if(url)coverPreview.src=url;else coverPreview.removeAttribute('src');
}
async function composeArticle(row){
 const doc=parseContent(row.body||'');
 composer.replaceChildren();setCover(doc.cover||'');
 editor.elements.coverPosition.value=doc.coverPosition||'center';
 for(const block of doc.blocks){
  if(block.type==='text')textBlock(block.html);
  else mediaBlock(block);
 }
 if(!doc.blocks.length)textBlock();
 if(row.id&&doc.blocks.some(block=>block.type!=='text')){
  try{
   const result=await journalApi('/api/admin/preview/'+row.id);
   if(selected!==row.id)return;
   composer.querySelectorAll('[data-path]').forEach(section=>{
    const block=result.document.blocks.find(b=>b.path===section.dataset.path);
    if(block?.url)section.querySelector('img,video').src=block.url;
   });
  }catch(error){mediaStatus.textContent=error.message}
 }
}
function serializeArticle(){
 if(uploading)throw Error('Дождитесь завершения загрузки.');
 const blocks=[...composer.children].map(section=>{
  if(section.dataset.type==='text'){
   const field=section.querySelector('.rich-text'),clean=document.createElement('div');
   clean.append(formattedText(field.innerHTML));
   return {type:'text',html:clean.innerHTML};
  }
  return {type:section.dataset.type,path:section.dataset.path,caption:section.querySelector('input').value};
 }).filter(b=>b.type!=='text'||b.html.replace(/<[^>]*>/g,'').trim());
 if(!blocks.length)throw Error('Добавьте текст или медиа в статью.');
 return JSON.stringify({format:'journal-v1',cover:articleCover,coverPosition:editor.elements.coverPosition.value,blocks});
}
document.getElementById('textBlock').onclick=()=>textBlock().focus();
document.getElementById('clearCover').onclick=()=>setCover('');
document.querySelectorAll('[data-command]').forEach(button=>{
 button.onmousedown=e=>e.preventDefault();
 button.onclick=()=>{
  const selection=window.getSelection();
  if(!selection.rangeCount||!composer.contains(selection.anchorNode))return;
  document.execCommand(button.dataset.command,false,button.dataset.value||null);
 };
});
async function uploadFile(file,kind){
 if(!file)return;
 if(uploading)return;
 const permitted=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];
 if(!permitted.includes(file.type)||file.size>50*1024*1024||(kind==='cover'&&!file.type.startsWith('image/'))){mediaStatus.textContent='Выберите PNG, JPG, WebP, GIF, MP4 или WebM до 50 МБ.';return}
 uploading=true;
 editor.querySelector('fieldset').disabled=true;
 mediaStatus.textContent='Подготовка загрузки…';
 try{
  const data=await journalApi('/api/admin/media','POST',{kind,type:file.type,size:file.size});
  await new Promise((resolve,reject)=>{
   const xhr=new XMLHttpRequest();xhr.open('PUT',data.uploadUrl);xhr.timeout=180000;
   xhr.setRequestHeader('Content-Type',file.type);
   xhr.upload.onprogress=e=>{mediaStatus.textContent='Загрузка '+(e.lengthComputable?Math.round(e.loaded/e.total*100)+'%':'…')};
   xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(Error('Загрузка отклонена хранилищем.'));
   xhr.onerror=xhr.ontimeout=()=>reject(Error('Не удалось загрузить файл. Попробуйте ещё раз.'));
   xhr.send(file);
  });
  if(kind==='cover')setCover(data.url);
  else{
   const url=URL.createObjectURL(file);
   mediaBlock({type:file.type.startsWith('video/')?'video':'image',path:data.path,url,caption:''});
   // Keep the preview until the editor loads another article.
  }
  mediaStatus.textContent='Файл загружен. Сохраните статью.';
 }catch(error){mediaStatus.textContent=error.message}
 finally{uploading=false;editor.querySelector('fieldset').disabled=false}
}
for(const [id,kind] of [['coverFile','cover'],['inlineFile','content']]){
 document.getElementById(id).onchange=async e=>{await uploadFile(e.target.files[0],kind);e.target.value=''};
}
composeArticle({});
