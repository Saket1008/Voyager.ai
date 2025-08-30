import { useEffect, useRef, useState } from 'react';

const SpaceBackground = ({ isAnimating = false }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const constellationTimerRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const explosionStarsRef = useRef([]);
  const explosionStartTimeRef = useRef(0);
  const isExplodingRef = useRef(false);

  // Constants - Enhanced for better visual experience
  const INTERACTIVE_STAR_COUNT = 1200; // Increased from 800
  const DECOR_STAR_COUNT = 2500; // Increased from 1500
  const STAR_SPEED = 0.15;
  const MOUSE_RADIUS = 150;
  const EXPLOSION_DURATION = 2000;

  // Constellation definitions - 7:2 English:Hindi ratio (63 constellations total)
  const CONSTELLATIONS = [
    // English names (45 constellations)
    { name: "Orion", englishName: "Orion", pattern: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [4, 6]] },
    { name: "Cassiopeia", englishName: "Cassiopeia", pattern: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    { name: "Leo", englishName: "Leo", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [3, 5]] },
    { name: "Scorpius", englishName: "Scorpius", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [3, 8]] },
    { name: "Cygnus", englishName: "Cygnus", pattern: [[0, 1], [1, 2], [1, 3], [1, 4], [4, 5]] },
    { name: "Pegasus", englishName: "Pegasus", pattern: [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4], [2, 5]] },
    { name: "Taurus", englishName: "Taurus", pattern: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6]] },
    { name: "Gemini", englishName: "Gemini", pattern: [[0, 1], [2, 3], [4, 5], [0, 4], [1, 5], [2, 6], [3, 7]] },
    { name: "Virgo", englishName: "Virgo", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6]] },
    { name: "Libra", englishName: "Libra", pattern: [[0, 1], [1, 2], [2, 3], [1, 4]] },
    { name: "Capricornus", englishName: "Capricornus", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5]] },
    { name: "Aquarius", englishName: "Aquarius", pattern: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6]] },
    { name: "Pisces", englishName: "Pisces", pattern: [[0, 1], [1, 2], [3, 4], [4, 5], [1, 3]] },
    { name: "Aries", englishName: "Aries", pattern: [[0, 1], [1, 2], [1, 3]] },
    { name: "Cancer", englishName: "Cancer", pattern: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]] },
    { name: "Serpens", englishName: "Serpens", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]] },
    { name: "Aquila", englishName: "Aquila", pattern: [[0, 1], [1, 2], [1, 3], [3, 4], [3, 5]] },
    { name: "Draco", englishName: "Draco", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]] },
    { name: "Andromeda", englishName: "Andromeda", pattern: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]] },
    { name: "Perseus", englishName: "Perseus", pattern: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]] },
    { name: "Centaurus", englishName: "Centaurus", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5]] },
    { name: "Eridanus", englishName: "Eridanus", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]] },
    { name: "Bootes", englishName: "Bootes", pattern: [[0, 1], [1, 2], [2, 3], [1, 4]] },
    { name: "Auriga", englishName: "Auriga", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] },
    { name: "Canis Major", englishName: "Canis Major", pattern: [[0, 1], [1, 2], [2, 3], [1, 4]] },
    { name: "Canis Minor", englishName: "Canis Minor", pattern: [[0, 1], [1, 2]] },
    { name: "Corona Borealis", englishName: "Corona Borealis", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]] },
    { name: "Ursa Major", englishName: "Ursa Major", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]] },
    { name: "Ursa Minor", englishName: "Ursa Minor", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]] },
    { name: "Lyra", englishName: "Lyra", pattern: [[0, 1], [0, 2], [1, 3], [2, 3], [0, 4]] },
    { name: "Hercules", englishName: "Hercules", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6]] },
    { name: "Ophiuchus", englishName: "Ophiuchus", pattern: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]] },
    { name: "Crater", englishName: "Crater", pattern: [[0, 1], [1, 2], [2, 3], [3, 0]] },
    { name: "Hydra", englishName: "Hydra", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]] },
    { name: "Puppis", englishName: "Puppis", pattern: [[0, 1], [1, 2], [2, 3], [1, 4]] },
    { name: "Vela", englishName: "Vela", pattern: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]] },
    { name: "Carina", englishName: "Carina", pattern: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    { name: "Columba", englishName: "Columba", pattern: [[0, 1], [1, 2], [2, 3]] },
    { name: "Lepus", englishName: "Lepus", pattern: [[0, 1], [1, 2], [2, 3], [1, 4]] },
    { name: "Monoceros", englishName: "Monoceros", pattern: [[0, 1], [1, 2], [2, 3]] },
    { name: "Lynx", englishName: "Lynx", pattern: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    { name: "Coma Berenices", englishName: "Coma Berenices", pattern: [[0, 1], [1, 2], [2, 0]] },
    { name: "Corvus", englishName: "Corvus", pattern: [[0, 1], [1, 2], [2, 3], [3, 0]] },
    { name: "Delphinus", englishName: "Delphinus", pattern: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    { name: "Sagitta", englishName: "Sagitta", pattern: [[0, 1], [1, 2], [2, 3]] },
    
    // Hindi names (18 constellations - 7:2 ratio)
    { name: "सप्तर्षि", englishName: "Big Dipper", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6]] },
    { name: "धनु", englishName: "Sagittarius", pattern: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [2, 6], [6, 7]] },
    { name: "वीणा", englishName: "Lyra", pattern: [[0, 1], [0, 2], [1, 3], [2, 3], [0, 4]] },
    { name: "रोहिणी", englishName: "Aldebaran", pattern: [[0, 1], [1, 2], [1, 3], [3, 4]] },
    { name: "कृत्तिका", englishName: "Pleiades", pattern: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]] },
    { name: "मृगशिरा", englishName: "Orion Belt", pattern: [[0, 1], [1, 2], [0, 3], [2, 4]] },
    { name: "पुनर्वसु", englishName: "Castor Pollux", pattern: [[0, 1], [2, 3], [0, 2], [1, 3]] },
    { name: "पुष्य", englishName: "Praesepe", pattern: [[0, 1], [1, 2], [2, 3], [1, 4]] },
    { name: "आश्लेषा", englishName: "Hydra Head", pattern: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    { name: "मघा", englishName: "Regulus", pattern: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]] },
    { name: "हस्त", englishName: "Corvus", pattern: [[0, 1], [1, 2], [2, 3], [3, 0]] },
    { name: "चित्रा", englishName: "Spica", pattern: [[0, 1], [1, 2], [2, 3], [1, 4]] },
    { name: "स्वाति", englishName: "Arcturus", pattern: [[0, 1], [1, 2], [2, 3]] },
    { name: "विशाखा", englishName: "Librae", pattern: [[0, 1], [1, 2], [1, 3]] },
    { name: "ज्येष्ठा", englishName: "Antares", pattern: [[0, 1], [1, 2], [2, 3], [1, 4]] },
    { name: "अश्विनी", englishName: "Hamal", pattern: [[0, 1], [1, 2], [1, 3]] },
    { name: "भरणी", englishName: "Sheratan", pattern: [[0, 1], [1, 2]] },
    { name: "रेवती", englishName: "Revati", pattern: [[0, 1], [1, 2], [1, 3]] }
  ];

  // State
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const interactiveStarsRef = useRef([]);
  const decorStarsRef = useRef([]);
  const currentConstellationRef = useRef(null);
  const constellationStateRef = useRef('SCATTERED');

  // Star class
  class Star {
    constructor(width, height) {
      this.reset(width, height);
      this.x = Math.random() * width;
      this.y = Math.random() * height;
    }

    reset(width, height) {
      this.z = Math.random() * width;
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.targetX = this.x;
      this.targetY = this.y;
      this.isConstellationStar = false;
    }

    draw(ctx, width, height) {
      let x = (this.x - width / 2) * (width / this.z) + width / 2;
      let y = (this.y - height / 2) * (width / this.z) + height / 2;
      let radius = (1 - this.z / width) * 2;
      let alpha = 1 - this.z / width;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      
      if (this.isConstellationStar && constellationStateRef.current === 'HIGHLIGHTED') {
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(173, 216, 230, 0.5)';
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.shadowBlur = 0;
      }
      
      ctx.fill();
    }

    update(width, height) {
      this.z -= STAR_SPEED;
      if (this.z < 1) {
        this.reset(width, height);
      }

      if (this.isConstellationStar) {
        this.x += (this.targetX - this.x) * 0.05;
        this.y += (this.targetY - this.y) * 0.05;
      }
    }
  }

  // Simplified class for non-interactive background stars
  class DecorStar {
    constructor(width, height) {
      this.z = Math.random() * width;
      this.x = Math.random() * width;
      this.y = Math.random() * height;
    }
    
    draw(ctx, width, height) {
      let x = (this.x - width / 2) * (width / this.z) + width / 2;
      let y = (this.y - height / 2) * (width / this.z) + height / 2;
      let radius = (1 - this.z / width) * 1.5;
      let alpha = 0.5 * (1 - this.z / width);

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
    
    update(width, height) {
      this.z -= STAR_SPEED * 0.5;
      if (this.z < 1) {
        this.z = width;
        this.x = Math.random() * width;
        this.y = Math.random() * height;
      }
    }
  }

  // Explosion star class for the animation effect
  class ExplosionStar {
    constructor(x, y, width, height) {
      this.startX = x;
      this.startY = y;
      this.x = x;
      this.y = y;
      this.velocityX = (Math.random() - 0.5) * 15;
      this.velocityY = (Math.random() - 0.5) * 15;
      this.life = 1.0;
      this.decay = Math.random() * 0.02 + 0.01;
      this.size = Math.random() * 3 + 1;
      this.color = {
        r: 173 + Math.random() * 50,
        g: 216 + Math.random() * 39,
        b: 230 + Math.random() * 25
      };
    }

    update() {
      this.x += this.velocityX;
      this.y += this.velocityY;
      this.velocityX *= 0.98;
      this.velocityY *= 0.98;
      this.life -= this.decay;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.life})`;
      ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.8)`;
      ctx.shadowBlur = 10 * this.life;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    isDead() {
      return this.life <= 0;
    }
  }

  // Initialize stars
  const initStars = (width, height) => {
    interactiveStarsRef.current = [];
    decorStarsRef.current = [];
    
    for (let i = 0; i < INTERACTIVE_STAR_COUNT; i++) {
      interactiveStarsRef.current.push(new Star(width, height));
    }
    
    for (let i = 0; i < DECOR_STAR_COUNT; i++) {
      decorStarsRef.current.push(new DecorStar(width, height));
    }
  };

  // Constellation management - Enhanced positioning for all constellations
  const getBasePositions = (englishName, scale) => {
    const positions = {
      "Orion": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.2},{x:0.3,y:0.3},{x:0.1,y:-0.05},{x:0,y:-0.2},{x:0.2,y:-0.25}],
      "Big Dipper": [{x:0,y:0},{x:0.2,y:0.1},{x:0.4,y:0.15},{x:0.6,y:0.1},{x:0.8,y:0},{x:0.7,y:-0.2},{x:0.9,y:-0.3}],
      "Cassiopeia": [{x:0,y:0},{x:0.2,y:0.2},{x:0.4,y:0},{x:0.6,y:0.2},{x:0.8,y:0}],
      "Leo": [{x:0,y:0.3},{x:0.1,y:0.2},{x:0.2,y:0.1},{x:0.3,y:0},{x:0.5,y:-0.1},{x:0.3,y:-0.2}],
      "Scorpius": [{x:0.2,y:0},{x:0.1,y:0.1},{x:0,y:0.2},{x:-0.1,y:0.3},{x:-0.2,y:0.2},{x:-0.3,y:0.1},{x:-0.4,y:0},{x:-0.5,y:-0.1},{x:0.3,y:0.1}],
      "Cygnus": [{x:0,y:0.3},{x:0,y:0},{x:0,y:-0.3},{x:-0.2,y:0},{x:0.2,y:0},{x:0,y:-0.4}],
      "Lyra": [{x:0,y:0},{x:0.2,y:0.1},{x:-0.1,y:0.2},{x:0.1,y:0.3},{x:0,y:0.5}],
      "Pegasus": [{x:0,y:0},{x:0.3,y:0},{x:0.3,y:0.3},{x:0,y:0.3},{x:0.1,y:-0.1},{x:0.4,y:0.1}],
      "Taurus": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.05},{x:0.05,y:-0.1},{x:0.15,y:-0.15},{x:0.25,y:-0.1}],
      "Gemini": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0},{x:0.3,y:0.1},{x:0.15,y:0.2},{x:0.05,y:0.25},{x:0.25,y:0.25},{x:0.35,y:0.2}],
      "Virgo": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.2},{x:0.3,y:0.15},{x:0.05,y:-0.1},{x:0.25,y:-0.05}],
      "Libra": [{x:0,y:0},{x:0.2,y:0.1},{x:0.4,y:0},{x:0.1,y:-0.2}],
      "Sagittarius": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.2},{x:0.05,y:-0.1},{x:0.15,y:-0.15},{x:0.3,y:0.1},{x:0.4,y:0}],
      "Capricornus": [{x:0,y:0},{x:0.15,y:0.1},{x:0.3,y:0.05},{x:0.4,y:-0.1},{x:0.1,y:-0.2}],
      "Aquarius": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.15},{x:0.05,y:-0.1},{x:0.15,y:-0.2},{x:0.25,y:-0.15}],
      "Pisces": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0},{x:0.3,y:0.05},{x:0.15,y:-0.1}],
      "Aries": [{x:0,y:0},{x:0.15,y:0.1},{x:0.1,y:-0.1}],
      "Cancer": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.05},{x:0.05,y:-0.1},{x:0.15,y:-0.15}],
      "Serpens": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.15},{x:0.3,y:0.1},{x:0.4,y:0.05},{x:0.5,y:0}],
      "Aquila": [{x:0,y:0},{x:0.1,y:0.1},{x:0.05,y:-0.1},{x:0.2,y:0.05},{x:0.15,y:-0.15}],
      "Draco": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.2},{x:0.3,y:0.15},{x:0.4,y:0.1},{x:0.5,y:0.05},{x:0.6,y:0}],
      "Andromeda": [{x:0,y:0},{x:0.15,y:0.1},{x:0.3,y:0.05},{x:0.1,y:-0.1},{x:0.25,y:-0.15}],
      "Spica": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.05},{x:0.05,y:-0.1}],
      "Aldebaran": [{x:0,y:0},{x:0.1,y:0.1},{x:0.05,y:-0.1},{x:0.15,y:-0.05}],
      "Arcturus": [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.05}]
    };
    
    // Default star pattern for constellations not explicitly defined
    const defaultPattern = [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.05},{x:0.05,y:-0.1}];
    
    return (positions[englishName] || defaultPattern).map(p => ({x: p.x * scale, y: p.y * scale}));
  };

  const selectNewConstellation = (width, height) => {
    interactiveStarsRef.current.forEach(s => s.isConstellationStar = false);

    const constellationDef = CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
    const starCount = Math.max(...constellationDef.pattern.flat()) + 1;
    
    let constellationStars = [];
    for(let i = 0; i < starCount; i++) {
      let starIndex;
      do {
        starIndex = Math.floor(Math.random() * INTERACTIVE_STAR_COUNT);
      } while (interactiveStarsRef.current[starIndex].isConstellationStar);
      
      interactiveStarsRef.current[starIndex].isConstellationStar = true;
      constellationStars.push(interactiveStarsRef.current[starIndex]);
    }
    
    const centerX = Math.random() * (width * 0.5) + (width * 0.25);
    const centerY = Math.random() * (height * 0.5) + (height * 0.25);
    const scale = Math.min(width, height) / 7;

    const basePositions = getBasePositions(constellationDef.englishName, scale);

    constellationStars.forEach((star, i) => {
      if (basePositions[i]) {
        star.targetX = centerX + basePositions[i].x;
        star.targetY = centerY + basePositions[i].y;
      }
    });
    
    currentConstellationRef.current = {
      def: constellationDef,
      stars: constellationStars
    };
  };

  const releaseConstellationStars = (width, height) => {
    if (currentConstellationRef.current) {
      currentConstellationRef.current.stars.forEach(star => {
        star.targetX = Math.random() * width;
        star.targetY = Math.random() * height;
      });
    }
  };

  const manageConstellations = (width, height) => {
    const now = Date.now();
    if (now > constellationTimerRef.current) {
      switch (constellationStateRef.current) {
        case 'SCATTERED':
          constellationStateRef.current = 'FORMING';
          selectNewConstellation(width, height);
          constellationTimerRef.current = now + 800; // Much faster
          break;
        case 'FORMING':
          constellationStateRef.current = 'HIGHLIGHTED';
          constellationTimerRef.current = now + 1200; // Much faster
          break;
        case 'HIGHLIGHTED':
          constellationStateRef.current = 'DISSOLVING';
          releaseConstellationStars(width, height);
          constellationTimerRef.current = now + 800; // Much faster
          break;
        case 'DISSOLVING':
          constellationStateRef.current = 'SCATTERED';
          currentConstellationRef.current = null;
          constellationTimerRef.current = now + 1000; // Much faster
          break;
      }
    }
  };

  // Drawing functions
  const drawConstellationLines = (ctx, width, height) => {
    if (!currentConstellationRef.current || constellationStateRef.current !== 'HIGHLIGHTED') return;
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(173, 216, 230, 0.25)';
    ctx.lineWidth = 1;
    
    currentConstellationRef.current.def.pattern.forEach(line => {
      const star1 = currentConstellationRef.current.stars[line[0]];
      const star2 = currentConstellationRef.current.stars[line[1]];
      
      if (star1 && star2) {
        let x1 = (star1.x - width / 2) * (width / star1.z) + width / 2;
        let y1 = (star1.y - height / 2) * (width / star1.z) + height / 2;
        let x2 = (star2.x - width / 2) * (width / star2.z) + width / 2;
        let y2 = (star2.y - height / 2) * (width / star2.z) + height / 2;
        
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
    });
    ctx.stroke();
  };

  const drawConstellationName = (ctx, width, height) => {
    if (!currentConstellationRef.current || constellationStateRef.current !== 'HIGHLIGHTED') return;

    let avgX = 0, avgY = 0, avgZ = 0;
    currentConstellationRef.current.stars.forEach(star => {
      avgX += star.x;
      avgY += star.y;
      avgZ += star.z;
    });
    avgX /= currentConstellationRef.current.stars.length;
    avgY /= currentConstellationRef.current.stars.length;
    avgZ /= currentConstellationRef.current.stars.length;

    let screenX = (avgX - width / 2) * (width / avgZ) + width / 2;
    let screenY = (avgY - height / 2) * (width / avgZ) + height / 2;

    ctx.font = '16px Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(200, 220, 255, 0.6)';
    ctx.shadowColor = 'rgba(173, 216, 230, 0.7)';
    ctx.shadowBlur = 10;
    ctx.fillText(currentConstellationRef.current.def.name, screenX, screenY + 30);
    ctx.shadowBlur = 0;
  };

  const drawMouseLines = (ctx, width, height) => {
    if (isExplodingRef.current) return; // Don't draw mouse lines during explosion
    
    const mouse = mouseRef.current;
    interactiveStarsRef.current.forEach(star => {
      let x = (star.x - width / 2) * (width / star.z) + width / 2;
      let y = (star.y - height / 2) * (width / star.z) + height / 2;
      
      const dist = Math.hypot(x - mouse.x, y - mouse.y);

      if (dist < MOUSE_RADIUS) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = `rgba(173, 216, 230, ${1 - dist / MOUSE_RADIUS})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    });
  };

  // Explosion management
  const triggerExplosion = (width, height) => {
    if (isExplodingRef.current) return;
    
    isExplodingRef.current = true;
    explosionStartTimeRef.current = Date.now();
    explosionStarsRef.current = [];
    
    // Create explosion stars from the center (where VOYAGER.AI text is)
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Create multiple waves of explosion stars
    for (let i = 0; i < 150; i++) {
      explosionStarsRef.current.push(new ExplosionStar(centerX, centerY, width, height));
    }
    
    // Add some stars from the existing stars
    interactiveStarsRef.current.forEach((star, index) => {
      if (index % 5 === 0) { // Take every 5th star
        let x = (star.x - width / 2) * (width / star.z) + width / 2;
        let y = (star.y - height / 2) * (width / star.z) + height / 2;
        explosionStarsRef.current.push(new ExplosionStar(x, y, width, height));
      }
    });
  };

  const updateExplosion = () => {
    if (!isExplodingRef.current) return;
    
    // Update explosion stars
    explosionStarsRef.current.forEach(star => star.update());
    
    // Remove dead stars
    explosionStarsRef.current = explosionStarsRef.current.filter(star => !star.isDead());
    
    // Check if explosion is complete
    const elapsed = Date.now() - explosionStartTimeRef.current;
    if (elapsed > EXPLOSION_DURATION || explosionStarsRef.current.length === 0) {
      isExplodingRef.current = false;
      explosionStarsRef.current = [];
    }
  };

  const drawExplosion = (ctx) => {
    if (!isExplodingRef.current) return;
    
    explosionStarsRef.current.forEach(star => star.draw(ctx));
  };

  // Animation loop
  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;

    ctx.clearRect(0, 0, width, height);

    // Handle explosion animation
    if (isExplodingRef.current) {
      updateExplosion();
      drawExplosion(ctx);
    } else {
      // Normal animation only when not exploding
      // Update and draw decoration stars
      decorStarsRef.current.forEach(star => {
        star.update(width, height);
        star.draw(ctx, width, height);
      });

      // Update and draw interactive stars
      interactiveStarsRef.current.forEach(star => {
        star.update(width, height);
        star.draw(ctx, width, height);
      });
      
      drawMouseLines(ctx, width, height);
      manageConstellations(width, height);
      drawConstellationLines(ctx, width, height);
      drawConstellationName(ctx, width, height);
    }

    animationRef.current = requestAnimationFrame(animate);
  };

  // Mouse movement handler
  const handleMouseMove = (e) => {
    mouseRef.current = {
      x: e.clientX,
      y: e.clientY
    };
  };

  // Resize handler
  const handleResize = () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    
    setDimensions({ width: newWidth, height: newHeight });
    
    if (canvasRef.current) {
      canvasRef.current.width = newWidth;
      canvasRef.current.height = newHeight;
      initStars(newWidth, newHeight);
    }
  };

  // Effects
  useEffect(() => {
    // Initialize
    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight;
    
    setDimensions({ width: initialWidth, height: initialHeight });
    
    if (canvasRef.current) {
      canvasRef.current.width = initialWidth;
      canvasRef.current.height = initialHeight;
      initStars(initialWidth, initialHeight);
    }
    
    // Set initial timer
    constellationTimerRef.current = Date.now() + 3000;
    
    // Event listeners
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    
    // Start animation
    animationRef.current = requestAnimationFrame(animate);
    
    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start animation when dimensions are set
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(animate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions]);

  // Trigger explosion when isAnimating becomes true
  useEffect(() => {
    if (isAnimating && dimensions.width > 0 && dimensions.height > 0) {
      triggerExplosion(dimensions.width, dimensions.height);
    }
  }, [isAnimating, dimensions.width, dimensions.height]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <canvas
        ref={canvasRef}
        className="block"
        style={{
          background: '#00000a',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
};

export default SpaceBackground;


