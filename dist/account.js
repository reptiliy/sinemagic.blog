const platformConfig=location.protocol==='file:'?Promise.resolve({}):fetch('/api/config').then(r=>r.json()).catch(()=>({}));
const tokenKey='journal.session';
async function journalApi(path,method='GET',body){
 const token=sessionStorage.getItem(tokenKey);
 const result=await fetch(path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body&&JSON.stringify(body)});
 const value=await result.json();
 if(!result.ok){if(result.status===401)sessionStorage.removeItem(tokenKey);throw Object.assign(new Error(value.error),{status:result.status})}
 return value;
}
function account(){
 const dialog=document.createElement('dialog');
 dialog.setAttribute('aria-label','Аккаунт читателя');
 dialog.innerHTML='<form method="dialog"><button>Закрыть ×</button></form><h3>Аккаунт читателя</h3><form class="auth"><label>Email<input type="email" autocomplete="email" required></label><label>Пароль<input type="password" autocomplete="current-password" required minlength="6"></label><button>Войти</button> <button name="register">Создать аккаунт</button></form><p role="status"></p>';
 document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();
 const form=dialog.querySelector('.auth'),status=dialog.querySelector('[role=status]');
 if(sessionStorage.getItem(tokenKey)){form.replaceChildren();const out=document.createElement('button');out.textContent='Выйти';form.append(out);form.onsubmit=e=>{e.preventDefault();sessionStorage.removeItem(tokenKey);location.reload()};return}
 form.onsubmit=async e=>{
  e.preventDefault();const config=await platformConfig;
  if(!config.connected){status.textContent='Для входа подключите Supabase.';return}
  const signup=e.submitter.name==='register';
  try{
   const r=await fetch(config.url+'/auth/v1/'+(signup?'signup':'token?grant_type=password'),{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({email:form.elements[0].value,password:form.elements[1].value})});
   const result=await r.json();
   if(!r.ok)throw Error('Проверьте email, пароль и подтверждение адреса.');
   if(!result.access_token){status.textContent='Проверьте почту для подтверждения адреса.';return}
   sessionStorage.setItem(tokenKey,result.access_token);location.reload()
  }catch(err){status.textContent=err.message}
 };
}
const login=document.querySelector('#login');
if(login){login.onclick=account;if(sessionStorage.getItem(tokenKey))login.textContent='Аккаунт ↗'}
