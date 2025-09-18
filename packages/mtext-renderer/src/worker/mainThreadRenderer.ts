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

  constructor() {
    this.fontManager = FontManager.instance
    this.styleManager = new StyleManager()

    // Set default font
    this.fontManager.defaultFont = 'simkai'
  }

  /**
   * Render MText directly in the main thread
   */
  async renderMText(
    mtextContent: MTextData,
    textStyle: TextStyle,
    colorSettings: ColorSettings = {
      byLayerColor: 0xffffff,
      byBlockColor: 0xffffff
    }
  ): Promise<MTextObject> {
    const mtext = new MText(
      mtextContent,
      textStyle,
      this.styleManager,
      this.fontManager,
      colorSettings
    )
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
}
