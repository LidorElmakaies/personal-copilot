# The phone smoke tests' image: Java 17, adb and the Maestro CLI, so nothing is installed on the
# host. Run through `node devops/maestro/smoke.js`, which mounts frontend/maestro/ at /flows.
FROM eclipse-temurin:17-jre-jammy

RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip \
 && rm -rf /var/lib/apt/lists/*

ARG PLATFORM_TOOLS=platform-tools_r37.0.1-linux.zip
ARG PLATFORM_TOOLS_SHA1=477254aa5f903c15cf51001717bdf347fb6b53e0
RUN curl -fsSL https://dl.google.com/android/repository/$PLATFORM_TOOLS -o /tmp/pt.zip \
 && echo "$PLATFORM_TOOLS_SHA1  /tmp/pt.zip" | sha1sum -c - \
 && unzip -q /tmp/pt.zip -d /opt \
 && rm /tmp/pt.zip

ARG MAESTRO=2.11.0
ARG MAESTRO_SHA256=5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a
RUN curl -fsSL https://github.com/mobile-dev-inc/Maestro/releases/download/cli-$MAESTRO/maestro.zip -o /tmp/maestro.zip \
 && echo "$MAESTRO_SHA256  /tmp/maestro.zip" | sha256sum -c - \
 && unzip -q /tmp/maestro.zip -d /opt \
 && rm /tmp/maestro.zip

ENV PATH=$PATH:/opt/platform-tools:/opt/maestro/bin
ENV MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_DISABLE_UPDATE_CHECK=1 \
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
