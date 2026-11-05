document.getElementById('pricingSubscribe').onclick=async()=>{
 const configuration=await platformConfig;
 membershipWindow(null,configuration.billing);
};
platformConfig.then(configuration=>{
 if(!configuration.billing)document.getElementById('pricingAvailability').textContent='Приём оплаты скоро откроется. Условия можно посмотреть сейчас.';
});
journalApi('/api/exchange').then(quote=>{
 const note=document.getElementById('pricingFx');
 const amount=new Intl.NumberFormat('ru',{style:'currency',currency:'EUR'}).format(quote.eurCents/100);
 const date=new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(quote.date+'T00:00:00Z'));
 note.textContent='≈ '+amount+' / месяц · ';
 const source=document.createElement('a');
 source.href='https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html';
 source.target='_blank';source.rel='noopener noreferrer';source.textContent='ЕЦБ, '+date;
 note.append(source);
}).catch(()=>{document.getElementById('pricingFx').textContent='Эквивалент в EUR временно недоступен.'});
