// src/pages/ComparePage.tsx
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, Scale, BarChart3, List } from "lucide-react";
import { useComparison } from "../hooks/useComparison";
import ProgressStepper from "../components/upload/ProgressStepper";
import DiffViewer from "../components/diff/DiffViewer";
import RiskDashboard from "../components/risk/RiskDashboard";
import { useUiStore } from "../store/uiStore";
import { getReportDownloadUrl } from "../api/report";
import type { CompareTab } from "../types";

const RISK_FILTERS = [
  { level: "CRITICAL" as const, label: "Критических", colorClass: "bg-red-100 text-red-700 border-red-200" },
  { level: "HIGH"     as const, label: "Высокий риск", colorClass: "bg-orange-100 text-orange-700 border-orange-200" },
  { level: "MEDIUM"   as const, label: "Средний",      colorClass: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { level: "LOW"      as const, label: "Низкий",       colorClass: "bg-green-100 text-green-700 border-green-200" },
];

// Конфигурация вкладок
const TABS: Array<{ id: CompareTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: "diff",       label: "Изменения",  icon: List },
  { id: "dashboard",  label: "Dashboard",  icon: BarChart3 },
  { id: "prosecutor", label: "⚖️ ПРОКУРОР", icon: Scale },
];

export default function ComparePage() {
  const { id } = useParams<{ id: string }>();
  const { data: comparison, isLoading, isError } = useComparison(id);
  const { filters, setFilter, resetFilters, activeTab, setActiveTab } = useUiStore();

  const isDone = comparison?.status === "DONE";
  const isProcessing = comparison && !isDone && comparison.status !== "ERROR";

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
        <p className="text-red-500 font-medium mb-4">Сравнение не найдено</p>
        <Link to="/upload" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Назад
        </Link>
      </div>
    );
  }

  const criticalHigh = (riskCounts["CRITICAL"] ?? 0) + (riskCounts["HIGH"] ?? 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/upload" className="btn-secondary inline-flex items-center gap-2 py-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Результаты анализа</h1>
            {isDone && (
              <p className="text-sm text-gray-500">
                {comparison.diffResults?.length ?? 0} изменений
                {criticalHigh > 0 && (
                  <span className="ml-2 text-red-600 font-medium">
                    · {criticalHigh} высокого риска
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {isDone && (
          <div className="flex items-center gap-2">
            {criticalHigh > 0 && (
              <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-medium animate-pulse">
                ⚠ {criticalHigh} рисков
              </span>
            )}
            <a
              href={getReportDownloadUrl(id!)}
              className="btn-secondary inline-flex items-center gap-2 text-sm py-1.5"
              download
            >
              <Download className="w-4 h-4" />
              Отчёт .docx
            </a>
          </div>
        )}
      </div>

      {/* ProgressStepper пока обрабатывается */}
      {isProcessing && id && (
        <div className="mb-6">
          <ProgressStepper comparisonId={id} onDone={() => {}} />
        </div>
      )}

      {/* Контент после завершения */}
      {isDone && (
        <>
          {/* Вкладки */}
          <div className="flex gap-1 mb-5 border-b border-gray-200">
            {TABS.map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === tabId
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {label}
                {tabId === "prosecutor" && criticalHigh > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                    {criticalHigh}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Вкладка: Изменения */}
          {activeTab === "diff" && comparison.diffResults && (
            <>
              {/* Быстрые фильтры по риску */}
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
                          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
                          border font-medium transition-all
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
                      Сбросить
                    </button>
                  )}
                </div>
              )}

              {/* Поиск */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="🔍  Поиск по тексту изменений..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilter("searchQuery", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                />
              </div>

              <DiffViewer diffResults={comparison.diffResults} />
            </>
          )}

          {/* Вкладка: Dashboard */}
          {activeTab === "dashboard" && (
            <RiskDashboard comparison={comparison} />
          )}

          {/* Вкладка: ПРОКУРОР */}
          {activeTab === "prosecutor" && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">⚖️</p>
              <p className="text-xl font-bold text-gray-800 mb-2">Модуль ПРОКУРОР</p>
              <p className="text-gray-500 mb-4">
                Прогнозирование штрафов, предписаний и судебных рисков.
              </p>
              <Link
                to={`/compare/${id}/prosecutor`}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Scale className="w-4 h-4" />
                Открыть анализ рисков
              </Link>
              {criticalHigh > 0 && (
                <p className="mt-3 text-sm text-red-600">
                  ⚠ Обнаружено {criticalHigh} изменений высокого риска
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}