import os
import uuid
import asyncio
import sqlite3
import json
from datetime import datetime
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from main import run_audit
from google_sheets import export_to_sheets

app = FastAPI(title="RRIS Audit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://rris-frontend.vercel.app", # Final Production Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Enhanced Deployment sanity check"""
    health = {
        "status": "ready",
        "browser": "unverified",
        "db": "connected" if os.path.exists(DB_PATH) else "initializing",
        "env": {
            "GEMINI_KEY": "set" if os.getenv("GEMINI_API_KEY") else "missing",
            "PLACES_KEY": "set" if os.getenv("GOOGLE_PLACES_API_KEY") else "missing"
        }
    }
    
    try:
        # Check if playwright is actually usable
        import subprocess
        # Simply check if the binary exists in the expected playwright path
        # The official image stores them in /ms-playwright
        res = subprocess.run(["ls", "-R", "/ms-playwright/chromium*"], capture_output=True, text=True)
        if "chrome" in res.stdout.lower() or res.returncode == 0:
            health["browser"] = "installed"
        else:
            # Fallback check
            check = subprocess.run(["playwright", "--version"], capture_output=True, text=True)
            health["browser"] = f"verified ({check.stdout.strip()})"
    except Exception as e:
        health["browser_error"] = str(e)
        health["status"] = "partial_ready"

    return health

DB_PATH = "rris_tasks.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            url TEXT,
            status TEXT,
            result TEXT,
            created_at TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

class AuditRequest(BaseModel):
    maps_url: str

class TaskStatus(BaseModel):
    task_id: str
    status: str
    result: dict = None
    created_at: str

async def background_audit(task_id: str, maps_url: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Update status to RUNNING
    cursor.execute("UPDATE tasks SET status = ? WHERE id = ?", ("RUNNING", task_id))
    conn.commit()
    
    try:
        # Run the audit
        # Note: main.py saves to audit_report.json by default. 
        # We might want to pass a specific filename or handle the return value.
        await run_audit(maps_url)
        
        # Load the result
        result_path = "audit_report.json"
        if os.path.exists(result_path):
            with open(result_path, "r") as f:
                result_data = json.load(f)
            
            # Update status to COMPLETED
            cursor.execute("UPDATE tasks SET status = ?, result = ? WHERE id = ?", 
                           ("COMPLETED", json.dumps(result_data), task_id))
        else:
            cursor.execute("UPDATE tasks SET status = ?, result = ? WHERE id = ?", 
                           ("FAILED", json.dumps({"error": "No report generated"}), task_id))
        
    except Exception as e:
        cursor.execute("UPDATE tasks SET status = ?, result = ? WHERE id = ?", 
                       ("FAILED", json.dumps({"error": str(e)}), task_id))
    
    conn.commit()
    conn.close()

@app.post("/audit", response_model=dict)
async def start_audit(request: AuditRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    created_at = datetime.now().isoformat()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO tasks (id, url, status, result, created_at) VALUES (?, ?, ?, ?, ?)",
                   (task_id, request.maps_url, "PENDING", None, created_at))
    conn.commit()
    conn.close()
    
    background_tasks.add_task(background_audit, task_id, request.maps_url)
    
    return {"task_id": task_id, "status": "PENDING"}

@app.get("/status/{task_id}", response_model=TaskStatus)
async def get_task_status(task_id: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, status, result, created_at FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    
    result = json.loads(row[2]) if row[2] else None
    
    return TaskStatus(
        task_id=row[0],
        status=row[1],
        result=result,
        created_at=row[3]
    )

@app.post("/sync-sheets")
async def sync_sheets():
    try:
        if os.path.exists("audit_report.json"):
            export_to_sheets("audit_report.json", "RRIS_Production_Audit_Log")
            return {"status": "SUCCESS"}
        else:
            raise HTTPException(status_code=404, detail="No audit report found to sync")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
