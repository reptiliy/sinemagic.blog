function formatDate(value){
 return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ru'):'Не указано сервисом';
}
function timeRemaining(value){
 const ms=Date.parse(value)-Date.now();
 if(!Number.isFinite(ms))return 'Срок не указан';
 if(ms<=0)return 'Истекла';
 const days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000);
 return days+' дн. '+hours+' ч.';
}
function ledger(container,headings,rows){
 container.replaceChildren();
 if(!rows.length){container.textContent='Записей пока нет.';return}
 const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),titles=document.createElement('tr');
 for(const title of headings){const th=document.createElement('th');th.textContent=title;titles.append(th)}
 head.append(titles);table.append(head,body);
 for(const row of rows){
  const tr=document.createElement('tr');
  for(const value of row){const td=document.createElement('td');td.textContent=value;tr.append(td)}
  body.append(tr);
 }
 container.append(table);
}
function readerLabel(id){
 const user=report.readers.find(reader=>reader.id===id);
 return user?(user.name?user.name+' · ':'')+(user.email||user.id):id;
}
function articleLabel(id){
 return id?report.articles.find(article=>article.id===id)?.title||'Статья удалена':'Подписка на весь журнал';
}
function drawManagement(){
 if(!report)return;
 const connections=byId('paymentConnections');connections.replaceChildren();
 for(const [name,ready] of [['Stripe',report.providers.stripe],['PayPal',report.providers.paypal]]){
  const card=document.createElement('div'),state=document.createElement('strong'),hint=document.createElement('small');
  card.textContent=name;state.textContent=ready?'Подключён':'Не подключён';
  hint.textContent=name==='PayPal'?'Режим: '+report.providers.paypalMode:'Карты и поддерживаемые способы Stripe';
  card.append(state,hint);connections.append(card);
 }
 const search=byId('paymentSearch').value.toLowerCase(),provider=byId('paymentProvider').value,days=Number(byId('paymentDays').value);
 const payments=report.payments.filter(payment=>(provider==='all'||payment.provider===provider)&&(!days||payment.time>=Date.now()-days*86400000)&&[readerLabel(payment.uid),articleLabel(payment.articleId),payment.id].join(' ').toLowerCase().includes(search));
 ledger(byId('paymentLedger'),['Пользователь','Что оформлено','Сумма','Сервис / способ','Дата и время','Режим','ID платежа'],payments.map(p=>[readerLabel(p.uid),articleLabel(p.articleId),money(p.amount,p.currency),p.provider+' · '+p.method,formatDate(new Date(p.time).toISOString()),p.mode==='test'?'Тестовый':'Реальный',p.id]));
 ledger(byId('subscriptionLedger'),['Пользователь','Подписка','Сервис','Статус','Окончание','Осталось','Продление','Режим'],report.subscriptions.filter(s=>provider==='all'||s.provider===provider).filter(s=>[readerLabel(s.user_id),articleLabel(s.article_id)].join(' ').toLowerCase().includes(search)).map(s=>[readerLabel(s.user_id),articleLabel(s.article_id),s.provider,s.active&&Date.parse(s.expires_at)>Date.now()?'Действует':s.status,formatDate(s.expires_at),timeRemaining(s.expires_at),s.renews?'Автоматическое':'Выключено',s.mode==='test'?'Тестовый':'Реальный']));
 byId('paymentStatus').textContent='Подтверждённых платежей по фильтру: '+payments.length+'. В колонке статьи указан материал, с которого оформляли доступ ко всему журналу.';
}
function editReader(user){
 const dialog=document.createElement('dialog');dialog.className='reader-dialog';dialog.setAttribute('aria-label','Пользователь');
 const close=document.createElement('button');close.type='button';close.textContent='Закрыть ×';close.onclick=()=>dialog.close();
 const heading=document.createElement('h3');heading.textContent='Пользователь';
 const email=document.createElement('p');email.textContent=user.email||user.id;
 const joined=document.createElement('p');joined.textContent='Регистрация: '+formatDate(user.joined);
 const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('input'),save=document.createElement('button'),status=document.createElement('p');
 label.textContent='Отображаемое имя';input.value=user.name||'';input.maxLength=100;label.append(input);save.textContent='Сохранить имя';status.setAttribute('role','status');form.append(label,save,status);
 const subscriptions=document.createElement('div');
 const own=report.subscriptions.filter(s=>s.user_id===user.id);
 ledger(subscriptions,['Сервис','Срок доступа','Осталось'],own.map(s=>[s.provider,formatDate(s.expires_at),timeRemaining(s.expires_at)]));
 form.onsubmit=async event=>{
  event.preventDefault();save.disabled=true;
  try{const result=await journalApi('/api/admin/reader','POST',{userId:user.id,name:input.value});user.name=result.display_name;status.textContent='✓ Имя сохранено';draw()}catch(error){status.textContent=error.message}finally{save.disabled=false}
 };
 dialog.append(close,heading,email,joined,form,subscriptions);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();input.focus();
}
for(const id of ['paymentSearch','paymentProvider','paymentDays'])byId(id).addEventListener(id==='paymentSearch'?'input':'change',drawManagement);
byId('refreshPayments').onclick=async()=>{
 const button=byId('refreshPayments');button.disabled=true;
 try{report=await journalApi('/api/admin/overview');draw()}catch(error){byId('paymentStatus').textContent=error.message}finally{button.disabled=false}
};
if(report)drawManagement();
