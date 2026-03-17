// src/pages/UploadPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";
import DropZone from "../components/upload/DropZone";
import { useComparisonStore } from "../store/comparisonStore";
import { createComparison } from "../api/compare";

export default function UploadPage() {
  const navigate = useNavigate();
  const { docOldId, docNewId, docOldName, docNewName } = useComparisonStore();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Кнопка активна только когда оба документа загружены
  const canCompare = !!docOldId && !!docNewId && !isStarting;

  const handleStartAnalysis = async () => {
    if (!docOldId || !docNewId) return;
    setIsStarting(true);
    setError(null);

    try {
      const result = await createComparison({
        doc_old_id: docOldId,
        doc_new_id: docNewId,
      });
      // Перейти на страницу результатов
      navigate(`/compare/${result.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Не удалось запустить анализ. Попробуй снова.");
      setIsStarting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Заголовок страницы */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Сравнение нормативных документов
        </h1>
        <p className="text-gray-500">
          Загрузите две редакции документа — AI найдёт все изменения и оценит правовые риски
        </p>
      </div>

      {/* Два слота загрузки */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Старая редакция */}
        <div className="card p-5">
          <DropZone
            slot="old"
            label="📄 Старая редакция"
            labelColor="blue"
          />
          {docOldId && docOldName && (
            <div className="mt-3 flex items-center gap-2 text-xs text-green-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Загружено: {docOldName}
            </div>
          )}
        </div>

        {/* Новая редакция */}
        <div className="card p-5">
          <DropZone
            slot="new"
            label="📄 Новая редакция"
            labelColor="green"
          />
          {docNewId && docNewName && (
            <div className="mt-3 flex items-center gap-2 text-xs text-green-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Загружено: {docNewName}
            </div>
          )}
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Кнопка запуска */}
      <div className="flex justify-center">
        <button
          onClick={handleStartAnalysis}
          disabled={!canCompare}
          className={`
            inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-base
            transition-all duration-200
            ${canCompare
              ? "bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {isStarting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Запускаем анализ...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Запустить AI анализ
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Подсказка */}
      {!canCompare && !isStarting && (
        <p className="text-center text-sm text-gray-400 mt-3">
          {!docOldId && !docNewId
            ? "Загрузите обе редакции документа"
            : !docOldId
            ? "Загрузите старую редакцию"
            : "Загрузите новую редакцию"}
        </p>
      )}
    </div>
  );
}