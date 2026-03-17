FROM python:3.11-slim
RUN useradd --create-home runner
WORKDIR /home/runner
USER runner
CMD ["python3", "-u", "/home/runner/run.py"]