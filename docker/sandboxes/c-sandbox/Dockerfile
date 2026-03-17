FROM gcc:12-bookworm-slim
RUN useradd --create-home runner
WORKDIR /home/runner
USER runner
CMD ["sh", "-c", "gcc -o /home/runner/solution /home/runner/solution.c && /home/runner/solution"]