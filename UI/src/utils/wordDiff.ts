// src/utils/wordDiff.ts

export type WordDiffTag = "equal" | "replace" | "insert" | "delete";

export interface WordDiffChunk {
  tag: WordDiffTag;
  oldWords: string[];
  newWords: string[];
}

/**
 * Вычисляет word-level diff между двумя строками.
 * Использует алгоритм LCS (Longest Common Subsequence) на словах.
 * Используется в DiffBlock (карточки) и DocViewer (inline-режим).
 */
export function computeWordDiff(
  oldText: string,
  newText: string
): WordDiffChunk[] {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);

  // Строим матрицу LCS
  const dp: number[][] = Array(oldWords.length + 1)
    .fill(null)
    .map(() => Array(newWords.length + 1).fill(0));

  for (let i = 1; i <= oldWords.length; i++) {
    for (let j = 1; j <= newWords.length; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Восстанавливаем путь
  const ops: Array<{
    tag: "equal" | "insert" | "delete";
    i: number;
    j: number;
  }> = [];
  let i = oldWords.length;
  let j = newWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      ops.unshift({ tag: "equal", i: i - 1, j: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ tag: "insert", i, j: j - 1 });
      j--;
    } else {
      ops.unshift({ tag: "delete", i: i - 1, j });
      i--;
    }
  }

  // Группируем последовательные операции
  const result: WordDiffChunk[] = [];
  let k = 0;

  while (k < ops.length) {
    const op = ops[k];
    if (op.tag === "equal") {
      result.push({
        tag: "equal",
        oldWords: [oldWords[op.i]],
        newWords: [newWords[op.j]],
      });
      k++;
    } else {
      const delWords: string[] = [];
      const insWords: string[] = [];
      while (k < ops.length && ops[k].tag === "delete") {
        delWords.push(oldWords[ops[k].i]);
        k++;
      }
      while (k < ops.length && ops[k].tag === "insert") {
        insWords.push(newWords[ops[k].j]);
        k++;
      }
      if (delWords.length > 0 && insWords.length > 0) {
        result.push({ tag: "replace", oldWords: delWords, newWords: insWords });
      } else if (delWords.length > 0) {
        result.push({ tag: "delete", oldWords: delWords, newWords: [] });
      } else {
        result.push({ tag: "insert", oldWords: [], newWords: insWords });
      }
    }
  }

  return result;
}