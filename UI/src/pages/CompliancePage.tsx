// src/pages/CompliancePage.tsx
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Shield, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useComparison } from "../hooks/useComparison";
import { useUiStore } from "../store/uiStore";
import ProgressStepper from "../components/upload/ProgressStepper";
import DocViewer from "../components/diff/DocViewer";
import SidePanel from "../components/diff/SidePanel";
import type { DiffResult } from "../types";

export default function CompliancePage() {
  const { id } = useParams<{ id: string }>();
  const { data: comparison, isLoading, isError } = useComparison(id);

  const isDone = comparison?.status === "DONE";
  const isProcessing = comparison && !isDone && comparison.status !== "ERROR";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
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

  // Статистика по нарушениям
  const violations    = comparison.diffResults?.filter((r) => r.changeType === "COMPLIANCE_VIOLATION") ?? [];
  const warnings      = comparison.diffResults?.filter((r) => r.changeType === "COMPLIANCE_WARNING") ?? [];
  const compliant     = comparison.diffResults?.filter((r) => r.changeType === "COMPLIANT") ?? [];
  const criticalHigh  = comparison.diffResults?.filter((r) => r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL") ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/upload" className="btn-secondary inline-flex items-center gap-2 py-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Проверка соответствия
            </h1>
            <p className="text-sm text-gray-500">Дочерний ЛНА vs Родительский НПА</p>
          </div>
        </div>
        {isDone && criticalHigh.length > 0 && (
          <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-3 py-1 rounded-full font-medium animate-pulse">
            ⚠ {criticalHigh.length} критических нарушений
          </span>
        )}
      </div>

      {/* Прогресс пока обрабатывается */}
      {isProcessing && id && (
        <div className="mb-6">
          <ProgressStepper comparisonId={id} currentStatus={comparison.status} onDone={() => {}} />
          <p className="text-center text-xs text-gray-400 mt-2">
            Проверяем каждый раздел дочернего ЛНА... Обычно занимает 2–4 минуты.
          </p>
        </div>
      )}

      {/* Результаты */}
      {isDone && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-4 border-l-4 border-l-red-500 text-center">
              <p className="text-xs text-gray-500 uppercase mb-1">Нарушений</p>
              <p className="text-3xl font-black text-red-600">{violations.length}</p>
            </div>
            <div className="card p-4 border-l-4 border-l-orange-400 text-center">
              <p className="text-xs text-gray-500 uppercase mb-1">Предупреждений</p>
              <p className="text-3xl font-black text-orange-600">{warnings.length}</p>
            </div>
            <div className="card p-4 border-l-4 border-l-green-500 text-center">
              <p className="text-xs text-gray-500 uppercase mb-1">Соответствует</p>
              <p className="text-3xl font-black text-green-600">{compliant.length}</p>
            </div>
          </div>

          {/* Сообщение если всё хорошо */}
          {violations.length === 0 && warnings.length === 0 && (
            <div className="card p-8 text-center mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-gray-800 mb-1">Нарушений не обнаружено</h2>
              <p className="text-gray-500">Дочерний ЛНА соответствует родительскому НПА и законодательству РБ.</p>
            </div>
          )}

          {/* DocViewer с нарушениями */}
          {comparison.diffResults && comparison.diffResults.length > 0 && (
            <DocViewer diffResults={comparison.diffResults} mode="compliance" />
          )}

          {/* SidePanel */}
          {comparison.diffResults && (
            <SidePanel diffResults={comparison.diffResults} mode="compliance" />
          )}
        </>
      )}
    </div>
  );
}