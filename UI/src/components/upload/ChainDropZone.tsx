// src/components/upload/ChainDropZone.tsx
import DropZone from "./DropZone";

interface ChainDropZoneProps {
  /** Индекс слота (0, 1, 2, ...) — для формирования уникального ключа */
  slotIndex: number;
  /** Вызывается когда файл успешно загружен */
  onUploaded: (id: string, name: string) => void;
  /** Вызывается когда файл удалён (сброс слота) */
  onRemoved?: () => void;
}

/**
 * DropZone для одного слота в chain-режиме.
 * Каждый слот имеет уникальный slotKey = "chain-{index}",
 * что гарантирует независимые состояния загрузки.
 */
export default function ChainDropZone({
  slotIndex,
  onUploaded,
  onRemoved,
}: ChainDropZoneProps) {
  // Уникальный ключ для каждого слота — важно для React Query mutationKey
  const slotKey = `chain-${slotIndex}`;

  return (
    <DropZone
      slot={slotKey}
      label={`📄 Версия ${slotIndex + 1}`}
      labelColor={slotIndex === 0 ? "blue" : slotIndex === 1 ? "green" : "purple"}
      onUploaded={(id, name) => {
        onUploaded(id, name);
      }}
    />
  );
}