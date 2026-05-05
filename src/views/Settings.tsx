import { useState, useEffect } from 'react';
import { AppSettings, UserRoutine, ApiUsage } from '../types.ts';
import { storage } from '../lib/storage.ts';
import { Save, Trash2, Download, Upload, Key, Palette, Calendar, Clock, Plus, Timer, Info, Activity, HelpCircle, X, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils.ts';

const THEMES: Array<{id: any, name: string, colors: string[]}> = [
  { id: 'light', name: 'Açık', colors: ['#ffffff', '#3b82f6'] },
  { id: 'dark', name: 'Koyu', colors: ['#020617', '#3b82f6'] },
  { id: 'blue', name: 'Gök Mavi', colors: ['#f0f9ff', '#0284c7'] },
  { id: 'red', name: 'Mercan', colors: ['#fff1f2', '#e11d48'] },
  { id: 'oled', name: 'OLED Siyah', colors: ['#000000', '#ffffff'] },
];

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export default function Settings({ settings, routines, books, onRefresh }: { settings: AppSettings, routines: UserRoutine[], books: any[], onRefresh: () => void }) {
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [aiModel, setAiModel] = useState(settings.aiModel || 'gemini-1.5-flash');
  const [aiInstructions, setAiInstructions] = useState(settings.aiInstructions || '');
  const [personalBio, setPersonalBio] = useState(settings.personalBio || '');
  const [adaptiveStudyPlan, setAdaptiveStudyPlan] = useState(settings.adaptiveStudyPlan || {
    isEnabled: false,
    maxDailyHours: 12,
    weeklyIncrementMinutes: 15,
    daysToApply: [1, 2, 3, 4, 5],
    startDate: new Date().toISOString().split('T')[0]
  });
  const [targetNets, setTargetNets] = useState(settings.targetNets || { tyt: 0, ayt: 0 });
  const [yksDate, setYksDate] = useState(settings.yksDate);
  const [studyStartDate, setStudyStartDate] = useState(settings.studyStartDate || '');
  const [dailyMinutes, setDailyMinutes] = useState(settings.dailyStudyMinutes);
  const [maxDailyBooks, setMaxDailyBooks] = useState(settings.maxDailyBooks || 3);
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    storage.getUsage().then(setUsage);
  }, []);

  // Routine Form
  const [newRoutineDays, setNewRoutineDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newRoutineTime, setNewRoutineTime] = useState('08:00');
  const [newRoutineDuration, setNewRoutineDuration] = useState(60);
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [newRoutineDescription, setNewRoutineDescription] = useState('');
  const [selectedRoutineBookIds, setSelectedRoutineBookIds] = useState<string[]>([]);

  const addRoutine = async () => {
    if (!newRoutineTitle || newRoutineDays.length === 0) return;
    const newRoutine: UserRoutine = {
      id: crypto.randomUUID(),
      days: [...newRoutineDays],
      startTime: newRoutineTime,
      durationMinutes: newRoutineDuration,
      title: newRoutineTitle,
      description: newRoutineDescription,
      selectedBookIds: selectedRoutineBookIds
    };
    await storage.saveRoutines([...routines, newRoutine]);
    setNewRoutineTitle('');
    setNewRoutineDescription('');
    setSelectedRoutineBookIds([]);
    onRefresh();
  };

  const deleteRoutine = async (index: number) => {
    const updated = routines.filter((_, i) => i !== index);
    await storage.saveRoutines(updated);
    onRefresh();
  };

  const handleSave = async () => {
    const updated = { ...settings, apiKey, aiModel, aiInstructions, personalBio, adaptiveStudyPlan, yksDate, studyStartDate, dailyStudyMinutes: dailyMinutes, maxDailyBooks, targetNets };
    await storage.saveSettings(updated);
    onRefresh();
    alert('Ayarlar kaydedildi.');
  };

  const handleThemeChange = async (theme: any) => {
    const updated = { ...settings, theme };
    await storage.saveSettings(updated);
    document.documentElement.setAttribute('data-theme', theme);
    onRefresh();
  };

  const exportData = async () => {
    const data = {
      books: await storage.getBooks(),
      trials: await storage.getTrials(),
      tasks: await storage.getTasks(),
      settings: await storage.getSettings(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yks_mentor_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.books) await storage.saveBooks(data.books);
        if (data.trials) await storage.saveTrials(data.trials);
        if (data.tasks) await storage.saveTasks(data.tasks);
        if (data.settings) await storage.saveSettings(data.settings);
        onRefresh();
        alert('Veriler başarıyla içe aktarıldı.');
      } catch (err) {
        alert('Geçersiz dosya formatı.');
      }
    };
    reader.readAsText(file);
  };

  const clearAllData = async () => {
    if (confirm('TÜM VERİLERİ SİLMEK İSTEDİĞİNİZE EMİN MİSİNİZ? Bu işlem geri alınamaz.')) {
      localStorage.clear();
      // indexedDB side:
      await storage.saveBooks([]);
      await storage.saveTrials([]);
      await storage.saveTasks([]);
      onRefresh();
      window.location.reload();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-10">
      <header>
        <h2 className="text-3xl font-bold">Ayarlar</h2>
        <p className="text-foreground/60">Uygulama deneyimini özelleştirmek için bu bölümü kullanabilirsin.</p>
      </header>

      <AnimatePresence>
        {showModelInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl p-8 space-y-6 relative"
            >
              <button 
                onClick={() => setShowModelInfo(false)}
                className="absolute top-6 right-6 p-2 hover:bg-secondary rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Activity className="text-primary" /> Model Detayları
                </h3>
                <p className="text-sm text-foreground/60">İhtiyacına uygun modeli seçerek en iyi verimi alabilirsin.</p>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">Gemini 1.5 Flash</span>
                    <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded uppercase">Tavsiye Edilen (Hızlı & Güncel)</span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/70">
                    En güncel stabil sürüm. Çok hızlı yanıt süresi ve yüksek kapasite ile günlük planlamalar için idealdir.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/50 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Gemini 1.5 Pro</span>
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded uppercase">Gelişmiş Zeka</span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/70">
                    Karmaşık mantık yürütme ve detaylı akademik analizler için en iyi tercihtir.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/30 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Deneysel Modeller</span>
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] font-bold rounded uppercase">Beta</span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/70">
                    Gemini 2.0 ve 3 Preview gibi yeni nesil mimarileri test etmek isteyenler içindir.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                <Info size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-amber-600/80 leading-normal italic">
                  Not: Tüm modeller Google AI Studio üzerinden "Pay-as-you-go" planına geçilmediği sürece belirtilen kotalar dâhilinde ücretsizdir.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="card p-8 space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Palette className="text-primary" size={24} /> Görünüm & Tema
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleThemeChange(t.id)}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                settings.theme === t.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/20"
              )}
            >
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: t.colors[0] }} />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.colors[1] }} />
              </div>
              <span className="text-xs font-bold">{t.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card p-8 space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Key className="text-primary" size={24} /> Yapay Zeka (Kendi Modelin)
        </h3>
        <div className="space-y-4">
          <p className="text-sm text-foreground/60">
            Program oluşturma ve mentörlük özellikleri için Google AI Studio'dan alacağın API Key'i buraya girmelisin. 
            Hangi modeli kullanmak istediğini de seçebilirsin (Flash modelleri daha hızlı ve ücretsiz kotalıdır).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">API Key</label>
              <div className="relative">
                <input 
                  type={showApiKey ? "text" : "password"}
                  placeholder="Gemini API Key..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-foreground/40 hover:text-primary transition-colors focus:outline-none"
                  title={showApiKey ? "Gizle" : "Göster"}
                >
                  {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Yapay Zeka Modeli</label>
                <button 
                  onClick={() => setShowModelInfo(true)}
                  className="text-primary hover:text-primary/70 transition-colors"
                  title="Modeller hakkında bilgi al"
                >
                  <HelpCircle size={14} />
                </button>
              </div>
              <select 
                value={aiModel}
                onChange={e => setAiModel(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary h-[46px]"
              >
                <option value="gemini-3-flash-preview">Gemini 3 Flash (En Yeni & En Hızlı - Tavsiye Edilen)</option>
                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (En Zeki & Detaylı Analiz İçin)</option>
                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Hızlı & Deneysel)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 text-primary">Yapay Zeka Kişiliği & Özel Talimatlar</label>
              <div className="px-2 py-0.5 bg-primary/10 rounded text-[9px] font-black text-primary uppercase tracking-tighter">İleri Düzey</div>
            </div>
            <textarea 
              value={aiInstructions}
              onChange={e => setAiInstructions(e.target.value)}
              placeholder="Örn: Sert bir üslup kullan, hatalarımı yüzüme vur, beni sürekli daha fazlasına zorla..."
              className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary min-h-[140px] text-sm leading-relaxed"
            />
            <p className="text-[10px] text-foreground/40 font-medium leading-relaxed italic">
              Bu talimatlar yapay zekanın "sesini" ve "tavrını" belirler. Program hazırlarken veya chatte konuşurken bu direktiflere sadık kalır.
            </p>
          </div>

          <button 
            onClick={handleSave}
            className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            Değişiklikleri Kaydet
          </button>
        </div>
      </section>

      {settings.apiKey && (
        <section className="card p-8 space-y-6 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2 text-primary">
              <Activity size={24} /> API Kullanım Kotası
            </h3>
            <div className="px-3 py-1 bg-primary/10 rounded-full text-[10px] font-bold text-primary uppercase tracking-widest">
              Ücretsiz Tier
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Günlük İstek (Tahmini Limit: 1500)</span>
                  <span>{usage?.requestsToday || 0} / 1500</span>
                </div>
                <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ((usage?.requestsToday || 0) / 1500) * 100)}%` }}
                    className={cn(
                      "h-full transition-all",
                      (usage?.requestsToday || 0) > 1200 ? "bg-red-500" : (usage?.requestsToday || 0) > 800 ? "bg-amber-500" : "bg-primary"
                    )}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold mt-1 text-foreground/40 italic">
                  <span>Limitler her gün 00:00'da sıfırlanır.</span>
                  <span className={cn((usage?.requestsToday || 0) >= 1500 ? "text-red-500" : "")}>
                    Sıfırlanmaya: {(() => {
                      const now = new Date();
                      const nextReset = new Date();
                      nextReset.setHours(24, 0, 0, 0);
                      const diff = nextReset.getTime() - now.getTime();
                      const hours = Math.floor(diff / (1000 * 60 * 60));
                      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                      return `${hours}s ${minutes}dk`;
                    })()}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-card border border-border rounded-xl">
                <Info size={18} className="text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium leading-relaxed">
                    Gemini 1.5 Flash (Free Tier) dakikada 15 istek sınırı uygular. Üst üste hızlı işlem yapılması durumunda "RESOURCE_EXHAUSTED" hatası alabilirsiniz.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-card border border-border rounded-xl space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Aktif Model</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-primary text-primary-foreground rounded text-[10px] font-mono uppercase font-bold shadow-sm">
                    {settings.aiModel || 'gemini-1.5-flash'}
                  </span>
                </div>
                <p className="text-[10px] text-foreground/40 italic">Bu model üzerinden istekler gönderilmektedir.</p>
              </div>
              <a 
                href="https://aistudio.google.com/app/billing" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-2 p-3 bg-secondary hover:bg-secondary/80 rounded-xl text-xs font-bold transition-all"
              >
                Google AI Studio Konsolu
              </a>
            </div>
          </div>
        </section>
      )}

      <section className="card p-8 space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Clock className="text-primary" size={24} /> Kişisel Rutinler
        </h3>
        <p className="text-sm text-foreground/60">Günlük sabit rutinlerini (dershane, spor, uyku vb.) ekleyerek AI'ın daha gerçekçi plan yapmasını sağla.</p>
        
        <div className="space-y-6 p-6 bg-secondary/20 rounded-3xl border border-border/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Rutin Adı</label>
                <input 
                  type="text"
                  placeholder="Örn: Dershane, Basketbol Antrenmanı"
                  value={newRoutineTitle}
                  onChange={e => setNewRoutineTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Yapay Zeka İçin Açıklama</label>
                <textarea 
                  placeholder="Örn: Bu sürede sadece soru çözebilirim, konu anlatımı istemiyorum."
                  value={newRoutineDescription}
                  onChange={e => setNewRoutineDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary h-20 resize-none text-sm"
                />
              </div>
            </div>

            <div className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Başlangıç Saati</label>
                   <input 
                     type="time"
                     value={newRoutineTime}
                     onChange={e => setNewRoutineTime(e.target.value)}
                     className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Süre (Dakika)</label>
                   <input 
                     type="number"
                     value={newRoutineDuration}
                     onChange={e => setNewRoutineDuration(parseInt(e.target.value) || 0)}
                     className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary"
                   />
                 </div>
               </div>
               <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 text-center block mb-2">Uygulanacak Günler</label>
                <div className="flex justify-between gap-1">
                  {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map((day, i) => {
                    const dayIdx = i === 6 ? 0 : i + 1;
                    const isActive = newRoutineDays.includes(dayIdx);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const newDays = isActive 
                            ? newRoutineDays.filter(d => d !== dayIdx)
                            : [...newRoutineDays, dayIdx];
                          setNewRoutineDays(newDays);
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-[10px] font-black border transition-all duration-200 cursor-pointer select-none",
                          isActive 
                            ? "bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20"
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Bu Rutinde Kullanılacak Kitaplar (Opsiyonel)</label>
            <div className="flex flex-wrap gap-2">
              {books.map(book => {
                const isSelected = selectedRoutineBookIds.includes(book.id);
                return (
                  <button
                    key={book.id}
                    onClick={() => {
                      setSelectedRoutineBookIds(prev => 
                        prev.includes(book.id) ? prev.filter(id => id !== book.id) : [...prev, book.id]
                      );
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
                      isSelected 
                        ? "bg-primary/20 text-primary border-primary" 
                        : "bg-secondary text-foreground/60 border-transparent hover:border-border"
                    )}
                  >
                    {book.title}
                  </button>
                );
              })}
              {books.length === 0 && <p className="text-[10px] text-foreground/30 italic">Henüz kitap eklenmemiş.</p>}
            </div>
          </div>

          <button 
            onClick={addRoutine}
            className="w-full p-4 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all"
          >
            <Plus size={20} strokeWidth={3} /> Rutini Listeye Ekle
          </button>
        </div>

        <div className="space-y-3 mt-8">
          {routines.sort((a,b) => {
            const firstDayA = a.days[0] ?? 0;
            const firstDayB = b.days[0] ?? 0;
            return firstDayA - firstDayB || a.startTime.localeCompare(b.startTime);
          }).map((r, i) => (
            <div key={r.id || i} className="group flex items-center justify-between p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Timer size={24} strokeWidth={2.5} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-base">{r.title}</p>
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-bold text-foreground/60">{r.durationMinutes} dk</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest flex items-center gap-1">
                      <Clock size={10} /> {r.startTime}
                    </p>
                    <span className="text-foreground/20 text-[10px]">•</span>
                    <div className="flex gap-1">
                      {r.days.map(d => (
                        <span key={d} className="text-[9px] font-black text-primary uppercase">
                          {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'][d === 0 ? 6 : d - 1]}
                        </span>
                      ))}
                    </div>
                  </div>
                  {r.description && <p className="text-xs text-foreground/50 italic line-clamp-1">{r.description}</p>}
                </div>
              </div>
              <button 
                onClick={() => deleteRoutine(i)}
                className="p-2 text-foreground/20 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
          {routines.length === 0 && (
            <div className="text-center py-16 px-10 border-2 border-dashed border-border rounded-3xl text-foreground/30 italic text-sm">
              <div className="mb-2 flex justify-center"><Info size={24} opacity={0.3} /></div>
              Henüz bir rutin eklenmemiş. AI bu zamanlarda ders çalışma planlamaz.
            </div>
          )}
        </div>
      </section>

      <section className="card p-8 space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="text-primary" size={24} /> Sınav Hedefleri
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground/40">TYT Net Hedefi</label>
              <input 
                type="number"
                value={targetNets.tyt}
                onChange={e => setTargetNets({ ...targetNets, tyt: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground/40">AYT Net Hedefi</label>
              <input 
                type="number"
                value={targetNets.ayt}
                onChange={e => setTargetNets({ ...targetNets, ayt: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground/40">YKS Çalışmaya Başlama Tarihi</label>
              <input 
                type="date"
                value={studyStartDate}
                onChange={e => setStudyStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground/40">YKS Sınav Tarihi</label>
              <input 
                type="date"
                value={yksDate}
                onChange={e => setYksDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none"
              />
            </div>
          </div>
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground/40">Günlük Maks. Kitap Sayısı</label>
            <div className="flex items-center gap-4">
              <input 
                type="range"
                min="1"
                max="10"
                value={maxDailyBooks}
                onChange={e => setMaxDailyBooks(parseInt(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="w-12 h-12 flex items-center justify-center bg-primary/10 text-primary rounded-xl font-bold">
                {maxDailyBooks}
              </span>
            </div>
            <p className="text-[10px] text-foreground/40 italic">Yapay zeka bir güne en fazla bu kadar farklı kitaptan görev atayacaktır.</p>
          </div>
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground/40">Günlük Hedef Çalışma Süreleri</label>
            <div className="grid grid-cols-7 gap-2">
              {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map((day, i) => (
                <div key={day} className="space-y-2 text-center">
                  <span className="text-[10px] font-bold">{day}</span>
                  <input 
                    type="number"
                    value={dailyMinutes[i === 6 ? 0 : i + 1] || 0}
                    onChange={e => setDailyMinutes({ ...dailyMinutes, [i === 6 ? 0 : i + 1]: parseInt(e.target.value) || 0 })}
                    className="w-full px-1 py-2 text-center text-xs rounded-lg border border-border bg-background outline-none"
                    placeholder="dk"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <button 
          onClick={handleSave}
          className="w-full px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-xl font-bold text-sm transition-all"
        >
          Sınav Hedeflerini Kaydet
        </button>
      </section>

      <section className="card p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Timer className="text-primary" size={24} /> Kademeli Süre Artışı
          </h3>
          <button 
            onClick={() => setAdaptiveStudyPlan({ ...adaptiveStudyPlan, isEnabled: !adaptiveStudyPlan.isEnabled })}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              adaptiveStudyPlan.isEnabled ? "bg-primary" : "bg-secondary"
            )}
          >
            <span className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              adaptiveStudyPlan.isEnabled ? "translate-x-6" : "translate-x-1"
            )} />
          </button>
        </div>
        <p className="text-sm text-foreground/60">
          Bu özellik açık olduğunda, seçtiğin günlerde çalışma süren her hafta belirttiğin miktar kadar otomatik olarak artırılarak maksimum hedefine ulaşman sağlanır.
        </p>
        
        {adaptiveStudyPlan.isEnabled && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-6 pt-4 border-t border-border"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground/40 text-center block">Uygulanacak Günler</label>
                <div className="flex justify-between gap-1">
                  {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map((day, i) => {
                    const dayIdx = i === 6 ? 0 : i + 1;
                    const isActive = (adaptiveStudyPlan.daysToApply || []).includes(dayIdx);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const currentDays = adaptiveStudyPlan.daysToApply || [];
                          const newDays = isActive 
                            ? currentDays.filter(d => d !== dayIdx)
                            : [...currentDays, dayIdx];
                          setAdaptiveStudyPlan({ ...adaptiveStudyPlan, daysToApply: newDays });
                        }}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-[10px] font-black border transition-all duration-200 cursor-pointer select-none active:scale-95",
                          isActive 
                            ? "bg-emerald-500 text-white border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-105 z-10" 
                            : "bg-rose-500 text-white border-rose-600 hover:bg-rose-600"
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Hedef Maks. Saat</label>
                  <input 
                    type="number"
                    value={adaptiveStudyPlan.maxDailyHours || 0}
                    onChange={e => setAdaptiveStudyPlan({ ...adaptiveStudyPlan, maxDailyHours: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 rounded-xl border border-border bg-background text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Haftalık Artış (dk)</label>
                  <input 
                    type="number"
                    value={adaptiveStudyPlan.weeklyIncrementMinutes || 0}
                    onChange={e => setAdaptiveStudyPlan({ ...adaptiveStudyPlan, weeklyIncrementMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 rounded-xl border border-border bg-background text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
              <Info size={14} className="text-primary" />
              <p className="text-[10px] font-medium">Bu plan {new Date(adaptiveStudyPlan.startDate || '').toLocaleDateString('tr-TR')} tarihinde başladı.</p>
            </div>
            <button 
              onClick={handleSave}
              className="w-full px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-xl font-bold text-sm transition-all"
            >
              Planı Güncelle
            </button>
          </motion.div>
        )}
      </section>

      <section className="card p-8 space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <HelpCircle className="text-primary" size={24} /> Kişisel Bilgiler & Hedefler
        </h3>
        <p className="text-sm text-foreground/60">
          Kendin hakkında ne kadar çok bilgi verirsen (hedefler, hobiler, varsa psikolojik/fiziksel rahatsızlıklar), AI mentörün seni o kadar iyi tanır ve planlarını ona göre optimize eder.
        </p>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Öğrenci Profili</label>
          <textarea 
            placeholder="Örn: Sayısal öğrencisiyim, hedefim ilk 10k. Gece çalışmayı severim ama sabahları odaklanmakta zorlanıyorum. Hafif bir bel fıtığım var bu yüzden uzun süre hareketsiz oturamıyorum..."
            value={personalBio}
            onChange={e => setPersonalBio(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary h-32 resize-none text-sm transition-all"
          />
          <p className="text-[10px] text-foreground/40 italic">Not: Bu bilgiler sadece Gemini API'ye gönderilerek sana özel tavsiyeler üretmek için kullanılır.</p>
        </div>
        <button 
          onClick={handleSave}
          className="w-full px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-xl font-bold text-sm transition-all"
        >
          Profili Güncelle
        </button>
      </section>

      <section className="card p-8 space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Download className="text-primary" size={24} /> Veri Yönetimi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button 
            onClick={exportData}
            className="flex items-center justify-center gap-2 p-4 border border-border rounded-2xl hover:bg-secondary transition-colors font-bold text-sm"
          >
            <Download size={18} /> Verileri Yedekle
          </button>
          <label className="flex items-center justify-center gap-2 p-4 border border-border rounded-2xl hover:bg-secondary transition-colors font-bold text-sm cursor-pointer">
            <Upload size={18} /> Verileri Geri Yükle
            <input type="file" className="hidden" accept=".json" onChange={importData} />
          </label>
          <button 
            onClick={clearAllData}
            className="flex items-center justify-center gap-2 p-4 border border-red-500/20 text-red-500 rounded-2xl hover:bg-red-500/10 transition-colors font-bold text-sm"
          >
            <Trash2 size={18} /> Tüm Verileri Sil
          </button>
        </div>
      </section>
    </div>
  );
}
