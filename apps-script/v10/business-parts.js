// Keep consulting mounted so draft comments and filters survive tab changes.
(function installBusinessParts(){
 const tabs=Array.from(document.querySelectorAll('[data-business-part]'));
 if(!tabs.length)return;
 let current='consulting';
 const scrollPositions=new Map();
 function selectPart(part,focus=false){
  const selected=tabs.find(tab=>tab.dataset.businessPart===part);
  if(!selected)return;
  scrollPositions.set(current,window.scrollY);
  tabs.forEach(tab=>{
   const active=tab===selected;
   tab.setAttribute('aria-selected',String(active));
   tab.tabIndex=active?0:-1;
   document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;
  });
  current=part;
  document.querySelector('.rail')?.classList.remove('open');
  window.scrollTo({top:scrollPositions.get(part)||0,behavior:'instant'});
  if(focus)selected.focus();
 }
 tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>selectPart(tab.dataset.businessPart));
  tab.addEventListener('keydown',event=>{
   let next;
   if(event.key==='ArrowRight')next=(index+1)%tabs.length;
   else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
   else if(event.key==='Home')next=0;
   else if(event.key==='End')next=tabs.length-1;
   else return;
   event.preventDefault();event.stopPropagation();selectPart(tabs[next].dataset.businessPart,true);
  });
 });
 document.querySelectorAll('[data-business-return]').forEach(button=>button.addEventListener('click',()=>selectPart('consulting',true)));
})();
