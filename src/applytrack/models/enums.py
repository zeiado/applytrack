from enum import StrEnum


class ApplicationStatus(StrEnum):
    WISHLIST = "wishlist"
    APPLIED = "applied"
    SCREENING = "screening"
    INTERVIEWING = "interviewing"
    OFFER = "offer"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class ApplicationSource(StrEnum):
    REFERRAL = "referral"
    JOB_BOARD = "job_board"
    COMPANY_SITE = "company_site"
    RECRUITER = "recruiter"
    OTHER = "other"


class InterviewKind(StrEnum):
    PHONE_SCREEN = "phone_screen"
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    ONSITE = "onsite"
    OTHER = "other"


class EmailTokenPurpose(StrEnum):
    VERIFY_EMAIL = "verify_email"
    RESET_PASSWORD = "reset_password"  # noqa: S105 (a purpose, not a password)


class JobStatus(StrEnum):
    PENDING = "pending"  # waiting for run_at
    RUNNING = "running"  # claimed by a worker until locked_until
    DONE = "done"
    FAILED = "failed"  # gave up: a permanent error, or out of attempts


class ExperienceLevel(StrEnum):
    STUDENT = "student"
    GRADUATE = "graduate"  # a fresh graduate, looking for a first job
    JUNIOR = "junior"  # up to 2 years
    MID = "mid"  # 3 to 5 years
    SENIOR = "senior"  # 6 years or more


class ProfileVisibility(StrEnum):
    PRIVATE = "private"  # only the user (and Sekka AI, with their consent)
    RECRUITERS = "recruiters"  # verified employers can find it (M4)
