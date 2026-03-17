// frontend/src/api/compare.ts
import apiClient from "./client";
import type {
  CreateComparisonRequest,
  CreateComparisonResponse,
  Comparison,
} from "../types";

export async function createComparison(
  payload: CreateComparisonRequest
): Promise<CreateComparisonResponse> {
  const response = await apiClient.post<CreateComparisonResponse>(
    "/api/compare",
    payload
  );
  return response.data;
}

export async function getComparison(id: string): Promise<Comparison> {
  const response = await apiClient.get<Comparison>(`/api/compare/${id}`);
  return response.data;
}