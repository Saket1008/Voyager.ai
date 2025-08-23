import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

const WormholeTransition = ({ isActive, onTransitionComplete }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const materialRef = useRef(null);
  const pathRef = useRef(null);
  const clockRef = useRef(null);

  // Optimized animation function using useCallback
  const animate = useCallback(() => {
    if (!isActive || !cameraRef.current || !rendererRef.current || !sceneRef.current) {
      return;
    }

    animationRef.current = requestAnimationFrame(animate);
    
    const delta = clockRef.current.getDelta();
    const progress = Math.min((Date.now() - clockRef.current.startTime) / 4000, 1); // 4 seconds duration
    
    // Update shader time for nebula animation
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }

    // Smooth easing function for camera movement
    const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    
    // Get camera position along the curved path
    const point = pathRef.current.getPointAt(easedProgress);
    const tangent = pathRef.current.getTangentAt(easedProgress);
    
    // Smooth camera movement with lerp for better performance
    cameraRef.current.position.lerp(point, 0.1);
    cameraRef.current.lookAt(point.clone().add(tangent));

    // Render the scene
    rendererRef.current.render(sceneRef.current, cameraRef.current);

    // Check if animation is complete
    if (progress >= 1) {
      onTransitionComplete();
      return;
    }
  }, [isActive, onTransitionComplete]);

  // Initialize Three.js scene
  const initializeScene = useCallback(() => {
    if (!canvasRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current, 
      antialias: true,
      powerPreference: "high-performance"
    });

    // Optimize renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = false; // Disable shadows for performance

    // Camera positioning
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);

    // Store references
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Enhanced wormhole tunnel with better curve
    class OptimizedCurve extends THREE.Curve {
      constructor(scale = 1200) { 
        super(); 
        this.scale = scale; 
      }
      
      getPoint(t) {
        if (t === 0) return new THREE.Vector3(0, 0, 0);
        
        // More complex curve for better visual effect
        const frequency = 2.5;
        const amplitude = 15;
        const tx = Math.sin(t * Math.PI * frequency) * amplitude;
        const ty = Math.cos(t * Math.PI * (frequency * 0.6)) * amplitude;
        const tz = t * this.scale * -1;
        
        return new THREE.Vector3(tx, ty, tz);
      }
    }

    const path = new OptimizedCurve(1200);
    pathRef.current = path;

    // Optimized geometry with fewer segments for better performance
    const geometry = new THREE.TubeGeometry(path, 150, 25, 12, false);
    
    // Enhanced shader material with better performance
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        uniform float uTime;
        
        // Optimized Perlin noise
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        
        // Optimized FBM with fewer iterations
        float fbm(vec3 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 4; i++) { // Reduced from 6 to 4 for performance
            value += amplitude * snoise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }
        
        void main() {
          vec2 uv = vUv;
          float speed = 0.15; // Slightly slower for better performance
          
          vec3 color = vec3(0.0);
          
          // Layer 1: Base nebula
          float noise1 = fbm(vec3(uv * 1.5, uTime * speed * 0.5));
          vec3 color1 = vec3(0.0, 0.1, 0.2);
          color = mix(color, color1, smoothstep(0.3, 0.6, noise1));
          
          // Layer 2: Aurora effect
          float noise2 = fbm(vec3(uv.x * 2.0, uv.y * 4.0 + uTime * speed * 2.0, uTime * 0.1));
          vec3 color2 = vec3(0.1, 0.5, 0.8);
          color = mix(color, color2, smoothstep(0.5, 0.7, noise2));
          
          // Layer 3: Highlights
          float noise3 = fbm(vec3(uv * 3.0, uTime * speed * 1.5));
          vec3 color3 = vec3(0.8, 0.2, 0.5);
          color += color3 * pow(noise3, 3.0);
          
          // Enhanced central core
          float core = 1.0 - distance(uv, vec2(0.5));
          core = pow(core, 3.0); // Reduced power for better performance
          color += vec3(core * 1.2);
          
          // Final color adjustments
          color = pow(color, vec3(1.1)); // Reduced contrast for performance
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: { uTime: { value: 0 } },
      side: THREE.BackSide,
      transparent: true,
    });

    materialRef.current = material;
    const wormhole = new THREE.Mesh(geometry, material);
    scene.add(wormhole);

    // Optimized starfield with fewer stars for better performance
    const starCount = 600; // Reduced from 1000
    const starVertices = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      starVertices[i3] = (Math.random() - 0.5) * 200;
      starVertices[i3 + 1] = (Math.random() - 0.5) * 200;
      starVertices[i3 + 2] = (Math.random() - 0.5) * 2000;
    }
    
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starVertices, 3));
    
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15, // Slightly smaller for better performance
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Initialize clock
    clockRef.current = new THREE.Clock();
    clockRef.current.startTime = Date.now();

  }, []);

  // Handle window resize efficiently
  const handleResize = useCallback(() => {
    if (!cameraRef.current || !rendererRef.current) return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  }, []);

  // Main effect for scene management
  useEffect(() => {
    if (isActive) {
      initializeScene();
      
      // Start animation
      animate();
      
      // Add resize listener
      window.addEventListener('resize', handleResize, { passive: true });
      
      return () => {
        // Cleanup
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        window.removeEventListener('resize', handleResize);
        
        // Dispose of Three.js resources
        if (rendererRef.current) {
          rendererRef.current.dispose();
        }
        if (materialRef.current) {
          materialRef.current.dispose();
        }
        if (sceneRef.current) {
          sceneRef.current.clear();
        }
      };
    }
  }, [isActive, initializeScene, animate, handleResize]);

  // Don't render anything if not active
  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ 
        imageRendering: 'optimizeSpeed',
        imageRendering: '-webkit-optimize-contrast'
      }}
    />
  );
};

export default WormholeTransition;
