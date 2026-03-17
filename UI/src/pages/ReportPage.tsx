// frontend/src/pages/ReportPage.tsx
import { useParams } from "react-router-dom";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="text-center py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Отчёт</h1>
      <p className="text-gray-500">
        ID: <code className="bg-gray-100 px-2 py-1 rounded">{id}</code>
      </p>
      <p className="text-gray-400 mt-2 text-sm">
        TODO День 4: скачивание .docx отчёта
      </p>
    </div>
  );
}