import { GoogleGenAI, Type } from "@google/genai";
import { Book, Trial, Task, AppSettings, UserRoutine, Camp } from "../types.ts";
import { storage } from "../lib/storage.ts";

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private modelName: string = "gemini-3-flash-preview";

  constructor(apiKey?: string, modelName?: string) {
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
    // Skill'e göre tavsiye edilen model gemini-3-flash-preview'dur.
    // Kullanıcının model tercihi varsa onu kullanırız ama gemini-1.5-flash yasaklı olduğu için
    // eğer o seçiliyse gemini-3-flash-preview'a yönlendiririz.
    if (modelName && !modelName.includes("1.5")) {
      this.modelName = modelName;
    } else {
      this.modelName = "gemini-3-flash-preview";
    }
  }

  private async generate(prompt: string, schema?: any, systemInstruction?: string): Promise<string> {
    if (!this.ai) throw new Error("API Anahtarı ayarlanmamış.");

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: schema ? "application/json" : "text/plain",
          responseSchema: schema,
          temperature: 0.7,
        }
      });

      await storage.incrementUsage();
      return response.text || "";
    } catch (e: any) {
      console.error("Gemini API Error details:", e);
      throw e;
    }
  }

  async generateProgram(
    books: Book[],
    trials: Trial[],
    settings: AppSettings,
    history: Task[],
    routines: UserRoutine[],
    targetDate: string,
    camps: Camp[],
    customRequest?: string
  ): Promise<Task[]> {
    if (!this.ai) return [];

    const activeCamp = camps.find(c => targetDate >= c.startDate && targetDate <= c.endDate && c.isActive);

    const allDailyNotes = await storage.getDailyNotes();
    const currentNote = allDailyNotes.find(n => n.date === targetDate);
    const recentNotes = allDailyNotes
      .filter(n => n.date < targetDate)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    const recentFeedback = history
      .filter(t => t.status === 'completed' && t.userNote)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
      .map(t => ({
        date: t.date,
        title: t.bookId ? books.find(b => b.id === t.bookId)?.title : t.title,
        note: t.userNote
      }));

    // Deneme performans özeti
    const trialSummary = trials
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map(t => ({
        tarih: t.date,
        branş: t.branch || t.type,
        net: t.net,
        zorluk: t.difficulty,
        hatalıKonular: t.mistakes.map(m => m.topic)
      }));

    const performanceAnalysis = books.map(book => {
      const bookTasks = history.filter(t => t.bookId === book.id && t.status === 'completed' && t.actualMinutes && t.unitsCompleted);
      if (bookTasks.length === 0) return null;
      const totalActualMinutes = bookTasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
      const totalUnits = bookTasks.reduce((sum, t) => sum + (t.unitsCompleted || 0), 0);
      return {
        bookId: book.id,
        title: book.title,
        actualMinutesPerUnit: (totalActualMinutes / totalUnits).toFixed(1)
      };
    }).filter(Boolean);

    const systemInstruction = `
      Sen bir uzman YKS (Yükseköğretim Kurumları Sınavı) rehberlik ve PDR uzmanısın.
      SADECE BU TARİH İÇİN PROGRAM YAPACAKSIN: ${targetDate}
    `;

    const prompt = `
      ÖĞRENCİ VERİLERİ:
      - Mevcut Kitaplar: ${JSON.stringify(books)}
      - Hız Analizi: ${JSON.stringify(performanceAnalysis)}
      - Deneme Performans Özeti (Son 5): ${JSON.stringify(trialSummary)}
      - Hedefler: ${JSON.stringify(settings.targetNets)}
      - Bugün İçin Not: ${currentNote?.content || "Yok"}
      - Görev Özelinde Geri Bildirimler: ${JSON.stringify(recentFeedback)}
      - Geçmiş Günlere Ait Notlar (Engeller/Durumlar): ${JSON.stringify(recentNotes)}
      - Rutinler: ${JSON.stringify(routines)}
      - Özel İstek: ${customRequest || "Dengeli bir program yap."}
      - Aktif Kamp: ${activeCamp ? activeCamp.title : "Yok"}

      Lütfen ${targetDate} günü için uygun görevler ata.
      Önemli: Denemelerdeki konu eksiklerine ve hatalı konulara öncelik verebilirsin.
      Verileri JSON formatında döndür.
    `;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          bookId: { type: Type.STRING },
          unitsToStudy: { type: Type.NUMBER },
          estimatedMinutes: { type: Type.NUMBER },
          date: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["bookId", "unitsToStudy", "estimatedMinutes", "date", "title", "description"]
      }
    };

    try {
      const jsonText = await this.generate(prompt, schema, systemInstruction);
      if (!jsonText) return [];
      const parsed = JSON.parse(jsonText);
      return parsed.map((t: any) => ({
        ...t,
        id: crypto.randomUUID(),
        status: 'pending' as const
      }));
    } catch (e) {
      console.error("Error in generateProgram:", e);
      return [];
    }
  }

  async getMentorAdvice(
    books: Book[],
    trials: Trial[],
    history: Task[],
    settings: AppSettings,
    camps: Camp[],
    currentTask?: Task
  ): Promise<Array<{ message: string, type: "warning" | "tip" | "motivation" | "suggestion", actionLabel?: string }>> {
    if (!this.ai) return [];

    const aiContext = await storage.getAiContext();
    const activeCamp = camps.find(c => new Date().toISOString().split('T')[0] >= c.startDate && new Date().toISOString().split('T')[0] <= c.endDate && c.isActive);

    // Son 5 denemenin detaylı analizi
    const detailedTrials = trials
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map(t => ({
        tarih: t.date,
        baslik: t.title,
        tur: t.type,
        net: t.net,
        sure: t.durationMinutes,
        zorluk: t.difficulty,
        konuAnalizi: t.subjects?.map(s => `${s.name}: ${s.correct}D ${s.wrong}Y ${s.empty}B`),
        hataYapilanKonular: t.mistakes.map(m => `${m.topic} (${m.count} hata)`)
      }));

    const prompt = `
      Kişisel Bilgiler: ${settings.personalBio}
      Kitaplar: ${JSON.stringify(books.map(b => b.title))}
      
      SON DENEME PERFORMANSLARI (DETAYLI):
      ${JSON.stringify(detailedTrials)}
      
      HEDEF NETLER:
      TYT: ${settings.targetNets.tyt}
      AYT: ${settings.targetNets.ayt}

      ${aiContext ? `Bağlam: ${aiContext}` : ""}
      
      YKS mentörü olarak öğrencinin son deneme performanslarını (süre yönetimi, branş bazlı hatalar, konu eksikleri) analiz et ve gelişim odaklı tavsiyeler ver. JSON formatında döndür.
    `;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["warning", "tip", "motivation", "suggestion"] },
          actionLabel: { type: Type.STRING }
        },
        required: ["message", "type"]
      }
    };

    try {
      const jsonText = await this.generate(prompt, schema, "Sen sert ama yapıcı bir YKS mentörüsün.");
      if (!jsonText) return [];
      return JSON.parse(jsonText);
    } catch (e) {
      console.error("Error in getMentorAdvice:", e);
      return [];
    }
  }

  async chat(prompt: string): Promise<string> {
    if (!this.ai) return "API Anahtarı ayarlanmamış.";
    try {
      return await this.generate(prompt, null, "Sen bir YKS hazırlık asistanısın.");
    } catch (e) {
      console.error("Error in chat:", e);
      return "Üzgünüm, bir hata oluştu.";
    }
  }

  async getTrialAnalysis(trials: Trial[], settings: AppSettings): Promise<string> {
    if (!this.ai) return "API Anahtarı ayarlanmamış.";

    const trialData = trials
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
      .map(t => ({
        tarih: t.date,
        baslik: t.title,
        tur: t.type,
        branş: t.branch,
        net: t.net,
        dogru: t.correct,
        yanlis: t.wrong,
        bos: t.empty,
        sure: t.durationMinutes,
        zorluk: t.difficulty,
        konuAnalizi: t.subjects?.map(s => `${s.name}: ${s.correct}D ${s.wrong}Y ${s.empty}B`),
        hataDetaylari: t.mistakes.map(m => `${m.topic}: ${m.count} hata`)
      }));

    const prompt = `
      ÖĞRENCİ PROFİLİ:
      Hedef TYT Net: ${settings.targetNets.tyt}
      Hedef AYT Net: ${settings.targetNets.ayt}
      Kişisel Notlar: ${settings.personalBio || "Yok"}

      DENEME VERİLERİ (SON 10):
      ${JSON.stringify(trialData)}

      Lütfen bu verileri bir YKS koçu gözüyle analiz et.
      Aşağıdaki başlıkları içeren profesyonel, motive edici ve stratejik bir rapor hazırla:
      1. Genel Trend ve Gelişim Özeti
      2. Branş Bazlı Kritik Tespitler (Hangi derste süre/hata sorunu var?)
      3. Tekrar Edilen Hatalar ve Konu Eksikleri
      4. Süre Yönetimi Analizi
      5. Somut Çalışma Önerileri

      Yanıtını Markdown formatında, güzel bir dille yaz.
    `;

    try {
      return await this.generate(prompt, null, "Sen uzman bir YKS eğitim koçusun. Verileri titizlikle inceler, öğrencinin göremediği detayları yakalarsın.");
    } catch (e) {
      console.error("Error in getTrialAnalysis:", e);
      return "Analiz sırasında bir hata oluştu.";
    }
  }
}
