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