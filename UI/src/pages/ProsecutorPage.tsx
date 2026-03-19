// frontend/src/pages/ProsecutorPage.tsx
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Scale, AlertTriangle, DollarSign, Clock, Loader2 } from "lucide-react";
import { useComparison } from "../hooks/useComparison";
import { useProsecutor } from "../hooks/useProsecutor";
import ProsecutorAlert from "../components/risk/ProsecutorAlert";
import RiskBadge from "../components/risk/RiskBadge";

const BASE_VALUE_BYN = 40;

export default function ProsecutorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: comparison, isLoading: compLoading } = useComparison(id);
  const { data: prosecutorData, isLoading: prosLoading, isFetching } = useProsecutor(id);

  const isLoading = compLoading || (prosLoading && !prosecutorData);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Загружаем данные...</p>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500 font-medium mb-4">Данные не найдены</p>
        <Link to="/upload" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Назад
        </Link>
      </div>
    );
  }

  // Определяем состояние прокурора
  const results = prosecutorData?.results ?? [];
  const hasHighResults = results.length > 0;
  const hasAnyReport = results.some((r) => r.prosecutorReport !== null);
  const isAnalyzing = hasHighResults && !hasAnyReport; // есть HIGH, но отчёты ещё null
  const noHighRisk = !hasHighResults; // HIGH/CRITICAL изменений вообще нет

  const readyResults = results.filter((r) => r.prosecutorReport !== null);
  const totalFineMin = readyResults.reduce((s, p) => s + (p.prosecutorReport?.financialRisks.fineMinByn ?? 0), 0);
  const totalFineMax = readyResults.reduce((s, p) => s + (p.prosecutorReport?.financialRisks.fineMaxByn ?? 0), 0);
  const immediateCount = readyResults.filter((p) => p.prosecutorReport?.urgency === "IMMEDIATE").length;
  const avgViolationProb = readyResults.length > 0
    ? readyResults.reduce((s, p) => s + (p.prosecutorReport?.violationProbability ?? 0), 0) / readyResults.length
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
            <p className="text-sm text-gray-500">Прогноз правовых и финансовых рисков</p>
          </div>
        </div>
        {isFetching && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Обновляем...
          </div>
        )}
      </div>

      {/* СОСТОЯНИЕ: нет HIGH/CRITICAL изменений */}
      {noHighRisk && (
        <div className="card p-10 text-center">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Нарушений высокого риска не обнаружено</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            В документе нет изменений с уровнем HIGH или CRITICAL, которые требуют прокурорского анализа.
          </p>
        </div>
      )}

      {/* СОСТОЯНИЕ: есть HIGH, но прокурор ещё анализирует */}
      {isAnalyzing && (
        <div className="card p-8 border-l-4 border-l-orange-400">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-orange-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-800 mb-1">
                Прокурорский анализ выполняется
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Обнаружено <strong>{results.length}</strong> изменений высокого риска.
                AI-прокурор анализирует каждое и рассчитывает финансовые риски.
              </p>

              {/* Прогресс-бар */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Анализ нарушений...</span>
                  <span>{readyResults.length} / {results.length}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all duration-700"
                    style={{ width: results.length > 0 ? `${(readyResults.length / results.length) * 100}%` : "10%" }}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Обычно занимает 1–2 минуты. Вы можете перейти на другие вкладки — страница обновится автоматически.
              </p>

              {/* Список ожидающих изменений */}
              <div className="mt-4 space-y-2">
                {results.map((r) => (
                  <div key={r.diffId} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-600">
                      п. {r.sectionPath}
                    </code>
                    <RiskBadge level={r.riskLevel as "HIGH" | "CRITICAL"} size="sm" />
                    {r.prosecutorReport ? (
                      <span className="ml-auto text-xs text-green-600 font-medium">✓ Готово</span>
                    ) : (
                      <span className="ml-auto text-xs text-orange-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Анализируется...
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* СОСТОЯНИЕ: результаты готовы */}
      {!isAnalyzing && !noHighRisk && readyResults.length > 0 && (
        <>
          {/* KPI карточки */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-4 border-l-4 border-l-red-500">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Зон риска</p>
              <p className="text-3xl font-black text-red-600">{readyResults.length}</p>
              <p className="text-xs text-gray-400 mt-1">HIGH + CRITICAL</p>
            </div>
            <div className="card p-4 border-l-4 border-l-orange-500">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Штраф (min)</p>
              <p className="text-2xl font-black text-orange-600">{totalFineMin.toLocaleString("ru-RU")} BYN</p>
              <p className="text-xs text-gray-400 mt-1">≈ {Math.round(totalFineMin / BASE_VALUE_BYN)} БВ</p>
            </div>
            <div className="card p-4 border-l-4 border-l-red-400">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Штраф (max)</p>
              <p className="text-2xl font-black text-red-600">{totalFineMax.toLocaleString("ru-RU")} BYN</p>
              <p className="text-xs text-gray-400 mt-1">≈ {Math.round(totalFineMax / BASE_VALUE_BYN)} БВ</p>
            </div>
            <div className="card p-4 border-l-4 border-l-yellow-500">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Срочных</p>
              <p className="text-3xl font-black text-yellow-600">{immediateCount}</p>
              <p className="text-xs text-gray-400 mt-1">Немедленно</p>
            </div>
          </div>

          {/* Вероятность нарушения */}
          <div className="card p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Средняя вероятность нарушения</p>
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
          </div>

          {/* Калькулятор */}
          <div className="card p-5 mb-6 bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-yellow-700" />
              <p className="text-sm font-semibold text-yellow-800">Калькулятор штрафов (1 БВ = {BASE_VALUE_BYN} BYN)</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Минимальный", byn: totalFineMin, color: "text-yellow-700" },
                { label: "Вероятный", byn: Math.round((totalFineMin + totalFineMax) / 2), color: "text-orange-600" },
                { label: "Максимальный", byn: totalFineMax, color: "text-red-600" },
              ].map(({ label, byn, color }) => (
                <div key={label} className="bg-white rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-xl font-black ${color}`}>{Math.round(byn / BASE_VALUE_BYN)} БВ</p>
                  <p className="text-xs text-gray-400">{byn.toLocaleString("ru-RU")} BYN</p>
                </div>
              ))}
            </div>
          </div>

          {/* Детальный список */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Детальный анализ ({readyResults.length})
            </h2>
            {readyResults.map((item) => (
              <div key={item.diffId}>
                <div className="flex items-center gap-3 mb-2 px-1">
                  <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-600">
                    п. {item.sectionPath}
                  </code>
                  <RiskBadge level={item.riskLevel as "HIGH" | "CRITICAL"} size="sm" />
                  {item.oldText && (
                    <p className="text-xs text-gray-500 truncate max-w-sm">
                      {item.oldText.slice(0, 70)}{item.oldText.length > 70 ? "…" : ""}
                    </p>
                  )}
                </div>
                <ProsecutorAlert
                  comparisonId={id!}
                  diffId={item.diffId}
                  analysis={item.prosecutorReport!}
                  compact={false}
                />
              </div>
            ))}
          </div>

          {/* Дисклеймер */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 leading-relaxed">
              ⚠️ Данный анализ носит информационный характер и не является юридической консультацией.
              Оценки штрафов рассчитаны на основе КоАП РБ (БВ = {BASE_VALUE_BYN} BYN).
              Для юридических решений обратитесь к квалифицированному юристу.
            </p>
          </div>
        </>
      )}
    </div>
  );
}