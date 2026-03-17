// frontend/src/api/report.ts
import apiClient from "./client";

export async function generateReport(comparisonId: string): Promise<{ task_id: string }> {
  const response = await apiClient.post<{ task_id: string }>(
    `/api/report/${comparisonId}`
  );
  return response.data;
}

export function getReportDownloadUrl(comparisonId: string): string {
  const base = import.meta.env.VITE_API_URL || "";
  return `${base}/api/report/${comparisonId}/download`;
}