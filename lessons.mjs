import {createClient} from '@supabase/supabase-js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const client=()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const fields='id,title,description,paid,published,created_at,updated_at,cover:journal_media!journal_lessons_cover_id_fkey(bucket,path)';
export async function lessonCatalog(admin=false){
 let query=client().from('journal_lessons').select(admin?'*,cover:journal_media!journal_lessons_cover_id_fkey(bucket,path),video:journal_media!journal_lessons_video_id_fkey(original_name,mime_type,size_bytes)':fields).order('created_at',{ascending:false});
 if(!admin)query=query.eq('published',true);
 const {data,error}=await query.limit(1000);
 if(error)throw Error('Не удалось загрузить уроки');
 return data.map(lesson=>({...lesson,cover:lesson.cover?client().storage.from(lesson.cover.bucket).getPublicUrl(lesson.cover.path).data.publicUrl:'/default-news.png'}));
}
export async function lessonMetadata(id,admin=false){
 if(!uuid.test(id))return null;
 let query=client().from('journal_lessons').select(admin?'*':fields).eq('id',id);
 if(!admin)query=query.eq('published',true);
 const {data,error}=await query.maybeSingle();
 if(error)throw Error('Урок временно недоступен');
 return data;
}
export async function lessonVideo(id){
 const result=await client().from('journal_lessons').select('video:journal_media!journal_lessons_video_id_fkey(bucket,path,state)').eq('id',id).single();
 if(result.error||result.data.video?.state!=='ready')throw Error('Видео ещё не готово');
 const video=result.data.video;
 if(video.bucket!=='journal-lessons')throw Error('Неверное хранилище');
 const {data,error}=await client().storage.from(video.bucket).createSignedUrl(video.path,3600);
 if(error)throw Error('Видео временно недоступно');
 return {url:data.signedUrl,expiresIn:3600};
}
export async function lessonVideos(){
 const {data,error}=await client().from('journal_media').select('id,original_name,size_bytes,mime_type,created_at').eq('bucket','journal-lessons').eq('state','ready').order('created_at',{ascending:false}).limit(1000);
 if(error)throw Error('Видео временно недоступны');
 return data;
}
export async function saveLesson(input,userId){
 const {id,title,description,videoId,coverId,paid,published}=input;
 if((id&&!uuid.test(id))||typeof title!=='string'||!title.trim()||title.length>200||typeof description!=='string'||description.length>10000||!uuid.test(videoId)||typeof paid!=='boolean'||typeof published!=='boolean'||(coverId&&!uuid.test(coverId)))throw Error('Проверьте название и выберите загруженное видео');
 const video=await client().from('journal_media').select('id').eq('id',videoId).eq('bucket','journal-lessons').eq('state','ready').like('mime_type','video/%').maybeSingle();
 if(video.error||!video.data)throw Error('Сначала завершите загрузку видео');
 if(coverId){
  const cover=await client().from('journal_media').select('id').eq('id',coverId).eq('bucket','journal-covers').eq('state','ready').like('mime_type','image/%').maybeSingle();
  if(cover.error||!cover.data)throw Error('Обложка ещё не готова');
 }
 const values={title:title.trim(),description,video_id:videoId,cover_id:coverId||null,paid,published,updated_at:new Date().toISOString()};
 const query=id?client().from('journal_lessons').update(values).eq('id',id):client().from('journal_lessons').insert({...values,author_id:userId});
 const {data,error}=await query.select('*').single();
 if(error)throw Error('Не удалось сохранить урок');
 return data;
}
