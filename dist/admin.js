const editor=document.querySelector('#editor'),notice=document.querySelector('#status');
let selected=null;
function edit(row={}){
 if(uploading)return;
 selected=row.id||null;editor.reset();
 for(const name of ['title','summary','category','paid','published']){
  const field=editor.elements[name];
  if(field.type==='checkbox')field.checked=Boolean(row[name]);
  else if(row[name]!=null)field.value=row[name];
 }
 composeArticle(row);
}
async function load(){
 try{
  const rows=await journalApi('/api/admin');
  document.querySelector('#total').textContent=rows.length;
  document.querySelector('#live').textContent=rows.filter(row=>row.published).length;
  document.querySelector('#drafts').textContent=rows.filter(row=>!row.published).length;
  const library=document.querySelector('#library');library.replaceChildren();
  for(const row of rows){const b=document.createElement('button');b.textContent=(row.published?'● ':'○ ')+row.title;b.onclick=()=>edit(row);library.append(b)}
  editor.querySelector('fieldset').disabled=false;notice.textContent='Рабочее пространство редактора';
 }catch(err){notice.textContent=err.message}
}
document.querySelector('#create').onclick=()=>edit();
editor.onsubmit=async e=>{
 e.preventDefault();const f=editor.elements;
 let body;
 try{body=serializeArticle()}catch(error){notice.textContent=error.message;return}
 editor.querySelector('fieldset').disabled=true;
 try{const row=await journalApi('/api/admin','POST',{id:selected,title:f.title.value,summary:f.summary.value,body,category:f.category.value,paid:f.paid.checked,published:f.published.checked});edit(row);await load();notice.textContent='Материал сохранён'}catch(err){notice.textContent=err.message}finally{editor.querySelector('fieldset').disabled=false}
};
platformConfig.then(c=>{if(c.connected)load();else notice.textContent='Подключите Supabase, чтобы войти в редакцию.'});
