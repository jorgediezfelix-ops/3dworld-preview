/* Browser-local presentation behavior; no requests, uploads or storage. */
(()=>{
 'use strict';
 const choices=[...document.querySelectorAll('[data-material-choice]')];
 const materials={
  pa12:{title:'PA12: resistente y versátil.',copy:'Una poliamida muy usada en impresión 3D industrial para prototipos y piezas funcionales. Elegimos el grado según la función y el ambiente de uso.',image:'assets/photos/nylon.webp',alt:'Probeta blanca de poliamida',label:'PA12 / ESTUDIO MATERIAL'},
  pacf:{title:'PA-CF: más rígida y estable.',copy:'Poliamida reforzada con fibra de carbono para piezas que necesitan rigidez y estabilidad dimensional. Revisamos la humedad y la orientación de impresión en cada caso.',image:'assets/photos/compuesto.webp',alt:'Probeta oscura de polímero reforzado',label:'PA · CF / ESTUDIO MATERIAL'},
  resina:{title:'Resinas: detalle y acabado fino.',copy:'Para piezas pequeñas con mucho detalle y superficies lisas. Cada resina necesita su proceso de lavado y curado.',image:'assets/photos/transparente-v2.webp',alt:'Componente translúcido de resina',label:'RESINAS / ESTUDIO MATERIAL'}
 };
 choices.forEach(button=>button.addEventListener('click',()=>{
  const material=materials[button.dataset.materialChoice];if(!material)return;
  choices.forEach(choice=>choice.setAttribute('aria-pressed',String(choice===button)));
  document.querySelector('#home-material-title').textContent=material.title;
  document.querySelector('#home-material-description').textContent=material.copy;
  const image=document.querySelector('#home-material-image');image.src=material.image;image.alt=material.alt;
  document.querySelector('#home-material-label').textContent=material.label;
 }));
 // Native details stay keyboard-accessible; one method chapter is open at a time.
 const chapters=[...document.querySelectorAll('.atelier-step')];
 chapters.forEach(chapter=>chapter.addEventListener('toggle',()=>{
  if(chapter.open)chapters.forEach(other=>{if(other!==chapter)other.open=false});
 }));
 // Keep the mobile navigation state consistent after rotating or resizing a device.
 const media=matchMedia('(min-width:1280px)');
 media.addEventListener('change',event=>{
  if(!event.matches)return;
  const menu=document.querySelector('.mobile-menu'),toggle=document.querySelector('.mobile-toggle');
  menu?.classList.remove('open');document.body.classList.remove('menu-open');
  if(toggle){toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir menú de navegación')}
 });
})();
