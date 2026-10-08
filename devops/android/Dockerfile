# The Android APK builder: JDK 17, the Android SDK command-line tools and Node 22, so nothing is
# installed on the host. Run through `node devops/android/apk.js build`, which mounts this folder at
# /tools and runs apk.js inside.
FROM node:22-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jdk-headless unzip \
 && rm -rf /var/lib/apt/lists/*

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Only the SDK manager and its licenses: Gradle downloads the platform, build tools and NDK the
# generated project asks for into ANDROID_HOME (a volume, see apk.js, so only once).
ARG CMDLINE_TOOLS=commandlinetools-linux-13114758_latest.zip
RUN mkdir -p $ANDROID_HOME/cmdline-tools \
 && curl -fsSL https://dl.google.com/android/repository/$CMDLINE_TOOLS -o /tmp/tools.zip \
 && unzip -q /tmp/tools.zip -d /tmp/tools \
 && mv /tmp/tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
 && rm -rf /tmp/tools.zip /tmp/tools \
 && yes | sdkmanager --licenses > /dev/null \
 && sdkmanager --install platform-tools > /dev/null
