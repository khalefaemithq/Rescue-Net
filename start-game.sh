#!/bin/bash
# تشغيل نسخة اللعبة النهائية (latest-manus-build) وإتاحتها على المنفذ 3000
cd "$(dirname "$0")/latest-manus-build"
if [ ! -d node_modules ]; then pnpm install --prefer-offline; fi
if [ ! -f dist/index.js ] || [ ! -d dist/public/assets ]; then pnpm build; fi
pkill -f "node dist/index.js" 2>/dev/null || true
sleep 1
setsid env NODE_ENV=production node dist/index.js > /tmp/rescue-server.log 2>&1 < /dev/null &
sleep 3
if curl -s -o /dev/null --max-time 5 http://localhost:3000/; then
  echo "✓ اللعبة تعمل: افتح تبويب PORTS ثم المنفذ 3000 → Open in Browser"
else
  echo "✗ فشل التشغيل — راجع /tmp/rescue-server.log"
fi
