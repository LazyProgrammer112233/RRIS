# Use official Playwright image for Python (Pre-installed browsers)
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Optimization: Set Environment Variables
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PYTHONUNBUFFERED=1

# Ensure we have the latest pip
RUN python3 -m pip install --upgrade pip

# Layer Caching: Copy requirements and install first
COPY requirements.txt .
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# Verification: Fail build if uvicorn is not installed
RUN python3 -m uvicorn --version

# Copy application code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Run the server using python -m uvicorn for path reliability
# Uses sh -c to expand the $PORT environment variable
CMD sh -c "python3 -m uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"
