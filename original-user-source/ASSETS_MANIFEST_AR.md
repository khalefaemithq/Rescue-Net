# بيان الأصول المحلية — شبكة الإنقاذ

يتضمن الأرشيف مجلد `game-assets/` يحتوي النسخ المحلية للأصول المستدعاة من اللعبة. بقيت مسارات `/manus-storage/` في المصدر كما تعمل في مشروع Manus؛ عند نقل المشروع إلى استضافة مستقلة، استبدل كل مسار بالملف المحلي المقابل أدناه أو ارفعه إلى خدمة الملفات التي تختارها.

| المسار المستدعى في المصدر | النسخة المحلية في الأرشيف |
|---|---|
| `/manus-storage/rescue-network-expanded-map-port-school-road_3b8a5bf1.webp` | `game-assets/rescue-network-expanded-map-port-school-road.webp` |
| `/manus-storage/rescue-ambulance-premium_5a2a0c48.png` | `game-assets/rescue-ambulance-premium.png` |
| `/manus-storage/rescue-ambulance-field-real_765495ba.ogg` | `game-assets/rescue-ambulance-field-real.ogg` |
| `/manus-storage/rescue-evacuation-tunnel_41ac4062.png` | `game-assets/rescue-evacuation-tunnel.png` |
| `/manus-storage/harbor-target-sprite_4ed2944c.png` | `game-assets/harbor-target-sprite.png` |
| `/manus-storage/medical-target-sprite_ba5114ad.png` | `game-assets/medical-target-sprite.png` |
| `/manus-storage/school-target-sprite_8c3a4305.png` | `game-assets/school-target-sprite.png` |
| `/manus-storage/rescue-radio-premium_dcd7d237.png` | `game-assets/rescue-radio-premium.png` |
| `/manus-storage/rescue-residential-premium_561e2840.png` | `game-assets/rescue-residential-premium.png` |
| `/manus-storage/rescue-lightning-calinou-alpha_1f6ef807.webp` | `game-assets/rescue-lightning-calinou-alpha.webp` |
| `/manus-storage/rescue-storm-real_fe340184.ogg` | `game-assets/rescue-storm-real.ogg` |
| `/manus-storage/rescue-thunder-cc0_58ee3e10.ogg` | `game-assets/rescue-thunder-cc0.ogg` |

## الملفات الأساسية التي يجب أن تبقى معًا

* `client/src/pages/Home.tsx` — شاشة اللعبة والخريطة والواجهة والحركة المرئية.
* `client/src/game/engine.ts` — المحاكاة، السكان، الكوارث، والطرق.
* `client/src/game/audio.ts` — تشغيل صوت العاصفة والرعد والإسعاف.
* `client/src/game/engine.test.ts` و`scripts/qa-*.mjs` — اختبارات المنطق والهاتف والتفاعل.
* `ROAD_GRAPH_DESIGN_AR.md` و`VISUAL_QA.md` — عقد الطرق وأدلة الفحص.
