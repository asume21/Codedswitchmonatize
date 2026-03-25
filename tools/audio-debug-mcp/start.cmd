@echo off
cd /d "%~dp0"
node --import tsx/esm src/index.ts
