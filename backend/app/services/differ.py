# backend/app/services/differ.py
"""
Структурный diff двух документов.
Сопоставляет узлы по path, находит ADDED / DELETED / MODIFIED / MOVED.
"""
import difflib
from dataclasses import dataclass, field

from app.services.parser_types import DocumentNode, DocumentStructure


@dataclass
class RawChange:
    """
    Одно обнаруженное изменение.
    Соответствует одной записи в таблице diff_results.
    """
    section_path: str          # "1.3.2"
    change_type: str           # ADDED | DELETED | MODIFIED | MOVED
    old_text: str | None       # текст до изменения
    new_text: str | None       # текст после изменения
    similarity: float          # 0.0 – 1.0 (1.0 = идентичны)
    word_diff: list[tuple] = field(default_factory=list)
    # Каждый элемент word_diff: ('equal'|'replace'|'insert'|'delete', old_words, new_words)


def structural_diff(
    old_doc: DocumentStructure,
    new_doc: DocumentStructure,
) -> list[RawChange]:
    """
    Сравнить два документа и вернуть список изменений.
    
    Алгоритм:
    1. Получить плоский список всех узлов из обоих документов
    2. Индексировать по path
    3. Найти совпадающие path: вычислить text similarity
    4. Найти path только в старом → DELETED
    5. Найти path только в новом → ADDED
    6. Для совпадающих path с similarity < 1.0 → MODIFIED
    7. LCS по тексту для поиска MOVED (переставленных пунктов)
    """
    old_nodes = old_doc.flat_nodes()
    new_nodes = new_doc.flat_nodes()

    # Индексы: path → node
    old_by_path: dict[str, DocumentNode] = {n.path: n for n in old_nodes}
    new_by_path: dict[str, DocumentNode] = {n.path: n for n in new_nodes}

    old_paths = set(old_by_path.keys())
    new_paths = set(new_by_path.keys())

    changes: list[RawChange] = []

    # 1. Пути только в старом документе → DELETED
    for path in sorted(old_paths - new_paths):
        node = old_by_path[path]
        if not node.text.strip():
            continue
        changes.append(RawChange(
            section_path=path,
            change_type="DELETED",
            old_text=node.text,
            new_text=None,
            similarity=0.0,
        ))

    # 2. Пути только в новом документе → ADDED
    for path in sorted(new_paths - old_paths):
        node = new_by_path[path]
        if not node.text.strip():
            continue
        changes.append(RawChange(
            section_path=path,
            change_type="ADDED",
            old_text=None,
            new_text=node.text,
            similarity=0.0,
        ))

    # 3. Пути в обоих документах → сравниваем текст
    for path in sorted(old_paths & new_paths):
        old_node = old_by_path[path]
        new_node = new_by_path[path]

        if not old_node.text.strip() and not new_node.text.strip():
            continue

        similarity = _text_similarity(old_node.text, new_node.text)

        if similarity >= 0.99:
            # Практически идентичны — пропускаем
            continue

        word_diff = _compute_word_diff(old_node.text, new_node.text)

        changes.append(RawChange(
            section_path=path,
            change_type="MODIFIED",
            old_text=old_node.text,
            new_text=new_node.text,
            similarity=similarity,
            word_diff=word_diff,
        ))

    # 4. Поиск MOVED: DELETED узлы с текстом похожим на ADDED
    _detect_moved(changes)

    # Сортировать по section_path
    changes.sort(key=lambda c: _path_sort_key(c.section_path))
    return changes


def _text_similarity(text1: str, text2: str) -> float:
    """Вычислить схожесть двух текстов (0.0 - 1.0) через SequenceMatcher."""
    if not text1 and not text2:
        return 1.0
    if not text1 or not text2:
        return 0.0
    return difflib.SequenceMatcher(None, text1.lower(), text2.lower()).ratio()


def _compute_word_diff(old_text: str, new_text: str) -> list[tuple]:
    """
    Вычислить diff на уровне слов.
    Возвращает список (tag, old_words, new_words):
      - 'equal':   одинаковые слова
      - 'replace': замена
      - 'insert':  добавление
      - 'delete':  удаление
    """
    old_words = old_text.split()
    new_words = new_text.split()
    matcher = difflib.SequenceMatcher(None, old_words, new_words)
    result = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        result.append((tag, old_words[i1:i2], new_words[j1:j2]))
    return result


def _detect_moved(changes: list[RawChange]) -> None:
    """
    Найти перемещённые узлы: DELETED + ADDED с похожим текстом → MOVED.
    Меняет change_type на "MOVED" если similarity > 0.85.
    """
    deleted = [c for c in changes if c.change_type == "DELETED"]
    added = [c for c in changes if c.change_type == "ADDED"]

    for d_change in deleted:
        if not d_change.old_text:
            continue
        best_match = None
        best_sim = 0.85  # порог для определения MOVED

        for a_change in added:
            if not a_change.new_text:
                continue
            sim = _text_similarity(d_change.old_text, a_change.new_text)
            if sim > best_sim:
                best_sim = sim
                best_match = a_change

        if best_match:
            # Превращаем DELETED + ADDED в MOVED
            d_change.change_type = "MOVED"
            d_change.new_text = best_match.new_text
            d_change.similarity = best_sim
            # Удаляем ADDED который теперь стал MOVED
            changes.remove(best_match)


def _path_sort_key(path: str) -> tuple:
    """Сортировочный ключ для paths вида '1.3.2' → (1, 3, 2)."""
    try:
        parts = []
        for part in path.split("."):
            # Убираем нечисловые суффиксы типа "p5" → 5
            num = "".join(c for c in part if c.isdigit())
            parts.append(int(num) if num else 0)
        return tuple(parts)
    except Exception:
        return (0,)