import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const port = 9232;
const chromium = spawn("chromium", ["--headless=new", "--no-sandbox", "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/rescue-network-port-school-route", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageTarget() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) return (await response.json()).find((target) => target.type === "page");
    } catch {}
    await sleep(150);
  }
  throw new Error("تعذر تشغيل متصفح فحص طريق الميناء");
}

try {
  const target = await pageTarget();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
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
  const capture = async (name) => {
    const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const path = `/home/ubuntu/${name}.png`;
    await writeFile(path, Buffer.from(image.data, "base64"));
    return path;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 48; attempt += 1) {
      await sleep(250);
      if (await evaluate(expression)) return true;
    }
    return false;
  };

  await send("Emulation.setDeviceMetricsOverride", { width: 812, height: 375, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: "landscapePrimary", angle: 90 } });
  await send("Page.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:3000/?flood" });
  if (!(await waitFor("Boolean(document.querySelector('.asset-loader'))"))) throw new Error("لم تبدأ دورة التحميل في اختبار طريق الميناء");
  if (!(await waitFor("!document.querySelector('.asset-loader')"))) throw new Error("لم تكتمل شاشة التحميل في اختبار طريق الميناء");
  const clickNode = async (nodeId) => {
    await evaluate(`document.querySelector('[data-node-id="${nodeId}"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(180);
  };
  const routeBefore = await evaluate(`document.querySelector('[data-road-route="harbor"]')?.getAttribute('data-detour') ?? null`);
  await clickNode("harbor");
  if (!(await waitFor(`document.querySelector('.detour-panel li:nth-child(2)')?.classList.contains('active')`))) throw new Error("لم يفتح اختيار المدرسة بعد الضغط على الميناء");
  await clickNode("school");
  if (!(await waitFor(`document.querySelector('.hq-node')?.classList.contains('detour-confirm')`))) throw new Error("لم تُقبل المدرسة كنقطة عبور للميناء");
  await evaluate(`document.querySelector('.hq-node')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))`);
  if (!(await waitFor(`!document.querySelector('.detour-panel')`))) throw new Error("لم يؤكد نفق الإخلاء التحويل اليدوي");
  await clickNode("harbor");
  const decision = await evaluate(`(() => { const route = document.querySelector('[data-road-route="harbor"]'); return { detour: route?.getAttribute('data-detour'), waypointCount: route?.getAttribute('data-road-waypoints'), vehicleRate: route?.getAttribute('data-vehicle-rate'), hasArtificialRoad: Boolean(document.querySelector('.active-road-layer')) }; })()`);
  if (decision?.detour !== "school" || Number(decision?.waypointCount) < 11 || Number(decision?.vehicleRate) !== 1.15 || decision?.hasArtificialRoad) throw new Error(`فشل تفعيل طريق المدرسة–الميناء أو إبطائه فقط: ${JSON.stringify({ routeBefore, decision })}`);
  await sleep(350);
  const first = await capture("port-school-route-first-review");
  await sleep(1700);
  const second = await capture("port-school-route-second-review");
  const viewport = await evaluate(`(() => { const frame = document.querySelector('.game-frame')?.getBoundingClientRect(); const controls = document.querySelector('.controls')?.getBoundingClientRect(); return { frame: frame && { width: frame.width, height: frame.height }, controls: controls && { width: controls.width, height: controls.height, bottom: innerHeight - controls.bottom } }; })()`);
  console.log(JSON.stringify({ status: "captured", routeBefore, decision, first, second, viewport }));
  socket.close();
} finally {
  chromium.kill("SIGTERM");
}
