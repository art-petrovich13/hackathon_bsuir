// src/api/compare.ts
import apiClient from "./client";
import type {
  CreateComparisonRequest,
  CreateComparisonResponse,
  Comparison,
  ComparisonSummary,
  DiffResult,
  ProsecutorAnalysis,
} from "../types";

// ─── Маппер snake_case → camelCase ───────────────────────────────────────────
// Бэк отдаёт snake_case, фронт ожидает camelCase.
// Этот маппер — единственное место трансформации, бэк трогать не нужно.

function mapProsecutorAnalysis(raw: Record<string, unknown> | null | undefined): ProsecutorAnalysis | undefined {
  if (!raw) return undefined;
  const fin = (raw.financial_risks ?? {}) as Record<string, unknown>;
  const reg = (raw.regulatory_risks ?? {}) as Record<string, unknown>;
  const cases = Array.isArray(raw.similar_cases) ? raw.similar_cases : [];

  return {
    riskScore:            Number(raw.risk_score ?? 0),
    violationProbability: Number(raw.violation_probability ?? 0),
    financialRisks: {
      fineMinByn:            Number(fin.fine_min_byn ?? 0),
      fineMaxByn:            Number(fin.fine_max_byn ?? 0),
      fineBasis:             String(fin.fine_basis ?? ""),
      compensationRiskByn:   fin.compensation_risk_byn != null ? Number(fin.compensation_risk_byn) : undefined,
      legalCostsEstimateByn: fin.legal_costs_estimate_byn != null ? Number(fin.legal_costs_estimate_byn) : undefined,
    },
    regulatoryRisks: {
      primaryRegulator:        String(reg.primary_regulator ?? ""),
      prescriptionProbability: Number(reg.prescription_probability ?? 0),
      inspectionTriggerRisk:   Number(reg.inspection_trigger_risk ?? 0),
      suspensionRisk:          Boolean(reg.suspension_risk ?? false),
    },
    similarCases: cases.map((c: Record<string, unknown>) => ({
      description: String(c.description ?? ""),
      year:        Number(c.year ?? 2023),
      outcome:     String(c.outcome ?? ""),
      outcomeType: (c.outcome_type ?? "FINE") as "FINE" | "PRESCRIPTION" | "COURT" | "WARNING",
      costs:       c.costs != null ? Number(c.costs) : undefined,
    })),
    urgency:        (raw.urgency ?? "WITHIN_30_DAYS") as "IMMEDIATE" | "WITHIN_30_DAYS" | "RECOMMENDED",
    recommendedFix: String(raw.recommended_fix ?? ""),
    fixRationale:   String(raw.fix_rationale ?? ""),
  };
}

function mapDiffResult(raw: Record<string, unknown>): DiffResult {
  return {
    id:             String(raw.id ?? ""),
    comparisonId:   String(raw.comparison_id ?? ""),
    sectionPath:    String(raw.section_path ?? ""),
    changeType:     (raw.change_type ?? "MODIFIED") as DiffResult["changeType"],
    riskLevel:      (raw.risk_level ?? null) as DiffResult["riskLevel"],
    riskScore:      raw.risk_score != null ? Number(raw.risk_score) : null,
    oldText:        raw.old_text != null ? String(raw.old_text) : null,
    newText:        raw.new_text != null ? String(raw.new_text) : null,
    semanticType:   (raw.semantic_type ?? null) as DiffResult["semanticType"],
    lawReference:   raw.law_reference != null ? String(raw.law_reference) : null,
    recommendation: raw.recommendation != null ? String(raw.recommendation) : null,
    aiConfidence:   raw.ai_confidence != null ? Number(raw.ai_confidence) : null,
    prosecutor:     mapProsecutorAnalysis(raw.prosecutor_analysis_json as Record<string, unknown> | null),
  };
}

function mapSummary(raw: Record<string, unknown> | null | undefined): ComparisonSummary | null {
  if (!raw) return null;
  // Бэк отдаёт: { total, added, deleted, modified, moved, critical, high, medium, low }
  // Фронт ждёт: { totalChanges, criticalRisk, highRisk, mediumRisk, lowRisk, ... }
  return {
    totalChanges:      Number(raw.total ?? 0),
    criticalRisk:      Number(raw.critical ?? 0),
    highRisk:          Number(raw.high ?? 0),
    mediumRisk:        Number(raw.medium ?? 0),
    lowRisk:           Number(raw.low ?? 0),
    // Эти поля бэк пока не считает отдельно — ставим 0, добавим в день 4
    obligationChanges: Number(raw.obligation_changes ?? 0),
    deadlineChanges:   Number(raw.deadline_changes ?? 0),
    scopeChanges:      Number(raw.scope_changes ?? 0),
  };
}

function mapComparison(raw: Record<string, unknown>): Comparison {
  const rawDiffs = Array.isArray(raw.diff_results) ? raw.diff_results : [];
  return {
    id:             String(raw.id ?? ""),
    status:         (raw.status ?? "PENDING") as Comparison["status"],
    mode:           (raw.mode ?? "pair") as Comparison["mode"],   // ← ДОБАВИТЬ
    docOldId:       String(raw.doc_old_id ?? ""),
    docNewId:       String(raw.doc_new_id ?? ""),
    totalRiskScore: raw.total_risk_score != null ? Number(raw.total_risk_score) : null,
    diffResults:    rawDiffs.map((d) => mapDiffResult(d as Record<string, unknown>)),
    summary:        mapSummary(raw.summary_json as Record<string, unknown> | null),
    createdAt:      String(raw.created_at ?? ""),
  };
}

// ─── API функции ─────────────────────────────────────────────────────────────

export async function createComparison(
  payload: CreateComparisonRequest
): Promise<CreateComparisonResponse> {
  const response = await apiClient.post<CreateComparisonResponse>(
    "/api/compare",
    payload
  );
  return response.data;
}

export async function getComparison(id: string): Promise<Comparison> {
  // Получаем raw ответ как Record, затем маппим в camelCase
  const response = await apiClient.get<Record<string, unknown>>(
    `/api/compare/${id}`
  );
  return mapComparison(response.data);
}

// ─── Режим 3: Compliance ──────────────────────────────────────────────────────

export interface ComplianceCheckRequest {
  parent_doc_id: string;  // родительский НПА
  child_doc_id: string;   // дочерний ЛНА для проверки
}

export async function createComplianceCheck(
  payload: ComplianceCheckRequest
): Promise<CreateComparisonResponse> {
  const response = await apiClient.post<CreateComparisonResponse>(
    "/api/compare/compliance",
    payload
  );
  return response.data;
}

// ─── Режим 4: Audit ───────────────────────────────────────────────────────────

export interface AuditRequest {
  doc_id: string;
}

export async function createAudit(
  payload: AuditRequest
): Promise<CreateComparisonResponse> {
  const response = await apiClient.post<CreateComparisonResponse>(
    "/api/compare/audit",
    payload
  );
  return response.data;
}

export interface ChainCreateRequest {
  document_ids: string[];
}

export interface ChainVersion {
  versionPair: string;      // "v1 → v2"
  comparisonId: string;
  status: string;
  riskScore: number;
  changesCount: number;
  highCritical: number;
}

export interface ChainResult {
  id: string;
  status: string;
  documentCount: number;
  versions: ChainVersion[];
  trend: "INCREASING_RISK" | "DECREASING_RISK" | "STABLE";
  avgRiskScore: number;
}

export async function createChainComparison(
  payload: ChainCreateRequest
): Promise<{ id: string; comparisonIds: string[]; status: string }> {
  const response = await apiClient.post<Record<string, unknown>>(
    "/api/compare/chain",
    payload
  );
  const raw = response.data;
  return {
    id:            String(raw.id ?? ""),
    comparisonIds: Array.isArray(raw.comparison_ids) ? raw.comparison_ids.map(String) : [],
    status:        String(raw.status ?? "ANALYZING"),
  };
}

export async function getChainResult(chainId: string): Promise<ChainResult> {
  const response = await apiClient.get<Record<string, unknown>>(
    `/api/compare/chain/${chainId}`
  );
  const raw = response.data;
  const versions = Array.isArray(raw.versions) ? raw.versions : [];
  return {
    id:            String(raw.id ?? ""),
    status:        String(raw.status ?? "ANALYZING"),
    documentCount: Number(raw.document_count ?? 0),
    avgRiskScore:  Number(raw.avg_risk_score ?? 0),
    trend:         (raw.trend ?? "STABLE") as ChainResult["trend"],
    versions: versions.map((v: Record<string, unknown>) => ({
      versionPair:  String(v.version_pair ?? ""),
      comparisonId: String(v.comparison_id ?? ""),
      status:       String(v.status ?? ""),
      riskScore:    Number(v.risk_score ?? 0),
      changesCount: Number(v.changes_count ?? 0),
      highCritical: Number(v.high_critical ?? 0),
    })),
  };
}