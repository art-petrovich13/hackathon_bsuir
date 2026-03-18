// frontend/src/types/index.ts

// ─── Базовые перечисления ────────────────────────────────────────────────────

export type FileType = "docx" | "pdf";

export type ChangeType = "ADDED" | "DELETED" | "MODIFIED" | "MOVED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SemanticType =
  | "OBLIGATION_CHANGE"   // "имеет право" → "обязан"
  | "SCOPE_CHANGE"        // расширение/сужение применения нормы
  | "DEADLINE_CHANGE"     // изменение сроков
  | "SUBJECT_CHANGE"      // изменение субъекта
  | "SANCTION_CHANGE"     // изменение ответственности
  | "COSMETIC";           // стилистические правки

export type ComparisonStatus =
  | "PENDING"
  | "PARSING"
  | "ANALYZING"
  | "DONE"
  | "ERROR";

export type Urgency = "IMMEDIATE" | "WITHIN_30_DAYS" | "RECOMMENDED";

export type OutcomeType = "FINE" | "PRESCRIPTION" | "COURT" | "WARNING";

// ─── Документы ───────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  name: string;
  original_name: string;
  fileType: FileType;
  createdAt: string; // ISO datetime string
}

// ─── Прокурор ────────────────────────────────────────────────────────────────

export interface SimilarCase {
  caseNumber?: string;
  description: string;
  year: number;
  outcome: string;
  outcomeType: OutcomeType;
  costs?: number;
}

export interface FinancialRisks {
  fineMinByn: number;
  fineMaxByn: number;
  fineBasis: string;        // "ст. 9.19 КоАП РБ"
  compensationRiskByn?: number;
  legalCostsEstimateByn?: number;
}

export interface RegulatoryRisks {
  primaryRegulator: string; // "ДИТ" | "Прокуратура" | "Минтруда"
  prescriptionProbability: number;  // 0.0 – 1.0
  inspectionTriggerRisk: number;    // 0.0 – 1.0
  suspensionRisk: boolean;
}

export interface ProsecutorAnalysis {
  riskScore: number;               // 0 – 100
  violationProbability: number;    // 0.0 – 1.0
  financialRisks: FinancialRisks;
  regulatoryRisks: RegulatoryRisks;
  similarCases: SimilarCase[];
  urgency: Urgency;
  recommendedFix: string;          // Готовая новая формулировка
  fixRationale: string;
}

// ─── Diff результаты ──────────────────────────────────────────────────────────

export interface DiffResult {
  id: string;
  comparisonId: string;
  sectionPath: string;       // "1.3.2"
  changeType: ChangeType;
  riskLevel: RiskLevel | null;
  riskScore: number | null;
  oldText: string | null;
  newText: string | null;
  semanticType: SemanticType | null;
  lawReference: string | null;
  recommendation: string | null;
  aiConfidence: number | null;   // 0.0 – 1.0
  prosecutor?: ProsecutorAnalysis;
}

// ─── Сравнение ────────────────────────────────────────────────────────────────

export interface ComparisonSummary {
  totalChanges: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  criticalRisk: number;
  obligationChanges: number;
  deadlineChanges: number;
  scopeChanges: number;
}

export interface Comparison {
  id: string;
  status: ComparisonStatus;
  docOldId: string;
  docNewId: string;
  totalRiskScore: number | null;
  diffResults: DiffResult[];
  summary: ComparisonSummary | null;
  createdAt: string;
}

// ─── API форматы запросов/ответов ─────────────────────────────────────────────

export interface UploadResponse {
  id: string;
  name: string;
  originalName: string;
  fileType: FileType;
  createdAt: string;
}

export interface CreateComparisonRequest {
  doc_old_id: string;
  doc_new_id: string;
}

export interface CreateComparisonResponse {
  id: string;
  task_id: string;
  status: ComparisonStatus;
}

// ─── WebSocket сообщения ──────────────────────────────────────────────────────

export interface WsStatusMessage {
  status: ComparisonStatus;
  progress: number;       // 0 – 100
  message: string;        // "Парсинг документов..."
}

// ─── UI стейт ────────────────────────────────────────────────────────────────

export interface FilterState {
  riskLevels: RiskLevel[];
  changeTypes: ChangeType[];
  semanticTypes: SemanticType[];
  searchQuery: string;
}

export type WordDiffTag = "equal" | "replace" | "insert" | "delete";

export interface WordDiffChunk {
  tag: WordDiffTag;
  oldWords: string[];
  newWords: string[];
}

// ─── Вкладки ComparePage ──────────────────────────────────────────────────────

export type CompareTab = "diff" | "table" | "dashboard" | "prosecutor";