import { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  LayoutGrid,
  Calendar, 
  BookOpen, 
  BarChart3, 
  Settings as SettingsIcon, 
  Timer, 
  MessageSquare,
  X,
  Menu,
  Rocket,
  ShieldCheck,
  ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { storage } from './lib/storage.ts';
import { Book, Trial, Task, AppSettings, AIWarning, UserRoutine, Camp } from './types.ts';
import { cn } from './lib/utils.ts';

// View Components
import Dashboard from './views/Dashboard.tsx';
import Program from './views/Program.tsx';
import Books from './views/Books.tsx';
import Trials from './views/Trials.tsx';
import Pomodoro from './views/Pomodoro.tsx';
import Chat from './views/Chat.tsx';
import Settings from './views/Settings.tsx';
import Camps from './views/Camps.tsx';
import Heatmap from './views/Heatmap.tsx';
import Analytics from './views/Analytics.tsx';
import AboutAI from './views/AboutAI.tsx';

type View = 'dashboard' | 'program' | 'books' | 'trials' | 'pomodoro' | 'chat' | 'settings' | 'camps' | 'heatmap' | 'analytics' | 'about-ai';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<UserRoutine[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [warnings, setWarnings] = useState<AIWarning[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [b, t, taskList, r, s, w, cp] = await Promise.all([
        storage.getBooks(),
        storage.getTrials(),
        storage.getTasks(),
        storage.getRoutines(),
        storage.getSettings(),
        storage.getWarnings(),
        storage.getCamps()
      ]);
      setBooks(b);
      setTrials(t);
      setTasks(taskList);
      setRoutines(r);
      setSettings(s);
      setWarnings(w);
      setCamps(cp);
      setIsLoading(false);
      
      // Apply theme
      document.documentElement.setAttribute('data-theme', s.theme);
    }
    loadData();

    const handleViewChange = (e: any) => {
      setActiveView(e.detail);
    };
    window.addEventListener('change-view', handleViewChange);
    return () => window.removeEventListener('change-view', handleViewChange);
  }, []);

  const refreshData = useCallback(async () => {
    const [b, t, taskList, r, s, w, cp] = await Promise.all([
      storage.getBooks(),
      storage.getTrials(),
      storage.getTasks(),
      storage.getRoutines(),
      storage.getSettings(),
      storage.getWarnings(),
      storage.getCamps()
    ]);
    setBooks(b);
    setTrials(t);
    setTasks(taskList);
    setRoutines(r);
    const updatedSettings = s || settings;
    if (updatedSettings) {
      setSettings(updatedSettings);
      document.documentElement.setAttribute('data-theme', updatedSettings.theme);
    }
    setWarnings(w);
    setCamps(cp);
  }, [settings]);

  if (isLoading || !settings) {
    return <div className="flex items-center justify-center h-screen bg-background text-foreground">Yükleniyor...</div>;
  }

  const navItems = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'program', label: 'Program', icon: Calendar },
    { id: 'analytics', label: 'Grafikler', icon: BarChart3 },
    { id: 'heatmap', label: 'Isı Haritası', icon: LayoutGrid }, 
    { id: 'camps', label: 'Kamplar', icon: Rocket },
    { id: 'books', label: 'Kitaplarım', icon: BookOpen },
    { id: 'trials', label: 'Denemeler', icon: ClipboardCheck },
    { id: 'pomodoro', label: 'Sayaç', icon: Timer },
    { id: 'chat', label: 'AI Mentör', icon: MessageSquare },
    { id: 'settings', label: 'Ayarlar', icon: SettingsIcon },
    { id: 'about-ai', label: 'YZ Hakkında', icon: ShieldCheck },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-4 right-4 z-[60] p-2.5 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-all"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-md z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-72 h-full border-r border-border bg-card flex flex-col z-50 fixed shadow-2xl"
          >
            <div className="p-6">
              <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
                <span className="min-w-[40px] px-2 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-mono text-sm shadow-lg shadow-primary/30">YKS</span>
                Mentor AI
              </h1>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id as View);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group text-sm font-bold relative overflow-hidden",
                    activeView === item.id 
                      ? "bg-primary text-primary-foreground shadow-xl shadow-primary/30" 
                      : "text-foreground/60 hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <item.icon size={20} className={cn(
                    "transition-all duration-300 z-10",
                    activeView === item.id ? "scale-110 rotate-12" : "group-hover:scale-110 group-hover:rotate-6"
                  )} />
                  <span className="z-10">{item.label}</span>
                  {activeView === item.id && (
                    <motion.div 
                      layoutId="active-nav"
                      className="absolute left-0 w-1 h-6 bg-white rounded-full z-20"
                    />
                  )}
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-border">
              <div className="p-4 rounded-xl bg-accent/50 border border-border">
                <p className="text-xs font-semibold text-accent-foreground uppercase tracking-wider mb-1">Kalan Süre</p>
                <div className="text-base font-bold text-foreground">
                  {Math.ceil((new Date(settings.yksDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} Gün
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={cn(
        "flex-1 h-full overflow-y-auto relative p-4 lg:p-8 pt-20 lg:pt-8 pb-32 lg:pb-16 custom-scrollbar transition-all duration-300",
        isSidebarOpen && "lg:pl-80"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto h-full"
          >
            {activeView === 'dashboard' && <Dashboard books={books} trials={trials} tasks={tasks} settings={settings} camps={camps} onRefresh={refreshData} onViewAnalytics={() => setActiveView('analytics')} />}
            {activeView === 'program' && <Program books={books} tasks={tasks} settings={settings} routines={routines} camps={camps} onRefresh={refreshData} />}
            {activeView === 'heatmap' && <Heatmap tasks={tasks} settings={settings} />}
            {activeView === 'analytics' && <Analytics trials={trials} tasks={tasks} settings={settings} />}
            {activeView === 'camps' && <Camps books={books} camps={camps} onRefresh={refreshData} />}
            {activeView === 'books' && <Books books={books} tasks={tasks} settings={settings} onRefresh={refreshData} />}
            {activeView === 'trials' && <Trials trials={trials} settings={settings} onRefresh={refreshData} />}
            {activeView === 'pomodoro' && <Pomodoro tasks={tasks} settings={settings} onRefresh={refreshData} />}
            {activeView === 'chat' && <Chat books={books} trials={trials} tasks={tasks} settings={settings} camps={camps} onRefresh={refreshData} />}
            {activeView === 'settings' && <Settings settings={settings} routines={routines} books={books} onRefresh={refreshData} />}
            {activeView === 'about-ai' && <AboutAI />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
