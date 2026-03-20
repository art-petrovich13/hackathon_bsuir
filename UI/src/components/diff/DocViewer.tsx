// src/components/diff/DocViewer.tsx
import { useState, useRef } from "react";
import { ChevronDown, ChevronUp, List } from "lucide-react";
import { useUiStore } from "../../store/uiStore";
import { computeWordDiff } from "../../utils/wordDiff";
import DiffBlock from "./DiffBlock";
import type { DiffResult } from "../../types";

interface DocViewerProps {
  diffResults: DiffResult[];
  mode?: "compare" | "compliance" | "audit";
}

const CHANGE_CONFIG = {
  ADDED: {
    bgClass: "bg-green-50 border-l-4 border-l-green-500 hover:bg-green-100",
    badge: { text: "+ новый", cls: "bg-green-100 text-green-700" },
  },
  DELETED: {
    bgClass: "bg-red-50 border-l-4 border-l-red-500 hover:bg-red-100",
    badge: { text: "– удалён", cls: "bg-red-100 text-red-700" },
  },
  MODIFIED: {
    bgClass: "bg-yellow-50 border-l-4 border-l-yellow-500 hover:bg-yellow-100",
    badge: { text: "~ изменён", cls: "bg-yellow-100 text-yellow-700" },
  },
  MOVED: {
    bgClass: "bg-blue-50 border-l-4 border-l-blue-500 hover:bg-blue-100",
    badge: { text: "↕ перемещён", cls: "bg-blue-100 text-blue-700" },
  },
  COMPLIANCE_VIOLATION: {
    bgClass: "bg-red-50 border-l-4 border-l-red-600 hover:bg-red-100",
    badge: { text: "⚠ нарушение", cls: "bg-red-100 text-red-800" },
  },
  COMPLIANCE_WARNING: {
    bgClass: "bg-orange-50 border-l-4 border-l-orange-500 hover:bg-orange-100",
    badge: { text: "! предупреждение", cls: "bg-orange-100 text-orange-700" },
  },
  COMPLIANT: {
    bgClass: "bg-green-50 border-l-4 border-l-green-400 hover:bg-green-100",
    badge: { text: "✓ соответствует", cls: "bg-green-100 text-green-700" },
  },
  AUDIT_ISSUE: {
    bgClass: "bg-red-50 border-l-4 border-l-red-600 hover:bg-red-100",
    badge: { text: "⚠ нарушение", cls: "bg-red-100 text-red-800" },
  },
  AUDIT_OK: {
    bgClass: "bg-gray-50 border-l-4 border-l-gray-300 hover:bg-gray-100",
    badge: { text: "✓ ок", cls: "bg-gray-100 text-gray-600" },
  },
} as const;

// ─── InlineWordDiff ───────────────────────────────────────────────────────────

function InlineWordDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const chunks = computeWordDiff(oldText, newText);
  return (
    <span className="text-sm leading-relaxed text-gray-800">
      {chunks.map((chunk, idx) => {
        if (chunk.tag === "equal")
          return <span key={idx}>{chunk.newWords.join(" ")} </span>;
        if (chunk.tag === "delete")
          return (
            <span key={idx} className="line-through text-red-600 bg-red-100 px-0.5 rounded mx-0.5">
              {chunk.oldWords.join(" ")}
            </span>
          );
        if (chunk.tag === "insert")
          return (
            <span key={idx} className="underline text-green-700 bg-green-100 px-0.5 rounded mx-0.5">
              {chunk.newWords.join(" ")}
            </span>
          );
        if (chunk.tag === "replace")
          return (
            <span key={idx}>
              <span className="line-through text-red-600 bg-red-100 px-0.5 rounded mx-0.5">
                {chunk.oldWords.join(" ")}
              </span>{" "}
              <span className="underline text-green-700 bg-green-100 px-0.5 rounded mx-0.5">
                {chunk.newWords.join(" ")}
              </span>
            </span>
          );
        return null;
      })}
    </span>
  );
}

// ─── DocParagraph ─────────────────────────────────────────────────────────────

interface DocParagraphProps {
  result: DiffResult;
  isSelected: boolean;
  onHover: () => void;
  onClick: () => void;
}

// Цвет фона страницы — используется для concave-уголков
const PAGE_BG = "rgb(240, 237, 252)";

function DocParagraph({ result, isSelected, onHover, onClick }: DocParagraphProps) {
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => onHover(), 350);
  };
  const handleMouseLeave = () => clearTimeout(hoverTimerRef.current);

  const config =
    (result.changeType in CHANGE_CONFIG
      ? CHANGE_CONFIG[result.changeType as keyof typeof CHANGE_CONFIG]
      : undefined) ?? CHANGE_CONFIG.MODIFIED;

  if (isSelected) {
    return (
      // Обёртка нужна чтобы concave-уголки не перекрывали соседей
      <div className="relative" style={{ zIndex: 2, marginRight: "-1rem" }}>

        {/* Верхний вогнутый угол */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -14,
            right: 0,
            width: 14,
            height: 14,
            background: "transparent",
            borderBottomRightRadius: 10,
            // box-shadow рисует цвет СТРАНИЦЫ поверх фиолетового — создаёт вогнутость
            boxShadow: `4px 4px 0 4px ${PAGE_BG}`,
            pointerEvents: "none",
            zIndex: 3,
          }}
        />

        {/* Нижний вогнутый угол */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: -14,
            right: 0,
            width: 14,
            height: 14,
            background: "transparent",
            borderTopRightRadius: 10,
            boxShadow: `4px -4px 0 4px ${PAGE_BG}`,
            pointerEvents: "none",
            zIndex: 3,
          }}
        />

        {/* Сама строка */}
        <div
          className="px-4 py-3 cursor-pointer transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)",
            borderRadius: "10px 0 0 10px",
            boxShadow: "0 4px 20px rgba(109, 40, 217, 0.35)",
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={onClick}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <code className="text-xs text-violet-200 font-mono">п. {result.sectionPath}</code>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-white/20 text-white border border-white/30">
              {config.badge.text}
            </span>
            {result.riskLevel && result.riskLevel !== "LOW" && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-white/20 text-white border border-white/25">
                {result.riskLevel}
              </span>
            )}
            <span className="ml-auto text-xs text-violet-300 italic">открыто →</span>
          </div>

          {result.changeType === "MODIFIED" && result.oldText && result.newText ? (
            <InlineWordDiff oldText={result.oldText} newText={result.newText} />
          ) : result.changeType === "DELETED" ? (
            <span className="text-sm leading-relaxed text-white/80 line-through">
              {result.oldText}
            </span>
          ) : (
            <span className="text-sm leading-relaxed text-white">
              {result.newText ?? result.oldText ?? "—"}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Обычное (не выбранное) состояние — без изменений
  return (
    <div
      className={`px-4 py-3 rounded-r-lg cursor-pointer transition-all duration-150 ${config.bgClass}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <code className="text-xs text-gray-400 font-mono">п. {result.sectionPath}</code>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${config.badge.cls}`}>
          {config.badge.text}
        </span>
        {result.riskLevel && result.riskLevel !== "LOW" && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              result.riskLevel === "CRITICAL"
                ? "bg-red-200 text-red-900"
                : result.riskLevel === "HIGH"
                ? "bg-orange-200 text-orange-900"
                : "bg-yellow-200 text-yellow-900"
            }`}
          >
            {result.riskLevel}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400 italic">клик → детали</span>
      </div>

      {result.changeType === "MODIFIED" && result.oldText && result.newText ? (
        <InlineWordDiff oldText={result.oldText} newText={result.newText} />
      ) : result.changeType === "DELETED" ? (
        <span className="text-sm leading-relaxed text-red-800 line-through opacity-70">
          {result.oldText}
        </span>
      ) : (
        <span className="text-sm leading-relaxed text-gray-800">
          {result.newText ?? result.oldText ?? "—"}
        </span>
      )}
    </div>
  );
}

// ─── DocViewer ────────────────────────────────────────────────────────────────

export default function DocViewer({ diffResults, mode = "compare" }: DocViewerProps) {
  const { selectedDiffId, openSidePanel, filters } = useUiStore();
  const [listExpanded, setListExpanded] = useState(false);
  const [showAllSections, setShowAllSections] = useState(false);

  const filtered = diffResults.filter((r) => {
    if (filters.riskLevels.length > 0 && r.riskLevel && !filters.riskLevels.includes(r.riskLevel))
      return false;
    if (filters.changeTypes.length > 0 && !filters.changeTypes.includes(r.changeType as any))
      return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const inOld = r.oldText?.toLowerCase().includes(q) ?? false;
      const inNew = r.newText?.toLowerCase().includes(q) ?? false;
      const inPath = r.sectionPath.toLowerCase().includes(q);
      if (!inOld && !inNew && !inPath) return false;
    }
    return true;
  });

  const displayResults =
    (mode === "compliance" || mode === "audit") && !showAllSections
      ? filtered.filter(
          (r) =>
            r.changeType !== "AUDIT_OK" &&
            r.changeType !== "COMPLIANT" &&
            r.riskLevel !== "LOW"
        )
      : filtered;

  const hiddenOkCount =
    (mode === "compliance" || mode === "audit") && !showAllSections
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
    <div className="space-y-1">
      {/* Счётчик */}
      <p className="text-sm text-gray-500 mb-3">
        Показано <span className="font-semibold text-gray-800">{displayResults.length}</span> из{" "}
        <span className="font-semibold text-gray-800">{diffResults.length}</span> разделов
      </p>

      {/* Кнопка показать OK разделы */}
      {(mode === "compliance" || mode === "audit") && hiddenOkCount > 0 && (
        <div className="flex items-center justify-between mb-2 p-2 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            ✅ Скрыто {hiddenOkCount} разделов без нарушений
          </p>
          <button
            onClick={() => setShowAllSections((v) => !v)}
            className="text-xs text-green-600 hover:text-green-800 font-medium underline"
          >
            Показать все
          </button>
        </div>
      )}

      {/* Кнопка скрыть */}
      {(mode === "compliance" || mode === "audit") && showAllSections && hiddenOkCount >= 0 && (
        <div className="flex items-center justify-end mb-2">
          <button
            onClick={() => setShowAllSections(false)}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium underline"
          >
            Скрыть разделы без нарушений
          </button>
        </div>
      )}

      {/* Список параграфов */}
      <div className="space-y-1 overflow-x-hidden">
        {displayResults.map((result) => (
          <DocParagraph
            key={result.id}
            result={result}
            isSelected={selectedDiffId === result.id}
            onHover={() => openSidePanel(result.id)}
            onClick={() => openSidePanel(result.id)}
          />
        ))}
      </div>

      {/* Сворачиваемый список карточек */}
      <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setListExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
        >
          <div className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Список изменений ({displayResults.length})
          </div>
          {listExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {listExpanded && (
          <div className="p-4 space-y-3">
            {displayResults.map((result) => (
              <DiffBlock
                key={result.id}
                result={result}
                isSelected={selectedDiffId === result.id}
                onClick={() => openSidePanel(result.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}