import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(()=>{
  'use strict';
  const gsap=window.gsap,ScrollTrigger=window.ScrollTrigger;
  const heroes=Array.from(document.querySelectorAll('[data-service-3d]'));
  if(!heroes.length)return;
  if(!THREE||!gsap||!ScrollTrigger){console.error('No fue posible cargar la visualización 3D; se muestra la imagen local de respaldo.');return}
  gsap.registerPlugin(ScrollTrigger);
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const blue=new THREE.MeshPhysicalMaterial({color:0x1589ca,metalness:.72,roughness:.22,clearcoat:.55,clearcoatRoughness:.2});
  const lightMetal=new THREE.MeshPhysicalMaterial({color:0xb8c9d4,metalness:.84,roughness:.2,clearcoat:.35,clearcoatRoughness:.24});
  const darkMetal=new THREE.MeshPhysicalMaterial({color:0x263e50,metalness:.76,roughness:.27,clearcoat:.3,clearcoatRoughness:.28});
  const boltMaterial=new THREE.MeshPhysicalMaterial({color:0x64c9ff,metalness:.72,roughness:.18,clearcoat:.6,clearcoatRoughness:.17});
  const grooveMaterial=new THREE.MeshStandardMaterial({color:0x102c40,metalness:.72,roughness:.3});

  function makeStudioEnvironment(){
    const canvas=document.createElement('canvas');
    canvas.width=1024;
    canvas.height=512;
    const context=canvas.getContext('2d');
    if(!context)return null;
    const gradient=context.createLinearGradient(0,0,0,512);
    gradient.addColorStop(0,'#506a7b');
    gradient.addColorStop(.24,'#172c3c');
    gradient.addColorStop(.52,'#30495a');
    gradient.addColorStop(.8,'#102233');
    gradient.addColorStop(1,'#6a7b85');
    context.fillStyle=gradient;
    context.fillRect(0,0,1024,512);
    [
      [115,44,150,20,'rgba(226,244,255,.82)'],
      [455,54,180,25,'rgba(181,222,248,.58)'],
      [825,68,205,18,'rgba(235,247,255,.76)'],
      [210,448,215,16,'rgba(123,183,219,.48)'],
      [710,450,235,20,'rgba(199,226,242,.5)']
    ].forEach(([x,y,w,h,color])=>{
      const soft=context.createRadialGradient(x+w/2,y+h/2,2,x+w/2,y+h/2,w*.68);
      soft.addColorStop(0,color);
      soft.addColorStop(1,'rgba(180,220,245,0)');
      context.fillStyle=soft;
      context.fillRect(x-w*.4,y-h*2,w*1.8,h*5);
    });
    const texture=new THREE.CanvasTexture(canvas);
    texture.mapping=THREE.EquirectangularReflectionMapping;
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.needsUpdate=true;
    return texture;
  }

  function addEdges(parent,geometry,opacity=.55){
    const edges=new THREE.EdgesGeometry(geometry,18);
    const lines=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0x69c8ff,transparent:true,opacity}));
    parent.add(lines);
    return lines;
  }

  function makeFlange(parent,scale=1){
    const part=new THREE.Group();
    part.scale.setScalar(scale);
    const boltCircle=.8;
    const plateShape=new THREE.Shape();
    plateShape.absarc(0,0,1.08,0,Math.PI*2,false);
    const centerBore=new THREE.Path();
    centerBore.absarc(0,0,.29,0,Math.PI*2,true);
    plateShape.holes.push(centerBore);
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      const hole=new THREE.Path();
      hole.absarc(Math.cos(angle)*boltCircle,Math.sin(angle)*boltCircle,.078,0,Math.PI*2,true);
      plateShape.holes.push(hole);
    }
    const plateGeometry=new THREE.ExtrudeGeometry(plateShape,{
      depth:.14,
      bevelEnabled:true,
      bevelThickness:.022,
      bevelSize:.018,
      bevelSegments:3,
      curveSegments:64,
      steps:1
    });
    plateGeometry.translate(0,0,-.07);
    const plateAssembly=new THREE.Group();
    const plate=new THREE.Mesh(plateGeometry,lightMetal);
    plateAssembly.add(plate,addEdges(plateAssembly,plateGeometry,.16));
    plateAssembly.rotation.x=-Math.PI/2;
    part.add(plateAssembly);
    const outerRim=new THREE.Mesh(new THREE.TorusGeometry(1.015,.022,10,96),blue);
    outerRim.rotation.x=Math.PI/2;
    outerRim.position.y=.082;
    part.add(outerRim);
    const hubGeometry=new THREE.CylinderGeometry(.42,.53,.48,64,1,true);
    const hub=new THREE.Mesh(hubGeometry,lightMetal);
    hub.position.y=.36;
    part.add(hub);
    const hubBase=new THREE.Mesh(new THREE.TorusGeometry(.47,.035,12,72),darkMetal);
    hubBase.rotation.x=Math.PI/2;
    hubBase.position.y=.13;
    part.add(hubBase);
    const hubRim=new THREE.Mesh(new THREE.TorusGeometry(.42,.032,14,72),blue);
    hubRim.rotation.x=Math.PI/2;
    hubRim.position.y=.61;
    part.add(hubRim);
    const boreWall=new THREE.Mesh(new THREE.CylinderGeometry(.294,.294,.39,48,1,true),grooveMaterial);
    boreWall.position.y=.34;
    part.add(boreWall);
    const boreFloor=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.018,48),darkMetal);
    boreFloor.position.y=.15;
    part.add(boreFloor);
    [.43,.48,.53].forEach((y,index)=>{
      const thread=new THREE.Mesh(new THREE.TorusGeometry(.306-index*.008,.009,6,56),boltMaterial);
      thread.rotation.x=Math.PI/2;
      thread.position.y=y;
      part.add(thread);
    });
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      const x=Math.cos(angle)*boltCircle,z=Math.sin(angle)*boltCircle;
      const washer=new THREE.Mesh(new THREE.TorusGeometry(.067,.009,8,24),darkMetal);
      washer.rotation.x=Math.PI/2;
      washer.position.set(x,.091,z);
      const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.052,.052,.042,12),boltMaterial);
      bolt.position.set(x,.11,z);
      const slot=new THREE.Mesh(new THREE.BoxGeometry(.046,.004,.008),grooveMaterial);
      slot.position.set(x,.133,z);
      slot.rotation.y=angle;
      part.add(washer,bolt,slot);
    }
    const shoulder=new THREE.Mesh(new THREE.TorusGeometry(.48,.012,6,80),boltMaterial);
    shoulder.rotation.x=Math.PI/2;
    shoulder.position.y=.18;
    part.add(shoulder);
    parent.add(part);
    return part;
  }

  function addModel(parent,type){
    const model=new THREE.Group();
    parent.add(model);
    if(type==='ingenieria-avanzada'){
      makeFlange(model);
      const arm=new THREE.Mesh(new THREE.BoxGeometry(1.55,.12,.2),lightMetal);
      arm.position.set(.58,.14,.08);
      arm.rotation.y=-.34;
      model.add(arm,addEdges(model,arm.geometry,.55));
    }else if(type==='prototipado-rapido'){
      const form=new THREE.Mesh(new THREE.IcosahedronGeometry(.8,2),blue);
      model.add(form,addEdges(model,form.geometry,.7));
      const orbit=new THREE.Mesh(new THREE.TorusGeometry(1.02,.018,8,90),lightMetal);
      orbit.rotation.set(.85,.25,.35);
      model.add(orbit);
      const secondOrbit=orbit.clone();
      secondOrbit.rotation.set(-.45,.9,-.35);
      secondOrbit.material=boltMaterial;
      model.add(secondOrbit);
    }else if(type==='manufactura-aditiva'){
      for(let layer=0;layer<12;layer++){
        const radius=.52+Math.sin(layer*.48)*.14;
        const geometry=new THREE.CylinderGeometry(radius-.025,radius,.07,12);
        const mesh=new THREE.Mesh(geometry,layer%3===0?lightMetal:darkMetal);
        mesh.position.y=(layer-5.5)*.075;
        mesh.rotation.y=layer*.13;
        model.add(mesh,addEdges(model,geometry,.32));
      }
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.53,.025,8,48),blue);
      rim.rotation.x=Math.PI/2;
      rim.position.y=.45;
      model.add(rim);
    }else if(type==='series-cortas'){
      [-1.03,0,1.03].forEach((x,index)=>{
        const unit=new THREE.Group();
        unit.position.x=x;
        unit.scale.setScalar(index===1? .61:.47);
        makeFlange(unit,1);
        model.add(unit);
      });
    }else if(type==='escaneo-inspeccion-3d'){
      const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.47,2),darkMetal);
      model.add(core,addEdges(model,core.geometry,.9));
      [[.8,.15,0],[1,.85,.25],[1.2,.3,-.6]].forEach(([radius,x,y])=>{
        const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.012,6,96),blue);
        ring.rotation.set(x,y,.4);
        model.add(ring);
      });
      const positions=[];
      for(let i=0;i<180;i++){
        const y=1-(i/(180-1))*2;
        const radius=Math.sqrt(1-y*y);
        const theta=Math.PI*(3-Math.sqrt(5))*i;
        positions.push(Math.cos(theta)*radius*.57,y*.57,Math.sin(theta)*radius*.57);
      }
      const scanGeometry=new THREE.BufferGeometry();
      scanGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      model.add(new THREE.Points(scanGeometry,new THREE.PointsMaterial({color:0x83d6ff,size:.022,transparent:true,opacity:.9})));
    }else if(type==='investigacion-materiales'){
      const nodes=[];
      for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
        nodes.push([x*.57,y*.57,z*.57]);
      }
      const positions=[];
      nodes.forEach(([x,y,z])=>{
        [[x+.57,y,z],[x,y+.57,z],[x,y,z+.57]].forEach(([nx,ny,nz])=>{
          if(nx<=.58&&ny<=.58&&nz<=.58){positions.push(x,y,z,nx,ny,nz)}
        });
        const node=new THREE.Mesh(new THREE.SphereGeometry(.055,12,8),boltMaterial);
        node.position.set(x,y,z);
        model.add(node);
      });
      const links=new THREE.BufferGeometry();
      links.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      model.add(new THREE.LineSegments(links,new THREE.LineBasicMaterial({color:0x3da9e8,transparent:true,opacity:.55})));
    }else{
      makeFlange(model);
    }
    return model;
  }

  heroes.forEach(hero=>{
    const canvas=hero.querySelector('.service-model-canvas');
    const host=hero.querySelector('.service-model');
    if(!canvas||!host)return;
    let renderer;
    try{
      renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
    }catch(error){
      console.error('No se pudo iniciar el modelo 3D para este servicio.',error);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.2;
    const scene=new THREE.Scene();
    scene.environment=makeStudioEnvironment();
    const camera=new THREE.PerspectiveCamera(31,1,.1,40);
    camera.position.set(2.75,1.88,4.05);
    camera.lookAt(0,.12,0);
    scene.add(new THREE.HemisphereLight(0xe4f4ff,0x102234,1.35));
    const keyLight=new THREE.DirectionalLight(0xc3e6fb,4.1);
    scene.add(keyLight);
    keyLight.position.set(3.2,4.5,4);
    const fillLight=new THREE.DirectionalLight(0x4ab7f5,2.4);
    fillLight.position.set(-4,2.3,1.5);
    scene.add(fillLight);
    const rimLight=new THREE.PointLight(0x258fd0,34,10);
    rimLight.position.set(-3,2.2,-2.5);
    scene.add(rimLight);
    const grid=new THREE.GridHelper(4.8,24,0x297aaa,0x18384f);
    grid.position.y=-.9;
    grid.material.transparent=true;
    grid.material.opacity=.25;
    scene.add(grid);
    const model=addModel(scene,hero.getAttribute('data-service-3d'));
    model.rotation.set(-.16,.22,.08);
    const bounds=new THREE.Box3().setFromObject(model);
    const sphere=bounds.getBoundingSphere(new THREE.Sphere());
    const radius=sphere.radius+sphere.center.length();

    function resize(){
      const rect=host.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      renderer.setSize(rect.width,rect.height,false);
      camera.aspect=rect.width/rect.height;
      camera.updateProjectionMatrix();
      const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*Math.min(1,camera.aspect));
      const fit=Math.min(1.7,camera.position.length()*Math.sin(halfFov)*.82/radius);
      model.scale.setScalar(fit);
      renderer.render(scene,camera);
      host.classList.add('is-rendered');
    }
    const observer=new ResizeObserver(resize);
    observer.observe(host);
    resize();

    if(!reducedMotion){
      gsap.to(model.rotation,{y:model.rotation.y+Math.PI*2,duration:28,repeat:-1,ease:'none'});
      gsap.to(model.position,{y:.09,duration:3.2,repeat:-1,yoyo:true,ease:'sine.inOut'});
      gsap.to(model.rotation,{x:model.rotation.x+.72,z:model.rotation.z+.4,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:1}});
    }

    let frame=0,visible=true;
    function render(){
      if(!visible||document.hidden){frame=0;return}
      renderer.render(scene,camera);
      frame=requestAnimationFrame(render);
    }
    function start(){
      if(!frame&&!document.hidden)frame=requestAnimationFrame(render);
    }
    const visibility=new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting;
      if(visible)start();
      else if(frame){cancelAnimationFrame(frame);frame=0}
    });
    visibility.observe(hero);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){
        if(frame)cancelAnimationFrame(frame);
        frame=0;
      }else start();
    });
    start();
  });
})();
