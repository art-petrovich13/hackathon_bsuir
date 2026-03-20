// src/components/diff/SidePanel.tsx
import { X, ExternalLink, ChevronRight, BookOpen, AlertTriangle, Shield, Search } from "lucide-react";
import { useUiStore } from "../../store/uiStore";
import RiskBadge from "../risk/RiskBadge";
import type { DiffResult } from "../../types";

type PanelMode = "compare" | "compliance" | "audit";

interface SidePanelProps {
  diffResults: DiffResult[];
  /** Режим отображения:
   * compare   = стандартный (Режимы 1 и 2) — показывает "Было/Стало"
   * compliance = Режим 3 — показывает нарушение родительскому НПА
   * audit     = Режим 4 — показывает нарушение госзаконодательству
   */
  mode?: PanelMode;
}

// Метки для стандартных типов изменений (Режимы 1 и 2)
const CHANGE_TYPE_LABELS: Record<string, string> = {
  ADDED:    "Добавлен новый пункт",
  DELETED:  "Пункт удалён",
  MODIFIED: "Пункт изменён",
  MOVED:    "Пункт перемещён",
};

// Метки для режимов 3 и 4
const COMPLIANCE_LABELS: Record<string, { label: string; color: string }> = {
  COMPLIANCE_VIOLATION: { label: "Нарушение",         color: "text-red-700" },
  COMPLIANCE_WARNING:   { label: "Предупреждение",    color: "text-orange-700" },
  COMPLIANT:            { label: "Соответствует",     color: "text-green-700" },
  AUDIT_ISSUE:          { label: "Нарушение найдено", color: "text-red-700" },
  AUDIT_OK:             { label: "Нарушений нет",     color: "text-green-700" },
};

// Семантические типы — только для сравнения
const SEMANTIC_LABELS: Record<string, { label: string; description: string }> = {
  OBLIGATION_CHANGE: { label: "Изменение обязательности", description: "Изменился характер нормы — право стало обязанностью или наоборот" },
  SCOPE_CHANGE:      { label: "Область применения",       description: "Изменился круг лиц или случаев, к которым применяется норма" },
  DEADLINE_CHANGE:   { label: "Изменение сроков",         description: "Изменились установленные сроки выполнения или уведомления" },
  SUBJECT_CHANGE:    { label: "Изменение субъекта",       description: "Изменился субъект, на которого распространяется действие нормы" },
  SANCTION_CHANGE:   { label: "Изменение ответственности", description: "Изменились санкции или меры ответственности" },
  COSMETIC:          { label: "Косметическое изменение",  description: "Стилистические правки без изменения смысла нормы" },
};

export default function SidePanel({ diffResults, mode = "compare" }: SidePanelProps) {
  const { sidePanelOpen, selectedDiffId, closeSidePanel, openSidePanel } = useUiStore();

  if (!sidePanelOpen || !selectedDiffId) return null;

  const result = diffResults.find((r) => r.id === selectedDiffId);
  if (!result) return null;

  const currentIndex = diffResults.findIndex((r) => r.id === selectedDiffId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < diffResults.length - 1;

  const semanticInfo = result.semanticType ? SEMANTIC_LABELS[result.semanticType] : null;
  const complianceInfo = COMPLIANCE_LABELS[result.changeType];

  // Заголовок и иконка зависят от режима
  const panelTitle =
    mode === "compliance" ? "Проверка соответствия" :
    mode === "audit"      ? "Аудит раздела" :
    "Детали изменения";

  const TitleIcon =
    mode === "compliance" ? Shield :
    mode === "audit"      ? Search :
    BookOpen;

  const headerBg =
    mode === "compliance" ? "bg-purple-50 border-purple-200" :
    mode === "audit"      ? "bg-blue-50 border-blue-200" :
    "bg-gray-50 border-gray-200";

  // Является ли это нарушением (для compliance/audit)
  const isViolation = result.changeType === "COMPLIANCE_VIOLATION" || result.changeType === "AUDIT_ISSUE";
  const isWarning   = result.changeType === "COMPLIANCE_WARNING";
  const isOk        = result.changeType === "COMPLIANT" || result.changeType === "AUDIT_OK";

  return (
    <>
      {/* Затемнение — только на мобильном */}
      <div
        className="fixed inset-0 bg-black/30 z-30 md:hidden"
        onClick={closeSidePanel}
      />

      {/* Панель */}
      <div className="fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-40 flex flex-col overflow-hidden border-l border-gray-200 transition-transform duration-200">

        {/* Шапка */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${headerBg}`}>
          <div className="flex items-center gap-2">
            <TitleIcon className={`w-4 h-4 ${
              mode === "compliance" ? "text-purple-600" :
              mode === "audit"      ? "text-blue-600" :
              "text-gray-500"
            }`} />
            <div>
              <p className="text-xs text-gray-500 font-medium">{panelTitle}</p>
              <p className="font-bold text-gray-900">п. {result.sectionPath}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => hasPrev && openSidePanel(diffResults[currentIndex - 1].id)}
              disabled={!hasPrev}
              className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Предыдущий"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <span className="text-xs text-gray-400 px-1">{currentIndex + 1} / {diffResults.length}</span>
            <button
              onClick={() => hasNext && openSidePanel(diffResults[currentIndex + 1].id)}
              disabled={!hasNext}
              className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Следующий"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={closeSidePanel} className="ml-2 p-1.5 rounded hover:bg-gray-200 transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── БЛОК 1: Статус / тип ─────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Для сравнения — тип изменения */}
            {mode === "compare" && (
              <span className="text-sm text-gray-700 font-medium">
                {CHANGE_TYPE_LABELS[result.changeType] ?? result.changeType}
              </span>
            )}
            {/* Для compliance/audit — статус нарушения */}
            {(mode === "compliance" || mode === "audit") && complianceInfo && (
              <span className={`text-sm font-semibold ${complianceInfo.color}`}>
                {complianceInfo.label}
              </span>
            )}
            {result.riskLevel && <RiskBadge level={result.riskLevel} size="md" />}
          </div>

          {/* ── БЛОК 2: Семантический тип (только для compare) ────────── */}
          {mode === "compare" && semanticInfo && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-800 mb-1">{semanticInfo.label}</p>
              <p className="text-xs text-blue-700">{semanticInfo.description}</p>
            </div>
          )}

          {/* ── БЛОК 3: Было / Стало (только для compare) ─────────────── */}
          {mode === "compare" && (result.oldText || result.newText) && (
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

          {/* ── БЛОК 4: Текст раздела (для compliance и audit) ─────────── */}
          {(mode === "compliance" || mode === "audit") && result.newText && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Текст раздела:</p>
              <p className={`text-sm text-gray-800 p-3 rounded-lg leading-relaxed border ${
                isViolation ? "bg-red-50 border-red-100" :
                isWarning   ? "bg-orange-50 border-orange-100" :
                "bg-gray-50 border-gray-100"
              }`}>
                {result.newText}
              </p>
            </div>
          )}

          {/* ── БЛОК 5: Нарушенная норма (для compliance и audit) ──────── */}
          {(mode === "compliance" || mode === "audit") && result.lawReference && (
            <div className={`p-3 rounded-lg border ${
              isViolation ? "bg-red-50 border-red-200" :
              isWarning   ? "bg-orange-50 border-orange-200" :
              "bg-indigo-50 border-indigo-100"
            }`}>
              <div className="flex items-center gap-1.5 mb-2">
                <ExternalLink className={`w-3.5 h-3.5 ${isViolation ? "text-red-500" : isWarning ? "text-orange-500" : "text-indigo-500"}`} />
                <p className={`text-xs font-semibold uppercase tracking-wide ${
                  isViolation ? "text-red-700" : isWarning ? "text-orange-700" : "text-indigo-700"
                }`}>
                  {isViolation || isWarning ? "Нарушаемая норма" : "Применимая норма"}
                </p>
              </div>
              <p className={`text-sm font-medium ${
                isViolation ? "text-red-800" : isWarning ? "text-orange-800" : "text-indigo-800"
              }`}>
                {result.lawReference}
              </p>
            </div>
          )}

          {/* ── БЛОК 6: Нормативная база (для compare) ─────────────────── */}
          {mode === "compare" && result.lawReference && (
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-1.5 mb-2">
                <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Нормативная база</p>
              </div>
              <p className="text-sm text-indigo-800 font-medium">{result.lawReference}</p>
            </div>
          )}

          {/* ── БЛОК 7: Рекомендация ────────────────────────────────────── */}
          {result.recommendation && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {isViolation ? "Как исправить" : "Рекомендация"}
                </p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{result.recommendation}</p>
            </div>
          )}

          {/* ── БЛОК 8: Уверенность AI ─────────────────────────────────── */}
          {result.aiConfidence !== null && result.aiConfidence !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">Уверенность AI</p>
                <p className={`text-xs font-semibold ${
                  result.aiConfidence >= 0.7 ? "text-green-600" :
                  result.aiConfidence >= 0.5 ? "text-yellow-600" : "text-red-600"
                }`}>{Math.round(result.aiConfidence * 100)}%</p>
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
                  <AlertTriangle className="w-3 h-3" /> Рекомендуется ручная проверка
                </p>
              )}
            </div>
          )}
        </div>

        {/* Футер */}
        {mode === "compare" && (result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL") && (
          <div className="px-5 py-3 border-t border-gray-200 bg-red-50">
            <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
              ⚖️ Высокий риск — откройте страницу ПРОКУРОР для анализа последствий
            </p>
          </div>
        )}

        {(mode === "compliance" || mode === "audit") && isViolation && (
          <div className="px-5 py-3 border-t border-red-200 bg-red-50">
            <p className="text-xs text-red-700 font-medium">
              ⚠️ Требует исправления — следуйте рекомендации выше
            </p>
          </div>
        )}

        {(mode === "compliance" || mode === "audit") && isOk && (
          <div className="px-5 py-3 border-t border-green-200 bg-green-50">
            <p className="text-xs text-green-700 font-medium flex items-center gap-1.5">
              ✅ Раздел соответствует требованиям
            </p>
          </div>
        )}
      </div>
    </>
  );
}