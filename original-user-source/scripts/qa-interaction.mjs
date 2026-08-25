import { spawn } from "node:child_process";

const port = 9228;
const chromium = spawn("chromium", [
  "--headless=new",
  "--no-sandbox",
  "--autoplay-policy=no-user-gesture-required",
  `--remote-debugging-port=${port}`,
  "--user-data-dir=/tmp/rescue-network-qa-chromium",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDebugger() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) return response.json();
    } catch {
      // Chromium has not opened its debugger endpoint yet.
    }
    await sleep(150);
  }
  throw new Error("لم يبدأ Chromium في وضع الاختبار");
}

async function run() {
  try {
    const initialTargets = await waitForDebugger();
    const page = initialTargets.find((target) => target.type === "page");
    if (!page) throw new Error("تعذر إنشاء صفحة اختبار");

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
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    });

    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    const waitForAssets = async () => {
      for (let attempt = 0; attempt < 45; attempt += 1) {
        await sleep(180);
        if (await evaluate(`!document.querySelector('.asset-loader')`)) return;
      }
      throw new Error("لم تكتمل الأصول قبل محاولة التفاعل مع الخريطة");
    };

    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 812, height: 375, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: "landscapePrimary", angle: 90 } });
    await send("Page.navigate", { url: "http://127.0.0.1:3000/" });
    let assetsReady = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await sleep(200);
      assetsReady = await evaluate(`Boolean(document.querySelector('.primary-action') && !document.querySelector('.primary-action')?.disabled)`);
      if (assetsReady) break;
    }
    if (!assetsReady) throw new Error("لم يكتمل التحميل المسبق للأصول ضمن زمن الاختبار");
    await evaluate(`document.querySelector('.primary-action')?.click()`);
    await sleep(180);
    const thunderAtStart = await evaluate(`({ count: document.querySelectorAll('audio[data-rescue-audio="thunder-real"]').length, source: document.querySelector('audio[data-rescue-audio="thunder-real"]')?.getAttribute('src') ?? '' })`);
    await sleep(2070);
    const naturalLightning = await evaluate(`({ cue: document.querySelector('.lightning-strike')?.getAttribute('data-lightning-cue') ?? '', boltAnimation: getComputedStyle(document.querySelector('.lightning-art') ?? document.body).animationName, boltSources: [...document.querySelectorAll('.lightning-art')].map((art) => art.getAttribute('href') ?? ''), flashAnimation: getComputedStyle(document.querySelector('.lightning-flash') ?? document.body).animationName })`);

    const mapPanResult = await evaluate(`(() => {
      const svg = document.querySelector('.rescue-map');
      if (!svg) return Promise.resolve({ before: '', after: '', zoom: '', defaultZoom: '' });
      const before = svg.getAttribute('data-map-view') ?? '';
      const box = svg.getBoundingClientRect();
      const fire = (type, point) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 9, pointerType: 'touch', buttons: 1, clientX: point.x, clientY: point.y }));
      fire('pointerdown', { x: box.left + 12, y: box.top + box.height * .8 });
      fire('pointermove', { x: box.left + box.width * .36, y: box.top + box.height * .55 });
      fire('pointerup', { x: box.left + box.width * .36, y: box.top + box.height * .55 });
      return new Promise((resolve) => window.setTimeout(() => resolve({ before, after: svg.getAttribute('data-map-view') ?? '', zoom: svg.getAttribute('data-map-zoom') ?? '', defaultZoom: svg.getAttribute('data-map-default-zoom') ?? '' }), 80));
    })()`);

    const zoomControlResult = await evaluate(`(async () => {
      const svg = document.querySelector('.rescue-map');
      const zoomIn = document.querySelector('[data-map-zoom-control="in"]');
      const zoomOut = document.querySelector('[data-map-zoom-control="out"]');
      if (!svg || !zoomIn || !zoomOut) return { missing: true };
      const initial = Number(svg.getAttribute('data-map-zoom'));
      const pause = () => new Promise((resolve) => window.setTimeout(resolve, 45));
      for (let step = 0; step < 4; step += 1) { zoomIn.click(); await pause(); }
      const max = Number(svg.getAttribute('data-map-zoom'));
      for (let step = 0; step < 7; step += 1) { zoomOut.click(); await pause(); }
      const min = Number(svg.getAttribute('data-map-zoom'));
      const box = svg.getBoundingClientRect();
      const fire = (type, id, x, y) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', buttons: 1, clientX: x, clientY: y }));
      fire('pointerdown', 21, box.left + box.width * .42, box.top + box.height * .42);
      fire('pointerdown', 22, box.left + box.width * .58, box.top + box.height * .58);
      fire('pointermove', 21, box.left + box.width * .30, box.top + box.height * .30);
      fire('pointermove', 22, box.left + box.width * .70, box.top + box.height * .70);
      fire('pointerup', 21, box.left + box.width * .30, box.top + box.height * .30);
      fire('pointerup', 22, box.left + box.width * .70, box.top + box.height * .70);
      return new Promise((resolve) => window.setTimeout(() => resolve({ initial, max, min, pinched: Number(svg.getAttribute('data-map-zoom')), inDisabled: zoomIn.disabled, outDisabled: zoomOut.disabled }), 100));
    })()`);

    const dragResult = await evaluate(`(() => {
      const svg = document.querySelector('.rescue-map');
      const hq = document.querySelector('.hq-node');
      const target = [...document.querySelectorAll('.target-node')].find((node) => node.textContent.includes('المستشفى'));
      if (!svg || !hq || !target) return 'missing-target';
      const center = (element) => { const box = element.getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; };
      const from = center(hq); const to = center(target);
      const fire = (type, element, point) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: point.x, clientY: point.y }));
      fire('pointerdown', hq, from); fire('pointermove', svg, to); fire('pointerup', svg, to);
      return 'drag-dispatched';
    })()`);
    await sleep(300);

    const routeCount = await evaluate(`document.querySelectorAll('[data-road-route][data-road-waypoints]').length`);
    const vehicleBefore = await evaluate(`document.querySelector('.vehicle-sprite')?.parentElement?.getAttribute('transform') ?? ''`);
    const vehicleAngles = [];
    for (let sample = 0; sample < 7; sample += 1) {
      await sleep(360);
      vehicleAngles.push(await evaluate(`document.querySelector('.vehicle-sprite')?.parentElement?.getAttribute('transform') ?? ''`));
    }
    const vehicleAfter = vehicleAngles.at(-1) ?? '';
    const angleValues = vehicleAngles.map((transform) => Number(transform.match(/rotate\((-?[0-9.]+)/)?.[1] ?? 0));
    const vehicleTurns = new Set(angleValues.map((angle) => Math.round(angle / 8))).size >= 3;
    const vehicleMotion = Boolean(vehicleBefore && vehicleAfter && vehicleBefore !== vehicleAfter && vehicleAfter.includes('rotate(') && vehicleTurns);
    let realAudioState = await evaluate(`({
      storm: [...document.querySelectorAll('audio[data-rescue-audio="storm-real"]')].map((audio) => ({ ready: audio.readyState >= 2, paused: audio.paused, volume: audio.volume })),
      ambulance: [...document.querySelectorAll('audio[data-rescue-audio="ambulance-real"]')].map((audio) => ({ ready: audio.readyState >= 2, paused: audio.paused, volume: audio.volume })),
      thunder: [...document.querySelectorAll('audio[data-rescue-audio="thunder-real"]')].map((audio) => ({ ready: audio.readyState >= 2, paused: audio.paused, volume: audio.volume }))
    })`);
    await evaluate(`([...document.querySelectorAll('.control')].find((button) => button.textContent.includes('مسار طوارئ')))?.click()`);
    await sleep(150);
    await evaluate(`([...document.querySelectorAll('.target-node')].find((node) => node.textContent.includes('المدرسة')))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(180);
    const emergencyActive = await evaluate(`([...document.querySelectorAll('.control')].find((button) => button.textContent.includes('أوقف الطوارئ')))?.textContent.includes('أوقف') ?? false`);
    await evaluate(`([...document.querySelectorAll('.control')].find((button) => button.textContent.includes('أوقف الطوارئ')))?.click()`);
    await sleep(120);
    const emergencyCancelled = await evaluate(`([...document.querySelectorAll('.control')].find((button) => button.textContent.includes('مسار طوارئ')))?.textContent.includes('مسار طوارئ') ?? false`);
    await evaluate(`([...document.querySelectorAll('.control')].find((button) => button.textContent.includes('إيقاف')))?.click()`);
    await sleep(180);
    const paused = await evaluate(`([...document.querySelectorAll('.control')].find((button) => button.textContent.includes('متابعة')))?.textContent.includes('متابعة') ?? false`);
    await evaluate(`([...document.querySelectorAll('.control')].find((button) => button.textContent.includes('متابعة')))?.click()`);
    await sleep(180);
    await evaluate(`([...document.querySelectorAll('.control')].find((button) => button.textContent.includes('سرعة')))?.click()`);
    await sleep(180);
    const spedUp = await evaluate(`([...document.querySelectorAll('.control')].find((button) => button.textContent.includes('سرعة')))?.textContent.includes('×2') ?? false`);
    const landscapeState = await evaluate(`(() => { const gate = document.querySelector('.orientation-gate'); return { isLandscape: window.innerWidth > window.innerHeight, orientationGateHidden: Boolean(gate) && getComputedStyle(gate).display === 'none', hasBalancedPopulation: document.querySelector('.status-chip.light')?.textContent.includes('124') ?? false }; })()`);
    const interactionResult = { routeCount, vehicleMotion, vehicleAngles: angleValues, emergencyActive, emergencyCancelled, paused, spedUp, realAudioState, thunderAtStart, naturalLightning, mapPanResult, ...landscapeState };

    if (interactionResult.routeCount < 1 || !interactionResult.vehicleMotion || naturalLightning.cue !== '0' || naturalLightning.boltAnimation !== 'lightning-bolt-hold' || !naturalLightning.boltSources.some((source) => source.includes('rescue-lightning-calinou-alpha')) || naturalLightning.flashAnimation !== 'lightning-flash' || thunderAtStart.count < 1 || !thunderAtStart.source.includes('rescue-thunder-cc0') || mapPanResult.before === mapPanResult.after || mapPanResult.defaultZoom !== '1.68' || zoomControlResult.missing || zoomControlResult.max < 2.77 || zoomControlResult.min > 1.01 || zoomControlResult.pinched <= zoomControlResult.min || !interactionResult.isLandscape || !interactionResult.orientationGateHidden || !interactionResult.hasBalancedPopulation || !interactionResult.emergencyActive || !interactionResult.emergencyCancelled || !interactionResult.paused || !interactionResult.spedUp || !realAudioState.storm[0]?.ready || realAudioState.storm[0]?.paused || realAudioState.storm[0]?.volume <= 0 || !realAudioState.ambulance[0]?.ready || realAudioState.ambulance[0]?.paused || realAudioState.ambulance[0]?.volume <= 0 || realAudioState.ambulance[0]?.volume > 0.028) {
      throw new Error(`فشل تحقق التفاعل: ${JSON.stringify({ dragResult, interactionResult })}`);
    }
    await send("Page.navigate", { url: "http://127.0.0.1:3000/?result" });
    await waitForAssets();
    const resultCard = await evaluate(`({ hasCard: Boolean(document.querySelector('.share-card')), hasBridge: document.querySelector('.share-card')?.textContent.includes('انهيار الجسر') ?? false, hasCopy: Boolean(document.querySelector('.copy-share')), hasStorm: document.querySelector('.storm-banner')?.textContent.includes('وصلت العاصفة') ?? false, hasLosses: document.querySelector('.loss-stat')?.textContent.includes('فُقدوا') ?? false, hasLossJourney: Boolean(document.querySelector('.loss-journey')), hasIntegerLoss: !document.querySelector('.loss-stat')?.textContent.includes('.') ?? false, hasSound: Boolean(document.querySelector('.sound-control')), hasAmbulance: document.querySelectorAll('.vehicle-sprite').length > 0 })`);
    if (!resultCard.hasCard || !resultCard.hasBridge || !resultCard.hasCopy || !resultCard.hasStorm || !resultCard.hasLosses || !resultCard.hasLossJourney || !resultCard.hasIntegerLoss || !resultCard.hasSound || !resultCard.hasAmbulance) throw new Error(`فشل تحقق بطاقة المشاركة: ${JSON.stringify(resultCard)}`);
    await send("Page.navigate", { url: "http://127.0.0.1:3000/?storm&flash=4" });
    await waitForAssets();
    await sleep(2800);
    const stormResult = await evaluate(`(async () => { const visualAssets = await Promise.all([...document.querySelectorAll('.island-city-art, .target-sprite, .lightning-art')].map(async (asset) => { const response = await fetch(asset.href.baseVal); return { ok: response.ok, image: response.headers.get('content-type')?.includes('image/') ?? false, size: Number(response.headers.get('content-length') ?? 0), source: asset.getAttribute('href') ?? '' }; })); const targetSources = [...document.querySelectorAll('.target-sprite')].map((asset) => asset.getAttribute('href') || ''); const lightning = document.querySelector('.lightning-strike'); const rain = document.querySelector('.rainfall'); return { hasStormScene: Boolean(document.querySelector('.storm-scene')), hasLightning: Boolean(lightning), lightningVariant: lightning?.getAttribute('data-lightning-variant'), hasDoubleLightning: lightning?.getAttribute('data-lightning-double') === 'true', lightningAssets: [...document.querySelectorAll('.lightning-art')].map((asset) => asset.getAttribute('href') || ''), hasNoCloudscape: document.querySelectorAll('.storm-cloudscape').length === 0, hasFallingRain: Boolean(document.querySelector('.rainfall[data-rainfall="active"]')), rainDrops: document.querySelectorAll('.rain-drop').length, rainMultiplier: rain?.getAttribute('data-rain-multiplier'), rainClip: rain?.getAttribute('clip-path'), rainMinY: Math.min(...[...document.querySelectorAll('.rain-drop')].map((drop) => Number(drop.getAttribute('y1')))), hasNoRainImages: document.querySelectorAll('.rain-texture').length === 0, hasNoLegacyRainLines: document.querySelectorAll('.storm-squall').length === 0, hasNoNeonLines: document.querySelectorAll('.network-line').length === 0, hasRoadRoutes: document.querySelectorAll('[data-road-route][data-road-waypoints]').length > 0, visualAssets, targetSources, stage: document.querySelector('.game-shell')?.getAttribute('data-storm-stage'), thunderInterval: document.querySelector('.game-shell')?.getAttribute('data-thunder-interval'), stormVolume: document.querySelector('.game-shell')?.getAttribute('data-storm-volume'), realTrackVolume: document.querySelector('audio[data-rescue-audio="storm-real"]')?.volume ?? 0, realTrackPlaying: !(document.querySelector('audio[data-rescue-audio="storm-real"]')?.paused ?? true), hasPremiumResidential: targetSources.some((source) => source.includes('rescue-residential-premium')), hasPremiumRadio: targetSources.some((source) => source.includes('rescue-radio-premium')), premiumAmbulances: document.querySelectorAll('.premium-ambulance').length, hasLegacyAmbulance: document.querySelectorAll('.ambulance-red-body').length > 0, hasNoBlackHalo: [...document.querySelectorAll('.vehicle-sprite')].every((sprite) => getComputedStyle(sprite).filter === 'none') }; })()`);
    if (!stormResult.hasStormScene || !stormResult.hasLightning || stormResult.lightningVariant !== '5' || !stormResult.hasDoubleLightning || !stormResult.hasNoCloudscape || stormResult.lightningAssets.length < 2 || !stormResult.lightningAssets.every((source) => source.includes('rescue-lightning-calinou-alpha') && source.endsWith('.webp')) || !stormResult.hasFallingRain || stormResult.rainDrops !== 96 || stormResult.rainMultiplier !== '2' || stormResult.rainClip !== 'url(#rain-map-bounds)' || stormResult.rainMinY < 118 || !stormResult.hasNoRainImages || !stormResult.hasNoLegacyRainLines || !stormResult.hasNoNeonLines || !stormResult.hasRoadRoutes || stormResult.visualAssets.length < 8 || stormResult.visualAssets.some((asset) => !asset.ok || !asset.image || asset.size < 512) || stormResult.stage !== '5' || stormResult.thunderInterval !== '5' || stormResult.stormVolume !== '0.4' || stormResult.realTrackVolume < 0.25 || !stormResult.realTrackPlaying || !stormResult.hasPremiumResidential || !stormResult.hasPremiumRadio || stormResult.premiumAmbulances < 1 || stormResult.hasLegacyAmbulance || !stormResult.hasNoBlackHalo) throw new Error(`فشل تحقق العاصفة أو الإسعاف: ${JSON.stringify(stormResult)}`);
    await send("Page.navigate", { url: "http://127.0.0.1:3000/?bridge" });
    await waitForAssets();
    const bridgeResult = await evaluate(`({ visibleBuiltBridge: document.querySelector('[data-bridge="built"]') !== null, hasNoBridgeWarning: document.querySelector('.bridge-collapse-warning') === null, hasNoNeonLine: document.querySelectorAll('.network-line').length === 0 })`);
    if (bridgeResult.visibleBuiltBridge || !bridgeResult.hasNoBridgeWarning || !bridgeResult.hasNoNeonLine) throw new Error(`فشل تحقق إزالة تصميم الجسر: ${JSON.stringify(bridgeResult)}`);
    await send("Page.navigate", { url: "http://127.0.0.1:3000/?strike" });
    await waitForAssets();
    await sleep(200);
    const strikeResult = await evaluate(`({ bolt: Boolean(document.querySelector('[data-radio-strike="active"]')), losses: document.querySelector('.radio-strike-caption')?.textContent.includes('صعقة اتصالات') ?? false, radioLoss: document.querySelector('.casualty-note')?.textContent.match(/−[12]/)?.[0] ?? '' })`);
    if (!strikeResult.bolt || !strikeResult.losses || !strikeResult.radioLoss) throw new Error(`فشل تحقق صعقة الاتصالات: ${JSON.stringify(strikeResult)}`);
    await send("Page.navigate", { url: "http://127.0.0.1:3000/?flood" });
    await waitForAssets();
    await evaluate(`document.querySelector('[data-node-id="harbor"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(100);
    await evaluate(`document.querySelector('[data-node-id="school"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(100);
    await evaluate(`document.querySelector('.hq-node')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(180);
    const floodResult = await evaluate(`({ hasNoFloodImage: !document.querySelector('[data-harbor-flood="active"], .harbor-surge-art'), phase: document.querySelector('.game-shell')?.getAttribute('data-phase') ?? '', detour: document.querySelector('[data-road-route="harbor"]')?.getAttribute('data-detour') === 'school', waypoints: Number(document.querySelector('[data-road-route="harbor"]')?.getAttribute('data-road-waypoints') ?? 0), guide: document.querySelector('[data-detour-guide]')?.textContent ?? '', hqClass: document.querySelector('.hq-node')?.getAttribute('class') ?? '', viaTarget: document.querySelector('.detour-via-target')?.textContent ?? '' })`);
    if (!floodResult.hasNoFloodImage || !floodResult.detour || floodResult.waypoints < 11) throw new Error(`فشل تحقق فيضان الميناء: ${JSON.stringify(floodResult)}`);
    await send("Page.navigate", { url: "http://127.0.0.1:3000/?cliff" });
    await waitForAssets();
    await evaluate(`document.querySelector('[data-node-id="residential"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(100);
    await evaluate(`document.querySelector('[data-node-id="radio"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(100);
    await evaluate(`document.querySelector('.hq-node')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(180);
    const cliffResult = await evaluate(`({ collapse: document.querySelector('[data-cliff-collapse="active"]') === null, banner: document.querySelector('[data-cliff-banner="active"]') === null, notice: document.querySelector('.map-notice')?.textContent ?? '', detour: document.querySelector('[data-road-route="residential"]')?.getAttribute('data-cliff-detour') === 'radio', waypoints: Number(document.querySelector('[data-road-route="residential"]')?.getAttribute('data-road-waypoints') ?? 0) })`);
    if (!cliffResult.collapse || !cliffResult.banner || !cliffResult.detour || cliffResult.waypoints < 14) throw new Error(`فشل تحقق إعلان الجرف ومسار الحي البديل: ${JSON.stringify(cliffResult)}`);
    await send("Page.navigate", { url: "http://127.0.0.1:3000/?win" });
    await waitForAssets();
    await sleep(400);
    const victoryResult = await evaluate(`({ hasFinale: Boolean(document.querySelector('.evacuation-finale')), hasVisibleFinaleJourney: Boolean(document.querySelector('.finale-journey')), hasFinaleCopy: document.querySelector('.finale-copy')?.textContent.includes('أُخليت الجزيرة') ?? false, hasNoLosses: document.querySelector('.success-stat')?.textContent.includes('أُخليت الجزيرة') ?? false })`);
    if (!victoryResult.hasFinale || !victoryResult.hasVisibleFinaleJourney || !victoryResult.hasFinaleCopy || !victoryResult.hasNoLosses) throw new Error(`فشل تحقق أنيميشن الإخلاء النهائي: ${JSON.stringify(victoryResult)}`);
    console.log(JSON.stringify({ dragResult, interactionResult, resultCard, stormResult, bridgeResult, strikeResult, floodResult, cliffResult, victoryResult, status: "passed" }));
    socket.close();
  } finally {
    chromium.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
