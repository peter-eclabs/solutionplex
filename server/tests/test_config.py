import pytest
from pydantic import ValidationError

from server.config import Settings


def test_settings_dev_allows_default_jwt_secret():
    s = Settings(
        environment="development",
        jwt_secret="CHANGE_ME_IN_PROD",
    )
    assert s.jwt_secret == "CHANGE_ME_IN_PROD"
    assert s.environment == "development"


def test_settings_default_environment_allows_default_jwt_secret():
    s = Settings(
        environment="development",
        jwt_secret="CHANGE_ME_IN_PROD",
    )
    assert s.environment == "development"
    assert s.jwt_secret == "CHANGE_ME_IN_PROD"


def test_settings_production_rejects_default_jwt_secret():
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="production",
            jwt_secret="CHANGE_ME_IN_PROD",
        )
    assert "JWT_SECRET must be set in production" in str(exc_info.value)


def test_settings_production_accepts_custom_jwt_secret():
    s = Settings(
        environment="production",
        jwt_secret="a-real-production-secret",
    )
    assert s.jwt_secret == "a-real-production-secret"


def test_settings_production_from_env_rejects_default_secret(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", "CHANGE_ME_IN_PROD")
    with pytest.raises(ValidationError) as exc_info:
        Settings()
    assert "JWT_SECRET must be set in production" in str(exc_info.value)


def test_settings_production_case_insensitive(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "Production")
    monkeypatch.setenv("JWT_SECRET", "CHANGE_ME_IN_PROD")
    with pytest.raises(ValidationError) as exc_info:
        Settings()
    assert "JWT_SECRET must be set in production" in str(exc_info.value)
