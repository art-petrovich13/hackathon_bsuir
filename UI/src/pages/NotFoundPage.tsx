// frontend/src/pages/NotFoundPage.tsx
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="text-center py-24">
      <p className="text-6xl font-bold text-gray-200 mb-4">404</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Страница не найдена</h1>
      <p className="text-gray-500 mb-6">Такой страницы не существует.</p>
      <Link
        to="/upload"
        className="btn-primary inline-flex items-center gap-2"
      >
        На главную
      </Link>
    </div>
  );
}