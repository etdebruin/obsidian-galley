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
      id: "open-view",
      name: "Open reading view",
      callback: () => {
        void this.activateView();
      },
    });

    this.addCommand({
      id: "read-current-note",
      name: "Read current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.activateView();
        return true;
      },
    });

    this.addSettingTab(new GalleySettingTab(this.app, this));

    this.addRibbonIcon("book-open", "Open reading view", () => {
      void this.activateView();
    });
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(GALLEY_VIEW_TYPE)[0];

    if (!leaf) {
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

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
