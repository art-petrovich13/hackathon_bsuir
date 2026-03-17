# backend/app/services/parser_types.py
"""
Типы данных для парсера документов.
DocumentNode — один узел в иерархии документа.
DocumentStructure — полное дерево разделов.
"""
from dataclasses import dataclass, field


@dataclass
class DocumentNode:
    """
    Один узел в структуре документа.
    
    path: строка вида "1", "1.2", "1.2.3" — позиция в иерархии
    node_type: "heading1" | "heading2" | "heading3" | "paragraph" | "table" | "list_item"
    text: текстовое содержимое узла
    level: глубина вложенности (1 = глава, 2 = статья, 3 = пункт, 0 = параграф)
    children: вложенные узлы
    is_bold: жирный текст (может нести юридическое значение)
    """
    path: str
    node_type: str
    text: str
    level: int = 0
    children: list["DocumentNode"] = field(default_factory=list)
    is_bold: bool = False
    is_italic: bool = False

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "node_type": self.node_type,
            "text": self.text,
            "level": self.level,
            "is_bold": self.is_bold,
            "is_italic": self.is_italic,
            "children": [c.to_dict() for c in self.children],
        }


@dataclass
class DocumentStructure:
    """Полная структура распарсенного документа."""
    nodes: list[DocumentNode] = field(default_factory=list)
    full_text: str = ""          # весь текст одной строкой (для поиска)
    total_paragraphs: int = 0    # статистика

    def to_dict(self) -> dict:
        return {
            "nodes": [n.to_dict() for n in self.nodes],
            "total_paragraphs": self.total_paragraphs,
        }

    def flat_nodes(self) -> list[DocumentNode]:
        """Плоский список всех узлов (рекурсивно разворачивает дерево)."""
        result = []
        def _traverse(nodes: list[DocumentNode]):
            for node in nodes:
                result.append(node)
                _traverse(node.children)
        _traverse(self.nodes)
        return result