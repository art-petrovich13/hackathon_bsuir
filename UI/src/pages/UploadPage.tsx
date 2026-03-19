// frontend/src/pages/UploadPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, GitCompare, Plus, X, CheckCircle2, Shield, Search } from "lucide-react";
import DropZone from "../components/upload/DropZone";
import ChainDropZone from "../components/upload/ChainDropZone";
import { useComparisonStore } from "../store/comparisonStore";
import {
  createComparison,
  createChainComparison,
  createComplianceCheck,
  createAudit,
} from "../api/compare";

type UploadMode = "pair" | "chain" | "compliance" | "audit";

const MODE_CONFIG: Array<{
  id: UploadMode;
  icon: React.FC<{ className?: string }>;
  label: string;
  desc: string;
}> = [
  { id: "pair",       icon: GitCompare, label: "Сравнить версии",      desc: "Найти изменения между двумя редакциями" },
  { id: "chain",      icon: Zap,        label: "Цепочка версий",       desc: "Проследить эволюцию документа" },
  { id: "compliance", icon: Shield,     label: "Дочерний vs Родительский", desc: "Проверить соответствие вышестоящему НПА" },
  { id: "audit",      icon: Search,     label: "Аудит документа",      desc: "Проверить один документ по законодательству РБ" },
];

export default function UploadPage() {
  const navigate = useNavigate();
  const { docOldId, docNewId, docOldName, docNewName } = useComparisonStore();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<UploadMode>("pair");

  // Chain mode
  const [chainSlots, setChainSlots] = useState<Array<{ id: string | null; name: string | null }>>([
    { id: null, name: null },
    { id: null, name: null },
  ]);
  const filledChainSlots = chainSlots.filter((s) => s.id !== null);

  // Режим 3: compliance — переиспользуем docOldId (родительский) и docNewId (дочерний)
  // из comparisonStore, которые уже заполняются через DropZone slot="old" и slot="new"

  // Режим 4: audit — только docOldId (один документ)

  const canCompare    = !!docOldId && !!docNewId && !isStarting;
  const canChain      = filledChainSlots.length >= 2 && !isStarting;
  const canCompliance = !!docOldId && !!docNewId && !isStarting;
  const canAudit      = !!docOldId && !isStarting;

  // ─── Обработчики ──────────────────────────────────────────────────────────

  const handleStartPair = async () => {
    if (!docOldId || !docNewId) return;
    setIsStarting(true); setError(null);
    try {
      const result = await createComparison({ doc_old_id: docOldId, doc_new_id: docNewId });
      navigate(`/compare/${result.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Не удалось запустить анализ.");
      setIsStarting(false);
    }
  };

  const handleStartChain = async () => {
    if (filledChainSlots.length < 2) return;
    setIsStarting(true); setError(null);
    try {
      const result = await createChainComparison({ document_ids: filledChainSlots.map((s) => s.id!) });
      navigate(`/chain/${result.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Не удалось запустить chain анализ.");
      setIsStarting(false);
    }
  };

  const handleStartCompliance = async () => {
    if (!docOldId || !docNewId) return;
    setIsStarting(true); setError(null);
    try {
      const result = await createComplianceCheck({ parent_doc_id: docOldId, child_doc_id: docNewId });
      navigate(`/compliance/${result.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Не удалось запустить проверку соответствия.");
      setIsStarting(false);
    }
  };

  const handleStartAudit = async () => {
    if (!docOldId) return;
    setIsStarting(true); setError(null);
    try {
      const result = await createAudit({ doc_id: docOldId });
      navigate(`/audit/${result.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Не удалось запустить аудит.");
      setIsStarting(false);
    }
  };

  const handleChainSlotUploaded = (index: number, id: string, name: string) => {
    setChainSlots((prev) => {
      const updated = [...prev];
      updated[index] = { id, name };
      return updated;
    });
  };

  const handleChainSlotRemoved = (index: number) => {
    setChainSlots((prev) => {
      const updated = [...prev];
      updated[index] = { id: null, name: null };
      return updated;
    });
  };

  // ─── Рендер ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto">
      {/* Заголовок */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Анализ нормативных документов
        </h1>
        <p className="text-gray-500">
          Выберите режим анализа и загрузите документы
        </p>
      </div>

      {/* Переключатель режимов — 4 кнопки в 2 ряда */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        {MODE_CONFIG.map(({ id, icon: Icon, label, desc }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setError(null); }}
            className={`
              flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all
              ${mode === id
                ? "border-primary-500 bg-primary-50 text-primary-700 shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }
            `}
          >
            <Icon className={`w-5 h-5 ${mode === id ? "text-primary-600" : "text-gray-400"}`} />
            <span className="text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Описание выбранного режима */}
      <p className="text-center text-sm text-gray-500 mb-6">
        {MODE_CONFIG.find((m) => m.id === mode)?.desc}
      </p>

      {/* ─── РЕЖИМ 1: PAIR ──────────────────────────────────────────────────── */}
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
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
          <div className="flex justify-center">
            <button onClick={handleStartPair} disabled={!canCompare}
              className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed">
              {isStarting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Запускаем...</> : <>Запустить AI анализ <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        </>
      )}

      {/* ─── РЕЖИМ 2: CHAIN ─────────────────────────────────────────────────── */}
      {mode === "chain" && (
        <>
          <div className="card p-5 mb-4">
            <p className="text-sm text-gray-600 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-600" />
              Загрузите от 2 до 5 версий документа в хронологическом порядке.
            </p>
            <div className="space-y-4">
              {chainSlots.map((slot, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">
                    v{index + 1}
                  </div>
                  <div className="flex-1">
                    {slot.id ? (
                      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-green-800 truncate">{slot.name}</p>
                          <p className="text-xs text-green-600">Загружено</p>
                        </div>
                        <button onClick={() => handleChainSlotRemoved(index)} className="text-green-400 hover:text-red-500 transition-colors p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <ChainDropZone
                        key={`chain-slot-${index}-empty`}
                        slotIndex={index}
                        onUploaded={(id, name) => handleChainSlotUploaded(index, id, name)}
                        onRemoved={() => handleChainSlotRemoved(index)}
                      />
                    )}
                  </div>
                  {chainSlots.length > 2 && !slot.id && (
                    <button onClick={() => setChainSlots((p) => p.filter((_, i) => i !== index))}
                      className="text-gray-300 hover:text-red-500 transition-colors mt-1 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {chainSlots.length < 5 && (
              <button onClick={() => setChainSlots((p) => [...p, { id: null, name: null }])}
                className="mt-4 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
                <Plus className="w-4 h-4" /> Добавить версию
              </button>
            )}
            <p className="mt-3 text-xs text-gray-400">
              Загружено: {filledChainSlots.length} из {chainSlots.length}{filledChainSlots.length < 2 && " (нужно минимум 2)"}
            </p>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
          <div className="flex justify-center">
            <button onClick={handleStartChain} disabled={!canChain}
              className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed">
              {isStarting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Запускаем...</> : <>Анализировать цепочку <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        </>
      )}

      {/* ─── РЕЖИМ 3: COMPLIANCE ────────────────────────────────────────────── */}
      {mode === "compliance" && (
        <>
          <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
            <p className="font-semibold mb-1">Как работает этот режим:</p>
            <p>AI проверит каждый раздел дочернего ЛНА на соответствие родительскому НПА и государственному законодательству РБ.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="card p-5">
              <DropZone slot="old" label="🏛 Родительский НПА" labelColor="purple" />
              {docOldId && docOldName && (
                <div className="mt-3 flex items-center gap-2 text-xs text-green-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Загружено: {docOldName}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">НПА материнской компании / холдинга</p>
            </div>
            <div className="card p-5">
              <DropZone slot="new" label="📄 Дочерний ЛНА" labelColor="blue" />
              {docNewId && docNewName && (
                <div className="mt-3 flex items-center gap-2 text-xs text-green-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Загружено: {docNewName}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">ЛНА дочерней организации</p>
            </div>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
          <div className="flex justify-center">
            <button onClick={handleStartCompliance} disabled={!canCompliance}
              className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed">
              {isStarting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Проверяем...</> : <><Shield className="w-5 h-5" /> Проверить соответствие <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        </>
      )}

      {/* ─── РЕЖИМ 4: AUDIT ─────────────────────────────────────────────────── */}
      {mode === "audit" && (
        <>
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <p className="font-semibold mb-1">Как работает этот режим:</p>
            <p>AI определит категорию вашего документа и проверит каждый раздел на соответствие государственному законодательству РБ.</p>
          </div>
          <div className="max-w-md mx-auto card p-5 mb-6">
            <DropZone slot="old" label="📄 Документ для аудита" labelColor="blue" />
            {docOldId && docOldName && (
              <div className="mt-3 flex items-center gap-2 text-xs text-green-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Загружено: {docOldName}
              </div>
            )}
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
          <div className="flex justify-center">
            <button onClick={handleStartAudit} disabled={!canAudit}
              className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed">
              {isStarting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Анализируем...</> : <><Search className="w-5 h-5" /> Запустить аудит <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}