# backend/app/core/logging.py
import structlog
import logging


def setup_logging(debug: bool = False):
    """Настроить структурированное JSON логирование."""
    level = logging.DEBUG if debug else logging.INFO

    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
    )
    logging.basicConfig(level=level, format="%(message)s")


def get_logger(name: str):
    return structlog.get_logger(name)