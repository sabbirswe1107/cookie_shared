#!/bin/bash
echo "Starting Secure Cookie Share Backend..."
PORT=${PORT:-8000}
uvicorn main:app --host 0.0.0.0 --port $PORT
