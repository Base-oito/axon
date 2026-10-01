#!/bin/bash
# Configura o ambiente para build Android do Axon (sem sudo, tudo em ~)
export JAVA_HOME="$HOME/jdk21"
export ANDROID_HOME="$HOME/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"