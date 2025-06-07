import { FontManager } from './fontManager';
import { FontInfo, FontLoader } from './fontLoader';

export class DefaultFontLoader implements FontLoader {
  private _avaiableFonts: FontInfo[];

  constructor() {
    this._avaiableFonts = [];
  }

  /**
   * Avaiable fonts to load.
   */
  get avaiableFonts() {
    return this._avaiableFonts;
  }

  /**
   * @inheritdoc
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
   * @inheritdoc
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
