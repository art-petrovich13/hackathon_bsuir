// src/components/diff/DiffBlock.tsx
import type { DiffResult } from "../../types";
import RiskBadge from "../risk/RiskBadge";
import ChangeMarker from "./ChangeMarker";

interface DiffBlockProps {
  result: DiffResult;
  isSelected: boolean;
  onClick: () => void;
}

const CHANGE_TYPE_CONFIG = {
  ADDED:    { label: "Добавлено",   borderClass: "border-l-green-500",  tagBg: "bg-green-100 text-green-700" },
  DELETED:  { label: "Удалено",     borderClass: "border-l-red-500",    tagBg: "bg-red-100 text-red-700" },
  MODIFIED: { label: "Изменено",    borderClass: "border-l-yellow-500", tagBg: "bg-yellow-100 text-yellow-700" },
  MOVED:    { label: "Перемещено",  borderClass: "border-l-blue-500",   tagBg: "bg-blue-100 text-blue-700" },
} as const;

// ─── Word-level diff рендеринг ────────────────────────────────────────────────

/**
 * Вычислить word-level diff между двумя строками прямо во фронте.
 * Использует простой алгоритм LCS (Longest Common Subsequence) на словах.
 * Бэкенд тоже отдаёт word_diff, но его нет в текущей схеме API — считаем на клиенте.
 */
function computeWordDiff(oldText: string, newText: string): Array<{
  tag: "equal" | "replace" | "insert" | "delete";
  oldWords: string[];
  newWords: string[];
}> {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);

  // Простой LCS для слов
  const dp: number[][] = Array(oldWords.length + 1)
    .fill(null)
    .map(() => Array(newWords.length + 1).fill(0));

  for (let i = 1; i <= oldWords.length; i++) {
    for (let j = 1; j <= newWords.length; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Восстановить путь
  const result: Array<{ tag: "equal" | "replace" | "insert" | "delete"; oldWords: string[]; newWords: string[] }> = [];
  let i = oldWords.length;
  let j = newWords.length;
  const ops: Array<{ tag: "equal" | "insert" | "delete"; i: number; j: number }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      ops.unshift({ tag: "equal", i: i - 1, j: j - 1 });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ tag: "insert", i, j: j - 1 });
      j--;
    } else {
      ops.unshift({ tag: "delete", i: i - 1, j });
      i--;
    }
  }

  // Группировать последовательные операции
  let k = 0;
  while (k < ops.length) {
    const op = ops[k];
    if (op.tag === "equal") {
      result.push({ tag: "equal", oldWords: [oldWords[op.i]], newWords: [newWords[op.j]] });
      k++;
    } else {
      // Собрать подряд идущие delete + insert в replace
      const delWords: string[] = [];
      const insWords: string[] = [];
      while (k < ops.length && ops[k].tag === "delete") {
        delWords.push(oldWords[ops[k].i]);
        k++;
      }
      while (k < ops.length && ops[k].tag === "insert") {
        insWords.push(newWords[ops[k].j]);
        k++;
      }
      if (delWords.length > 0 && insWords.length > 0) {
        result.push({ tag: "replace", oldWords: delWords, newWords: insWords });
      } else if (delWords.length > 0) {
        result.push({ tag: "delete", oldWords: delWords, newWords: [] });
      } else {
        result.push({ tag: "insert", oldWords: [], newWords: insWords });
      }
    }
  }
  return result;
}

/** Рендерит старую версию текста с подсветкой удалённых слов */
function OldTextWithDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const chunks = computeWordDiff(oldText, newText);
  return (
    <p className="text-xs leading-relaxed p-2 rounded bg-red-50 text-gray-800">
      {chunks.map((chunk, i) => {
        if (chunk.tag === "equal") return <span key={i}>{chunk.oldWords.join(" ")} </span>;
        if (chunk.tag === "delete" || chunk.tag === "replace") {
          return <ChangeMarker key={i} words={chunk.oldWords} type="deleted" />;
        }
        return null; // insert — не показываем в старом тексте
      })}
    </p>
  );
}

/** Рендерит новую версию текста с подсветкой добавленных слов */
function NewTextWithDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const chunks = computeWordDiff(oldText, newText);
  return (
    <p className="text-xs leading-relaxed p-2 rounded bg-green-50 text-gray-800">
      {chunks.map((chunk, i) => {
        if (chunk.tag === "equal") return <span key={i}>{chunk.newWords.join(" ")} </span>;
        if (chunk.tag === "insert" || chunk.tag === "replace") {
          return <ChangeMarker key={i} words={chunk.newWords} type="added" />;
        }
        return null; // delete — не показываем в новом тексте
      })}
    </p>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

export default function DiffBlock({ result, isSelected, onClick }: DiffBlockProps) {
  const config = CHANGE_TYPE_CONFIG[result.changeType] ?? CHANGE_TYPE_CONFIG.MODIFIED;

  const hasWordDiff =
    result.changeType === "MODIFIED" &&
    result.oldText &&
    result.newText;

  return (
    <div
      onClick={onClick}
      className={`
        card border-l-4 p-4 cursor-pointer transition-all duration-150 hover:shadow-md
        ${config.borderClass}
        ${isSelected ? "ring-2 ring-primary-400 ring-offset-1 shadow-md" : ""}
      `}
    >
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-600">
            п. {result.sectionPath}
          </code>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.tagBg}`}>
            {config.label}
          </span>
          {result.semanticType && result.semanticType !== "COSMETIC" && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {SEMANTIC_LABELS[result.semanticType] ?? result.semanticType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result.riskLevel && <RiskBadge level={result.riskLevel} size="sm" />}
          {result.aiConfidence !== null && result.aiConfidence !== undefined && result.aiConfidence < 0.5 && (
            <span className="text-xs text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
              ⚠ Низкая уверенность AI
            </span>
          )}
          <span className="text-xs text-gray-400">Детали →</span>
        </div>
      </div>

      {/* Тексты с word-level diff */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Было:</p>
          {hasWordDiff ? (
            <OldTextWithDiff oldText={result.oldText!} newText={result.newText!} />
          ) : (
            <p className={`text-xs leading-relaxed p-2 rounded ${
              result.oldText ? "bg-red-50 text-gray-800" : "text-gray-300 italic"
            }`}>
              {result.oldText ?? "—"}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Стало:</p>
          {hasWordDiff ? (
            <NewTextWithDiff oldText={result.oldText!} newText={result.newText!} />
          ) : (
            <p className={`text-xs leading-relaxed p-2 rounded ${
              result.newText ? "bg-green-50 text-gray-800" : "text-gray-300 italic"
            }`}>
              {result.newText ?? "—"}
            </p>
          )}
        </div>
      </div>

      {/* Рекомендация */}
      {result.recommendation && (
        <p className="mt-2 text-xs text-gray-500 italic border-t border-gray-100 pt-2 line-clamp-2">
          💡 {result.recommendation}
        </p>
      )}
    </div>
  );
}

// Человекочитаемые метки семантических типов
const SEMANTIC_LABELS: Record<string, string> = {
  OBLIGATION_CHANGE: "Обязательность",
  SCOPE_CHANGE:      "Область применения",
  DEADLINE_CHANGE:   "Сроки",
  SUBJECT_CHANGE:    "Субъект",
  SANCTION_CHANGE:   "Ответственность",
  COSMETIC:          "Косметика",
};