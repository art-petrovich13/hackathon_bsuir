// src/hooks/useUpload.ts
import { useMutation } from "@tanstack/react-query";
import { useComparisonStore } from "../store/comparisonStore";
import { uploadDocument } from "../api/upload";
import type { UploadResponse } from "../types";

/**
 * Хук для загрузки файла на сервер.
 * Автоматически сохраняет doc_old_id или doc_new_id в Zustand store.
 */
export function useUpload(slot: "old" | "new") {
  const { setDocOld, setDocNew } = useComparisonStore();

  const mutation = useMutation<UploadResponse, Error, File>({
    mutationFn: (file: File) => uploadDocument(file),
    onSuccess: (data) => {
      if (slot === "old") {
        setDocOld(data.id, data.name);
      } else {
        setDocNew(data.id, data.name);
      }
    },
  });

  return {
    upload: mutation.mutate,           // (file: File) => void
    uploadAsync: mutation.mutateAsync, // (file: File) => Promise<UploadResponse>
    isUploading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    documentId: mutation.data?.id ?? null,
    reset: mutation.reset,
  };
}