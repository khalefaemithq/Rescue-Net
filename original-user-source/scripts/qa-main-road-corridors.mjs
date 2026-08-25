import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const port = 9233;
const chromium = spawn("chromium", ["--headless=new", "--no-sandbox", "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/rescue-network-main-road-corridors", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTarget() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) return (await response.json()).find((target) => target.type === "page");
    } catch {}
    await sleep(150);
  }
  throw new Error("تعذر تشغيل متصفح فحص الطرق الرئيسية");
}

try {
  const page = await waitForTarget();
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const capture = async (nodeId) => {
    const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const path = `/home/ubuntu/road-main-${nodeId}-review.png`;
    await writeFile(path, Buffer.from(image.data, "base64"));
    return path;
  };
  const waitForAssets = async () => {
    for (let attempt = 0; attempt < 48; attempt += 1) {
      await sleep(250);
      if (await evaluate("!document.querySelector('.asset-loader')")) return true;
    }
    return false;
  };
  const waitForLoaderToStart = async () => {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await sleep(100);
      if (await evaluate("Boolean(document.querySelector('.asset-loader'))")) return true;
    }
    return false;
  };
  await send("Emulation.setDeviceMetricsOverride", { width: 812, height: 375, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: "landscapePrimary", angle: 90 } });
  await send("Page.enable");
  const nodeIds = ["residential", "hospital", "school", "harbor", "radio"];
  const captures = {};
  const routes = {};
  for (const nodeId of nodeIds) {
    await send("Page.navigate", { url: `http://127.0.0.1:3000/?road=${nodeId}&roads` });
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await sleep(100);
      if (await evaluate(`location.search === '?road=${nodeId}&roads'`)) break;
      if (attempt === 23) throw new Error(`لم تنتقل الصفحة إلى فحص طريق ${nodeId}`);
    }
    if (!(await waitForLoaderToStart())) throw new Error(`لم تبدأ دورة تحميل الطريق الرئيسي: ${nodeId}`);
    if (!(await waitForAssets())) throw new Error(`لم تكتمل الأصول للطريق الرئيسي: ${nodeId}`);
    await sleep(700);
    routes[nodeId] = await evaluate(`(() => { const route = document.querySelector('[data-road-route="${nodeId}"]'); return { present: Boolean(route), waypoints: Number(route?.getAttribute('data-road-waypoints')), rate: Number(route?.getAttribute('data-vehicle-rate')), debug: Boolean(document.querySelector('[data-road-debug="visible"]')), hasArtificialRoad: Boolean(document.querySelector('.active-road-layer')) }; })()`);
    if (!routes[nodeId].present || routes[nodeId].waypoints < 11 || routes[nodeId].rate !== 2.3 || !routes[nodeId].debug || routes[nodeId].hasArtificialRoad) throw new Error(`فشل طريق ${nodeId}: ${JSON.stringify(routes[nodeId])}`);
    captures[nodeId] = await capture(nodeId);
  }
  console.log(JSON.stringify({ status: "captured", captures, routes }));
  socket.close();
} finally {
  chromium.kill("SIGTERM");
}
