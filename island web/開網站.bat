@echo off
cd /d "C:\Users\kth\Documents\Website\island web"
start http://localhost:8901/island.html
python -m http.server 8901
