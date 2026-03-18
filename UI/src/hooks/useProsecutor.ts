// src/hooks/useProsecutor.ts
import { useQuery } from "@tanstack/react-query";
import { getProsecutorData } from "../api/prosecutor";
import type { DiffResult, ProsecutorAnalysis, FinancialRisks, RegulatoryRisks, Urgency } from "../types";
import type { ProsecutorResponse } from "../api/prosecutor";

export function useProsecutor(
  comparisonId: string | undefined,
  diffResults: DiffResult[] = []
) {
  return useQuery<ProsecutorResponse[], Error>({
    queryKey: ["prosecutor", comparisonId],
    queryFn: async () => {
      if (!comparisonId) return [];
      try {
        return await getProsecutorData(comparisonId);
      } catch (error: any) {
        // 501/404 — бэкенд ещё не готов, используем mock
        if (error?.response?.status === 501 || error?.response?.status === 404) {
          return generateMockProsecutorData(diffResults);
        }
        throw error;
      }
    },
    enabled: !!comparisonId,
    staleTime: 60_000,
    retry: false,
  });
}

function generateMockProsecutorData(diffResults: DiffResult[]): ProsecutorResponse[] {
  const highRisk = diffResults.filter(
    (r) => r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL"
  );

  return highRisk.map((diff) => {
    const isCritical = diff.riskLevel === "CRITICAL";

    const financialRisks: FinancialRisks = {
      fineMinByn: isCritical ? 200 : 40,
      fineMaxByn: isCritical ? 2000 : 400,
      fineBasis: diff.semanticType === "OBLIGATION_CHANGE"
        ? "ст. 9.19 КоАП РБ (нарушение законодательства о труде)"
        : "ст. 9.25 КоАП РБ (нарушение порядка выплаты заработной платы)",
      compensationRiskByn: isCritical ? 5000 : undefined,
      legalCostsEstimateByn: isCritical ? 1500 : 500,
    };

    const regulatoryRisks: RegulatoryRisks = {
      primaryRegulator: diff.semanticType === "SANCTION_CHANGE" ? "Прокуратура" : "Минтруда и соцзащиты",
      prescriptionProbability: isCritical ? 0.85 : 0.55,
      inspectionTriggerRisk: isCritical ? 0.7 : 0.4,
      suspensionRisk: isCritical,
    };

    const urgency: Urgency = isCritical ? "IMMEDIATE" : "WITHIN_30_DAYS";

    const analysis: ProsecutorAnalysis = {
      riskScore: diff.riskScore ?? (isCritical ? 85 : 60),
      violationProbability: isCritical ? 0.8 : 0.55,
      financialRisks,
      regulatoryRisks,
      similarCases: isCritical ? [
        {
          description: "Аналогичное изменение формулировки обязанности работника",
          year: 2023,
          outcome: "Предписание об устранении + штраф 15 БВ",
          outcomeType: "PRESCRIPTION",
          costs: 800,
        },
        {
          description: "Нарушение ст. 19 ТК РБ в части условий трудового договора",
          year: 2022,
          outcome: "Штраф 15 БВ на должностное лицо",
          outcomeType: "FINE",
          costs: 600,
        },
      ] : [
        {
          description: "Изменение сроков уведомления без согласования с работником",
          year: 2023,
          outcome: "Предписание об устранении нарушения",
          outcomeType: "PRESCRIPTION",
        },
      ],
      urgency,
      recommendedFix: diff.semanticType === "OBLIGATION_CHANGE"
        ? `Заменить «обязан» на «имеет право» или дополнить условием: «в случаях, предусмотренных законодательством».`
        : `Внести изменение в соответствии с ${diff.lawReference ?? "Трудовым кодексом РБ"}.`,
      fixRationale: `Изменение может нарушать ${diff.lawReference ?? "нормы трудового законодательства"} и повлечь административную ответственность согласно КоАП РБ.`,
    };

    return { diffId: diff.id, prosecutorReport: analysis };
  });
}