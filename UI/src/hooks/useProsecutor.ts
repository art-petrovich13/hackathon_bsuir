// frontend/src/hooks/useProsecutor.ts
import { useQuery } from "@tanstack/react-query";
import { getProsecutorData } from "../api/prosecutor";
import type { ProsecutorApiResult } from "../api/prosecutor";

export function useProsecutor(comparisonId: string | undefined) {
  return useQuery<ProsecutorApiResult, Error>({
    queryKey: ["prosecutor", comparisonId],
    queryFn: () => getProsecutorData(comparisonId!),
    enabled: !!comparisonId,
    staleTime: 10_000,
    retry: false,
    // Поллинг пока нет данных прокурора (таск ещё идёт)
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5000; // ещё не загрузили — опрашивать каждые 5с
      // Если есть HIGH/CRITICAL изменения но ни у одного нет prosecutor_report — таск ещё идёт
      const hasHighResults = data.results.length > 0;
      const hasAnyReport = data.results.some((r) => r.prosecutorReport !== null);
      if (hasHighResults && !hasAnyReport) return 5000;
      return false; // данные готовы — останавливаем поллинг
    },
  });
}