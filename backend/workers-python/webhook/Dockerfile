FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY config.py alert_worker.py ./

ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "app.main"]
