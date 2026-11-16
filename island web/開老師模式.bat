@echo off
cd /d "C:\Users\kth\Documents\Website\island web"
start http://localhost:8901/island.html?edit=1
python -m http.server 8901
