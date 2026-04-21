# Galley

**Beautiful, book-like manuscript reading for Obsidian.**

See your writing as it deserves to be read. Galley transforms your markdown into a paginated, typeset-quality reading experience — right inside Obsidian.

![Galley Screenshot](https://raw.githubusercontent.com/etdebruin/obsidian-galley/main/screenshot.png)

## Features

- **Book-like typography** — serif fonts, justified text, drop caps, scene break ornaments, running chapter headers
- **4 reading themes** — Warm Ivory, Cool White, Sepia, Midnight
- **Auto-generated table of contents** — smooth-scroll chapter navigation
- **Word count** — displayed on the title page
- **Live updates** — re-renders as you edit in another pane
- **Obsidian-native rendering** — embeds, callouts, and other plugins work inside Galley
- **Fully configurable** — font family, font size, line height, page width

## Usage

1. Open a markdown file
2. Run **"Open Galley view"** from the command palette (`Cmd/Ctrl+P`)
3. Or click the **book icon** in the left ribbon

Galley opens a reading pane that tracks your active file. Write in one pane, read in the other.

## Settings

- **Theme** — Warm Ivory, Cool White, Sepia, Midnight
- **Font family** — any CSS font stack
- **Font size** — 14px to 28px
- **Line height** — 1.2 to 2.4
- **Page width** — 480px to 900px
- **Show word count** — toggle
- **Show table of contents** — toggle

## Installation

### From Obsidian Community Plugins

1. Open Settings > Community Plugins
2. Search for "Galley"
3. Install and enable

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/etdebruin/obsidian-galley/releases/latest)
2. Create a folder `galley` in your vault's `.obsidian/plugins/` directory
3. Copy the three files into it
4. Enable "Galley" in Settings > Community Plugins

## Development

```bash
npm install
npm run dev      # watch mode
npm run build    # production build
npm test         # run tests
```

## License

MIT
