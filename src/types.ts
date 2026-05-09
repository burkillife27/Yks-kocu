export interface StudySession {
  id: string;
  taskId?: string;
  taskTitle?: string;
  branch?: ExamBranch;
  startTime: number; // timestamp
  endTime: number; // timestamp
  type: 'pomodoro' | 'stopwatch';
}

export type BookType = "Konu Anlatım" | "Soru Bankası" | "Deneme";
export type ExamBranch = "TYT Matematik" | "TYT Türkçe" | "TYT Fen" | "TYT Sosyal" | "AYT Matematik" | "AYT Fen" | "AYT Fizik" | "AYT Kimya" | "AYT Biyoloji" | "AYT Edebiyat-Sosyal" | "AYT Sosyal-2" | "Geometri" | "TYT GENEL" | "AYT GENEL";

export interface Book {
  id: string;
  title: string;
  type: BookType;
  branch: ExamBranch;
  totalUnits: number; // sayfa veya test
  unitType: "sayfa" | "test";
  completedUnits: number;
  minutesPerUnit: number; // Tahmini bitirme süresi
  createdAt: number;
  updatedAt: number;
  isCompleted: boolean;
  priority: boolean; // Kesin bitirilecek
  dailyLimit: number; // Maksimum günlük birim (0 = sınırsız)
  allowedDays: number[]; // 0-6 (Pazar-Cumartesi)
  notes?: string; // Kitaba özel çalışma notları
}

export interface WorkSession {
  completedUnits: number;
  minutesSpent: number;
  at: number;
}

export interface Task {
  id: string;
  bookId?: string;
  title?: string;
  description?: string;
  branch?: ExamBranch;
  unitsToStudy?: number;
  unitsCompleted?: number;
  sessions?: WorkSession[];
  estimatedMinutes: number;
  actualMinutes?: number;
  date: string; // YYYY-MM-DD
  status: "pending" | "completed" | "skipped";
  completedAt?: number;
  isManual?: boolean;
  userNote?: string;
}

export interface TrialMistake {
  topic: string;
  count: number;
}

export interface TrialSubject {
  name: string;
  correct: number;
  wrong: number;
  empty: number;
  totalQuestions?: number;
}

export interface Trial {
  id: string;
  title: string;
  type: "TYT" | "AYT" | "Branş";
  branch?: ExamBranch;
  date: string;
  correct: number;
  wrong: number;
  empty: number;
  net: number;
  durationMinutes?: number;
  subjects?: TrialSubject[];
  mistakes: TrialMistake[];
  difficulty: "Kolay" | "Orta" | "Zor";
}

export interface UserRoutine {
  id: string;
  days: number[]; // 0-6
  startTime: string; // HH:mm
  durationMinutes: number;
  title: string;
  description?: string;
  selectedBookIds?: string[];
}

export interface Camp {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  selectedBooks: string[]; // IDs
  allowOverwork: boolean;
  isActive: boolean;
  createdAt: number;
}

export interface AppSettings {
  apiKey?: string;
  theme: "light" | "dark" | "blue" | "red" | "oled";
  yksDate: string; // YYYY-MM-DD
  studyStartDate?: string; // YKS çalışmaya başlama tarihi
  targetNets: {
    tyt: number;
    ayt: number;
  };
  adaptiveStudyPlan?: {
    isEnabled: boolean;
    maxDailyHours: number; // Hedeflenen maksimum saat
    weeklyIncrementMinutes: number; // Haftalık artış miktarı
    daysToApply: number[]; // 0-6
    startDate?: string; // Artışın başladığı tarih
  };
  pomodoro?: {
    workTime: number;
    shortBreak: number;
    longBreak: number;
    longBreakInterval: number;
    autoStartBreaks: boolean;
    autoStartWork: boolean;
    soundEnabled: boolean;
  };
  dailyStudyMinutes: Record<number, number>; // 0-6 -> minutes
  maxDailyBooks?: number;
  aiModel?: string; // e.g. "gemini-1.5-flash"
  aiInstructions?: string; // Information about how AI should behave
  personalBio?: string; // Information about the student
  branchNotes?: Partial<Record<ExamBranch, string>>;
  remindersEnabled: boolean;
}

export interface ApiUsage {
  requestsToday: number;
  lastResetDate: string; // YYYY-MM-DD
}

export interface AIWarning {
  id: string;
  type: "warning" | "tip" | "motivation" | "suggestion";
  message: string;
  actionLabel?: string;
  createdAt: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface DailyNote {
  date: string; // YYYY-MM-DD
  content: string;
}
