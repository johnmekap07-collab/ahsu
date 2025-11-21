import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, Bird, Pipe } from '../types';
import {
  GRAVITY,
  JUMP_STRENGTH,
  PIPE_SPEED,
  PIPE_SPAWN_RATE,
  PIPE_GAP,
  PIPE_WIDTH,
  BIRD_RADIUS,
  BIRD_X,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLOR_SKY,
  COLOR_BIRD,
  COLOR_PIPE,
  COLOR_PIPE_BORDER,
  COLOR_GROUND,
  COLOR_GRASS
} from '../constants';
import { getGameFeedback } from '../services/geminiService';

const FlappyGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [aiFeedback, setAiFeedback] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);

  // Mutable game state refs to avoid React render loop issues
  const birdRef = useRef<Bird>({ y: CANVAS_HEIGHT / 2, velocity: 0, rotation: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const frameCountRef = useRef(0);
  const scoreRef = useRef(0);
  const reqRef = useRef<number>();

  // Initialize or Reset Game
  const resetGame = useCallback(() => {
    birdRef.current = { y: CANVAS_HEIGHT / 2, velocity: 0, rotation: 0 };
    pipesRef.current = [];
    frameCountRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
    setAiFeedback("");
  }, []);

  const startGame = () => {
    resetGame();
    setGameState(GameState.PLAYING);
  };

  const gameOver = useCallback(async () => {
    setGameState(GameState.GAME_OVER);
    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current);
    }
    
    // Trigger AI Feedback
    setLoadingAi(true);
    const feedback = await getGameFeedback(scoreRef.current);
    setAiFeedback(feedback);
    setLoadingAi(false);
  }, [highScore]);

  const jump = useCallback(() => {
    if (gameState === GameState.PLAYING) {
      birdRef.current.velocity = JUMP_STRENGTH;
    } else if (gameState === GameState.START || gameState === GameState.GAME_OVER) {
       if (gameState === GameState.GAME_OVER && loadingAi) return; // Prevent restart while loading
       if (gameState === GameState.GAME_OVER) {
           startGame();
       } else {
           startGame();
           // Apply initial jump immediately
           requestAnimationFrame(() => {
               birdRef.current.velocity = JUMP_STRENGTH;
           });
       }
    }
  }, [gameState, loadingAi, startGame, resetGame]);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault(); // Stop scrolling
        jump();
      }
    };

    const handleTouch = (e: TouchEvent) => {
       e.preventDefault(); // Prevent scroll/zoom
       jump();
    };
    
    const handleMouseDown = (e: MouseEvent) => {
        jump();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouch, { passive: false });
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [jump]);

  // Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const loop = () => {
      // 1. UPDATE LOGIC
      if (gameState === GameState.PLAYING) {
        // Bird Physics
        birdRef.current.velocity += GRAVITY;
        birdRef.current.y += birdRef.current.velocity;
        
        // Rotation based on velocity
        birdRef.current.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (birdRef.current.velocity * 0.1)));

        // Pipe Spawning
        if (frameCountRef.current % PIPE_SPAWN_RATE === 0) {
          const minPipeHeight = 50;
          const maxPipeHeight = CANVAS_HEIGHT - PIPE_GAP - minPipeHeight - 100; // -100 for ground buffer
          const randomHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
          
          pipesRef.current.push({
            x: CANVAS_WIDTH,
            topHeight: randomHeight,
            passed: false,
          });
        }

        // Pipe Movement & Collision
        pipesRef.current.forEach(pipe => {
          pipe.x -= PIPE_SPEED;

          // Collision Check
          // Horizontal overlap
          if (
            BIRD_X + BIRD_RADIUS > pipe.x && 
            BIRD_X - BIRD_RADIUS < pipe.x + PIPE_WIDTH
          ) {
            // Vertical check (hit top pipe OR hit bottom pipe)
            if (
              birdRef.current.y - BIRD_RADIUS < pipe.topHeight ||
              birdRef.current.y + BIRD_RADIUS > pipe.topHeight + PIPE_GAP
            ) {
              gameOver();
            }
          }

          // Score update
          if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
            pipe.passed = true;
            scoreRef.current += 1;
            setScore(scoreRef.current);
          }
        });

        // Remove off-screen pipes
        pipesRef.current = pipesRef.current.filter(p => p.x > -PIPE_WIDTH);

        // Ground/Ceiling Collision
        if (birdRef.current.y + BIRD_RADIUS >= CANVAS_HEIGHT - 40) { // -40 for ground height
           birdRef.current.y = CANVAS_HEIGHT - 40 - BIRD_RADIUS;
           gameOver();
        }
        if (birdRef.current.y - BIRD_RADIUS <= 0) {
            birdRef.current.y = BIRD_RADIUS;
            birdRef.current.velocity = 0; // Bonk
        }

        frameCountRef.current++;
      } else if (gameState === GameState.START) {
         // Bobbing animation
         const time = Date.now() / 300;
         birdRef.current.y = (CANVAS_HEIGHT / 2) + Math.sin(time) * 10;
         birdRef.current.rotation = 0;
      }

      // 2. DRAWING LOGIC
      // Background
      ctx.fillStyle = COLOR_SKY;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Cloud decoration (Static for now, could move)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(100, 100, 30, 0, Math.PI * 2);
      ctx.arc(150, 110, 40, 0, Math.PI * 2);
      ctx.arc(200, 100, 30, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(500, 150, 40, 0, Math.PI * 2);
      ctx.arc(560, 160, 50, 0, Math.PI * 2);
      ctx.arc(620, 150, 40, 0, Math.PI * 2);
      ctx.fill();

      // Pipes
      pipesRef.current.forEach(pipe => {
        // Top Pipe
        ctx.fillStyle = COLOR_PIPE;
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.strokeStyle = COLOR_PIPE_BORDER;
        ctx.lineWidth = 3;
        ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        
        // Bottom Cap
        ctx.fillStyle = COLOR_PIPE_BORDER;
        ctx.fillRect(pipe.x - 2, pipe.topHeight - 20, PIPE_WIDTH + 4, 20);

        // Bottom Pipe
        const bottomPipeY = pipe.topHeight + PIPE_GAP;
        const bottomPipeHeight = CANVAS_HEIGHT - bottomPipeY - 40;
        ctx.fillStyle = COLOR_PIPE;
        ctx.fillRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
        ctx.strokeRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);

        // Top Cap for Bottom Pipe
        ctx.fillStyle = COLOR_PIPE_BORDER;
        ctx.fillRect(pipe.x - 2, bottomPipeY, PIPE_WIDTH + 4, 20);
      });

      // Ground
      const groundY = CANVAS_HEIGHT - 40;
      ctx.fillStyle = COLOR_GROUND;
      ctx.fillRect(0, groundY, CANVAS_WIDTH, 40);
      ctx.fillStyle = COLOR_GRASS;
      ctx.fillRect(0, groundY, CANVAS_WIDTH, 10);
      ctx.strokeStyle = '#2d3436';
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(CANVAS_WIDTH, groundY);
      ctx.stroke();

      // Bird
      ctx.save();
      ctx.translate(BIRD_X, birdRef.current.y);
      ctx.rotate(birdRef.current.rotation);
      
      // Bird Body
      ctx.fillStyle = COLOR_BIRD;
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000';
      ctx.stroke();

      // Eye
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(8, -6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(10, -6, 2, 0, Math.PI * 2);
      ctx.fill();

      // Wing
      ctx.fillStyle = '#fff59d';
      ctx.beginPath();
      ctx.arc(-6, 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Beak
      ctx.fillStyle = '#e67e22';
      ctx.beginPath();
      ctx.moveTo(8, 4);
      ctx.lineTo(18, 8);
      ctx.lineTo(8, 12);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      reqRef.current = requestAnimationFrame(loop);
    };

    reqRef.current = requestAnimationFrame(loop);

    return () => {
      if (reqRef.current) {
        cancelAnimationFrame(reqRef.current);
      }
    };
  }, [gameState, gameOver]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-800 p-4">
      
      {/* Game Container - Maintains Aspect Ratio */}
      <div className="relative max-w-[800px] w-full aspect-[4/3] shadow-2xl rounded-xl overflow-hidden border-4 border-slate-700 bg-black">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full object-contain"
        />

        {/* Score Overlay */}
        <div className="absolute top-8 left-0 w-full text-center pointer-events-none z-10">
            <span className="text-6xl font-bold text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] stroke-black stroke-2">
                {score}
            </span>
        </div>

        {/* Start Screen */}
        {gameState === GameState.START && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
            <h1 className="text-7xl font-bold text-[#f4d03f] mb-4 drop-shadow-lg tracking-widest">FLAPPY GENAI</h1>
            <div className="bg-white/10 p-6 rounded-xl border border-white/20 text-center">
                <p className="text-2xl text-white mb-6">Press <span className="font-bold text-yellow-300">SPACE</span> or <span className="font-bold text-yellow-300">TAP</span> to Fly</p>
                <p className="text-sm text-gray-300">High Score: {highScore}</p>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md p-6">
            <h2 className="text-6xl font-bold text-red-500 mb-6 drop-shadow-lg">GAME OVER</h2>
            
            <div className="bg-slate-800 p-8 rounded-2xl border-2 border-slate-600 flex flex-col items-center max-w-md w-full shadow-xl">
              <div className="flex justify-between w-full mb-6">
                <div className="text-center">
                    <p className="text-slate-400 text-lg uppercase">Score</p>
                    <p className="text-4xl text-white font-bold">{score}</p>
                </div>
                <div className="text-center">
                    <p className="text-slate-400 text-lg uppercase">Best</p>
                    <p className="text-4xl text-yellow-400 font-bold">{highScore}</p>
                </div>
              </div>

              {/* Gemini AI Feedback Section */}
              <div className="w-full bg-slate-900 rounded-lg p-4 mb-6 border border-slate-700 min-h-[100px] flex flex-col justify-center relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                 <p className="text-xs text-blue-400 font-bold mb-1 flex items-center gap-2">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                    GEMINI COACH SAYS:
                 </p>
                 {loadingAi ? (
                     <div className="flex items-center justify-center gap-2 text-slate-500 animate-pulse">
                        <span>Analyzing your skills...</span>
                     </div>
                 ) : (
                     <p className="text-gray-200 text-lg leading-tight italic">"{aiFeedback}"</p>
                 )}
              </div>

              <button 
                onClick={() => startGame()}
                className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-bold text-xl rounded-full transition-transform hover:scale-105 active:scale-95 shadow-lg w-full"
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="fixed bottom-4 right-4 text-slate-600 text-sm hidden md:block">
         Powered by Google Gemini 2.5 Flash
      </div>
    </div>
  );
};

export default FlappyGame;