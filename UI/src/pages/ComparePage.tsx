// src/pages/ComparePage.tsx
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, Scale, BarChart3, List, LayoutList } from "lucide-react";
import { useComparison } from "../hooks/useComparison";
import ProgressStepper from "../components/upload/ProgressStepper";
import DiffViewer from "../components/diff/DiffViewer";
import RiskDashboard from "../components/risk/RiskDashboard";
import { useUiStore } from "../store/uiStore";
import ChangesTable from "../components/diff/ChangesTable";
import RiskTimeline from "../components/risk/RiskTimeline";
import SidePanel from "../components/diff/SidePanel";
import { useProsecutor } from "../hooks/useProsecutor";
import ProsecutorAlert from "../components/risk/ProsecutorAlert";
import RiskBadge from "../components/risk/RiskBadge";
import type { CompareTab } from "../types";
import { Clock, Loader2 } from "lucide-react";
import DocViewer from "../components/diff/DocViewer";
// DiffViewer оставить — он используется внутри DocViewer как сворачиваемый список

const RISK_FILTERS = [
  { level: "CRITICAL" as const, label: "Критических", colorClass: "bg-red-100 text-red-700 border-red-200" },
  { level: "HIGH"     as const, label: "Высокий риск", colorClass: "bg-orange-100 text-orange-700 border-orange-200" },
  { level: "MEDIUM"   as const, label: "Средний",      colorClass: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { level: "LOW"      as const, label: "Низкий",       colorClass: "bg-green-100 text-green-700 border-green-200" },
];

const TABS: Array<{ id: CompareTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: "diff",       label: "Изменения",   icon: List },
  { id: "table",      label: "Таблица",     icon: LayoutList },
  { id: "dashboard",  label: "Dashboard",   icon: BarChart3 },
  { id: "prosecutor", label: "⚖️ ПРОКУРОР", icon: Scale },
];

export default function ComparePage() {
  const { id } = useParams<{ id: string }>();
  const { data: comparison, isLoading, isError } = useComparison(id);
  const { filters, setFilter, resetFilters, activeTab, setActiveTab, sidePanelOpen } = useUiStore();

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
    <div className={`transition-all duration-200 ${sidePanelOpen ? "mr-[400px]" : ""}`}>
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
              <Link
                to={`/report/${id}`}
                className="btn-secondary inline-flex items-center gap-2 text-sm py-1.5"
              >
                <Download className="w-4 h-4" />
                Отчёт .docx
              </Link>
            </div>
          )}
        </div>

        {/* ProgressStepper пока обрабатывается */}
        {isProcessing && id && (
          <div className="mb-6">
            <ProgressStepper
              comparisonId={id}
              currentStatus={comparison?.status}
              onDone={() => {}}
            />
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

                {/* ✅ ИЗМЕНЕНО: DiffViewer → DocViewer */}
                <DocViewer diffResults={comparison.diffResults} />
              </>
            )}

            {/* Вкладка: Таблица */}
            {activeTab === "table" && comparison.diffResults && (
              <div className="space-y-5">
                <RiskTimeline diffResults={comparison.diffResults} />
                <ChangesTable diffResults={comparison.diffResults} />
              </div>
            )}

            {/* Вкладка: Dashboard */}
            {activeTab === "dashboard" && (
              <RiskDashboard comparison={comparison} />
            )}

            {/* Вкладка: ПРОКУРОР */}
            {activeTab === "prosecutor" && comparison.diffResults && (
              <ProsecutorPreview
                comparisonId={id!}
                diffResults={comparison.diffResults}
              />
            )}

            {/* SidePanel — рендерится поверх всего, нужен на всех вкладках */}
            {comparison.diffResults && (
              <SidePanel diffResults={comparison.diffResults} mode="compare" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── ProsecutorPreview ────────────────────────────────────────────────────────

function ProsecutorPreview({
  comparisonId,
  diffResults,
}: {
  comparisonId: string;
  diffResults: import("../types").DiffResult[];
}) {
  const { data: prosecutorData, isLoading, isFetching } = useProsecutor(comparisonId);

  const results = prosecutorData?.results ?? [];
  const readyResults = results.filter((r) => r.prosecutorReport !== null);
  const isAnalyzing = results.length > 0 && readyResults.length === 0;
  const noHighRisk = !isLoading && results.length === 0;

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="w-6 h-6 border-4 border-red-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-gray-500">Загружаем данные прокурора...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-red-600" />
          <p className="text-sm font-semibold text-gray-800">Прокурорский анализ</p>
          {isFetching && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> обновляется
            </span>
          )}
        </div>
        <Link
          to={`/compare/${comparisonId}/prosecutor`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors"
        >
          <Scale className="w-4 h-4" />
          Открыть ПРОКУРОР
        </Link>
      </div>

      {/* Нет HIGH нарушений */}
      {noHighRisk && (
        <div className="card p-6 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="font-semibold text-gray-700 mb-1">Нарушений высокого риска нет</p>
          <p className="text-sm text-gray-500">Все изменения имеют уровень MEDIUM или LOW.</p>
        </div>
      )}

      {/* Прокурор ещё анализирует */}
      {isAnalyzing && (
        <div className="card p-5 border-l-4 border-l-orange-400">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-orange-500 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Прокурорский анализ выполняется</p>
              <p className="text-xs text-gray-500">
                {results.length} изменений высокого риска • Обычно 1–2 минуты
              </p>
            </div>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-orange-400 rounded-full animate-pulse w-1/3" />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Вы можете переключиться на другие вкладки — результаты появятся автоматически.
          </p>
        </div>
      )}

      {/* Готовые результаты (предпросмотр до 3) */}
      {readyResults.length > 0 && (
        <div className="space-y-3">
          {readyResults.slice(0, 3).map((item) => {
            const diff = diffResults.find((r) => r.id === item.diffId);
            return (
              <div key={item.diffId}>
                {diff && (
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                      п. {diff.sectionPath}
                    </code>
                    {diff.riskLevel && <RiskBadge level={diff.riskLevel} size="sm" />}
                  </div>
                )}
                <ProsecutorAlert
                  comparisonId={comparisonId}
                  diffId={item.diffId}
                  analysis={item.prosecutorReport!}
                  compact={true}
                />
              </div>
            );
          })}
          {results.length > 3 && (
            <p className="text-sm text-gray-500 text-center">
              ...и ещё {results.length - 3} зон риска.{" "}
              <Link to={`/compare/${comparisonId}/prosecutor`} className="text-red-600 underline">
                Открыть полный анализ
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}