const askButton=document.querySelector('#ask');
const helpBox=document.querySelector('#help');
const question=document.querySelector('#question');
const field=question.querySelector('input');
const messages=document.querySelector('#messages');
const history=[];
function toggleHelp(open){
  helpBox.hidden=!open;
  askButton.setAttribute('aria-expanded',String(open));
  (open?field:askButton).focus();
}
askButton.onclick=()=>toggleHelp(helpBox.hidden);
document.querySelector('#dismiss').onclick=()=>toggleHelp(false);
helpBox.onkeydown=e=>{if(e.key==='Escape')toggleHelp(false)};
function appendMessage(text,mine){
  const p=document.createElement('p');
  p.textContent=text;
  if(mine)p.className='mine';
  messages.append(p);
  messages.scrollTop=messages.scrollHeight;
}
async function answer(text){
  if(field.disabled||!text.trim())return;
  appendMessage(text,true);
  field.value='';
  field.disabled=true;
  history.push({role:'user',content:text});
  let reply;
  try{
    if(location.protocol==='file:')throw Error();
    const response=await fetch('/api/help',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history.slice(-9)}),signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw Error();
    reply=(await response.json()).answer;
    if(!reply)throw Error();
  }catch{
    const settings=await platformConfig;
    if(settings.billing&&/оплат|плат[её]ж|списа|карт|подпис|цен|тариф/i.test(text))reply='Войдите в аккаунт, откройте «Получить доступ» и выберите цену в долларах или евро. Оплата проходит на странице Stripe. Если деньги уже списаны, сначала проверьте квитанцию и попробуйте снова открыть статью через несколько минут.';
    else if(/оплат|плат[её]ж|списа|карт/i.test(text))reply='Приём платежей в журнале пока закрыт, поэтому кнопка оплаты неактивна. Если вы уже видите списание, проверьте название продавца в выписке. Данные карты в чат отправлять не нужно.';
    else if(/подпис|цен|доступ|тариф/i.test(text))reply='Подписка предусматривает доступ ко всем закрытым статьям и архиву. В окне показан пример месячной цены — 5 $ или 5 €. Оформление пока недоступно.';
    else if(/читать|стать|бесплат/i.test(text))reply='Бесплатные статьи находятся в слайд-шоу и в разделе «Из журнала». Нажмите «Читать», чтобы открыть полный текст.';
    else reply='Сейчас доступны подсказки о журнале, подписке и оплате. ИИ для других вопросов сейчас недоступен.';
  }finally{field.disabled=false}
  history.push({role:'assistant',content:reply});
  appendMessage(reply,false);
  if(!helpBox.hidden)field.focus();
}
question.onsubmit=e=>{e.preventDefault();answer(field.value.trim())};
document.querySelector('#suggestions').onclick=e=>{if(e.target.matches('button'))answer(e.target.textContent)};
