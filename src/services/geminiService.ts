import { GoogleGenAI, Type } from "@google/genai";
import { Book, Trial, Task, AppSettings, UserRoutine, Camp } from "../types.ts";
import { storage } from "../lib/storage.ts";

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private modelName: string = "gemini-1.5-flash";

  constructor(apiKey?: string, modelName?: string) {
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
    if (modelName) {
      this.modelName = modelName;
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
    if (!this.ai) throw new Error("API Key is not set");

    const activeCamp = camps.find(c => targetDate >= c.startDate && targetDate <= c.endDate && c.isActive);

    // ANALİZ: Öğrencinin kitap bazlı gerçek hızını hesapla
    const performanceAnalysis = books.map(book => {
      const bookTasks = history.filter(t => t.bookId === book.id && t.status === 'completed' && t.actualMinutes && t.unitsCompleted);
      if (bookTasks.length === 0) return null;

      const totalActualMinutes = bookTasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
      const totalUnits = bookTasks.reduce((sum, t) => sum + (t.unitsCompleted || 0), 0);
      const actualMinutesPerUnit = totalActualMinutes / totalUnits;
      const deviation = (actualMinutesPerUnit / book.minutesPerUnit) - 1; // Pozitifse yavaş, negatifse hızlı

      return {
        bookId: book.id,
        title: book.title,
        plannedMinutesPerUnit: book.minutesPerUnit,
        actualMinutesPerUnit: actualMinutesPerUnit.toFixed(1),
        speedStatus: deviation > 0.1 ? "Yavaş (Süre artırılmalı)" : deviation < -0.1 ? "Hızlı (Süre azaltılabilir)" : "Normal",
        deviationPercent: (deviation * 100).toFixed(1) + "%"
      };
    }).filter(Boolean);

    const prompt = `
      Sen bir uzman YKS (Yükseköğretim Kurumları Sınavı) rehberlik ve PDR uzmanısın.
      Öğrencinin YKS hazırlık sürecini yönetiyor, kaynaklarını en verimli şekilde bitirmesini sağlıyorsun.

      SADECE BU TARİH İÇİN PROGRAM YAPACAKSIN: ${targetDate}
      
      ÖĞRENCİ VERİLERİ:
      - Mevcut Kitaplar: ${JSON.stringify(books)} 
        (Kitaplardaki priority:true olanlar KESİN bitirilmeli. dailyLimit:0 sınırsız, değilse gün başına o birimi geçme. allowedDays: [0-6] hangi günler çalışılabileceği.)
      - GERÇEK PERFORMANS ANALİZİ (Öğrencinin Hız Verileri): ${JSON.stringify(performanceAnalysis)}
        (BU VERİLERİ DİKKATE AL: Öğrenci bir kitabı planlanandan yavaş çözüyorsa 'estimatedMinutes' süresini buna göre artır, hızlıysa azalt.)
      - Deneme Netleri: ${JSON.stringify(trials)}
      - Hedef YKS Tarihi: ${settings.yksDate}
      - Planlanmış Çalışma Süreleri (Haftalık): ${JSON.stringify(settings.dailyStudyMinutes)}
      - Deneme Netleri (Geçmiş): ${JSON.stringify(trials)}
      - Hedef Netler: TYT: ${settings.targetNets.tyt}, AYT: ${settings.targetNets.ayt}
      - Planlama Kısıtları:
         - Bir gündeki maksimum farklı kitap sayısı: ${settings.maxDailyBooks || 3}
      - Kademeli Süre Artış Planı: ${JSON.stringify(settings.adaptiveStudyPlan)}
      - Kişisel Rutinler: ${JSON.stringify(routines)} 
        (AÇIKLAMA: Rutinler öğrencinin günündeki sabit bloklardır. 'durationMinutes' süresini ve 'startTime' başlangıcını belirtir. 
        Eğer bir rutinde 'selectedBookIds' varsa, o rutin süresi boyunca SADECE o kitaplardan (veya branşlarından) görev ata. 
        Eğer kitap seçilmemişse o süreyi 'meşgul' kabul et ve ders planlama. 
        Rutinlerin açıklamalarını ('description') mutlaka oku ve talimatlara uy.)
      - Öğrenci Hakkında Ek Bilgi: ${settings.personalBio || "Belirtilmemiş."}
      - YAPAY ZEKA KİŞİLİĞİ VE ÖZEL TALİMATLAR: ${settings.aiInstructions || "Sen bir uzman YKS rehberlik ve PDR uzmanısın. Öğrenciyi destekle."}
      - AKTİF KAMP: ${activeCamp ? `"${activeCamp.title}" kampı aktif. BU KAMPIN KİTAPLARINA MUTLAK ÖNCELİK VER: ${JSON.stringify(activeCamp.selectedBooks)}. Bu tarihler arası yoğun çalışma temposu geçerli. EĞER BU TARİHTE BİR KAMP VARSA, PROGRAMDA ÖNCELİKLE KAMP GÖREVLERİ YER ALMALIDIR.` : "Şu an aktif bir kamp yok."}
      - Tamamlanan Görev Geçmişi: ${JSON.stringify(history)}
      - ÖZEL İSTEK: ${customRequest || "Dengeli bir program yap."}

      KURALLAR:
      1. SADECE ${targetDate} TARİHİ İÇİN GÖREV ÜRET. Diğer tarihler için görev yazma.
      2. KİTAP YÖNETİMİ VE ÖNCELİKLENDİRME: 
         - ÖNCELİK SIRASI: 1. AKTİF KAMP KİTAPLARI, 2. priority:true olan kitaplar, 3. Diğer uygun kitaplar.
         - EĞER AKTİF KAMP VARSA, günlük çalışma süresinin büyük çoğunluğunu kamp kitaplarına ayır.
         - ${targetDate} gününe uygun (allowedDays kuralına uyan) kitapları seç.
         - GÜNLÜK KİTAP LİMİTİ: Bir güne en fazla ${settings.maxDailyBooks || 3} farklı kitaptan görev ata.
         - Öğrencinin deneme netlerini ve hedeflerini analiz et. Eğer deneme netleri hedefin çok altındaysa eksik konulara/branşlara odaklanan daha yoğun görevler ver.
         - dailyLimit değerini aşma.
      3. ÇALIŞMA SÜRESİ: Aktif kamp varsa veya kademeli artış aktifse günlük çalışma süresini buna göre uyarla. Kamp varsa öğrenci daha fazla çalışmaya (allowOverwork) gönüllüdür. Kamp süresince tempo normalden yüksek olmalıdır.
      4. GÖREVLER: Sadece ${targetDate} tarihi için görev önerilerini JSON formatında döndür. Eğer kitap yetişmeyecekse görev başlığına (title) uyarı ekle.

      JSON Formatı:
      Array<{
        bookId: string,
        unitsToStudy: number,
        estimatedMinutes: number,
        date: string (YYYY-MM-DD),
        title: string (görevin kısa adı veya uyarı notu),
        description: string (ayrıntılı açıklama, örneğin hangi konuların çözüleceği, branş notlarına ve kitap notlarına göre çalışma talimatı)
      }>
    `;

    try {
      const result = await (this.ai as any).models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
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
          }
        }
      });

      await storage.incrementUsage();

      const parsed = JSON.parse(result.text);
      return parsed.map((t: any) => ({
        ...t,
        id: crypto.randomUUID(),
        status: "pending"
      }));
    } catch (e: any) {
      if (e.message?.includes("429") || e.message?.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("API kullanım limiti doldu. Lütfen (yaklaşık 1 dakika) bekleyip tekrar deneyin.");
      }
      console.error("Failed to generate program", e);
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
    if (!this.ai) return [{ message: "API Key girilmediği için mentörlük devre dışı.", type: "warning" }];

    const todayProgress = history.filter(t => t.date === new Date().toISOString().split('T')[0] && t.status === 'completed').length;
    const todayTotal = history.filter(t => t.date === new Date().toISOString().split('T')[0]).length;
    const today = new Date().toISOString().split('T')[0];
    const activeCamp = camps.find(c => today >= c.startDate && today <= c.endDate && c.isActive);

    const performanceAnalysis = books.map(book => {
      const bookTasks = history.filter(t => t.bookId === book.id && t.status === 'completed' && t.actualMinutes && t.unitsCompleted);
      if (bookTasks.length < 2) return null;

      const totalActual = bookTasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
      const totalUnits = bookTasks.reduce((sum, t) => sum + (t.unitsCompleted || 0), 0);
      const actualAvg = totalActual / totalUnits;
      const deviation = (actualAvg / book.minutesPerUnit) - 1;

      return {
        title: book.title,
        status: deviation > 0.15 ? "Beklenenden çok yavaş" : deviation < -0.15 ? "Beklenenden çok hızlı" : "İdeal tempoda",
        diffPercent: (deviation * 100).toFixed(0) + "%"
      };
    }).filter(Boolean);

    const prompt = `
      KİŞİLİĞİN VE ÖZEL TALİMATLARIN: ${settings.aiInstructions || "Sen keskin zekalı, realist ve bazen sert bir YKS mentörüsün. Sırf onaylayan bir 'yankı odası' değilsin."}
      
      Aşağıdaki verilere bakarak öğrenciye 2-3 adet proaktif tavsiye, uyarı veya motivasyon ver.
      AYRICA MUTLAKA en az 1-2 adet 'suggestion' (öneri) tipinde veri üret. Bu öneriler sadece mevcut kitaplarla sınırlı kalmamalıdır:
      - "Ders çalışma saatlerini artır" (Haftalık çalışma süresi yetersizse), 
      - "Şu dersten (branş adı) deneme al/çöz" (Netler düşükse veya o branşta hiç deneme verisi yoksa), 
      - "Şu dersten (branş adı) yeni bir soru bankası al" (Mevcut kitaplar bittiyse, eksik hissediliyorsa veya o branşta hiç kitabın yoksa ve hedefin için gerekliyse).
      
      Önemli: Eğer bir branşta (örn: AYT Matematik, TYT Türkçe) öğrencinin hiç kitabı yoksa ama hedef netleri yüksekse, mutlaka o branşta kaynak edinmesini öner.
      
      Önerilerin (suggestion) 'actionLabel' alanı mutlaka kısa bir eylem ifadesi olmalı (örn: "Deneme Al", "Süreyi Artır", "Soru Bankası Al", "Kaynak Edin").
 
      ÖĞRENCİ DURUMU:
      - Profil: ${settings.personalBio || "Belirtilmemiş."}
      - Kitaplar: ${JSON.stringify(books.map(b => ({ title: b.title, progress: (b.completedUnits/b.totalUnits)*100, type: b.type, branch: b.branch })))}
      - HIZ ANALİZİ: ${JSON.stringify(performanceAnalysis)}
      - Deneme Gelişimi: ${JSON.stringify(trials.map(t => ({ date: t.date, net: t.net, type: t.type, mistakes: t.mistakes })))}
      - Hedef Netler: TYT:${settings.targetNets.tyt}, AYT:${settings.targetNets.ayt}
      - Program: Günlük Hedef ${settings.dailyStudyMinutes[new Date().getDay()]} dk, Bugün ${todayProgress}/${todayTotal} görev yapıldı.
      - AKTİF KAMP: ${activeCamp ? `"${activeCamp.title}" kampı devam ediyor.` : "Şu an aktif kamp yok."}
 
      JSON formatında bir dizi döndür: Array<{ "message": "...", "type": "warning" | "tip" | "motivation" | "suggestion", "actionLabel"?: string }>
    `;

    try {
      const result = await (this.ai as any).models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
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
          }
        }
      });

      await storage.incrementUsage();
      return JSON.parse(result.text);
    } catch (e: any) {
      if (e.message?.includes("429") || e.message?.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("Limit aşımı: Mentör tavsiyesi için lütfen 1 dk bekleyin.");
      }
      throw e;
    }
  }

  async chat(prompt: string): Promise<string> {
    if (!this.ai) throw new Error("API Key is not set");
    try {
      const result = await (this.ai as any).models.generateContent({
        model: this.modelName,
        contents: prompt,
      });
      await storage.incrementUsage();
      return result.text;
    } catch (e: any) {
      if (e.message?.includes("429") || e.message?.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("API kullanım limiti aşıldı. Lütfen 1 dakika sonra tekrar dene.");
      }
      throw e;
    }
  }
}
