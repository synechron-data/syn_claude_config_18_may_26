# Claude Bulk Delete — Installation Guide & Quick Reference

---

## SECTION 2 — LOCAL INSTALLATION GUIDE

### STEP 1 — Save the Files

Create the following folder and file structure **exactly** as shown:

```
claude-bulk-delete/
├── manifest.json
├── content.js
├── styles.css
└── popup.html
```

**Where to save the folder:**
- ✅ Recommended: `Desktop`, `Documents`, or a dedicated `Extensions` folder
- ✅ Any location that is **permanent** and won't be moved or renamed
- ❌ **Do NOT save inside `Downloads`** — Chrome loses access to the extension if the folder is moved, renamed, or cleaned up (many systems auto-clear Downloads)

> **Important:** After Chrome loads an unpacked extension, the folder **must stay in the same location forever**. If you move or rename the folder, Chrome will show the extension as broken and you'll need to reload it.

---

### STEP 2 — Load in Chrome

1. Open a new Chrome tab and type in the address bar:
   ```
   chrome://extensions/
   ```
   Press **Enter**.

2. In the top-right corner, toggle **Developer mode** to **ON** (the switch turns blue).

3. Click the **"Load unpacked"** button that appears in the top-left.

4. In the file picker dialog, navigate to your `claude-bulk-delete` folder and click **Select Folder** (Windows) or **Open** (Mac).

5. The extension card **"Claude Bulk Delete"** should appear in the list.
   - ✅ No error badge = installed correctly
   - ❌ Red error badge = check the Troubleshooting section below

---

### STEP 3 — Pin the Extension

1. Click the **🧩 puzzle piece icon** in the Chrome toolbar (top-right, next to the address bar).
2. Find **"Claude Bulk Delete"** in the dropdown list.
3. Click the **📌 pin icon** to its right.

The extension icon (☑) will now appear permanently in your Chrome toolbar for quick access.

---

### STEP 4 — Use It

1. Navigate to **[claude.ai](https://claude.ai)** in Chrome.
2. Look for the **☑ Bulk Select** button fixed to the **bottom-right** of the page.
3. Click **☑ Bulk Select** to enter selection mode:
   - Checkboxes appear to the left of every conversation in the sidebar
   - A toolbar appears above the button showing selection count
4. Click conversations (or their checkboxes) to select them.
   - Use **✓ All** to select everything visible in the sidebar
   - Use **✕ Clear** to deselect all
5. Click **🗑 Delete N** → read the confirmation dialog → click **OK**.
6. Watch the progress counter: `Deleting… X/N`
7. A toast notification confirms success. The page navigates to `/` automatically after 3 seconds.

---

### STEP 5 — Update the Extension (When Code Changes)

1. Replace the modified file(s) inside the `claude-bulk-delete` folder.
2. Go to `chrome://extensions/`.
3. Find the **Claude Bulk Delete** card and click the **↺ refresh icon** (circular arrow).
4. Reload the claude.ai tab — the new code is now active.

---

### TROUBLESHOOTING

| Symptom | Cause & Fix |
|---|---|
| **"Bulk Select" button doesn't appear** | Reload the claude.ai tab (`Ctrl+R` / `Cmd+R`). If still missing, go to `chrome://extensions/` and check for a red error badge on the extension card. Click "Errors" to see details. |
| **Checkboxes don't show up after clicking Bulk Select** | Claude.ai may have updated their DOM structure. Open DevTools (`F12`) → Console tab → look for `[CBD]` log messages. If you see errors, the `a[href^="/chat/"]` selector or the row-walker may need updating. |
| **Deletes show as done but conversations reappear on reload** | The `location.href = '/'` navigation may be firing before all server propagations complete. Open `content.js` and change `3000` to `5000` in the `setTimeout` at the bottom of `runDelete()`. Reload the extension and try again. |
| **"Could not fetch org info" toast appears** | The `/api/organizations` endpoint returned an error. Make sure you're logged into claude.ai and your session cookie is valid. Try logging out and back in. |
| **Extension disappeared after Chrome restart** | The `claude-bulk-delete` folder was moved, renamed, or deleted. Go to `chrome://extensions/`, click **"Load unpacked"** again, and select the folder from its new location. |
| **Extension shows a red error badge** | Click **"Errors"** on the extension card. Common cause: a syntax error introduced during manual editing of `content.js`. Fix the syntax and click the refresh ↺ icon. |
| **Checkboxes appear doubled** | The MutationObserver fired twice and both guards failed. Check that `link.dataset.cbdDone` is being set correctly and that `.cbd-check-col` class name hasn't changed in `content.js`. |

---

## SECTION 3 — QUICK REFERENCE CARD

| Action | How |
|---|---|
| **Open extension management** | Type `chrome://extensions/` in the address bar → Enter |
| **Enable extension** | On the extension card at `chrome://extensions/`, toggle the blue switch to ON |
| **Disable extension (without uninstalling)** | On the extension card, toggle the blue switch to OFF — the extension is paused but not removed |
| **Update after code change** | Replace file(s) in the folder → `chrome://extensions/` → click ↺ refresh icon on the card → reload claude.ai tab |
| **Check for errors** | `chrome://extensions/` → look for red error badge → click **"Errors"** button on the card |
| **View console logs** | On claude.ai → `F12` (DevTools) → Console tab → filter by `[CBD]` |
| **Uninstall completely** | `chrome://extensions/` → click **"Remove"** on the extension card → confirm |
| **Where extension files must stay** | In the same `claude-bulk-delete/` folder Chrome loaded from — never move or rename it |
| **Re-pin after Chrome update** | Click 🧩 puzzle piece → find Claude Bulk Delete → click 📌 pin |
| **If Claude updates their DOM** | Open DevTools on claude.ai → Console → look for `[CBD] warn` lines. Update the selector `a[href^="/chat/"]` or the `getRowWrapper()` logic in `content.js` to match the new structure, then reload the extension |
| **Increase delete-wait time** | In `content.js`, find `setTimeout(() => { location.href = '/'; }, 3000)` → change `3000` to `5000` → reload extension |
| **Increase throttle between deletes** | In `content.js`, find `setTimeout(r, 400)` inside `runDelete()` → increase `400` to e.g. `600` → reload extension |
