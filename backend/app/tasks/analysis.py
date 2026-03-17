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
    soft_time_limit=300,
    time_limit=360,
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

        # ─── ЭТАП 3: AI ANALYZING ─────────────────────────────────────────────
        ai_analyses = []

        if raw_changes and settings.gemini_api_key:
            try:
                analyzer = GeminiAnalyzer()
                ai_analyses = await analyzer.analyze_batch(raw_changes)
                await set_status("ANALYZING", 80, "AI анализ завершён. Сохраняем результаты...")
            except Exception as e:
                print(f"AI анализ упал: {e}. Продолжаем без AI.")
                # Создать фолбэк анализы
                analyzer = GeminiAnalyzer()
                ai_analyses = [analyzer._fallback_analysis(c) for c in raw_changes]
        else:
            # Без ключа Gemini — фолбэк
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