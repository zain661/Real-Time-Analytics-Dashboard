#!/bin/bash

# Target URL (HTTP/2)
URL="http://127.0.0.1:5001/api/stream"  # use http if https causes issues

# Load test parameters
REQUESTS=1000
CONCURRENCY=100

# Ensure results directory exists (relative path)
mkdir -p ./tests/third-test

echo "Starting HTTP/2 load test..."
h2load -n $REQUESTS -c $CONCURRENCY -m 100 -t 4 $URL | tee ./tests/third-test/h2load_results.txt
