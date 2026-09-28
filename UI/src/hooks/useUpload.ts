// src/hooks/useUpload.ts
import { useMutation } from "@tanstack/react-query";
import { useComparisonStore } from "../store/comparisonStore";
import { uploadDocument } from "../api/upload";
import type { UploadResponse } from "../types";

/**
 * Хук для загрузки файла на сервер.
 *
 * Режим 1 (pair): useUpload("old") или useUpload("new") —
 * автоматически сохраняет doc_old_id / doc_new_id в Zustand store.
 *
 * Режим chain: useUpload("chain-0"), useUpload("chain-1") и т.д. —
 * НЕ сохраняет в store (управляется через onSuccess в DropZone/ChainDropZone).
 */
export function useUpload(slotKey: string) {
  const { setDocOld, setDocNew } = useComparisonStore();

  const mutation = useMutation<UploadResponse, Error, File>({
    // mutationKey уникален для каждого слота — иначе React Query будет
    // считать их одной мутацией и сбрасывать состояние предыдущих
    mutationKey: ["upload", slotKey],
    mutationFn: (file: File) => uploadDocument(file),
    onSuccess: (data) => {
      // Автосохранение в store только для стандартных слотов pair-режима
      if (slotKey === "old") {
        setDocOld(data.id, data.name);
      } else if (slotKey === "new") {
        setDocNew(data.id, data.name);
      }
      // Для "chain-0", "chain-1" и т.д. — состояние управляется через колбэк onSuccess в компоненте
    },
  });

  return {
    upload: mutation.mutate,           // (file: File, options?: MutateOptions) => void
    uploadAsync: mutation.mutateAsync, // (file: File) => Promise<UploadResponse>
    isUploading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    documentId: mutation.data?.id ?? null,
    documentName: mutation.data?.name ?? null,
    reset: mutation.reset,
  };
}