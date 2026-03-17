FROM gcc:12-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends g++ && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home runner
WORKDIR /home/runner
USER runner
CMD ["sh", "-c", "g++ -o /home/runner/solution /home/runner/solution.cpp && /home/runner/solution"]