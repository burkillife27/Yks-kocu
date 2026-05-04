import React, { useState, useRef, useEffect, memo } from 'react';
import { Book, Trial, Task, AppSettings, Camp, ChatSession, ChatMessage } from '../types.ts';
import { GeminiService } from '../services/geminiService.ts';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Paperclip,
  Brain,
  RotateCcw,
  Plus,
  MessageSquare,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils.ts';
import { storage } from '../lib/storage.ts';

const MessageItem = memo(({ m }: { m: ChatMessage }) => {
  const date = new Date(m.timestamp);
  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex gap-4 max-w-[85%]",
        m.role === 'user' ? "ml-auto flex-row-reverse" : ""
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
        m.role === 'assistant' ? "bg-primary text-primary-foreground" : "bg-card border border-border"
      )}>
        {m.role === 'assistant' ? <Bot size={20} /> : <User size={20} />}
      </div>
      <div className="flex flex-col gap-1">
        <div className={cn(
          "p-4 rounded-2xl text-sm leading-relaxed relative group",
          m.role === 'assistant' ? "bg-secondary/80 text-foreground" : "bg-primary text-primary-foreground"
        )}>
          <div className="markdown-body">
            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        </div>
        <span className={cn(
          "text-[10px] font-bold opacity-30 px-2",
          m.role === 'user' ? "text-right" : "text-left"
        )}>
          {timeStr}
        </span>
      </div>
    </motion.div>
  );
});

export default function Chat({ books, trials, tasks, settings, camps, onRefresh }: { 
  books: Book[], 
  trials: Trial[], 
  tasks: Task[], 
  settings: AppSettings,
  camps: Camp[],
  onRefresh: () => void 
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load sessions from storage
  useEffect(() => {
    const loadSessions = async () => {
      const saved = await storage.getChatSessions();
      setSessions(saved.sort((a, b) => b.updatedAt - a.updatedAt));
    };
    loadSessions();
  }, []);

  // Update messages when active session changes
  useEffect(() => {
    if (activeSessionId) {
      const active = sessions.find(s => s.id === activeSessionId);
      if (active) {
        setMessages(active.messages);
      }
    } else {
      setMessages([{ 
        role: 'assistant', 
        content: 'Merhaba! Ben senin YKS asistanınım. Bugün programınla ilgili ne yapmak istersin? Mesela "Yarınki programı hafiflet" veya "Deneme sonuçlarımı analiz et" diyebilirsin.',
        timestamp: Date.now()
      }]);
    }
  }, [activeSessionId, sessions]);

  // Use a ref to track if we should auto-scroll
  const shouldAutoScroll = useRef(true);

  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If we are close to the bottom, auto-scroll is enabled
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  const createNewSession = (title = "Yeni Sohbet") => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title,
      messages: [{ 
        role: 'assistant', 
        content: 'Merhaba! Ben senin YKS asistanınım. Bugün programınla ilgili ne yapmak istersin? Mesela "Yarınki programı hafiflet" veya "Deneme sonuçlarımı analiz et" diyebilirsin.',
        timestamp: Date.now()
      }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const newSessions = [newSession, ...sessions];
    setSessions(newSessions);
    setActiveSessionId(newSession.id);
    storage.saveChatSessions(newSessions);
  };

  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (activeSessionId === id) setActiveSessionId(null);
    setDeletingSessionId(null);
    await storage.saveChatSessions(newSessions);
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const clearAllSessions = async () => {
    setSessions([]);
    setActiveSessionId(null);
    setShowClearConfirm(false);
    await storage.saveChatSessions([]);
  };

  const deleteLastMessage = async () => {
    if (messages.length <= 1) return; // Don't delete the initial greeting if it's the only one

    const newMessages = messages.slice(0, -1);
    setMessages(newMessages);

    if (activeSessionId) {
      const active = sessions.find(s => s.id === activeSessionId);
      if (active) {
        const updatedSession = {
          ...active,
          messages: newMessages,
          updatedAt: Date.now()
        };
        const newSessions = sessions.map(s => s.id === activeSessionId ? updatedSession : s);
        setSessions(newSessions);
        await storage.saveChatSessions(newSessions);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !settings.apiKey) return;
    
    const userMsg: ChatMessage = { 
      role: 'user', 
      content: input,
      timestamp: Date.now()
    };

    let sessionToUpdate: ChatSession | null = null;
    let currentSessionId = activeSessionId;

    if (!currentSessionId) {
      const newId = crypto.randomUUID();
      const newSession: ChatSession = {
        id: newId,
        title: input.slice(0, 30) + (input.length > 30 ? '...' : ''),
        messages: [...messages.filter(m => m.timestamp), userMsg],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      sessionToUpdate = newSession;
      currentSessionId = newId;
    } else {
      const active = sessions.find(s => s.id === currentSessionId);
      if (active) {
        sessionToUpdate = {
          ...active,
          messages: [...active.messages, userMsg],
          updatedAt: Date.now()
        };
      }
    }

    if (!sessionToUpdate) return;

    const newMessages = sessionToUpdate.messages;
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const gemini = new GeminiService(settings.apiKey, settings.aiModel);
      const today = new Date().toISOString().split('T')[0];
      const activeCamp = camps.find(c => today >= c.startDate && today <= c.endDate && c.isActive);
      
      const prompt = `
        Sen bir eğitim ve PDR uzmanısın. YKS yolculuğunda rehberlik yapıyorsun.
        KARAKTERİN VE ÖZEL TALİMATLARIN: ${settings.aiInstructions || "Realist, bazen sert, bir adım önde hissettiren, gereksiz onaylamayan ama yol gösteren bir mentör."}
        
        ÖĞRENCİ DURUMU:
        - Öğrenci Profili (Hedefler, Rahatsızlıklar vb.): ${settings.personalBio || "Belirtilmemiş."}
        - DENEME GEÇMİŞİ (NETLER): ${JSON.stringify(trials.slice(-10).map(t => ({ date: t.date, type: t.type, net: t.net, branch: t.branch })))}
        - KAYNAK DURUMU (KİTAPLAR): ${JSON.stringify(books.map(b => ({ title: b.title, branch: b.branch, progress: (b.completedUnits/b.totalUnits)*100, isPriority: b.priority, userNotes: b.notes })))}
        - ÜNİTE/BRANŞ BAZLI GENEL NOTLAR: ${JSON.stringify(settings.branchNotes || {})}
        - AKTİF KAMP: ${activeCamp ? `"${activeCamp.title}" kampı aktif` : "Aktif kamp yok."}
        
        ANALİZ KRİTERLERİ:
        1. ÖNCELİKLENDİRME: Öğrencinin netleri nerede düşükse ve ÜNİTE/BRANŞ BAZLI GENEL NOTLAR'da belirttiği ihtiyaçları neyse, elindeki kaynaklar o derse göre programlanmalı.
        2. KİTAP ÖZEL NOTLARI: Öğrenci kitaplar için özel çalışma yöntemi belirtmiş olabilir (örn: "turlama yapıyorum", "sondan başa çözüyorum"). Programlama yaparken bu notları (userNotes) MUTLAKA dikkate al.
        3. KAYNAK YETERSİZLİĞİ: Eğer bir branşta netler düşükse ve eldeki kaynak sayısı yetersiz görünyorsa spesifik olarak o branştan ek kaynak öner.
        4. STRATEJİK YAKLAŞIM: YKS'ye kalan süreyi (${Math.ceil((new Date(settings.yksDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} gün) de hesaba kat.
        
        GEÇMİŞ KONUŞMA:
        ${newMessages.slice(-5).map(m => `${m.role === 'user' ? 'Öğrenci' : 'Hoca'}: ${m.content}`).join('\n')}

        KULLANICI MESAJI: ${input}
        
        Eğer kullanıcı programında bir değişiklik isterse (örn: "yarın çalışmayacağım", "bugün geometriyi çıkar"), programı güncellemek için YAPILACAKLAR şeklinde not düş ama metin olarak cevap ver.
        YAPILACAKLAR kısmında her görev için (özellikle kitap çözümleri için) mutlaka açıklayıcı bir not ekle. Örn: "Şu kitabın şu konusunu/ünitesini çöz: [Açıklama]". Bu açıklamada kitabın üzerindeki notu ve öğrencinin branch analizlerini mutlaka göz önüne al ve öğrenciye o görevde ne yapması gerektiğini detaylandır.
      `;

      const responseText = await gemini.chat(prompt);

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: responseText,
        timestamp: Date.now()
      };

      // Save context for Program generation if it looks like program instructions
      if (responseText.includes("YAPILACAKLAR") || responseText.includes("GÖREV") || responseText.includes("PROGRAM")) {
        await storage.saveAiContext(responseText);
      }

      const finalSession = {
        ...sessionToUpdate,
        messages: [...sessionToUpdate.messages, assistantMsg],
        updatedAt: Date.now()
      };

      const otherSessions = sessions.filter(s => s.id !== currentSessionId);
      const updatedSessions = [finalSession, ...otherSessions];
      
      setSessions(updatedSessions);
      setActiveSessionId(currentSessionId);
      await storage.saveChatSessions(updatedSessions);

    } catch (e: any) {
      const getResetTime = () => {
        const now = new Date();
        const nextReset = new Date();
        nextReset.setHours(24, 0, 0, 0);
        const diff = nextReset.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours} saat ${minutes} dakika`;
      };

      let errorMsg = "Üzgünüm, bir hata oluştu. Lütfen API anahtarını kontrol et.";
      
      if (e.message?.includes("429") || e.message?.includes("quota") || e.message?.includes("RESOURCE_EXHAUSTED")) {
        errorMsg = `API kullanım limiti aşıldı. Günlük kotanız her gece 00:00'da sıfırlanır (Kalan süre: ${getResetTime()}). Eğer dakikalık kota sınırına takıldıysanız 1 dakika sonra tekrar deneyebilirsiniz.`;
      }
      
      const assistantMsg: ChatMessage = { role: 'assistant', content: errorMsg, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Sidebar - History */}
      <motion.div 
        animate={{ width: sidebarOpen ? 300 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className={cn(
          "card overflow-hidden flex flex-col transition-all duration-300",
          !sidebarOpen && "border-none shadow-none pointer-events-none"
        )}
      >
        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/20">
          <div className="flex flex-col">
            <h3 className="font-bold text-xs uppercase tracking-widest text-foreground/40">Geçmiş Sohbetler</h3>
            {sessions.length > 0 && (
              <div className="flex items-center gap-2 mt-1">
                {showClearConfirm ? (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={clearAllSessions}
                      className="text-[9px] font-bold text-red-500 hover:scale-110 transition-transform uppercase"
                    >
                      Evet, Sil
                    </button>
                    <button 
                      onClick={() => setShowClearConfirm(false)}
                      className="text-[9px] font-bold text-foreground/40 hover:text-foreground uppercase"
                    >
                      Vazgeç
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowClearConfirm(true)}
                    className="text-[9px] font-bold text-red-500/60 hover:text-red-500 uppercase tracking-tighter transition-colors"
                  >
                    Tümünü Temizle
                  </button>
                )}
              </div>
            )}
          </div>
          <button 
            onClick={() => createNewSession()}
            className="p-2 hover:bg-primary/10 rounded-xl text-primary transition-colors"
            title="Yeni Sohbet"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center p-4">
               <MessageSquare size={32} />
               <p className="text-[10px] font-bold mt-2 uppercase">Henüz sohbet yok</p>
            </div>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                className={cn(
                  "w-full rounded-xl text-left transition-all group relative overflow-hidden",
                  activeSessionId === s.id ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-secondary text-foreground/60"
                )}
              >
                <button
                  onClick={() => setActiveSessionId(s.id)}
                  className="w-full p-3 text-left"
                >
                  <p className="text-xs font-bold truncate pr-6">{s.title}</p>
                  <p className="text-[10px] opacity-40 mt-1">{new Date(s.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
                  {deletingSessionId === s.id ? (
                    <div className="flex items-center gap-1 bg-red-500 rounded-lg p-0.5 shadow-lg">
                      <button 
                        onClick={(e) => deleteSession(s.id, e)}
                        className="p-1 text-[10px] font-bold text-white hover:bg-white/10 rounded mr-1"
                      >
                        Sil
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDeletingSessionId(null); }}
                        className="p-1 text-[10px] font-bold text-white/60 hover:text-white"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDeletingSessionId(s.id); }}
                      className={cn(
                        "p-1.5 rounded-lg transition-all",
                        activeSessionId === s.id 
                          ? "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white" 
                          : "opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white text-foreground/20"
                      )}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setSidebarOpen(!sidebarOpen)}
               className="p-2 bg-card border border-border rounded-xl text-foreground/40 hover:text-primary transition-colors"
             >
               {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
             </button>
             <div>
               <h2 className="text-2xl font-bold flex items-center gap-2">
                 <Brain className="text-primary" size={28} /> AI Mentör Chat
               </h2>
               <p className="text-xs text-foreground/40 font-medium">Uzman PDR görüşleri ve program müdahale merkezi.</p>
             </div>
          </div>
          <button 
            onClick={() => setActiveSessionId(null)}
            className="px-4 py-2 bg-secondary text-foreground/60 rounded-xl text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-all"
          >
            Yeni Konuşma Başlat
          </button>
        </div>

        <div className="flex-1 card overflow-hidden flex flex-col">
          {/* Messages */}
          <div 
            ref={scrollRef} 
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
          >
            <AnimatePresence initial={false}>
              {messages.map((m, i) => {
                const prevMsg = messages[i - 1];
                const showDate = !prevMsg || new Date(prevMsg.timestamp).toDateString() !== new Date(m.timestamp).toDateString();
                
                return (
                  <React.Fragment key={m.timestamp || i}>
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="px-3 py-1 bg-secondary rounded-full text-[10px] font-black uppercase tracking-widest text-foreground/40">
                          {new Date(m.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    <MessageItem m={m} />
                  </React.Fragment>
                );
              })}
              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
                     <Bot size={20} />
                  </div>
                  <div className="bg-secondary/80 p-4 rounded-2xl flex gap-1 items-center">
                     <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                     <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                     <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input */}
          <div className="p-4 bg-secondary/30 border-t border-border">
            <div className="flex gap-3 bg-card border border-border rounded-2xl p-2 shadow-lg focus-within:ring-2 focus-within:ring-primary transition-all">
              <button 
                onClick={deleteLastMessage}
                disabled={messages.length <= 1 || isTyping}
                className="p-2 text-foreground/40 hover:text-red-500 transition-colors disabled:opacity-20"
                title="Son mesajı sil"
              >
                <RotateCcw size={20} />
              </button>
              <input 
                 value={input}
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSend()}
                 placeholder="Mentörüne sor..."
                 className="flex-1 bg-transparent border-none outline-none text-sm px-2 placeholder:text-foreground/20"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-95"
              >
                <Send size={18} />
              </button>
            </div>
            {!settings.apiKey && (
              <p className="text-[10px] text-red-500 font-bold mt-2 text-center uppercase tracking-widest">⚠️ AI Özellikleri için API Key Gerekli</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
