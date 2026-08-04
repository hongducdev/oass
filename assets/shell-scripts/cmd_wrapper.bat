@echo off
REM AgentTer - Minimal cmd.exe shell integration
REM Provides basic preexec/precmd hooks for command block detection

set AGENTTER_SHELL=cmd
set AGENTTER_INITIALIZED=1

REM Emit DCS hook via echo
echo %ESC%P{"hook":"Precmd","value":{"pwd":"%CD%"}}%ESC%\
echo AgentTer shell integration active (cmd.exe mode)
echo.

REM Override prompt to emit hooks on each command
prompt $P$_$G$S
