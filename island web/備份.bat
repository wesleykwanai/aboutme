@echo off
cd /d "C:\Users\kth\Documents\Website\island web"
set TS=%date:~0,4%%date:~5,2%%date:~8,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TS=%TS: =0%
set TS=%TS:/=%
set TS=%TS::=%
mkdir "backup\%TS%" 2>nul
copy island.html "backup\%TS%\" >nul
copy notes.json "backup\%TS%\" >nul
copy "%USERPROFILE%\Downloads\island-settings.json" "backup\%TS%\" >nul
echo done backup\%TS%
pause
