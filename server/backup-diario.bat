@echo off
rem Backup diario do Instituto Lirios (chamado pelo Agendador de Tarefas do Windows).
cd /d "%~dp0"
if not exist backups mkdir backups
echo ==== %date% %time% ==== >> backups\backup.log
node backup.js >> backups\backup.log 2>&1
