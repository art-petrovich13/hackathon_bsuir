// src/components/diff/DiffBlock.tsx
import type { DiffResult } from "../../types";
import RiskBadge from "../risk/RiskBadge";

interface DiffBlockProps {
  result: DiffResult;
  isSelected: boolean;
  onClick: () => void;
}

const CHANGE_TYPE_CONFIG = {
  ADDED:    { label: "Добавлено",   bgClass: "bg-green-50 border-l-green-500",  textBg: "bg-green-100" },
  DELETED:  { label: "Удалено",     bgClass: "bg-red-50 border-l-red-500",      textBg: "bg-red-100" },
  MODIFIED: { label: "Изменено",    bgClass: "bg-yellow-50 border-l-yellow-500", textBg: "bg-yellow-100" },
  MOVED:    { label: "Перемещено",  bgClass: "bg-blue-50 border-l-blue-500",    textBg: "bg-blue-100" },
} as const;

export default function DiffBlock({ result, isSelected, onClick }: DiffBlockProps) {
  const config = CHANGE_TYPE_CONFIG[result.changeType] ?? CHANGE_TYPE_CONFIG.MODIFIED;

  return (
    <div
      onClick={onClick}
      className={`
        card border-l-4 p-4 cursor-pointer transition-all duration-150
        hover:shadow-md
        ${config.bgClass}
        ${isSelected ? "ring-2 ring-primary-400 ring-offset-1" : ""}
      `}
    >
      {/* Заголовок блока */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-600">
            п. {result.sectionPath}
          </code>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.textBg} text-gray-700`}>
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {result.riskLevel && <RiskBadge level={result.riskLevel} size="sm" />}
          <span className="text-xs text-gray-400">Нажми для деталей →</span>
        </div>
      </div>

      {/* Тексты */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Старый текст */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Было:</p>
          <p className={`text-gray-800 text-xs leading-relaxed p-2 rounded ${
            result.oldText ? "bg-red-50 line-through decoration-red-300" : "text-gray-300 italic"
          }`}>
            {result.oldText ?? "—"}
          </p>
        </div>
        {/* Новый текст */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Стало:</p>
          <p className={`text-gray-800 text-xs leading-relaxed p-2 rounded ${
            result.newText ? "bg-green-50" : "text-gray-300 italic"
          }`}>
            {result.newText ?? "—"}
          </p>
        </div>
      </div>

      {/* Рекомендация (если есть) */}
      {result.recommendation && (
        <p className="mt-2 text-xs text-gray-500 italic border-t border-gray-200 pt-2">
          💡 {result.recommendation}
        </p>
      )}
    </div>
  );
}