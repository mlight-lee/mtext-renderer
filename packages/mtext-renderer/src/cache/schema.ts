import type { DBSchema } from 'idb'

import { FontData } from '../font/font'

/**
 * Store name constant
 */
export const DB_STORES = {
  fonts: 'fonts'
} as const

/**
 * Database schema interface for the font cache
 */
export interface DbFontCacheSchema extends DBSchema {
  [DB_STORES.fonts]: {
    key: string
    value: FontData
  }
}

/**
 * Database schema versions
 */
export const dbSchema = [
  {
    version: 1,
    stores: [
      {
        name: DB_STORES.fonts,
        keyPath: 'name'
      }
    ]
  }
]
