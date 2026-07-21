"""Машина состояний заказа (Job).

Жизненный цикл: сбор фото → ожидание оплаты → тренировка LoRA →
генерация портретов → доставка → завершено. Любое рабочее состояние
может завершиться ошибкой (failed); из failed возможен ретрай в то же
состояние, где произошёл сбой (retry_to).
"""
from enum import StrEnum


class JobState(StrEnum):
    COLLECTING = "collecting"
    AWAITING_PAYMENT = "awaiting_payment"
    TRAINING = "training"
    GENERATING = "generating"
    DELIVERING = "delivering"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


ALLOWED_TRANSITIONS: dict[JobState, frozenset[JobState]] = {
    # Бот собирает фото до оплаты (collecting → awaiting_payment); веб-флоу
    # (как HeadshotPro) берёт оплату первой, потом собирает фото
    # (awaiting_payment → collecting → training). Отсюда оба направления.
    JobState.COLLECTING: frozenset(
        {JobState.AWAITING_PAYMENT, JobState.TRAINING, JobState.CANCELLED}
    ),
    JobState.AWAITING_PAYMENT: frozenset(
        {JobState.COLLECTING, JobState.TRAINING, JobState.CANCELLED}
    ),
    JobState.TRAINING: frozenset({JobState.GENERATING, JobState.FAILED, JobState.CANCELLED}),
    JobState.GENERATING: frozenset({JobState.DELIVERING, JobState.FAILED, JobState.CANCELLED}),
    JobState.DELIVERING: frozenset({JobState.DONE, JobState.FAILED}),
    JobState.DONE: frozenset(),
    JobState.FAILED: frozenset({JobState.TRAINING, JobState.GENERATING, JobState.DELIVERING}),
    JobState.CANCELLED: frozenset(),
}

# Состояния, которые обрабатывает фоновый воркер.
WORKER_STATES = (JobState.TRAINING, JobState.GENERATING, JobState.DELIVERING)


class InvalidTransition(Exception):
    def __init__(self, current: JobState, target: JobState):
        super().__init__(f"Недопустимый переход: {current} -> {target}")
        self.current = current
        self.target = target


def validate_transition(current: JobState, target: JobState) -> JobState:
    """Проверяет переход и возвращает целевое состояние, иначе бросает InvalidTransition."""
    if target not in ALLOWED_TRANSITIONS[current]:
        raise InvalidTransition(current, target)
    return target
