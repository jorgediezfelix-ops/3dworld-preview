/* QR code (ISO/IEC 18004) for the certificate's verification link: byte mode, error correction M, versions 1–10.
   Follows the reference construction of Project Nayuki's QR Code generator (MIT).
   window.qrMatrix(text) → rows of booleans, true = dark module, without the quiet zone. */
(()=>{
 const ECC=[0,10,16,26,18,24,16,18,22,22,26], BLOCKS=[0,1,1,1,2,2,4,4,4,5,5];
 const bit=(x,i)=>((x>>>i)&1)!==0;
 const raw=v=>{let r=(16*v+128)*v+64;if(v>=2){const n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36}return r};
 const dataCapacity=v=>(raw(v)>>3)-ECC[v]*BLOCKS[v];
 function mul(x,y){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((y>>>i)&1)*x}return z}
 function divisor(degree){const r=new Array(degree).fill(0);r[degree-1]=1;let root=1;
  for(let i=0;i<degree;i++){for(let j=0;j<degree;j++){r[j]=mul(r[j],root);if(j+1<degree)r[j]^=r[j+1]}root=mul(root,2)}return r}
 function remainder(data,div){const r=div.map(()=>0);
  for(const b of data){const f=b^r.shift();r.push(0);div.forEach((c,i)=>{r[i]^=mul(c,f)})}return r}
 const MASKS=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,
  (x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];

 function codewords(bytes,v){
  const bits=[],push=(val,len)=>{for(let i=len-1;i>=0;i--)bits.push((val>>>i)&1)};
  push(4,4);push(bytes.length,v<10?8:16);bytes.forEach(b=>push(b,8));
  const cap=dataCapacity(v)*8;push(0,Math.min(4,cap-bits.length));push(0,(8-bits.length%8)%8);
  const data=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((a,b)=>a<<1|b,0));
  for(let pad=0xec;data.length<cap/8;pad^=0xec^0x11)data.push(pad);
  // Split into blocks, add the Reed–Solomon codewords and interleave.
  const n=BLOCKS[v],e=ECC[v],total=raw(v)>>3,short=n-total%n,len=Math.floor(total/n),div=divisor(e),blocks=[];
  for(let i=0,k=0;i<n;i++){const d=data.slice(k,k+len-e+(i<short?0:1));k+=d.length;const ecc=remainder(d,div);if(i<short)d.push(0);blocks.push(d.concat(ecc))}
  const out=[];for(let i=0;i<blocks[0].length;i++)blocks.forEach((b,j)=>{if(i!==len-e||j>=short)out.push(b[i])});
  return out;
 }

 function build(v,words,mask){
  const size=v*4+17,m=[...Array(size)].map(()=>Array(size).fill(false)),fn=[...Array(size)].map(()=>Array(size).fill(false));
  const set=(x,y,dark)=>{m[y][x]=dark;fn[y][x]=true};
  for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
  const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy)),x=cx+dx,y=cy+dy;
   if(x>=0&&x<size&&y>=0&&y<size)set(x,y,d!==2&&d!==4)}};
  finder(3,3);finder(size-4,3);finder(3,size-4);
  if(v>1){const count=Math.floor(v/7)+2,step=Math.ceil((v*4+4)/(count*2-2))*2,pos=[6];
   for(let p=size-7;pos.length<count;p-=step)pos.splice(1,0,p);
   pos.forEach((a,i)=>pos.forEach((b,j)=>{if((i===0&&j===0)||(i===0&&j===count-1)||(i===count-1&&j===0))return;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(a+dx,b+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1)}))}
  const format=()=>{const data=mask;let r=data;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const f=((data<<10)|r)^0x5412;
   for(let i=0;i<=5;i++)set(8,i,bit(f,i));set(8,7,bit(f,6));set(8,8,bit(f,7));set(7,8,bit(f,8));
   for(let i=9;i<15;i++)set(14-i,8,bit(f,i));for(let i=0;i<8;i++)set(size-1-i,8,bit(f,i));
   for(let i=8;i<15;i++)set(8,size-15+i,bit(f,i));set(8,size-8,true)};
  format();
  if(v>=7){let r=v;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1f25);const f=v<<12|r;
   for(let i=0;i<18;i++){const a=size-11+i%3,b=Math.floor(i/3);set(a,b,bit(f,i));set(b,a,bit(f,i))}}
  let i=0;
  for(let right=size-1;right>=1;right-=2){if(right===6)right=5;
   for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){const x=right-j,y=((right+1)&2)===0?size-1-vert:vert;
    if(!fn[y][x]&&i<words.length*8){m[y][x]=bit(words[i>>>3],7-(i&7));i++}}}
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!fn[y][x]&&MASKS[mask](x,y))m[y][x]=!m[y][x];
  return m;
 }

 // Penalty rules of the standard: long runs, 2×2 blocks, finder-like patterns and dark balance.
 function penalty(m){
  const size=m.length,lines=[...m,...m[0].map((_,x)=>m.map(r=>r[x]))];let p=0;
  for(const l of lines){let run=1;for(let i=1;i<=size;i++){if(i<size&&l[i]===l[i-1])run++;else{if(run>=5)p+=run-2;run=1}}
   const s=l.map(Number).join('');for(const pat of ['00001011101','10111010000']){let k=s.indexOf(pat);while(k>=0){p+=40;k=s.indexOf(pat,k+1)}}}
  for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=m[y][x];if(c===m[y][x+1]&&c===m[y+1][x]&&c===m[y+1][x+1])p+=3}
  const dark=m.flat().filter(Boolean).length;p+=10*Math.floor(Math.abs(dark*20-size*size*10)/(size*size));
  return p;
 }

 window.qrMatrix=text=>{
  const bytes=[...new TextEncoder().encode(text)];
  const v=[1,2,3,4,5,6,7,8,9,10].find(v=>4+(v<10?8:16)+bytes.length*8<=dataCapacity(v)*8);
  if(!v)return null;
  const words=codewords(bytes,v);
  return MASKS.map((_,mask)=>build(v,words,mask)).reduce((best,m)=>penalty(m)<penalty(best)?m:best);
 };
})();
