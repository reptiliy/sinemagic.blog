const editor=document.querySelector('#editor'),notice=document.querySelector('#status');
const saveToast=document.createElement('div');
saveToast.id='saveToast';
saveToast.setAttribute('role','status');
saveToast.hidden=true;
document.body.append(saveToast);
const articleLink=document.createElement('a');
articleLink.className='saved-article-link';
articleLink.target='_blank';
articleLink.rel='noopener noreferrer';
articleLink.textContent='Посмотреть как читатель ↗';
articleLink.hidden=true;
editor.append(articleLink);
let selected=null,saving=false,toastTimer;
function saveMessage(message,error=false){
 notice.textContent=message;
 saveToast.textContent=message;
 saveToast.classList.toggle('error',error);
 saveToast.hidden=false;
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>{saveToast.hidden=true},6500);
}
function edit(row={}){
 if(uploading||saving)return;
 selected=row.id||null;
 editor.reset();
 for(const name of ['title','summary','category','paid','published']){
  const field=editor.elements[name];
  if(field.type==='checkbox')field.checked=Boolean(row[name]);
  else if(row[name]!=null)field.value=row[name];
 }
 articleLink.hidden=!row.id||!row.published;
 if(row.id)articleLink.href='/articles/'+row.id;
 composeArticle(row);
}
async function load(){
 try{
  const rows=await journalApi('/api/admin');
  document.querySelector('#total').textContent=rows.length;
  document.querySelector('#live').textContent=rows.filter(row=>row.published).length;
  document.querySelector('#drafts').textContent=rows.filter(row=>!row.published).length;
  const library=document.querySelector('#library');
  library.replaceChildren();
  for(const row of rows){
   const button=document.createElement('button');
   button.textContent=(row.published?'● ':'○ ')+row.title;
   button.onclick=()=>edit(row);
   library.append(button);
  }
  editor.querySelector('fieldset').disabled=false;
  notice.textContent='Рабочее пространство редактора';
 }catch(error){notice.textContent=error.message}
}
document.querySelector('#create').onclick=()=>edit();
editor.onsubmit=async event=>{
 event.preventDefault();
 if(saving||uploading)return;
 const fields=editor.elements;
 let body;
 try{body=serializeArticle()}catch(error){saveMessage(error.message,true);return}
 const payload={id:selected,title:fields.title.value,summary:fields.summary.value,body,category:fields.category.value,paid:fields.paid.checked,published:fields.published.checked};
 saving=true;
 const submit=editor.querySelector('button[type="submit"],button.cta');
 const label=submit.textContent;
 submit.textContent='Сохраняем…';
 editor.querySelector('fieldset').disabled=true;
 articleLink.hidden=true;
 try{
  const row=await journalApi('/api/admin','POST',payload);
  if(row.paid!==payload.paid||row.published!==payload.published)throw Error('Не удалось подтвердить настройки доступа.');
  saving=false;
  edit(row);
  await load();
  saveMessage('✓ Статья сохранена · '+(row.paid?'По подписке':'Бесплатная')+' · '+(row.published?'Опубликована':'Черновик'));
 }catch(error){saveMessage('Не удалось сохранить: '+error.message,true)}
 finally{
  saving=false;
  submit.textContent=label;
  editor.querySelector('fieldset').disabled=false;
 }
};
platformConfig.then(config=>{if(config.connected)load();else notice.textContent='Подключите Supabase, чтобы войти в редакцию.'});
