from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "solutionplex"

    # Auth / JWT
    jwt_secret: str = "CHANGE_ME_IN_PROD"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    environment: str = "development"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @model_validator(mode="after")
    def reject_default_jwt_secret_in_production(self) -> "Settings":
        if (
            self.environment.lower() == "production"
            and self.jwt_secret == "CHANGE_ME_IN_PROD"
        ):
            raise ValueError(
                "JWT_SECRET must be set in production; refusing to start with default secret"
            )
        return self


settings = Settings()
