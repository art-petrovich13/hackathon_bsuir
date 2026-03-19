// frontend/src/pages/UploadPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, GitCompare, Plus, X } from "lucide-react";
import DropZone from "../components/upload/DropZone";
import { useComparisonStore } from "../store/comparisonStore";
import { createComparison, createChainComparison } from "../api/compare";
import { uploadDocument } from "../api/upload";

export default function UploadPage() {
  const navigate = useNavigate();
  const { docOldId, docNewId, docOldName, docNewName } = useComparisonStore();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"pair" | "chain">("pair");

  // Chain mode состояние
  const [chainSlots, setChainSlots] = useState<Array<{ id: string | null; name: string | null }>>([
    { id: null, name: null },
    { id: null, name: null },
  ]);

  const canCompare = !!docOldId && !!docNewId && !isStarting;
  const canChain = chainSlots.filter((s) => s.id !== null).length >= 2 && !isStarting;

  const handleStartPair = async () => {
    if (!docOldId || !docNewId) return;
    setIsStarting(true);
    setError(null);
    try {
      const result = await createComparison({ doc_old_id: docOldId, doc_new_id: docNewId });
      navigate(`/compare/${result.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Не удалось запустить анализ.");
      setIsStarting(false);
    }
  };

  const handleStartChain = async () => {
    const filledSlots = chainSlots.filter((s) => s.id !== null);
    if (filledSlots.length < 2) return;
    setIsStarting(true);
    setError(null);
    try {
      const result = await createChainComparison({
        document_ids: filledSlots.map((s) => s.id!),
      });
      navigate(`/chain/${result.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Не удалось запустить chain анализ.");
      setIsStarting(false);
    }
  };

  const addChainSlot = () => {
    if (chainSlots.length < 5) {
      setChainSlots([...chainSlots, { id: null, name: null }]);
    }
  };

  const removeChainSlot = (index: number) => {
    if (chainSlots.length > 2) {
      setChainSlots(chainSlots.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Заголовок */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Сравнение нормативных документов
        </h1>
        <p className="text-gray-500">
          Загрузите редакции документа — AI найдёт все изменения и оценит правовые риски
        </p>
      </div>

      {/* Переключатель режимов */}
      <div className="flex justify-center mb-6">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setMode("pair")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === "pair"
                ? "bg-white shadow text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <GitCompare className="w-4 h-4" />
            Сравнить две версии
          </button>
          <button
            onClick={() => setMode("chain")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === "chain"
                ? "bg-white shadow text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Zap className="w-4 h-4" />
            Цепочка версий
          </button>
        </div>
      </div>

      {/* Режим: пара */}
      {mode === "pair" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="card p-5">
              <DropZone slot="old" label="📄 Старая редакция" labelColor="blue" />
              {docOldId && docOldName && (
                <div className="mt-3 flex items-center gap-2 text-xs text-green-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Загружено: {docOldName}
                </div>
              )}
            </div>
            <div className="card p-5">
              <DropZone slot="new" label="📄 Новая редакция" labelColor="green" />
              {docNewId && docNewName && (
                <div className="mt-3 flex items-center gap-2 text-xs text-green-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Загружено: {docNewName}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={handleStartPair}
              disabled={!canCompare}
              className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStarting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Запускаем...
                </>
              ) : (
                <>
                  Запустить AI анализ <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Режим: цепочка */}
      {mode === "chain" && (
        <>
          <div className="card p-5 mb-4">
            <p className="text-sm text-gray-600 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-600" />
              Загрузите от 2 до 5 версий документа в хронологическом порядке.
              AI сравнит каждую пару и покажет эволюцию рисков.
            </p>

            <div className="space-y-3">
              {chainSlots.map((slot, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    v{index + 1}
                  </div>
                  <div className="flex-1 border border-gray-200 rounded-lg p-3 flex items-center gap-3 bg-gray-50">
                    {slot.id ? (
                      <span className="text-sm text-green-700 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                        {slot.name}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Версия {index + 1} не загружена</span>
                    )}
                    {/* TODO: DropZone для chain слотов */}
                  </div>
                  {chainSlots.length > 2 && (
                    <button
                      onClick={() => removeChainSlot(index)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {chainSlots.length < 5 && (
              <button
                onClick={addChainSlot}
                className="mt-3 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <Plus className="w-4 h-4" /> Добавить версию
              </button>
            )}
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleStartChain}
              disabled={!canChain}
              className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStarting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Запускаем...
                </>
              ) : (
                <>
                  Анализировать цепочку <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}