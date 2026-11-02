(()=>{
 'use strict';
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
 const root=document.body.dataset.siteRoot||'';
 const storageKey='3dworld.quote.v1';
 const quoteDialog=$('#quote-dialog'),projectDialog=$('#project-dialog');
 let selection=[];
 try{
  const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');
  if(Array.isArray(saved))selection=saved.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.category==='string').slice(0,24).map(x=>({id:x.id.slice(0,100),title:x.title.slice(0,150),category:x.category.slice(0,100)}));
 }catch{}
 let toastTimer=0,lastDialogOpener=null;
 function notify(message){
  const toast=$('#experience-toast');if(!toast)return;
  toast.textContent=message;toast.classList.add('is-visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('is-visible'),3500);
 }
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(selection))}catch{}}
 function openDialog(dialog,opener){
  if(!dialog)return;
  lastDialogOpener=opener||document.activeElement;
  dialog.showModal();
 }
 $$('dialog.experience-dialog').forEach(dialog=>{
  $$('.dialog-close',dialog).forEach(b=>b.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
  dialog.addEventListener('close',()=>{if(lastDialogOpener&&document.contains(lastDialogOpener))lastDialogOpener.focus()});
 });
 function renderSelection(){
  const count=selection.length;
  $$('.quote-count').forEach(el=>el.textContent=String(count));
  $$('.quote-header').forEach(el=>{el.hidden=count===0;el.setAttribute('aria-label','Ver selección para cotizar: '+count+' elementos')});
  $$('[data-quote-item]').forEach(button=>{
   const selected=selection.some(item=>item.id===button.dataset.quoteItem);
   button.setAttribute('aria-pressed',String(selected));
   const label=$('.quote-button-label',button);if(label)label.textContent=selected?'En tu selección':button.dataset.quoteLabel||'Añadir a solicitud';
   button.closest('.shop-product-card')?.classList.toggle('is-selected',selected);
  });
  if(!quoteDialog)return;
  const list=$('.quote-list',quoteDialog);list.replaceChildren();
  $('.quote-empty',quoteDialog).hidden=count>0;
  $('.quote-selection-count',quoteDialog).textContent=count+' '+(count===1?'elemento seleccionado':'elementos seleccionados');
  selection.forEach(item=>{
   const li=document.createElement('li'),copy=document.createElement('div'),category=document.createElement('small'),title=document.createElement('strong'),remove=document.createElement('button');
   category.textContent=item.category;title.textContent=item.title;
   copy.append(category,title);remove.type='button';remove.className='quote-remove';remove.textContent='×';remove.setAttribute('aria-label','Quitar '+item.title);
   remove.addEventListener('click',()=>{selection=selection.filter(x=>x.id!==item.id);save();renderSelection();notify(item.title+' se quitó de tu selección.')});
   li.append(copy,remove);list.append(li);
  });
  const cta=$('.prepare-quote',quoteDialog);
  cta.hidden=count===0;
  const categories=new Set(selection.map(item=>item.category));
  const category=categories.size===1?selection[0]?.category:'Insumos y equipos';
  cta.href=root+'contacto.html?categoria='+encodeURIComponent(category||'')+'&interes='+encodeURIComponent(selection.map(x=>x.title).join(' · '));
 }
 $$('[data-open-quote]').forEach(button=>button.addEventListener('click',()=>{renderSelection();openDialog(quoteDialog,button)}));
 $$('[data-quote-item]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.quoteItem,existing=selection.find(x=>x.id===id);
  if(existing){selection=selection.filter(x=>x.id!==id);notify(existing.title+' se quitó de tu selección.')}
  else{
   if(selection.length>=24){notify('Tu selección ya contiene 24 elementos. Puedes revisarla antes de continuar.');return}
   selection.push({id,title:button.dataset.quoteTitle,category:button.dataset.quoteCategory});
   notify(button.dataset.quoteTitle+' añadido a tu selección.');
  }
  save();renderSelection();
 }));
 addEventListener('storage',event=>{if(event.key===storageKey){try{const next=JSON.parse(event.newValue||'[]');if(Array.isArray(next))selection=next.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.category==='string').slice(0,24)}catch{}renderSelection()}});
 renderSelection();
 // Native project preview keeps the concept images visible at full proportions.
 $$('[data-project-preview]').forEach(button=>button.addEventListener('click',()=>{
  if(!projectDialog)return;
  const card=button.closest('.portfolio-card'),image=$('.project-visual img',card);
  const photo=$('.project-dialog-photo',projectDialog);
  photo.src=image.src;photo.alt=image.alt;
  $('.project-dialog-title',projectDialog).textContent=$('h3',card).textContent;
  $('.project-dialog-copy',projectDialog).textContent=$('.portfolio-content p',card).textContent;
  const objective=$('[data-study-dialog-objective]',projectDialog),review=$('[data-study-dialog-review]',projectDialog);
  if(objective)objective.textContent=card.dataset.studyObjective||'';
  if(review)review.textContent=card.dataset.studyReview||'';
  const service=$('[data-study-dialog-service]',projectDialog),contact=$('[data-study-dialog-contact]',projectDialog);
  if(service){service.href=card.dataset.studyService||root+'servicios.html';service.textContent=(card.dataset.studyServiceLabel||'Ver servicio')+' ↗'}
  if(contact){const category=card.dataset.studyServiceLabel==='Diseño CAD'?'Diseño CAD':'Impresión 3D y prototipos';contact.href=root+'contacto.html?origen=estudio&categoria='+encodeURIComponent(category)+'&interes='+encodeURIComponent($('h3',card).textContent)}
  const kicker=$('.dialog-kicker',projectDialog);
  if(kicker)kicker.textContent=(card.dataset.studyIndex?card.dataset.studyIndex+' · ':'')+'ESTUDIO DE DISEÑO';
  openDialog(projectDialog,button);
 }));
 if(projectDialog&&$('[data-project-preview]'))document.documentElement.classList.add('project-preview-ready');
 // Keyboard-friendly grouped navigation, with one open menu at a time.
 const dropdowns=$$('.nav-dropdown');
 dropdowns.forEach(menu=>menu.addEventListener('toggle',()=>{if(menu.open)dropdowns.filter(x=>x!==menu).forEach(x=>x.open=false)}));
 document.addEventListener('click',event=>{dropdowns.forEach(menu=>{if(!menu.contains(event.target))menu.open=false})});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')dropdowns.forEach(menu=>{if(menu.open){menu.open=false;$('summary',menu).focus()}})});
 // Search the actual catalog and keep category destinations usable after filtering.
 const search=$('#catalog-search'),catalogCards=$$('.shop-product-card'),catalogCount=$('#catalog-count');
 const printerFilters=$$('[data-printer-filter]');
 const printerCollections=$$('[data-printer-catalog]').map(section=>({section,family:'todos',page:1,pageSize:Number(section.dataset.pageSize)||0}));
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function filterCatalog(){
  const query=normalize(search?.value.trim()||'');let count=0;
  catalogCards.filter(card=>!card.dataset.printerFamily).forEach(card=>{
   const matches=!query||normalize(card.textContent).includes(query);
   card.hidden=!matches;if(matches)count++;
  });
  printerCollections.forEach(collection=>{
   const {section,family,pageSize}=collection;
   const cards=$$('.shop-product-card',section);
   const matches=cards.filter(card=>{
    const familyMatches=family==='todos'||(['legacy','reference'].includes(family)?card.dataset.printerStatus===family:card.dataset.printerFamily===family);
    return familyMatches&&(!query||normalize(card.textContent).includes(query));
   });
   count+=matches.length;
   const pages=pageSize?Math.max(1,Math.ceil(matches.length/pageSize)):1;
   collection.page=Math.max(1,Math.min(collection.page,pages));
   const start=pageSize?(collection.page-1)*pageSize:0;
   const shown=new Set(pageSize?matches.slice(start,start+pageSize):matches);
   cards.forEach(card=>card.hidden=!shown.has(card));
   section.hidden=matches.length===0&&family==='todos';
   const counter=$('[data-printer-count]',section);if(counter)counter.textContent=matches.length+' '+(matches.length===1?'modelo':'modelos');
   const empty=$('[data-printer-empty]',section);if(empty)empty.hidden=matches.length>0;
   const pagination=$('[data-printer-pagination]',section);if(pagination)pagination.hidden=pages<=1;
   const pageState=$('[data-printer-page-state]',section);if(pageState)pageState.textContent=(matches.length?start+1:0)+'–'+Math.min(start+(pageSize||matches.length),matches.length)+' de '+matches.length+' modelos';
   $$('[data-printer-page]',section).forEach(button=>button.disabled=Number(button.dataset.printerPage)<0?collection.page===1:collection.page===pages);
   $$('[data-printer-filter]',section).forEach(button=>{const active=button.dataset.printerFilter===family;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});
  });
  $$('.shop-catalog-section:not([data-printer-catalog])').forEach(section=>section.hidden=!$('.shop-product-card:not([hidden])',section));
  if(catalogCount)catalogCount.textContent=count+' '+(count===1?'opción para explorar':'opciones para explorar');
  const empty=$('.shop-empty');if(empty)empty.hidden=count>0||printerCollections.some(collection=>collection.family!=='todos');
 }
 printerFilters.forEach(button=>button.addEventListener('click',()=>{
  const collection=printerCollections.find(item=>item.section===button.closest('[data-printer-catalog]'));
  if(collection){collection.family=button.dataset.printerFilter;collection.page=1;filterCatalog()}
 }));
 $$('[data-printer-page]').forEach(button=>button.addEventListener('click',()=>{
  const collection=printerCollections.find(item=>item.section===button.closest('[data-printer-catalog]'));
  if(!collection)return;
  collection.page+=Number(button.dataset.printerPage);filterCatalog();
  $('[data-printer-toolbar]',collection.section)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }));
 if(search){
  search.addEventListener('input',()=>{printerCollections.forEach(collection=>collection.page=1);filterCatalog()});filterCatalog();
  $$('.shop-category-links a,.shop-category-card,.printer-brand-links a').forEach(a=>a.addEventListener('click',()=>{search.value='';printerCollections.forEach(collection=>{collection.family='todos';collection.page=1});filterCatalog()}));
 }
 const materialResult=$('#material-result');
 if(materialResult){const update=()=>materialResult.textContent=$$('.material-card:not([hidden])').length+' familias';$$('[data-filter]').forEach(button=>button.addEventListener('click',update));update()}
 // Bring buying or material-selection context into the project request.
 const form=$('#brief-form');
 if(form){
  const params=new URLSearchParams(location.search),interest=(params.get('interes')||'').slice(0,1500),category=(params.get('categoria')||'').slice(0,100);
  if(interest){
   const description=$('#descripcion'),service=$('#servicio'),context=$('.request-context');
   if(!description.value)description.value='Me interesa recibir una cotización de:\n\n'+interest.split(' · ').map(item=>'• '+item).join('\n')+'\n\nAplicación, cantidades y compatibilidad:\n';
   const value=Array.from(service.options).some(option=>option.value&&option.value===category)?category:category==='Cursos'?'Cursos y capacitación':params.get('origen')==='estudio'?'':'Insumos y equipos';
   if(Array.from(service.options).some(option=>option.value===value))service.value=value;
   if(context){context.hidden=false;$('p',context).textContent=interest;const study=params.get('origen')==='estudio';if(study){$('strong',context).textContent='Referencia de tu consulta';$('[data-open-quote]',context).hidden=true}}
   if(form.elements.seleccion)form.elements.seleccion.value=interest;
  }
 }
 // Add useful current-section feedback to the shop navigation.
 if('IntersectionObserver' in window){
  const links=$$('.shop-category-links a');
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){const target=entry.target.hasAttribute('data-printer-catalog')?'impresoras':entry.target.id;links.forEach(link=>{const active=link.getAttribute('href')==='#'+target;link.classList.toggle('is-active',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')})}}),{rootMargin:'-20% 0px -55% 0px',threshold:0});
  $$('.shop-catalog-section').forEach(section=>observer.observe(section));
 }
})();
