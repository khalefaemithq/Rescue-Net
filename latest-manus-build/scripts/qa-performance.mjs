import { spawn } from "node:child_process";

const port = 9230;
const chromium = spawn("chromium", ["--headless=new", "--no-sandbox", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/rescue-network-performance-chromium", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function targets() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) return response.json();
    } catch {}
    await sleep(150);
  }
  throw new Error("لم يبدأ Chromium لاختبار الأداء");
}

async function run() {
  try {
    const page = (await targets()).find((target) => target.type === "page");
    if (!page) throw new Error("تعذر إنشاء صفحة اختبار الأداء");
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    const pending = new Map();
    let id = 1;
    socket.onmessage = (event) => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } };
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const requestId = id++; pending.set(requestId, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result)); socket.send(JSON.stringify({ id: requestId, method, params })); });
    const evaluate = async (expression) => { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); return result.result.value; };
    await send("Emulation.setDeviceMetricsOverride", { width: 812, height: 375, deviceScaleFactor: 2, mobile: true, screenOrientation: { type: "landscapePrimary", angle: 90 } });
    await send("Page.enable");
    await send("Page.navigate", { url: "http://127.0.0.1:3000/?demo" });
    await sleep(1200);
    const metrics = await evaluate(`(() => { const nav = performance.getEntriesByType('navigation')[0]; const resources = performance.getEntriesByType('resource'); const gate = document.querySelector('.orientation-gate'); return { ready: Boolean(document.querySelector('.rescue-map')), vehicles: document.querySelectorAll('.vehicle-sprite').length, targets: document.querySelectorAll('.target-node').length, landscape: innerWidth > innerHeight, gateHidden: Boolean(gate) && getComputedStyle(gate).display === 'none', viewport: innerWidth + 'x' + innerHeight, domContentLoadedMs: Math.round(nav?.domContentLoadedEventEnd ?? 0), resourceCount: resources.length }; })()`);
    if (!metrics.ready || metrics.vehicles < 1 || metrics.targets !== 5 || !metrics.landscape || !metrics.gateHidden || metrics.domContentLoadedMs > 3000) throw new Error(`فشل تحقق أداء الهاتف: ${JSON.stringify(metrics)}`);
    console.log(JSON.stringify({ status: "passed", metrics }));
    socket.close();
  } finally { chromium.kill("SIGTERM"); }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
