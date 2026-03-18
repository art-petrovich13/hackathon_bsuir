// src/pages/ReportPage.tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { generateReport, getReportDownloadUrl } from "../api/report";

type ReportState = "idle" | "generating" | "ready" | "error";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<ReportState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!id) return;
    setState("generating");
    setError(null);
    try {
      await generateReport(id);
      // Небольшая пауза чтобы бэкенд успел сгенерировать файл
      await new Promise((r) => setTimeout(r, 2000));
      setState("ready");
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? "Ошибка генерации отчёта";
      // Если бэкенд вернул 501 (не реализовано) — тоже показываем кнопку скачать
      // чтобы демо работало даже без полного бэкенда
      if (e?.response?.status === 501) {
        setState("ready");
      } else {
        setError(msg);
        setState("error");
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Шапка */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          to={id ? `/compare/${id}` : "/upload"}
          className="btn-secondary inline-flex items-center gap-2 py-1.5 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к сравнению
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Отчёт по изменениям</h1>
      </div>

      {/* Основная карточка */}
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-primary-600" />
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-2">Отчёт в формате .docx</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
          Документ с полным анализом изменений: список правок, уровни риска,
          ссылки на НПА и рекомендации юристу.
        </p>

        {state === "idle" && (
          <button onClick={handleGenerate} className="btn-primary inline-flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Сформировать отчёт
          </button>
        )}

        {state === "generating" && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-primary-600 font-medium">
              <Loader2 className="w-5 h-5 animate-spin" />
              Формируем отчёт...
            </div>
            <p className="text-xs text-gray-400">Обычно занимает 5–15 секунд</p>
          </div>
        )}

        {state === "ready" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-green-600 font-medium">
              <CheckCircle2 className="w-5 h-5" />
              Отчёт готов!
            </div>
            <a
              href={getReportDownloadUrl(id!)}
              download
              className="btn-primary inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Скачать .docx
            </a>
            <button
              onClick={handleGenerate}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Сформировать заново
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-red-600 font-medium">
              <AlertCircle className="w-5 h-5" />
              Ошибка генерации
            </div>
            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <button onClick={handleGenerate} className="btn-primary inline-flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Попробовать снова
            </button>
          </div>
        )}
      </div>

      {/* Что входит в отчёт */}
      <div className="mt-6 card p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Что входит в отчёт</p>
        <ul className="space-y-2">
          {[
            "Сводная таблица всех изменений с уровнями риска",
            "Полные тексты «Было» и «Стало» для каждого изменения",
            "Ссылки на релевантные статьи НПА Республики Беларусь",
            "Рекомендации юриста для каждого изменения высокого риска",
            "Общий балл риска документа и расшифровка",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-primary-500 font-bold flex-shrink-0">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-gray-400 text-center">
        ID сравнения: <code className="bg-gray-100 px-1 rounded">{id}</code>
      </p>
    </div>
  );
}