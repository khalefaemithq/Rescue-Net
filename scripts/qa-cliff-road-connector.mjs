import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const port = 9234;
const chromium = spawn("chromium", ["--headless=new", "--no-sandbox", "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/rescue-network-cliff-road", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageTarget() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) return (await response.json()).find((target) => target.type === "page");
    } catch {}
    await sleep(150);
  }
  throw new Error("تعذر تشغيل متصفح فحص وصلة الانهيار");
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
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 48; attempt += 1) {
      await sleep(200);
      if (await evaluate(expression)) return true;
    }
    return false;
  };
  const capture = async (name) => {
    const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const path = `/home/ubuntu/${name}.png`;
    await writeFile(path, Buffer.from(image.data, "base64"));
    return path;
  };

  await send("Emulation.setDeviceMetricsOverride", { width: 812, height: 375, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: "landscapePrimary", angle: 90 } });
  await send("Page.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:3000/?cliff&roads" });
  if (!(await waitFor("!document.querySelector('.asset-loader')"))) throw new Error("لم يكتمل تحميل فحص الانهيار");
  const before = await evaluate(`(() => ({ hasPanel: Boolean(document.querySelector('.detour-panel')), hasResidential: Boolean(document.querySelector('[data-node-id="residential"]')), route: document.querySelector('[data-road-route="residential"]')?.getAttribute('data-cliff-detour') ?? null, notice: document.querySelector('.map-notice')?.textContent ?? '' }))()`);
  const clickNode = async (nodeId) => {
    await evaluate(`document.querySelector('[data-node-id="${nodeId}"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(180);
  };
  await clickNode("residential");
  if (!(await waitFor("document.querySelector('.detour-panel li:nth-child(2)')?.classList.contains('active')"))) {
    const afterClick = await evaluate(`(() => ({ hasPanel: Boolean(document.querySelector('.detour-panel')), panel: document.querySelector('.detour-panel')?.textContent ?? '', notice: document.querySelector('.map-notice')?.textContent ?? '' }))()`);
    throw new Error(`لم يفتح اختيار الاتصالات بعد انهيار طريق الحي: ${JSON.stringify({ before, afterClick })}`);
  }
  await clickNode("radio");
  if (!(await waitFor("document.querySelector('.hq-node')?.classList.contains('detour-confirm')"))) throw new Error("لم تُقبل الاتصالات كنقطة عبور للحي");
  await evaluate("document.querySelector('.hq-node')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))");
  if (!(await waitFor("!document.querySelector('.detour-panel')"))) throw new Error("لم يؤكد نفق الإخلاء وصلة الانهيار");
  const route = await evaluate(`(() => { const element = document.querySelector('[data-road-route="residential"]'); return { cliff: element?.getAttribute('data-cliff-detour'), waypoints: Number(element?.getAttribute('data-road-waypoints')), rate: Number(element?.getAttribute('data-vehicle-rate')), debug: Boolean(document.querySelector('[data-road-debug="visible"]')), hasArtificialRoad: Boolean(document.querySelector('.active-road-layer')) }; })()`);
  if (route.cliff !== "radio" || route.waypoints < 40 || route.rate !== 1.15 || !route.debug || route.hasArtificialRoad) throw new Error(`فشل وصلة الانهيار: ${JSON.stringify(route)}`);
  await sleep(450);
  const first = await capture("cliff-radio-residential-first-review");
  await sleep(1500);
  const second = await capture("cliff-radio-residential-second-review");
  console.log(JSON.stringify({ status: "captured", route, first, second }));
  socket.close();
} finally {
  chromium.kill("SIGTERM");
}
