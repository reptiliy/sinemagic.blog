const brandForm=document.getElementById('brandForm');
const brandStatus=document.getElementById('brandStatus');
const images={logo:'',favicon:''};
function preview(key,url){
 images[key]=url;
 const img=brandForm.elements[key].parentElement.querySelector('img');
 if(url)img.src=url;else img.removeAttribute('src');
 img.hidden=!url;
}
async function loadBrand(){
 try{
  const value=await journalApi('/api/admin/settings');
  for(const field of ['name','description','keywords'])brandForm.elements[field].value=value[field];
  for(const field of Object.keys(images))preview(field,value[field]);
  brandForm.querySelector('fieldset').disabled=false;
 }catch(error){brandStatus.textContent=error.message}
}
for(const key of Object.keys(images)){
 const input=brandForm.elements[key];
 input.onchange=async()=>{
  const file=input.files[0];if(!file)return;
  brandForm.querySelector('fieldset').disabled=true;
  try{
   if(file.size>8*1024*1024)throw Error();
   const bitmap=await createImageBitmap(file);
   const scale=Math.min(1,(key==='logo'?256:64)/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
   const url=canvas.toDataURL();if(url.length>105000)throw Error();
   preview(key,url);brandStatus.textContent='Изображение готово. Сохраните настройки.';
  }catch{brandStatus.textContent='Выберите небольшое изображение PNG, JPEG или WebP.'}
  finally{brandForm.querySelector('fieldset').disabled=false;input.value=''}
 };
 brandForm.querySelector('[data-clear="'+key+'"]').onclick=()=>preview(key,'');
}
brandForm.onsubmit=async event=>{
 event.preventDefault();const fields=brandForm.elements;
 const value={name:fields.namedItem('name').value,description:fields.description.value,keywords:fields.keywords.value,...images};
 brandForm.querySelector('fieldset').disabled=true;
 try{const saved=await journalApi('/api/admin/settings','POST',value);if(saved.name!==value.name.trim())throw Error('Не удалось подтвердить сохранение');location.hash='settings';location.reload()}
 catch(error){brandStatus.textContent=error.message;brandForm.querySelector('fieldset').disabled=false}
};
if(location.hash==='#settings')selectTab('settings');
if(sessionStorage.getItem(tokenKey))loadBrand();else brandStatus.textContent='Войдите как администратор, чтобы изменить настройки.';
