#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
if command -v node >/dev/null 2>&1; then
  echo "检测到 Node.js，将启动完整的 HTTP + WebSocket 服务（支持局域网联机）。"
  exec node "$(pwd)/lan-server.js"
fi
echo "[警告] 未检测到 Node.js，只能启动单人静态服务。"
echo "此模式不支持局域网，/_lan/info 与 /ws 会返回 404。"
echo "单人地址：http://localhost:8000"
exec python3 -m http.server 8000
