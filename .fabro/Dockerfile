# Sandbox image for the ZeroSpam mobile cycle: Node monorepo (server + web + shared-api)
# and the Flutter slice (apps/zerospam_flutter). Mirrors the local toolchain the
# slice was built against: Node 22, Flutter stable (bundles Dart), JDK 17.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl git ripgrep ca-certificates xz-utils unzip zip \
        build-essential pkg-config python3 \
        openjdk-17-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

# Node 22 (matches the toolchain the server/web/shared-api workspaces target)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI — the gh-* workflows read issues/PRs through it.
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Flutter stable (provides the Dart SDK used for codegen + build_runner).
ENV FLUTTER_HOME=/opt/flutter
RUN git clone --depth 1 -b stable https://github.com/flutter/flutter.git "$FLUTTER_HOME"
ENV PATH="$FLUTTER_HOME/bin:$FLUTTER_HOME/bin/cache/dart-sdk/bin:${PATH}"
RUN git config --global --add safe.directory "$FLUTTER_HOME" \
    && flutter config --no-analytics --no-cli-animations \
    && flutter precache --universal \
    && flutter --version

WORKDIR /root
