# backend/app/tasks/analysis.py
import asyncio
import uuid

from celery import Task
from sqlalchemy import update, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.tasks.celery_app import celery_app


def _run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
        asyncio.set_event_loop(None)


@celery_app.task(
    bind=True,
    name="analyze_comparison",
    max_retries=2,
    soft_time_limit=600,
    time_limit=660,
)
def analyze_comparison(self: Task, comparison_id: str):
    return _run_async(_analyze_async(self, comparison_id))


async def _analyze_async(task: Task, comparison_id: str):
    from app.core.config import settings
    from app.models.comparison import Comparison
    from app.models.document import Document
    from app.models.diff_result import DiffResult
    from app.services.parser_types import DocumentStructure, DocumentNode
    from app.services.differ import structural_diff
    from app.services.ai_analyzer import GeminiAnalyzer
    from app.services.npa_checker import find_relevant_npa_by_text

    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    TaskSession = async_sessionmaker(engine, expire_on_commit=False)

    async def set_status(status: str, progress: int, message: str):
        async with TaskSession() as db:
            await db.execute(
                update(Comparison)
                .where(Comparison.id == comparison_id)
                .values(status=status)
            )
            await db.commit()
        try:
            from app.api.compare import broadcast_status
            await broadcast_status(comparison_id, {
                "status": status, "progress": progress, "message": message,
            })
        except Exception:
            pass

    try:
        # ─── ЭТАП 1: PARSING ──────────────────────────────────────────────────
        await set_status("PARSING", 10, "Загружаем документы...")

        async with TaskSession() as db:
            result = await db.execute(
                select(Comparison).where(Comparison.id == comparison_id)
            )
            comparison = result.scalar_one_or_none()
            if not comparison:
                await set_status("ERROR", 0, "Сравнение не найдено")
                return {"error": "Comparison not found"}

            old_doc_res = await db.execute(
                select(Document).where(Document.id == comparison.doc_old_id)
            )
            old_doc = old_doc_res.scalar_one_or_none()

            new_doc_res = await db.execute(
                select(Document).where(Document.id == comparison.doc_new_id)
            )
            new_doc = new_doc_res.scalar_one_or_none()

        if not old_doc or not new_doc:
            await set_status("ERROR", 0, "Документы не найдены")
            return {"error": "Documents not found"}

        await set_status("PARSING", 30, "Восстанавливаем структуру...")

        def dict_to_node(d: dict) -> DocumentNode:
            node = DocumentNode(
                path=d["path"], node_type=d["node_type"], text=d["text"],
                level=d.get("level", 0), is_bold=d.get("is_bold", False),
                is_italic=d.get("is_italic", False),
            )
            node.children = [dict_to_node(c) for c in d.get("children", [])]
            return node

        def dict_to_structure(data: dict) -> DocumentStructure:
            s = DocumentStructure()
            s.total_paragraphs = data.get("total_paragraphs", 0)
            s.nodes = [dict_to_node(n) for n in data.get("nodes", [])]
            return s

        old_structure = dict_to_structure(old_doc.structure_json or {"nodes": []})
        new_structure = dict_to_structure(new_doc.structure_json or {"nodes": []})

        # ─── ЭТАП 2: DIFFING ──────────────────────────────────────────────────
        await set_status("ANALYZING", 40, "Сравниваем структуру документов...")
        raw_changes = structural_diff(old_structure, new_structure)
        await set_status("ANALYZING", 55, f"Найдено {len(raw_changes)} изменений. Запускаем AI анализ...")

       # ─── ЭТАП 3: AI ANALYZING + COMPLIANCE ───────────────────────────────
        ai_analyses = []

        if raw_changes and settings.openrouter_api_key:
            try:
                analyzer = GeminiAnalyzer()
                ai_analyses = await analyzer.analyze_batch(raw_changes)
                await set_status("ANALYZING", 70, "AI анализ завершён. Проверяем НПА...")

                # Compliance check для MEDIUM/HIGH/CRITICAL изменений
                async with TaskSession() as compliance_db:
                    for i, change in enumerate(raw_changes):
                        analysis = ai_analyses[i]
                        if analysis.risk_level not in ("MEDIUM", "HIGH", "CRITICAL"):
                            continue
                        try:
                            text_to_check = change.new_text or change.old_text or ""
                            relevant_npa = await find_relevant_npa_by_text(
                                compliance_db, text_to_check, top_k=3
                            )
                            compliance = await analyzer.check_compliance(
                                text=text_to_check,
                                npa_articles=relevant_npa,
                            )
                            # Обогащаем law_reference если AI его не нашёл
                            if compliance.violated_norm and not analysis.law_reference:
                                analysis.law_reference = compliance.violated_norm
                            # Сохраняем pravo_by_url через recommendation (поле уже есть)
                            # В день 5 добавим отдельное поле pravo_by_url в модель
                            if compliance.pravo_by_url:
                                suffix = f"\n\nСсылка на НПА: {compliance.pravo_by_url}"
                                if analysis.recommendation:
                                    analysis.recommendation = analysis.recommendation[:400] + suffix
                                else:
                                    analysis.recommendation = suffix.strip()
                        except Exception as e:
                            print(f"Compliance check failed for {change.section_path}: {e}")

                await set_status("ANALYZING", 85, "Сохраняем результаты...")
            except Exception as e:
                print(f"AI анализ упал: {e}. Fallback.")
                analyzer = GeminiAnalyzer()
                ai_analyses = [analyzer._fallback_analysis(c) for c in raw_changes]
        else:
            if raw_changes:
                analyzer = GeminiAnalyzer()
                ai_analyses = [analyzer._fallback_analysis(c) for c in raw_changes]

        # ─── СОХРАНИТЬ РЕЗУЛЬТАТЫ ─────────────────────────────────────────────
        async with TaskSession() as db:
            for i, change in enumerate(raw_changes):
                analysis = ai_analyses[i] if i < len(ai_analyses) else None

                dr = DiffResult(
                    id=str(uuid.uuid4()),
                    comparison_id=comparison_id,
                    section_path=change.section_path,
                    change_type=change.change_type,
                    old_text=change.old_text,
                    new_text=change.new_text,
                    risk_level=analysis.risk_level if analysis else None,
                    risk_score=analysis.risk_score if analysis else None,
                    semantic_type=analysis.semantic_type if analysis else None,
                    law_reference=analysis.law_reference if analysis else None,
                    recommendation=analysis.recommendation if analysis else None,
                    ai_confidence=analysis.confidence if analysis else None,
                )
                db.add(dr)

            # Посчитать сводку по уровням риска
            risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            for a in ai_analyses:
                lvl = a.risk_level.lower() if a else "low"
                if lvl in risk_counts:
                    risk_counts[lvl] += 1

            summary = {
                "total":    len(raw_changes),
                "added":    sum(1 for c in raw_changes if c.change_type == "ADDED"),
                "deleted":  sum(1 for c in raw_changes if c.change_type == "DELETED"),
                "modified": sum(1 for c in raw_changes if c.change_type == "MODIFIED"),
                "moved":    sum(1 for c in raw_changes if c.change_type == "MOVED"),
                **risk_counts,
            }

            # Общий risk_score = средний по всем
            if ai_analyses:
                avg_score = sum(a.risk_score for a in ai_analyses) / len(ai_analyses)
            else:
                avg_score = 0.0

            await db.execute(
                update(Comparison)
                .where(Comparison.id == comparison_id)
                .values(status="DONE", summary_json=summary, total_risk_score=avg_score)
            )
            await db.commit()

        high_count = risk_counts.get("high", 0) + risk_counts.get("critical", 0)
        if high_count > 0 and settings.openrouter_api_key:
            run_prosecutor_analysis.delay(comparison_id)
            print(f"Запущен ПРОКУРОР для {high_count} HIGH/CRITICAL изменений (comparison: {comparison_id[:8]})")

        # ─── ФИНИШ ────────────────────────────────────────────────────────────
        try:
            from app.api.compare import broadcast_status
            await broadcast_status(comparison_id, {
                "status": "DONE", "progress": 100,
                "message": f"Анализ завершён! {len(raw_changes)} изменений, {risk_counts['critical']+risk_counts['high']} высокого риска",
            })
        except Exception:
            pass

        return {
            "status": "DONE",
            "comparison_id": comparison_id,
            "changes_count": len(raw_changes),
        }

    except Exception as e:
        try:
            await set_status("ERROR", 0, f"Ошибка: {str(e)}")
        except Exception:
            pass
        raise

    finally:
        await engine.dispose()

# ─── ТАСК ПРОКУРОРА ───────────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="run_prosecutor_analysis",
    max_retries=1,
    soft_time_limit=600,
    time_limit=660,
)
def run_prosecutor_analysis(self: Task, comparison_id: str):
    """Запускает прокурорский анализ для всех HIGH/CRITICAL изменений."""
    return _run_async(_prosecutor_async(self, comparison_id))


async def _prosecutor_async(task: Task, comparison_id: str):
    from app.core.config import settings
    from app.models.diff_result import DiffResult
    from app.services.prosecutor import ProsecutorAnalyzer
    from dataclasses import asdict

    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    TaskSession = async_sessionmaker(engine, expire_on_commit=False)

    try:
        # Загрузить все HIGH/CRITICAL diff_results для этого сравнения
        async with TaskSession() as db:
            result = await db.execute(
                select(DiffResult)
                .where(DiffResult.comparison_id == comparison_id)
                .where(DiffResult.risk_level.in_(["HIGH", "CRITICAL"]))
                .where(DiffResult.prosecutor_analysis_json.is_(None))  # только ещё не обработанные
            )
            high_results = list(result.scalars().all())

        if not high_results:
            print(f"ПРОКУРОР: нет HIGH/CRITICAL изменений для {comparison_id}")
            return {"status": "DONE", "analyzed": 0}

        print(f"ПРОКУРОР: анализирую {len(high_results)} изменений для {comparison_id}")
        analyzer = ProsecutorAnalyzer()
        updates = []

        for diff in high_results:
            try:
                report = await analyzer.analyze(
                    section_path=diff.section_path,
                    semantic_type=diff.semantic_type,
                    old_text=diff.old_text,
                    new_text=diff.new_text,
                    law_reference=diff.law_reference,
                    risk_level=diff.risk_level or "HIGH",
                )
                updates.append((diff.id, asdict(report)))
            except Exception as e:
                print(f"ПРОКУРОР: ошибка для {diff.section_path}: {e}")

        # Сохранить результаты
        async with TaskSession() as db:
            for diff_id, report_dict in updates:
                await db.execute(
                    update(DiffResult)
                    .where(DiffResult.id == diff_id)
                    .values(prosecutor_analysis_json=report_dict)
                )
            await db.commit()

        # Уведомить через WebSocket
        try:
            from app.api.compare import broadcast_status
            await broadcast_status(comparison_id, {
                "status": "DONE",
                "progress": 100,
                "message": f"Прокурорский анализ завершён: {len(updates)} нарушений",
            })
        except Exception:
            pass

        print(f"ПРОКУРОР: сохранено {len(updates)} результатов")
        return {"status": "DONE", "analyzed": len(updates)}

    finally:
        await engine.dispose()

# ─── ТАСК РЕЖИМА 3: COMPLIANCE ────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="analyze_compliance",
    max_retries=1,
    soft_time_limit=600,
    time_limit=660,
)
def analyze_compliance(self: Task, comparison_id: str):
    """Режим 3: проверка дочернего ЛНА на соответствие родительскому НПА."""
    return _run_async(_compliance_async(self, comparison_id))


async def _compliance_async(task: Task, comparison_id: str):
    from app.core.config import settings
    from app.models.comparison import Comparison
    from app.models.document import Document
    from app.models.diff_result import DiffResult
    from app.services.parser_types import DocumentStructure, DocumentNode
    from app.services.ai_analyzer import GeminiAnalyzer
    from app.services.npa_checker import find_relevant_npa_by_text

    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    TaskSession = async_sessionmaker(engine, expire_on_commit=False)

    async def set_status(status: str, progress: int, message: str):
        async with TaskSession() as db:
            await db.execute(
                update(Comparison)
                .where(Comparison.id == comparison_id)
                .values(status=status)
            )
            await db.commit()
        try:
            from app.api.compare import broadcast_status
            await broadcast_status(comparison_id, {"status": status, "progress": progress, "message": message})
        except Exception:
            pass

    try:
        await set_status("PARSING", 10, "Загружаем документы...")

        async with TaskSession() as db:
            result = await db.execute(select(Comparison).where(Comparison.id == comparison_id))
            comparison = result.scalar_one_or_none()
            if not comparison:
                await set_status("ERROR", 0, "Сравнение не найдено")
                return {"error": "Comparison not found"}

            # doc_old = родительский НПА, doc_new = дочерний ЛНА
            parent_res = await db.execute(select(Document).where(Document.id == comparison.doc_old_id))
            parent_doc = parent_res.scalar_one_or_none()

            child_res = await db.execute(select(Document).where(Document.id == comparison.doc_new_id))
            child_doc = child_res.scalar_one_or_none()

        if not parent_doc or not child_doc:
            await set_status("ERROR", 0, "Документы не найдены")
            return {"error": "Documents not found"}

        await set_status("PARSING", 30, "Восстанавливаем структуру дочернего документа...")

        def dict_to_node(d: dict) -> DocumentNode:
            node = DocumentNode(
                path=d["path"], node_type=d["node_type"], text=d["text"],
                level=d.get("level", 0), is_bold=d.get("is_bold", False),
                is_italic=d.get("is_italic", False),
            )
            node.children = [dict_to_node(c) for c in d.get("children", [])]
            return node

        def dict_to_structure(data: dict) -> DocumentStructure:
            s = DocumentStructure()
            s.total_paragraphs = data.get("total_paragraphs", 0)
            s.nodes = [dict_to_node(n) for n in data.get("nodes", [])]
            return s

        child_structure = dict_to_structure(child_doc.structure_json or {"nodes": []})

        # Плоский список разделов дочернего документа
        def flatten_nodes(nodes):
            result = []
            for node in nodes:
                if node.text and node.text.strip():
                    result.append(node)
                result.extend(flatten_nodes(node.children))
            return result

        child_sections = flatten_nodes(child_structure.nodes)

        # Сформировать контекст родительского НПА (первые 3000 символов)
        parent_text = parent_doc.content_text or ""
        parent_context = parent_text[:3000]

        await set_status("ANALYZING", 40, f"Проверяем {len(child_sections)} разделов дочернего ЛНА...")

        analyzer = GeminiAnalyzer()
        diff_results_to_save = []
        risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}

        async with TaskSession() as npa_db:
            for i, section in enumerate(child_sections):
                if not section.text or len(section.text.strip()) < 20:
                    continue
                try:
                    # Найти релевантные нормы из БД НПА
                    relevant_npa = await find_relevant_npa_by_text(
                        npa_db, section.text, top_k=3
                    )
                    # Проверить соответствие
                    check_result = await analyzer.check_parent_child_compliance(
                        section_path=section.path,
                        child_text=section.text,
                        parent_context=parent_context,
                        npa_articles=relevant_npa,
                    )

                    risk_level = check_result["risk_level"]
                    lvl = risk_level.lower()
                    if lvl in risk_counts:
                        risk_counts[lvl] += 1

                    diff_results_to_save.append({
                        "section_path":  section.path,
                        "change_type":   "COMPLIANCE_VIOLATION" if check_result["status"] == "VIOLATION" else (
                                         "COMPLIANCE_WARNING" if check_result["status"] == "WARNING" else "COMPLIANT"),
                        "old_text":      None,                          # нет старой версии
                        "new_text":      section.text,                  # текст дочернего
                        "risk_level":    risk_level,
                        "risk_score":    check_result["risk_score"],
                        "semantic_type": "OBLIGATION_CHANGE",           # всегда как нарушение обязательности
                        "law_reference": check_result.get("violated_norm"),
                        "recommendation": check_result.get("recommendation"),
                        "ai_confidence": check_result["confidence"],
                    })

                    progress = 40 + int((i / len(child_sections)) * 45)
                    await set_status("ANALYZING", progress, f"Проверено {i+1}/{len(child_sections)} разделов...")

                except Exception as e:
                    print(f"Compliance check failed for {section.path}: {e}")

        # Сохранить результаты
        async with TaskSession() as db:
            for r in diff_results_to_save:
                dr = DiffResult(
                    id=str(uuid.uuid4()),
                    comparison_id=comparison_id,
                    **r,
                )
                db.add(dr)

            violations = sum(1 for r in diff_results_to_save if "VIOLATION" in r["change_type"])
            summary = {
                "total":    len(diff_results_to_save),
                "added":    0,
                "deleted":  0,
                "modified": violations,
                "moved":    0,
                **risk_counts,
            }
            avg_score = (
                sum(r["risk_score"] for r in diff_results_to_save) / len(diff_results_to_save)
                if diff_results_to_save else 0.0
            )

            await db.execute(
                update(Comparison)
                .where(Comparison.id == comparison_id)
                .values(status="DONE", summary_json=summary, total_risk_score=avg_score)
            )
            await db.commit()

        # Запустить ПРОКУРОР для HIGH/CRITICAL нарушений
        high_count = risk_counts.get("high", 0) + risk_counts.get("critical", 0)
        if high_count > 0 and settings.openrouter_api_key:
            run_prosecutor_analysis.delay(comparison_id)

        try:
            from app.api.compare import broadcast_status
            await broadcast_status(comparison_id, {
                "status": "DONE", "progress": 100,
                "message": f"Проверка завершена! {violations} нарушений из {len(diff_results_to_save)} разделов",
            })
        except Exception:
            pass

        return {"status": "DONE", "comparison_id": comparison_id, "violations": violations}

    except Exception as e:
        try:
            await set_status("ERROR", 0, f"Ошибка: {str(e)}")
        except Exception:
            pass
        raise
    finally:
        await engine.dispose()


# ─── ТАСК РЕЖИМА 4: AUDIT ─────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="analyze_audit",
    max_retries=1,
    soft_time_limit=600,
    time_limit=660,
)
def analyze_audit(self: Task, comparison_id: str):
    """Режим 4: аудит одного документа по государственному законодательству РБ."""
    return _run_async(_audit_async(self, comparison_id))


async def _audit_async(task: Task, comparison_id: str):
    from app.core.config import settings
    from app.models.comparison import Comparison
    from app.models.document import Document
    from app.models.diff_result import DiffResult
    from app.services.parser_types import DocumentStructure, DocumentNode
    from app.services.ai_analyzer import GeminiAnalyzer
    from app.services.npa_checker import find_relevant_npa_by_text

    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    TaskSession = async_sessionmaker(engine, expire_on_commit=False)

    async def set_status(status: str, progress: int, message: str):
        async with TaskSession() as db:
            await db.execute(
                update(Comparison)
                .where(Comparison.id == comparison_id)
                .values(status=status)
            )
            await db.commit()
        try:
            from app.api.compare import broadcast_status
            await broadcast_status(comparison_id, {"status": status, "progress": progress, "message": message})
        except Exception:
            pass

    try:
        await set_status("PARSING", 10, "Загружаем документ...")

        async with TaskSession() as db:
            result = await db.execute(select(Comparison).where(Comparison.id == comparison_id))
            comparison = result.scalar_one_or_none()
            if not comparison:
                await set_status("ERROR", 0, "Сравнение не найдено")
                return {"error": "Comparison not found"}

            doc_res = await db.execute(select(Document).where(Document.id == comparison.doc_old_id))
            doc = doc_res.scalar_one_or_none()

        if not doc:
            await set_status("ERROR", 0, "Документ не найден")
            return {"error": "Document not found"}

        await set_status("PARSING", 30, "Восстанавливаем структуру документа...")

        def dict_to_node(d: dict) -> DocumentNode:
            node = DocumentNode(
                path=d["path"], node_type=d["node_type"], text=d["text"],
                level=d.get("level", 0), is_bold=d.get("is_bold", False),
                is_italic=d.get("is_italic", False),
            )
            node.children = [dict_to_node(c) for c in d.get("children", [])]
            return node

        def dict_to_structure(data: dict) -> DocumentStructure:
            s = DocumentStructure()
            s.total_paragraphs = data.get("total_paragraphs", 0)
            s.nodes = [dict_to_node(n) for n in data.get("nodes", [])]
            return s

        structure = dict_to_structure(doc.structure_json or {"nodes": []})

        def flatten_nodes(nodes):
            result = []
            for node in nodes:
                if node.text and node.text.strip():
                    result.append(node)
                result.extend(flatten_nodes(node.children))
            return result

        sections = flatten_nodes(structure.nodes)
        await set_status("ANALYZING", 40, f"Аудируем {len(sections)} разделов...")

        analyzer = GeminiAnalyzer()
        diff_results_to_save = []
        risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}

        async with TaskSession() as npa_db:
            for i, section in enumerate(sections):
                if not section.text or len(section.text.strip()) < 20:
                    continue
                try:
                    relevant_npa = await find_relevant_npa_by_text(
                        npa_db, section.text, top_k=4
                    )
                    audit_result = await analyzer.audit_section(
                        section_path=section.path,
                        section_text=section.text,
                        npa_articles=relevant_npa,
                    )

                    risk_level = audit_result["risk_level"]
                    lvl = risk_level.lower()
                    if lvl in risk_counts:
                        risk_counts[lvl] += 1

                    diff_results_to_save.append({
                        "section_path":  section.path,
                        "change_type":   "AUDIT_ISSUE" if audit_result["has_violation"] else "AUDIT_OK",
                        "old_text":      None,
                        "new_text":      section.text,
                        "risk_level":    risk_level,
                        "risk_score":    audit_result["risk_score"],
                        "semantic_type": "OBLIGATION_CHANGE" if audit_result["has_violation"] else "COSMETIC",
                        "law_reference": audit_result.get("violated_norm"),
                        "recommendation": audit_result.get("recommendation"),
                        "ai_confidence": audit_result["confidence"],
                    })

                    progress = 40 + int((i / len(sections)) * 45)
                    await set_status("ANALYZING", progress, f"Проверено {i+1}/{len(sections)} разделов...")

                except Exception as e:
                    print(f"Audit failed for {section.path}: {e}")

        # Сохранить результаты — только нарушения (AUDIT_ISSUE) и спорные разделы (MEDIUM+)
        # AUDIT_OK с LOW риском не сохраняем чтобы не засорять результаты
        relevant_results = [
            r for r in diff_results_to_save
            if r["change_type"] == "AUDIT_ISSUE" or r["risk_level"] in ("MEDIUM", "HIGH", "CRITICAL")
        ]

        async with TaskSession() as db:
            for r in relevant_results:
                dr = DiffResult(
                    id=str(uuid.uuid4()),
                    comparison_id=comparison_id,
                    **r,
                )
                db.add(dr)

            issues_count = sum(1 for r in relevant_results if r["change_type"] == "AUDIT_ISSUE")
            summary = {
                "total":    len(relevant_results),
                "added":    0,
                "deleted":  0,
                "modified": issues_count,
                "moved":    0,
                **risk_counts,
            }
            
            violation_scores = [
                r["risk_score"] for r in diff_results_to_save
                if r["change_type"] == "AUDIT_ISSUE"
            ]

            if violation_scores:
                # Взвешенный score: среднее по нарушениям, но масштабируем
                # чтобы отразить долю нарушений в документе
                violation_ratio = len(violation_scores) / max(len(diff_results_to_save), 1)
                avg_violations = sum(violation_scores) / len(violation_scores)
                # Итог: серьёзность × частота нарушений
                avg_score = min(avg_violations * (0.4 + 0.6 * violation_ratio), 100.0)
            else:
                avg_score = 0.0

            await db.execute(
                update(Comparison)
                .where(Comparison.id == comparison_id)
                .values(status="DONE", summary_json=summary, total_risk_score=avg_score)
            )
            await db.commit()

        high_count = risk_counts.get("high", 0) + risk_counts.get("critical", 0)
        if high_count > 0 and settings.openrouter_api_key:
            run_prosecutor_analysis.delay(comparison_id)

        try:
            from app.api.compare import broadcast_status
            await broadcast_status(comparison_id, {
                "status": "DONE", "progress": 100,
                "message": f"Аудит завершён! Найдено {issues_count} нарушений из {len(sections)} разделов",
            })
        except Exception:
            pass

        return {"status": "DONE", "comparison_id": comparison_id, "issues": issues_count}

    except Exception as e:
        try:
            await set_status("ERROR", 0, f"Ошибка: {str(e)}")
        except Exception:
            pass
        raise
    finally:
        await engine.dispose()