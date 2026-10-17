from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from applytrack.core.errors import ConflictError, UnauthorizedError
from applytrack.core.security import hash_password, verify_password
from applytrack.models import User
from applytrack.repositories.users import UserRepository


def normalize_email(email: str) -> str:
    return email.strip().lower()


class AuthService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.users = UserRepository(session)

    def register(self, email: str, password: str) -> User:
        email = normalize_email(email)
        if self.users.get_by_email(email) is not None:
            raise ConflictError("An account with this email already exists", code="email_taken")

        user = User(email=email, password_hash=hash_password(password))
        try:
            self.users.add(user)
            self.session.commit()
        except IntegrityError as exc:  # two sign-ups with the same email at the same moment
            self.session.rollback()
            raise ConflictError(
                "An account with this email already exists", code="email_taken"
            ) from exc
        return user

    def authenticate(self, email: str, password: str) -> User:
        user = self.users.get_by_email(normalize_email(email))
        if not verify_password(password, user.password_hash if user else None) or user is None:
            # Same message for unknown email and wrong password, so accounts can't be probed.
            raise UnauthorizedError("Incorrect email or password", code="invalid_credentials")
        return user
