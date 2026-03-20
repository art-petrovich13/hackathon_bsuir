// frontend/src/components/layout/Layout.tsx
import { Outlet } from "react-router-dom";
import Header from "./Header";

export default function Layout() {
  return (
    <div>
      <main>
        <Outlet />
      </main>
    </div>
  );
}