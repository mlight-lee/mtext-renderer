import * as THREE from 'three';

import { FontCacheManager } from '../cache';
import { EventManager, getFileName, getFileNameWithoutExtension } from '../common';
import { BaseFont } from './baseFont';
import { BaseTextShape } from './baseTextShape';
import { FontType } from './font';
import { FontFactory } from './fontFactory';
import { FontLoadStatus } from './fontLoader';

/**
 * Font mappings configuration.
 * Maps original font names to their replacement font names.
 * - The key is the original font name
 * - The value is the mapped font name
 */
export type FontMapping = Record<string, string>;

/**
 * Event arguments for font-related events.
 */
export interface FontManagerEventArgs {
  /** Name of font which can't be found */
  fontName: string;
  /** The number of characters which use this font. This is only used when the font is not found. */
  count?: number;
}

/**
 * Manages font loading, caching, and text rendering.
 * This class is responsible for:
 * - Loading fonts from URLs or cache
 * - Managing font mappings and replacements
 * - Providing text shapes for rendering
 * - Tracking unsupported characters and missed fonts
 */
export class FontManager {
  private static _instance: FontManager;
  /** THREE.js file loader for loading font files */
  private loader: THREE.FileLoader;
  /** Mapping of original font names to their replacements */
  protected fontMapping: FontMapping = {};
  /** Map of loaded fonts, keyed by font name */
  protected fontMap: Map<string, BaseFont> = new Map();
  /** List of font file names that have been loaded */
  protected fileNames: string[];
  /** Record of characters that are not supported by any loaded font */
  public unsupportedChars: Record<string, number> = {};
  /** Record of fonts that were requested but not found */
  public missedFonts: Record<string, number> = {};
  /** Flag to enable/disable font caching */
  public enableFontCache = true;
  /** Default font to use when a requested font is not found */
  public defaultFont = 'simsun';

  /** Event managers for font-related events */
  public readonly events = {
    /** Event triggered when a font cannot be found */
    fontNotFound: new EventManager<FontManagerEventArgs>(),
    /** Event triggered when a font is successfully loaded */
    fontLoaded: new EventManager<FontManagerEventArgs>(),
  };

  private constructor() {
    this.loader = new THREE.FileLoader();
    this.loader.setResponseType('arraybuffer');
    this.fileNames = [];
  }

  /**
   * Gets the singleton instance of the FontManager
   * @returns The FontManager instance
   */
  public static get instance(): FontManager {
    if (!FontManager._instance) {
      FontManager._instance = new FontManager();
    }
    return FontManager._instance;
  }

  /**
   * Sets the font mapping configuration
   * @param mapping - The font mapping to set
   */
  setFontMapping(mapping: FontMapping) {
    this.fontMapping = mapping;
  }

  /**
   * Loads the specified fonts from URLs
   * @param urls - URLs of font files to load. The order represents the priority
   * @returns Promise that resolves to an array of font load statuses
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
   * Tries to find the specified font. If not found, uses a replacement font and returns its name.
   * @param fontName - The font name to find
   * @returns The original font name if found, or the replacement font name if not found
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
   * Gets font by font name. Return undefined if not found.
   * @param fontName - The font name to find
   * @param recordMissedFonts - Record the font name to property `missedFonts` in this class
   * if the specified font name not found.
   * @returns The font with the specified font name, or undefined if not found
   */
  public getFontByName(fontName: string, recordMissedFonts: boolean = true): BaseFont | undefined {
    if (this.fontMap.size === 0) {
      return;
    }
    if (fontName == null) {
      fontName = ''; // take null/undefined as empty
    }
    const currentFont = this.fontMap.get(fontName.toLowerCase());
    if (!currentFont) {
      if (recordMissedFonts) {
        this.recordMissedFonts(fontName);
      }
      return undefined;
    }
    return currentFont;
  }

  /**
   * Gets the first font which contains the specified character.
   * @param char - The character to get the shape for
   * @param fontName - The name of the font to use
   * @param size - The size of the character
   * @returns The text shape for the character, or undefined if not found
   */
  public getFontByChar(char: string): BaseFont | undefined {
    // Try all fonts until we find one that can render the character
    for (const [, font] of this.fontMap) {
      if (font.hasChar(char)) {
        return font;
      }
    }
    return undefined;
  }

  /**
   * Gets the text shape for a specific character with the specified font and size
   * @param char - The character to get the shape for
   * @param fontName - The name of the font to use
   * @param size - The size of the character
   * @returns The text shape for the character, or undefined if not found
   */
  public getCharShape(char: string, fontName: string, size: number): BaseTextShape | undefined {
    let currentFont = this.getFontByName(fontName);
    if (!currentFont) {
      currentFont = this.getFontByChar(char);
    }
    return currentFont?.getCharShape(char, size);
  }

  /**
   * Gets the scale factor for a specific font
   * @param fontName - The name of the font
   * @returns The scale factor for the font, or 1 if the font is not found
   */
  getFontScaleFactor(fontName: string) {
    const font = this.fontMap.get(fontName.toLowerCase());
    return font ? font.getScaleFactor() : 1;
  }

  /**
   * Gets type of the specific font
   * @param fontName - The name of the font
   * @returns The type of the font. If the specified font can't be found, `undefined` is returned
   */
  getFontType(fontName: string): FontType | undefined {
    const font = this.fontMap.get(fontName.toLowerCase());
    return font?.type;
  }

  /**
   * Gets the shape to display when a character is not found
   * @param size - The size of the shape
   * @returns The shape for the not found indicator, or undefined if not available
   */
  getNotFoundTextShape(size: number) {
    for (const [, font] of this.fontMap) {
      const s = font.getNotFoundTextShape(size);
      if (s) return s;
    }
    return;
  }

  /**
   * Checks if a font is already loaded in the system
   * @param fontName - The name of the font to check
   * @returns True if the font is loaded, false otherwise
   */
  isFontLoaded(fontName: string): boolean {
    return this.fontMap.has(fontName.toLowerCase());
  }

  /**
   * Records a font that was requested but not found
   * @param fontName - The name of the font that was not found
   */
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

  /**
   * Loads a single font from a URL
   * @param url - The URL of the font file to load
   */
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
          await FontCacheManager.instance.set(fontName, {
            name: fontName,
            type: font.type,
            data: font.data,
          });
        }
      }
    }

    this.events.fontLoaded.dispatch({
      fontName: fontName,
    });
  }

  /**
   * Loads all fonts from the cache
   */
  async getAllFontsFromCache() {
    if (this.fontMap.size !== 0) {
      return;
    }
    const fontFileDatas = await FontCacheManager.instance.getAll();
    for (const fontFileData of fontFileDatas) {
      const { name } = fontFileData;
      if (this.fileNames && !this.fileNames.includes(name)) {
        continue;
      }
      const font = FontFactory.instance.createFont(fontFileData);
      this.fontMap.set(name, font);
    }
  }

  /**
   * Gets a record of all unsupported characters across all loaded fonts
   * @returns A record mapping unsupported characters to their occurrence count
   */
  public getUnsupportedChar() {
    for (const [, font] of this.fontMap) {
      Object.assign(this.unsupportedChars, font.unsupportedChars);
    }
    return this.unsupportedChars;
  }

  /**
   * Releases loaded fonts from memory.
   *
   * - If no argument is provided, all loaded fonts are released and the font map is cleared.
   * - If a font name is provided, only that specific font is released from the font map.
   *
   * This is useful for freeing up memory, especially when working with large font files (e.g., Chinese mesh fonts).
   * Notes: Based on testing, one Chinese mesh font file may take 40M memory.
   *
   * @param fontToRelease - (Optional) The name of the font to release. If omitted, all fonts are released.
   * @returns `true` if the operation succeeded (all fonts released or the specified font was found and deleted), `false` if the specified font was not found.
   */
  release(fontToRelease?: string) {
    if (fontToRelease == null) {
      this.fontMap.clear();
      return true;
    } else {
      return this.fontMap.delete(fontToRelease);
    }
  }
}
