#!/bin/bash
echo "Starting Secure Cookie Share Backend on all network interfaces..."
source venv/bin/activate
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
