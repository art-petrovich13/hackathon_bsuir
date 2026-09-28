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
  { id: "pair",       icon: GitCompare, label: "Сравнить версии",          desc: "Найти изменения между двумя редакциями" },
  { id: "chain",      icon: Zap,        label: "Цепочка версий",           desc: "Проследить эволюцию документа" },
  { id: "compliance", icon: Shield,     label: "Дочерний vs Родительский", desc: "Проверить соответствие вышестоящему НПА" },
  { id: "audit",      icon: Search,     label: "Аудит документа",          desc: "Проверить один документ по законодательству РБ" },
];

export default function UploadPage() {
  const navigate = useNavigate();
  const { docOldId, docNewId, docOldName, docNewName } = useComparisonStore();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<UploadMode>("pair");

  const [chainSlots, setChainSlots] = useState<Array<{ id: string | null; name: string | null }>>([
    { id: null, name: null },
    { id: null, name: null },
  ]);
  const filledChainSlots = chainSlots.filter((s) => s.id !== null);

  const canCompare    = !!docOldId && !!docNewId && !isStarting;
  const canChain      = filledChainSlots.length >= 2 && !isStarting;
  const canCompliance = !!docOldId && !!docNewId && !isStarting;
  const canAudit      = !!docOldId && !isStarting;

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
    setChainSlots((prev) => { const u = [...prev]; u[index] = { id, name }; return u; });
  };

  const handleChainSlotRemoved = (index: number) => {
    setChainSlots((prev) => { const u = [...prev]; u[index] = { id: null, name: null }; return u; });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {/* ── DELTA.AI hero ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2.5rem" }}>

        {/* Стеклянный контейнер с логотипом */}
        <div style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 48px",
          borderRadius: 28,
          marginBottom: 20,
          background: "rgba(255,255,255,0.52)",
          backdropFilter: "blur(36px) saturate(1.9)",
          WebkitBackdropFilter: "blur(36px) saturate(1.9)",
          border: "1px solid rgba(255,255,255,0.85)",
          boxShadow: [
            "inset 0 2px 0 rgba(255,255,255,0.98)",
            "inset 0 -1px 0 rgba(167,139,250,0.18)",
            "inset 1px 0 0 rgba(255,255,255,0.6)",
            "inset -1px 0 0 rgba(200,185,255,0.2)",
            "0 12px 48px rgba(109,40,217,0.16)",
            "0 4px 16px rgba(109,40,217,0.1)",
            "0 1px 4px rgba(109,40,217,0.06)",
          ].join(", "),
          overflow: "hidden",
        }}>
          {/* Декоративные цветовые пятна внутри */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: [
              "radial-gradient(ellipse 65% 55% at 10% 15%, rgba(196,181,253,0.32) 0%, transparent 60%)",
              "radial-gradient(ellipse 55% 50% at 90% 85%, rgba(147,197,253,0.25) 0%, transparent 55%)",
              "radial-gradient(ellipse 40% 35% at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)",
            ].join(", "),
          }} />

          {/* Верхний gloss-штрих */}
          <div style={{
            position: "absolute", top: 0, left: "8%", right: "8%", height: "1.5px",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,1) 40%, rgba(255,255,255,0.7) 70%, transparent)",
            pointerEvents: "none",
          }} />

          {/* DELTA */}
          <span style={{
            fontSize: "clamp(1.9rem, 4.5vw, 2.8rem)",
            fontWeight: 900,
            letterSpacing: "-0.045em",
            lineHeight: 1,
            background: "linear-gradient(140deg, #3b0764 0%, #6d28d9 30%, #7c3aed 55%, #a855f7 80%, #c084fc 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            position: "relative", zIndex: 1,
            // Тень текста через filter
            filter: "drop-shadow(0 2px 8px rgba(109,40,217,0.25))",
          }}>
            DELTA
          </span>

          {/* Точка-разделитель */}
          <span style={{
            fontSize: "clamp(1.9rem, 4.5vw, 2.8rem)",
            fontWeight: 200,
            color: "rgba(167,139,250,0.55)",
            margin: "0 4px 0 2px",
            lineHeight: 1,
            position: "relative", zIndex: 1,
          }}>.</span>

          {/* AI */}
          <span style={{
            fontSize: "clamp(1.9rem, 4.5vw, 2.8rem)",
            fontWeight: 900,
            letterSpacing: "-0.045em",
            lineHeight: 1,
            background: "linear-gradient(140deg, #7c3aed 0%, #a855f7 45%, #e879f9 85%, #f0abfc 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            position: "relative", zIndex: 1,
            filter: "drop-shadow(0 2px 8px rgba(168,85,247,0.3))",
          }}>
            AI
          </span>

          {/* Beta-бейдж */}
          <span style={{
            position: "absolute", top: 11, right: 16,
            fontSize: 9, fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#7c3aed",
            background: "rgba(237,233,254,0.75)",
            border: "1px solid rgba(167,139,250,0.45)",
            borderRadius: 100,
            padding: "2px 7px",
            backdropFilter: "blur(8px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
          }}>
            beta
          </span>
        </div>

        {/* Заголовок и подзаголовок */}
        <h1 style={{
          fontSize: "clamp(1.3rem, 3vw, 1.6rem)",
          fontWeight: 700,
          color: "#1e1040",
          letterSpacing: "-0.025em",
          marginBottom: 6,
          textAlign: "center",
        }}>
          Анализ нормативных документов
        </h1>
        <p style={{ fontSize: 14, color: "rgba(100,80,150,0.65)", textAlign: "center" }}>
          Выберите режим анализа и загрузите документы
        </p>
      </div>

      {/* ── Переключатель режимов ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
        {MODE_CONFIG.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setError(null); }}
            className={`btn-mode ${mode === id ? "active" : ""}`}
          >
            <Icon className={`w-5 h-5 ${mode === id ? "text-violet-600" : "text-gray-400"}`} />
            <span className="text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>

      <p className="text-center text-sm text-gray-500 mb-6 mt-3">
        {MODE_CONFIG.find((m) => m.id === mode)?.desc}
      </p>

      {/* ── РЕЖИМ 1: PAIR ─────────────────────────────────────────────────── */}
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
          {error && <div className="alert-glass alert-red mb-4">{error}</div>}
          <div className="flex justify-center">
            <button onClick={handleStartPair} disabled={!canCompare} className="btn-primary px-8 py-3 text-base">
              {isStarting
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Запускаем...</>
                : <>Запустить AI анализ <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        </>
      )}

      {/* ── РЕЖИМ 2: CHAIN ────────────────────────────────────────────────── */}
      {mode === "chain" && (
        <>
          <div className="card p-5 mb-4">
            <p className="text-sm text-gray-600 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-500" />
              Загрузите от 2 до 5 версий документа в хронологическом порядке.
            </p>
            <div className="space-y-4">
              {chainSlots.map((slot, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                    background: "rgba(237,233,254,0.7)", color: "#6d28d9",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700,
                    border: "1px solid rgba(167,139,250,0.4)",
                    backdropFilter: "blur(8px)",
                  }}>
                    v{index + 1}
                  </div>
                  <div className="flex-1">
                    {slot.id ? (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                        background: "rgba(220,252,231,0.5)", backdropFilter: "blur(8px)",
                        border: "1px solid rgba(74,222,128,0.35)", borderRadius: 12,
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
                      }}>
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
                className="mt-4 flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium">
                <Plus className="w-4 h-4" /> Добавить версию
              </button>
            )}
            <p className="mt-3 text-xs text-gray-400">
              Загружено: {filledChainSlots.length} из {chainSlots.length}
              {filledChainSlots.length < 2 && " (нужно минимум 2)"}
            </p>
          </div>
          {error && <div className="alert-glass alert-red mb-4">{error}</div>}
          <div className="flex justify-center">
            <button onClick={handleStartChain} disabled={!canChain} className="btn-primary px-8 py-3 text-base">
              {isStarting
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Запускаем...</>
                : <>Анализировать цепочку <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        </>
      )}

      {/* ── РЕЖИМ 3: COMPLIANCE ───────────────────────────────────────────── */}
      {mode === "compliance" && (
        <>
          <div className="alert-glass alert-purple mb-4">
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
          {error && <div className="alert-glass alert-red mb-4">{error}</div>}
          <div className="flex justify-center">
            <button onClick={handleStartCompliance} disabled={!canCompliance} className="btn-primary px-8 py-3 text-base">
              {isStarting
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Проверяем...</>
                : <><Shield className="w-5 h-5" /> Проверить соответствие <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        </>
      )}

      {/* ── РЕЖИМ 4: AUDIT ────────────────────────────────────────────────── */}
      {mode === "audit" && (
        <>
          <div className="alert-glass alert-blue mb-4">
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
          {error && <div className="alert-glass alert-red mb-4">{error}</div>}
          <div className="flex justify-center">
            <button onClick={handleStartAudit} disabled={!canAudit} className="btn-primary px-8 py-3 text-base">
              {isStarting
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Анализируем...</>
                : <><Search className="w-5 h-5" /> Запустить аудит <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        </>
      )}

    </div>
  );
}