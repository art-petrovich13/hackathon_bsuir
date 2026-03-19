// frontend/src/api/prosecutor.ts
import apiClient from "./client";
import type { ProsecutorAnalysis } from "../types";

export interface ProsecutorResponse {
  diffId: string;
  sectionPath: string;
  riskLevel: string;
  oldText: string | null;
  newText: string | null;
  lawReference: string | null;
  prosecutorReport: ProsecutorAnalysis | null;
}

export interface ProsecutorApiResult {
  comparisonId: string;
  totalFinancialExposureByn: number;
  totalFinancialExposureUsd: number;
  hasProsecutorData: boolean;
  results: ProsecutorResponse[];
}

function mapReport(raw: Record<string, unknown> | null): ProsecutorAnalysis | null {
  if (!raw) return null;
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

export async function getProsecutorData(
  comparisonId: string
): Promise<ProsecutorApiResult> {
  const response = await apiClient.get<Record<string, unknown>>(
    `/api/compare/${comparisonId}/prosecutor`
  );
  const raw = response.data;
  const rawResults = Array.isArray(raw.results) ? raw.results : [];

  return {
    comparisonId:              String(raw.comparison_id ?? ""),
    totalFinancialExposureByn: Number(raw.total_financial_exposure_byn ?? 0),
    totalFinancialExposureUsd: Number(raw.total_financial_exposure_usd ?? 0),
    hasProsecutorData:         Boolean(raw.has_prosecutor_data ?? false),
    results: rawResults.map((r: Record<string, unknown>) => ({
      diffId:          String(r.diff_id ?? ""),
      sectionPath:     String(r.section_path ?? ""),
      riskLevel:       String(r.risk_level ?? ""),
      oldText:         r.old_text != null ? String(r.old_text) : null,
      newText:         r.new_text != null ? String(r.new_text) : null,
      lawReference:    r.law_reference != null ? String(r.law_reference) : null,
      prosecutorReport: mapReport(r.prosecutor_report as Record<string, unknown> | null),
    })),
  };
}