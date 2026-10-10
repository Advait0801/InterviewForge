FROM node:22-bookworm-slim
RUN useradd --create-home runner
WORKDIR /home/runner
USER runner
CMD ["node", "/home/runner/run.js"]
