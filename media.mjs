import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';

const buckets={cover:'journal-covers',content:'journal-media',lesson:'journal-lessons'};
const formats={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'};
function client(){
 return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function documentBody(body){
 try{
  const value=JSON.parse(body);
  return value?.format==='journal-v1'?value:null;
 }catch{return null}
}
export function checkDocument(body){
 const doc=documentBody(body);
 if(!doc)return;
 if(!['center','side'].includes(doc.coverPosition)||typeof doc.cover!=='string'||!Array.isArray(doc.blocks)||doc.blocks.length>100)throw Error('Неверный формат статьи');
 if(doc.cover&&!doc.cover.startsWith(process.env.SUPABASE_URL+'/storage/v1/object/public/journal-covers/'))throw Error('Неверная обложка');
 if(!doc.blocks.length)throw Error('Добавьте текст или медиа');
 for(const block of doc.blocks){
  if(block.type==='text'&&typeof block.html==='string'&&block.html.length<=180000)continue;
  if(['image','video'].includes(block.type)&&/^[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm)$/.test(block.path)&&typeof block.caption==='string'&&block.caption.length<=500)continue;
  throw Error('Неверный блок статьи');
 }
}
export async function prepareUpload({kind,type,size,name},userId){
 if(!['cover','content','lesson'].includes(kind)||!formats[type]||!Number.isInteger(size)||size<=0||size>50*1024*1024||(kind==='cover'&&!type.startsWith('image/'))||(kind==='lesson'&&!type.startsWith('video/')))throw Error('Выберите допустимый файл до 50 МБ');
 const supabase=client(),bucket=buckets[kind];
 const found=await supabase.storage.getBucket(bucket);
 if(kind==='lesson'&&found.data?.public)throw Error('Хранилище уроков должно быть закрытым');
 if(found.error){
  const allowed=kind==='cover'?Object.keys(formats).filter(t=>t.startsWith('image/')):kind==='lesson'?['video/mp4','video/webm']:Object.keys(formats);
  const made=await supabase.storage.createBucket(bucket,{public:kind==='cover',fileSizeLimit:50*1024*1024,allowedMimeTypes:allowed});
  if(made.error){const retry=await supabase.storage.getBucket(bucket);if(retry.error)throw Error('Не удалось подготовить хранилище')}
 }
 const path=randomUUID()+'.'+formats[type];
 const originalName=typeof name==='string'?name.slice(0,200):path;
 const record=await supabase.from('journal_media').insert({bucket,path,original_name:originalName,mime_type:type,size_bytes:size,uploaded_by:userId||null}).select('id').single();
 if(record.error)throw Error('Не удалось зарегистрировать файл');
 const {data,error}=await supabase.storage.from(bucket).createSignedUploadUrl(path);
 if(error)throw Error('Не удалось подготовить загрузку');
 return {id:record.data.id,uploadUrl:data.signedUrl,path,url:kind==='cover'?supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl:null};
}
export async function completeUpload(id){
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw Error('Неверный файл');
 const supabase=client();
 const record=await supabase.from('journal_media').select('*').eq('id',id).single();
 if(record.error)throw Error('Файл не найден');
 const row=record.data;
 const objects=await supabase.storage.from(row.bucket).list('',{search:row.path,limit:10});
 const object=objects.data?.find(item=>item.name===row.path);
 if(!object?.metadata?.size)throw Error('Загрузка файла ещё не завершена');
 const update=await supabase.from('journal_media').update({state:'ready',size_bytes:object.metadata.size}).eq('id',id).select('id,state').single();
 if(update.error)throw Error('Не удалось подтвердить сохранение');
 return update.data;
}
export async function mediaLibrary(page=0){
 const result=await client().from('journal_media').select('*,journal_article_media(article_id,placement)').in('bucket',['journal-covers','journal-media']).eq('state','ready').order('created_at',{ascending:false}).range(page*40,page*40+39);
 if(result.error)throw Error('Медиатека недоступна');
 return Promise.all(result.data.map(async row=>{
  const source=client().storage.from(row.bucket);
  const url=row.bucket===buckets.cover?source.getPublicUrl(row.path).data.publicUrl:(await source.createSignedUrl(row.path,3600)).data?.signedUrl;
  return {...row,url};
 }));
}
export async function articleMediaRefs(body){
 const doc=documentBody(body);
 if(!doc)return [];
 const refs=[];
 if(doc.cover)refs.push({bucket:buckets.cover,path:doc.cover.split('/journal-covers/')[1],placement:'cover'});
 for(const block of doc.blocks)if(block.type!=='text')refs.push({bucket:buckets.content,path:block.path,placement:'inline'});
 return Promise.all(refs.map(async ref=>{
  const {data,error}=await client().from('journal_media').select('id').eq('bucket',ref.bucket).eq('path',ref.path).eq('state','ready').single();
  if(error)throw Error('Файл ещё не сохранён в медиатеке');
  return {id:data.id,placement:ref.placement};
 }));
}
export async function withMedia(body){
 const doc=documentBody(body);
 if(!doc)return {body};
 const blocks=await Promise.all(doc.blocks.map(async block=>{
  if(block.type==='text')return block;
  const {data,error}=await client().storage.from(buckets.content).createSignedUrl(block.path,3600);
  if(error)throw Error('Медиа временно недоступно');
  return {...block,url:data.signedUrl};
 }));
 return {body,document:{...doc,blocks}};
}
