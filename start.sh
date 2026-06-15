#!/bin/bash
echo "Starting Secure Cookie Share Backend..."
cd backend
PORT=${PORT:-8000}
uvicorn main:app --host 0.0.0.0 --port $PORT
