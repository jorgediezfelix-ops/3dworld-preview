/* Presentation-only mode, injected into the GitHub Pages copy by the preview builder. */
(()=>{
 'use strict';
 const purchase='[data-cart-item],[data-product-add],.cart-checkout';
 document.addEventListener('submit',event=>{
  if(event.target.matches('[data-preview-disabled]')){event.preventDefault();event.stopImmediatePropagation()}
 },true);
 document.addEventListener('click',event=>{
  if(event.target.closest(purchase)){event.preventDefault();event.stopImmediatePropagation()}
 },true);
 const paint=()=>{
  document.querySelectorAll(purchase).forEach(button=>{
   button.disabled=true;button.title='Las compras se activarán en la versión completa.';
   if(button.textContent!=='Compra próximamente')button.textContent='Compra próximamente';
  });
  document.querySelectorAll('[data-product-stock],.store-availability').forEach(node=>{
   const text='Catálogo de muestra · disponibilidad por confirmar';
   if(node.textContent!==text)node.textContent=text;
  });
 };
 document.addEventListener('DOMContentLoaded',()=>{
  paint();new MutationObserver(paint).observe(document.body,{childList:true,subtree:true});
  document.querySelector('[data-preview-close]')?.addEventListener('click',()=>document.querySelector('[data-preview-notice]')?.remove());
 },{once:true});
})();
