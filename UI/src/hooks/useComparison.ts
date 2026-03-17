// src/hooks/useComparison.ts
import { useQuery } from "@tanstack/react-query";
import { getComparison } from "../api/compare";
import type { Comparison, ComparisonStatus } from "../types";

const DONE_STATUSES: ComparisonStatus[] = ["DONE", "ERROR"];

/**
 * Хук для получения и отслеживания статуса сравнения.
 * Автоматически поллит каждые 2 секунды пока статус != DONE/ERROR.
 */
export function useComparison(comparisonId: string | undefined) {
  return useQuery<Comparison, Error>({
    queryKey: ["comparison", comparisonId],
    queryFn: () => getComparison(comparisonId!),
    enabled: !!comparisonId,
    // Поллинг каждые 2 секунды пока не завершено
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || DONE_STATUSES.includes(status)) return false;
      return 2000;
    },
    staleTime: 0,
  });
}