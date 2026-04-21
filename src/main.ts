import { Platform, Plugin } from "obsidian";
import { GalleyView, GALLEY_VIEW_TYPE } from "./galley-view";
import { GalleySettingTab } from "./settings-tab";
import { GalleySettings, DEFAULT_SETTINGS } from "./settings";

export default class GalleyPlugin extends Plugin {
  settings: GalleySettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(GALLEY_VIEW_TYPE, (leaf) => new GalleyView(leaf, this));

    this.addCommand({
      id: "open-galley-view",
      name: "Open Galley view",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "open-galley-view-current",
      name: "Read current note in Galley",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) this.activateView();
        return true;
      },
    });

    this.addSettingTab(new GalleySettingTab(this.app, this));

    // Add ribbon icon
    this.addRibbonIcon("book-open", "Open Galley", () => {
      this.activateView();
    });
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(GALLEY_VIEW_TYPE)[0];

    if (!leaf) {
      // On mobile, open as a full-screen tab; on desktop, use right sidebar
      const newLeaf = Platform.isMobile
        ? workspace.getLeaf("tab")
        : workspace.getRightLeaf(false);
      if (newLeaf) {
        leaf = newLeaf;
        await leaf.setViewState({ type: GALLEY_VIEW_TYPE, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(GALLEY_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
