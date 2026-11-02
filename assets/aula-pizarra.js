/* Classroom whiteboard: pen, line, arrow, rectangle, ellipse, text and eraser on a 1600 × 1000 board with an
   optional grid. Strokes are vectors ({t, c, w, p:[x,y,…], s}) so a board saves light and redraws sharp at any size.
   window.Pizarra.create(host) → {load(board), data()}; window.Pizarra.png(board) → Promise<Blob>. */
(()=>{
 'use strict';
 const W=1600,H=1000,BG='#0f1d26';
 const COLORS=[['#f2f6f8','Blanco'],['#7ad7ff','Azul'],['#ffd166','Amarillo'],['#ff9e5e','Naranja'],['#6fe3a1','Verde'],['#ff6b6b','Rojo']];
 const TOOLS=[['lapiz','Lápiz'],['linea','Línea'],['flecha','Flecha'],['rect','Rectángulo'],['elipse','Círculo'],['texto','Texto'],['borrador','Borrador']];
 const WIDTHS=[[2,'Fino'],[4,'Medio'],[8,'Grueso']];
 const el=(tag,attrs={},...kids)=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='text')n.textContent=v;else if(k==='class')n.className=v;else n.setAttribute(k,v)}n.append(...kids);return n};

 function grid(ctx,fondo){
  ctx.fillStyle=BG;ctx.fillRect(0,0,W,H);
  if(fondo!=='cuadricula')return;
  for(let x=0;x<=W;x+=20){ctx.strokeStyle=x%100?'#1a2c38':'#25404f';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,H);ctx.stroke()}
  for(let y=0;y<=H;y+=20){ctx.strokeStyle=y%100?'#1a2c38':'#25404f';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(W,y+.5);ctx.stroke()}
 }
 function draw(ctx,s){
  const p=s.p;ctx.strokeStyle=ctx.fillStyle=s.c;ctx.lineWidth=s.w;ctx.lineCap=ctx.lineJoin='round';
  if(s.t==='texto'){ctx.font=`500 ${Math.max(18,s.w*7)}px 'DM Sans',Arial,sans-serif`;ctx.textBaseline='top';String(s.s||'').split('\n').forEach((line,i)=>ctx.fillText(line,p[0],p[1]+i*Math.max(18,s.w*7)*1.25));return}
  ctx.beginPath();
  if(s.t==='lapiz'){ctx.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)ctx.lineTo(p[i],p[i+1]);ctx.stroke();return}
  const [x1,y1,x2,y2]=p;
  if(s.t==='rect'){ctx.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));return}
  if(s.t==='elipse'){ctx.ellipse((x1+x2)/2,(y1+y2)/2,Math.abs(x2-x1)/2,Math.abs(y2-y1)/2,0,0,Math.PI*2);ctx.stroke();return}
  ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  if(s.t==='flecha'){const a=Math.atan2(y2-y1,x2-x1),l=12+s.w*3;ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-l*Math.cos(a-.45),y2-l*Math.sin(a-.45));ctx.moveTo(x2,y2);ctx.lineTo(x2-l*Math.cos(a+.45),y2-l*Math.sin(a+.45));ctx.stroke()}
 }
 // Distance from a point to a stroke, for the eraser.
 function near(s,x,y,r){
  const p=s.p,seg=(ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-ax-t*dx,y-ay-t*dy)};
  if(s.t==='texto')return x>=p[0]-r&&x<=p[0]+String(s.s).length*s.w*4+r&&y>=p[1]-r&&y<=p[1]+s.w*9+r;
  if(s.t==='lapiz'){for(let i=2;i<p.length;i+=2)if(seg(p[i-2],p[i-1],p[i],p[i+1])<r)return true;return p.length===2&&Math.hypot(x-p[0],y-p[1])<r}
  const [x1,y1,x2,y2]=p;
  if(s.t==='rect')return [[x1,y1,x2,y1],[x2,y1,x2,y2],[x2,y2,x1,y2],[x1,y2,x1,y1]].some(q=>seg(...q)<r);
  if(s.t==='elipse'){const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.abs(x2-x1)/2||1,ry=Math.abs(y2-y1)/2||1;return Math.abs(Math.hypot((x-cx)/rx,(y-cy)/ry)-1)*Math.min(rx,ry)<r}
  return seg(x1,y1,x2,y2)<r;
 }

 function create(host){
  let strokes=[],redo=[],fondo='cuadricula',tool='lapiz',color=COLORS[0][0],width=4,live=null;
  const canvas=el('canvas',{class:'pizarra-canvas','aria-label':'Pizarra de dibujo',role:'img'}),ctx=canvas.getContext('2d');
  const typing=el('textarea',{class:'pizarra-text',rows:'2',placeholder:'Escribe y presiona Enter','aria-label':'Texto en la pizarra'});typing.hidden=true;
  const group=(label,items,pick,current)=>{const g=el('div',{class:'pizarra-group',role:'group','aria-label':label});
   const paint=()=>[...g.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(items[i][0]===current())));
   items.forEach(([v,t])=>{const b=el('button',{type:'button',title:t,'aria-label':t,...(label==='Color'?{style:'--swatch:'+v}:{})},label==='Color'?'':t);b.addEventListener('click',()=>{pick(v);paint()});g.append(b)});paint();return g};
  const action=(text,fn)=>{const b=el('button',{type:'button',class:'pizarra-action'},text);b.addEventListener('click',fn);return b};
  const bar=el('div',{class:'pizarra-bar'},group('Herramienta',TOOLS,v=>{tool=v;canvas.style.cursor=v==='borrador'?'cell':v==='texto'?'text':'crosshair'},()=>tool),
   group('Color',COLORS,v=>{color=v},()=>color),group('Grosor',WIDTHS,v=>{width=v},()=>width),
   action('Deshacer',undo),action('Rehacer',again),action('Cuadrícula',()=>{fondo=fondo==='cuadricula'?'liso':'cuadricula';render()}),
   action('Borrar todo',()=>{if(strokes.length&&confirm('¿Borrar todo el dibujo?')){redo=[];push([]);}}));
  const frame=el('div',{class:'pizarra-frame'},canvas,typing);
  host.replaceChildren(bar,frame);
  function push(next){redo=[];strokes=next;render()}
  function undo(){if(!strokes.length)return;redo.push(strokes.at(-1));strokes=strokes.slice(0,-1);render()}
  function again(){if(!redo.length)return;strokes=[...strokes,redo.pop()];render()}
  function render(){
   const ratio=canvas.width/W;ctx.setTransform(ratio,0,0,ratio,0,0);grid(ctx,fondo);for(const s of strokes)draw(ctx,s);if(live)draw(ctx,live);
  }
  function fit(){const w=frame.clientWidth||800,dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(w*H/W*dpr);canvas.style.height=(w*H/W)+'px';render()}
  new ResizeObserver(fit).observe(frame);
  const at=e=>{const r=canvas.getBoundingClientRect();return[Math.round((e.clientX-r.left)*W/r.width),Math.round((e.clientY-r.top)*H/r.height)]};
  canvas.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;const [x,y]=at(e);
   if(tool==='texto'){placeText(x,y);return}
   canvas.setPointerCapture(e.pointerId);
   if(tool==='borrador'){erase(x,y);live={t:'borrador'};return}
   live={t:tool,c:color,w:width,p:tool==='lapiz'?[x,y]:[x,y,x,y]};render();
  });
  canvas.addEventListener('pointermove',e=>{
   if(!live)return;const [x,y]=at(e);
   if(live.t==='borrador'){erase(x,y);return}
   if(live.t==='lapiz'){const p=live.p;if(Math.hypot(x-p.at(-2),y-p.at(-1))>=3)p.push(x,y)}else{live.p[2]=x;live.p[3]=y}
   render();
  });
  const finish=()=>{if(!live)return;const s=live;live=null;if(s.t!=='borrador'&&(s.t==='lapiz'||Math.hypot(s.p[2]-s.p[0],s.p[3]-s.p[1])>3))push([...strokes,s]);else render()};
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
  function erase(x,y){const keep=strokes.filter(s=>!near(s,x,y,12));if(keep.length!==strokes.length)push(keep)}
  function placeText(x,y){
   const r=canvas.getBoundingClientRect();typing.hidden=false;typing.value='';
   typing.style.left=(x*r.width/W)+'px';typing.style.top=(y*r.height/H)+'px';typing.style.color=color;typing.focus();
   const done=commit=>{typing.hidden=true;typing.onkeydown=typing.onblur=null;const s=typing.value.trim();if(commit&&s)push([...strokes,{t:'texto',c:color,w:width,p:[x,y],s:s.slice(0,300)}])};
   typing.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();done(true)}if(e.key==='Escape')done(false)};typing.onblur=()=>done(true);
  }
  host.addEventListener('keydown',e=>{if(e.target===typing)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?again():undo()}});
  return{load(board){strokes=Array.isArray(board?.trazos)?board.trazos:[];fondo=board?.fondo==='liso'?'liso':'cuadricula';redo=[];render()},data:()=>({trazos:strokes,fondo})};
 }

 function png(board){
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
  grid(ctx,board.fondo);for(const s of board.trazos||[])draw(ctx,s);
  return new Promise(ok=>canvas.toBlob(ok,'image/png'));
 }
 window.Pizarra={create,png};
})();
