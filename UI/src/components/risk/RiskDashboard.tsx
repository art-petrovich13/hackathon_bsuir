// src/components/risk/RiskDashboard.tsx
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Comparison } from "../../types";

interface RiskDashboardProps {
  comparison: Comparison;
}

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH:     "#f97316",
  MEDIUM:   "#eab308",
  LOW:      "#22c55e",
};

const SEMANTIC_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e", "#94a3b8"];

const SEMANTIC_LABELS: Record<string, string> = {
  OBLIGATION_CHANGE: "Обязательность",
  SCOPE_CHANGE:      "Область",
  DEADLINE_CHANGE:   "Сроки",
  SUBJECT_CHANGE:    "Субъект",
  SANCTION_CHANGE:   "Санкции",
  COSMETIC:          "Косметика",
};

export default function RiskDashboard({ comparison }: RiskDashboardProps) {
  const diffResults = comparison.diffResults ?? [];
  const summary = comparison.summary;

  const riskData = [
    { name: "Критический", key: "CRITICAL", value: summary?.criticalRisk ?? 0 },
    { name: "Высокий",     key: "HIGH",     value: summary?.highRisk ?? 0 },
    { name: "Средний",     key: "MEDIUM",   value: summary?.mediumRisk ?? 0 },
    { name: "Низкий",      key: "LOW",      value: summary?.lowRisk ?? 0 },
  ].filter((d) => d.value > 0);

  const semanticCounts: Record<string, number> = {};
  for (const r of diffResults) {
    if (r.semanticType) {
      semanticCounts[r.semanticType] = (semanticCounts[r.semanticType] ?? 0) + 1;
    }
  }
  const semanticData = Object.entries(semanticCounts)
    .map(([type, count], i) => ({
      name: SEMANTIC_LABELS[type] ?? type,
      count,
      color: SEMANTIC_COLORS[i % SEMANTIC_COLORS.length],
    }))
    .sort((a, b) => b.count - a.count);

  const totalChanges = summary?.totalChanges ?? diffResults.length;
  const criticalAndHigh = (summary?.criticalRisk ?? 0) + (summary?.highRisk ?? 0);
  const avgRiskScore = comparison.totalRiskScore ?? 0;

  const riskScoreColor =
    avgRiskScore >= 70 ? "text-red-600" :
    avgRiskScore >= 40 ? "text-orange-500" :
    avgRiskScore >= 20 ? "text-yellow-500" : "text-green-600";

  return (
    <div className="space-y-6">
      {/* KPI карточки */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Всего изменений"
          value={totalChanges}
          subtitle={`+${summary?.totalChanges ?? 0} к анализу`}
          color="blue"
        />
        <KpiCard
          title="Высокий риск"
          value={criticalAndHigh}
          subtitle={criticalAndHigh > 0 ? "Требуют внимания" : "Нет критических"}
          color={criticalAndHigh > 0 ? "red" : "green"}
        />
        <KpiCard
          title="Обязательности"
          value={summary?.obligationChanges ?? 0}
          subtitle="Изменений обязанностей"
          color="orange"
        />
        <KpiCard
          title="Сроки"
          value={summary?.deadlineChanges ?? 0}
          subtitle="Изменений сроков"
          color="purple"
        />
      </div>

      {/* Общий Risk Score */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Общий уровень риска документа</p>
        <div className="flex items-center gap-4">
          <span className={`text-5xl font-black ${riskScoreColor}`}>
            {Math.round(avgRiskScore)}
          </span>
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  avgRiskScore >= 70 ? "bg-red-500" :
                  avgRiskScore >= 40 ? "bg-orange-500" :
                  avgRiskScore >= 20 ? "bg-yellow-500" : "bg-green-500"
                }`}
                style={{ width: `${Math.min(avgRiskScore, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0 — Безопасно</span>
              <span>100 — Критично</span>
            </div>
          </div>
        </div>
      </div>

      {/* Диаграммы */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donut — распределение по риску */}
        {riskData.length > 0 && (
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Распределение по уровню риска</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {riskData.map((entry) => (
                    <Cell key={entry.key} fill={RISK_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${Number(value)} изм.`, String(name)]} />
                <Legend
                  formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bar — по типу изменений */}
        {semanticData.length > 0 && (
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">По типу изменений</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={semanticData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(value) => [`${Number(value)} изм.`, "Количество"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {semanticData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {diffResults.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p>Нет данных для отображения</p>
        </div>
      )}
    </div>
  );
}

// KPI карточка
function KpiCard({ title, value, subtitle, color }: {
  title: string; value: number; subtitle: string; color: "blue" | "red" | "green" | "orange" | "purple";
}) {
  const colorMap = {
    blue:   "text-blue-600 bg-blue-50",
    red:    "text-red-600 bg-red-50",
    green:  "text-green-600 bg-green-50",
    orange: "text-orange-600 bg-orange-50",
    purple: "text-purple-600 bg-purple-50",
  };

  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">{title}</p>
      <p className={`text-3xl font-black mb-1 rounded-lg px-2 py-0.5 w-fit ${colorMap[color]}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
  );
}