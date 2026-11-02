(()=>{
 const host=document.querySelector('[data-store-list]');if(!host)return;
 const $=s=>host.querySelector(s), grid=$('[data-store-grid]'), form=$('form');
 let category='',shown=12,store,rules;
 const groups={insumos:['filamentos','resinas'],creality:[],catalogo:[]};
 const intros={insumos:'Filamentos y resinas: dos procesos, materiales distintos. Revisa la presentación y la compatibilidad de cada producto.',resinas:'Resinas para fotopolimerización. Consulta la presentación, la ficha técnica y la hoja de seguridad del fabricante.',postproceso:'Lavado y curado de piezas de resina. Comprueba las dimensiones y el proceso recomendado para tu material.',herramientas:'Herramientas para preparar, retirar y terminar piezas. Revisa el contenido de cada kit.'};
 function stateFromURL(){
  try{category=decodeURIComponent(location.hash.slice(1))}catch{category=''}
  const known=['paquetes','cursos','insumos','creality','catalogo','impresoras','impresoras-resina','filamentos','resinas','accesorios','refacciones','postproceso','herramientas','escaneres','laser'];
  if(!known.includes(category))category='';
  const q=new URLSearchParams(location.search);form.elements.buscar.value=q.get('buscar')||'';form.elements.marca.value=q.get('marca')||'';form.elements.orden.value=q.get('orden')||'relevancia';if(form.elements.estado)form.elements.estado.value=q.get('estado')||'';if(category==='creality')form.elements.marca.value='Creality';
 }
 function writeURL(){const q=new URLSearchParams();for(const key of ['buscar','marca','orden','estado']){const v=form.elements[key]?.value;if(v&&v!=='relevancia')q.set(key,v)}history.replaceState(null,'',location.pathname+(q.size?'?'+q:'')+(category?'#'+category:'#catalogo'))}
 function render(){
  if(!store)return;
  const allowed=groups[category]||[category],query=rules.normalize(form.elements.buscar.value.trim()),brand=form.elements.marca.value;
  let list=store.products.filter(p=>(!category||category==='catalogo'||category==='creality'||allowed.includes(p.category))&&(!brand||p.brand===brand)&&query.split(/\s+/).every(term=>rules.normalize([p.title,p.summary,p.brand,...p.variants.map(v=>v.label)].join(' ')).includes(term)));
  const availability=form.elements.estado?.value||'';
  if(availability)list=list.filter(p=>availability==='propio'?p.variants.some(v=>v.ownStock>0):availability==='comprar'?p.variants.some(v=>v.available):!p.variants.some(v=>v.available));
  const min=p=>Math.min(...(p.variants.some(v=>v.available)?p.variants.filter(v=>v.available):p.variants).map(v=>v.price));
  if(form.elements.orden.value==='precio-asc')list.sort((a,b)=>min(a)-min(b));
  if(form.elements.orden.value==='precio-desc')list.sort((a,b)=>min(b)-min(a));
  if(form.elements.orden.value==='nombre')list.sort((a,b)=>a.title.localeCompare(b.title,'es'));
  $('[data-store-count]').textContent=list.length+' '+(list.length===1?'producto':'productos')+' · '+Math.min(shown,list.length)+' visibles';
  $('[data-category-intro]').textContent=intros[category]||'';
  grid.replaceChildren(...list.slice(0,shown).map(card));
  $('[data-store-empty]').hidden=!!list.length;$('[data-store-more]').hidden=shown>=list.length;
  host.querySelectorAll('[data-category]').forEach(a=>{const active=a.dataset.category===(category==='catalogo'?'':category);a.setAttribute('aria-current',active?'true':'false')});
  const chips=$('[data-store-active]');
  if(chips){
   const filters=[];
   if(category&&!['catalogo','creality'].includes(category))filters.push(['categoria',store.categories.find(c=>c.id===category)?.label||category]);
   if(form.elements.buscar.value.trim())filters.push(['buscar','Buscar: '+form.elements.buscar.value.trim()]);
   if(brand)filters.push(['marca',brand]);
   if(availability)filters.push(['estado',form.elements.estado.selectedOptions[0].textContent]);
   chips.replaceChildren(...filters.map(([key,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label+' ×';b.setAttribute('aria-label','Quitar filtro: '+label);b.addEventListener('click',()=>{if(key==='categoria')category='';else form.elements[key].value='';shown=12;writeURL();render();form.elements.buscar.focus({preventScroll:true})});return b}));
  }
 }
 function card(p){
  const v=p.variants.find(v=>v.available)||p.variants[0],url=rules.productUrl(p,v.id),categoryName=store.categories.find(c=>c.id===p.category)?.label||'';
  const el=document.createElement('article');el.className='store-card';
  const link=document.createElement('a');link.className='store-card-image';link.href=url;link.setAttribute('aria-label','Ver ficha de '+p.title);
  const img=document.createElement('img');img.src=v.image;img.alt=p.title;img.loading='lazy';img.decoding='async';img.width=600;img.height=600;
  if(p.imageFocus)img.style.objectPosition=p.imageFocus; // where the part sits in a wide photo (content/catalogo-propio.json)
  img.addEventListener('error',()=>{img.hidden=true;link.classList.add('image-unavailable');link.dataset.fallback='Consultar imagen del fabricante'},{once:true});
  const hint=document.createElement('span');hint.className='store-image-hint';hint.textContent='Explorar producto ↗';link.append(img,hint);
  const body=document.createElement('div');body.className='store-card-body';
  const meta=document.createElement('p');meta.className='store-card-meta';meta.textContent=p.brand+' / '+categoryName;
  const h=document.createElement('h3'),a=document.createElement('a');a.href=url;a.textContent=p.title;h.append(a);
  const priced=p.variants.some(v=>v.available)?p.variants.filter(v=>v.available):p.variants;
  const price=document.createElement('p');price.className='store-card-price';price.textContent=(new Set(priced.map(v=>v.price)).size>1?'Desde ':'')+rules.money(Math.min(...priced.map(v=>v.price)));
  const status=document.createElement('span');status.className='store-availability';status.textContent=p.variants.some(v=>v.ownStock>0)?'En existencia en 3DWORLD':p.variants.some(v=>v.available)?'Bajo pedido':'Consultar disponibilidad';
  const foot=document.createElement('a');foot.className='store-card-link';foot.href=url;const ready=p.variants.filter(v=>v.available).length;
  foot.textContent=p.variants.length<2?'Ver especificaciones ↗':ready&&ready<p.variants.length?'Ver '+ready+' disponibles de '+p.variants.length+' ↗':'Ver '+p.variants.length+' presentaciones ↗';
  body.append(meta,h,price,status,foot);el.append(link,body);return el;
 }
 stateFromURL();
 form.addEventListener('submit',e=>e.preventDefault());
 let timer;form.addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(()=>{shown=12;writeURL();render()},e.target.type==='search'?160:0)});
 host.querySelectorAll('[data-store-reset]').forEach(b=>b.addEventListener('click',()=>{category='';form.reset();shown=12;writeURL();render()}));
 $('[data-store-more]').addEventListener('click',()=>{const previous=shown;shown+=12;render();grid.children[previous]?.querySelector('a')?.focus({preventScroll:true})});
 addEventListener('hashchange',()=>{stateFromURL();shown=12;if(store){render();if(category)host.scrollIntoView({block:'start'})}});
 addEventListener('popstate',()=>{stateFromURL();shown=12;if(store)render()});
 $('[data-store-retry]').addEventListener('click',()=>location.reload());
 window.storeReady.then(({data,rules:r})=>{store=data;rules=r;
  const nav=$('[data-store-categories]');nav.replaceChildren();for(const c of [{id:'',label:'Todo el catálogo',count:store.products.length},...store.categories]){const a=document.createElement('a');a.href='#'+(c.id||'catalogo');a.dataset.category=c.id;const label=document.createElement('span'),n=document.createElement('small');label.textContent=c.label;n.textContent=c.count;a.append(label,n);nav.append(a)}render();
  if(category)host.scrollIntoView({block:'start',behavior:'instant'});
 }).catch(()=>{$('[data-store-error]').hidden=false;$('[data-store-count]').textContent=grid.children.length?'Puedes consultar las fichas y el índice completo. Los filtros no están disponibles en este momento.':'El catálogo no está disponible en este momento.'});
})();
