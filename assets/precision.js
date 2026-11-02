/* Proposal interactions remain browser-local. */
(()=>{
  'use strict';
  const choices=document.querySelectorAll('[data-example-language]');
  choices.forEach(button=>button.addEventListener('click',()=>{
    const language=button.dataset.exampleLanguage;
    choices.forEach(choice=>choice.setAttribute('aria-pressed',String(choice===button)));
    document.querySelectorAll('[data-copy-es][data-copy-en]').forEach(element=>{
      element.textContent=element.dataset[language==='es'?'copyEs':'copyEn'];
      element.lang=language;
    });
    const status=document.querySelector('#example-language-status');
    if(status)status.textContent=language==='es'?'Ejemplos de hero en español.':'Hero examples in English.';
  }));
})();
