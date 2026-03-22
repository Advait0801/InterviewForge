FROM eclipse-temurin:17-jdk
RUN useradd --create-home runner
WORKDIR /home/runner
USER runner
CMD ["sh", "-c", "javac Main.java && java Main"]