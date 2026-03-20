// src/components/diff/DocViewer.tsx
import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, List } from "lucide-react";
import { useUiStore } from "../../store/uiStore";
import { computeWordDiff } from "../../utils/wordDiff";
import DiffBlock from "./DiffBlock";
import type { DiffResult } from "../../types";

interface DocViewerProps {
  diffResults: DiffResult[];
  mode?: "compare" | "compliance" | "audit";
}

// ─── Конфиг подсветки ────────────────────────────────────────────────────────

const CHANGE_CONFIG: Record<string, {
  lineClass: string;        // подсветка всей строки
  markerClass: string;      // левая полоска (бордер)
  badge: { text: string; cls: string };
  textClass: string;        // цвет текста
}> = {
  ADDED: {
    lineClass: "bg-green-50",
    markerClass: "border-l-4 border-l-green-500",
    badge: { text: "+ добавлен", cls: "bg-green-100 text-green-700" },
    textClass: "text-green-900",
  },
  DELETED: {
    lineClass: "bg-red-50",
    markerClass: "border-l-4 border-l-red-400",
    badge: { text: "– удалён", cls: "bg-red-100 text-red-700" },
    textClass: "text-red-800 line-through opacity-60",
  },
  MODIFIED: {
    lineClass: "bg-yellow-50",
    markerClass: "border-l-4 border-l-yellow-400",
    badge: { text: "~ изменён", cls: "bg-yellow-100 text-yellow-700" },
    textClass: "text-gray-800",
  },
  MOVED: {
    lineClass: "bg-blue-50",
    markerClass: "border-l-4 border-l-blue-400",
    badge: { text: "↕ перемещён", cls: "bg-blue-100 text-blue-700" },
    textClass: "text-blue-900",
  },
  COMPLIANCE_VIOLATION: {
    lineClass: "bg-red-50",
    markerClass: "border-l-4 border-l-red-600",
    badge: { text: "⚠ нарушение", cls: "bg-red-100 text-red-800" },
    textClass: "text-gray-800",
  },
  COMPLIANCE_WARNING: {
    lineClass: "bg-orange-50",
    markerClass: "border-l-4 border-l-orange-400",
    badge: { text: "! предупреждение", cls: "bg-orange-100 text-orange-700" },
    textClass: "text-gray-800",
  },
  COMPLIANT: {
    lineClass: "bg-white",
    markerClass: "border-l-4 border-l-green-300",
    badge: { text: "✓ ок", cls: "bg-green-50 text-green-600" },
    textClass: "text-gray-700",
  },
  AUDIT_ISSUE: {
    lineClass: "bg-red-50",
    markerClass: "border-l-4 border-l-red-600",
    badge: { text: "⚠ нарушение", cls: "bg-red-100 text-red-800" },
    textClass: "text-gray-800",
  },
  AUDIT_OK: {
    lineClass: "bg-white",
    markerClass: "border-l-4 border-l-gray-200",
    badge: { text: "✓ ок", cls: "bg-gray-100 text-gray-500" },
    textClass: "text-gray-600",
  },
};

// ─── Inline word diff (для MODIFIED) ─────────────────────────────────────────

function InlineWordDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const chunks = useMemo(() => computeWordDiff(oldText, newText), [oldText, newText]);
  return (
    <span>
      {chunks.map((chunk, i) => {
        if (chunk.tag === "equal")
          return <span key={i}>{chunk.newWords.join(" ")} </span>;
        if (chunk.tag === "delete")
          return (
            <span key={i} className="line-through text-red-500 bg-red-100 rounded px-0.5 mx-0.5">
              {chunk.oldWords.join(" ")}
            </span>
          );
        if (chunk.tag === "insert")
          return (
            <span key={i} className="text-green-700 bg-green-100 rounded px-0.5 mx-0.5 font-medium">
              {chunk.newWords.join(" ")}
            </span>
          );
        if (chunk.tag === "replace")
          return (
            <span key={i}>
              <span className="line-through text-red-500 bg-red-100 rounded px-0.5 mx-0.5">
                {chunk.oldWords.join(" ")}
              </span>{" "}
              <span className="text-green-700 bg-green-100 rounded px-0.5 mx-0.5 font-medium">
                {chunk.newWords.join(" ")}
              </span>
            </span>
          );
        return null;
      })}
    </span>
  );
}

// ─── Определить тип параграфа по section_path ─────────────────────────────────

function getHeadingLevel(sectionPath: string): number {
  // "1" → H1, "1.1" → H2, "1.1.1" → H3, "1.1.p1" → paragraph
  const parts = sectionPath.split(".");
  if (parts.length === 1 && !/p\d/.test(parts[0])) return 1;
  if (parts.length === 2 && !/p\d/.test(parts[1])) return 2;
  if (parts.length === 3 && !/p\d/.test(parts[2])) return 3;
  return 0; // обычный параграф
}

function getHeadingClass(level: number): string {
  if (level === 1) return "text-base font-bold text-gray-900 tracking-tight";
  if (level === 2) return "text-sm font-semibold text-gray-800";
  if (level === 3) return "text-sm font-medium text-gray-700";
  return "text-sm text-gray-800 leading-relaxed";
}

function getIndentClass(level: number): string {
  if (level === 0) return "pl-6";
  if (level === 1) return "pl-0";
  if (level === 2) return "pl-4";
  return "pl-8";
}

// ─── Параграф документа ──────────────────────────────────────────────────────

interface DocParaProps {
  result: DiffResult;
  isSelected: boolean;
  onHover: () => void;
  onClick: () => void;
}

function DocParagraph({ result, isSelected, onHover, onClick }: DocParaProps) {
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cfg = (result.changeType in CHANGE_CONFIG
    ? CHANGE_CONFIG[result.changeType as keyof typeof CHANGE_CONFIG]
    : undefined) ?? CHANGE_CONFIG.MODIFIED;

  const headingLevel = getHeadingLevel(result.sectionPath);
  const textClass = headingLevel > 0
    ? getHeadingClass(headingLevel)
    : cfg.textClass + " " + getHeadingClass(0);
  const indent = getIndentClass(headingLevel);

  const text = result.newText ?? result.oldText ?? "";

  return (
    <div
      className={`
        group relative ${cfg.markerClass} ${cfg.lineClass}
        ${indent} py-2 pr-3 cursor-pointer
        transition-all duration-100
        ${isSelected ? "ring-2 ring-inset ring-primary-400 ring-opacity-50" : "hover:brightness-95"}
      `}
      onMouseEnter={() => {
        hoverTimer.current = setTimeout(onHover, 300);
      }}
      onMouseLeave={() => clearTimeout(hoverTimer.current)}
      onClick={onClick}
    >
      {/* Бейдж типа изменения — только при наведении или выборе */}
      <span
        className={`
          absolute right-2 top-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium
          opacity-0 group-hover:opacity-100 transition-opacity
          ${isSelected ? "opacity-100" : ""}
          ${cfg.badge.cls}
        `}
      >
        {cfg.badge.text}
      </span>

      {/* Номер раздела (маленький, серый) */}
      <span className="text-[10px] text-gray-300 font-mono mr-2 select-none">
        {result.sectionPath}
      </span>

      {/* Текст */}
      <span className={textClass}>
        {result.changeType === "MODIFIED" && result.oldText && result.newText ? (
          <InlineWordDiff oldText={result.oldText} newText={result.newText} />
        ) : result.changeType === "DELETED" ? (
          <span className="line-through opacity-60">{result.oldText}</span>
        ) : (
          text
        )}
      </span>

      {/* Бейдж риска */}
      {result.riskLevel && result.riskLevel !== "LOW" && (
        <span
          className={`
            ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-semibold
            ${result.riskLevel === "CRITICAL" ? "bg-red-200 text-red-900"
              : result.riskLevel === "HIGH" ? "bg-orange-200 text-orange-900"
              : "bg-yellow-200 text-yellow-900"}
          `}
        >
          {result.riskLevel}
        </span>
      )}
    </div>
  );
}

// ─── Главный компонент DocViewer ──────────────────────────────────────────────

export default function DocViewer({ diffResults, mode = "compare" }: DocViewerProps) {
  const { selectedDiffId, openSidePanel, filters } = useUiStore();
  const [listExpanded, setListExpanded] = useState(false);
  const [showAllSections, setShowAllSections] = useState(false);

  // Фильтрация
  const filtered = diffResults.filter((r) => {
    if (filters.riskLevels.length > 0 && r.riskLevel && !filters.riskLevels.includes(r.riskLevel))
      return false;
    if (filters.changeTypes.length > 0 && !filters.changeTypes.includes(r.changeType as any))
      return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      if (
        !r.oldText?.toLowerCase().includes(q) &&
        !r.newText?.toLowerCase().includes(q) &&
        !r.sectionPath.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  // Для compliance/audit — скрываем OK-разделы по умолчанию
  // Важно: не фильтруем по riskLevel !== LOW, иначе пропадают нарушения с LOW риском
  const isComplianceMode = mode === "compliance" || mode === "audit";
  const displayResults =
    isComplianceMode && !showAllSections
      ? filtered.filter(
          (r) => r.changeType !== "AUDIT_OK" && r.changeType !== "COMPLIANT"
        )
      : filtered;

  const hiddenOkCount =
    isComplianceMode && !showAllSections
      ? filtered.length - displayResults.length
      : 0;

  if (diffResults.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">🎉</p>
        <p className="font-semibold text-gray-600">Изменений не найдено</p>
        <p className="text-sm mt-1">Документы идентичны</p>
      </div>
    );
  }

  if (displayResults.length === 0 && hiddenOkCount === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <p className="text-2xl mb-2">🔍</p>
        <p className="font-medium text-gray-600">Нет изменений по фильтру</p>
        <p className="text-sm mt-1">Попробуй изменить критерии фильтрации</p>
      </div>
    );
  }

  return (
    <div>
      {/* Шапка счётчика + кнопка скрытых разделов */}
      <div className="flex items-center justify-between mb-3 text-sm text-gray-500">
        <span>
          Показано <strong className="text-gray-800">{displayResults.length}</strong> из{" "}
          <strong className="text-gray-800">{diffResults.length}</strong>{" "}
          {isComplianceMode ? "разделов" : "изменений"}
        </span>
        {isComplianceMode && hiddenOkCount > 0 && (
          <button
            onClick={() => setShowAllSections(true)}
            className="text-xs text-green-600 hover:text-green-800 font-medium underline"
          >
            ✅ + {hiddenOkCount} без нарушений
          </button>
        )}
        {isComplianceMode && showAllSections && (
          <button
            onClick={() => setShowAllSections(false)}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium underline"
          >
            Скрыть без нарушений
          </button>
        )}
      </div>

      {/* ── ДОКУМЕНТ — Word-like отображение ─────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Заголовок «документа» */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-400" />
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-gray-400 ml-2">Документ с изменениями</span>
          <div className="ml-auto flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-200 border-l-2 border-green-500" />
              добавлено
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-200 border-l-2 border-yellow-400" />
              изменено
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-200 border-l-2 border-red-400" />
              удалено / нарушение
            </span>
          </div>
        </div>

        {/* Страница документа */}
        <div className="divide-y divide-gray-100">
          {displayResults.map((result, idx) => {
            // Разделитель между несмежными секциями
            const prev = displayResults[idx - 1];
            const showDivider =
              prev &&
              !result.sectionPath.startsWith(prev.sectionPath.split(".")[0]);

            return (
              <div key={result.id}>
                {showDivider && (
                  <div className="px-6 py-1 text-center text-[10px] text-gray-300 select-none">
                    · · ·
                  </div>
                )}
                <DocParagraph
                  result={result}
                  isSelected={selectedDiffId === result.id}
                  onHover={() => openSidePanel(result.id)}
                  onClick={() => openSidePanel(result.id)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Сворачиваемый список карточек ──────────────────────────────── */}
      <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setListExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-600"
        >
          <div className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Список изменений ({displayResults.length})
          </div>
          {listExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {listExpanded && (
          <div className="p-4 space-y-3">
            {displayResults.map((r) => (
              <DiffBlock
                key={r.id}
                result={r}
                isSelected={selectedDiffId === r.id}
                onClick={() => openSidePanel(r.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}