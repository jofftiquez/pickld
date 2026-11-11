#!/usr/bin/env zsh
# Installs JDK 17 and Maestro on a fresh Mac satellite (or any Mac with Homebrew) for the Maestro flows.
#   mac_shell: scripts/mac-setup.sh
# Safe to run again. Writes JAVA_HOME and PATH to ~/.zshenv so later shells find both.
set -euo pipefail

MAESTRO_VERSION=2.12.1

brew list openjdk@17 >/dev/null 2>&1 || brew install openjdk@17
java_home="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
export JAVA_HOME="$java_home" PATH="$java_home/bin:$HOME/.maestro/bin:$PATH"

if [[ "$(maestro --version 2>/dev/null | tail -1)" != "$MAESTRO_VERSION" ]]; then
  curl -fsSL "https://get.maestro.mobile.dev" | MAESTRO_VERSION="$MAESTRO_VERSION" bash
fi

marker="# pickld: JDK 17 and Maestro"
if ! grep -Fqx "$marker" ~/.zshenv 2>/dev/null; then
  cat >>~/.zshenv <<EOF

$marker
export JAVA_HOME="$java_home"
export PATH="\$JAVA_HOME/bin:\$HOME/.maestro/bin:\$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1
export LANG=en_US.UTF-8
EOF
fi
java -version 2>&1 | head -1
maestro --version | tail -1
