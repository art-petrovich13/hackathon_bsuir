// src/pages/AuditPage.tsx
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { useComparison } from "../hooks/useComparison";
import ProgressStepper from "../components/upload/ProgressStepper";
import DocViewer from "../components/diff/DocViewer";
import SidePanel from "../components/diff/SidePanel";

import { useUiStore } from "../store/uiStore";

export default function AuditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: comparison, isLoading, isError } = useComparison(id);

  const isDone = comparison?.status === "DONE";
  const isProcessing = comparison && !isDone && comparison.status !== "ERROR";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !comparison) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500 font-medium mb-4">Результаты не найдены</p>
        <Link to="/upload" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Назад
        </Link>
      </div>
    );
  }

  // Статистика по нарушениям аудита
  const issues = comparison.diffResults?.filter((r) => r.changeType === "AUDIT_ISSUE") ?? [];
  const okItems = comparison.diffResults?.filter((r) => r.changeType === "AUDIT_OK") ?? [];
  const highRisk = comparison.diffResults?.filter(
    (r) => r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL"
  ) ?? [];
  const riskScore = comparison.totalRiskScore ?? 0;

  const { sidePanelOpen } = useUiStore();

  return (
    <div className={`transition-all duration-200 ${sidePanelOpen ? "mr-[400px]" : ""}`}>
      <div className="max-w-5xl mx-auto">
        {/* Шапка */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/upload" className="btn-secondary inline-flex items-center gap-2 py-1.5 text-sm">
              <ArrowLeft className="w-4 h-4" /> Назад
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-600" />
                Аудит документа
              </h1>
              <p className="text-sm text-gray-500">
                Проверка на соответствие законодательству Республики Беларусь
              </p>
            </div>
          </div>

          {/* Индикатор риска в шапке */}
          {isDone && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Индекс риска</p>
              <p
                className={`text-2xl font-black ${riskScore >= 70
                  ? "text-red-600"
                  : riskScore >= 40
                    ? "text-orange-500"
                    : "text-green-600"
                  }`}
              >
                {riskScore.toFixed(0)}
                <span className="text-sm font-normal text-gray-400">/100</span>
              </p>
            </div>
          )}
        </div>

        {/* Прогресс пока обрабатывается */}
        {isProcessing && id && (
          <div className="mb-6">
            <ProgressStepper
              comparisonId={id}
              currentStatus={comparison.status}
              onDone={() => { }}
            />
            <p className="text-center text-xs text-gray-400 mt-2">
              Анализируем каждый раздел документа...
              Обычно 3–5 минут в зависимости от объёма.
            </p>
          </div>
        )}

        {/* Результаты */}
        {isDone && (
          <>
            {/* KPI карточки */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div
                className={`card p-4 border-l-4 text-center ${issues.length > 0 ? "border-l-red-500" : "border-l-green-500"
                  }`}
              >
                <p className="text-xs text-gray-500 uppercase mb-1">Нарушений</p>
                <p
                  className={`text-3xl font-black ${issues.length > 0 ? "text-red-600" : "text-green-600"
                    }`}
                >
                  {issues.length}
                </p>
              </div>

              <div className="card p-4 border-l-4 border-l-orange-500 text-center">
                <p className="text-xs text-gray-500 uppercase mb-1">Высокий риск</p>
                <p className="text-3xl font-black text-orange-600">{highRisk.length}</p>
              </div>

              <div className="card p-4 border-l-4 border-l-green-400 text-center">
                <p className="text-xs text-gray-500 uppercase mb-1">В порядке</p>
                <p className="text-3xl font-black text-green-600">{okItems.length}</p>
              </div>

              <div className="card p-4 border-l-4 border-l-gray-300 text-center">
                <p className="text-xs text-gray-500 uppercase mb-1">Всего разделов</p>
                <p className="text-3xl font-black text-gray-600">
                  {comparison.diffResults?.length ?? 0}
                </p>
              </div>
            </div>

            {/* Полоса общего риска */}
            <div className="card p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  Общий индекс риска документа
                </p>
                <p
                  className={`text-sm font-bold ${riskScore >= 70
                    ? "text-red-600"
                    : riskScore >= 40
                      ? "text-orange-500"
                      : "text-green-600"
                    }`}
                >
                  {riskScore.toFixed(1)} / 100
                </p>
              </div>
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${riskScore >= 70
                    ? "bg-red-500"
                    : riskScore >= 40
                      ? "bg-orange-400"
                      : "bg-green-500"
                    }`}
                  style={{ width: `${Math.min(riskScore, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0 — нет нарушений</span>
                <span>100 — критический риск</span>
              </div>
            </div>

            {/* Если нарушений нет */}
            {issues.length === 0 && (
              <div className="card p-8 text-center mb-6">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-gray-800 mb-1">
                  Нарушений не обнаружено
                </h2>
                <p className="text-gray-500">
                  Документ соответствует требованиям законодательства Республики
                  Беларусь.
                </p>
              </div>
            )}

            {/* Если нарушения есть — предупреждение */}
            {issues.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  Найдено <strong>{issues.length}</strong> нарушений законодательства
                  Республики Беларусь.
                  {highRisk.length > 0 && (
                    <> Из них <strong>{highRisk.length}</strong> с высоким и критическим риском.</>
                  )}{" "}
                  Кликните на нарушение — справа появятся детали и рекомендация по исправлению.
                </p>
              </div>
            )}

            {/* DocViewer — показывает разделы документа */}
            {comparison.diffResults && comparison.diffResults.length > 0 && (
              <DocViewer
                diffResults={comparison.diffResults}
                mode="audit"
              />
            )}

            {/* SidePanel — детали выбранного раздела */}
            {comparison.diffResults && (
              <SidePanel
                diffResults={comparison.diffResults}
                mode="audit"
              />
            )}

            {/* Дисклеймер */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 leading-relaxed">
                ⚠️ Данный аудит носит информационный характер и не является юридической
                консультацией. AI анализирует каждый раздел документа и сверяет его с
                законодательством Республики Беларусь. Для принятия юридических решений
                обратитесь к квалифицированному юристу.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}