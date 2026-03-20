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

// Все цвета — rgba, чтобы не перекрывать стеклянный фон
const CHANGE_CONFIG = {
  ADDED: {
    bg:          "rgba(220,252,231,0.55)",
    border:      "rgba(34,197,94,0.55)",
    hoverBg:     "rgba(220,252,231,0.75)",
    badge:       { text: "+ новый",        bg: "rgba(220,252,231,0.7)",  color: "#15803d", border: "rgba(34,197,94,0.3)"  },
  },
  DELETED: {
    bg:          "rgba(254,226,226,0.55)",
    border:      "rgba(239,68,68,0.55)",
    hoverBg:     "rgba(254,226,226,0.75)",
    badge:       { text: "– удалён",       bg: "rgba(254,226,226,0.7)",  color: "#b91c1c", border: "rgba(239,68,68,0.3)"  },
  },
  MODIFIED: {
    bg:          "rgba(254,243,199,0.55)",
    border:      "rgba(234,179,8,0.55)",
    hoverBg:     "rgba(254,243,199,0.75)",
    badge:       { text: "~ изменён",      bg: "rgba(254,243,199,0.7)",  color: "#a16207", border: "rgba(234,179,8,0.3)"  },
  },
  MOVED: {
    bg:          "rgba(219,234,254,0.55)",
    border:      "rgba(59,130,246,0.55)",
    hoverBg:     "rgba(219,234,254,0.75)",
    badge:       { text: "↕ перемещён",    bg: "rgba(219,234,254,0.7)",  color: "#1d4ed8", border: "rgba(59,130,246,0.3)" },
  },
  COMPLIANCE_VIOLATION: {
    bg:          "rgba(254,226,226,0.55)",
    border:      "rgba(220,38,38,0.6)",
    hoverBg:     "rgba(254,226,226,0.75)",
    badge:       { text: "⚠ нарушение",    bg: "rgba(254,226,226,0.7)",  color: "#991b1b", border: "rgba(220,38,38,0.35)" },
  },
  COMPLIANCE_WARNING: {
    bg:          "rgba(255,237,213,0.55)",
    border:      "rgba(249,115,22,0.55)",
    hoverBg:     "rgba(255,237,213,0.75)",
    badge:       { text: "! предупреждение", bg: "rgba(255,237,213,0.7)", color: "#c2410c", border: "rgba(249,115,22,0.3)" },
  },
  COMPLIANT: {
    bg:          "rgba(220,252,231,0.45)",
    border:      "rgba(74,222,128,0.5)",
    hoverBg:     "rgba(220,252,231,0.65)",
    badge:       { text: "✓ соответствует", bg: "rgba(220,252,231,0.7)", color: "#15803d", border: "rgba(74,222,128,0.3)" },
  },
  AUDIT_ISSUE: {
    bg:          "rgba(254,226,226,0.55)",
    border:      "rgba(220,38,38,0.6)",
    hoverBg:     "rgba(254,226,226,0.75)",
    badge:       { text: "⚠ нарушение",    bg: "rgba(254,226,226,0.7)",  color: "#991b1b", border: "rgba(220,38,38,0.35)" },
  },
  AUDIT_OK: {
    bg:          "rgba(243,244,246,0.45)",
    border:      "rgba(156,163,175,0.45)",
    hoverBg:     "rgba(243,244,246,0.65)",
    badge:       { text: "✓ ок",           bg: "rgba(243,244,246,0.7)",  color: "#4b5563", border: "rgba(156,163,175,0.3)" },
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
            <span key={idx} style={{ textDecoration: "line-through", color: "#dc2626", background: "rgba(254,226,226,0.7)", padding: "0 3px", borderRadius: 3, margin: "0 2px" }}>
              {chunk.oldWords.join(" ")}
            </span>
          );
        if (chunk.tag === "insert")
          return (
            <span key={idx} style={{ textDecoration: "underline", color: "#15803d", background: "rgba(220,252,231,0.7)", padding: "0 3px", borderRadius: 3, margin: "0 2px" }}>
              {chunk.newWords.join(" ")}
            </span>
          );
        if (chunk.tag === "replace")
          return (
            <span key={idx}>
              <span style={{ textDecoration: "line-through", color: "#dc2626", background: "rgba(254,226,226,0.7)", padding: "0 3px", borderRadius: 3, margin: "0 2px" }}>
                {chunk.oldWords.join(" ")}
              </span>{" "}
              <span style={{ textDecoration: "underline", color: "#15803d", background: "rgba(220,252,231,0.7)", padding: "0 3px", borderRadius: 3, margin: "0 2px" }}>
                {chunk.newWords.join(" ")}
              </span>
            </span>
          );
        return null;
      })}
    </span>
  );
}

// ─── RiskPill ─────────────────────────────────────────────────────────────────

function RiskPill({ level }: { level: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    CRITICAL: { bg: "rgba(254,226,226,0.75)", color: "#7f1d1d", border: "rgba(220,38,38,0.4)"  },
    HIGH:     { bg: "rgba(255,237,213,0.75)", color: "#7c2d12", border: "rgba(249,115,22,0.4)" },
    MEDIUM:   { bg: "rgba(254,249,195,0.75)", color: "#713f12", border: "rgba(234,179,8,0.4)"  },
    LOW:      { bg: "rgba(220,252,231,0.75)", color: "#14532d", border: "rgba(34,197,94,0.4)"  },
  };
  const s = styles[level] ?? styles.LOW;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {level}
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

function DocParagraph({ result, isSelected, onHover, onClick }: DocParagraphProps) {
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => {
    setHovered(true);
    hoverTimerRef.current = setTimeout(() => onHover(), 350);
  };
  const handleMouseLeave = () => {
    setHovered(false);
    clearTimeout(hoverTimerRef.current);
  };

  const config =
    (result.changeType in CHANGE_CONFIG
      ? CHANGE_CONFIG[result.changeType as keyof typeof CHANGE_CONFIG]
      : undefined) ?? CHANGE_CONFIG.MODIFIED;

  // ── Активная строка — фиолетовый таб уходит вправо ────────────────────────
  if (isSelected) {
    return (
      <div style={{ position: "relative", zIndex: 2, marginRight: "-1.5rem" }}>
        {/* Верхний вогнутый угол */}
        <div aria-hidden style={{
          position: "absolute", top: -12, right: 0,
          width: 12, height: 12, background: "transparent",
          borderBottomRightRadius: 8,
          boxShadow: "4px 4px 0 4px rgba(240,237,252,1)",
          pointerEvents: "none", zIndex: 3,
        }} />
        {/* Нижний вогнутый угол */}
        <div aria-hidden style={{
          position: "absolute", bottom: -12, right: 0,
          width: 12, height: 12, background: "transparent",
          borderTopRightRadius: 8,
          boxShadow: "4px -4px 0 4px rgba(240,237,252,1)",
          pointerEvents: "none", zIndex: 3,
        }} />

        <div
          style={{
            padding: "10px 16px",
            cursor: "pointer",
            background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)",
            borderRadius: "10px 0 0 10px",
            boxShadow: "0 4px 20px rgba(109,40,217,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={onClick}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
            <code style={{ fontSize: 11, color: "rgba(221,214,254,0.9)", fontFamily: "monospace" }}>
              п. {result.sectionPath}
            </code>
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 100, fontWeight: 600,
              background: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)",
            }}>
              {config.badge.text}
            </span>
            {result.riskLevel && result.riskLevel !== "LOW" && (
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 100, fontWeight: 600,
                background: "rgba(255,255,255,0.18)", color: "white", border: "1px solid rgba(255,255,255,0.25)",
              }}>
                {result.riskLevel}
              </span>
            )}
            <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(221,214,254,0.7)", fontStyle: "italic" }}>
              открыто →
            </span>
          </div>

          {result.changeType === "MODIFIED" && result.oldText && result.newText ? (
            <InlineWordDiff oldText={result.oldText} newText={result.newText} />
          ) : result.changeType === "DELETED" ? (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", textDecoration: "line-through", lineHeight: 1.6 }}>
              {result.oldText}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: "white", lineHeight: 1.6 }}>
              {result.newText ?? result.oldText ?? "—"}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Обычная строка ────────────────────────────────────────────────────────
  return (
    <div
      style={{
        padding: "10px 16px",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "background 0.15s ease, box-shadow 0.15s ease",
        background: hovered ? config.hoverBg : config.bg,
        borderLeft: `4px solid ${config.border}`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: hovered
          ? `inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(0,0,0,0.06)`
          : `inset 0 1px 0 rgba(255,255,255,0.45)`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
        <code style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
          п. {result.sectionPath}
        </code>
        <span style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 100, fontWeight: 600,
          background: config.badge.bg, color: config.badge.color, border: `1px solid ${config.badge.border}`,
        }}>
          {config.badge.text}
        </span>
        {result.riskLevel && result.riskLevel !== "LOW" && (
          <RiskPill level={result.riskLevel} />
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(156,163,175,0.8)", fontStyle: "italic" }}>
          клик → детали
        </span>
      </div>

      {result.changeType === "MODIFIED" && result.oldText && result.newText ? (
        <InlineWordDiff oldText={result.oldText} newText={result.newText} />
      ) : result.changeType === "DELETED" ? (
        <span style={{ fontSize: 13, color: "#b91c1c", textDecoration: "line-through", opacity: 0.75, lineHeight: 1.6 }}>
          {result.oldText}
        </span>
      ) : (
        <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
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
      const inOld  = r.oldText?.toLowerCase().includes(q) ?? false;
      const inNew  = r.newText?.toLowerCase().includes(q) ?? false;
      const inPath = r.sectionPath.toLowerCase().includes(q);
      if (!inOld && !inNew && !inPath) return false;
    }
    return true;
  });

  const displayResults =
    (mode === "compliance" || mode === "audit") && !showAllSections
      ? filtered.filter(
          (r) => r.changeType !== "AUDIT_OK" && r.changeType !== "COMPLIANT" && r.riskLevel !== "LOW"
        )
      : filtered;

  const hiddenOkCount =
    (mode === "compliance" || mode === "audit") && !showAllSections
      ? filtered.length - displayResults.length
      : 0;

  if (diffResults.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 0" }}>
        <p style={{ fontSize: 36, marginBottom: 12 }}>🎉</p>
        <p style={{ fontWeight: 600, color: "#374151" }}>Изменений не найдено</p>
        <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Документы идентичны</p>
      </div>
    );
  }

  if (displayResults.length === 0 && hiddenOkCount === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2.5rem 0" }}>
        <p style={{ fontSize: 28, marginBottom: 8 }}>🔍</p>
        <p style={{ fontWeight: 500, color: "#374151" }}>Нет изменений по фильтру</p>
        <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Попробуй изменить критерии фильтрации</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Счётчик */}
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
        Показано{" "}
        <span style={{ fontWeight: 600, color: "#111827" }}>{displayResults.length}</span>{" "}
        из{" "}
        <span style={{ fontWeight: 600, color: "#111827" }}>{diffResults.length}</span>{" "}
        разделов
      </p>

      {/* Кнопка показать OK */}
      {(mode === "compliance" || mode === "audit") && hiddenOkCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 8, padding: "8px 12px",
          background: "rgba(220,252,231,0.45)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(74,222,128,0.35)", borderRadius: 12,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
        }}>
          <p style={{ fontSize: 12, color: "#15803d" }}>✅ Скрыто {hiddenOkCount} разделов без нарушений</p>
          <button
            onClick={() => setShowAllSections((v) => !v)}
            style={{ fontSize: 12, color: "#15803d", fontWeight: 600, textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
          >
            Показать все
          </button>
        </div>
      )}

      {/* Кнопка скрыть */}
      {(mode === "compliance" || mode === "audit") && showAllSections && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            onClick={() => setShowAllSections(false)}
            style={{ fontSize: 12, color: "#9ca3af", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
          >
            Скрыть разделы без нарушений
          </button>
        </div>
      )}

      {/* Список строк */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" }}>
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

      {/* Сворачиваемый список */}
      <div style={{
        marginTop: 20,
        background: "rgba(255,255,255,0.4)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.65)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
      }}>
        <button
          onClick={() => setListExpanded((prev) => !prev)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", background: "rgba(255,255,255,0.25)", border: "none",
            cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#374151",
            borderBottom: listExpanded ? "1px solid rgba(255,255,255,0.5)" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <List size={15} />
            Список изменений ({displayResults.length})
          </div>
          {listExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {listExpanded && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
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