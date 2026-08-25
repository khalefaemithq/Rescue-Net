import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const port = 9231;
const chromium = spawn("chromium", ["--headless=new", "--no-sandbox", "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/rescue-network-mobile-review", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function debuggerTarget() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) return (await response.json()).find((target) => target.type === "page");
    } catch {}
    await sleep(150);
  }
  throw new Error("تعذر تشغيل متصفح مراجعة الهاتف");
}

try {
  const page = await debuggerTarget();
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
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return result.result.value;
  };
  const capture = async (name) => {
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const path = `/home/ubuntu/mobile-${name}-review.png`;
    await writeFile(path, Buffer.from(screenshot.data, "base64"));
    return path;
  };
  const waitForAssets = async () => {
    for (let attempt = 0; attempt < 48; attempt += 1) {
      await sleep(250);
      const ready = await evaluate(`!document.querySelector('.asset-loader')`);
      if (ready) return true;
    }
    return false;
  };
  const visitAndCapture = async (name, query) => {
    await send("Page.navigate", { url: `http://127.0.0.1:3000/${query}` });
    if (!(await waitForAssets())) throw new Error(`لم يكتمل تحميل الأصول للقطعة المرئية: ${name}`);
    await sleep(600);
    return capture(name);
  };

  await send("Emulation.setDeviceMetricsOverride", { width: 812, height: 375, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: "landscapePrimary", angle: 90 } });
  await send("Page.enable");
  const captures = {};
  await send("Page.navigate", { url: "http://127.0.0.1:3000/?demo" });
  let loaderStarted = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(100);
    loaderStarted = await evaluate("Boolean(document.querySelector('.asset-loader'))");
    if (loaderStarted) break;
  }
  if (!loaderStarted) throw new Error("لم تظهر شاشة التحميل لصفحة الفحص");
  captures.loader = await capture("loader-review");
  const loader = await evaluate(`(() => {
    const element = document.querySelector('.asset-loader');
    const rect = element?.getBoundingClientRect();
    const samples = [[8, 8], [innerWidth - 8, 8], [8, innerHeight - 8], [innerWidth - 8, innerHeight - 8], [innerWidth / 2, innerHeight / 2]];
    return {
      exists: Boolean(element),
      fullViewport: Boolean(rect && Math.abs(rect.width - innerWidth) < 1 && Math.abs(rect.height - innerHeight) < 1 && rect.left === 0 && rect.top === 0),
      onlyPercentContent: Boolean(element && /^\\s*\\d+%\\s*$/.test(element.textContent ?? "") && !element.querySelector('small, span')),
      coversSamples: Boolean(element && samples.every(([x, y]) => element.contains(document.elementFromPoint(x, y)))),
      opaque: Boolean(element && getComputedStyle(element).backgroundColor === 'rgb(8, 20, 38)'),
    };
  })()`);
  if (!loader.exists || !loader.fullViewport || !loader.onlyPercentContent || !loader.coversSamples || !loader.opaque) throw new Error(`فشل عزل شاشة التحميل: ${JSON.stringify(loader)}`);
  if (!(await waitForAssets())) throw new Error("لم تكتمل شاشة التحميل في فحص العزل");
  const readyState = await evaluate(`(() => { const header = document.querySelector('.game-header')?.getBoundingClientRect(); return { retryVisible: Boolean(document.querySelector('.asset-retry')), timeInset: Boolean(header && header.right <= innerWidth - 24 && header.left >= 0) }; })()`);
  if (readyState.retryVisible || !readyState.timeInset) throw new Error(`فشل جاهزية الأصول أو موضع التوقيت: ${JSON.stringify(readyState)}`);
  captures.demo = await visitAndCapture("demo", "?demo");
  captures.storm = await visitAndCapture("storm", "?storm&flash=4");
  captures.strike = await visitAndCapture("strike", "?strike");
  captures.bridge = await visitAndCapture("bridge", "?bridge");
  captures.flood = await visitAndCapture("flood", "?flood");
  captures.cliff = await visitAndCapture("cliff", "?cliff");
  const cliffVisible = await evaluate(`(() => { const gate = document.querySelector('.orientation-gate'); return { orientation: innerWidth > innerHeight, gateHidden: Boolean(gate) && getComputedStyle(gate).display === 'none', collapse: Boolean(document.querySelector('[data-cliff-collapse="active"]')), detour: document.querySelector('[data-road-route="residential"]')?.getAttribute('data-cliff-detour') === 'radio' }; })()`);
  if (!cliffVisible.orientation || !cliffVisible.gateHidden || cliffVisible.collapse || !cliffVisible.detour) throw new Error(`فشل تحقق الهاتف الأفقي أو إزالة رسم الجرف ومسار التحويل: ${JSON.stringify(cliffVisible)}`);
  await send("Page.navigate", { url: "http://127.0.0.1:3000/" });
  let startReady = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(250);
    startReady = await evaluate("Boolean(document.querySelector('.primary-action') && !document.querySelector('.primary-action')?.disabled)");
    if (startReady) break;
  }
  if (!startReady) throw new Error("لم يكتمل تحميل الهاتف قبل اختبار الصوت");
  await evaluate("document.querySelector('.primary-action')?.click()");
  await evaluate(`(() => {
    const svg = document.querySelector('.rescue-map');
    const hq = document.querySelector('.hq-node');
    const target = [...document.querySelectorAll('.target-node')].find((node) => node.textContent.includes('المستشفى'));
    if (!svg || !hq || !target) return false;
    const center = (element) => { const box = element.getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; };
    const from = center(hq); const to = center(target);
    const fire = (type, element, point) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'touch', buttons: 1, clientX: point.x, clientY: point.y }));
    fire('pointerdown', hq, from); fire('pointermove', svg, to); fire('pointerup', svg, to);
    return true;
  })()`);
  await sleep(450);
  const audio = await evaluate(`Object.fromEntries(['storm-real', 'ambulance-real', 'thunder-real'].map((name) => { const element = document.querySelector('audio[data-rescue-audio="' + name + '"]'); return [name, { ready: Boolean(element && element.readyState >= 2), paused: element?.paused ?? true, volume: element?.volume ?? 0 }]; }))`);
  console.log(JSON.stringify({ status: "captured", captures, loader, startReady, audio, cliffVisible }));
  socket.close();
} finally {
  chromium.kill("SIGTERM");
}
