from server.schemas.models import (
    AppResponse,
    AppShort,
    ProblemCreate,
    ProblemResponse,
    ProblemUpdate,
    SolutionResponse,
)


def test_problem_response_hidden_defaults_false():
    p = ProblemResponse(
        id="60b8d5a1b55a8b0c848b4501",
        title="T",
        description="D",
        solutions=[],
        created_at="2026-07-08T11:00:00",
        updated_at="2026-07-08T11:00:00",
    )
    assert p.hidden is False


def test_problem_create_accepts_hidden():
    c = ProblemCreate(title="T", description="D", hidden=True)
    assert c.hidden is True


def test_problem_update_hidden_optional():
    u = ProblemUpdate(title="T2")
    assert u.hidden is None
    u2 = ProblemUpdate(hidden=True)
    assert u2.hidden is True


def test_solution_and_app_response_have_hidden():
    s = SolutionResponse(
        id="60b8d5a1b55a8b0c848b4601",
        title="S",
        description="D",
        created_at="2026-07-08T11:00:00",
        updated_at="2026-07-08T11:00:00",
    )
    a = AppResponse(
        id="60b8d5a1b55a8b0c848b4701",
        title="A",
        description="D",
        github_url="https://github.com/x/y",
        created_at="2026-07-08T11:00:00",
        updated_at="2026-07-08T11:00:00",
    )
    assert s.hidden is False
    assert a.hidden is False


def test_app_short_has_hidden():
    s = AppShort(id="60b8d5a1b55a8b0c848b4701", title="A")
    assert s.hidden is None
