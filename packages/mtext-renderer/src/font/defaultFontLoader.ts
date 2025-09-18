import { FontInfo, FontLoader, FontLoadStatus } from './fontLoader'
import { FontManager } from './fontManager'

/**
 * Default implementation of the FontLoader interface.
 * This class provides font loading functionality using a [CDN-based font repository](https://cdn.jsdelivr.net/gh/mlight-lee/cad-data/fonts/).
 * It loads font metadata from a JSON file and provides access to available fonts.
 */
export class DefaultFontLoader implements FontLoader {
  /** List of available fonts in the system */
  private _avaiableFonts: FontInfo[]

  /**
   * Creates a new instance of DefaultFontLoader
   */
  constructor() {
    this._avaiableFonts = []
  }

  /**
   * Gets the list of available fonts
   * @returns Array of FontInfo objects describing available fonts
   */
  get avaiableFonts() {
    return this._avaiableFonts
  }

  /**
   * Retrieves information about all available fonts in the system.
   * Loads font metadata from a CDN if not already loaded.
   * @returns Promise that resolves to an array of FontInfo objects
   * @throws {Error} If font metadata cannot be loaded from the CDN
   */
  async getAvaiableFonts() {
    if (this._avaiableFonts.length == 0) {
      const baseUrl = 'https://cdn.jsdelivr.net/gh/mlight-lee/cad-data/fonts/'
      const fontMetaDataUrl = baseUrl + 'fonts.json'
      try {
        const response = await fetch(fontMetaDataUrl)
        this._avaiableFonts = (await response.json()) as FontInfo[]
      } catch {
        throw new Error(`Filed to get avaiable font from '${fontMetaDataUrl}'`)
      }

      this._avaiableFonts.forEach(font => {
        font.url = baseUrl + font.file
      })
    }
    return this._avaiableFonts
  }

  /**
   * Loads the specified fonts into the system. If one font is already loaded,
   * the font will not be loaded again. If no font names are provided, just loads
   * all available fonts information (not fonts).
   * @param fontNames - Array of font names to load
   * @returns Promise that resolves to an array of FontLoadStatus objects
   */
  async load(fontNames: string[]) {
    if (fontNames.length == 0) {
      await this.getAvaiableFonts()
      return []
    }

    const urls: string[] = []
    const alreadyLoadedStatuses: FontLoadStatus[] = []
    const fontNameToUrl: Record<string, string> = {}

    // Build a map for quick lookup
    this._avaiableFonts.forEach(font => {
      font.name.forEach(name => {
        fontNameToUrl[name.toLowerCase()] = font.url
      })
    })

    fontNames.forEach(font => {
      const lowerCaseFontName = font.toLowerCase()
      const url = fontNameToUrl[lowerCaseFontName]
      if (url) {
        if (FontManager.instance.isFontLoaded(lowerCaseFontName)) {
          alreadyLoadedStatuses.push({
            fontName: lowerCaseFontName,
            url,
            status: true
          })
        } else {
          urls.push(url)
        }
      }
    })

    let newlyLoadedStatuses: FontLoadStatus[] = []
    if (urls.length > 0) {
      newlyLoadedStatuses = await FontManager.instance.loadFontsByUrls(urls)
    }

    // Merge and return statuses for all requested fonts, preserving order
    const statusMap: Record<string, FontLoadStatus> = {}
    ;[...alreadyLoadedStatuses, ...newlyLoadedStatuses].forEach(s => {
      statusMap[s.fontName] = s
    })
    return fontNames.map(font => {
      const lowerCaseFontName = font.toLowerCase()
      return (
        statusMap[lowerCaseFontName] || {
          fontName: lowerCaseFontName,
          url: fontNameToUrl[lowerCaseFontName] || '',
          status: false
        }
      )
    })
  }
}
