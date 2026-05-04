import { get, set } from 'idb-keyval';
import { Book, Trial, Task, AppSettings, AIWarning, UserRoutine, ApiUsage, Camp, ChatSession, StudySession } from '../types.ts';

const KEYS = {
  BOOKS: 'yks_books',
  TRIALS: 'yks_trials',
  TASKS: 'yks_tasks',
  SETTINGS: 'yks_settings',
  WARNINGS: 'yks_ai_warnings',
  ROUTINES: 'yks_routines',
  USAGE: 'yks_api_usage',
  CAMPS: 'yks_camps',
  CHAT_SESSIONS: 'yks_chat_sessions',
  STUDY_SESSIONS: 'yks_study_sessions',
  AI_CONTEXT: 'yks_ai_context',
};

export const storage = {
  async getUsage(): Promise<ApiUsage> {
    const today = new Date().toISOString().split('T')[0];
    const saved: ApiUsage | undefined = await get(KEYS.USAGE);
    
    if (!saved || saved.lastResetDate !== today) {
      const reset = { requestsToday: 0, lastResetDate: today };
      await set(KEYS.USAGE, reset);
      return reset;
    }
    return saved;
  },
  async incrementUsage() {
    const current = await this.getUsage();
    await set(KEYS.USAGE, {
      ...current,
      requestsToday: current.requestsToday + 1
    });
  },
  async getBooks(): Promise<Book[]> {
    return (await get(KEYS.BOOKS)) || [];
  },
  async saveBooks(books: Book[]) {
    await set(KEYS.BOOKS, books);
  },
  async getTrials(): Promise<Trial[]> {
    return (await get(KEYS.TRIALS)) || [];
  },
  async saveTrials(trials: Trial[]) {
    await set(KEYS.TRIALS, trials);
  },
  async getTasks(): Promise<Task[]> {
    return (await get(KEYS.TASKS)) || [];
  },
  async saveTasks(tasks: Task[]) {
    await set(KEYS.TASKS, tasks);
  },
  async getRoutines(): Promise<UserRoutine[]> {
    const raw = await get(KEYS.ROUTINES);
    if (!raw) return [];
    
    // Migration check
    return (raw as any[]).map(r => {
      // If it doesn't have an ID or 'days' property, it's an old routine
      if (!r.id || !r.days) {
        return {
          id: r.id || crypto.randomUUID(),
          days: r.dayOfWeek !== undefined ? [r.dayOfWeek] : [1,2,3,4,5],
          startTime: r.startTime || '08:00',
          durationMinutes: r.durationMinutes || 60,
          title: r.title || 'İsimsiz Rutin',
          description: r.description || '',
          selectedBookIds: r.selectedBookIds || []
        };
      }
      return r;
    });
  },
  async saveRoutines(routines: UserRoutine[]) {
    await set(KEYS.ROUTINES, routines);
  },
  async getSettings(): Promise<AppSettings> {
    const defaults: AppSettings = {
      theme: 'dark',
      yksDate: '2026-06-20',
      studyStartDate: new Date().toISOString().split('T')[0],
      targetNets: { tyt: 100, ayt: 75 },
      dailyStudyMinutes: { 0: 300, 1: 300, 2: 300, 3: 300, 4: 300, 5: 360, 6: 360 },
      aiModel: 'gemini-1.5-flash',
      aiInstructions: "Öğrenciyi sürekli onaylayan bir 'yankı odası' olma. Gerektiğinde mevcut çalışma planının yetersizliğini yüzüne vur ve onu daha yüksek bir performansa zorla. Bir adım önde olduğunu hissettir.",
      personalBio: '',
      adaptiveStudyPlan: {
        isEnabled: false,
        maxDailyHours: 12,
        weeklyIncrementMinutes: 15,
        daysToApply: [1, 2, 3, 4, 5],
        startDate: new Date().toISOString().split('T')[0]
      },
      pomodoro: {
        workTime: 25,
        shortBreak: 5,
        longBreak: 15,
        longBreakInterval: 4,
        autoStartBreaks: false,
        autoStartWork: false,
        soundEnabled: true
      },
      remindersEnabled: true
    };
    const saved = await get(KEYS.SETTINGS);
    return saved ? { ...defaults, ...saved, targetNets: { ...defaults.targetNets, ...(saved.targetNets || {}) } } : defaults;
  },
  async saveSettings(settings: AppSettings) {
    await set(KEYS.SETTINGS, settings);
  },
  async getWarnings(): Promise<AIWarning[]> {
    return (await get(KEYS.WARNINGS)) || [];
  },
  async saveWarnings(warnings: AIWarning[]) {
    await set(KEYS.WARNINGS, warnings);
  },
  async getCamps(): Promise<Camp[]> {
    return (await get(KEYS.CAMPS)) || [];
  },
  async saveCamps(camps: Camp[]) {
    await set(KEYS.CAMPS, camps);
  },
  async getChatSessions(): Promise<ChatSession[]> {
    return (await get(KEYS.CHAT_SESSIONS)) || [];
  },
  async saveChatSessions(sessions: ChatSession[]) {
    await set(KEYS.CHAT_SESSIONS, sessions);
  },
  async getStudySessions(): Promise<StudySession[]> {
    return (await get(KEYS.STUDY_SESSIONS)) || [];
  },
  async saveStudySessions(sessions: StudySession[]) {
    await set(KEYS.STUDY_SESSIONS, sessions);
  },
  async addStudySession(session: StudySession) {
    const sessions = await this.getStudySessions();
    await this.saveStudySessions([session, ...sessions]);
  },
  async saveAiContext(context: string) {
    await set(KEYS.AI_CONTEXT, context);
  },
  async getAiContext(): Promise<string> {
    return (await get(KEYS.AI_CONTEXT)) || '';
  }
};
