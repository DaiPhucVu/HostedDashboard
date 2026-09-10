FROM python:3.11-slim

WORKDIR /app
COPY . .

EXPOSE 8080
CMD ["python3", "-m", "app.api.server", "--host", "0.0.0.0"]
