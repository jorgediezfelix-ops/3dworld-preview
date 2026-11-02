// One request per page, shared by listing, product detail, and cart. Own stock (/api/existencias) is laid over
// the catalog so variants 3DWORLD holds sell even when the supplier has none; without it the catalog still works.
(()=>{
 const root=document.body.dataset.siteRoot||'';
 const timeout=ms=>typeof AbortSignal!=='undefined'&&AbortSignal.timeout?{signal:AbortSignal.timeout(ms)}:{};
 const stock=document.body.dataset.staticPreview==='true'?Promise.resolve({}):fetch(root+'api/existencias',timeout(6000)).then(r=>r.ok?r.json():{}).then(d=>d.variantes||{}).catch(()=>({}));
 window.storeReady=Promise.all([fetch(root+'assets/store.json',timeout(20000)).then(r=>{if(!r.ok)throw new Error('Catálogo no disponible');return r.json()}),import('./store-domain.mjs?v=store-8'),stock])
 .then(([data,rules,units])=>{data=rules.withStock(data,units);return {data,rules,index:rules.indexCatalog(data)}});
 window.storeReady.catch(()=>{});
})();
