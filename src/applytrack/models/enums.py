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
