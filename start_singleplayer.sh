#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
echo "本窗口仅提供单人静态网页，不支持局域网 WebSocket。"
echo "单人地址：http://localhost:8000"
exec python3 -m http.server 8000
