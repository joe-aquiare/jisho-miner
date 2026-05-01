# jisho-miner

A Chromium browser extension that adds a **Mine** button to every word entry on
[Jisho.org](https://jisho.org), letting you send cards directly to an
[Anki](https://apps.ankiweb.net/) deck via
[AnkiConnect](https://ankiweb.net/shared/info/2055492159).

## Requirements

- Chromium-based browser (Chrome, Edge, Brave, …)
- [Anki](https://apps.ankiweb.net/) desktop app running
- [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on installed in Anki

## Loading the extension (development)

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this directory

## Configuration

Click the extension icon in the toolbar to open the settings popup and set:

| Field | Default | Description |
|---|---|---|
| Deck name | `Mining` | Anki deck to add cards to |
| Note type | `Basic` | Anki note model to use |
| Front field | `Front` | Field for the word + reading |
| Back field | `Back` | Field for the English definition |

## Project structure

```
jisho-miner/
├── manifest.json          # Extension manifest (MV3)
├── icons/                 # 16/48/128 px PNG icons (add your own)
└── src/
    ├── content.js         # Injected into jisho.org — adds Mine buttons
    ├── content.css        # Styles for injected UI
    ├── service-worker.js  # Background worker — talks to AnkiConnect
    └── popup/
        ├── popup.html     # Settings popup
        ├── popup.js
        └── popup.css
```
