FROM eclipse-temurin:17-jdk-alpine
RUN adduser -D runner
WORKDIR /home/runner
USER runner
CMD ["sh", "-c", "javac Main.java && java Main"]