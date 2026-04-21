import { App, PluginSettingTab, Setting } from "obsidian";
import type GalleyPlugin from "./main";

export class GalleySettingTab extends PluginSettingTab {
  plugin: GalleyPlugin;

  constructor(app: App, plugin: GalleyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Theme")
      .setDesc("Choose the reading ambiance")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("warm", "Warm Ivory")
          .addOption("cool", "Cool White")
          .addOption("sepia", "Sepia")
          .addOption("dark", "Midnight")
          .setValue(this.plugin.settings.theme)
          .onChange(async (value) => {
            this.plugin.settings.theme = value as "warm" | "cool" | "sepia" | "dark";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Font family")
      .setDesc("CSS font-family for the manuscript text")
      .addText((text) =>
        text
          .setPlaceholder("Georgia, serif")
          .setValue(this.plugin.settings.fontFamily)
          .onChange(async (value) => {
            this.plugin.settings.fontFamily = value || "Georgia, 'Times New Roman', serif";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Font size")
      .setDesc("Base font size in pixels")
      .addSlider((slider) =>
        slider
          .setLimits(14, 28, 1)
          .setValue(this.plugin.settings.fontSize)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.fontSize = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Line height")
      .setDesc("Line spacing multiplier")
      .addSlider((slider) =>
        slider
          .setLimits(1.2, 2.4, 0.1)
          .setValue(this.plugin.settings.lineHeight)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.lineHeight = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Page width")
      .setDesc("Maximum width of the text column in pixels")
      .addSlider((slider) =>
        slider
          .setLimits(480, 900, 10)
          .setValue(this.plugin.settings.pageWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.pageWidth = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show word count")
      .setDesc("Display word count below the title")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showWordCount).onChange(async (value) => {
          this.plugin.settings.showWordCount = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Show table of contents")
      .setDesc("Display chapter navigation at the top")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showTableOfContents)
          .onChange(async (value) => {
            this.plugin.settings.showTableOfContents = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
