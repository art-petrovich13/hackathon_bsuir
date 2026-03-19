// frontend/src/pages/ChainComparePage.tsx
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { useChain } from "../hooks/useChain";

const TREND_CONFIG = {
  INCREASING_RISK: {
    icon: TrendingUp,
    label: "Риск нарастает",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
  DECREASING_RISK: {
    icon: TrendingDown,
    label: "Риск снижается",
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
  },
  STABLE: {
    icon: Minus,
    label: "Риск стабилен",
    color: "text-gray-600",
    bg: "bg-gray-50 border-gray-200",
  },
};

export default function ChainComparePage() {
  const { chainId } = useParams<{ chainId: string }>();
  const { data: chain, isLoading } = useChain(chainId);

  if (isLoading || !chain) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const trend = TREND_CONFIG[chain.trend];
  const TrendIcon = trend.icon;
  const isAnalyzing = chain.status !== "DONE";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/upload" className="btn-secondary inline-flex items-center gap-2 py-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Назад
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Анализ цепочки версий</h1>
          <p className="text-sm text-gray-500">{chain.documentCount} версии документа</p>
        </div>
      </div>

      {isAnalyzing && (
        <div className="card p-4 mb-6 border-l-4 border-l-primary-500">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">
              Анализируем {chain.versions.filter((v) => v.status !== "DONE").length} из {chain.versions.length} пар...
            </p>
          </div>
        </div>
      )}

      {/* Тренд */}
      <div className={`card p-5 mb-6 border ${trend.bg}`}>
        <div className="flex items-center gap-3">
          <TrendIcon className={`w-6 h-6 ${trend.color}`} />
          <div>
            <p className={`text-lg font-bold ${trend.color}`}>{trend.label}</p>
            <p className="text-sm text-gray-500">
              Средний индекс риска: {chain.avgRiskScore.toFixed(1)}/100
            </p>
          </div>
        </div>
      </div>

      {/* Timeline версий */}
      <div className="space-y-4">
        {chain.versions.map((version, index) => (
          <div key={version.comparisonId} className="flex gap-4">
            {/* Линия */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                version.status === "DONE"
                  ? "bg-primary-500 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}>
                {index + 1}
              </div>
              {index < chain.versions.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 mt-2" />
              )}
            </div>

            {/* Карточка */}
            <div className="flex-1 card p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-800">{version.versionPair}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  version.status === "DONE"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {version.status === "DONE" ? "Готово" : "Анализируется..."}
                </span>
              </div>

              {version.status === "DONE" && (
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Изменений: <strong>{version.changesCount}</strong></span>
                  <span>Высокий риск: <strong className="text-red-600">{version.highCritical}</strong></span>
                  <span>Score: <strong>{version.riskScore.toFixed(0)}/100</strong></span>
                  <Link
                    to={`/compare/${version.comparisonId}`}
                    className="ml-auto text-primary-600 hover:text-primary-700 flex items-center gap-1 text-xs font-medium"
                  >
                    Открыть <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Мини бар риска */}
              {version.status === "DONE" && (
                <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      version.riskScore >= 70 ? "bg-red-500" :
                      version.riskScore >= 40 ? "bg-orange-400" : "bg-green-400"
                    }`}
                    style={{ width: `${version.riskScore}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}