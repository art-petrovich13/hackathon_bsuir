// src/components/diff/ChangesTable.tsx
import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import RiskBadge from "../risk/RiskBadge";
import { useUiStore } from "../../store/uiStore";
import type { DiffResult, RiskLevel } from "../../types";

interface ChangesTableProps {
  diffResults: DiffResult[];
}

type SortKey = "sectionPath" | "changeType" | "riskLevel" | "riskScore" | "semanticType";
type SortDir = "asc" | "desc";

const RISK_ORDER: Record<string, number> = {
  CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1,
};

const CHANGE_LABELS: Record<string, string> = {
  ADDED: "Добавлено", DELETED: "Удалено", MODIFIED: "Изменено", MOVED: "Перемещено",
};

const CHANGE_COLORS: Record<string, string> = {
  ADDED:    "bg-green-100 text-green-700",
  DELETED:  "bg-red-100 text-red-700",
  MODIFIED: "bg-yellow-100 text-yellow-700",
  MOVED:    "bg-blue-100 text-blue-700",
};

const SEMANTIC_LABELS: Record<string, string> = {
  OBLIGATION_CHANGE: "Обязательность",
  SCOPE_CHANGE:      "Область",
  DEADLINE_CHANGE:   "Сроки",
  SUBJECT_CHANGE:    "Субъект",
  SANCTION_CHANGE:   "Санкции",
  COSMETIC:          "Косметика",
};

export default function ChangesTable({ diffResults }: ChangesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { openSidePanel, filters } = useUiStore();

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Применить фильтры из store
  const filtered = diffResults.filter((r) => {
    if (filters.riskLevels.length > 0 && r.riskLevel && !filters.riskLevels.includes(r.riskLevel)) {
      return false;
    }
    if (filters.changeTypes.length > 0 && !filters.changeTypes.includes(r.changeType)) {
      return false;
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      if (
        !(r.oldText?.toLowerCase().includes(q)) &&
        !(r.newText?.toLowerCase().includes(q)) &&
        !r.sectionPath.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // Сортировка
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "sectionPath":
        cmp = a.sectionPath.localeCompare(b.sectionPath);
        break;
      case "changeType":
        cmp = a.changeType.localeCompare(b.changeType);
        break;
      case "riskLevel":
        cmp = (RISK_ORDER[a.riskLevel ?? ""] ?? 0) - (RISK_ORDER[b.riskLevel ?? ""] ?? 0);
        break;
      case "riskScore":
        cmp = (a.riskScore ?? 0) - (b.riskScore ?? 0);
        break;
      case "semanticType":
        cmp = (a.semanticType ?? "").localeCompare(b.semanticType ?? "");
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 text-primary-600" />
      : <ArrowDown className="w-3 h-3 text-primary-600" />;
  }

  const thClass = "px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap";

  if (sorted.length === 0) {
    return (
      <div className="card text-center py-10 text-gray-400">
        <p className="text-2xl mb-2">🔍</p>
        <p className="font-medium text-gray-600">Нет изменений по фильтру</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className={thClass} onClick={() => handleSort("sectionPath")}>
                <div className="flex items-center gap-1">Раздел <SortIcon col="sectionPath" /></div>
              </th>
              <th className={thClass} onClick={() => handleSort("changeType")}>
                <div className="flex items-center gap-1">Тип <SortIcon col="changeType" /></div>
              </th>
              <th className={thClass} onClick={() => handleSort("semanticType")}>
                <div className="flex items-center gap-1">Семантика <SortIcon col="semanticType" /></div>
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Было / Стало
              </th>
              <th className={thClass} onClick={() => handleSort("riskLevel")}>
                <div className="flex items-center gap-1">Риск <SortIcon col="riskLevel" /></div>
              </th>
              <th className={thClass} onClick={() => handleSort("riskScore")}>
                <div className="flex items-center gap-1">Балл <SortIcon col="riskScore" /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((r) => (
              <tr
                key={r.id}
                onClick={() => openSidePanel(r.id)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {/* Раздел */}
                <td className="px-3 py-3">
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                    {r.sectionPath}
                  </code>
                </td>

                {/* Тип */}
                <td className="px-3 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CHANGE_COLORS[r.changeType] ?? "bg-gray-100 text-gray-600"}`}>
                    {CHANGE_LABELS[r.changeType] ?? r.changeType}
                  </span>
                </td>

                {/* Семантика */}
                <td className="px-3 py-3">
                  <span className="text-xs text-gray-600">
                    {r.semanticType ? (SEMANTIC_LABELS[r.semanticType] ?? r.semanticType) : "—"}
                  </span>
                </td>

                {/* Текст */}
                <td className="px-3 py-3 max-w-xs">
                  {r.oldText && (
                    <p className="text-xs text-gray-400 line-through truncate mb-0.5">
                      {r.oldText.slice(0, 55)}{r.oldText.length > 55 ? "…" : ""}
                    </p>
                  )}
                  {r.newText && (
                    <p className="text-xs text-gray-700 truncate">
                      {r.newText.slice(0, 55)}{r.newText.length > 55 ? "…" : ""}
                    </p>
                  )}
                  {!r.oldText && !r.newText && <span className="text-xs text-gray-300">—</span>}
                </td>

                {/* Риск */}
                <td className="px-3 py-3">
                  {r.riskLevel
                    ? <RiskBadge level={r.riskLevel} size="sm" showIcon={false} />
                    : <span className="text-xs text-gray-300">—</span>
                  }
                </td>

                {/* Балл */}
                <td className="px-3 py-3">
                  {r.riskScore !== null && r.riskScore !== undefined ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            r.riskScore >= 70 ? "bg-red-500" :
                            r.riskScore >= 40 ? "bg-orange-500" :
                            r.riskScore >= 20 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${r.riskScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 font-mono w-6 text-right">
                        {Math.round(r.riskScore)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {sorted.length} из {diffResults.length} изменений
        </p>
        <p className="text-xs text-gray-400">Нажми на строку для деталей</p>
      </div>
    </div>
  );
}