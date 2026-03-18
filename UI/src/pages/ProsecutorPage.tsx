// src/pages/ProsecutorPage.tsx
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Scale, AlertTriangle, DollarSign } from "lucide-react";
import { useComparison } from "../hooks/useComparison";
import { useProsecutor } from "../hooks/useProsecutor";
import ProsecutorAlert from "../components/risk/ProsecutorAlert";
import RiskBadge from "../components/risk/RiskBadge";

const BASE_VALUE_BYN = 40; // БВ на 2025 год

export default function ProsecutorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: comparison, isLoading: compLoading } = useComparison(id);
  const { data: prosecutorData, isLoading: prosLoading } = useProsecutor(
    id,
    comparison?.diffResults ?? []
  );

  const isLoading = compLoading || prosLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Анализируем правовые риски...</p>
        </div>
      </div>
    );
  }

  if (!comparison || !prosecutorData) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500 font-medium mb-4">Данные не найдены</p>
        <Link to="/upload" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Назад
        </Link>
      </div>
    );
  }

  const totalFineMin = prosecutorData.reduce((s, p) => s + p.prosecutorReport.financialRisks.fineMinByn, 0);
  const totalFineMax = prosecutorData.reduce((s, p) => s + p.prosecutorReport.financialRisks.fineMaxByn, 0);
  const immediateCount = prosecutorData.filter((p) => p.prosecutorReport.urgency === "IMMEDIATE").length;
  const avgViolationProb = prosecutorData.length > 0
    ? prosecutorData.reduce((s, p) => s + p.prosecutorReport.violationProbability, 0) / prosecutorData.length
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={`/compare/${id}`} className="btn-secondary inline-flex items-center gap-2 py-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад к анализу
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Scale className="w-5 h-5 text-red-600" />
              Модуль ПРОКУРОР
            </h1>
            <p className="text-sm text-gray-500">Прогноз правовых и финансовых рисков для нанимателя</p>
          </div>
        </div>
      </div>

      {prosecutorData.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Правовых рисков не обнаружено</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            В проанализированных изменениях не найдено пунктов с высоким прокурорским риском.
          </p>
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-4 border-l-4 border-l-red-500">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Зон риска</p>
              <p className="text-3xl font-black text-red-600">{prosecutorData.length}</p>
              <p className="text-xs text-gray-400 mt-1">HIGH + CRITICAL</p>
            </div>
            <div className="card p-4 border-l-4 border-l-orange-500">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Штраф (min)</p>
              <p className="text-2xl font-black text-orange-600">{totalFineMin} BYN</p>
              <p className="text-xs text-gray-400 mt-1">≈ {Math.round(totalFineMin / BASE_VALUE_BYN)} БВ</p>
            </div>
            <div className="card p-4 border-l-4 border-l-red-400">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Штраф (max)</p>
              <p className="text-2xl font-black text-red-600">{totalFineMax} BYN</p>
              <p className="text-xs text-gray-400 mt-1">≈ {Math.round(totalFineMax / BASE_VALUE_BYN)} БВ</p>
            </div>
            <div className="card p-4 border-l-4 border-l-yellow-500">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Срочных</p>
              <p className="text-3xl font-black text-yellow-600">{immediateCount}</p>
              <p className="text-xs text-gray-400 mt-1">Немедленного устранения</p>
            </div>
          </div>

          {/* Вероятность нарушения */}
          <div className="card p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Средняя вероятность административного нарушения</p>
              <p className="text-2xl font-black text-red-600">{Math.round(avgViolationProb * 100)}%</p>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  avgViolationProb >= 0.7 ? "bg-red-500" :
                  avgViolationProb >= 0.5 ? "bg-orange-500" : "bg-yellow-400"
                }`}
                style={{ width: `${avgViolationProb * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0% — безопасно</span>
              <span>100% — нарушение гарантировано</span>
            </div>
          </div>

          {/* BV Калькулятор */}
          <div className="card p-5 mb-6 bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-yellow-700" />
              <p className="text-sm font-semibold text-yellow-800">Калькулятор штрафов (1 БВ = {BASE_VALUE_BYN} BYN)</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Минимальный", byn: totalFineMin, color: "text-yellow-700" },
                { label: "Вероятный",   byn: Math.round((totalFineMin + totalFineMax) / 2), color: "text-orange-600" },
                { label: "Максимальный", byn: totalFineMax, color: "text-red-600" },
              ].map(({ label, byn, color }) => (
                <div key={label} className="bg-white rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-xl font-black ${color}`}>{Math.round(byn / BASE_VALUE_BYN)} БВ</p>
                  <p className="text-xs text-gray-400">{byn} BYN</p>
                </div>
              ))}
            </div>
          </div>

          {/* Список изменений */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Детальный анализ по изменениям ({prosecutorData.length})
            </h2>
            {prosecutorData.map((item) => {
              const diff = comparison.diffResults?.find((r) => r.id === item.diffId);
              return (
                <div key={item.diffId}>
                  {diff && (
                    <div className="flex items-center gap-3 mb-2 px-1">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-600">
                        п. {diff.sectionPath}
                      </code>
                      {diff.riskLevel && <RiskBadge level={diff.riskLevel} size="sm" />}
                      {diff.oldText && (
                        <p className="text-xs text-gray-500 truncate max-w-sm">
                          {diff.oldText.slice(0, 70)}{diff.oldText.length > 70 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  )}
                  <ProsecutorAlert
                    comparisonId={id!}
                    diffId={item.diffId}
                    analysis={item.prosecutorReport}
                    compact={false}
                  />
                </div>
              );
            })}
          </div>

          {/* Дисклеймер */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 leading-relaxed">
              ⚠️ Данный анализ носит информационный характер и не является юридической консультацией.
              Оценки штрафов рассчитаны на основе актуальных ставок КоАП РБ (БВ = {BASE_VALUE_BYN} BYN).
              Для принятия юридических решений обратитесь к квалифицированному юристу.
            </p>
          </div>
        </>
      )}
    </div>
  );
}