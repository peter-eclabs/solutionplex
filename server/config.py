from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "solutionplex"

    # Auth / JWT
    jwt_secret: str = "CHANGE_ME_IN_PROD"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
