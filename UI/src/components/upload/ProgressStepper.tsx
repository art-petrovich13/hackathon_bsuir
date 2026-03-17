// src/components/upload/ProgressStepper.tsx
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Circle, XCircle } from "lucide-react";
import type { ComparisonStatus } from "../../types";

interface Step {
  id: ComparisonStatus | "UPLOAD";
  label: string;
  description: string;
}

const STEPS: Step[] = [
  { id: "UPLOAD",    label: "Загрузка",  description: "Файлы загружены на сервер" },
  { id: "PARSING",   label: "Парсинг",   description: "Извлечение структуры документов" },
  { id: "ANALYZING", label: "AI Анализ", description: "Семантический анализ изменений" },
  { id: "DONE",      label: "Готово",    description: "Анализ завершён" },
];

interface ProgressStepperProps {
  comparisonId: string;
  onDone?: () => void;
}

export default function ProgressStepper({ comparisonId, onDone }: ProgressStepperProps) {
  const [currentStatus, setCurrentStatus] = useState<string>("PENDING");
  const [message, setMessage] = useState<string>("Ожидание...");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!comparisonId) return;

    // Подключиться к WebSocket
    const wsUrl = `ws://localhost:8000/ws/compare/${comparisonId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setCurrentStatus("PARSING");
      setMessage("Подключено. Ожидаем начала обработки...");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setCurrentStatus(data.status);
        setMessage(data.message || "");

        if (data.status === "DONE") {
          onDone?.();
          ws.close();
        }
        if (data.status === "ERROR") {
          setHasError(true);
          ws.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      // WebSocket ещё не готов или недоступен — fallback на polling
      setMessage("Обрабатываем...");
    };

    ws.onclose = () => {
      // WebSocket закрылся нормально
    };

    return () => {
      ws.close();
    };
  }, [comparisonId, onDone]);

  const getStepIndex = (status: string): number => {
    const map: Record<string, number> = {
      PENDING: 0, UPLOAD: 0, PARSING: 1, ANALYZING: 2, DONE: 3,
    };
    return map[status] ?? 0;
  };

  const activeIndex = getStepIndex(currentStatus);

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Прогресс анализа</h3>

      {/* Шаги */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => {
          const isDone = i < activeIndex || (currentStatus === "DONE" && i === 3);
          const isActive = i === activeIndex && currentStatus !== "DONE";
          const isError = hasError && i === activeIndex;

          return (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              {/* Иконка шага */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                    ${isDone ? "bg-green-500" : ""}
                    ${isActive && !isError ? "bg-primary-500 animate-pulse" : ""}
                    ${isError ? "bg-red-500" : ""}
                    ${!isDone && !isActive && !isError ? "bg-gray-200" : ""}
                  `}
                >
                  {isError && <XCircle className="w-4 h-4 text-white" />}
                  {isDone && <CheckCircle2 className="w-4 h-4 text-white" />}
                  {isActive && !isError && <Loader2 className="w-4 h-4 text-white animate-spin" />}
                  {!isDone && !isActive && !isError && (
                    <span className="text-xs font-bold text-gray-500">{i + 1}</span>
                  )}
                </div>
                <span
                  className={`text-xs font-medium text-center
                    ${isDone ? "text-green-600" : ""}
                    ${isActive ? "text-primary-600" : ""}
                    ${!isDone && !isActive ? "text-gray-400" : ""}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* Линия соединения (кроме последнего шага) */}
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mb-5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full bg-green-500 transition-all duration-700 ${
                      i < activeIndex ? "w-full" : "w-0"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Текущий статус */}
      <p className="mt-3 text-xs text-gray-500 text-center">
        {hasError ? (
          <span className="text-red-500">Ошибка: {message}</span>
        ) : (
          message
        )}
      </p>
    </div>
  );
}