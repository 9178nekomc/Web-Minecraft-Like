#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js 18 或更高版本。"
  echo "Python http.server 只能打开单人网页，不能提供 /ws 联机端点。"
  exit 1
fi
echo "正在启动完整的 HTTP + WebSocket 局域网服务..."
exec node "$(pwd)/lan-server.js"
