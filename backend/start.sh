#!/bin/bash
# Start backend on local network (accessible from other devices)
echo "Starting Secure Cookie Share Backend on all network interfaces..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
