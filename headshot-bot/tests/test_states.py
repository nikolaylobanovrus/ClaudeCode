import pytest

from core.states import ALLOWED_TRANSITIONS, InvalidTransition, JobState, validate_transition


def test_happy_path():
    path = [
        JobState.COLLECTING,
        JobState.AWAITING_PAYMENT,
        JobState.TRAINING,
        JobState.GENERATING,
        JobState.DELIVERING,
        JobState.DONE,
    ]
    for current, target in zip(path, path[1:]):
        assert validate_transition(current, target) is target


def test_failed_allows_retry_to_working_states():
    for target in (JobState.TRAINING, JobState.GENERATING, JobState.DELIVERING):
        assert validate_transition(JobState.FAILED, target) is target


def test_terminal_states_have_no_transitions():
    assert not ALLOWED_TRANSITIONS[JobState.DONE]
    assert not ALLOWED_TRANSITIONS[JobState.CANCELLED]


@pytest.mark.parametrize(
    "current,target",
    [
        (JobState.COLLECTING, JobState.TRAINING),  # мимо оплаты нельзя
        (JobState.AWAITING_PAYMENT, JobState.GENERATING),
        (JobState.DONE, JobState.TRAINING),
        (JobState.FAILED, JobState.DONE),
    ],
)
def test_invalid_transitions_raise(current, target):
    with pytest.raises(InvalidTransition):
        validate_transition(current, target)


def test_every_state_is_covered():
    assert set(ALLOWED_TRANSITIONS) == set(JobState)
