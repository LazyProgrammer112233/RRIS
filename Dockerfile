# Use official Playwright image for Python
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Install Chromium (already handled by the base image, but ensure it's matched)
RUN playwright install chromium

# Expose FastAPI port
EXPOSE 8000

# Run the server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
