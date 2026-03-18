// src/components/diff/ChangeMarker.tsx

interface ChangeMarkerProps {
  words: string[];
  type: "deleted" | "added" | "equal";
}

/**
 * Отображает список слов с цветовой маркировкой:
 * - deleted: красный фон + зачёркивание
 * - added:   зелёный фон
 * - equal:   без подсветки
 */
export default function ChangeMarker({ words, type }: ChangeMarkerProps) {
  if (words.length === 0) return null;

  const text = words.join(" ");

  if (type === "deleted") {
    return (
      <span className="bg-red-100 text-red-800 line-through decoration-red-400 rounded px-0.5 mx-0.5">
        {text}
      </span>
    );
  }

  if (type === "added") {
    return (
      <span className="bg-green-100 text-green-800 rounded px-0.5 mx-0.5">
        {text}
      </span>
    );
  }

  return <span>{text} </span>;
}