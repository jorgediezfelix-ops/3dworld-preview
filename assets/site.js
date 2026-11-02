/* Native navigation and progressive enhancement; no continuous animation loop. */
(()=>{
  'use strict';
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
  const toggle=$('.mobile-toggle'),mobile=$('.mobile-menu');
  if(toggle&&mobile){
    const setMenuOpen=open=>{
      mobile.classList.toggle('open',open);
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
      document.body.classList.toggle('menu-open',open);
      // The panel locks scrolling; background content must also leave the tab order.
      $$('main,footer').forEach(el=>el.inert=open);
    };
    toggle.addEventListener('click',()=>setMenuOpen(toggle.getAttribute('aria-expanded')!=='true'));
    mobile.addEventListener('click',event=>{if(event.target.closest('a'))setMenuOpen(false)});
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&mobile.classList.contains('open')){setMenuOpen(false);toggle.focus()}
    });
    matchMedia('(min-width:1280px)').addEventListener('change',event=>{if(event.matches)setMenuOpen(false)});
  }
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  // A reading aid belongs to articles, not to checkout or every page on the site.
  const progress=document.body.classList.contains('reading-page')?$('.progress-track'):null;
  if(progress){
    let extent=0,frame=0;
    const paint=()=>{frame=0;progress.style.transform='scaleX('+Math.min(1,Math.max(0,extent?scrollY/extent:0))+')'};
    const requestPaint=()=>{if(!frame&&!motionPreference.matches)frame=requestAnimationFrame(paint)};
    const measure=()=>{extent=Math.max(0,document.documentElement.scrollHeight-innerHeight);requestPaint()};
    addEventListener('scroll',requestPaint,{passive:true});addEventListener('resize',measure,{passive:true});
    if('ResizeObserver' in window)new ResizeObserver(measure).observe(document.body);
    addEventListener('load',measure,{once:true});motionPreference.addEventListener('change',measure);measure();
  }
  $$('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{const category=btn.dataset.filter;$$('[data-filter]').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-pressed',String(b===btn))});$$('.material-card').forEach(card=>{card.hidden=category!=='todos'&&!card.dataset.category.split(' ').includes(category)})}));
  const form=$('#brief-form');
  // Project requests go to Netlify Forms (the file travels with them); the folio identifies the request.
  if(form){const workshop=form.dataset.workshopIntake!==undefined;
   if(workshop)$$('[data-workshop-service]').forEach(link=>link.addEventListener('click',()=>{
    const service=form.elements.servicio;
    if(service&&Array.from(service.options).some(option=>option.value===link.dataset.workshopService))service.value=link.dataset.workshopService;
   }));
   let sending=false;
   form.addEventListener('submit',async e=>{e.preventDefault();if(sending||!form.reportValidity())return;
   const notice=$('#form-status'),button=form.querySelector('[type="submit"]'),file=form.elements.archivo?.files?.[0];
   if(file&&file.size>8*1024*1024){notice.textContent='El archivo pesa más de 8 MB. Comprímelo en un ZIP o envíanos un enlace en la descripción.';return}
   const day=new Date().toISOString().slice(2,10).replaceAll('-',''),code=Array.from(crypto.getRandomValues(new Uint8Array(3)),n=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[n%31]).join('');
   const folio=(workshop?'T-':'P-')+day+'-'+code;form.elements.folio.value=folio;sending=true;button.disabled=true;form.setAttribute('aria-busy','true');notice.textContent='Enviando tu solicitud…';
   try{const response=await fetch(form.getAttribute('action')||'/',{method:'POST',body:new FormData(form),...(typeof AbortSignal!=='undefined'&&AbortSignal.timeout?{signal:AbortSignal.timeout(25000)}:{})});if(!response.ok)throw new Error();
    form.reset();notice.textContent='Recibimos tu solicitud con el folio '+folio+(workshop?'. Te contactamos para revisar tu equipo y confirmar cómo enviarlo.':'. Te escribimos por correo o WhatsApp para revisar tu proyecto.');notice.setAttribute('role','status')}
   catch{notice.textContent='No pudimos enviar tu solicitud. Conservamos tus datos en el formulario. Revisa tu conexión e inténtalo de nuevo.'}
   finally{sending=false;button.disabled=false;form.removeAttribute('aria-busy')}
  });}
  $$('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
})();
