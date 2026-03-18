// src/components/risk/RiskTimeline.tsx
import { useUiStore } from "../../store/uiStore";
import type { DiffResult, RiskLevel } from "../../types";

interface RiskTimelineProps {
  diffResults: DiffResult[];
}

const RISK_DOT: Record<RiskLevel, string> = {
  CRITICAL: "bg-red-500 border-red-600",
  HIGH:     "bg-orange-500 border-orange-600",
  MEDIUM:   "bg-yellow-400 border-yellow-500",
  LOW:      "bg-green-500 border-green-600",
};

const RISK_ITEM: Record<RiskLevel, string> = {
  CRITICAL: "border-red-300 text-red-700 bg-red-50",
  HIGH:     "border-orange-300 text-orange-700 bg-orange-50",
  MEDIUM:   "border-yellow-300 text-yellow-700 bg-yellow-50",
  LOW:      "border-green-300 text-green-700 bg-green-50",
};

const RISK_DOT_PLAIN: Record<RiskLevel, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-orange-500",
  MEDIUM:   "bg-yellow-400",
  LOW:      "bg-green-500",
};

function getTopSection(path: string): string {
  return path.split(".")[0];
}

function getMaxRisk(results: DiffResult[]): RiskLevel | null {
  const order: RiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  for (const level of order) {
    if (results.some((r) => r.riskLevel === level)) return level;
  }
  return null;
}

export default function RiskTimeline({ diffResults }: RiskTimelineProps) {
  const { openSidePanel } = useUiStore();

  if (diffResults.length === 0) {
    return (
      <div className="card p-5 text-center text-sm text-gray-400">
        Нет изменений для отображения
      </div>
    );
  }

  // Группировать по верхнему разделу
  const grouped = new Map<string, DiffResult[]>();
  for (const r of diffResults) {
    const section = getTopSection(r.sectionPath);
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(r);
  }

  const sections = Array.from(grouped.entries()).sort((a, b) => {
    return (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0);
  });

  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-gray-700 mb-5">
        Хронология изменений по разделам
      </p>

      {/* Шкала */}
      <div className="relative pb-2">
        {/* Горизонтальная линия */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-0" />

        {/* Разделы */}
        <div className="flex items-start justify-between relative z-10 gap-2">
          {sections.map(([section, results]) => {
            const maxRisk = getMaxRisk(results);
            const dotClass = maxRisk ? RISK_DOT[maxRisk] : "bg-gray-300 border-gray-400";

            return (
              <div key={section} className="flex flex-col items-center flex-1 min-w-0">
                {/* Точка */}
                <div
                  className={`w-8 h-8 rounded-full border-2 ${dotClass} flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-sm flex-shrink-0`}
                  onClick={() => results[0] && openSidePanel(results[0].id)}
                  title={`Раздел ${section}: ${results.length} изм.`}
                >
                  <span className="text-white text-xs font-bold">{results.length}</span>
                </div>

                {/* Номер раздела */}
                <p className="text-xs font-mono text-gray-500 mt-1.5 mb-1">§{section}</p>

                {/* Мини-список изменений */}
                <div className="space-y-0.5 w-full">
                  {results.slice(0, 2).map((r) => (
                    <div
                      key={r.id}
                      onClick={() => openSidePanel(r.id)}
                      className={`text-xs px-1 py-0.5 rounded border cursor-pointer hover:opacity-80 truncate ${
                        r.riskLevel ? RISK_ITEM[r.riskLevel] : "border-gray-200 text-gray-500 bg-white"
                      }`}
                      title={r.newText ?? r.oldText ?? r.sectionPath}
                    >
                      {r.sectionPath}
                    </div>
                  ))}
                  {results.length > 2 && (
                    <p className="text-xs text-center text-gray-400 font-medium">
                      +{results.length - 2}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as RiskLevel[]).map((level) => {
          const count = diffResults.filter((r) => r.riskLevel === level).length;
          if (count === 0) return null;
          const labels = { CRITICAL: "Критич.", HIGH: "Высокий", MEDIUM: "Средний", LOW: "Низкий" };
          return (
            <div key={level} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${RISK_DOT_PLAIN[level]}`} />
              <span className="text-xs text-gray-600">{labels[level]} ({count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}