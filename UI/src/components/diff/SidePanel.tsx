// src/components/diff/SidePanel.tsx
import { X, ExternalLink, ChevronRight, BookOpen, AlertTriangle } from "lucide-react";
import { useUiStore } from "../../store/uiStore";
import RiskBadge from "../risk/RiskBadge";
import type { DiffResult } from "../../types";

interface SidePanelProps {
  diffResults: DiffResult[];
}

const SEMANTIC_LABELS: Record<string, { label: string; description: string }> = {
  OBLIGATION_CHANGE: { label: "Изменение обязательности", description: "Изменился характер нормы — право стало обязанностью или наоборот" },
  SCOPE_CHANGE:      { label: "Область применения",       description: "Изменился круг лиц или случаев, к которым применяется норма" },
  DEADLINE_CHANGE:   { label: "Изменение сроков",         description: "Изменились установленные сроки выполнения или уведомления" },
  SUBJECT_CHANGE:    { label: "Изменение субъекта",       description: "Изменился субъект, на которого распространяется действие нормы" },
  SANCTION_CHANGE:   { label: "Изменение ответственности", description: "Изменились санкции или меры ответственности" },
  COSMETIC:          { label: "Косметическое изменение",  description: "Стилистические правки без изменения смысла нормы" },
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  ADDED:    "Добавлен новый пункт",
  DELETED:  "Пункт удалён",
  MODIFIED: "Пункт изменён",
  MOVED:    "Пункт перемещён",
};

export default function SidePanel({ diffResults }: SidePanelProps) {
  const { sidePanelOpen, selectedDiffId, closeSidePanel, openSidePanel } = useUiStore();

  if (!sidePanelOpen || !selectedDiffId) return null;

  const result = diffResults.find((r) => r.id === selectedDiffId);
  if (!result) return null;

  const currentIndex = diffResults.findIndex((r) => r.id === selectedDiffId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < diffResults.length - 1;

  const semanticInfo = result.semanticType ? SEMANTIC_LABELS[result.semanticType] : null;

  return (
    <>
      {/* Затемнение фона (только на мобильном) */}
      <div
        className="fixed inset-0 bg-black/20 z-30 md:hidden"
        onClick={closeSidePanel}
      />

      {/* Боковая панель */}
      <div className="fixed top-0 right-0 h-full w-full md:w-[420px] bg-white shadow-2xl z-40 flex flex-col overflow-hidden border-l border-gray-200">
        {/* Шапка панели */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <p className="text-xs text-gray-500 font-medium">Детали изменения</p>
            <p className="font-bold text-gray-900">п. {result.sectionPath}</p>
          </div>
          <div className="flex items-center gap-1">
            {/* Навигация между изменениями */}
            <button
              onClick={() => hasPrev && openSidePanel(diffResults[currentIndex - 1].id)}
              disabled={!hasPrev}
              className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Предыдущее изменение"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <span className="text-xs text-gray-400 px-1">
              {currentIndex + 1} / {diffResults.length}
            </span>
            <button
              onClick={() => hasNext && openSidePanel(diffResults[currentIndex + 1].id)}
              disabled={!hasNext}
              className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Следующее изменение"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={closeSidePanel}
              className="ml-2 p-1.5 rounded hover:bg-gray-200 transition-colors"
              title="Закрыть"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Контент — прокручиваемый */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Тип изменения + Risk Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-700 font-medium">
              {CHANGE_TYPE_LABELS[result.changeType] ?? result.changeType}
            </span>
            {result.riskLevel && <RiskBadge level={result.riskLevel} size="md" />}
          </div>

          {/* Семантический тип */}
          {semanticInfo && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-800 mb-1">{semanticInfo.label}</p>
              <p className="text-xs text-blue-700">{semanticInfo.description}</p>
            </div>
          )}

          {/* Тексты */}
          {(result.oldText || result.newText) && (
            <div className="space-y-2">
              {result.oldText && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Было:</p>
                  <p className="text-sm text-gray-800 bg-red-50 p-3 rounded-lg leading-relaxed border border-red-100">
                    {result.oldText}
                  </p>
                </div>
              )}
              {result.newText && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Стало:</p>
                  <p className="text-sm text-gray-800 bg-green-50 p-3 rounded-lg leading-relaxed border border-green-100">
                    {result.newText}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* AI Объяснение */}
          {result.recommendation && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Рекомендация</p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{result.recommendation}</p>
            </div>
          )}

          {/* Ссылка на НПА */}
          {result.lawReference && (
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-1.5 mb-2">
                <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Нормативная база</p>
              </div>
              <p className="text-sm text-indigo-800 font-medium">{result.lawReference}</p>
            </div>
          )}

          {/* Уверенность AI */}
          {result.aiConfidence !== null && result.aiConfidence !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">Уверенность AI</p>
                <p className={`text-xs font-semibold ${
                  result.aiConfidence >= 0.7 ? "text-green-600" :
                  result.aiConfidence >= 0.5 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {Math.round(result.aiConfidence * 100)}%
                </p>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    result.aiConfidence >= 0.7 ? "bg-green-500" :
                    result.aiConfidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${result.aiConfidence * 100}%` }}
                />
              </div>
              {result.aiConfidence < 0.5 && (
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Рекомендуется ручная проверка
                </p>
              )}
            </div>
          )}
        </div>

        {/* Футер с кнопкой ПРОКУРОР (для HIGH/CRITICAL) */}
        {(result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL") && (
          <div className="px-5 py-3 border-t border-gray-200 bg-red-50">
            <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
              ⚖️ Высокий риск — откройте страницу ПРОКУРОР для полного анализа последствий
            </p>
          </div>
        )}
      </div>
    </>
  );
}