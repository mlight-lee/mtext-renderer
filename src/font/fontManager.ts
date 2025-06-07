import * as THREE from 'three';

import { BaseFont } from './baseFont';
import { BaseTextShape } from './baseTextShape';
import { FontCacheManager } from '../cache';
import { EventManager, getFileName, getFileNameWithoutExtension } from '../common';
import { FontData } from './font';
import { FontFactory } from './fontFactory';
import { FontLoadStatus } from './fontLoader';

/**
 * Font mappings.
 * - The key is the original font name
 * - The value is the mapped font name
 */
export type FontMapping = Record<string, string>;

export interface FontManagerEventArgs {
  /**
   * Name of font which can't be found
   */
  fontName: string;
  /**
   * The number of characters which use this font. This is only used when the font is not found.
   */
  count?: number;
}

export class FontManager {
  private static _instance: FontManager;
  private loader: THREE.FileLoader;
  protected fontMapping: FontMapping = {};
  protected fontMap: Map<string, BaseFont> = new Map();
  protected fileNames: string[];
  public unsupportedChars: Record<string, number> = {};
  public missedFonts: Record<string, number> = {};
  public enableFontCache = false;
  /**
   * Default font. If the specified font can't be found, the default font will be used
   * when rendering texts.
   */
  public defaultFont = 'simsun';

  public readonly events = {
    fontNotFound: new EventManager<FontManagerEventArgs>(),
    fontLoaded: new EventManager<FontManagerEventArgs>(),
  };

  private constructor() {
    this.loader = new THREE.FileLoader();
    this.loader.setResponseType('arraybuffer');
    this.fileNames = [];
  }

  public static get instance(): FontManager {
    if (!FontManager._instance) {
      FontManager._instance = new FontManager();
    }
    return FontManager._instance;
  }

  /**
   * Set font mapping
   * @param Input font mapping to set
   */
  setFontMapping(mapping: FontMapping) {
    this.fontMapping = mapping;
  }

  /**
   * Load the specified fonts
   * @param urls Input urls of font files to load. The order represents the priority
   * @returns Return the load status of fonts
   */
  async loadFonts(urls: string | string[]) {
    urls = Array.isArray(urls) ? urls : [urls];
    const promises: Promise<void>[] = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      promises.push(this.loadFont(url));
    }

    const status: FontLoadStatus[] = [];
    await Promise.allSettled(promises).then((results) => {
      results.forEach((result, index) => {
        const isSuccess = result.status === 'fulfilled';
        const url = urls[index];
        const fontName = getFileNameWithoutExtension(url.toLowerCase());
        status.push({
          fontName: fontName,
          url: url,
          status: isSuccess,
        });
        if (isSuccess) {
          this.fileNames.push(fontName);
        }
      });
    });
    return status;
  }

  /**
   * Try to find the specified font. If not found, use one new font to replace it and return its name.
   * @param fontName Input font name to find
   * @returns Return 'fontName' if found this font. Return replacement font name if not found.
   */
  findAndReplaceFont(fontName: string) {
    let font = this.fontMap.get(fontName.toLowerCase());
    if (font == null) {
      const mappedFontName = this.fontMapping[fontName];
      if (mappedFontName) {
        font = this.fontMap.get(mappedFontName.toLowerCase());
        return mappedFontName;
      }
    }
    return font ? fontName : this.defaultFont;
  }

  /**
   * Get text shape of the specified character with the specified font type and font size
   */
  public getCharShape(char: string, fontName: string, size: number): BaseTextShape | undefined {
    if (this.fontMap.size === 0) {
      return;
    }
    if (fontName == null) {
      fontName = ''; // take null/undefined as empty
    }
    let currentFont = this.fontMap.get(fontName.toLowerCase());
    if (!currentFont) {
      this.recordMissedFonts(fontName);
      // Try all fonts until we find one that can render the character
      for (const [, font] of this.fontMap) {
        const s = font.getCharShape(char, size);
        if (s) {
          currentFont = font;
          break;
        }
      }
    }
    return currentFont?.getCharShape(char, size);
  }

  getFontScaleFactor(fontName: string) {
    const font = this.fontMap.get(fontName.toLowerCase());
    return font ? font.getScaleFactor() : 1;
  }

  getNotFoundTextShape(size: number) {
    for (const [, font] of this.fontMap) {
      const s = font.getNotFoundTextShape(size);
      if (s) return s;
    }
    return;
  }

  private recordMissedFonts(fontName: string) {
    if (fontName) {
      if (!this.missedFonts[fontName]) {
        this.missedFonts[fontName] = 0;
      }
      this.missedFonts[fontName]++;
      this.events.fontNotFound.dispatch({
        fontName: fontName,
        count: this.missedFonts[fontName],
      });
    }
  }

  private async loadFont(url: string) {
    const fileName = getFileName(url);
    if (!fileName) {
      throw new Error(`Invalid font url: ${url}`);
    }

    const fontName = getFileNameWithoutExtension(url).toLowerCase();
    const data = await FontCacheManager.instance.get(fontName);

    if (data) {
      const font = FontFactory.instance.createFont(data);
      this.fontMap.set(fontName, font);
    } else {
      const buffer = (await this.loader.loadAsync(url)) as ArrayBuffer;
      const font = FontFactory.instance.createFontFromBuffer(fileName, buffer);
      if (font) {
        this.fontMap.set(fontName, font);
        if (this.enableFontCache) {
          await FontCacheManager.instance.set(fontName, font.data as FontData);
        }
      }
    }

    this.events.fontLoaded.dispatch({
      fontName: fontName,
    });
  }

  async getAllFontsFromCache() {
    if (this.fontMap.size !== 0) {
      return;
    }
    const fontFileDatas = await FontCacheManager.instance.getAll();
    for (const fontFileData of fontFileDatas) {
      const { fileName } = fontFileData;
      if (this.fileNames && !this.fileNames.includes(fileName)) {
        continue;
      }
      const font = FontFactory.instance.createFont(fontFileData);
      this.fontMap.set(fileName, font);
    }
  }

  /**
   * Just for log usage
   */
  public getUnsupportedChar() {
    for (const [, font] of this.fontMap) {
      Object.assign(this.unsupportedChars, font.unsupportedChars);
    }
    return this.unsupportedChars;
  }

  release() {
    this.fontMap.clear();
  }
}
