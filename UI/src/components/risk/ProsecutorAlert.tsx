// src/components/risk/ProsecutorAlert.tsx
import { Scale, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ProsecutorAnalysis, Urgency } from "../../types";

interface ProsecutorAlertProps {
  comparisonId: string;
  diffId: string;
  analysis: ProsecutorAnalysis;
  compact?: boolean;
}

const URGENCY_CONFIG: Record<Urgency, { label: string; color: string }> = {
  IMMEDIATE:      { label: "Требует немедленных действий", color: "text-red-700 bg-red-100 border-red-300" },
  WITHIN_30_DAYS: { label: "Устранить в течение 30 дней",  color: "text-orange-700 bg-orange-100 border-orange-300" },
  RECOMMENDED:    { label: "Рекомендуется устранить",       color: "text-yellow-700 bg-yellow-100 border-yellow-300" },
};

function formatByn(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} BYN`;
}

export default function ProsecutorAlert({
  comparisonId, diffId, analysis, compact = false,
}: ProsecutorAlertProps) {
  const urgencyConfig = URGENCY_CONFIG[analysis.urgency];

  // ─── КОМПАКТНЫЙ ВИД (для SidePanel и вкладки ПРОКУРОР) ───────────────────────
  if (compact) {
    return (
      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Прокурорский риск</p>
          <span className="ml-auto text-lg font-black text-red-600">{Math.round(analysis.riskScore)}</span>
        </div>
        <p className="text-xs text-red-700 mb-1 font-medium">
          Штраф: {formatByn(analysis.financialRisks.fineMinByn)} – {formatByn(analysis.financialRisks.fineMaxByn)}
        </p>
        <p className="text-xs text-gray-500 mb-2 italic">{analysis.financialRisks.fineBasis}</p>
        <Link
          to={`/compare/${comparisonId}/prosecutor`}
          className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
        >
          Полный анализ <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  // ─── ПОЛНЫЙ ВИД (для ProsecutorPage) ─────────────────────────────────────────
  return (
    <div className="card border border-red-200 overflow-hidden">
      {/* Шапка */}
      <div className="bg-red-50 px-5 py-3 border-b border-red-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-red-600" />
          <p className="text-sm font-semibold text-red-800">Прокурорский анализ</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${urgencyConfig.color}`}>
            {urgencyConfig.label}
          </span>
          <span className="text-2xl font-black text-red-600">{Math.round(analysis.riskScore)}</span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Вероятность нарушения */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-600">Вероятность нарушения</p>
            <p className="text-sm font-bold text-red-600">{Math.round(analysis.violationProbability * 100)}%</p>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full"
              style={{ width: `${analysis.violationProbability * 100}%` }}
            />
          </div>
        </div>

        {/* Финансовые риски + регулятор */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <p className="text-xs text-gray-500 mb-1">Штраф (min – max)</p>
            <p className="text-sm font-bold text-red-700">
              {formatByn(analysis.financialRisks.fineMinByn)} – {formatByn(analysis.financialRisks.fineMaxByn)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{analysis.financialRisks.fineBasis}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
            <p className="text-xs text-gray-500 mb-1">Регулятор</p>
            <p className="text-sm font-bold text-orange-700">{analysis.regulatoryRisks.primaryRegulator}</p>
            <p className="text-xs text-gray-500 mt-1">
              Предписание: {Math.round(analysis.regulatoryRisks.prescriptionProbability * 100)}%
            </p>
          </div>
        </div>

        {/* Рекомендуемое исправление */}
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <p className="text-xs font-semibold text-green-800 mb-1">✏️ Рекомендуемое исправление</p>
          <p className="text-sm text-green-800 leading-relaxed">{analysis.recommendedFix}</p>
          <p className="text-xs text-gray-500 mt-1 italic">{analysis.fixRationale}</p>
        </div>

        {/* Аналогичные случаи */}
        {analysis.similarCases.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Аналогичные случаи</p>
            <div className="space-y-2">
              {analysis.similarCases.map((c, i) => (
                <div key={i} className="bg-gray-50 rounded p-2.5 border border-gray-200">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-gray-700">{c.description}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0">{c.year}</span>
                  </div>
                  <p className="text-xs text-red-600 font-medium mt-1">
                    → {c.outcome}
                    {c.costs && <span className="text-gray-500 font-normal"> ({formatByn(c.costs)})</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}