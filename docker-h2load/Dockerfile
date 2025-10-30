FROM ubuntu:22.04

RUN apt-get update && \
    apt-get install -y nghttp2-client curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY tests/third-test/run_h2load_test.sh .
RUN chmod +x run_h2load_test.sh

CMD ["./run_h2load_test.sh"]
