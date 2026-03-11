---
title: RRIS Engine
emoji: 🧊
colorFrom: blue
colorTo: gray
sdk: docker
pinned: false
---

# RRIS — Retail Refrigeration Intelligence System

A high-accuracy FMCG asset detection engine powered by **Gemini Vision** and **Playwright**.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check (returns `{"status": "ready"}`) |
| `/audit` | POST | Start a new audit (body: `{"maps_url": "..."}`) |
| `/status/{task_id}` | GET | Check audit status |
| `/sync-sheets` | POST | Sync results to Google Sheets |

> **Security**: All endpoints (except `/health`) require the `X-RRIS-SECRET` header.
