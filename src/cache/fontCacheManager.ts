import { openDB, type IDBPDatabase } from 'idb';
import { FontData } from '../font';
import { DbFontCacheSchema, DB_STORES, dbSchema } from './schema';

/**
 * A simple font cache interface that provides map-like operations for font data
 */
export class FontCacheManager {
  private static readonly DATABASE_NAME = 'mlightcad';
  private static readonly DATABASE_VERSION = dbSchema[dbSchema.length - 1].version;
  private static _instance: FontCacheManager | undefined;
  private db: IDBPDatabase<DbFontCacheSchema> | undefined;
  private isClosing: boolean = false;

  private constructor() {
    // Add window unload handler to close database
    if (typeof window !== 'undefined') {
      window.addEventListener('unload', () => {
        this.close();
      });
    }
  }

  /**
   * Returns the singleton instance of the FontCacheManager
   */
  public static get instance(): FontCacheManager {
    if (!FontCacheManager._instance) {
      FontCacheManager._instance = new FontCacheManager();
    }
    return FontCacheManager._instance;
  }

  /**
   * Sets a font in the cache
   * @param fileName The font file name (key)
   * @param fontData The font data to store
   */
  public async set(fileName: string, fontData: FontData): Promise<void> {
    const db = await this.getDatabase();
    await db.put(DB_STORES.fonts, { ...fontData, name: fileName });
  }

  /**
   * Gets a font from the cache
   * @param fileName The font file name (key)
   * @returns The font data if found, undefined otherwise
   */
  public async get(fileName: string): Promise<FontData | undefined> {
    const db = await this.getDatabase();
    return await db.get(DB_STORES.fonts, fileName);
  }

  /**
   * Deletes a font from the cache
   * @param fileName The font file name (key)
   */
  public async delete(fileName: string): Promise<void> {
    const db = await this.getDatabase();
    await db.delete(DB_STORES.fonts, fileName);
  }

  /**
   * Gets all fonts from the cache
   * @returns An array of all font data in the cache
   */
  public async getAll(): Promise<FontData[]> {
    const db = await this.getDatabase();
    return await db.getAll(DB_STORES.fonts);
  }

  /**
   * Clears all fonts from the cache
   */
  public async clear(): Promise<void> {
    const db = await this.getDatabase();
    await db.clear(DB_STORES.fonts);
  }

  /**
   * Checks if a font exists in the cache
   * @param fileName The font file name (key)
   */
  public async has(fileName: string): Promise<boolean> {
    const font = await this.get(fileName);
    return font !== undefined;
  }

  /**
   * Closes the database connection and cleans up resources.
   * After calling this, any further operations will require reopening the database.
   */
  public close(): void {
    if (this.isClosing) return;
    this.isClosing = true;

    try {
      if (this.db) {
        this.db.close();
        this.db = undefined;
      }
    } finally {
      this.isClosing = false;
    }
  }

  /**
   * Destroys the database instance and deletes all data.
   * Use with caution as this operation cannot be undone.
   */
  public async destroy(): Promise<void> {
    this.close();
    await indexedDB.deleteDatabase(FontCacheManager.DATABASE_NAME);
    FontCacheManager._instance = undefined;
  }

  // Private methods for database management
  private async getDatabase(): Promise<IDBPDatabase<DbFontCacheSchema>> {
    if (this.isClosing) {
      throw new Error('Cannot perform operation while database is closing');
    }

    if (this.db) {
      return this.db;
    }

    this.db = await openDB<DbFontCacheSchema>(
      FontCacheManager.DATABASE_NAME,
      FontCacheManager.DATABASE_VERSION,
      {
        upgrade: (db, oldVersion, newVersion) => this.handleUpgrade(db, oldVersion, newVersion),
        blocked() {
          console.warn('Database upgrade blocked - please close other tabs using the application');
        },
        blocking() {
          console.warn('Database blocking newer version - closing connection');
          FontCacheManager.instance.close();
        },
      }
    );

    return this.db;
  }

  /**
   * Applies all schema versions that are greater than the old version and less than or equal to the new version
   * @param db The database instance
   * @param oldVersion The old version of the database
   * @param newVersion The new version of the database
   */
  private handleUpgrade(
    db: IDBPDatabase<DbFontCacheSchema>,
    oldVersion: number,
    newVersion: number | null
  ): void {
    const upgrades = dbSchema.filter(
      (schema) => schema.version > oldVersion && (!newVersion || schema.version <= newVersion)
    );

    for (const upgrade of upgrades) {
      this.applySchemaVersion(db, upgrade);
    }
  }

  /**
   * Applies a single schema version's changes to the database
   * @param db The database instance
   * @param schema The schema version to apply
   */
  private applySchemaVersion(
    db: IDBPDatabase<DbFontCacheSchema>,
    schema: (typeof dbSchema)[0]
  ): void {
    for (const store of schema.stores) {
      if (!db.objectStoreNames.contains(store.name)) {
        db.createObjectStore(store.name, { keyPath: store.keyPath });
      }
    }
  }
}
