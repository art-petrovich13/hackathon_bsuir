// frontend/src/AppRoutes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import Layout from "./components/layout/Layout";

// Lazy loading — страницы грузятся только при переходе на них
const UploadPage     = lazy(() => import("./pages/UploadPage"));
const ComparePage    = lazy(() => import("./pages/ComparePage"));
const ReportPage     = lazy(() => import("./pages/ReportPage"));
const ProsecutorPage = lazy(() => import("./pages/ProsecutorPage"));
const NotFoundPage   = lazy(() => import("./pages/NotFoundPage"));
const ChainComparePage = lazy(() => import("./pages/ChainComparePage"));
const CompliancePage = lazy(() => import("./pages/CompliancePage"));
const AuditPage      = lazy(() => import("./pages/AuditPage"));

// Лоадер пока страница грузится
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Загрузка...</p>
      </div>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Layout — обёртка для всех страниц (Header + основной контент) */}
        <Route path="/" element={<Layout />}>
          {/* Главная — редирект на /upload */}
          <Route index element={<Navigate to="/upload" replace />} />

          {/* Загрузка документов */}
          <Route path="upload" element={<UploadPage />} />

          {/* Просмотр результатов сравнения */}
          <Route path="compare/:id" element={<ComparePage />} />

          {/* Страница ПРОКУРОРА */}
          <Route path="compare/:id/prosecutor" element={<ProsecutorPage />} />

          {/* Страница отчёта */}
          <Route path="report/:id" element={<ReportPage />} />

          <Route path="chain/:chainId" element={<ChainComparePage />} />
          <Route path="compliance/:id" element={<CompliancePage />} />
<Route path="audit/:id"      element={<AuditPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}