# Use official Playwright image for Python (Pre-installed Chromium)
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# === HF Spaces: Non-Root User Setup ===
RUN useradd -m -u 1000 user
ENV HOME=/home/user
ENV PATH=$HOME/.local/bin:$PATH

# === Environment Variables ===
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PYTHONUNBUFFERED=1

# Set working directory and grant permissions
WORKDIR /app
RUN chown -R user:user /app

# Ensure we have the latest pip
RUN python3 -m pip install --upgrade pip

# Layer Caching: Copy requirements and install first
COPY --chown=user:user requirements.txt .
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# Verification: Fail build if uvicorn is not installed
RUN python3 -m uvicorn --version

# Copy application code
COPY --chown=user:user . .

# Switch to non-root user
USER user

# === HF Spaces: Port 7860 ===
EXPOSE 7860

# Run the server on HF's mandatory port
CMD ["python3", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
