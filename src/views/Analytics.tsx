import { useState, useMemo, useEffect } from 'react';
import { Trial, AppSettings, ExamBranch, Task } from '../types.ts';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  BarChart as BarChartIcon, 
  TrendingUp, 
  Clock, 
  Target, 
  ChevronRight,
  Filter,
  Info,
  Calendar
} from 'lucide-react';
import { cn } from '../lib/utils.ts';
import { motion, AnimatePresence } from 'motion/react';

const BRANCHES: ExamBranch[] = [
  "TYT Matematik", "TYT Türkçe", "TYT Fen", "TYT Sosyal", "TYT GENEL",
  "AYT Matematik", "AYT Fen", "AYT Fizik", "AYT Kimya", "AYT Biyoloji", "AYT Edebiyat-Sosyal", "AYT Sosyal-2", "AYT GENEL", "Geometri"
];

export default function Analytics({ trials, tasks, settings }: { trials: Trial[], tasks: Task[], settings: AppSettings }) {
  const [activeBranch, setActiveBranch] = useState<ExamBranch | 'GENEL'>('TYT GENEL');
  const [viewMode, setViewMode] = useState<'net' | 'duration'>('net');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Study Time Calculation
  const studyTimeData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split('T')[0];
    });

    return last30Days.map(date => {
      const dayTasks = tasks.filter(t => t.date === date);
      const minutes = dayTasks.reduce((acc, t) => acc + (t.actualMinutes || 0), 0);
      return {
        date: new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        minutes,
        fullDate: date
      };
    });
  }, [tasks]);

  // Filtered data for the main chart
  const filteredData = useMemo(() => {
    let baseTrials = trials;

    if (activeBranch === 'GENEL') {
      baseTrials = trials.filter(t => t.type !== 'Branş');
    } else if (activeBranch === 'TYT GENEL') {
      baseTrials = trials.filter(t => t.type === 'TYT');
    } else if (activeBranch === 'AYT GENEL') {
      baseTrials = trials.filter(t => t.type === 'AYT');
    } else {
      baseTrials = trials.filter(t => t.type === 'Branş' && t.branch === activeBranch);
    }

    return baseTrials
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(t => ({
        date: new Date(t.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        net: t.net,
        duration: t.durationMinutes || 0,
        title: t.title,
        fullDate: t.date
      }));
  }, [trials, activeBranch]);

  // Trigger re-render of charts on mount or branch change
  const chartKey = useMemo(() => `${activeBranch}-${viewMode}-${filteredData.length}`, [activeBranch, viewMode, filteredData.length]);

  // Radar Chart Data Calculation (Last 3 trials)
  const radarData = useMemo(() => {
    if (activeBranch !== 'TYT GENEL' && activeBranch !== 'AYT GENEL') return null;
    
    const type = activeBranch === 'TYT GENEL' ? 'TYT' : 'AYT';
    const last3Trials = trials
      .filter(t => t.type === type && t.subjects && t.subjects.length > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);

    if (last3Trials.length === 0) return null;

    const subjectTotals: Record<string, { net: number, count: number, totalQuestions: number }> = {};

    last3Trials.forEach(trial => {
      trial.subjects?.forEach(s => {
        if (!subjectTotals[s.name]) {
          let totalQuestions = 40;
          if (activeBranch === 'TYT GENEL') {
            if (s.name === 'Türkçe' || s.name === 'Temel Matematik') totalQuestions = 40;
            else if (s.name === 'Sosyal Bilimler' || s.name === 'Fen Bilimleri') totalQuestions = 20;
          } else if (activeBranch === 'AYT GENEL') {
            if (s.name === 'Matematik' || s.name === 'Türk Dili ve Ed. - Sosyal 1' || s.name === 'Sosyal Bilimler-2') totalQuestions = 40;
            else if (s.name === 'Fizik') totalQuestions = 14;
            else if (s.name === 'Kimya' || s.name === 'Biyoloji') totalQuestions = 13;
          }
          subjectTotals[s.name] = { net: 0, count: 0, totalQuestions: s.totalQuestions || totalQuestions };
        }
        subjectTotals[s.name].net += (s.correct - (s.wrong * 0.25));
        subjectTotals[s.name].count += 1;
      });
    });

    return Object.entries(subjectTotals)
      .filter(([_, data]) => data.totalQuestions > 0 && data.count > 0)
      .map(([name, data]) => ({
        subject: name,
        // Calculate success percentage: (Total Net / (Total Trials * Total Questions)) * 100
        percent: Math.round(((data.net / (data.count * data.totalQuestions)) * 100) * 10) / 10,
        fullMark: 100
      }))
      .filter(item => {
        // Find if this subject actually had any participation in the trials
        // We only want to show subjects that the user actually filled
        const hasActivity = last3Trials.some(trial => 
          trial.subjects?.some(s => s.name === item.subject && (s.correct + s.wrong + s.empty > 0))
        );
        return hasActivity;
      });
  }, [trials, activeBranch]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const nets = filteredData.map(t => t.net);
    const durations = filteredData.map(t => t.duration).filter(d => d > 0);
    
    return {
      avgNet: nets.reduce((a, b) => a + b, 0) / nets.length,
      maxNet: Math.max(...nets),
      avgDur: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      totalCount: filteredData.length
    };
  }, [filteredData]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <BarChartIcon className="text-primary" size={32} /> Analiz Merkezi
          </h2>
          <p className="text-foreground/60">Gelişimini ve çalışma sürekliliğini buradan takip et.</p>
        </div>
      </div>

      {/* Daily Study Time Section */}
      <div className="card p-8 space-y-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
        <div className="flex justify-between items-center">
           <h3 className="text-xl font-bold flex items-center gap-2">
             <Calendar className="text-primary" size={24} /> Çalışma Sürekliliği (Son 30 Gün)
           </h3>
           <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-full">
              <Clock size={14} className="text-primary" />
              <span className="text-xs font-black text-primary">Toplam: {studyTimeData.reduce((a, b) => a + b.minutes, 0)} dk</span>
           </div>
        </div>

        <div className="h-[250px] w-full bg-card/50 rounded-2xl p-4 border border-border/50">
           {isMounted ? (
             <ResponsiveContainer key={`continuity-${studyTimeData.length}`} width="100%" height="100%" minHeight={200}>
               <LineChart data={studyTimeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                 <XAxis 
                   dataKey="date" 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                   dy={10}
                 />
                 <YAxis 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                 />
                 <Tooltip 
                   contentStyle={{ 
                     backgroundColor: '#fff', 
                     border: '1px solid #e5e7eb',
                     borderRadius: '16px',
                     fontWeight: '700',
                     fontSize: '12px',
                     color: '#1f2937'
                   }}
                 />
                 <Line 
                   type="monotone" 
                   dataKey="minutes" 
                   stroke="#3b82f6" 
                   strokeWidth={3} 
                   dot={{ fill: '#3b82f6', r: 4, strokeWidth: 0 }}
                   activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                   animationDuration={1000}
                 />
               </LineChart>
             </ResponsiveContainer>
           ) : (
             <div className="h-full flex items-center justify-center">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
             </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar / Branch List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-4 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground/40 mb-4 flex items-center gap-2">
              <Filter size={14} /> Deneme Seçimi
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setActiveBranch('TYT GENEL')}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl text-sm font-bold transition-all",
                  activeBranch === 'TYT GENEL' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-secondary text-foreground/60 hover:bg-secondary/80"
                )}
              >
                <span>TYT Genel</span>
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setActiveBranch('AYT GENEL')}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl text-sm font-bold transition-all",
                  activeBranch === 'AYT GENEL' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-secondary text-foreground/60 hover:bg-secondary/80"
                )}
              >
                <span>AYT Genel</span>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {BRANCHES.filter(b => b !== 'TYT GENEL' && b !== 'AYT GENEL').map(branch => {
                const hasData = trials.some(t => t.type === 'Branş' && t.branch === branch);
                
                return (
                  <button
                    key={branch}
                    onClick={() => setActiveBranch(branch)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all",
                      activeBranch === branch 
                        ? "bg-primary/20 text-primary border border-primary/20 shadow-sm" 
                        : "hover:bg-secondary text-foreground/60",
                      !hasData && "opacity-40"
                    )}
                  >
                    <span className="truncate">{branch}</span>
                    {hasData && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="card p-6 bg-primary/5 border-primary/10">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/20 rounded-lg">
                   <TrendingUp className="text-primary" size={20} />
                </div>
                <h4 className="font-bold text-sm tracking-tight">Kısa Özet</h4>
             </div>
             {stats ? (
               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-foreground/40 uppercase">Veri Noktası</span>
                    <span className="text-sm font-black">{stats.totalCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-foreground/40 uppercase">Ortalama Net</span>
                    <span className="text-sm font-black text-primary">{stats.avgNet.toFixed(1)}</span>
                  </div>
                  {stats.avgDur > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-foreground/40 uppercase">Emeğin (Ort.)</span>
                      <span className="text-sm font-black">{Math.round(stats.avgDur)} dk</span>
                    </div>
                  )}
               </div>
             ) : (
               <p className="text-xs text-foreground/40 font-medium">Bu branş için henüz veri girişi yapılmamış.</p>
             )}
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className={cn("card p-8 min-h-[500px] flex flex-col transition-all", radarData ? "xl:col-span-2" : "xl:col-span-3")}>
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <h3 className="text-2xl font-black text-primary">{activeBranch} İlerlemesi</h3>
                  <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mt-1">
                    Son {filteredData.length} veri girişi
                  </p>
                </div>

                <div className="flex p-1 bg-secondary rounded-2xl border border-border shadow-inner self-start md:self-center">
                  <button
                    onClick={() => setViewMode('net')}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                      viewMode === 'net' ? "bg-card text-primary shadow-sm" : "text-foreground/40 hover:text-foreground"
                    )}
                  >
                    <Target size={14} /> Netler
                  </button>
                  <button
                    onClick={() => setViewMode('duration')}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                      viewMode === 'duration' ? "bg-card text-primary shadow-sm" : "text-foreground/40 hover:text-foreground"
                    )}
                  >
                    <Clock size={14} /> Süreler
                  </button>
                </div>
              </div>

              <div className="flex-1 w-full bg-card/50 rounded-3xl p-6 border border-border/50 relative" style={{ minHeight: '400px' }} onClick={() => setViewMode(viewMode === 'net' ? 'duration' : 'net')}>
                {filteredData.length > 0 ? (
                  isMounted ? (
                    <ResponsiveContainer key={chartKey} width="100%" height="100%" minHeight={350}>
                      <AreaChart data={filteredData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorValueArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '16px',
                            fontWeight: '700',
                            fontSize: '12px',
                            color: '#1f2937'
                          }}
                          formatter={(value: any, name: any, props: any) => [value, name === 'net' ? 'Net' : 'Süre', props.payload.title]}
                        />
                        <Area 
                          type="monotone" 
                          dataKey={viewMode} 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorValueArea)" 
                          animationDuration={1000}
                          dot={{ fill: '#3b82f6', r: 4, strokeWidth: 0 }}
                          activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  )
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                     <Target size={60} strokeWidth={1} />
                     <h4 className="mt-4 font-bold text-lg">Yeterli Veri Yok</h4>
                     <p className="text-sm">Gelişimi görmek için deneme eklemeye başla.</p>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-foreground/30 uppercase tracking-widest">
                  <Info size={12} /> Grafiğe tıklayarak net/süre arasında geçiş yapabilirsin.
              </div>
            </div>

            {/* Radar Chart (Subject Breakdown) */}
            <AnimatePresence>
              {radarData && isMounted && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="card p-8 flex flex-col xl:col-span-1 border-emerald-500/10 bg-emerald-500/[0.02]"
                >
                  <div className="mb-6">
                    <h3 className="text-xl font-black text-emerald-600 flex items-center gap-2">
                       <Target size={20} /> Ders Bazlı Görünüm
                    </h3>
                    <p className="text-[10px] font-black text-emerald-600/40 uppercase tracking-widest mt-1">
                      Son 3 deneme ortalaması (Başarı %)
                    </p>
                  </div>

                  <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                        <PolarGrid stroke="#e5e7eb" />
                        <PolarAngleAxis 
                          dataKey="subject" 
                          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                        />
                        <PolarRadiusAxis 
                          angle={30} 
                          domain={[0, 100]} 
                          tick={false}
                          axisLine={false}
                        />
                        <Radar
                          name="Başarı %"
                          dataKey="percent"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="#10b981"
                          fillOpacity={0.4}
                          animationDuration={1500}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '16px',
                            fontWeight: '700',
                            fontSize: '12px'
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                    <p className="text-[10px] font-bold text-emerald-600/60 text-center uppercase tracking-wide">
                      Her ders kendi soru sayısına göre ağırlıklandırılmıştır.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Detailed Branch Map (Heatmap styled grid for stats) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="card p-6 flex flex-col justify-center items-center gap-2">
                <p className="text-[10px] font-black uppercase text-foreground/40 tracking-widest">En Yüksek Net</p>
                <p className="text-3xl font-black text-primary">{stats?.maxNet || 0}</p>
             </div>
             <div className="card p-6 flex flex-col justify-center items-center gap-2">
                <p className="text-[10px] font-black uppercase text-foreground/40 tracking-widest">Ortalama Süre</p>
                <p className="text-3xl font-black">{stats ? Math.round(stats.avgDur) : 0} <span className="text-sm opacity-40">dk</span></p>
             </div>
             <div className="card p-6 flex flex-col justify-center items-center gap-2">
                <p className="text-[10px] font-black uppercase text-foreground/40 tracking-widest">Deneme Sikliği</p>
                <p className="text-3xl font-black">%{Math.round((trials.length / 30) * 100)}</p>
             </div>
             <div className="card p-6 flex flex-col justify-center items-center gap-2">
                <p className="text-[10px] font-black uppercase text-foreground/40 tracking-widest">Hata Analizi</p>
                <p className="text-3xl font-black">{trials.filter(t => t.mistakes.length > 0).length}/{trials.length}</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
