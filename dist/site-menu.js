const siteHeader=document.querySelector('.journal-header');
const menuButton=siteHeader.querySelector('.nav-toggle');
const menuLinks=[...siteHeader.querySelectorAll('nav a')];
const mobileMenu=matchMedia('(max-width: 800px)');
siteHeader.classList.add('menu-ready');
function closeMenu(restoreFocus=false){
 siteHeader.classList.remove('nav-open');
 menuButton.setAttribute('aria-expanded','false');
 menuButton.setAttribute('aria-label','Открыть меню');
 if(restoreFocus)menuButton.focus();
}
menuButton.onclick=()=>{
 const open=siteHeader.classList.toggle('nav-open');
 menuButton.setAttribute('aria-expanded',String(open));
 menuButton.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');
};
menuLinks.forEach(link=>link.addEventListener('click',()=>closeMenu()));
document.addEventListener('click',event=>{if(!siteHeader.contains(event.target))closeMenu()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&siteHeader.classList.contains('nav-open'))closeMenu(true)});
mobileMenu.addEventListener('change',()=>closeMenu());
function setActive(hash){
 for(const link of menuLinks){
  if(new URL(link.href).hash===hash)link.setAttribute('aria-current','location');
  else link.removeAttribute('aria-current');
 }
}
const sections=menuLinks.map(link=>({hash:new URL(link.href).hash,element:document.querySelector(new URL(link.href).hash)})).filter(item=>item.element);
let framePending=false;
function updateActive(){
 framePending=false;
 if(!sections.length){setActive('#journal');return}
 const boundary=siteHeader.getBoundingClientRect().height+90;
 const candidates=sections.map(item=>({...item,top:item.element.getBoundingClientRect().top})).filter(item=>item.top<=boundary).sort((a,b)=>b.top-a.top);
 setActive(candidates[0]?.hash||'#journal');
 siteHeader.classList.toggle('is-scrolled',scrollY>24);
}
window.addEventListener('scroll',()=>{if(!framePending){framePending=true;requestAnimationFrame(updateActive)}},{passive:true});
window.addEventListener('hashchange',()=>setActive(location.hash||'#journal'));
window.addEventListener('resize',updateActive);
updateActive();
