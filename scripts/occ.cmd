@echo off
REM occ CLI wrapper for Windows (opencode-config 简写)
REM Usage: occ <command> [args...]
REM Or:    npm run occ -- <command> [args...]

node "%~dp0\occ.mjs" %*
