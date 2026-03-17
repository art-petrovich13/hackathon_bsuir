// src/pages/ComparePage.tsx
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, Scale } from "lucide-react";
import { useComparison } from "../hooks/useComparison";
import ProgressStepper from "../components/upload/ProgressStepper";
import DiffViewer from "../components/diff/DiffViewer";
import { useUiStore } from "../store/uiStore";
import { getReportDownloadUrl } from "../api/report";

// Быстрые фильтры сверху страницы
const RISK_FILTERS = [
  { level: "CRITICAL" as const, label: "Критических", colorClass: "bg-red-100 text-red-700 border-red-200" },
  { level: "HIGH"     as const, label: "Высокий риск", colorClass: "bg-orange-100 text-orange-700 border-orange-200" },
  { level: "MEDIUM"   as const, label: "Средний",      colorClass: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { level: "LOW"      as const, label: "Низкий",       colorClass: "bg-green-100 text-green-700 border-green-200" },
];

export default function ComparePage() {
  const { id } = useParams<{ id: string }>();
  const { data: comparison, isLoading, isError } = useComparison(id);
  const { filters, setFilter, resetFilters } = useUiStore();

  const isDone = comparison?.status === "DONE";
  const isProcessing = comparison && !isDone && comparison.status !== "ERROR";

  // Считаем изменения по уровням риска
  const riskCounts = comparison?.diffResults?.reduce((acc, r) => {
    if (r.riskLevel) acc[r.riskLevel] = (acc[r.riskLevel] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  const toggleRiskFilter = (level: typeof RISK_FILTERS[number]["level"]) => {
    const current = filters.riskLevels;
    const next = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    setFilter("riskLevels", next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !comparison) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500 font-medium">Сравнение не найдено</p>
        <Link to="/upload" className="btn-secondary mt-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Назад
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Шапка страницы */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/upload" className="btn-secondary inline-flex items-center gap-2 py-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Результаты анализа</h1>
            {isDone && (
              <p className="text-sm text-gray-500">
                Найдено {comparison.diffResults?.length ?? 0} изменений
              </p>
            )}
          </div>
        </div>

        {/* Кнопки действий */}
        {isDone && (
          <div className="flex items-center gap-2">
            <Link
              to={`/compare/${id}/prosecutor`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg text-sm border border-red-200 transition-colors"
            >
              <Scale className="w-4 h-4" />
              ПРОКУРОР
            </Link>
            <a
              href={getReportDownloadUrl(id!)}
              className="btn-secondary inline-flex items-center gap-2 text-sm py-2"
              download
            >
              <Download className="w-4 h-4" />
              Отчёт .docx
            </a>
          </div>
        )}
      </div>

      {/* Прогресс если идёт обработка */}
      {isProcessing && id && (
        <div className="mb-6">
          <ProgressStepper comparisonId={id} onDone={() => {}} />
        </div>
      )}

      {/* Контент после завершения */}
      {isDone && comparison.diffResults && (
        <>
          {/* Сводка по рискам */}
          {Object.values(riskCounts).some((v) => v > 0) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {RISK_FILTERS.map(({ level, label, colorClass }) => {
                const count = riskCounts[level] ?? 0;
                if (count === 0) return null;
                const isActive = filters.riskLevels.includes(level);
                return (
                  <button
                    key={level}
                    onClick={() => toggleRiskFilter(level)}
                    className={`
                      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border
                      font-medium transition-all
                      ${colorClass}
                      ${isActive ? "ring-2 ring-offset-1 ring-gray-400" : "opacity-80 hover:opacity-100"}
                    `}
                  >
                    {count} {label}
                  </button>
                );
              })}
              {filters.riskLevels.length > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 underline"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          )}

          {/* Поиск по тексту */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍  Поиск по тексту изменений..."
              value={filters.searchQuery}
              onChange={(e) => setFilter("searchQuery", e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          {/* Список изменений */}
          <DiffViewer diffResults={comparison.diffResults} />
        </>
      )}
    </div>
  );
}