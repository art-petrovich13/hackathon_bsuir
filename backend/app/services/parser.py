# backend/app/services/parser.py
"""
Парсер документов .docx и .pdf.
Извлекает иерархическую структуру: главы → статьи → пункты → параграфы.
"""
import re
from io import BytesIO

from app.services.parser_types import DocumentNode, DocumentStructure


class DocumentParser:
    """
    Главный класс парсера. Определяет тип файла и вызывает нужный парсер.
    
    Использование:
        parser = DocumentParser()
        structure = parser.parse(file_bytes, "docx")
    """

    def parse(self, file_bytes: bytes, file_type: str) -> DocumentStructure:
        """
        Распарсить документ.
        
        Args:
            file_bytes: байты файла
            file_type: "docx" или "pdf"
        
        Returns:
            DocumentStructure с деревом узлов
        """
        if file_type == "docx":
            return self.parse_docx(file_bytes)
        elif file_type == "pdf":
            return self.parse_pdf(file_bytes)
        else:
            raise ValueError(f"Неподдерживаемый тип файла: {file_type}")

    # ─── DOCX парсер ──────────────────────────────────────────────────────────

    def parse_docx(self, file_bytes: bytes) -> DocumentStructure:
        """
        Парсинг .docx через python-docx.
        Строит иерархию на основе стилей заголовков (Heading 1/2/3).
        """
        from docx import Document as DocxDocument

        doc = DocxDocument(BytesIO(file_bytes))
        structure = DocumentStructure()
        all_texts = []

        # Счётчики для генерации путей: [глава, статья, пункт, параграф]
        counters = [0, 0, 0, 0]
        current_path_stack: list[DocumentNode] = []  # стек текущих родителей

        for paragraph in doc.paragraphs:
            text = paragraph.text.strip()
            if not text:
                continue

            style_name = paragraph.style.name if paragraph.style else "Normal"
            level = self._get_heading_level(style_name)
            
            # Определяем is_bold: если весь параграф жирный или стиль Bold
            is_bold = all(run.bold for run in paragraph.runs if run.text.strip()) \
                      if paragraph.runs else False
            is_italic = all(run.italic for run in paragraph.runs if run.text.strip()) \
                        if paragraph.runs else False

            # Дополнительная эвристика: ALL CAPS строки = заголовок
            if level == 0 and len(text) < 100 and text == text.upper() and len(text) > 3:
                level = 2

            # Попытка определить уровень из текста: "1.", "1.1.", "П. 3.2"
            if level == 0:
                detected = self._detect_level_from_text(text)
                if detected > 0:
                    level = detected

            # Обновляем счётчики
            if level > 0:
                idx = level - 1
                counters[idx] += 1
                # Сбросить счётчики дочерних уровней
                for i in range(idx + 1, len(counters)):
                    counters[i] = 0
                path = ".".join(str(c) for c in counters[:level] if c > 0)
                node_type = f"heading{level}"
            else:
                # Параграф — дочерний для последнего заголовка
                counters[3] += 1
                # Берём путь из стека + номер параграфа
                parent_path = current_path_stack[-1].path if current_path_stack else "0"
                path = f"{parent_path}.p{counters[3]}"
                node_type = "paragraph"

            node = DocumentNode(
                path=path,
                node_type=node_type,
                text=text,
                level=level,
                is_bold=is_bold,
                is_italic=is_italic,
            )

            all_texts.append(text)

            # Добавить в дерево
            if level == 1:
                structure.nodes.append(node)
                current_path_stack = [node]
            elif level > 1 and current_path_stack:
                # Найти ближайшего родителя с меньшим уровнем
                while current_path_stack and current_path_stack[-1].level >= level:
                    current_path_stack.pop()
                if current_path_stack:
                    current_path_stack[-1].children.append(node)
                else:
                    structure.nodes.append(node)
                current_path_stack.append(node)
            else:
                # Параграф — добавить к последнему заголовку или в корень
                if current_path_stack:
                    current_path_stack[-1].children.append(node)
                else:
                    structure.nodes.append(node)

        # Таблицы — добавить как отдельные узлы
        for i, table in enumerate(doc.tables):
            table_text = self._extract_table_text(table)
            if table_text:
                node = DocumentNode(
                    path=f"table_{i+1}",
                    node_type="table",
                    text=table_text,
                    level=0,
                )
                all_texts.append(table_text)
                if current_path_stack:
                    current_path_stack[-1].children.append(node)
                else:
                    structure.nodes.append(node)

        structure.full_text = "\n".join(all_texts)
        structure.total_paragraphs = len(all_texts)
        return structure

    def _get_heading_level(self, style_name: str) -> int:
        """Определить уровень заголовка из имени стиля Word."""
        style_lower = style_name.lower()
        if "heading 1" in style_lower or "заголовок 1" in style_lower:
            return 1
        elif "heading 2" in style_lower or "заголовок 2" in style_lower:
            return 2
        elif "heading 3" in style_lower or "заголовок 3" in style_lower:
            return 3
        elif "heading" in style_lower or "заголовок" in style_lower:
            return 2  # Прочие заголовки — уровень 2
        return 0

    def _detect_level_from_text(self, text: str) -> int:
        """
        Определить уровень из текста по нумерации.
        "Статья 5." → 1
        "5.1." → 2
        "5.1.3." → 3
        "Глава I." → 1
        """
        # "Статья X", "Глава X", "Раздел X"
        if re.match(r"^(статья|глава|раздел|часть)\s+\d", text, re.IGNORECASE):
            return 1
        # "П. X.X" или "Пункт X.X"
        if re.match(r"^(п\.|пункт)\s+\d", text, re.IGNORECASE):
            return 2
        # "1." (одна цифра с точкой в начале)
        if re.match(r"^\d+\.\s+[А-ЯA-Z]", text):
            return 1
        # "1.1." (две цифры)
        if re.match(r"^\d+\.\d+\.\s+", text):
            return 2
        # "1.1.1." (три цифры)
        if re.match(r"^\d+\.\d+\.\d+\.\s+", text):
            return 3
        return 0

    def _extract_table_text(self, table) -> str:
        """Извлечь текст таблицы в читаемом виде."""
        rows = []
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                rows.append(" | ".join(cells))
        return "\n".join(rows)

    # ─── PDF парсер ───────────────────────────────────────────────────────────

    def parse_pdf(self, file_bytes: bytes) -> DocumentStructure:
        """
        Парсинг PDF через pdfplumber.
        Fallback на PyMuPDF при ошибках.
        Эвристика заголовков: размер шрифта > 14pt или ALL CAPS.
        """
        try:
            return self._parse_pdf_pdfplumber(file_bytes)
        except Exception as e:
            print(f"pdfplumber failed: {e}, trying PyMuPDF fallback")
            try:
                return self._parse_pdf_pymupdf(file_bytes)
            except Exception as e2:
                print(f"PyMuPDF also failed: {e2}")
                # Последний фолбэк — просто вернуть плоский текст
                return self._parse_pdf_simple(file_bytes)

    def _parse_pdf_pdfplumber(self, file_bytes: bytes) -> DocumentStructure:
        import pdfplumber

        structure = DocumentStructure()
        all_texts = []
        counters = [0, 0, 0, 0]
        current_path_stack: list[DocumentNode] = []
        para_counter = 0

        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                # Извлечь слова с информацией о шрифте
                words = page.extract_words(extra_attrs=["size", "fontname"])
                if not words:
                    continue

                # Группировать слова в строки по координатам Y
                lines = self._group_words_into_lines(words)

                for line_words in lines:
                    text = " ".join(w["text"] for w in line_words).strip()
                    if not text or len(text) < 2:
                        continue

                    # Определить уровень: по размеру шрифта и признакам заголовка
                    avg_size = sum(w.get("size", 10) for w in line_words) / len(line_words)
                    is_heading = avg_size > 13 or (text == text.upper() and len(text) > 3 and len(text) < 100)

                    level = 0
                    if is_heading:
                        level = 1 if avg_size > 15 else 2
                        # Уточнить по нумерации в тексте
                        detected = self._detect_level_from_text(text)
                        if detected > 0:
                            level = detected

                    if level > 0:
                        idx = level - 1
                        counters[idx] += 1
                        for i in range(idx + 1, len(counters)):
                            counters[i] = 0
                        path = ".".join(str(c) for c in counters[:level] if c > 0)
                        node_type = f"heading{level}"
                    else:
                        para_counter += 1
                        parent_path = current_path_stack[-1].path if current_path_stack else "0"
                        path = f"{parent_path}.p{para_counter}"
                        node_type = "paragraph"

                    node = DocumentNode(path=path, node_type=node_type, text=text, level=level)
                    all_texts.append(text)

                    if level == 1:
                        structure.nodes.append(node)
                        current_path_stack = [node]
                    elif level > 1 and current_path_stack:
                        while current_path_stack and current_path_stack[-1].level >= level:
                            current_path_stack.pop()
                        parent = current_path_stack[-1] if current_path_stack else None
                        if parent:
                            parent.children.append(node)
                        else:
                            structure.nodes.append(node)
                        current_path_stack.append(node)
                    else:
                        if current_path_stack:
                            current_path_stack[-1].children.append(node)
                        else:
                            structure.nodes.append(node)

        structure.full_text = "\n".join(all_texts)
        structure.total_paragraphs = len(all_texts)
        return structure

    def _group_words_into_lines(self, words: list[dict]) -> list[list[dict]]:
        """Сгруппировать слова в строки по близости координаты Y."""
        if not words:
            return []
        sorted_words = sorted(words, key=lambda w: (round(w.get("top", 0) / 3), w.get("x0", 0)))
        lines: list[list[dict]] = []
        current_line: list[dict] = [sorted_words[0]]
        current_y = round(sorted_words[0].get("top", 0) / 3)

        for word in sorted_words[1:]:
            word_y = round(word.get("top", 0) / 3)
            if abs(word_y - current_y) <= 2:
                current_line.append(word)
            else:
                lines.append(current_line)
                current_line = [word]
                current_y = word_y
        if current_line:
            lines.append(current_line)
        return lines

    def _parse_pdf_pymupdf(self, file_bytes: bytes) -> DocumentStructure:
        """Fallback парсер через PyMuPDF (fitz)."""
        import fitz  # PyMuPDF

        structure = DocumentStructure()
        all_texts = []
        counters = [0, 0, 0, 0]
        current_path_stack: list[DocumentNode] = []
        para_counter = 0

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            blocks = page.get_text("dict")["blocks"]
            for block in blocks:
                if block.get("type") != 0:  # 0 = text
                    continue
                for line in block.get("lines", []):
                    spans = line.get("spans", [])
                    if not spans:
                        continue
                    text = " ".join(s["text"] for s in spans).strip()
                    if not text:
                        continue

                    max_size = max(s.get("size", 10) for s in spans)
                    is_bold = any("Bold" in s.get("font", "") for s in spans)
                    level = 0

                    if max_size > 13 or is_bold:
                        level = 1 if max_size > 15 else 2
                        detected = self._detect_level_from_text(text)
                        if detected > 0:
                            level = detected

                    if level > 0:
                        idx = level - 1
                        counters[idx] += 1
                        for i in range(idx + 1, len(counters)):
                            counters[i] = 0
                        path = ".".join(str(c) for c in counters[:level] if c > 0)
                        node_type = f"heading{level}"
                    else:
                        para_counter += 1
                        parent_path = current_path_stack[-1].path if current_path_stack else "0"
                        path = f"{parent_path}.p{para_counter}"
                        node_type = "paragraph"

                    node = DocumentNode(path=path, node_type=node_type, text=text, level=level, is_bold=is_bold)
                    all_texts.append(text)

                    if level == 1:
                        structure.nodes.append(node)
                        current_path_stack = [node]
                    elif level > 1:
                        while current_path_stack and current_path_stack[-1].level >= level:
                            current_path_stack.pop()
                        if current_path_stack:
                            current_path_stack[-1].children.append(node)
                        else:
                            structure.nodes.append(node)
                        current_path_stack.append(node)
                    else:
                        if current_path_stack:
                            current_path_stack[-1].children.append(node)
                        else:
                            structure.nodes.append(node)
        doc.close()

        structure.full_text = "\n".join(all_texts)
        structure.total_paragraphs = len(all_texts)
        return structure

    def _parse_pdf_simple(self, file_bytes: bytes) -> DocumentStructure:
        """Простейший fallback: просто извлечь текст постранично."""
        try:
            import pdfplumber
            with pdfplumber.open(BytesIO(file_bytes)) as pdf:
                all_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        except Exception:
            all_text = "Не удалось извлечь текст из PDF"

        structure = DocumentStructure()
        for i, line in enumerate(all_text.split("\n")):
            line = line.strip()
            if line:
                structure.nodes.append(DocumentNode(
                    path=str(i + 1),
                    node_type="paragraph",
                    text=line,
                    level=0,
                ))
        structure.full_text = all_text
        structure.total_paragraphs = len(structure.nodes)
        return structure