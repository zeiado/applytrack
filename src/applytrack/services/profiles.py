"""The user's profile (#114): read it, and create or change it on save."""

from sqlalchemy.orm import Session

from applytrack.core.errors import ValidationFailedError
from applytrack.models import Profile, User
from applytrack.schemas.profiles import ProfileRead, ProfileUpdate

# Lists and visibility always have a value: send [] or "private" instead of null.
_NOT_NULLABLE = {"skills", "languages", "visibility"}


class ProfileService:
    def __init__(self, session: Session, user: User) -> None:
        self.session = session
        self.user = user

    def read(self) -> ProfileRead:
        profile = self.session.get(Profile, self.user.id)
        return ProfileRead.model_validate(profile) if profile else ProfileRead()

    def update(self, body: ProfileUpdate) -> ProfileRead:
        changes = body.model_dump(exclude_unset=True)
        for field in _NOT_NULLABLE & changes.keys():
            if changes[field] is None:
                raise ValidationFailedError(f"{field} can't be null", code="validation_error")
        profile = self.session.get(Profile, self.user.id)
        if profile is None:
            profile = Profile(user_id=self.user.id, skills=[], languages=[])
            self.session.add(profile)
        for field, value in changes.items():
            setattr(profile, field, value)
        self.session.commit()
        return ProfileRead.model_validate(profile)
