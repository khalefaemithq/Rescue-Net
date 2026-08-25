# تحقق الأرشيف الكامل

قبل تسليم أرشيف المصدر، تحقّق من وجود المسارات الآتية بعد فك الضغط:

```text
client/src/pages/Home.tsx
client/src/game/engine.ts
client/src/game/audio.ts
client/src/game/engine.test.ts
scripts/qa-interaction.mjs
scripts/qa-mobile-screenshot.mjs
package.json
pnpm-lock.yaml
ROAD_GRAPH_DESIGN_AR.md
ASSETS_MANIFEST_AR.md
game-assets/rescue-network-expanded-map-port-school-road.webp
game-assets/rescue-ambulance-premium.png
```

الأرشيف يستثني فقط `node_modules` و`dist` و`.git` والسجلات؛ تستعاد الاعتماديات عبر `pnpm install`. يحتوي `game-assets/` النسخ المحلية من خريطة اللعبة والسيارة والمباني والصوتيات المستخدمة حاليًا، بينما يوضح `ASSETS_MANIFEST_AR.md` مطابقة كل ملف لمساره في المصدر.
