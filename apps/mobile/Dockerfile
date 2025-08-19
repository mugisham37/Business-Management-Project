# React Native build environment for CI/CD
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Install system dependencies for React Native
RUN apk add --no-cache \
    bash \
    git \
    python3 \
    make \
    g++ \
    openjdk11-jre

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Development stage
FROM base AS development
COPY . .
EXPOSE 8081
CMD ["pnpm", "run", "start", "--filter=mobile"]

# Build stage for Android
FROM base AS android-build

# Install Android SDK
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools

RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip && \
    unzip -q commandlinetools-linux-9477386_latest.zip -d ${ANDROID_HOME}/cmdline-tools && \
    mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest && \
    rm commandlinetools-linux-9477386_latest.zip

# Accept Android SDK licenses
RUN yes | sdkmanager --licenses

# Install required Android SDK components
RUN sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.0"

# Copy source code
COPY . .

# Build Android APK
RUN cd apps/mobile/android && \
    ./gradlew assembleRelease

# Build stage for iOS (requires macOS, this is for reference)
FROM base AS ios-build
COPY . .
# Note: iOS builds require macOS and Xcode, this stage is for reference only
# RUN cd apps/mobile/ios && xcodebuild -workspace Mobile.xcworkspace -scheme Mobile -configuration Release

# Test stage
FROM base AS test
COPY . .
RUN pnpm run test --filter=mobile

# Artifact stage - extract built artifacts
FROM alpine:latest AS artifacts
RUN apk add --no-cache curl
WORKDIR /artifacts

# Copy Android APK
COPY --from=android-build /app/apps/mobile/android/app/build/outputs/apk/release/app-release.apk ./mobile-android.apk

# Create metadata
RUN echo "Build completed at: $(date)" > build-info.txt
RUN echo "Platform: Android" >> build-info.txt

CMD ["sh", "-c", "echo 'Artifacts ready for download'"]