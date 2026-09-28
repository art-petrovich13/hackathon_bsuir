// frontend/src/hooks/useChain.ts
import { useQuery } from "@tanstack/react-query";
import { getChainResult } from "../api/compare";
import type { ChainResult } from "../api/compare";

export function useChain(chainId: string | undefined) {
  return useQuery<ChainResult, Error>({
    queryKey: ["chain", chainId],
    queryFn: () => getChainResult(chainId!),
    enabled: !!chainId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === "DONE" || status === "ERROR") return false;
      return 3000;
    },
    staleTime: 0,
  });
}