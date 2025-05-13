# Base Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Pre-copy only requirements to cache dependencies
COPY requirements.txt .

# Install pip dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy everything into /app
COPY . .

# Optional: create certs dir for TLS certs
RUN mkdir -p certs

# Expose HTTPS port
EXPOSE 8443

# Run app as module so Python sees 'app' as a package
CMD ["python", "-m", "app.main"]
