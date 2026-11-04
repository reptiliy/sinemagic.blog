const libraryGrid=document.getElementById('mediaLibrary');
const libraryNotice=document.getElementById('libraryStatus');
let libraryPage=0,libraryRows=[],libraryBusy=false;
function renderLibrary(){
 libraryGrid.replaceChildren();
 const filter=document.getElementById('mediaFilter').value;
 for(const row of libraryRows.filter(row=>filter==='all'||row.mime_type.startsWith(filter+'/'))){
  const card=document.createElement('article');card.className='media-item';
  const video=row.mime_type.startsWith('video/');
  const preview=document.createElement(video?'video':'img');
  preview.src=row.url||'';
  if(video){preview.controls=true;preview.preload='metadata'}else{preview.alt=row.original_name;preview.loading='lazy'}
  const name=document.createElement('strong');name.textContent=row.original_name;
  const details=document.createElement('p');details.textContent=row.mime_type+' · '+(row.size_bytes/1048576).toFixed(2)+' МБ · '+new Date(row.created_at).toLocaleDateString('ru');
  const usage=document.createElement('small');usage.textContent='Связанных статей: '+new Set(row.journal_article_media.map(ref=>ref.article_id)).size;
  const use=document.createElement('button');use.textContent=row.bucket==='journal-covers'?'Выбрать обложкой':'Вставить в статью';
  use.onclick=()=>{
   if(uploading)return;
   if(editor.querySelector('fieldset').disabled){libraryNotice.textContent='Откройте редактор с правами администратора.';return}
   if(row.bucket==='journal-covers')setCover(row.url);
   else mediaBlock({type:video?'video':'image',path:row.path,url:row.url,caption:''});
   selectTab('posts');mediaStatus.textContent='Файл выбран из медиатеки. Сохраните статью.';
  };
  card.append(preview,name,details,usage,use);libraryGrid.append(card);
 }
}
async function loadLibrary(reset=false){
 if(libraryBusy)return;
 libraryBusy=true;libraryNotice.textContent='Загрузка…';
 try{
  if(reset){libraryRows=[];libraryPage=0}
  const batch=await journalApi('/api/admin/library?page='+libraryPage);
  libraryRows.push(...batch);libraryPage++;
  renderLibrary();document.getElementById('moreMedia').hidden=batch.length<40;
  libraryNotice.textContent=libraryRows.length?'Файлов: '+libraryRows.length:'Файлов пока нет.';
 }catch(error){libraryNotice.textContent=error.message}
 finally{libraryBusy=false}
}
document.querySelector('[data-tab="media"]').addEventListener('click',()=>loadLibrary(true));
document.getElementById('refreshLibrary').onclick=()=>loadLibrary(true);
document.getElementById('moreMedia').onclick=()=>loadLibrary();
document.getElementById('mediaFilter').onchange=renderLibrary;
