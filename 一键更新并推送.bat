@echo off
chcp 936 >nul
cd /d "%~dp0"
title 彩票统计 - 一键更新并推送

echo ============================================
echo   抓取最新数据 ^-^ 生成成品 ^-^ 推送到 GitHub
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有检测到 Python，请先安装并勾选 Add Python to PATH
  pause
  exit /b 1
)

echo [1/4] 正在抓取四彩种最新数据...
python cron_refresh.py --poll-minutes 0
if errorlevel 1 (
  echo.
  echo [失败] 抓取失败，未推送。请检查网络后重试。
  pause
  exit /b 1
)

echo.
echo [2/4] 复制成品到仓库根目录（方便单独上传）...
copy /y "dist\单文件版\彩票统计.html" "彩票统计.html" >nul

echo [3/4] 提交...
git add dist 彩票统计.html
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "chore(data): 本地刷新开奖数据 %date% %time%"
) else (
  echo   数据无变化，跳过提交
)

echo [4/4] 推送到 GitHub...
git push
if errorlevel 1 (
  echo.
  echo [失败] 推送失败。若未配置 git 远程或凭据，请手动上传：
  echo       彩票统计.html
  pause
  exit /b 1
)

echo.
echo --------------------------------------------
echo 完成！GitHub Pages 约 1 分钟后生效。
echo --------------------------------------------
echo.
pause
