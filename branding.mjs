import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const location=new URL('./site-settings.json',import.meta.url);
export const defaults={name:'SineMagic',description:'Идеи, разборы и истории создания фильмов — для тех, кто видит в кадре больше, чем просто сюжет.',keywords:'кино, режиссура, киноязык',logo:'',favicon:''};
export async function settings(){
 if(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY){
  const result=await createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}}).from('journal_settings').select('value').eq('id',true).maybeSingle();
  if(result.error)throw Error('Настройки сайта недоступны');
  if(result.data)return result.data.value;
 }
 try{return JSON.parse(await readFile(location,'utf8'))}catch(error){if(error.code==='ENOENT')return defaults;throw error}
}
export function validated(input){
 const result={};
 for(const [field,max] of Object.entries({name:80,description:500,keywords:400})){
  if(typeof input[field]!=='string'||input[field].length>max)throw Error();
  result[field]=input[field].trim();
 }
 if(!result.name)throw Error();
 for(const field of ['logo','favicon']){
  const src=input[field];
  if(typeof src!=='string'||src.length>105000||(src&&!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(src)))throw Error();
  result[field]=src;
 }
 return result;
}
export async function persist(settings){
 const result=await createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}}).from('journal_settings').upsert({id:true,value:settings,updated_at:new Date().toISOString()}).select('value').single();
 if(result.error)throw Error('Не удалось сохранить настройки');
}
const escape=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function branded(html,s,admin){
 const name=escape(s.name),desc=escape(s.description);
 const icon=s.favicon?'<link rel="icon" type="image/png" href="'+s.favicon+'">':'';
 const brand=(s.logo?'<img alt="" style="height:32px;max-width:110px;vertical-align:middle;object-fit:contain" src="'+s.logo+'"> ':'✦ ')+(s.name===defaults.name?'Sine<span>Magic</span>':name);
 return html.replace(/<title>.*?<\/title>/,()=>'<title>'+(admin?'Редакция · ':'')+name+'</title><meta name="description" content="'+desc+'"><meta name="keywords" content="'+escape(s.keywords)+'">'+icon)
 .replaceAll('✦ Sine<span>Magic</span>',()=>brand)
 .replace('id="publisher">Редакция SineMagic',()=>'id="publisher">'+escape(process.env.JOURNAL_EDITOR_NAME||'Редакция '+s.name))
 .replace(/<p class="lead">.*?<\/p>/,()=>'<p class="lead">'+desc+'</p>')
 .replaceAll('SineMagic / Панель',()=>name+' / Панель').replaceAll('SineMagic Journal',()=>name+' Journal');
}
