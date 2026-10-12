from fastapi import FastAPI

from app.routers import navigation

app = FastAPI(title="InRoute routing service")

app.include_router(navigation.router)


# Open to everyone, no key: the main server calls it to wake this service up,
# and Render calls it to check that the service is alive.
@app.get("/health")
def health():
    return {"ok": True}
