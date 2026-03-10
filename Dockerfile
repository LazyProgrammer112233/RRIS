# Use official Playwright image for Python
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Ensure we have the latest pip
RUN python3 -m pip install --upgrade pip

# Copy requirements and install dependencies
COPY requirements.txt .
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Install Chromium
RUN playwright install chromium

# Expose FastAPI port
EXPOSE 8000

# Run the server using python -m uvicorn for path reliability
CMD ["python3", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
