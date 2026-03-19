// src/components/upload/DropZone.tsx
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, File } from "lucide-react";
import FilePreview from "./FilePreview";
import { useUpload } from "../../hooks/useUpload";

interface DropZoneProps {
  /**
   * Ключ слота. Значения:
   * "old" / "new" — для pair-режима (автосохранение в Zustand store)
   * "chain-0", "chain-1", ... — для chain-режима (без автосохранения)
   * "compliance-parent", "compliance-child" — для режима 3
   * Любая другая строка — без автосохранения в store
   */
  slot: string;
  label: string;
  labelColor?: "blue" | "green" | "purple";
  /** Вызывается после успешной загрузки — передаёт id и имя файла */
  onUploaded?: (documentId: string, documentName: string) => void;
}

export default function DropZone({
  slot,
  label,
  labelColor = "blue",
  onUploaded,
}: DropZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { upload, isUploading, isSuccess, isError, error, reset } = useUpload(slot);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      setSelectedFile(file);
      upload(file, {
        onSuccess: (data) => {
          // Передать id и name вызывающему компоненту
          onUploaded?.(data.id, data.name);
        },
      });
    },
    [upload, onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleRemove = () => {
    setSelectedFile(null);
    reset();
  };

  const titleColorClass =
    labelColor === "green"
      ? "text-green-700 bg-green-50 border-green-200"
      : labelColor === "purple"
      ? "text-purple-700 bg-purple-50 border-purple-200"
      : "text-blue-700 bg-blue-50 border-blue-200";

  return (
    <div className="flex flex-col gap-3">
      {/* Заголовок слота */}
      <div className={`px-3 py-1.5 rounded-lg border text-sm font-semibold w-fit ${titleColorClass}`}>
        {label}
      </div>

      {/* Зона загрузки или превью файла */}
      {selectedFile ? (
        <FilePreview
          file={selectedFile}
          isUploading={isUploading}
          isSuccess={isSuccess}
          isError={isError}
          error={error}
          onRemove={handleRemove}
        />
      ) : (
        <div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-200
            ${
              isDragActive
                ? "border-primary-500 bg-primary-50 scale-[1.02]"
                : "border-gray-300 bg-white hover:border-primary-400 hover:bg-gray-50"
            }
          `}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <File className="w-5 h-5 text-red-600" />
              </div>
            </div>

            {isDragActive ? (
              <p className="text-primary-600 font-semibold text-sm">Отпустите файл здесь</p>
            ) : (
              <div>
                <p className="text-gray-700 font-medium text-sm">
                  Перетащите файл или{" "}
                  <span className="text-primary-600 underline underline-offset-2">выберите</span>
                </p>
                <p className="text-gray-400 text-xs mt-1">.docx или .pdf · до 50 МБ</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}