FROM rust:1.82-slim-bookworm
RUN useradd --create-home runner
WORKDIR /home/runner
USER runner
CMD ["sh", "-c", "rustc -O -o /tmp/sol /home/runner/main.rs && /tmp/sol"]
