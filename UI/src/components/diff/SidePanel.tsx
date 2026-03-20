// src/components/diff/SidePanel.tsx
import { X, ExternalLink, ChevronRight, BookOpen, AlertTriangle, Shield, Search } from "lucide-react";
import { useUiStore } from "../../store/uiStore";
import RiskBadge from "../risk/RiskBadge";
import type { DiffResult } from "../../types";

type PanelMode = "compare" | "compliance" | "audit";

interface SidePanelProps {
  diffResults: DiffResult[];
  mode?: PanelMode;
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  ADDED:    "Добавлен новый пункт",
  DELETED:  "Пункт удалён",
  MODIFIED: "Пункт изменён",
  MOVED:    "Пункт перемещён",
};

const COMPLIANCE_LABELS: Record<string, { label: string; color: string }> = {
  COMPLIANCE_VIOLATION: { label: "Нарушение",         color: "#c0392b" },
  COMPLIANCE_WARNING:   { label: "Предупреждение",    color: "#d35400" },
  COMPLIANT:            { label: "Соответствует",     color: "#27ae60" },
  AUDIT_ISSUE:          { label: "Нарушение найдено", color: "#c0392b" },
  AUDIT_OK:             { label: "Нарушений нет",     color: "#27ae60" },
};

const SEMANTIC_LABELS: Record<string, { label: string; description: string }> = {
  OBLIGATION_CHANGE: { label: "Изменение обязательности", description: "Изменился характер нормы — право стало обязанностью или наоборот" },
  SCOPE_CHANGE:      { label: "Область применения",       description: "Изменился круг лиц или случаев, к которым применяется норма" },
  DEADLINE_CHANGE:   { label: "Изменение сроков",         description: "Изменились установленные сроки выполнения или уведомления" },
  SUBJECT_CHANGE:    { label: "Изменение субъекта",       description: "Изменился субъект, на которого распространяется действие нормы" },
  SANCTION_CHANGE:   { label: "Изменение ответственности", description: "Изменились санкции или меры ответственности" },
  COSMETIC:          { label: "Косметическое изменение",  description: "Стилистические правки без изменения смысла нормы" },
};

// Цвета для секций
const ACCENT: Record<string, { bg: string; border: string; text: string; label: string }> = {
  red:    { bg: "rgba(255,220,220,0.45)", border: "rgba(220,100,100,0.3)",  text: "#7a1515", label: "rgba(180,60,60,0.8)"   },
  orange: { bg: "rgba(255,230,200,0.45)", border: "rgba(220,140,80,0.3)",   text: "#7a3a00", label: "rgba(180,100,40,0.8)"  },
  green:  { bg: "rgba(210,245,225,0.45)", border: "rgba(80,180,120,0.3)",   text: "#0f4d2a", label: "rgba(40,140,80,0.8)"   },
  blue:   { bg: "rgba(210,230,255,0.45)", border: "rgba(90,140,230,0.3)",   text: "#0f2d6e", label: "rgba(50,100,200,0.8)"  },
  purple: { bg: "rgba(225,215,255,0.45)", border: "rgba(130,100,220,0.3)",  text: "#2d1060", label: "rgba(100,60,180,0.8)"  },
  neutral:{ bg: "rgba(240,238,250,0.5)",  border: "rgba(180,170,220,0.3)",  text: "#2d2050", label: "rgba(100,90,150,0.8)"  },
};

// ─── Стеклянный блок ──────────────────────────────────────────────────────────
function GlassBlock({ children, accent = "neutral" }: { children: React.ReactNode; accent?: keyof typeof ACCENT }) {
  const a = ACCENT[accent];
  return (
    <div style={{
      background: a.bg,
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      border: `1px solid ${a.border}`,
      borderRadius: 14,
      padding: "12px 14px",
      boxShadow: `inset 0 1.5px 0 rgba(255,255,255,0.7), 0 2px 12px rgba(100,80,180,0.08)`,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Верхний блик */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: "rgba(255,255,255,0.8)",
        pointerEvents: "none",
      }} />
      {children}
    </div>
  );
}

// ─── Кнопка-иконка ────────────────────────────────────────────────────────────
function GlassIconBtn({
  onClick, disabled, title, children,
}: { onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 30, height: 30,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.75)",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        transition: "background 0.15s",
        color: "#4a3880",
        flexShrink: 0,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 4px rgba(100,80,180,0.1)",
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.75)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.55)"; }}
    >
      {children}
    </button>
  );
}

// ─── Метка секции ─────────────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "rgba(80,60,130,0.5)",
      marginBottom: 5,
    }}>
      {text}
    </p>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────
export default function SidePanel({ diffResults, mode = "compare" }: SidePanelProps) {
  const { sidePanelOpen, selectedDiffId, closeSidePanel, openSidePanel } = useUiStore();

  if (!sidePanelOpen || !selectedDiffId) return null;

  const result = diffResults.find((r) => r.id === selectedDiffId);
  if (!result) return null;

  const currentIndex = diffResults.findIndex((r) => r.id === selectedDiffId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < diffResults.length - 1;

  const semanticInfo   = result.semanticType ? SEMANTIC_LABELS[result.semanticType] : null;
  const complianceInfo = COMPLIANCE_LABELS[result.changeType];

  const panelTitle =
    mode === "compliance" ? "Проверка соответствия" :
    mode === "audit"      ? "Аудит раздела" :
                            "Детали изменения";

  const TitleIcon =
    mode === "compliance" ? Shield :
    mode === "audit"      ? Search :
                            BookOpen;

  const isViolation = result.changeType === "COMPLIANCE_VIOLATION" || result.changeType === "AUDIT_ISSUE";
  const isWarning   = result.changeType === "COMPLIANCE_WARNING";
  const isOk        = result.changeType === "COMPLIANT" || result.changeType === "AUDIT_OK";

  return (
    <>
      {/* Затемнение (мобильный) */}
      <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={closeSidePanel} />

      {/* Панель — светлое матовое стекло */}
      <div
        className="fixed top-0 right-0 h-full z-40 flex flex-col overflow-hidden"
        style={{
          width: "100%",
          maxWidth: 420,
          // Плотный светлый frosted-glass
          background: "rgba(235, 230, 255, 0.72)",
          backdropFilter: "blur(72px) saturate(2) brightness(1.08)",
          WebkitBackdropFilter: "blur(72px) saturate(2) brightness(1.08)",
          // Многослойная граница и тень
          borderLeft: "1.5px solid rgba(255,255,255,0.75)",
          boxShadow: [
            "-16px 0 60px rgba(100,80,200,0.12)",
            "inset 1px 0 0 rgba(255,255,255,0.9)",
            "inset 0 1px 0 rgba(255,255,255,0.6)",
          ].join(", "),
          // Декоративные пятна
          backgroundImage: [
            "linear-gradient(160deg, rgba(255,255,255,0.55) 0%, transparent 40%)",
            "radial-gradient(ellipse 80% 45% at 95% 5%,  rgba(200,180,255,0.4) 0%, transparent 55%)",
            "radial-gradient(ellipse 65% 40% at 5%  95%, rgba(160,200,255,0.3) 0%, transparent 50%)",
          ].join(", "),
        }}
      >

        {/* Верхний gloss-штрих на всю ширину */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9) 30%, rgba(255,255,255,0.6) 70%, transparent)",
          pointerEvents: "none", zIndex: 1,
        }} />

        {/* Шапка */}
        <div style={{
          padding: "16px 18px 13px",
          borderBottom: "1px solid rgba(255,255,255,0.6)",
          background: "rgba(255,255,255,0.35)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "inset 0 -1px 0 rgba(200,190,240,0.3)",
          flexShrink: 0,
          position: "relative", zIndex: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Иконка-пилюля */}
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.9)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "inset 0 1.5px 0 rgba(255,255,255,1), 0 2px 8px rgba(120,90,200,0.15)",
                flexShrink: 0,
              }}>
                <TitleIcon size={16} color="#6d28d9" />
              </div>
              <div>
                <p style={{ fontSize: 10.5, color: "rgba(80,60,140,0.55)", fontWeight: 600, letterSpacing: "0.03em" }}>
                  {panelTitle}
                </p>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#1e1040", lineHeight: 1.2 }}>
                  п. {result.sectionPath}
                </p>
              </div>
            </div>

            {/* Навигация */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <GlassIconBtn
                onClick={() => hasPrev && openSidePanel(diffResults[currentIndex - 1].id)}
                disabled={!hasPrev} title="Предыдущий"
              >
                <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
              </GlassIconBtn>
              <span style={{ fontSize: 11, color: "rgba(80,60,140,0.5)", padding: "0 4px", whiteSpace: "nowrap" }}>
                {currentIndex + 1} / {diffResults.length}
              </span>
              <GlassIconBtn
                onClick={() => hasNext && openSidePanel(diffResults[currentIndex + 1].id)}
                disabled={!hasNext} title="Следующий"
              >
                <ChevronRight size={13} />
              </GlassIconBtn>
              <GlassIconBtn onClick={closeSidePanel} title="Закрыть">
                <X size={13} />
              </GlassIconBtn>
            </div>
          </div>
        </div>

        {/* Контент */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "16px 18px",
          display: "flex", flexDirection: "column", gap: 12,
        }}>

          {/* Статус */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {mode === "compare" && (
              <span style={{ fontSize: 13, color: "#2d1060", fontWeight: 600 }}>
                {CHANGE_TYPE_LABELS[result.changeType] ?? result.changeType}
              </span>
            )}
            {(mode === "compliance" || mode === "audit") && complianceInfo && (
              <span style={{ fontSize: 13, fontWeight: 700, color: complianceInfo.color }}>
                {complianceInfo.label}
              </span>
            )}
            {result.riskLevel && <RiskBadge level={result.riskLevel} size="md" />}
          </div>

          {/* Семантический тип */}
          {mode === "compare" && semanticInfo && (
            <div>
              <SectionLabel text="Тип изменения" />
              <GlassBlock accent="blue">
                <p style={{ fontSize: 12, fontWeight: 700, color: ACCENT.blue.text, marginBottom: 4 }}>{semanticInfo.label}</p>
                <p style={{ fontSize: 12, color: ACCENT.blue.text, lineHeight: 1.55, opacity: 0.8 }}>{semanticInfo.description}</p>
              </GlassBlock>
            </div>
          )}

          {/* Было / Стало */}
          {mode === "compare" && (result.oldText || result.newText) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {result.oldText && (
                <div>
                  <SectionLabel text="Было" />
                  <GlassBlock accent="red">
                    <p style={{ fontSize: 13, color: ACCENT.red.text, lineHeight: 1.6 }}>{result.oldText}</p>
                  </GlassBlock>
                </div>
              )}
              {result.newText && (
                <div>
                  <SectionLabel text="Стало" />
                  <GlassBlock accent="green">
                    <p style={{ fontSize: 13, color: ACCENT.green.text, lineHeight: 1.6 }}>{result.newText}</p>
                  </GlassBlock>
                </div>
              )}
            </div>
          )}

          {/* Текст раздела */}
          {(mode === "compliance" || mode === "audit") && result.newText && (
            <div>
              <SectionLabel text="Текст раздела" />
              <GlassBlock accent={isViolation ? "red" : isWarning ? "orange" : "green"}>
                <p style={{ fontSize: 13, color: isViolation ? ACCENT.red.text : isWarning ? ACCENT.orange.text : ACCENT.green.text, lineHeight: 1.6 }}>
                  {result.newText}
                </p>
              </GlassBlock>
            </div>
          )}

          {/* Нарушенная / применимая норма */}
          {(mode === "compliance" || mode === "audit") && result.lawReference && (
            <div>
              <SectionLabel text={isViolation || isWarning ? "Нарушаемая норма" : "Применимая норма"} />
              <GlassBlock accent={isViolation ? "red" : isWarning ? "orange" : "blue"}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <ExternalLink size={12} color={isViolation ? ACCENT.red.label : ACCENT.blue.label} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: isViolation ? ACCENT.red.text : isWarning ? ACCENT.orange.text : ACCENT.blue.text, lineHeight: 1.5 }}>
                  {result.lawReference}
                </p>
              </GlassBlock>
            </div>
          )}

          {/* Нормативная база (compare) */}
          {mode === "compare" && result.lawReference && (
            <div>
              <SectionLabel text="Нормативная база" />
              <GlassBlock accent="blue">
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <ExternalLink size={12} color={ACCENT.blue.label} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: ACCENT.blue.text, lineHeight: 1.5 }}>
                  {result.lawReference}
                </p>
              </GlassBlock>
            </div>
          )}

          {/* Рекомендация */}
          {result.recommendation && (
            <div>
              <SectionLabel text={isViolation ? "Как исправить" : "Рекомендация"} />
              <GlassBlock accent="neutral">
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <BookOpen size={12} color={ACCENT.neutral.label} />
                </div>
                <p style={{ fontSize: 13, color: ACCENT.neutral.text, lineHeight: 1.6 }}>
                  {result.recommendation}
                </p>
              </GlassBlock>
            </div>
          )}

          {/* Уверенность AI */}
          {result.aiConfidence !== null && result.aiConfidence !== undefined && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <p style={{ fontSize: 11, color: "rgba(80,60,130,0.55)" }}>Уверенность AI</p>
                <p style={{
                  fontSize: 11, fontWeight: 700,
                  color: result.aiConfidence >= 0.7 ? "#1a7a40" : result.aiConfidence >= 0.5 ? "#b35c00" : "#a01515",
                }}>
                  {Math.round(result.aiConfidence * 100)}%
                </p>
              </div>
              <div style={{
                height: 5, borderRadius: 5,
                background: "rgba(180,170,220,0.25)",
                border: "1px solid rgba(255,255,255,0.5)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: 5,
                  width: `${result.aiConfidence * 100}%`,
                  background: result.aiConfidence >= 0.7
                    ? "linear-gradient(90deg, #34d399, #059669)"
                    : result.aiConfidence >= 0.5
                    ? "linear-gradient(90deg, #fbbf24, #d97706)"
                    : "linear-gradient(90deg, #f87171, #dc2626)",
                  transition: "width 0.4s ease",
                }} />
              </div>
              {result.aiConfidence < 0.5 && (
                <p style={{ fontSize: 11, color: "#b35c00", marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={11} /> Рекомендуется ручная проверка
                </p>
              )}
            </div>
          )}
        </div>

        {/* Футер */}
        {mode === "compare" && (result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL") && (
          <div style={{
            padding: "11px 18px",
            borderTop: "1px solid rgba(220,150,150,0.4)",
            background: "rgba(255,220,220,0.35)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            flexShrink: 0,
          }}>
            <p style={{ fontSize: 11, color: "#7a1515", fontWeight: 500 }}>
              ⚖️ Высокий риск — откройте страницу ПРОКУРОР для анализа последствий
            </p>
          </div>
        )}

        {(mode === "compliance" || mode === "audit") && isViolation && (
          <div style={{
            padding: "11px 18px",
            borderTop: "1px solid rgba(220,150,150,0.4)",
            background: "rgba(255,215,215,0.35)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            flexShrink: 0,
          }}>
            <p style={{ fontSize: 11, color: "#7a1515", fontWeight: 500 }}>
              ⚠️ Требует исправления — следуйте рекомендации выше
            </p>
          </div>
        )}

        {(mode === "compliance" || mode === "audit") && isOk && (
          <div style={{
            padding: "11px 18px",
            borderTop: "1px solid rgba(100,200,140,0.35)",
            background: "rgba(200,245,220,0.35)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            flexShrink: 0,
          }}>
            <p style={{ fontSize: 11, color: "#0f4d2a", fontWeight: 500 }}>
              ✅ Раздел соответствует требованиям
            </p>
          </div>
        )}
      </div>
    </>
  );
}