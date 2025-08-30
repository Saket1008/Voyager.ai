import { useEffect, useRef, useState } from 'react';

const SpaceBackground = ({ isAnimating = false }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const constellationTimerRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const explosionStarsRef = useRef([]);
  const explosionStartTimeRef = useRef(0);
  const isExplodingRef = useRef(false);

  const INTERACTIVE_STAR_COUNT = 1200;
  const DECOR_STAR_COUNT = 2500;
  const STAR_SPEED = 0.15;
  const MOUSE_RADIUS = 150;
  const EXPLOSION_DURATION = 2000;

  const CONSTELLATIONS = [
    { name: "Orion", englishName: "Orion", pattern: [[0,1],[1,2],[2,3],[1,4],[4,5],[4,6]] },
    { name: "Cassiopeia", englishName: "Cassiopeia", pattern: [[0,1],[1,2],[2,3],[3,4]] },
  ];

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const interactiveStarsRef = useRef([]);
  const decorStarsRef = useRef([]);
  const currentConstellationRef = useRef(null);
  const constellationStateRef = useRef('SCATTERED');
  const constellationProgressRef = useRef(0);

  class Star {
    constructor(width, height) { this.reset(width, height); this.x = Math.random()*width; this.y = Math.random()*height; }
    reset(width, height) { this.z = Math.random()*width; this.x = Math.random()*width; this.y = Math.random()*height; this.targetX = this.x; this.targetY = this.y; this.isConstellationStar = false; }
    draw(ctx, width, height) {
      let x = (this.x - width/2) * (width/this.z) + width/2;
      let y = (this.y - height/2) * (width/this.z) + height/2;
      let radius = (1 - this.z/width) * 2; let alpha = 1 - this.z/width;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2);
      if (this.isConstellationStar && constellationStateRef.current === 'HIGHLIGHTED') { ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`; ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(173, 216, 230, 0.5)'; } else { ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.shadowBlur = 0; }
      ctx.fill();
    }
    update(width, height) { this.z -= STAR_SPEED; if (this.z < 1) { this.reset(width, height); } if (this.isConstellationStar) { this.x += (this.targetX - this.x) * 0.05; this.y += (this.targetY - this.y) * 0.05; } }
  }

  class DecorStar { constructor(width, height) { this.z = Math.random()*width; this.x = Math.random()*width; this.y = Math.random()*height; }
    draw(ctx, width, height) { let x=(this.x-width/2)*(width/this.z)+width/2; let y=(this.y-height/2)*(width/this.z)+height/2; let radius=(1-this.z/width)*1.5; let alpha=0.5*(1-this.z/width); ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fillStyle=`rgba(255,255,255,${alpha})`; ctx.fill(); }
    update(width, height) { this.z -= STAR_SPEED*0.5; if (this.z < 1) { this.z = width; this.x = Math.random()*width; this.y = Math.random()*height; } }
  }

  class ExplosionStar { constructor(x,y,width,height){ this.startX=x; this.startY=y; this.x=x; this.y=y; this.velocityX=(Math.random()-0.5)*15; this.velocityY=(Math.random()-0.5)*15; this.life=1.0; this.decay=Math.random()*0.02+0.01; this.size=Math.random()*3+1; this.color={ r:173+Math.random()*50, g:216+Math.random()*39, b:230+Math.random()*25 }; }
    update(){ this.x+=this.velocityX; this.y+=this.velocityY; this.velocityX*=0.98; this.velocityY*=0.98; this.life-=this.decay; }
    draw(ctx){ if (this.life<=0) return; ctx.beginPath(); ctx.arc(this.x,this.y,this.size*this.life,0,Math.PI*2); ctx.fillStyle=`rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.life})`; ctx.shadowColor=`rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.8)`; ctx.shadowBlur=10*this.life; ctx.fill(); ctx.shadowBlur=0; }
    isDead(){ return this.life<=0; }
  }

  const initStars = (width, height) => { interactiveStarsRef.current = []; decorStarsRef.current = []; for (let i=0;i<INTERACTIVE_STAR_COUNT;i++){ interactiveStarsRef.current.push(new Star(width, height)); } for (let i=0;i<DECOR_STAR_COUNT;i++){ decorStarsRef.current.push(new DecorStar(width, height)); } };

  const getBasePositions = (englishName, scale) => { const defaultPattern=[{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.05},{x:0.05,y:-0.1}]; return defaultPattern.map(p=>({x:p.x*scale,y:p.y*scale})); };
  const selectNewConstellation = (width, height) => { interactiveStarsRef.current.forEach(s=>s.isConstellationStar=false); const starCount=6; let constellationStars=[]; for(let i=0;i<starCount;i++){ let starIndex; do { starIndex=Math.floor(Math.random()*INTERACTIVE_STAR_COUNT); } while (interactiveStarsRef.current[starIndex].isConstellationStar); interactiveStarsRef.current[starIndex].isConstellationStar=true; constellationStars.push(interactiveStarsRef.current[starIndex]); }
    const centerX=Math.random()*(width*0.5)+(width*0.25); const centerY=Math.random()*(height*0.5)+(height*0.25); const scale=Math.min(width,height)/7; const basePositions=getBasePositions('Orion', scale); constellationStars.forEach((star,i)=>{ if(basePositions[i]){ star.targetX=centerX+basePositions[i].x; star.targetY=centerY+basePositions[i].y; } }); currentConstellationRef.current={ def:{name:'Orion',englishName:'Orion',pattern:[[0,1],[1,2]]}, stars:constellationStars };
  };
  const releaseConstellationStars = (width, height) => { if (currentConstellationRef.current) { currentConstellationRef.current.stars.forEach(star => { star.targetX = Math.random()*width; star.targetY = Math.random()*height; }); } };
  const manageConstellations = (width, height) => { const now=Date.now(); if (now > constellationTimerRef.current) { switch (constellationStateRef.current) { case 'SCATTERED': constellationStateRef.current='FORMING'; selectNewConstellation(width, height); constellationTimerRef.current=now+800; break; case 'FORMING': constellationStateRef.current='HIGHLIGHTED'; constellationTimerRef.current=now+1200; break; case 'HIGHLIGHTED': constellationStateRef.current='DISSOLVING'; releaseConstellationStars(width, height); constellationTimerRef.current=now+800; break; case 'DISSOLVING': constellationStateRef.current='SCATTERED'; currentConstellationRef.current=null; constellationTimerRef.current=now+1000; break; } } };
  const drawConstellationLines = (ctx, width, height) => { if (!currentConstellationRef.current || constellationStateRef.current!=='HIGHLIGHTED') return; ctx.beginPath(); ctx.strokeStyle='rgba(173, 216, 230, 0.25)'; ctx.lineWidth=1; currentConstellationRef.current.def.pattern.forEach(line=>{ const star1=currentConstellationRef.current.stars[line[0]]; const star2=currentConstellationRef.current.stars[line[1]]; if (star1 && star2) { let x1=(star1.x - width/2)*(width/star1.z)+width/2; let y1=(star1.y - height/2)*(width/star1.z)+height/2; let x2=(star2.x - width/2)*(width/star2.z)+width/2; let y2=(star2.y - height/2)*(width/star2.z)+height/2; ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); } }); ctx.stroke(); };
  const drawConstellationName = (ctx, width, height) => { if (!currentConstellationRef.current || constellationStateRef.current!=='HIGHLIGHTED') return; let avgX=0,avgY=0,avgZ=0; currentConstellationRef.current.stars.forEach(star=>{ avgX+=star.x; avgY+=star.y; avgZ+=star.z; }); avgX/=currentConstellationRef.current.stars.length; avgY/=currentConstellationRef.current.stars.length; avgZ/=currentConstellationRef.current.stars.length; let screenX=(avgX - width/2)*(width/avgZ)+width/2; let screenY=(avgY - height/2)*(width/avgZ)+height/2; ctx.font='16px Segoe UI, Tahoma, Geneva, Verdana, sans-serif'; ctx.textAlign='center'; ctx.fillStyle='rgba(200, 220, 255, 0.6)'; ctx.shadowColor='rgba(173, 216, 230, 0.7)'; ctx.shadowBlur=10; ctx.fillText(currentConstellationRef.current.def.name, screenX, screenY + 30); ctx.shadowBlur=0; };
  const drawMouseLines = (ctx, width, height) => { if (isExplodingRef.current) return; const mouse=mouseRef.current; interactiveStarsRef.current.forEach(star=>{ let x=(star.x - width/2)*(width/star.z)+width/2; let y=(star.y - height/2)*(width/star.z)+height/2; const dist=Math.hypot(x-mouse.x,y-mouse.y); if (dist < MOUSE_RADIUS) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(mouse.x,mouse.y); ctx.strokeStyle=`rgba(173, 216, 230, ${1 - dist / MOUSE_RADIUS})`; ctx.lineWidth=0.5; ctx.stroke(); } }); };
  const triggerExplosion = (width, height) => { if (isExplodingRef.current) return; isExplodingRef.current=true; explosionStartTimeRef.current=Date.now(); explosionStarsRef.current=[]; const centerX=width/2; const centerY=height/2; for (let i=0;i<150;i++){ explosionStarsRef.current.push(new ExplosionStar(centerX, centerY, width, height)); } interactiveStarsRef.current.forEach((star, index)=>{ if (index % 5 === 0) { let x=(star.x - width/2)*(width/star.z)+width/2; let y=(star.y - height/2)*(width/star.z)+height/2; explosionStarsRef.current.push(new ExplosionStar(x,y,width,height)); } }); };
  const updateExplosion = () => { if (!isExplodingRef.current) return; explosionStarsRef.current.forEach(star=>star.update()); explosionStarsRef.current = explosionStarsRef.current.filter(star=>!star.isDead()); const elapsed=Date.now() - explosionStartTimeRef.current; if (elapsed > EXPLOSION_DURATION || explosionStarsRef.current.length===0) { isExplodingRef.current=false; explosionStarsRef.current=[]; } };
  const drawExplosion = (ctx) => { if (!isExplodingRef.current) return; explosionStarsRef.current.forEach(star=>star.draw(ctx)); };

  const animate = () => { const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); const { width, height } = dimensions; ctx.clearRect(0,0,width,height); if (isExplodingRef.current) { updateExplosion(); drawExplosion(ctx); } else { decorStarsRef.current.forEach(star=>{ star.update(width,height); star.draw(ctx,width,height); }); interactiveStarsRef.current.forEach(star=>{ star.update(width,height); star.draw(ctx,width,height); }); drawMouseLines(ctx,width,height); manageConstellations(width,height); drawConstellationLines(ctx,width,height); drawConstellationName(ctx,width,height); } animationRef.current = requestAnimationFrame(animate); };

  const handleMouseMove = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
  const handleResize = () => { const newWidth = window.innerWidth; const newHeight = window.innerHeight; setDimensions({ width: newWidth, height: newHeight }); if (canvasRef.current) { canvasRef.current.width = newWidth; canvasRef.current.height = newHeight; initStars(newWidth, newHeight); } };

  useEffect(() => {
    const initialWidth = window.innerWidth; const initialHeight = window.innerHeight; setDimensions({ width: initialWidth, height: initialHeight }); if (canvasRef.current) { canvasRef.current.width = initialWidth; canvasRef.current.height = initialHeight; initStars(initialWidth, initialHeight); }
    constellationTimerRef.current = Date.now() + 3000; window.addEventListener('mousemove', handleMouseMove); window.addEventListener('resize', handleResize); animationRef.current = requestAnimationFrame(animate);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('resize', handleResize); if (animationRef.current) { cancelAnimationFrame(animationRef.current); } };
  }, []);

  useEffect(() => { if (dimensions.width > 0 && dimensions.height > 0) { if (animationRef.current) { cancelAnimationFrame(animationRef.current); } animationRef.current = requestAnimationFrame(animate); } }, [dimensions]);
  useEffect(() => { if (isAnimating && dimensions.width > 0 && dimensions.height > 0) { triggerExplosion(dimensions.width, dimensions.height); } }, [isAnimating, dimensions.width, dimensions.height]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <canvas ref={canvasRef} className="block" style={{ background: '#00000a', width: '100%', height: '100%' }} />
    </div>
  );
};

export default SpaceBackground;


