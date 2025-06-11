import { FontManager } from './fontManager';
import { FontInfo, FontLoader } from './fontLoader';

/**
 * Default implementation of the FontLoader interface.
 * This class provides font loading functionality using a CDN-based font repository.
 * It loads font metadata from a JSON file and provides access to available fonts.
 */
export class DefaultFontLoader implements FontLoader {
  /** List of available fonts in the system */
  private _avaiableFonts: FontInfo[];

  /**
   * Creates a new instance of DefaultFontLoader
   */
  constructor() {
    this._avaiableFonts = [];
  }

  /**
   * Gets the list of available fonts
   * @returns Array of FontInfo objects describing available fonts
   */
  get avaiableFonts() {
    return this._avaiableFonts;
  }

  /**
   * Retrieves information about all available fonts in the system.
   * Loads font metadata from a CDN if not already loaded.
   * @returns Promise that resolves to an array of FontInfo objects
   * @throws {Error} If font metadata cannot be loaded from the CDN
   */
  async getAvaiableFonts() {
    if (this._avaiableFonts.length == 0) {
      const baseUrl = 'https://cdn.jsdelivr.net/gh/mlight-lee/cad-data/fonts/';
      const fontMetaDataUrl = baseUrl + 'fonts.json';
      try {
        const response = await fetch(fontMetaDataUrl);
        this._avaiableFonts = (await response.json()) as FontInfo[];
      } catch {
        throw new Error(`Filed to get avaiable font from '${fontMetaDataUrl}'`);
      }

      this._avaiableFonts.forEach((font) => {
        font.url = baseUrl + font.file;
      });
    }
    return this._avaiableFonts;
  }

  /**
   * Loads the specified fonts into the system.
   * If no font names are provided, loads all available fonts.
   * @param fontNames - Array of font names to load
   * @returns Promise that resolves to an array of FontLoadStatus objects
   */
  async load(fontNames: string[]) {
    if (fontNames.length == 0) {
      await this.getAvaiableFonts();
    }

    const urls: string[] = [];
    fontNames.forEach((font) => {
      const lowerCaseFontName = font.toLowerCase();
      const result = this._avaiableFonts.find((item: FontInfo) => {
        return (
          item.name.findIndex((name: string) => {
            return name.toLowerCase() === lowerCaseFontName;
          }) >= 0
        );
      });
      if (result) urls.push(result.url);
    });
    return await FontManager.instance.loadFonts(urls);
  }
}
