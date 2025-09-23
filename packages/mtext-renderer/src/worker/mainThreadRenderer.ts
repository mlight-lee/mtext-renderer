import { FontManager } from '../font'
import { MText } from '../renderer/mtext'
import { StyleManager } from '../renderer/styleManager'
import { ColorSettings, MTextData, TextStyle } from '../renderer/types'
import { MTextBaseRenderer, MTextObject } from './baseRenderer'

/**
 * Main thread renderer for MText objects
 * This provides the same interface as the worker but runs in the main thread
 */
export class MainThreadRenderer implements MTextBaseRenderer {
  private fontManager: FontManager
  private styleManager: StyleManager
  private isInitialized: boolean

  constructor() {
    this.fontManager = FontManager.instance
    this.styleManager = new StyleManager()
    this.isInitialized = false
  }

  /**
   * Render MText directly in the main thread asynchronously. It will ensure that default font
   * is loaded. And fonts needed in mtext are loaded on demand.
   */
  async asyncRenderMText(
    mtextContent: MTextData,
    textStyle: TextStyle,
    colorSettings: ColorSettings = {
      byLayerColor: 0xffffff,
      byBlockColor: 0xffffff
    }
  ): Promise<MTextObject> {
    await this.ensureInitialized()
    const mtext = new MText(
      mtextContent,
      textStyle,
      this.styleManager,
      this.fontManager,
      colorSettings
    )
    await mtext.asyncDraw()
    mtext.updateMatrixWorld(true)
    return mtext as MTextObject
  }

  /**
   * Render MText directly in the main thread synchronously. It is user's responsibility to ensure
   * that default font is loaded and fonts needed in mtext are loaded.
   */
  syncRenderMText(
    mtextContent: MTextData,
    textStyle: TextStyle,
    colorSettings: ColorSettings = {
      byLayerColor: 0xffffff,
      byBlockColor: 0xffffff
    }
  ): MTextObject {
    const mtext = new MText(
      mtextContent,
      textStyle,
      this.styleManager,
      this.fontManager,
      colorSettings
    )
    mtext.syncDraw()
    mtext.updateMatrixWorld(true)
    return mtext as MTextObject
  }

  /**
   * Load fonts in the main thread
   */
  async loadFonts(fonts: string[]): Promise<{ loaded: string[] }> {
    await this.fontManager.loadFontsByNames(fonts)
    return { loaded: fonts }
  }

  /**
   * Get available fonts from the main thread
   */
  async getAvailableFonts(): Promise<{ fonts: Array<{ name: string[] }> }> {
    const fonts = await this.fontManager.getAvaiableFonts()
    return { fonts }
  }

  destroy(): void {
    // nothing to cleanup for main thread renderer currently
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      // Guarantee the default font is loaded
      await this.loadFonts([FontManager.instance.defaultFont])
      this.isInitialized = true
    }
  }
}
