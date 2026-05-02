import { useState, useEffect, useRef } from 'react';
import { Task, AppSettings } from '../types.ts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Timer as Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  Coffee, 
  Brain,
  CheckCircle2,
  Bell,
  Clock as StopwatchIcon,
  Volume2,
  VolumeX
} from 'lucide-react';
import { cn, formatDuration } from '../lib/utils.ts';

type Mode = 'focus' | 'short-break' | 'long-break';
type TimerType = 'pomodoro' | 'stopwatch';

export default function Pomodoro({ tasks, settings }: { tasks: Task[], settings: AppSettings }) {
  const timerConfig = settings.pomodoro || {
    workTime: 25,
    shortBreak: 5,
    longBreak: 15,
    autoStartBreaks: false,
    autoStartWork: false,
    soundEnabled: true
  };

  const STORAGE_KEY = 'yks_timer_persistent_state';

  // State initialization with Persistence
  const [timerType, setTimerType] = useState<TimerType>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).timerType : 'pomodoro';
  });

  const [mode, setMode] = useState<Mode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).mode : 'focus';
  });

  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.timerType === 'pomodoro') {
        if (data.isActive) {
          const elapsed = Math.floor((Date.now() - data.lastUpdated) / 1000);
          return Math.max(0, data.timeLeft - elapsed);
        }
        return data.timeLeft;
      }
    }
    return timerConfig.workTime * 60;
  });

  const [stopwatchTime, setStopwatchTime] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.timerType === 'stopwatch') {
        if (data.isActive) {
          const elapsed = Math.floor((Date.now() - data.lastUpdated) / 1000);
          return data.stopwatchTime + elapsed;
        }
        return data.stopwatchTime;
      }
    }
    return 0;
  });

  const [isActive, setIsActive] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).isActive : false;
  });

  const [sessionsCompleted, setSessionsCompleted] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).sessionsCompleted : 0;
  });

  const [activeTask, setActiveTask] = useState<Task | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const data = saved ? JSON.parse(saved) : null;
    if (data?.activeTaskId) {
      return tasks.find(t => t.id === data.activeTaskId) || null;
    }
    return null;
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Persistence Effect
  useEffect(() => {
    const state = {
      timerType,
      mode,
      timeLeft,
      stopwatchTime,
      isActive,
      sessionsCompleted,
      activeTaskId: activeTask?.id || null,
      lastUpdated: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [timerType, mode, timeLeft, stopwatchTime, isActive, sessionsCompleted, activeTask]);

  const configs = {
    'focus': { label: 'Odaklanma', time: timerConfig.workTime * 60, icon: <Brain size={24} />, color: 'bg-primary' },
    'short-break': { label: 'Kısa Mola', time: timerConfig.shortBreak * 60, icon: <Coffee size={24} />, color: 'bg-green-500' },
    'long-break': { label: 'Uzun Mola', time: timerConfig.longBreak * 60, icon: <Coffee size={24} />, color: 'bg-blue-500' },
  };

  useEffect(() => {
    const handleStartTask = (e: any) => {
      setActiveTask(e.detail);
      setTimerType('pomodoro');
      setMode('focus');
      setTimeLeft(timerConfig.workTime * 60);
      setIsActive(true);
    };

    window.addEventListener('start-task', handleStartTask);
    return () => window.removeEventListener('start-task', handleStartTask);
  }, [timerConfig.workTime]);

  // Audio for completion
  const playSound = () => {
    if (!timerConfig.soundEnabled) return;
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(() => {});
    } catch (e) {
      console.error("Ses çalınamadı", e);
    }
  };

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        if (timerType === 'pomodoro') {
          setTimeLeft(prev => {
            if (prev <= 1) {
              handleComplete();
              return 0;
            }
            return prev - 1;
          });
        } else {
          setStopwatchTime(prev => prev + 1);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timerType]);

  const handleComplete = () => {
    setIsActive(false);
    playSound();
    
    if (timerType === 'pomodoro') {
      let nextMode: Mode = 'focus';
      if (mode === 'focus') {
        const newSessions = sessionsCompleted + 1;
        setSessionsCompleted(newSessions);
        if (newSessions % 4 === 0) nextMode = 'long-break';
        else nextMode = 'short-break';
      } else {
        nextMode = 'focus';
      }
      
      setMode(nextMode);
      
      // Auto start logic
      if (mode === 'focus' && timerConfig.autoStartBreaks) {
        setIsActive(true);
      } else if (mode !== 'focus' && timerConfig.autoStartWork) {
        setIsActive(true);
      }

      if (Notification.permission === 'granted') {
        new Notification('YKS Mentor AI', { body: 'Süre bitti!' });
      }
    }
  };

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (timerType === 'pomodoro') {
      setTimeLeft(configs[mode].time);
    }
  }, [mode, timerType, settings.pomodoro]);

  const toggle = () => setIsActive(!isActive);
  const reset = () => {
    setIsActive(false);
    if (timerType === 'pomodoro') {
      setTimeLeft(configs[mode].time);
    } else {
      setStopwatchTime(0);
    }
  };

  const displayTime = timerType === 'pomodoro' ? timeLeft : stopwatchTime;
  const minutes = Math.floor(displayTime / 60);
  const seconds = displayTime % 60;
  const hours = Math.floor(minutes / 60);
  const displayMinutes = minutes % 60;

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col items-center justify-start space-y-12 pb-20 pt-8">
      
      {/* Timer Type Switcher */}
      <div className="flex p-1.5 bg-secondary/50 rounded-2xl border border-border">
        <button
          onClick={() => { setTimerType('pomodoro'); setIsActive(false); }}
          className={cn(
            "px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2",
            timerType === 'pomodoro' ? "bg-card shadow-sm text-foreground ring-1 ring-border" : "text-foreground/40 hover:text-foreground/60"
          )}
        >
          <Clock size={16} /> Pomodoro
        </button>
        <button
          onClick={() => { setTimerType('stopwatch'); setIsActive(false); }}
          className={cn(
            "px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2",
            timerType === 'stopwatch' ? "bg-card shadow-sm text-foreground ring-1 ring-border" : "text-foreground/40 hover:text-foreground/60"
          )}
        >
          <StopwatchIcon size={16} /> Kronometre
        </button>
      </div>

      {timerType === 'pomodoro' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex p-1.5 bg-secondary/30 rounded-2xl border border-border/50"
        >
          {(Object.keys(configs) as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setIsActive(false); }}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                mode === m ? "bg-card shadow-sm text-primary" : "text-foreground/40 hover:text-foreground/60"
              )}
            >
              {configs[m].label}
            </button>
          ))}
        </motion.div>
      )}

      {/* Main Timer Display */}
      <div className="relative group">
         <motion.div 
           className="w-80 h-80 rounded-full border-8 border-secondary flex items-center justify-center relative bg-card shadow-2xl"
           animate={{ scale: isActive ? [1, 1.02, 1] : 1 }}
           transition={{ repeat: Infinity, duration: 4 }}
         >
            <div className="text-center space-y-2">
                <div className="text-7xl font-mono font-black tracking-tighter text-foreground">
                  {hours > 0 ? String(hours).padStart(2, '0') + ':' : ''}
                  {String(displayMinutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/40 flex items-center justify-center gap-2">
                  {timerType === 'pomodoro' ? (
                    <>{configs[mode].icon} {configs[mode].label}</>
                  ) : (
                    <><StopwatchIcon size={24} /> Kronometre</>
                  )}
                </div>
            </div>
            
            {/* Round progress indicator */}
            <svg className="absolute -inset-2 w-[calc(100%+1rem)] h-[calc(100%+1rem)] -rotate-90 pointer-events-none">
              <circle
                cx="50%" cy="50%" r="48%"
                fill="transparent"
                stroke={timerType === 'pomodoro' ? "var(--primary)" : "var(--foreground)"}
                strokeWidth="8"
                strokeDasharray="301.5"
                strokeDashoffset={timerType === 'pomodoro' 
                  ? 301.5 * (1 - timeLeft / configs[mode].time)
                  : isActive ? 301.5 * (1 - (stopwatchTime % 60) / 60) : 0
                }
                className="transition-all duration-1000"
              />
            </svg>
         </motion.div>
      </div>

      {activeTask && (
        <div className="card p-4 w-full max-w-md flex items-center gap-4 bg-primary/5 border-primary/20">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Brain size={20} />
          </div>
          <div className="flex-1">
             <p className="text-[10px] font-bold uppercase text-primary tracking-widest">Şu Anki Görev</p>
             <p className="font-bold text-sm">{activeTask.unitsToStudy} Soru/Sayfa Çalışması</p>
          </div>
          <button onClick={() => setActiveTask(null)} className="text-foreground/20 hover:text-foreground/60 p-2">
            <RotateCcw size={16} />
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-8">
        <button onClick={reset} className="p-4 rounded-2xl bg-secondary text-foreground/60 hover:text-foreground transition-colors outline-none shrink-0" title="Sıfırla">
          <RotateCcw size={24} />
        </button>
        
        <button 
          onClick={toggle}
          className={cn(
            "w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl transition-all active:scale-95 outline-none",
            isActive ? "bg-red-500 text-white shadow-red-500/30" : "bg-primary text-white shadow-primary/30"
          )}
        >
          {isActive ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-2" />}
        </button>

        {timerType === 'pomodoro' && (
          <button onClick={handleComplete} className="p-4 rounded-2xl bg-secondary text-foreground/60 hover:text-foreground transition-colors outline-none shrink-0" title="Atla">
            <SkipForward size={24} />
          </button>
        )}
      </div>

      {timerType === 'pomodoro' && (
        <div className="flex gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={cn(
              "w-3 h-3 rounded-full transition-all duration-500",
              sessionsCompleted >= i ? "bg-primary scale-125 shadow-lg shadow-primary/50" : "bg-secondary"
            )} />
          ))}
        </div>
      )}
    </div>
  );
}
