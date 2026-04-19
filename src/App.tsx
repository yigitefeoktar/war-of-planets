import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/engine';
import { motion } from 'motion/react';
import { Maximize, Minimize, Volume2, VolumeX, Music, Skull, Pause, Play, Flag } from 'lucide-react';
import { playSound, startMusic, stopMusic, setMusicEnabled, SoundType, resumeAudioContext } from './audio';

function LandingPage({ onPlay, isSoundEnabled, setIsSoundEnabled, isMusicEnabled, setIsMusicEnabled, isHardMode, setIsHardMode }: { onPlay: () => void, isSoundEnabled: boolean, setIsSoundEnabled: (val: boolean) => void, isMusicEnabled: boolean, setIsMusicEnabled: (val: boolean) => void, isHardMode: boolean, setIsHardMode: (val: boolean) => void }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      // Slightly increased reference dimensions to make the UI just a touch smaller
      const referenceWidth = 900;
      const referenceHeight = 700;
      
      const scaleW = window.innerWidth / referenceWidth;
      const scaleH = window.innerHeight / referenceHeight;
      
      // Find the lowest scale factor to fit exactly, but cap it so it doesn't get ridiculously large or small
      const computedScale = Math.min(scaleW, scaleH);
      setScale(Math.max(0.3, Math.min(computedScale, 2.0)));
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handlePlay = () => {
    resumeAudioContext();
    playSound('select', isSoundEnabled);
    onPlay();
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#030305] overflow-hidden font-sans select-none touch-none overscroll-none">
      {/* Cinematic Nebula Background */}
      <div className="absolute inset-0 z-0 opacity-40">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-900/30 blur-[120px]"
        />
        <motion.div 
          animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2], rotate: [0, -90, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-cyan-900/20 blur-[150px]"
        />
      </div>

      {/* Tactical Grid Overlay */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-screen pointer-events-none" />
      
      {/* CRT Scanlines & Vignette */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_50%,transparent_50%)] bg-[length:100%_4px]" />
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_20%,#030305_120%)] opacity-90" />

      {/* HUD Elements */}
      <div className="absolute top-6 left-6 text-cyan-500/60 font-mono text-xs tracking-widest hidden md:block">
        SYS.VER_9.2.1 <br/>
        STATUS: <span className="text-green-400 animate-pulse">ONLINE</span>
      </div>
      
      <div className="absolute top-6 right-6 text-cyan-500/60 font-mono text-xs tracking-widest text-right hidden md:block">
        UPLINK: SECURE <br/>
        COORD: 45.91.22
      </div>

      <div className="relative z-10 w-full h-full overflow-hidden flex items-center justify-center">
        <div 
          className="flex flex-col items-center justify-center min-w-[800px]"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
        >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="text-center"
        >
          <motion.h1 
            animate={{ opacity: [0, 1, 0.4, 1, 0.8, 1] }}
            transition={{ duration: 1.2, ease: "circOut" }}
            className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-400 tracking-tighter mb-2 drop-shadow-[0_0_20px_rgba(6,182,212,0.4)] whitespace-nowrap"
          >
            WAR OF PLANETS
          </motion.h1>
          <motion.div 
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 0.5, ease: "circOut" }}
            className="h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 mb-3 origin-center" 
          />
          <p className="text-cyan-300/80 font-mono tracking-[0.5em] text-sm uppercase h-5 whitespace-nowrap">
            {Array.from("A GAME BY YIĞIT EFE OKTAR").map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 + 0.8 }}
              >
                {char}
              </motion.span>
            ))}
          </p>
        </motion.div>

        {/* Mission Briefing Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-12 relative w-full max-w-lg bg-cyan-950/40 backdrop-blur-md border border-cyan-500/30 p-8 shadow-[0_0_30px_rgba(6,182,212,0.1)] rounded-sm"
        >
          {/* Corner accents */}
          <div className="absolute -top-[1px] -left-[1px] w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute -top-[1px] -right-[1px] w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
          <div className="absolute -bottom-[1px] -left-[1px] w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute -bottom-[1px] -right-[1px] w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
          
          <h2 className="text-cyan-400 font-mono text-sm tracking-widest uppercase mb-6 flex items-center gap-3">
            <span className="w-2 h-2 bg-cyan-400 animate-pulse" />
            Mission Briefing
          </h2>
          
          <div className="space-y-5 font-mono text-sm text-cyan-100/80 text-left">
            <div className="flex gap-4 items-start">
              <span className="text-cyan-500 font-bold">01</span>
              <p>Click your <span className="text-blue-400 font-bold">BLUE</span> planet to select it, then click a target to attack.</p>
            </div>
            <div className="flex gap-4 items-start">
              <span className="text-cyan-500 font-bold">02</span>
              <p>Protect your Capital (the largest planet) at all costs.</p>
            </div>
            <div className="flex gap-4 items-start">
              <span className="text-cyan-500 font-bold">03</span>
              <p>Capture 5 planets to unlock the devastating Omni-Strike superweapon.</p>
            </div>
          </div>
        </motion.div>

        {/* Action Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          whileHover={{ scale: 1.05, backgroundColor: "rgba(6, 182, 212, 0.2)" }}
          whileTap={{ scale: 0.95 }}
          onMouseEnter={() => playSound('hover', isSoundEnabled)}
          onClick={handlePlay}
          className="mt-12 group relative px-12 py-5 bg-cyan-950/60 border border-cyan-400 text-cyan-300 font-bold tracking-[0.3em] uppercase transition-colors transition-shadow duration-300 overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:text-white cursor-pointer rounded-sm"
        >
          <div className="absolute inset-0 bg-cyan-400/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          {/* Button corner accents */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <span className="relative z-10 flex items-center gap-3">
            Initialize Launch
            <svg className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </span>
        </motion.button>

        {/* Utility Toggles */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-10 flex flex-wrap justify-center items-center gap-4"
        >
          <button
            onMouseEnter={() => playSound('hover', isSoundEnabled)}
            onClick={() => {
              toggleFullscreen();
              playSound('click', isSoundEnabled);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-950/40 border border-cyan-500/30 text-cyan-500/60 hover:text-cyan-400 hover:border-cyan-400/50 hover:bg-cyan-900/30 transition-all rounded-sm font-mono text-xs tracking-widest uppercase group"
          >
            {isFullscreen ? <Minimize size={14} className="group-hover:scale-110 transition-transform" /> : <Maximize size={14} className="group-hover:scale-110 transition-transform" />}
            {isFullscreen ? 'Windowed' : 'Fullscreen'}
          </button>
          
          <button
            onMouseEnter={() => playSound('hover', isSoundEnabled)}
            onClick={() => {
              const newState = !isMusicEnabled;
              setIsMusicEnabled(newState);
              if (newState) playSound('click', isSoundEnabled);
            }}
            className={`flex items-center gap-2 px-4 py-2 border transition-all rounded-sm font-mono text-xs tracking-widest uppercase group ${
              isMusicEnabled 
                ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-500/60 hover:text-cyan-400 hover:border-cyan-400/50 hover:bg-cyan-900/30' 
                : 'bg-red-950/20 border-red-900/30 text-red-500/40 hover:text-red-400 hover:border-red-500/50 hover:bg-red-900/30'
            }`}
          >
            <Music size={14} className={`group-hover:scale-110 transition-transform ${!isMusicEnabled && 'opacity-50'}`} />
            {isMusicEnabled ? 'Music: On' : 'Music: Off'}
          </button>

          <button
            onMouseEnter={() => playSound('hover', isSoundEnabled)}
            onClick={() => {
              const newState = !isSoundEnabled;
              setIsSoundEnabled(newState);
              if (newState) playSound('click', true);
            }}
            className={`flex items-center gap-2 px-4 py-2 border transition-all rounded-sm font-mono text-xs tracking-widest uppercase group ${
              isSoundEnabled 
                ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-500/60 hover:text-cyan-400 hover:border-cyan-400/50 hover:bg-cyan-900/30' 
                : 'bg-red-950/20 border-red-900/30 text-red-500/40 hover:text-red-400 hover:border-red-500/50 hover:bg-red-900/30'
            }`}
          >
            {isSoundEnabled ? <Volume2 size={14} className="group-hover:scale-110 transition-transform" /> : <VolumeX size={14} className="group-hover:scale-110 transition-transform opacity-50" />}
            {isSoundEnabled ? 'Sound: On' : 'Sound: Off'}
          </button>

          <button
            onMouseEnter={() => playSound('hover', isSoundEnabled)}
            onClick={() => {
              const newState = !isHardMode;
              setIsHardMode(newState);
              if (newState) playSound('click', isSoundEnabled);
            }}
            className={`flex items-center gap-2 px-4 py-2 border transition-all rounded-sm font-mono text-xs tracking-widest uppercase group ${
              isHardMode 
                ? 'bg-red-950/40 border-red-500/50 text-red-400 hover:text-red-300 hover:border-red-400 hover:bg-red-900/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                : 'bg-cyan-950/20 border-cyan-900/30 text-cyan-500/40 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-900/30'
            }`}
          >
            <Skull size={14} className={`group-hover:scale-110 transition-transform ${!isHardMode && 'opacity-50'}`} />
            {isHardMode ? 'Hard Mode: On' : 'Hard Mode: Off'}
          </button>
        </motion.div>
        </div>
      </div>
    </div>
  );
}

function Game({ isSoundEnabled, isMusicEnabled, isHardMode }: { isSoundEnabled: boolean, isMusicEnabled: boolean, isHardMode: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [factions, setFactions] = useState<{ color: string; isAlive: boolean; isPlayer: boolean; shipCount: number; name: string }[]>([]);
  const [winner, setWinner] = useState<{ color: string } | null>(null);
  const [showUI, setShowUI] = useState(false);
  const [fleetSize, setFleetSize] = useState<number>(1.0);
  const fleetSizeRef = useRef<number>(1.0);
  const [omniStrikeCooldown, setOmniStrikeCooldown] = useState(0);
  const [isOmniStrikeTargeting, setIsOmniStrikeTargeting] = useState(false);
  const [playerPlanetCount, setPlayerPlanetCount] = useState(0);
  const [wasOmniReady, setWasOmniReady] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const isOmniStrikeTargetingRef = useRef(false);
  const isPausedRef = useRef(false);
  const surrenderRef = useRef(false);

  const isSoundEnabledRef = useRef(isSoundEnabled);
  useEffect(() => {
    isSoundEnabledRef.current = isSoundEnabled;
  }, [isSoundEnabled]);

  const isMusicEnabledRef = useRef(isMusicEnabled);
  useEffect(() => {
    isMusicEnabledRef.current = isMusicEnabled;
  }, [isMusicEnabled]);

  useEffect(() => {
    startMusic('/audio/bg-music.mp3', isMusicEnabled);
    return () => {
      stopMusic();
    };
  }, [isMusicEnabled]);

  useEffect(() => {
    if (winner) {
      const timer = setTimeout(() => {
        stopMusic();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [winner]);

  const handleFleetSizeChange = (size: number) => {
    setFleetSize(size);
    fleetSizeRef.current = size;
  };

  const togglePause = () => {
    setIsPaused(prev => {
      const next = !prev;
      isPausedRef.current = next;
      playSound('click', isSoundEnabledRef.current);
      if (next) {
        setMusicEnabled(false);
      } else {
        setMusicEnabled(isMusicEnabledRef.current);
      }
      return next;
    });
  };

  const handleSurrender = () => {
    playSound('click', isSoundEnabledRef.current);
    surrenderRef.current = true;
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  useEffect(() => {
    const isReady = omniStrikeCooldown === 0 && playerPlanetCount >= 5;
    if (isReady && !wasOmniReady && showUI) {
      playSound('select', isSoundEnabled);
      setWasOmniReady(true);
    } else if (!isReady && wasOmniReady) {
      setWasOmniReady(false);
    }
  }, [omniStrikeCooldown, playerPlanetCount, wasOmniReady, isSoundEnabled, showUI]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        canvas.width = width;
        canvas.height = height;
      }
    });
    resizeObserver.observe(canvas);

    // World size
    const WORLD_WIDTH = 3000;
    const WORLD_HEIGHT = 3000;

    // Initialize Game Engine
    const engine = new GameEngine(WORLD_WIDTH, WORLD_HEIGHT);
    engine.isHardMode = isHardMode;

    const updatePlayerStats = () => {
      const pCount = Array.from(engine.bases.values()).filter(b => b.color === '#3b82f6').length;
      setPlayerPlanetCount(pCount);
    };

    engine.onLaunch = (fromId) => {
      const base = engine.bases.get(fromId);
      if (base?.color === '#3b82f6') {
        playSound('launch', isSoundEnabledRef.current);
      }
    };

    engine.onCapture = (_, color) => {
      if (color === '#3b82f6') {
        playSound('capture', isSoundEnabledRef.current);
      }
      updatePlayerStats();
    };

    engine.onOmniStrike = (color) => {
      // Play the sonic boom sound whenever ANYONE uses Omni-Strike
      playSound('omniLaunch', isSoundEnabledRef.current);
    };

    engine.onCapitalDestroyed = (color) => {
      playSound('capitalDestroyed', isSoundEnabledRef.current);
    };

    // Camera state
    const playerBase = Array.from(engine.bases.values()).find(b => b.color === '#3b82f6');
    
    // Intro Animation State
    let isIntroPlaying = true;
    const introStartTime = Date.now() + 500; // 500ms pause before zooming
    const introDuration = 2500; // 2.5 seconds zoom

    const startZoom = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT) * 0.9;
    const startX = (WORLD_WIDTH - width / startZoom) / 2;
    const startY = (WORLD_HEIGHT - height / startZoom) / 2;

    const targetZoom = 0.6;
    const targetX = playerBase ? playerBase.x - (width / 2) / targetZoom : startX;
    const targetY = playerBase ? playerBase.y - (height / 2) / targetZoom : startY;

    let cameraZoom = startZoom;
    let cameraX = startX;
    let cameraY = startY;

    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let mouseDownX = 0;
    let mouseDownY = 0;

    // Game state
    let selectedBaseId: string | null = null;
    let isGameOver = false;

    // Touch state
    let lastPinchDist = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let isTouchDragging = false;

    // Mouse Events for Camera Panning
    const handleMouseDown = (e: MouseEvent) => {
      resumeAudioContext();
      if (isIntroPlaying) return;
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      mouseDownX = e.clientX;
      mouseDownY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPausedRef.current) return;
      if (isDragging) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        cameraX -= dx / cameraZoom;
        cameraY -= dy / cameraZoom;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isIntroPlaying) return;
      isDragging = false;
      if (isGameOver || isPausedRef.current) return;
      
      const dist = Math.hypot(e.clientX - mouseDownX, e.clientY - mouseDownY);
      if (dist < 15) { // Increased from 5 to 15 to allow a tiny bit of mouse wiggle
        // It's a click
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX / cameraZoom) + cameraX;
        const worldY = (mouseY / cameraZoom) + cameraY;

        let clickedBaseId: string | null = null;
        let minDistance = Infinity;
        
        for (const base of engine.bases.values()) {
          const dx = base.x - worldX;
          const dy = base.y - worldY;
          const dist = Math.hypot(dx, dy);
          const baseRadius = 20 + Math.sqrt(base.pixelCount) * 5;
          // Add 25 screen-pixels of padding, converted to world units
          const clickRadius = baseRadius + (25 / cameraZoom);
          
          if (dist < clickRadius && dist < minDistance) {
            clickedBaseId = base.id;
            minDistance = dist;
          }
        }

        if (isOmniStrikeTargetingRef.current) {
          if (clickedBaseId) {
            const targetBase = engine.bases.get(clickedBaseId);
            const playerBases = Array.from(engine.bases.values()).filter(b => b.color === '#3b82f6');
            const isInRange = playerBases.some(b => Math.hypot(b.x - targetBase!.x, b.y - targetBase!.y) <= engine.MAX_ATTACK_RANGE);

            if (targetBase && targetBase.color !== '#3b82f6' && isInRange) {
              engine.omniStrike('#3b82f6', clickedBaseId);
              playSound('omniLaunch', isSoundEnabled);
              setOmniStrikeCooldown(60);
            } else {
              playSound('error', isSoundEnabled);
            }
          }
          setIsOmniStrikeTargeting(false);
          isOmniStrikeTargetingRef.current = false;
          selectedBaseId = null;
          return;
        }

        if (clickedBaseId) {
          const clickedBase = engine.bases.get(clickedBaseId);
          if (!selectedBaseId) {
            // Only allow selecting player's own bases (blue)
            if (clickedBase?.color === '#3b82f6') {
              selectedBaseId = clickedBaseId;
              playSound('select', isSoundEnabled);
            } else {
              playSound('error', isSoundEnabled);
            }
          } else if (selectedBaseId === clickedBaseId) {
            selectedBaseId = null; // deselect
            playSound('click', isSoundEnabled);
          } else {
            const selectedBase = engine.bases.get(selectedBaseId);
            const targetBase = engine.bases.get(clickedBaseId);
            if (selectedBase && targetBase) {
              const dist = Math.hypot(targetBase.x - selectedBase.x, targetBase.y - selectedBase.y);
              if (dist <= engine.MAX_ATTACK_RANGE) {
                engine.sendUnits(selectedBaseId, clickedBaseId, fleetSizeRef.current);
              } else {
                playSound('error', isSoundEnabled);
              }
            }
            selectedBaseId = null;
          }
        } else {
          selectedBaseId = null;
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isIntroPlaying || isPausedRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // World position before zoom
      const worldX = (mouseX / cameraZoom) + cameraX;
      const worldY = (mouseY / cameraZoom) + cameraY;

      const zoomFactor = Math.exp(-e.deltaY * 0.002);
      const newZoom = Math.max(0.1, Math.min(cameraZoom * zoomFactor, 3));

      // Adjust camera to keep mouse over same world point
      cameraX = worldX - (mouseX / newZoom);
      cameraY = worldY - (mouseY / newZoom);
      cameraZoom = newZoom;
    };

    // Touch Events
    const handleTouchStart = (e: TouchEvent) => {
      resumeAudioContext();
      e.preventDefault();
      if (isIntroPlaying) return;
      if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isTouchDragging = true;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.hypot(dx, dy);
        lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        isTouchDragging = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (isIntroPlaying || isPausedRef.current) return;
      if (e.touches.length === 1 && isTouchDragging) {
        const dx = e.touches[0].clientX - lastTouchX;
        const dy = e.touches[0].clientY - lastTouchY;
        cameraX -= dx / cameraZoom;
        cameraY -= dy / cameraZoom;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        
        const centerScreenX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerScreenY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        // Pan
        const panX = centerScreenX - lastTouchX;
        const panY = centerScreenY - lastTouchY;
        cameraX -= panX / cameraZoom;
        cameraY -= panY / cameraZoom;

        // Zoom
        const worldX = (centerScreenX / cameraZoom) + cameraX;
        const worldY = (centerScreenY / cameraZoom) + cameraY;

        const zoomFactor = dist / lastPinchDist;
        const newZoom = Math.max(0.1, Math.min(cameraZoom * zoomFactor, 3));

        cameraX = worldX - (centerScreenX / newZoom);
        cameraY = worldY - (centerScreenY / newZoom);
        cameraZoom = newZoom;
        
        lastPinchDist = dist;
        lastTouchX = centerScreenX;
        lastTouchY = centerScreenY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (isIntroPlaying || isGameOver || isPausedRef.current) return;
      
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const dist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
        
        // If it was a quick tap without much movement (allow up to 30px of thumb rolling)
        if (dist < 30) {
          const rect = canvas.getBoundingClientRect();
          const touchX = touch.clientX - rect.left;
          const touchY = touch.clientY - rect.top;
          const worldX = (touchX / cameraZoom) + cameraX;
          const worldY = (touchY / cameraZoom) + cameraY;

          let clickedBaseId: string | null = null;
          let minDistance = Infinity;
          
          for (const base of engine.bases.values()) {
            const dx = base.x - worldX;
            const dy = base.y - worldY;
            const dist = Math.hypot(dx, dy);
            // Base visual radius
            const baseRadius = 20 + Math.sqrt(base.pixelCount) * 5;
            // For touch screens, give them 50 screen-pixels of padding, converted to world units
            const clickRadius = baseRadius + (50 / cameraZoom);
            
            if (dist < clickRadius && dist < minDistance) {
              clickedBaseId = base.id;
              minDistance = dist;
            }
          }

          if (clickedBaseId) {
            const clickedBase = engine.bases.get(clickedBaseId);

            if (isOmniStrikeTargetingRef.current) {
              const playerBases = Array.from(engine.bases.values()).filter(b => b.color === '#3b82f6');
              const isInRange = clickedBase ? playerBases.some(b => Math.hypot(b.x - clickedBase.x, b.y - clickedBase.y) <= engine.MAX_ATTACK_RANGE) : false;

              if (clickedBase && clickedBase.color !== '#3b82f6' && isInRange) {
                engine.omniStrike('#3b82f6', clickedBaseId);
                playSound('omniLaunch', isSoundEnabled);
                setOmniStrikeCooldown(60);
              } else {
                playSound('error', isSoundEnabled);
              }
              setIsOmniStrikeTargeting(false);
              isOmniStrikeTargetingRef.current = false;
              selectedBaseId = null;
              return;
            }

            if (!selectedBaseId) {
              if (clickedBase?.color === '#3b82f6') {
                selectedBaseId = clickedBaseId;
                playSound('select', isSoundEnabled);
              } else {
                playSound('error', isSoundEnabled);
              }
            } else if (selectedBaseId === clickedBaseId) {
              selectedBaseId = null;
              playSound('click', isSoundEnabled);
            } else {
              const selectedBase = engine.bases.get(selectedBaseId);
              const targetBase = engine.bases.get(clickedBaseId);
              if (selectedBase && targetBase) {
                const dist = Math.hypot(targetBase.x - selectedBase.x, targetBase.y - selectedBase.y);
                if (dist <= engine.MAX_ATTACK_RANGE) {
                  engine.sendUnits(selectedBaseId, clickedBaseId, fleetSizeRef.current);
                } else {
                  playSound('error', isSoundEnabled);
                }
              }
              selectedBaseId = null;
            }
          } else {
            selectedBaseId = null;
          }
        }
      }

      if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 0) {
        isTouchDragging = false;
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    let animationFrameId: number;
    let lastUiUpdateTime = 0;
    let lastTime = Date.now();

    let cinematicStartTime = 0;
    let cinematicStartX = 0;
    let cinematicStartY = 0;
    let cinematicStartZoom = 0;
    let cinematicTargetX = 0;
    let cinematicTargetY = 0;
    let cinematicStartRotation = 0;
    let cinematicTargetRotation = 0;
    let cameraRotation = 0;
    const cinematicTargetZoom = 2.5;
    let isPlayerWinner = false;

    const loop = () => {
      const currentTime = Date.now();
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      // Cap dt to prevent huge jumps if tab is inactive
      const safeDt = Math.min(dt, 0.1);

      if (isIntroPlaying) {
        if (currentTime > introStartTime) {
          let progress = (currentTime - introStartTime) / introDuration;
          if (progress >= 1) {
            progress = 1;
            if (isIntroPlaying) {
              isIntroPlaying = false;
              setShowUI(true);
            }
          }
          // easeInOutCubic
          const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          
          cameraZoom = startZoom + (targetZoom - startZoom) * ease;
          cameraX = startX + (targetX - startX) * ease;
          cameraY = startY + (targetY - startY) * ease;
        }
      }

      if (!isGameOver) {
        if (surrenderRef.current) {
          const playerCapital = Array.from(engine.bases.values()).find(b => b.color === '#3b82f6' && b.isCapital);
          if (playerCapital) {
            playerCapital.isCapital = false;
            engine.lastDestroyedCapital = { x: playerCapital.x, y: playerCapital.y, color: '#3b82f6' };
            engine.createExplosion(playerCapital.x, playerCapital.y, '#3b82f6', 200, true);
            engine.onCapitalDestroyed?.('#3b82f6');
            // Eliminate player
            for (const b of engine.bases.values()) {
              if (b.color === '#3b82f6') {
                b.color = '#6b7280';
              }
            }
            for (const p of engine.pixels) {
              if (p.color === '#3b82f6') {
                p.color = '#6b7280';
              }
            }
          }
          surrenderRef.current = false;
        }

        if (!isPausedRef.current) {
          // Update game state
          engine.update(safeDt);
          
          // Update cooldown
          setOmniStrikeCooldown(prev => Math.max(0, prev - safeDt));
        }
      } else {
        const timeSinceEnd = currentTime - cinematicStartTime;
        
        // Time ramping: Start at 10% speed immediately, speed up to 30% after the zoom
        let currentSpeed = 0.1;
        if (timeSinceEnd > 4000) {
          currentSpeed = 0.3; 
        }
        engine.update(safeDt * currentSpeed);
        
        // Cinematic camera animation (starts immediately)
        const progress = Math.min(1, timeSinceEnd / 4000); // 4.0 seconds to zoom (slower and easier to follow)
        const ease = 1 - Math.pow(1 - progress, 4); // Quartic ease out (whip pan)
        
        cameraZoom = cinematicStartZoom + (cinematicTargetZoom - cinematicStartZoom) * ease;
        
        // Orbit effect: Add a slight circular offset based on time
        const orbitRadius = progress * 50;
        const orbitAngle = timeSinceEnd * 0.0005;
        
        cameraX = cinematicStartX + (cinematicTargetX - cinematicStartX) * ease + Math.cos(orbitAngle) * orbitRadius / cameraZoom;
        cameraY = cinematicStartY + (cinematicTargetY - cinematicStartY) * ease + Math.sin(orbitAngle) * orbitRadius / cameraZoom;
        
        // Dutch angle rotation
        cameraRotation = cinematicStartRotation + (cinematicTargetRotation - cinematicStartRotation) * ease;
        
        // If player lost, add camera shake
        if (!isPlayerWinner && progress < 1) {
           const shake = (1 - progress) * 20; // Decreasing shake
           cameraX += (Math.random() - 0.5) * shake / cameraZoom;
           cameraY += (Math.random() - 0.5) * shake / cameraZoom;
        }
      }

      // Clear screen
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#05050a'; // Dark background
      ctx.fillRect(0, 0, width, height);

      // Apply camera transform with rotation
      if (cameraRotation !== 0) {
        ctx.translate(width / 2, height / 2);
        ctx.rotate(cameraRotation);
        ctx.translate(-width / 2, -height / 2);
      }
      ctx.translate(-cameraX * cameraZoom, -cameraY * cameraZoom);
      ctx.scale(cameraZoom, cameraZoom);

      // Draw game
      engine.draw(ctx, selectedBaseId, cameraX, cameraY, isOmniStrikeTargetingRef.current);

      // Update UI state periodically (every 250ms) to avoid React re-render spam
      const now = Date.now();
      if (now - lastUiUpdateTime > 250 && !isGameOver) {
        const currentFactions = [
          { color: '#3b82f6', isPlayer: true, isAlive: false, shipCount: 0, name: 'PLAYER' },
          { color: '#ef4444', isPlayer: false, isAlive: false, shipCount: 0, name: 'AI RED' },
          { color: '#22c55e', isPlayer: false, isAlive: false, shipCount: 0, name: 'AI GREEN' },
          { color: '#eab308', isPlayer: false, isAlive: false, shipCount: 0, name: 'AI YELLOW' },
        ];

        let playerAlive = false;
        let aiAliveCount = 0;

        for (const base of engine.bases.values()) {
          if (base.isCapital) {
            const faction = currentFactions.find(f => f.color === base.color);
            if (faction) {
              faction.isAlive = true;
              if (faction.isPlayer) playerAlive = true;
              else aiAliveCount++;
            }
          }
        }

        for (const pixel of engine.pixels) {
          const faction = currentFactions.find(f => f.color === pixel.color);
          if (faction) {
            faction.shipCount++;
          }
        }

        setFactions(currentFactions);

        if (!playerAlive || aiAliveCount === 0) {
          if (!isGameOver) {
            isGameOver = true;
            isPlayerWinner = playerAlive;
            setWinner({ color: playerAlive ? '#3b82f6' : '#ef4444' });
            
            if (playerAlive) {
              playSound('win', isSoundEnabledRef.current);
            } else {
              playSound('lose', isSoundEnabledRef.current);
            }
            
            cinematicStartTime = Date.now();
            cinematicStartX = cameraX;
            cinematicStartY = cameraY;
            cinematicStartZoom = cameraZoom;
            cinematicStartRotation = 0;
            cinematicTargetRotation = playerAlive ? 0.15 : -0.25; // Dutch angle
            
            if (engine.lastDestroyedCapital) {
              cinematicTargetX = engine.lastDestroyedCapital.x - (width / 2) / cinematicTargetZoom;
              cinematicTargetY = engine.lastDestroyedCapital.y - (height / 2) / cinematicTargetZoom;
            } else {
              cinematicTargetX = cameraX;
              cinematicTargetY = cameraY;
            }
          }
        }

        lastUiUpdateTime = now;
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-[#05050a] touch-none overscroll-none select-none">
      {/* Domination UI */}
      <div className={`absolute top-0 left-0 right-0 p-2 sm:p-4 md:p-6 pointer-events-none z-40 flex justify-center transition-all duration-1000 ease-out ${showUI && !isOmniStrikeTargeting ? 'translate-y-0 opacity-100' : '-translate-y-[150%] opacity-0'}`}>
        <div className="bg-cyan-950/40 backdrop-blur-md px-3 py-2 sm:px-6 sm:py-3 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.1)] relative rounded-sm flex items-center gap-3 sm:gap-6 md:gap-8 pointer-events-auto">
          {/* Corner accents */}
          <div className="absolute -top-[1px] -left-[1px] w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute -top-[1px] -right-[1px] w-2 h-2 border-t-2 border-r-2 border-cyan-400" />
          <div className="absolute -bottom-[1px] -left-[1px] w-2 h-2 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute -bottom-[1px] -right-[1px] w-2 h-2 border-b-2 border-r-2 border-cyan-400" />

          {factions.map((faction) => (
            <div 
              key={faction.color} 
              className={`flex items-center gap-1.5 sm:gap-3 transition-all duration-300 ${faction.isAlive ? 'opacity-100' : 'opacity-30 grayscale'}`}
            >
              <div 
                className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm shrink-0" 
                style={{ 
                  backgroundColor: faction.color, 
                  boxShadow: faction.isAlive ? `0 0 12px ${faction.color}` : 'none' 
                }} 
              />
              <span className="font-mono text-sm sm:text-lg md:text-xl font-bold text-white tracking-wider w-8 sm:w-12 md:w-16 text-left">
                {faction.isAlive ? faction.shipCount : 'OUT'}
              </span>
            </div>
          ))}

          {/* Divider */}
          <div className="w-px h-6 bg-cyan-500/30 mx-1 sm:mx-2 hidden sm:block" />

          {/* Controls */}
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={togglePause}
              onMouseEnter={() => playSound('hover', isSoundEnabled)}
              className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border transition-all rounded-sm ${
                isPaused 
                  ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]' 
                  : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/50 hover:border-cyan-400'
              }`}
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play size={18} className="ml-0.5" /> : <Pause size={18} />}
            </button>
            <button
              onClick={() => setShowSurrenderConfirm(true)}
              onMouseEnter={() => playSound('hover', isSoundEnabled)}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-900/50 hover:border-red-400 transition-all rounded-sm"
              title="Surrender"
            >
              <Flag size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Paused Overlay */}
      {isPaused && !winner && (
        <div 
          className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-center justify-center cursor-pointer"
          onClick={togglePause}
        >
          <div className="text-cyan-400 font-mono text-4xl font-bold tracking-[0.5em] uppercase drop-shadow-[0_0_20px_rgba(6,182,212,0.8)] animate-pulse pointer-events-none">
            Paused
          </div>
        </div>
      )}

      {/* Surrender Confirmation Modal */}
      {showSurrenderConfirm && !winner && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-red-950/40 backdrop-blur-md border border-red-500/30 p-8 flex flex-col items-center gap-6 shadow-[0_0_30px_rgba(239,68,68,0.2)] relative rounded-sm max-w-md text-center">
            {/* Corner accents */}
            <div className="absolute -top-[1px] -left-[1px] w-4 h-4 border-t-2 border-l-2 border-red-500" />
            <div className="absolute -top-[1px] -right-[1px] w-4 h-4 border-t-2 border-r-2 border-red-500" />
            <div className="absolute -bottom-[1px] -left-[1px] w-4 h-4 border-b-2 border-l-2 border-red-500" />
            <div className="absolute -bottom-[1px] -right-[1px] w-4 h-4 border-b-2 border-r-2 border-red-500" />

            <h2 className="text-red-400 font-mono text-sm tracking-widest uppercase flex items-center gap-3">
              <span className="w-2 h-2 bg-red-500 animate-pulse" />
              Initiate Self-Destruct?
            </h2>
            <p className="text-red-100/80 font-mono text-sm">This will instantly destroy your Capital and end the simulation. This action cannot be undone.</p>
            <div className="flex gap-4 w-full mt-2">
              <button
                onClick={() => {
                  setShowSurrenderConfirm(false);
                  playSound('click', isSoundEnabled);
                }}
                onMouseEnter={() => playSound('hover', isSoundEnabled)}
                className="flex-1 px-4 py-3 border border-red-500/30 text-red-400 font-mono text-xs tracking-widest uppercase hover:bg-red-900/40 hover:border-red-400 transition-colors rounded-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSurrenderConfirm(false);
                  handleSurrender();
                }}
                onMouseEnter={() => playSound('hover', isSoundEnabled)}
                className="flex-1 px-4 py-3 bg-red-950/60 border border-red-500 text-red-300 font-mono text-xs tracking-widest uppercase font-bold hover:bg-red-900/80 hover:text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all rounded-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tactical Console (Bottom Right) */}
      <div className={`absolute bottom-6 right-6 z-20 w-36 flex flex-col items-stretch gap-3 transition-all duration-1000 ease-out ${showUI && !isOmniStrikeTargeting ? 'translate-y-0 opacity-100' : 'translate-y-[150%] opacity-0'}`}>
        
        {/* Fleet Deployment Section */}
        <div className="flex flex-col gap-1">
          <div className="text-cyan-500/80 font-mono text-[10px] uppercase tracking-widest text-center">Fleet Deployment</div>
          <div className="flex bg-cyan-950/40 backdrop-blur-md p-1 border border-cyan-500/30 rounded-sm shadow-[0_0_20px_rgba(6,182,212,0.1)] relative">
            {/* Corner accents */}
            <div className="absolute -top-[1px] -left-[1px] w-1.5 h-1.5 border-t border-l border-cyan-400" />
            <div className="absolute -top-[1px] -right-[1px] w-1.5 h-1.5 border-t border-r border-cyan-400" />
            <div className="absolute -bottom-[1px] -left-[1px] w-1.5 h-1.5 border-b border-l border-cyan-400" />
            <div className="absolute -bottom-[1px] -right-[1px] w-1.5 h-1.5 border-b border-r border-cyan-400" />
            
            {[0.1, 0.5, 1.0].map((size) => (
              <button
                key={size}
                onMouseEnter={() => playSound('hover', isSoundEnabled)}
                onClick={() => {
                  handleFleetSizeChange(size);
                  playSound('click', isSoundEnabled);
                }}
                className={`flex-1 py-2 font-mono text-xs font-bold transition-all rounded-sm ${
                  fleetSize === size 
                    ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' 
                    : 'text-cyan-400 hover:bg-cyan-900/50'
                }`}
              >
                {size * 100}%
              </button>
            ))}
          </div>
        </div>

        {/* Omni-Strike Section */}
        <div className="flex flex-col gap-1">
          <div className="relative">
            <motion.button
              disabled={omniStrikeCooldown > 0 || playerPlanetCount < 5}
              onMouseEnter={() => playSound('hover', isSoundEnabled)}
              onClick={() => {
                if (isOmniStrikeTargeting) {
                  setIsOmniStrikeTargeting(false);
                  isOmniStrikeTargetingRef.current = false;
                  playSound('click', isSoundEnabled);
                } else {
                  setIsOmniStrikeTargeting(true);
                  isOmniStrikeTargetingRef.current = true;
                  playSound('charge', isSoundEnabled);
                }
              }}
              animate={(!isOmniStrikeTargeting && omniStrikeCooldown === 0 && playerPlanetCount >= 5) ? {
                boxShadow: [
                  "0 0 10px rgba(34, 211, 238, 0.3)",
                  "0 0 40px rgba(34, 211, 238, 0.8)",
                  "0 0 10px rgba(34, 211, 238, 0.3)"
                ],
                borderColor: ["rgba(6, 182, 212, 0.4)", "rgba(34, 211, 238, 1)", "rgba(6, 182, 212, 0.4)"],
                backgroundColor: ["rgba(8, 145, 178, 0.2)", "rgba(8, 145, 178, 0.6)", "rgba(8, 145, 178, 0.2)"],
                scale: [1, 1.05, 1]
              } : {}}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className={`relative w-full py-4 font-mono text-xs font-black tracking-[0.1em] uppercase transition-all border backdrop-blur-md overflow-hidden rounded-sm ${
                isOmniStrikeTargeting 
                  ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                  : (omniStrikeCooldown > 0 || playerPlanetCount < 5)
                    ? 'bg-gray-900/40 border-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-900/40'
              }`}
            >
              {/* Corner accents for button */}
              <div className="absolute -top-[1px] -left-[1px] w-1.5 h-1.5 border-t border-l border-cyan-400 opacity-40" />
              <div className="absolute -top-[1px] -right-[1px] w-1.5 h-1.5 border-t border-r border-cyan-400 opacity-40" />
              <div className="absolute -bottom-[1px] -left-[1px] w-1.5 h-1.5 border-b border-l border-cyan-400 opacity-40" />
              <div className="absolute -bottom-[1px] -right-[1px] w-1.5 h-1.5 border-b border-r border-cyan-400 opacity-40" />

              {/* Cooldown Progress Overlay */}
              {omniStrikeCooldown > 0 && (
                <div 
                  className="absolute inset-0 bg-black/60 z-0"
                  style={{ clipPath: `inset(0 0 0 ${100 - (omniStrikeCooldown / 60 * 100)}%)` }}
                />
              )}
              
              {/* Scanning Line Animation (Only when ready) */}
              {!isOmniStrikeTargeting && omniStrikeCooldown === 0 && playerPlanetCount >= 5 && (
                <motion.div 
                  animate={{ top: ['-10%', '110%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-[1px] bg-cyan-400/20 z-0 shadow-[0_0_4px_rgba(34,211,238,0.3)]"
                />
              )}

              <span className="relative z-10 flex items-center justify-center gap-2 w-full">
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${isOmniStrikeTargeting ? 'bg-red-500' : (omniStrikeCooldown === 0 && playerPlanetCount >= 5 ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-cyan-900')}`} />
                <span className="truncate">
                  {isOmniStrikeTargeting ? 'Targeting...' : 'Omni-Strike'}
                </span>
              </span>
            </motion.button>
          </div>
          
          <div className="flex justify-center px-1">
            {playerPlanetCount < 5 ? (
              <div className="text-[10px] text-cyan-500/60 font-mono uppercase tracking-tight">
                Req: 5 Planets ({playerPlanetCount}/5)
              </div>
            ) : omniStrikeCooldown > 0 ? (
              <div className="text-[10px] text-red-500/80 font-mono uppercase tracking-tight">
                Recharging: {Math.ceil(omniStrikeCooldown)}s
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Targeting Overlay (Satellite View) */}
      {isOmniStrikeTargeting && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-40 pointer-events-none overflow-hidden"
        >
          {/* Vignette & Border */}
          <div className="absolute inset-0 border-[40px] border-red-500/10 shadow-[inset_0_0_100px_rgba(239,68,68,0.2)]" />
          
          {/* HUD Header */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <div className="px-6 py-2 bg-red-950/80 border border-red-500 text-red-400 font-mono text-xs tracking-[0.3em] uppercase shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              Omni-Strike Protocol Active
            </div>
            <div className="text-red-500/60 font-mono text-[10px] uppercase tracking-widest animate-pulse">
              Select Enemy Target Base
            </div>
          </div>

          {/* Tactical Grid & Scanlines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(239,68,68,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.03)_2px,transparent_2px)] bg-[size:100%_4px]" />
        </motion.div>
      )}

      {/* Game Over Overlay */}
      {winner && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 1.5 }}
          className={`absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-xl overflow-hidden font-sans ${winner.color === '#ef4444' ? 'bg-black/90' : 'bg-black/80'}`}
        >
          {/* Tactical Grid & Scanlines */}
          <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_50%,transparent_50%)] bg-[length:100%_4px]" />

          {/* Cinematic Letterbox Bars */}
          <motion.div 
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1, delay: 1.5, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-0 left-0 right-0 h-24 md:h-32 bg-[#030305] z-0 border-b border-cyan-900/30"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1, delay: 1.5, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-0 left-0 right-0 h-24 md:h-32 bg-[#030305] z-0 border-t border-cyan-900/30"
          />

          <motion.div 
            initial={{ scale: 0.9, opacity: 0, filter: 'blur(10px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.5, delay: 2.0, ease: "easeOut" }}
            className="relative z-10 flex flex-col items-center text-center px-6"
          >
            <div className="text-cyan-500/60 font-mono text-xs tracking-widest mb-8">
              SYS.MSG_RECV <br/>
              STATUS: <span className={winner.color === '#3b82f6' ? "text-green-400" : "text-red-500 animate-pulse"}>
                {winner.color === '#3b82f6' ? 'SECURE' : 'CRITICAL'}
              </span>
            </div>

            <div 
              className="w-16 h-16 mx-auto mb-8 relative"
              style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
            >
              <div className="absolute inset-0 animate-ping opacity-20" style={{ backgroundColor: winner.color }} />
              <div className="absolute inset-0" style={{ backgroundColor: winner.color, boxShadow: `0 0 60px ${winner.color}` }} />
            </div>
            
            <h2 className={`text-5xl md:text-7xl font-black tracking-tighter mb-4 drop-shadow-[0_0_20px_rgba(0,0,0,0.5)] ${winner.color === '#3b82f6' ? 'text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-400' : 'text-transparent bg-clip-text bg-gradient-to-b from-white to-red-500'}`}>
              {winner.color === '#3b82f6' ? 'VICTORY' : 'DEFEAT'}
            </h2>
            
            <div className="h-[2px] w-full max-w-xs bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 mb-4" />

            <p className="text-cyan-300/80 font-mono tracking-[0.4em] text-xs mb-12 uppercase">
              {winner.color === '#3b82f6' 
                ? '> Sector Secured. Awaiting orders.' 
                : '> System Offline. Signal lost.'}
            </p>
            
            <motion.button 
              whileHover={{ scale: 1.05, backgroundColor: "rgba(6, 182, 212, 0.2)" }}
              whileTap={{ scale: 0.95 }}
              onMouseEnter={() => playSound('hover', isSoundEnabled)}
              onClick={() => {
                playSound('select', isSoundEnabled);
                setTimeout(() => window.location.reload(), 400);
              }}
              className="group relative px-12 py-5 bg-cyan-950/60 border border-cyan-400 text-cyan-300 font-bold tracking-[0.3em] uppercase transition-all overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:text-white cursor-pointer rounded-sm"
            >
              <div className="absolute inset-0 bg-cyan-400/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              {/* Button corner accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 flex items-center gap-3">
                Restart Simulation
                <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </span>
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      <canvas 
        ref={canvasRef} 
        onContextMenu={(e) => e.preventDefault()}
        className="block w-full h-full cursor-grab active:cursor-grabbing touch-none"
      />
    </div>
  );
}

export default function App() {
  const [gameState, setGameState] = useState<'landing' | 'playing'>('landing');
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isMusicEnabled, setIsMusicEnabled] = useState(true);
  const [isHardMode, setIsHardMode] = useState(false);

  const interactionHandled = useRef(false);

  useEffect(() => {
    if (interactionHandled.current) return;

    const handleFirstInteraction = () => {
      if (interactionHandled.current) return;
      
      resumeAudioContext();
      interactionHandled.current = true;
      
      // Clean up all possible interaction listeners
      const events = ['click', 'keydown', 'mousedown', 'pointerdown', 'touchstart'];
      events.forEach(e => window.removeEventListener(e, handleFirstInteraction));
    };

    const events = ['click', 'keydown', 'mousedown', 'pointerdown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, handleFirstInteraction));

    return () => {
      const events = ['click', 'keydown', 'mousedown', 'pointerdown', 'touchstart'];
      events.forEach(e => window.removeEventListener(e, handleFirstInteraction));
    };
  }, []);

  const handleToggleMusic = (enabled: boolean) => {
    setIsMusicEnabled(enabled);
    setMusicEnabled(enabled);
  };

  if (gameState === 'landing') {
    return (
      <LandingPage 
        onPlay={() => setGameState('playing')} 
        isSoundEnabled={isSoundEnabled} 
        setIsSoundEnabled={setIsSoundEnabled}
        isMusicEnabled={isMusicEnabled}
        setIsMusicEnabled={handleToggleMusic}
        isHardMode={isHardMode}
        setIsHardMode={setIsHardMode}
      />
    );
  }

  return <Game isSoundEnabled={isSoundEnabled} isMusicEnabled={isMusicEnabled} isHardMode={isHardMode} />;
}
