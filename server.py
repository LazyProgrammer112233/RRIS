import os
import uuid
import json
import sys
import threading
from datetime import datetime, timedelta
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# RRIS Audit API — Hugging Face Spaces Edition
# ============================================================

app = FastAPI(title="RRIS Audit API")

print("🔥 RRIS Engine Initializing (HF Spaces)...")
print(f"📂 CWD: {os.getcwd()}")
print(f"📦 Python: {sys.version}")

# === CORS Middleware ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://rris.vercel.app",      # Production Vercel URL
        "http://localhost:3000",          # Local dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === X-RRIS-SECRET Security Middleware ===
APP_SECRET = os.getenv("APP_SECRET", "")
print(f"🔐 APP_SECRET loaded: {'YES (' + str(len(APP_SECRET)) + ' chars)' if APP_SECRET else 'NOT SET — middleware disabled'}")

@app.middleware("http")
async def verify_secret(request: Request, call_next):
    """Intercept all requests except /health and preflight OPTIONS."""
    # Allow health check, docs, and CORS preflight through
    exempt_paths = {"/health", "/docs", "/openapi.json", "/favicon.ico"}
    if request.url.path in exempt_paths or request.method == "OPTIONS":
        return await call_next(request)
    
    # If APP_SECRET is not configured, skip enforcement (allow all)
    if not APP_SECRET:
        return await call_next(request)
    
    incoming_secret = request.headers.get("X-RRIS-SECRET", "")
    if incoming_secret != APP_SECRET:
        return JSONResponse(
            status_code=403,
            content={"detail": "Forbidden: Invalid or missing X-RRIS-SECRET header."}
        )
    return await call_next(request)

# === Health Endpoint (HF Spec) ===
@app.get("/health")
async def health_check():
    """HF Spaces health check — must return 200 OK fast."""
    return {"status": "ready", "memory_limit": "16GB"}

# ============================================================
# InMemoryTaskManager (Thread-Safe)
# ============================================================

import csv
import io
from fastapi.responses import StreamingResponse

class InMemoryTaskManager:
    """Thread-safe in-memory task store with auto-expiry."""
    
    def __init__(self, expiry_hours: int = 1):
        self._tasks: dict = {}
        self._lock = threading.Lock()
        self._expiry_hours = expiry_hours
        self._purge_thread = threading.Thread(target=self._purge_loop, daemon=True)
        self._purge_thread.start()
        print("🧹 Task Purge Thread Started (1-hour expiry).")
    
    def create(self, task_id: str, url: str = None, place_ids: list = None) -> dict:
        with self._lock:
            task = {
                "task_id": task_id,
                "url": url,
                "place_ids": place_ids,
                "status": "PENDING",
                "progress": 0,
                "total": len(place_ids) if place_ids else 1,
                "result": None,
                "bulk_results": [],
                "created_at": datetime.now().isoformat()
            }
            self._tasks[task_id] = task
            return task
    
    def update(self, task_id: str, status: str, result: dict = None, progress: int = None, bulk_item: dict = None):
        with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id]["status"] = status
                if result is not None:
                    self._tasks[task_id]["result"] = result
                if progress is not None:
                    self._tasks[task_id]["progress"] = progress
                if bulk_item is not None:
                    self._tasks[task_id]["bulk_results"].append(bulk_item)
    
    def get(self, task_id: str) -> dict | None:
        with self._lock:
            return self._tasks.get(task_id)
            
    def _purge_loop(self):
        """Background loop that purges old completed/failed tasks every 5 minutes."""
        import time
        while True:
            time.sleep(300)
            cutoff = datetime.now() - timedelta(hours=self._expiry_hours)
            with self._lock:
                to_delete = [
                    tid for tid, task in self._tasks.items()
                    if task["status"] in ("COMPLETED", "FAILED")
                    and datetime.fromisoformat(task["created_at"]) < cutoff
                ]
                for tid in to_delete:
                    del self._tasks[tid]
                if to_delete:
                    print(f"🧹 Purged {len(to_delete)} expired tasks.")

# Initialize the task manager
task_manager = InMemoryTaskManager(expiry_hours=1)

# ============================================================
# API Models
# ============================================================

class AuditRequest(BaseModel):
    maps_url: str

class BulkAuditRequest(BaseModel):
    place_ids: list[str]

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: dict = None
    progress: int = 0
    total: int = 1
    created_at: str

# ============================================================
# Audit Pipeline
# ============================================================

async def background_audit(task_id: str, maps_url: str):
    """Run the full audit pipeline in the background."""
    task_manager.update(task_id, "RUNNING")
    try:
        from main import run_audit
        audit_result = await run_audit(maps_url=maps_url)
        if audit_result:
            task_manager.update(task_id, "COMPLETED", audit_result)
        else:
            task_manager.update(task_id, "FAILED", {"error": "Audit returned empty result."})
    except Exception as e:
        task_manager.update(task_id, "FAILED", {"error": str(e)})

async def background_bulk_audit(task_id: str, place_ids: list):
    """Run bulk Place ID audits in the background."""
    task_manager.update(task_id, "RUNNING")
    from main import run_audit
    from scraper import get_place_details
    
    for i, pid in enumerate(place_ids):
        try:
            details = await get_place_details(pid)
            is_large = False
            large_keywords = {"supermarket", "hypermarket", "department_store", "grocery_or_supermarket"}
            if details and any(k in details.get("types", []) for k in large_keywords):
                is_large = True
            
            if is_large:
                item_result = {
                    "place_id": pid,
                    "name": details.get("name", "N/A"),
                    "outlet_type": "supermarket",
                    "supermarket_check": "YES",
                    "appliance_types": "Assume Cooling Assets (Superstore)",
                    "asset_count": "N/A",
                    "location": details.get("formatted_address", "N/A"),
                    "verification_notes": "Outlet seems to be a Supermarket / superstore / large outlet",
                    "lat": details.get("geometry", {}).get("location", {}).get("lat"),
                    "lng": details.get("geometry", {}).get("location", {}).get("lng"),
                    "rating": details.get("rating"),
                    "reviews": details.get("user_ratings_total")
                }
            else:
                audit = await run_audit(place_id=pid)
                item_result = {
                    "place_id": pid,
                    "name": details.get("name", "N/A"),
                    "outlet_type": audit.get("outlet_type", "N/A"),
                    "supermarket_check": "NO",
                    "appliance_types": ", ".join(audit.get("appliance_types", [])) if isinstance(audit.get("appliance_types"), list) else audit.get("appliance_types", "N/A"),
                    "asset_count": audit.get("asset_count", 0),
                    "location": details.get("formatted_address", "N/A"),
                    "verification_notes": audit.get("verification_notes", "N/A"),
                    "lat": details.get("geometry", {}).get("location", {}).get("lat"),
                    "lng": details.get("geometry", {}).get("location", {}).get("lng"),
                    "rating": details.get("rating"),
                    "reviews": details.get("user_ratings_total")
                }
            task_manager.update(task_id, "RUNNING", progress=i+1, bulk_item=item_result)
        except Exception as e:
            print(f"Error processing {pid}: {e}")
            task_manager.update(task_id, "RUNNING", progress=i+1, bulk_item={"place_id": pid, "error": str(e)})

    task_manager.update(task_id, "COMPLETED")

@app.post("/audit", response_model=dict)
async def start_audit(request: AuditRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    task_manager.create(task_id, url=request.maps_url)
    background_tasks.add_task(background_audit, task_id, request.maps_url)
    return {"task_id": task_id, "status": "PENDING"}

@app.post("/audit-bulk-ids")
async def start_bulk_audit(request: BulkAuditRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    task_manager.create(task_id, place_ids=request.place_ids)
    background_tasks.add_task(background_bulk_audit, task_id, request.place_ids)
    return {"task_id": task_id, "status": "PENDING"}

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    task = task_manager.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.get("/download-csv/{task_id}")
async def download_csv(task_id: str):
    task = task_manager.get(task_id)
    if not task or not task.get("bulk_results"):
        raise HTTPException(status_code=404, detail="Task not found or results not ready")
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "place_id", "name", "outlet_type", "supermarket_check", 
        "appliance_types", "location", "asset_count", "verification_notes", 
        "lat", "lng", "rating", "reviews"
    ])
    writer.writeheader()
    for row in task["bulk_results"]:
        clean_row = {k: row.get(k, "N/A") for k in writer.fieldnames}
        writer.writerow(clean_row)
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=rris_bulk_audit_{task_id}.csv"}
    )

@app.post("/sync-sheets")
async def sync_sheets():
    try:
        from google_sheets import export_to_sheets
        if os.path.exists("audit_report.json"):
            export_to_sheets("audit_report.json", "RRIS_Production_Audit_Log")
            return {"status": "SUCCESS"}
        else:
            raise HTTPException(status_code=404, detail="No audit report found to sync")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# Entrypoint
# ============================================================

if __name__ == "__main__":
    import uvicorn
    print("📡 Starting RRIS on 0.0.0.0:7860")
    uvicorn.run(app, host="0.0.0.0", port=7860)
