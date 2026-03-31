FROM python:3.11-slim
WORKDIR /app

# System deps for Playwright
RUN apt-get update && apt-get install -y \
    wget gnupg curl libglib2.0-0 libnss3 libgconf-2-4 \
    libfontconfig1 libxrender1 libxtst6 libxi6 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium --with-deps

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
