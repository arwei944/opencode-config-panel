@echo off
REM opencode-config CLI wrapper for Windows
REM Usage: opencode-config <command> [args...]
REM Or:    npm run config -- <command> [args...]

node "%~dp0\opencode-config.mjs" %*
