# Vietnamese web interface

Choose **Language → Tiếng Việt** in the top bar. Choose **English** to switch back without reloading or losing edits. The choice is stored on this device; a fresh browser with a Vietnamese language preference starts in Vietnamese. Storage being unavailable does not prevent switching.

The translation covers the main drawing controls, paper tools, game controls, Demo settings, show editor, accessible labels and both built-in guides. Project, sheet and custom formation names, typed text, keyboard shortcuts, file schemas and saved artwork remain unchanged. Some technical errors and content titles remain in their original language. This change applies to the web app; the native Android interface is separate.

The drone designer's existing single-stroke font folds Vietnamese accents to Latin letters (for example, “Hà” becomes “HA”). This release translates the interface; it does not introduce accented drone letter shapes.

## Maintenance

- `web/src/vi.js` holds the Vietnamese catalog and trusted help markup.
- `web/src/i18n.js` translates UI text and selected accessibility attributes. It keeps original text per node to support switching back, and observes only text, child-list and relevant attribute changes. It does not observe geometry, canvas frames or style changes.
- Mark user-authored content with `translate="no"`. Never use translated display text as a model identifier. Select option values and all input values stay unchanged.
- Canvas text and native confirmation prompts use `translate()` explicitly. Canvas text redraws on `languagechange`.
- New technical messages without a translation fall back to English.

Validation: 117 unit tests, production build, and `web/scripts/i18n-smoke.mjs` covering switching, dynamic controls, guides, saved preference, browser-language default, identical show exports across languages, and a 390 px phone viewport. Native Android and physical-device performance were not tested for this change.
