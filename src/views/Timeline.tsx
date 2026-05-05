import { useState, useEffect, useRef } from 'react';
import { StudySession, ExamBranch } from '../types.ts';
import { storage } from '../lib/storage.ts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  BookOpen,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils.ts';

export default function Timeline() {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const data = await storage.getStudySessions();
    setSessions(data);
  };

  // Timeline hours from 01:00 to 24:00 (or 0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Get start of the week for the selected date
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
  };

  const startOfWeek = getStartOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekDayLabels = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const weekDayShortLabels = ['P', 'P', 'S', 'Ç', 'P', 'C', 'C'];

  const navigateWeek = (direction: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + (direction * 7));
    setSelectedDate(next);
  };

  const getSessionStyle = (session: StudySession, day: Date) => {
    const sessionStart = new Date(session.startTime);
    const sessionEnd = new Date(session.endTime);
    
    // Check if session belongs to this day
    if (sessionStart.toDateString() !== day.toDateString()) return null;

    const startMinutes = sessionStart.getHours() * 60 + sessionStart.getMinutes();
    const endMinutes = sessionEnd.getHours() * 60 + sessionEnd.getMinutes();
    const duration = Math.max(5, (session.endTime - session.startTime) / (1000 * 60)); // min 5 mins for visibility

    // Row height is say 60px per hour (1px per minute)
    return {
      top: `${startMinutes}px`,
      height: `${duration}px`,
    };
  };

  const branchColors: Partial<Record<ExamBranch, string>> = {
    'TYT Matematik': 'bg-blue-500',
    'AYT Matematik': 'bg-blue-600',
    'TYT Türkçe': 'bg-red-500',
    'TYT Fen': 'bg-amber-500',
    'AYT Fen': 'bg-amber-600',
    'Geometri': 'bg-indigo-500',
    'TYT Sosyal': 'bg-emerald-500'
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col pt-4">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8 px-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight uppercase">Zaman Çizelgesi</h2>
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">
            {startOfWeek.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-secondary/50 p-1.5 rounded-2xl border border-border">
          <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-card rounded-xl transition-all">
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 text-xs font-black uppercase tracking-widest min-w-[200px] text-center">
            {startOfWeek.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} - {weekDays[6].toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
          </div>
          <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-card rounded-xl transition-all">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Week Day Header */}
      <div className="grid grid-cols-[60px_1fr] border-b border-border mb-2">
        <div className="flex items-center justify-center border-r border-border">
          <Clock size={16} className="text-foreground/20" />
        </div>
        <div className="grid grid-cols-7">
          {weekDays.map((day, idx) => (
            <div key={idx} className={cn(
              "flex flex-col items-center py-4 gap-1",
              day.toDateString() === new Date().toDateString() ? "bg-primary/5" : ""
            )}>
              <span className="text-[10px] font-black uppercase tracking-tighter text-foreground/40">
                {weekDayLabels[day.getDay()]}
              </span>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black",
                day.toDateString() === new Date().toDateString() ? "bg-primary text-white" : "text-foreground"
              )}>
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable Timeline Area */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-card/20 rounded-t-3xl border-t border-x border-border" ref={scrollRef}>
        <div className="grid grid-cols-[60px_1fr] relative min-h-[1440px]">
          
          {/* Time Labels */}
          <div className="border-r border-border bg-background/50 sticky left-0 z-10">
            {hours.map(hour => (
              <div key={hour} className="h-[60px] flex items-start justify-center pt-2 border-b border-border/20">
                <span className="text-[10px] font-bold text-foreground/30">{String(hour).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Grid Columns */}
          <div className="grid grid-cols-7 relative">
            {weekDays.map((_, dayIdx) => (
              <div key={dayIdx} className={cn(
                "relative border-r border-border/10",
                dayIdx === 6 ? "border-r-0" : ""
              )}>
                {/* Horizontal grid lines */}
                {hours.map(hour => (
                  <div key={hour} className="h-[60px] border-b border-border/5" />
                ))}

                {/* Sessions in this column */}
                {sessions.map(session => {
                  const style = getSessionStyle(session, weekDays[dayIdx]);
                  if (!style) return null;

                  return (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "absolute left-1 right-1 rounded-lg border border-white/10 shadow-sm p-1.5 overflow-hidden transition-all hover:z-20 hover:scale-[1.02]",
                        session.branch ? branchColors[session.branch] || 'bg-primary' : 'bg-secondary'
                      )}
                      style={style}
                    >
                      <div className="h-full flex flex-col justify-start">
                         <p className="text-[9px] font-black uppercase tracking-tighter text-white truncate leading-none mb-0.5">
                           {session.taskTitle || session.branch || 'Genel'}
                         </p>
                         <p className="text-[8px] font-medium text-white/80 leading-none">
                           {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))}

            {/* Current Time Indicator */}
            {selectedDate.getMonth() === new Date().getMonth() && selectedDate.getFullYear() === new Date().getFullYear() && (
              <div 
                className="absolute left-0 right-0 border-t-2 border-red-500 z-30 pointer-events-none flex items-center"
                style={{ top: `${new Date().getHours() * 60 + new Date().getMinutes()}px` }}
              >
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Legend */}
      <div className="p-4 bg-background border-t border-border flex flex-wrap gap-4 items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Genel</span>
        </div>
        {Object.entries(branchColors).slice(0, 5).map(([branch, color]) => (
          <div key={branch} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", color)} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">{branch}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
