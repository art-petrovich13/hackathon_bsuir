// frontend/src/pages/UploadPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, GitCompare, Plus, X, CheckCircle2 } from "lucide-react";
import DropZone from "../components/upload/DropZone";
import ChainDropZone from "../components/upload/ChainDropZone";
import { useComparisonStore } from "../store/comparisonStore";
import { createComparison, createChainComparison } from "../api/compare";

export default function UploadPage() {
  const navigate = useNavigate();
  const { docOldId, docNewId, docOldName, docNewName } = useComparisonStore();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"pair" | "chain">("pair");

  // Chain mode: массив слотов с состоянием каждого
  // Начинаем с двух пустых слотов — обязательный минимум
  const [chainSlots, setChainSlots] = useState<
    Array<{ id: string | null; name: string | null }>
  >([
    { id: null, name: null },
    { id: null, name: null },
  ]);

  // Pair mode: можно запустить если оба файла загружены
  const canCompare = !!docOldId && !!docNewId && !isStarting;

  // Chain mode: можно запустить если загружено минимум 2 файла
  const filledChainSlots = chainSlots.filter((s) => s.id !== null);
  const canChain = filledChainSlots.length >= 2 && !isStarting;

  // ─── Обработчики ─────────────────────────────────────────────────────────

  const handleStartPair = async () => {
    if (!docOldId || !docNewId) return;
    setIsStarting(true);
    setError(null);
    try {
      const result = await createComparison({
        doc_old_id: docOldId,
        doc_new_id: docNewId,
      });
      navigate(`/compare/${result.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Не удалось запустить анализ. Попробуй снова.");
      setIsStarting(false);
    }
  };

  const handleStartChain = async () => {
    if (filledChainSlots.length < 2) return;
    setIsStarting(true);
    setError(null);
    try {
      const result = await createChainComparison({
        document_ids: filledChainSlots.map((s) => s.id!),
      });
      navigate(`/chain/${result.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Не удалось запустить chain анализ.");
      setIsStarting(false);
    }
  };

  // Обновить слот после загрузки файла
  const handleChainSlotUploaded = (index: number, id: string, name: string) => {
    setChainSlots((prev) => {
      const updated = [...prev];
      updated[index] = { id, name };
      return updated;
    });
  };

  // Сбросить слот (файл удалён)
  const handleChainSlotRemoved = (index: number) => {
    setChainSlots((prev) => {
      const updated = [...prev];
      updated[index] = { id: null, name: null };
      return updated;
    });
  };

  // Добавить ещё один слот (до 5)
  const addChainSlot = () => {
    if (chainSlots.length < 5) {
      setChainSlots((prev) => [...prev, { id: null, name: null }]);
    }
  };

  // Удалить слот (минимум 2 нельзя удалить)
  const removeChainSlot = (index: number) => {
    if (chainSlots.length <= 2) return;
    setChainSlots((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Рендер ──────────────────────────────────────────────────────────────

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

      {/* ─── РЕЖИМ 1: PAIR ─────────────────────────────────────────────────── */}
      {mode === "pair" && (
        <>
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

      {/* ─── РЕЖИМ 2: CHAIN ────────────────────────────────────────────────── */}
      {mode === "chain" && (
        <>
          <div className="card p-5 mb-4">
            <p className="text-sm text-gray-600 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-600" />
              Загрузите от 2 до 5 версий документа в хронологическом порядке.
              AI сравнит каждую пару и покажет эволюцию рисков.
            </p>

            <div className="space-y-4">
              {chainSlots.map((slot, index) => (
                <div key={index} className="flex items-start gap-3">
                  {/* Номер версии */}
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">
                    v{index + 1}
                  </div>

                  {/* Зона загрузки */}
                  <div className="flex-1">
                    {slot.id ? (
                      // Уже загружен — показать статус с возможностью сброса
                      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-green-800 truncate">
                            {slot.name}
                          </p>
                          <p className="text-xs text-green-600">Загружено успешно</p>
                        </div>
                        <button
                          onClick={() => handleChainSlotRemoved(index)}
                          className="text-green-400 hover:text-red-500 transition-colors p-1"
                          title="Заменить файл"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      // Ещё не загружен — показать ChainDropZone
                      <ChainDropZone
                        slotIndex={index}
                        onUploaded={(id, name) =>
                          handleChainSlotUploaded(index, id, name)
                        }
                        onRemoved={() => handleChainSlotRemoved(index)}
                      />
                    )}
                  </div>

                  {/* Кнопка удаления слота (только если слотов больше 2) */}
                  {chainSlots.length > 2 && !slot.id && (
                    <button
                      onClick={() => removeChainSlot(index)}
                      className="text-gray-300 hover:text-red-500 transition-colors mt-1 flex-shrink-0"
                      title="Удалить этот слот"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Кнопка добавить ещё слот */}
            {chainSlots.length < 5 && (
              <button
                onClick={addChainSlot}
                className="mt-4 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Добавить версию
              </button>
            )}

            {/* Счётчик загруженных */}
            <p className="mt-3 text-xs text-gray-400">
              Загружено: {filledChainSlots.length} из {chainSlots.length} версий
              {filledChainSlots.length < 2 && " (нужно минимум 2)"}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

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