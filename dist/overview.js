const byId=id=>document.getElementById(id);
const tabs=document.querySelectorAll('.tabs button');
function selectTab(name){
 for(const b of tabs){
  const selected=b.dataset.tab===name;
  b.setAttribute('aria-pressed',String(selected));
  byId(b.dataset.tab).hidden=!selected;
 }
}
tabs.forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));selectTab('overview');
const preference=localStorage.getItem('journal.reportDays')==='30'?'30':'1';
byId('defaultPeriod').value=byId('period').value=preference;
byId('defaultPeriod').onchange=e=>{
 localStorage.setItem('journal.reportDays',e.target.value);
 byId('period').value=e.target.value;draw();
};
let report;
function row(parent,values){
 const line=document.createElement('div');line.className='entry';
 for(const text of values){const item=document.createElement('span');item.textContent=text;line.append(item)}
 parent.append(line);
}
function money(amount,currency){return new Intl.NumberFormat('ru',{style:'currency',currency}).format(amount/100)}
function draw(){
 if(!report)return;
 const ready=report.billing==='ready',days=Number(byId('period').value);
 const payments=report.payments.filter(p=>p.time>=Date.now()-days*86400000);
 const totals=new Map(),last=new Map();
 const chart=byId('paymentChart');chart.replaceChildren();
 if(ready){
  const count=days===1?24:30,width=days*86400000/count,end=Date.now(),start=end-count*width;
  const buckets=Array(count).fill(0);
  for(const p of payments){const i=Math.floor((p.time-start)/width);if(i>=0&&i<count)buckets[i]++}
  const maximum=Math.max(1,...buckets);
  buckets.forEach((n,i)=>{const bar=document.createElement('i');bar.style.height=(3+97*n/maximum)+'%';bar.title=new Date(start+i*width).toLocaleString('ru')+' · оплат: '+n;chart.append(bar)});
  byId('chartCaption').textContent=days===1?'Последние 24 часа · один столбец за час':'Последние 30 дней · один столбец за сутки';
 }
 for(const p of payments)totals.set(p.currency,(totals.get(p.currency)||0)+p.amount);
 for(const p of report.payments)if(!last.has(p.uid))last.set(p.uid,p);
 byId('income').textContent=ready?([...totals].map(([c,a])=>money(a,c)).join(' · ')||'0'):'—';
 byId('payers').textContent=ready?new Set(payments.map(p=>p.uid)).size:'—';
 byId('usersCount').textContent=report.readers.length;
 const members=report.readers.filter(u=>report.active.includes(u.id)).length;
 const share=report.readers.length?Math.round(100*members/report.readers.length):0;
 byId('activeCount').textContent=ready?members:'—';
 byId('share').textContent=ready?share+'%':'—';
 document.querySelector('.ring').style.setProperty('--share',(ready?share:0)+'%');
 const count=days===1?24:30,start=Date.now()-days*86400000,width=days*86400000/count;
 const joined=Array(count).fill(0);
 for(const reader of report.readers){const index=Math.floor((Date.parse(reader.joined)-start)/width);if(index>=0&&index<count)joined[index]++}
 const peak=Math.max(1,...joined);
 byId('trendLine').setAttribute('points',joined.map((n,i)=>(3+294*i/(count-1))+','+(86-80*n/peak)).join(' '));
 byId('trendLabel').textContent='Регистраций за период: '+joined.reduce((sum,n)=>sum+n,0);
 byId('billingStatus').textContent=ready?(payments.length?'Оплаченные счета за выбранный период.':'За выбранный период оплат нет.'):report.billing==='off'?'Stripe ещё не подключён.':'Stripe временно недоступен.';
 const emails=new Map(report.readers.map(u=>[u.id,u.email]));
 const transactions=byId('transactions');transactions.replaceChildren();
 for(const p of payments)row(transactions,[emails.get(p.uid)||p.uid,money(p.amount,p.currency),new Date(p.time).toLocaleString('ru')]);
 const readers=byId('readers');readers.replaceChildren();
 const active=new Set(report.active);
 for(const u of report.readers){
  if(!(u.email||u.id).toLowerCase().includes(byId('readerSearch').value.toLowerCase())||(byId('readerFilter').value==='paid'&&!active.has(u.id)))continue;
  const p=last.get(u.id);
  row(readers,[u.email||u.id,ready?(active.has(u.id)?'Подписка активна':'Без подписки'):'Статус оплаты недоступен',p?money(p.amount,p.currency)+' · '+new Date(p.time).toLocaleDateString('ru'):'—']);
 }
 if(!readers.childElementCount)readers.textContent='Нет читателей по этому фильтру.';
}
byId('period').onchange=draw;byId('readerSearch').oninput=draw;byId('readerFilter').onchange=draw;
platformConfig.then(async config=>{
 byId('connections').textContent='Supabase · '+(config.connected?'настроен':'ожидает подключения')+'　 /　 Stripe Checkout · '+(config.billing?'настроен':'ожидает подключения');
 if(!sessionStorage.getItem(tokenKey)){byId('billingStatus').textContent=byId('readers').textContent='Войдите с аккаунтом администратора.';return}
 try{report=await journalApi('/api/admin/overview');draw()}catch(err){byId('billingStatus').textContent=byId('readers').textContent=err.message}
});
