Project Specification: RRIS Backend Migration to Hugging Face Spaces (Docker)
1. Context & Objective
The RRIS (Retail Refrigeration Intelligence System) is migrating its backend from Railway to Hugging Face Spaces to leverage the 16GB RAM / 2 vCPU free tier. This shift is necessary to handle high-resolution Playwright scraping and multi-stage Vision processing without memory-related build stalls.

2. Infrastructure Strategy: Hugging Face Docker SDK
Hugging Face Spaces will act as a persistent, high-performance container host for our FastAPI application.

A. Container Environment (The Dockerfile)
Base Image: Must use mcr.microsoft.com/playwright/python:v1.40.0-jammy to ensure all Chromium dependencies and the browser itself are pre-baked into the image.

Port Mapping: Hugging Face strictly listens on Port 7860. The FastAPI app must be configured to bind to this port.

User Permissions: HF Spaces runs containers as a non-root user (UID 1000). The Dockerfile must:

Create a user and set a home directory.

Grant write permissions to the /app directory.

Set ENV HOME=/home/user and PATH=$HOME/.local/bin:$PATH.

Browser Pathing: Explicitly set ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright to ensure the scraper finds the pre-installed Chromium instance.

B. Application Logic Adjustments (server.py)
Stateless Persistence: Since HF Spaces storage is ephemeral, remove SQLite (rris_tasks.db). Implement an InMemoryTaskManager using a global Python dictionary.

Task Expiry: Implement a background thread or a FastAPI startup task that purges completed/failed tasks older than 1 hour to prevent memory leaks.

Security Middleware (The "X-RRIS-SECRET" Guard): * Implement a middleware that intercepts all incoming requests (except /health).

Check for a header named X-RRIS-SECRET.

If the header value does not match the APP_SECRET environment variable, return a 403 Forbidden error. This prevents unauthorized usage of our Gemini API credits.

3. Frontend Integration (Vercel Handshake)
The Next.js frontend on Vercel must be updated to:

URL Update: Use the new Hugging Face Space URL (e.g., https://[username]-[space-name].hf.space).

Header Injection: Every fetch request to the backend must now include the X-RRIS-SECRET in the headers.

4. Technical Implementation Tasks for Antigravity
Task 1: Generate the HF-Optimized Dockerfile
Create a Dockerfile that handles the non-root user requirements and pre-installs all necessary Python dependencies (FastAPI, Uvicorn, Pillow, Google-GenerativeAI).

Task 2: Update server.py & vision_engine.py
Update the Uvicorn start command to port 7860.

Refactor the task manager to use a thread-safe Dict.

Add the X-RRIS-SECRET validation logic.

Task 3: Hugging Face Metadata (README.md)
Generate the mandatory YAML header for Hugging Face to identify the space as a Docker application:

YAML
---
title: RRIS Engine
emoji: 🧊
colorFrom: blue
colorTo: gray
sdk: docker
pinned: false
---
5. Verification & Health Checks
Health Endpoint: /health must return {"status": "ready", "memory_limit": "16GB"}.

Security Test: A request without the X-RRIS-SECRET header must fail with a 403.

Handoff Instructions for Antigravity
Please provide the following artifacts based on these requirements:

The complete Dockerfile.

The updated server.py and InMemoryTaskManager logic.

The README.md with the required YAML header.

The specific .env keys I need to add to the Hugging Face "Secrets" panel (e.g., GEMINI_API_KEY, APP_SECRET).