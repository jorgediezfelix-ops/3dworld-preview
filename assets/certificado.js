/* Certificado 3DWORLD: verifies a folio with /api/certificado and shows the document ready to print or save as PDF.
   The same document, with sample data, illustrates the certificate on cursos.html ([data-cert-sample]).
   The QR code comes from assets/qr.js and opens the verification page of the folio. */
(()=>{
 const root=document.body.dataset.siteRoot||'';
 function h(tag,attrs={},...children){const el=document.createElement(tag);for(const [k,v] of Object.entries(attrs))k==='class'?el.className=v:k==='text'?el.textContent=v:k==='html'?el.innerHTML=v:el.setAttribute(k,v);el.append(...children.filter(x=>x!==null&&x!==undefined&&x!==false));return el}
 const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
 const longDate=value=>new Intl.DateTimeFormat('es-MX',{dateStyle:'long'}).format(new Date(value));
 const hours=n=>(Number.isInteger(n)?n:String(n).replace('.',','))+(n===1?' hora':' horas');

 // The 3DWORLD globe as a slicer shows it: a stack of layers, one being printed, with the folio around the rim.
 function seal(c,course,id){
  const slices=[];
  for(let k=-9;k<=9;k++){const y=k*6.3,rx=Math.sqrt(3600-y*y);slices.push(`<ellipse${k===3?' class="is-layer"':''} cx="100" cy="${(100+y).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx*.2).toFixed(1)}"/>`)}
  const layer=100+3*6.3,nozzle=100+Math.sqrt(3600-18.9*18.9);
  const ring=`${c.kind==='constancia'?'Constancia 3DWORLD · Inscripción vigente':'Certificado 3DWORLD · '+(course?'Examen aprobado':'Asistencia validada')} · Folio ${c.folio} · `;
  return `<svg class="cert-seal" viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="${id}-glow" cx="40%" cy="36%" r="70%">`
   +`<stop offset="0" stop-color="#3d7fe0" stop-opacity=".6"/><stop offset="1" stop-color="#07131e" stop-opacity="0"/></radialGradient>`
   +`<path id="${id}-ring" d="M100 13a87 87 0 1 1 0 174a87 87 0 1 1 0-174"/></defs>`
   +`<circle class="seal-rim" cx="100" cy="100" r="96"/><circle class="seal-rim" cx="100" cy="100" r="78"/>`
   +`<text class="seal-text"><textPath href="#${id}-ring" textLength="538" lengthAdjust="spacing">${esc(ring)}</textPath></text>`
   +`<circle class="seal-globe" cx="100" cy="100" r="60" fill="url(#${id}-glow)"/><g class="seal-slices">${slices.join('')}</g>`
   +`<ellipse class="seal-meridian" cx="100" cy="100" rx="22" ry="60"/><circle class="seal-nozzle" cx="${nozzle.toFixed(1)}" cy="${layer.toFixed(1)}" r="2.6"/></svg>`;
 }

 // Dark modules on a light tile with a four-module quiet zone, so any phone camera reads it.
 function qr(text){
  const m=window.qrMatrix&&window.qrMatrix(text);if(!m)return '';
  const n=m.length,q=4;let d='';
  m.forEach((row,y)=>{for(let x=0;x<n;){if(!row[x]){x++;continue}const s=x;while(x<n&&row[x])x++;d+=`M${s+q} ${y+q}h${x-s}v1h-${x-s}z`}});
  return `<svg viewBox="0 0 ${n+2*q} ${n+2*q}" role="img" aria-label="Código QR para verificar este certificado" shape-rendering="crispEdges">`
   +`<rect width="${n+2*q}" height="${n+2*q}" fill="#f2f7fa"/><path d="${d}" fill="#07131e"/></svg>`;
 }

 function documentFor(c,link){
  const course=c.kind==='curso',study=c.kind==='constancia';
  const score=typeof c.score==='number'?c.score+' %':c.score;
  const cells=[['Duración',c.hours?hours(c.hours):null],course?['Calificación',score]:study?['Avance a la fecha',c.progress+' %']:['Modalidad','Capacitación en vivo'],
   ['Fecha de emisión',longDate(c.date)],['Folio',c.folio,'is-folio']].filter(([,value])=>value!==null&&value!==undefined);
  const name=h('h2',{class:'cert-name',text:c.name});
  // Long names step down in size so they keep to two lines.
  name.style.setProperty('--name-size',Math.min(6.8,Math.max(4,118/c.name.length)).toFixed(2)+'cqi');
  return h('article',{class:'cert-doc','aria-label':'Certificado de '+c.name},h('div',{class:'cert-sheet'},
   ...['tl','tr','bl','br'].map(corner=>h('span',{class:'cert-mark is-'+corner,'aria-hidden':'true'})),
   h('header',{class:'cert-head'},h('img',{src:root+'assets/3dworld-logo-horizontal-light.svg',alt:'3DWORLD',width:'289',height:'61'}),
    h('p',{class:'cert-kind'},h('strong',{text:course?'Certificado de aprobación':study?'Constancia de estudios':'Certificado de participación'}),
     h('span',{text:'Formación técnica en diseño CAD, impresión y escaneo 3D'}))),
   h('div',{class:'cert-main'},
    h('div',{class:'cert-who'},h('p',{class:'cert-intro',text:study?'Se hace constar que':'Se otorga a'}),name,
     h('p',{class:'cert-reason',text:course?'por haber aprobado el curso en línea':study?'está inscrito en el curso en línea':'por haber participado en'}),
     h('h3',{class:'cert-course',text:c.title})),
    h('div',{class:'cert-seal-box',html:seal(c,course,'seal-'+c.folio.replace(/[^\w-]/g,''))})),
   h('div',{class:'cert-block'},
    ...cells.map(([label,value,cls])=>h('div',{class:'cert-cell'+(cls?' '+cls:'')},h('span',{text:label}),h('b',{text:value}))),
    h('div',{class:'cert-cell is-wide'},h('span',{text:'Emitido por'}),h('b',{text:'3DWORLD'})),
    h('div',{class:'cert-cell is-wide is-link'},h('span',{text:'Verificación'}),h('b',{text:link.replace(/^https?:\/\//,'')})),
    h('div',{class:'cert-qr',html:qr(link)}))));
 }

 // Sample on the courses page: the real layout with the data a student receives.
 document.querySelectorAll('[data-cert-sample]').forEach(el=>{
  el.replaceChildren(documentFor({name:'Tu nombre',title:el.dataset.certTitle,hours:Number(el.dataset.certHours),score:'80 % o más',kind:'curso',
   folio:'3DWC-0000-0000',date:new Date().toISOString()},new URL(root+'certificado.html',location.href).href));
 });

 const host=document.querySelector('[data-certificate]');if(!host)return;
 const form=host.querySelector('form'),status=host.querySelector('[data-cert-status]'),result=host.querySelector('[data-cert-result]');
 let verification=0;
 function render(c){
  const link=location.origin+location.pathname+'?folio='+encodeURIComponent(c.folio);
  const copy=h('button',{type:'button',class:'btn light',text:'Copiar enlace'});
  copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link);copy.textContent='Enlace copiado ✓'}catch{copy.textContent='Copia la dirección de esta página'}});
  const print=h('button',{type:'button',class:'btn primary',text:'Descargar PDF'});print.addEventListener('click',()=>window.print());
  document.title=(c.kind==='constancia'?'Constancia ':'Certificado ')+c.folio+' · '+c.name+' | 3DWORLD';
  result.replaceChildren(
   h('div',{class:'container'},
    h('div',{class:'cert-verified',role:'status'},h('strong',{text:c.kind==='constancia'?'Constancia auténtica':'Certificado auténtico'}),h('span',{text:'Emitido por 3DWORLD · folio '+c.folio}),h('div',{class:'cert-actions'},copy,print)),
    h('p',{class:'cert-hint',text:'Para guardarlo en PDF, elige «Guardar como PDF» en la ventana de impresión. Comparte el enlace de esta página para que cualquiera lo verifique.'}),
    documentFor(c,link)));
  result.hidden=false;
 }
 async function verify(folio){
  folio=String(folio||'').trim().toUpperCase();
  if(!folio)return;
  const ticket=++verification,button=form.querySelector('[type=submit]');form.setAttribute('aria-busy','true');if(button)button.disabled=true;
  status.textContent='Verificando el folio…';result.hidden=true;
  try{
   const response=await fetch(root+'api/certificado?folio='+encodeURIComponent(folio),typeof AbortSignal!=='undefined'&&AbortSignal.timeout?{signal:AbortSignal.timeout(20000)}:{});
   const data=await response.json().catch(()=>({}));
   if(ticket!==verification)return;
   if(!response.ok)throw new Error(data.error||'No pudimos verificar el certificado.');
   status.textContent='';render(data.certificate);
   if(new URLSearchParams(location.search).get('folio')!==folio)history.replaceState(null,'','?folio='+encodeURIComponent(folio));
  }catch(error){if(ticket===verification)status.textContent=error.name==='TimeoutError'?'La verificación está tardando demasiado. Inténtalo de nuevo.':error.message}
  finally{if(ticket===verification){form.removeAttribute('aria-busy');if(button)button.disabled=false}}
 }
 form.addEventListener('submit',event=>{event.preventDefault();verify(form.elements.folio.value)});
 const folio=new URLSearchParams(location.search).get('folio');
 if(folio){form.elements.folio.value=folio;verify(folio)}
})();
