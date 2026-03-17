// frontend/src/pages/ProsecutorPage.tsx
import { useParams } from "react-router-dom";

export default function ProsecutorPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="text-center py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">⚖️ ПРОКУРОР</h1>
      <p className="text-gray-500">
        Сравнение ID: <code className="bg-gray-100 px-2 py-1 rounded">{id}</code>
      </p>
      <p className="text-gray-400 mt-2 text-sm">
        TODO День 5: ProsecutorAlert + финансовые риски
      </p>
    </div>
  );
}