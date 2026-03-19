// src/components/diff/DiffViewer.tsx
// ВАЖНО: SidePanel здесь НЕ рендерится — он рендерится в ComparePage.tsx
// DiffViewer используется только как "список карточек" внутри DocViewer (сворачиваемый блок)
import DiffBlock from "./DiffBlock";
import { useUiStore } from "../../store/uiStore";
import type { DiffResult } from "../../types";

interface DiffViewerProps {
  diffResults: DiffResult[];
}

export default function DiffViewer({ diffResults }: DiffViewerProps) {
  const { selectedDiffId, openSidePanel, filters } = useUiStore();

  const filtered = diffResults.filter((r) => {
    if (
      filters.riskLevels.length > 0 &&
      r.riskLevel &&
      !filters.riskLevels.includes(r.riskLevel)
    ) {
      return false;
    }
    if (
      filters.changeTypes.length > 0 &&
      !filters.changeTypes.includes(r.changeType)
    ) {
      return false;
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const inOld = r.oldText?.toLowerCase().includes(q) ?? false;
      const inNew = r.newText?.toLowerCase().includes(q) ?? false;
      const inPath = r.sectionPath.toLowerCase().includes(q);
      if (!inOld && !inNew && !inPath) return false;
    }
    return true;
  });

  if (diffResults.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">🎉</p>
        <p className="font-semibold text-gray-600">Изменений не найдено</p>
        <p className="text-sm mt-1">Документы идентичны</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <p className="text-2xl mb-2">🔍</p>
        <p className="font-medium text-gray-600">Нет изменений по фильтру</p>
        <p className="text-sm mt-1">Попробуй изменить критерии фильтрации</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-500">
        Показано{" "}
        <span className="font-semibold text-gray-800">{filtered.length}</span>{" "}
        из{" "}
        <span className="font-semibold text-gray-800">{diffResults.length}</span>{" "}
        изменений
      </p>
      {filtered.map((result) => (
        <DiffBlock
          key={result.id}
          result={result}
          isSelected={selectedDiffId === result.id}
          onClick={() => openSidePanel(result.id)}
        />
      ))}
      {/* SidePanel убран отсюда — он рендерится в ComparePage.tsx */}
    </div>
  );
}