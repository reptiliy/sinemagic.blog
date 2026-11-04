import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';

const buckets={cover:'journal-covers',content:'journal-media'};
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
export async function prepareUpload({kind,type,size}){
 if(!['cover','content'].includes(kind)||!formats[type]||!Number.isInteger(size)||size<=0||size>50*1024*1024||(kind==='cover'&&!type.startsWith('image/')))throw Error('Выберите изображение или видео до 50 МБ');
 const supabase=client(),bucket=buckets[kind];
 const found=await supabase.storage.getBucket(bucket);
 if(found.error){
  const made=await supabase.storage.createBucket(bucket,{public:kind==='cover',fileSizeLimit:50*1024*1024,allowedMimeTypes:kind==='cover'?Object.keys(formats).filter(t=>t.startsWith('image/')):Object.keys(formats)});
  if(made.error){const retry=await supabase.storage.getBucket(bucket);if(retry.error)throw Error('Не удалось подготовить хранилище')}
 }
 const path=randomUUID()+'.'+formats[type];
 const {data,error}=await supabase.storage.from(bucket).createSignedUploadUrl(path);
 if(error)throw Error('Не удалось подготовить загрузку');
 return {uploadUrl:data.signedUrl,path,url:kind==='cover'?supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl:null};
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
