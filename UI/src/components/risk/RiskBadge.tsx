// src/components/risk/RiskBadge.tsx
import { CheckCircle, AlertCircle, AlertTriangle, XCircle } from "lucide-react";
import type { RiskLevel } from "../../types";

interface RiskBadgeProps {
  level: RiskLevel;
  showIcon?: boolean;
  size?: "sm" | "md";
}

const RISK_CONFIG: Record<RiskLevel, {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  Icon: React.FC<{ className?: string }>;
}> = {
  LOW: {
    label: "Низкий",
    bgClass: "bg-green-50",
    textClass: "text-green-700",
    borderClass: "border-green-200",
    Icon: CheckCircle,
  },
  MEDIUM: {
    label: "Средний",
    bgClass: "bg-yellow-50",
    textClass: "text-yellow-700",
    borderClass: "border-yellow-200",
    Icon: AlertCircle,
  },
  HIGH: {
    label: "Высокий",
    bgClass: "bg-orange-50",
    textClass: "text-orange-700",
    borderClass: "border-orange-200",
    Icon: AlertTriangle,
  },
  CRITICAL: {
    label: "Критический",
    bgClass: "bg-red-50",
    textClass: "text-red-700",
    borderClass: "border-red-200",
    Icon: XCircle,
  },
};

export default function RiskBadge({ level, showIcon = true, size = "md" }: RiskBadgeProps) {
  const config = RISK_CONFIG[level];
  const { Icon } = config;

  const sizeClass = size === "sm"
    ? "px-2 py-0.5 text-xs gap-1"
    : "px-2.5 py-1 text-sm gap-1.5";

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${sizeClass}
        ${config.bgClass}
        ${config.textClass}
        ${config.borderClass}
      `}
    >
      {showIcon && <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />}
      {config.label}
    </span>
  );
}