export interface GalleySettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  pageWidth: number;
  theme: "warm" | "cool" | "sepia" | "dark";
  showWordCount: boolean;
  showTableOfContents: boolean;
}

export const DEFAULT_SETTINGS: GalleySettings = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 18,
  lineHeight: 1.8,
  pageWidth: 640,
  theme: "warm",
  showWordCount: true,
  showTableOfContents: true,
};
