/* 3DWORLD / route-aware GSAP storytelling. Native scrolling, no scroll hijacking.
   One vocabulary taken from the shop floor: layers print (veil), labels read out (decode),
   headings rise from their line, steps follow a thread, heroes carry a measuring HUD.
   Home adds a Three.js scene (assets/story/forge.js) loaded only when it is near. */
(()=>{
 'use strict';
 const html=document.documentElement,body=document.body,main=document.querySelector('main');
 const release=()=>html.classList.remove('story-intro');
 if(!main){release();return}
 const root=body.dataset.siteRoot||'';
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const saveData=Boolean(navigator.connection?.saveData);
 const key='3dworld.motion.paused';
 let userPaused=false;try{userPaused=localStorage.getItem(key)==='true'}catch{}
 let media=null,loading=null,revision=0,chapterObserver=null,productObserver=null,introPlayed=false;
 const contexts=new Set(),cleanups=new Set();
 const paused=()=>preference.matches||saveData||userPaused;
 const caption=()=>preference.matches?'Movimiento reducido':saveData?'Ahorro de datos':userPaused?'Reanudar efectos':'Pausar efectos';
 const GLYPHS='0123456789ABCDEFHJKLMNPRSTUVXYZ/+-';
 function paintControls(){
  body.classList.add('story-ready');
  $$('[data-story-motion]').forEach(button=>{
   button.setAttribute('aria-pressed',String(paused()));button.disabled=preference.matches||saveData;
   const label=$('[data-motion-label]',button);if(label)label.textContent=caption();
   button.title=caption();
  });
 }
 function bindControls(){
  $$('[data-story-motion]').forEach(button=>{
   if(button.dataset.storyBound)return;button.dataset.storyBound='true';
   button.addEventListener('click',()=>{userPaused=!userPaused;try{localStorage.setItem(key,String(userPaused))}catch{}restart()});
  });paintControls();
 }
 function chapters(){
  chapterObserver?.disconnect();
  const links=$$('[data-story-link]'),entries=new Map();
  links.forEach(link=>{const target=document.getElementById(decodeURIComponent(link.hash.slice(1)));if(target)entries.set(target,link)});
  if(!entries.size||!('IntersectionObserver' in window))return;
  let current=null;
  const select=link=>{if(current===link)return;current=link;links.forEach(item=>{if(item===link)item.setAttribute('aria-current','location');else item.removeAttribute('aria-current')})};
  chapterObserver=new IntersectionObserver(changes=>{
   changes.forEach(entry=>{if(entry.isIntersecting)select(entries.get(entry.target))});
  },{rootMargin:'-18% 0px -55% 0px',threshold:0});
  entries.forEach((link,target)=>chapterObserver.observe(target));
  select(links[0]);
 }
 function prepareProduct(){
  if(body.dataset.storyProfile!=='product')return false;
  const content=$('[data-product-content]'),nav=$('.product-section-nav');
  if(!content||content.hidden||!nav)return false;
  if(!nav.hasAttribute('data-story-navigation')){
   const row=document.createElement('div'),links=document.createElement('div'),label=document.createElement('span');
   row.className='container story-chapters-inner';links.className='story-chapter-links';label.className='story-path-label';label.textContent='CONOCE TU EQUIPO';
   $$('a',nav).forEach(a=>{a.setAttribute('data-story-link','');links.append(a)});
   row.append(label,links);const button=$('[data-story-motion]');if(button)row.append(button);
   nav.append(row);nav.classList.add('story-chapters');nav.setAttribute('data-story-navigation','');
   const meter=document.createElement('div'),fill=document.createElement('span');meter.className='story-path-progress';meter.setAttribute('aria-hidden','true');fill.setAttribute('data-story-progress','');meter.append(fill);nav.append(meter);
   $$('h2',content).forEach(heading=>heading.setAttribute('data-story-heading',''));
   $$('.product-information,.product-related',content).forEach(section=>section.setAttribute('data-story-section',''));
   const image=$('[data-product-photo]',content);if(image){image.setAttribute('data-story-hero-image','');image.setAttribute('data-story-print','')}
  }
  return true;
 }
 function script(name,file){
  return new Promise((resolve,reject)=>{
   const tag=document.createElement('script');tag.src=new URL(root+'assets/vendor/gsap-3.13.0/'+file,document.baseURI).href;
   tag.dataset.storyLibrary=name;tag.onload=resolve;tag.onerror=()=>reject(new Error('Optional animation library unavailable'));document.head.append(tag);
  });
 }
 function libraries(){
  if(window.gsap&&window.ScrollTrigger)return Promise.resolve();
  if(!loading)loading=(async()=>{await script('core','gsap.min.js');await script('scroll','ScrollTrigger.min.js')})();
  return loading;
 }
 /* Headings keep their markup; each <br>-separated line (or block span) gets a mask. */
 function splitLines(heading){
  if(heading.dataset.storySplit)return $$('.story-line-inner',heading);
  heading.dataset.storySplit='true';
  const make=(line,nodes)=>{const inner=document.createElement('span');inner.className='story-line-inner';inner.append(...nodes);line.append(inner);return inner};
  const kids=[...heading.childNodes].filter(node=>node.nodeType===1||node.textContent.trim());
  if(!heading.querySelector('br')&&kids.length>1&&kids.every(node=>node.nodeType===1&&getComputedStyle(node).display==='block')){
   return kids.map(child=>{child.classList.add('story-line','is-block');return make(child,[...child.childNodes])});
  }
  const lines=[];let bucket=[];
  const flush=()=>{
   if(bucket.some(node=>node.textContent.trim())){const line=document.createElement('span');line.className='story-line';heading.insertBefore(line,bucket[0]);lines.push(make(line,bucket))}
   bucket=[];
  };
  [...heading.childNodes].forEach(node=>{if(node.nodeName==='BR')flush();else bucket.push(node)});
  flush();return lines;
 }
 /* A technical label resolves left to right; assistive technology reads the final text only. */
 function decode(gsap,el,{duration=.75,delay=0,trigger=null}={}){
  if(!el)return null;
  const text=el.textContent;
  if(!text.trim()||el.children.length||el.dataset.storyDecoded)return null;
  el.dataset.storyDecoded='true';
  const restore=()=>{el.textContent=text};cleanups.add(restore);
  let visible=null;const state={p:0};
  return gsap.to(state,{p:1,duration,delay,ease:'none',scrollTrigger:trigger?{trigger,start:'top 90%',once:true}:undefined,
   onStart(){el.textContent='';const sr=document.createElement('span');sr.className='story-sr';sr.textContent=text;visible=document.createElement('span');visible.setAttribute('aria-hidden','true');el.append(sr,visible)},
   onUpdate(){
    if(!visible)return;const fixed=Math.floor(state.p*text.length);let out=text.slice(0,fixed);
    for(let i=fixed;i<text.length;i++)out+=/\s/.test(text[i])?text[i]:GLYPHS[Math.random()*GLYPHS.length|0];
    visible.textContent=out;
   },
   onComplete(){restore();cleanups.delete(restore)}});
 }
 const below=el=>el.getBoundingClientRect().top>innerHeight*.9;
 function veilColor(el){
  for(let node=el.parentElement;node&&node!==document.documentElement;node=node.parentElement){
   const color=getComputedStyle(node).backgroundColor;if(color&&color!=='transparent'&&!/rgba\(.*,\s*0\)$/.test(color))return color;
  }
  return '#f5f8f6';
 }
 /* The print primitive: a veil covers the picture and lifts one layer at a time,
    with a lit edge where material is being deposited. */
 function printBox(box){
  if(getComputedStyle(box).display==='inline')return false;
  if(getComputedStyle(box).position==='static'){box.style.position='relative';cleanups.add(()=>box.style.removeProperty('position'))}
  box.classList.add('story-printing');cleanups.add(()=>box.classList.remove('story-printing'));
  return true;
 }
 function intro(gsap){
  const hero=$('[data-story-hero]');
  if(!hero||introPlayed){release();return}
  introPlayed=true;
  const tl=gsap.timeline({defaults:{ease:'power4.out'}}),at=(tween,position)=>{if(tween)tl.add(tween,position)};
  const heading=$('h1',hero),lines=heading?splitLines(heading):[];
  if(lines.length){gsap.set(lines,{yPercent:112});gsap.set(heading,{opacity:1});tl.to(lines,{yPercent:0,duration:1.05,stagger:.085},.1)}
  const media=$('[data-story-hero-media]',hero);
  if(media&&printBox(media)){
   media.style.setProperty('--story-veil-color',getComputedStyle(hero).backgroundColor);
   gsap.set(media,{'--veil':1});
   tl.to(media,{'--veil':0,duration:1.3,ease:'steps(26)',onComplete:()=>media.classList.remove('story-printing')},0);
  }
  const aula=$('[data-story-scene="aula"]',hero);
  if(aula){
   // The lesson plays out: finished lessons tick, nozzles drop to their height, each line is extruded.
   const lessons=$$('.courses-aula-lessons li',aula),marks=$$(':is(.is-done,.is-open) .courses-aula-mark',aula),bar=$('.courses-aula-progress span',aula);
   const nozzles=$$('.courses-aula-nozzle',aula),beads=$$('.courses-aula-bead,.courses-aula-ridge',aula),frame=$('.courses-aula-frame',aula);
   gsap.set(lessons,{opacity:0,x:-10});gsap.set(nozzles,{y:-18,opacity:0});gsap.set(beads,{scaleX:0,transformOrigin:'0% 50%'});
   if(bar)gsap.set(bar,{scaleX:0,transformOrigin:'left center'});if(frame)gsap.set(frame,{strokeDashoffset:1});
   tl.to(lessons,{opacity:1,x:0,duration:.5,stagger:.1,ease:'power2.out'},.3)
     .fromTo(marks,{scale:.3},{scale:1,duration:.45,stagger:.12,ease:'back.out(2.4)'},.4)
     .to(nozzles,{y:0,opacity:1,duration:.7,stagger:.16,ease:'power3.out'},.6)
     .to(beads,{scaleX:1,duration:.28,stagger:.075,ease:'none'},1.05);
   if(frame)tl.to(frame,{strokeDashoffset:0,duration:.8,ease:'power2.inOut'},1.75);
   if(bar)tl.to(bar,{scaleX:1,duration:1.1,ease:'power2.inOut'},1.2);
   at(decode(gsap,$('.courses-aula-step',aula),{duration:.6}),.6);
   at(decode(gsap,$('.courses-aula-count',aula),{duration:.7}),.9);
  }
  release();
  const label=$(':is(.atelier-eyebrow,.section-index,.workshop-kicker,.store-hero-layout .eyebrow)',hero);
  at(decode(gsap,label,{duration:.8}),.05);
  at(decode(gsap,$('.giant-num',hero),{duration:.9}),.4);
  hud(gsap,tl,at,hero);
 }
 /* Hero HUD: a measuring overlay whose mode matches the page (scan, layers, cad, batch). */
 function hud(gsap,tl,at,hero){
  const panel=$('[data-story-hud]',hero);if(!panel)return;
  const mode=panel.dataset.storyHud,value=$('[data-hud-value]',panel),frame=$$('.story-hud-frame path',panel);
  const set=text=>{if(value&&value.textContent!==text)value.textContent=text};
  gsap.set(panel,{opacity:1});
  tl.fromTo(frame,{strokeDashoffset:1},{strokeDashoffset:0,duration:1.1,stagger:.06,ease:'power2.inOut'},.35);
  at(decode(gsap,$('[data-hud-label]',panel),{duration:.6}),.5);
  const scroller={trigger:hero,start:'top top',end:'bottom top',scrub:.4};
  if(mode==='scan'){
   const beam=$('.story-hud-beam',panel),mask=$('.story-hud-scanned',panel),state={x:0};
   const paint=()=>{beam.setAttribute('x',state.x*400-1);mask.setAttribute('width',state.x*400);set('X '+(state.x*240).toFixed(1).padStart(5,'0')+' mm')};
   tl.fromTo(state,{x:0},{x:1,duration:1.8,ease:'power1.inOut',onUpdate:paint},.55);
   tl.to(beam,{opacity:0,duration:.4},'>-0.1').to($('.story-hud-points',panel),{opacity:.35,duration:1.2,ease:'power1.out'},'<');
  }
  if(mode==='layers'){
   const rows=$$('.story-hud-layer',panel),nozzle=$('.story-hud-nozzle',panel),state={n:0},scroll={n:0};
   const paint=()=>{
    const n=Math.max(state.n,scroll.n),count=Math.round(n*rows.length);
    rows.forEach((row,i)=>row.classList.toggle('is-on',i<count));
    nozzle.setAttribute('y',262-n*220);nozzle.style.opacity=n>0&&n<1?1:0;
    set('CAPA '+String(Math.round(n*310)).padStart(4,'0')+' · Z '+(n*62).toFixed(1)+' mm');
   };
   tl.fromTo(state,{n:0},{n:.35,duration:1.4,ease:'steps(24)',onUpdate:paint},.6);
   gsap.fromTo(scroll,{n:0},{n:1,ease:'none',onUpdate:paint,scrollTrigger:scroller});
  }
  if(mode==='cad'){
   const dims=$$('.story-hud-dim',panel),flags=$$('.story-hud-flag',panel);
   tl.fromTo(dims,{strokeDashoffset:1},{strokeDashoffset:0,duration:.9,stagger:.18,ease:'power2.inOut'},.75);
   tl.fromTo(flags,{opacity:0,scale:.6,transformOrigin:'50% 50%'},{opacity:1,scale:1,duration:.4,stagger:.12,ease:'back.out(2)'},1.35);
   tl.call(()=>set('VISTA ISO · 3 COTAS'),[],1.5);
  }
  if(mode==='batch'){
   const units=$$('.story-hud-unit',panel),state={n:0},scroll={n:0};
   const paint=()=>{const count=Math.round(Math.max(state.n,scroll.n)*units.length);units.forEach((u,i)=>u.classList.toggle('is-on',i<count));set('LOTE '+String(count).padStart(2,'0')+' / '+units.length)};
   tl.fromTo(state,{n:0},{n:.5,duration:1.2,ease:'steps(12)',onUpdate:paint},.7);
   gsap.fromTo(scroll,{n:0},{n:1,ease:'none',onUpdate:paint,scrollTrigger:scroller});
  }
 }
 function headings(gsap){
  $$('[data-story-heading]').forEach(heading=>{
   if(heading.closest('[data-story-hero],[hidden],[data-story-forge]')||!below(heading))return;
   const lines=splitLines(heading);if(!lines.length)return;
   gsap.from(lines,{yPercent:112,duration:1,stagger:.08,ease:'power4.out',scrollTrigger:{trigger:heading,start:'top 88%',once:true}});
  });
  $$('.story-forge-step :is(h2,h3)').forEach(heading=>{
   if(!below(heading))return;
   gsap.from(splitLines(heading),{yPercent:112,duration:1,stagger:.08,ease:'power4.out',scrollTrigger:{trigger:heading,start:'top 80%',once:true}});
  });
  $$('[data-story-section]:not([data-story-hero]) :is(.atelier-eyebrow,.section-index,.workshop-kicker,.detail-index,.story-stage-index,.story-forge-index,.store-section-heading .eyebrow)').forEach(label=>{
   if(!label.closest('[hidden]')&&below(label))decode(gsap,label,{trigger:label});
  });
 }
 function prints(gsap){
  $$('[data-story-print]').forEach(image=>{
   if(image.closest('[data-story-hero],[hidden]'))return;
   const box=image.parentElement;if(!box||!below(box))return;
   const trigger={trigger:box,start:'top 84%',once:true};
   if(printBox(box)){
    box.style.setProperty('--story-veil-color',veilColor(box));
    gsap.fromTo(box,{'--veil':1},{'--veil':0,duration:1.15,ease:'steps(18)',scrollTrigger:trigger,onComplete:()=>box.classList.remove('story-printing')});
   }else{
    gsap.fromTo(image,{clipPath:'inset(100% 0% 0% 0%)'},{clipPath:'inset(0% 0% 0% 0%)',duration:1.15,ease:'steps(18)',clearProps:'clipPath',scrollTrigger:trigger});
   }
   gsap.fromTo(image,{scale:1.07},{scale:1,duration:1.8,ease:'power3.out',clearProps:'transform',scrollTrigger:trigger});
  });
 }
 /* Steps follow a thread: the rail fills with scroll and each step lights when reached. */
 function threads(gsap,ScrollTrigger){
  $$('[data-story-thread]').forEach(list=>{
   const items=[...list.children].filter(item=>item.matches('li,article,tr'));if(items.length<2)return;
   list.classList.add('story-thread-host');cleanups.add(()=>list.classList.remove('story-thread-host'));
   const line=getComputedStyle(list).getPropertyValue('--thread-line').trim()||'62%';
   gsap.fromTo(list,{'--thread':0},{'--thread':1,ease:'none',scrollTrigger:{trigger:list,start:'top '+line,end:'bottom '+line,scrub:.35}});
   items.forEach(item=>ScrollTrigger.create({trigger:item,start:'top '+line,onEnter:()=>item.classList.add('is-reached'),onLeaveBack:()=>item.classList.remove('is-reached')}));
   cleanups.add(()=>items.forEach(item=>item.classList.remove('is-reached')));
  });
 }
 /* Studies: an inspection reticle locks onto each image before it prints. */
 function locks(gsap){
  $$('[data-story-lock]').forEach(box=>{
   if(!below(box))return;
   const reticle=document.createElement('span');reticle.className='story-reticle';reticle.setAttribute('aria-hidden','true');
   reticle.innerHTML='<i></i><i></i><i></i><i></i><b></b>';box.append(reticle);cleanups.add(()=>reticle.remove());
   const corners=$$('i',reticle),cross=$('b',reticle);
   const tl=gsap.timeline({scrollTrigger:{trigger:box,start:'top 80%',once:true}});
   tl.fromTo(corners,{opacity:0,x:i=>i%2?26:-26,y:i=>i<2?-26:26},{opacity:1,x:0,y:0,duration:.7,ease:'expo.out'})
     .fromTo(cross,{opacity:0,scale:2.4},{opacity:1,scale:1,duration:.45,ease:'expo.out'},'-=.35')
     .to(reticle,{opacity:.38,duration:.8,ease:'power1.out'},'+=.5');
  });
 }
 /* Home method: four chapters share one sticky screen. */
 function processStage(gsap,ScrollTrigger){
  const stage=$('[data-story-process]');if(!stage)return;
  const panels=$$('[data-process-panel]',stage),steps=$$('[data-process-step]',stage),count=$('[data-process-count]',stage),label=$('[data-process-label]',stage);
  let active=Math.max(0,panels.findIndex(panel=>panel.classList.contains('is-current')));
  gsap.set(panels,{opacity:i=>i===active?1:0,scale:1});
  const fades=panels.map(panel=>gsap.quickTo(panel,'opacity',{duration:.55,ease:'power2.inOut'}));
  const trace=gsap.fromTo($$('.story-process-register path',stage),{strokeDashoffset:1},{strokeDashoffset:0,duration:.95,stagger:.08,ease:'power2.inOut',paused:true});
  function scene(index){
   if(index===active&&stage.dataset.storyStage)return;active=index;stage.dataset.storyStage=String(index+1);
   panels.forEach((panel,i)=>{panel.classList.toggle('is-current',i===index);fades[i](i===index?1:0);gsap.to(panel,{scale:i===index?1:1.035,duration:.8,ease:'power2.out',overwrite:'auto'})});
   steps.forEach((step,i)=>step.classList.toggle('is-current',i===index));
   count.textContent=String(index+1).padStart(2,'0')+' / 04';label.textContent=steps[index].dataset.processLabel;trace.restart();
  }
  scene(active);
  steps.forEach((step,index)=>ScrollTrigger.create({trigger:step,start:'top 58%',end:'bottom 58%',onEnter:()=>scene(index),onEnterBack:()=>scene(index)}));
  gsap.fromTo($('[data-process-progress]',stage),{scaleX:0},{scaleX:1,ease:'none',scrollTrigger:{trigger:steps[0],endTrigger:steps[steps.length-1],start:'top 65%',end:'bottom 55%',scrub:.3}});
 }
 function webgl(){
  try{const canvas=document.createElement('canvas');return Boolean(canvas.getContext('webgl2')||canvas.getContext('webgl'))}catch{return false}
 }
 /* Home: "Así nace una pieza". Scroll progress drives the Three.js part; text stays in the page. */
 function forge(ScrollTrigger){
  const section=$('[data-story-forge]');if(!section||!webgl())return;
  const stage=$('.story-forge-stage',section),canvas=$('canvas',section),steps=$$('[data-forge-step]',section);
  const stageLabel=$('[data-forge-stage]',section),metric=$('[data-forge-metric]',section),meter=$$('.story-forge-meter li',section);
  const labels={diameter:$('[data-forge-label="diameter"]',section),height:$('[data-forge-label="height"]',section)};
  const names=steps.map(step=>step.dataset.forgeStep);
  const number=n=>n.toLocaleString('es-MX').replace(/,/g,' ');
  let controller=null,alive=true,trigger=null,lastStage=-1,lastMetric='';
  const paint=frame=>{
   if(frame.stage!==lastStage){
    lastStage=frame.stage;section.dataset.forgeActive=String(frame.stage);
    stageLabel.textContent=String(frame.stage+1).padStart(2,'0')+' / '+names[frame.stage];
    meter.forEach((item,i)=>item.classList.toggle('is-on',i<=frame.stage));
   }
   const text=frame.stage===0?number(frame.points)+' puntos':frame.stage===1?number(frame.edges)+' aristas':frame.stage===2?'Capa '+String(frame.layer).padStart(3,'0')+' / '+frame.layers+' · Z '+frame.z.toFixed(1)+' mm':'Mapa de desviación';
   if(text!==lastMetric){lastMetric=text;metric.textContent=text}
   for(const name of ['diameter','height']){
    const el=labels[name];if(!el)continue;
    if(frame.labels){el.style.opacity=frame.labels.opacity;el.style.transform=`translate(${frame.labels[name].x}px,${frame.labels[name].y}px) translate(-50%,-50%)`}
    else if(el.style.opacity!=='0')el.style.opacity='0';
   }
  };
  const visible=new IntersectionObserver(entries=>{if(!controller)return;entries[0].isIntersecting&&!document.hidden?controller.start():controller.stop()});
  const onVisibility=()=>{if(!controller)return;document.hidden?controller.stop():stage.getBoundingClientRect().bottom>0&&controller.start()};
  const pointer=event=>{if(!controller||event.pointerType!=='mouse')return;const box=stage.getBoundingClientRect();controller.setPointer((event.clientX-box.left)/box.width*2-1,(event.clientY-box.top)/box.height*2-1)};
  const near=new IntersectionObserver(async entries=>{
   if(!entries.some(entry=>entry.isIntersecting))return;near.disconnect();
   try{
    const {mountForge,chapterProgress}=await import(new URL(root+'assets/story/forge.js?v=forge-2',document.baseURI).href);
    if(!alive)return;
    // A disposed renderer loses its context; every mount draws on a fresh canvas.
    const surface=document.createElement('canvas');surface.className=canvas.className;$('canvas',section).replaceWith(surface);
    controller=mountForge({canvas:surface,compact:innerWidth<1024,onFrame:paint});
    section.classList.add('is-live');
    // Each chapter starts when its heading enters the reading area. Measuring the
    // actual copy also follows font loading, wrapping and compact bottom alignment.
    const headings=steps.map(step=>$('h3',step)),lastCopy=$('p:not(.story-forge-index)',steps[steps.length-1]);
    let landmarks=[];
    const measure=()=>{
     landmarks=headings.map(heading=>heading.getBoundingClientRect().top+scrollY);
     landmarks.push(Math.max(landmarks[landmarks.length-1]+1,lastCopy.getBoundingClientRect().bottom+scrollY+innerHeight*.2));
    };
    const sync=self=>controller.setProgress(chapterProgress(self.scroll()+innerHeight*.8,landmarks));
    measure();
    trigger=ScrollTrigger.create({trigger:headings[0],start:'top 80%',endTrigger:lastCopy,end:'bottom 60%',onRefresh:self=>{measure();sync(self)},onUpdate:sync});
    sync(trigger);
    visible.observe(stage);section.addEventListener('pointermove',pointer,{passive:true});document.addEventListener('visibilitychange',onVisibility);
   }catch{section.classList.remove('is-live');controller?.dispose();controller=null}
  },{rootMargin:'900px 0px'});
  near.observe(section);
  cleanups.add(()=>{
   alive=false;near.disconnect();visible.disconnect();trigger?.kill();controller?.dispose();controller=null;
   section.classList.remove('is-live');delete section.dataset.forgeActive;
   section.removeEventListener('pointermove',pointer);document.removeEventListener('visibilitychange',onVisibility);
  });
 }
 function stop(){
  revision++;media?.revert();media=null;contexts.forEach(context=>context.revert());contexts.clear();
  cleanups.forEach(fn=>fn());cleanups.clear();
  body.classList.remove('story-effects-active');$$('.story-media-is-active').forEach(el=>el.classList.remove('story-media-is-active'));
 }
 function mount(){
  const {gsap,ScrollTrigger}=window;
  gsap.registerPlugin(ScrollTrigger);gsap.config({autoSleep:60});ScrollTrigger.config({ignoreMobileResize:true,limitCallbacks:true});
  body.classList.add('story-effects-active');body.dataset.storyEngine='gsap';
  const shared=gsap.context(()=>{intro(gsap);headings(gsap);prints(gsap);threads(gsap,ScrollTrigger);locks(gsap);forge(ScrollTrigger)});
  contexts.add(shared);
  media=gsap.matchMedia();
  media.add({desktop:'(min-width:1024px)',fine:'(pointer:fine)',tall:'(min-height:650px)'},match=>{
   const desktop=match.conditions.desktop&&match.conditions.fine&&match.conditions.tall;
   const context=gsap.context(()=>{
    const close=$('[data-story-closing] .footer-cta h2');
    if(close&&below(close))gsap.from(splitLines(close),{yPercent:112,duration:1,stagger:.08,ease:'power4.out',scrollTrigger:{trigger:close,start:'top 88%',once:true}});
    $$('[data-story-progress]').forEach(fill=>{
     gsap.fromTo(fill,{scaleX:0},{scaleX:1,ease:'none',scrollTrigger:{trigger:main,start:'top top',end:'bottom bottom',scrub:.25}});
    });
    if(desktop){
     const heroImage=$('[data-story-hero-image]');
     if(heroImage){
      const trigger=heroImage.closest('[data-story-hero],.product-layout')||heroImage;
      heroImage.parentElement.classList.add('story-image-frame');
      gsap.fromTo(heroImage,{scale:1.055},{scale:1,ease:'none',scrollTrigger:{trigger,start:'top top',end:'bottom top',scrub:.65,invalidateOnRefresh:true,onToggle:self=>heroImage.classList.toggle('story-media-is-active',self.isActive)}});
     }
     processStage(gsap,ScrollTrigger);
    }
   });
   contexts.add(context);
   return ()=>{context.revert();contexts.delete(context)};
  });
  ScrollTrigger.refresh();
 }
 async function restart(){
  stop();paintControls();
  if(paused()){release();body.dataset.storyEngine='paused';return}
  const ticket=revision;body.dataset.storyEngine='loading';
  try{await libraries();if(ticket!==revision||paused()){release();return}mount()}
  catch{stop();release();body.dataset.storyEngine='native'}
 }
 prepareProduct();bindControls();chapters();
 if(body.dataset.storyProfile==='product'&&!prepareProduct()){
  const target=$('[data-product-content]');
  if(target){productObserver=new MutationObserver(()=>{if(prepareProduct()){productObserver.disconnect();bindControls();chapters();restart()}});productObserver.observe(target,{childList:true,attributes:true,attributeFilter:['hidden']})}
 }
 preference.addEventListener('change',restart);
 document.addEventListener('toggle',event=>{if(event.target.closest?.('main')&&body.dataset.storyEngine==='gsap')window.ScrollTrigger?.refresh(true)},true);
 document.fonts?.ready.then(()=>{if(body.dataset.storyEngine==='gsap')window.ScrollTrigger.refresh(true)});
 addEventListener('load',()=>{if(body.dataset.storyEngine==='gsap')window.ScrollTrigger.refresh(true)},{once:true});
 addEventListener('pageshow',event=>{if(event.persisted&&body.dataset.storyEngine==='gsap')window.ScrollTrigger.refresh(true)});
 addEventListener('pagehide',()=>{productObserver?.disconnect()},{once:true});
 // The hero waits for the libraries only while the head boot class holds it; start at once.
 if(paused()||html.classList.contains('story-intro'))restart();
 else if('requestIdleCallback' in window)requestIdleCallback(restart,{timeout:700});
 else setTimeout(restart,0);
})();
