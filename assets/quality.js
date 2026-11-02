/* Shared navigation, public search and small task aids. No visitor information is stored. */
(()=>{
 'use strict';
 const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
 const root=document.body.dataset.siteRoot||'';
 const header=$('header.site-header'),mobile=$('#mobile-menu');
 if(header){
  const drops=$$('.nav-dropdown',header);
  drops.forEach(drop=>drop.addEventListener('toggle',()=>{if(drop.open)drops.forEach(other=>{if(other!==drop)other.open=false})}));
  document.addEventListener('click',event=>{if(!header.contains(event.target))drops.forEach(drop=>drop.open=false)});
  document.addEventListener('keydown',event=>{
   if(event.key==='Escape'){
    const open=drops.find(drop=>drop.open);
    if(open){open.open=false;$('summary',open).focus()}
   }
   if(event.key!=='Tab'||!mobile?.classList.contains('open'))return;
   const controls=$$('a,button,summary,input',header).filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  });
 }

 const search=$('[data-site-search]'),openSearch=$('[data-site-search-open]');
 if(search&&openSearch){
  const field=$('[data-site-search-input]',search),results=$('[data-site-search-results]',search),status=$('[data-site-search-status]',search);
  let index=null,find=null,loading=null,opener=null,timer=0;
  const render=()=>{
   if(!index)return;
   const query=field.value.trim(),matches=find(index,query);
   results.replaceChildren(...matches.map(item=>{
    const li=document.createElement('li'),a=document.createElement('a'),title=document.createElement('strong'),copy=document.createElement('small'),group=document.createElement('span');
    a.href=root+item.url;title.textContent=item.title;copy.textContent=item.description;group.textContent=item.group;
    a.append(title,copy,group);li.append(a);return li;
   }));
   status.textContent=query?(matches.length?matches.length+' resultados para «'+query+'»':'No encontramos coincidencias. Prueba con un servicio, material o modelo.'):'Accesos rápidos';
  };
  const load=async()=>{
   if(!loading)loading=Promise.all([fetch(root+'assets/search-index.json').then(response=>{if(!response.ok)throw Error();return response.json()}),import('./search-domain.mjs')]);
   status.textContent='Buscando destinos…';
   try{
    const [items,engine]=await loading;
    index=items.filter(item=>typeof item.url==='string'&&/^[a-z0-9][a-z0-9/.-]*\.html(?:#[a-z0-9-]+)?$/.test(item.url));find=engine.searchIndex;render();
   }catch{
    loading=null;status.replaceChildren(document.createTextNode('No pudimos cargar la búsqueda. '));
    const retry=document.createElement('button');retry.type='button';retry.textContent='Reintentar';retry.addEventListener('click',load,{once:true});status.append(retry);
   }
  };
  const show=()=>{
   if(search.open)return;opener=document.activeElement;
   $('.mobile-menu.open')&&$('.mobile-toggle')?.click();
   search.showModal();field.focus();index?render():load();
  };
  openSearch.hidden=false;openSearch.addEventListener('click',show);
  $('[data-site-search-close]',search).addEventListener('click',()=>search.close());
  search.addEventListener('click',event=>{if(event.target===search)search.close()});
  search.addEventListener('close',()=>{if(opener?.isConnected)opener.focus()});
  field.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,70)});
  field.addEventListener('keydown',event=>{
   if(event.key==='ArrowDown'){event.preventDefault();$('a',results)?.focus()}
   if(event.key==='Enter'){$('a',results)?.click()}
  });
  results.addEventListener('keydown',event=>{
   if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
   const links=$$('a',results),index=links.indexOf(document.activeElement);event.preventDefault();
   if(event.key==='Home')links[0]?.focus();
   else if(event.key==='End')links.at(-1)?.focus();
   else if(event.key==='ArrowUp'&&index===0)field.focus();
   else links[Math.max(0,Math.min(links.length-1,index+(event.key==='ArrowDown'?1:-1)))]?.focus();
  });
  document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();show()}});
 }

 $$('[data-study-open]').forEach(visual=>{
  const open=()=>visual.closest('.portfolio-card')?.querySelector('.project-preview')?.click();
  visual.addEventListener('click',open);
  visual.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}});
 });
 const count=$('[data-material-count]');
 if(count){
  const update=()=>{const cards=$$('.material-card');count.textContent=cards.filter(card=>!card.hidden).length+' de '+cards.length+' familias de materiales'};
  $$('[data-filter]').forEach(button=>button.addEventListener('click',()=>queueMicrotask(update)));update();
 }
 $$('form.lead-form input[type=file]').forEach(file=>{
  const box=document.createElement('div');box.className='quality-file-status';box.setAttribute('role','status');file.after(box);
  const render=()=>{
   box.replaceChildren();const item=file.files?.[0];if(!item)return;
   const size=item.size<1024*1024?Math.ceil(item.size/1024)+' KB':(item.size/1024/1024).toFixed(1)+' MB';
   const text=document.createElement('span');text.textContent=item.name+' · '+size+(item.size>8*1024*1024?' · Supera el límite de 8 MB':'');
   const remove=document.createElement('button');remove.type='button';remove.textContent='Quitar archivo';remove.addEventListener('click',()=>{file.value='';render();file.focus()});box.append(text,remove);
  };
  file.addEventListener('change',render);file.form?.addEventListener('reset',()=>queueMicrotask(render));
 });
 // A task already in flight must finish before accepting another submit.
 document.addEventListener('submit',event=>{if(event.target.getAttribute('aria-busy')==='true'){event.preventDefault();event.stopImmediatePropagation()}},true);

 async function copy(button,text){
  const before=button.textContent;
  try{await navigator.clipboard.writeText(text);button.textContent='Enlace copiado ✓'}catch{button.textContent='Copia la dirección de esta página'}
  setTimeout(()=>button.textContent=before,2400);
 }
 $$('.tools-page .tool').forEach(tool=>{
  const head=$('.tool-head',tool);if(!head)return;
  const actions=document.createElement('div');actions.className='quality-tool-actions';
  const share=document.createElement('button');share.type='button';share.textContent='Copiar enlace';share.addEventListener('click',()=>copy(share,location.origin+location.pathname+'#'+tool.id));actions.append(share);
  const form=$('form',tool);
  if(form&&!['visor','analizador'].includes(tool.id)){
   const reset=document.createElement('button');reset.type='button';reset.textContent='Restablecer valores';reset.addEventListener('click',()=>{form.reset();form.dispatchEvent(new Event('input',{bubbles:true}))});actions.append(reset);
  }
  head.append(actions);
 });
 const tables=()=>$$('.table-wrap,.precision-table-wrap,.tool-table-wrap,.ops-table-wrap').forEach(wrap=>{
  if(wrap.scrollWidth>wrap.clientWidth+1){wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Tabla desplazable horizontalmente')}
  else if(wrap.getAttribute('aria-label')==='Tabla desplazable horizontalmente'){wrap.removeAttribute('tabindex');wrap.removeAttribute('role');wrap.removeAttribute('aria-label')}
 });
 addEventListener('resize',tables,{passive:true});addEventListener('hashchange',()=>requestAnimationFrame(tables));document.fonts?.ready.then(tables);tables();
})();
