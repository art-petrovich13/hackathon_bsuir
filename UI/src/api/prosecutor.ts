// frontend/src/api/prosecutor.ts
import apiClient from "./client";
import type { ProsecutorAnalysis } from "../types";

export interface ProsecutorResponse {
  diffId: string;
  prosecutorReport: ProsecutorAnalysis;
}

export async function getProsecutorData(
  comparisonId: string
): Promise<ProsecutorResponse[]> {
  const response = await apiClient.get<ProsecutorResponse[]>(
    `/api/compare/${comparisonId}/prosecutor`
  );
  return response.data;
}