from fastapi import APIRouter

from applytrack.api.routes import applications, auth, email, interviews, reminders, stats, users

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(applications.router)
api_router.include_router(interviews.router)
api_router.include_router(reminders.router)
api_router.include_router(stats.router)
api_router.include_router(email.router)
