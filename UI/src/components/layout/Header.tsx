// frontend/src/components/layout/Header.tsx
import { Link, useLocation } from "react-router-dom";
import { Scale, Upload } from "lucide-react";

export default function Header() {
  const location = useLocation();

  const navItems = [
    { to: "/upload", label: "Загрузить", icon: Upload },
  ];

  // Определяем текущий режим для бейджа
  const currentMode = location.pathname.startsWith("/compliance/")
    ? { label: "Режим 3: Соответствие", color: "bg-purple-100 text-purple-700" }
    : location.pathname.startsWith("/audit/")
    ? { label: "Режим 4: Аудит", color: "bg-blue-100 text-blue-700" }
    : location.pathname.startsWith("/chain/")
    ? { label: "Режим 2: Цепочка", color: "bg-indigo-100 text-indigo-700" }
    : location.pathname.startsWith("/compare/")
    ? { label: "Режим 1: Сравнение", color: "bg-primary-100 text-primary-700" }
    : null;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Логотип */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">НПА-Анализатор</span>
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
              AI
            </span>
            {currentMode && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ml-1 hidden sm:inline ${currentMode.color}`}
              >
                {currentMode.label}
              </span>
            )}
          </Link>

          {/* Навигация */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}