// src/components/upload/FilePreview.tsx
import { FileText, File, X, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface FilePreviewProps {
  file: File;
  isUploading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error?: Error | null;
  onRemove: () => void;
}

export default function FilePreview({
  file,
  isUploading,
  isSuccess,
  isError,
  error,
  onRemove,
}: FilePreviewProps) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const sizeKb = (file.size / 1024).toFixed(1);
  const sizeMb = (file.size / 1024 / 1024).toFixed(1);
  const displaySize = file.size > 1024 * 1024 ? `${sizeMb} МБ` : `${sizeKb} КБ`;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      {/* Иконка типа файла */}
      <div className="flex-shrink-0">
        {ext === "pdf" ? (
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <File className="w-5 h-5 text-red-600" />
          </div>
        ) : (
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
        )}
      </div>

      {/* Имя и размер */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
        <p className="text-xs text-gray-500">{displaySize}</p>

        {/* Прогресс-бар загрузки */}
        {isUploading && (
          <div className="mt-1.5 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full animate-pulse w-3/4" />
          </div>
        )}

        {/* Ошибка */}
        {isError && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error?.message ?? "Ошибка загрузки"}
          </p>
        )}
      </div>

      {/* Статус + кнопка удаления */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isUploading && <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />}
        {isSuccess && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        {isError && <AlertCircle className="w-4 h-4 text-red-500" />}
        {!isUploading && (
          <button
            onClick={onRemove}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Удалить файл"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}