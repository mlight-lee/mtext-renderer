# MText Renderer for Three.js

A flexible and extensible AutoCAD MText renderer implementation using Three.js. This package provides a modular architecture to render AutoCAD MText content with different rendering engines, with a primary focus on Three.js rendering.

## Features

- Render AutoCAD MText content using Three.js
- Modular font loading system
- Font management and dynamic font loading
- Cache parsed fonts to improve rendering performance

## Core Components

### FontManager

The central manager for font operations. It's a singleton class that handles font loading, caching, and text rendering.

**Public Properties:**
- `unsupportedChars`: Record of characters not supported by any loaded font
- `missedFonts`: Record of fonts that were requested but not found
- `enableFontCache`: Flag to enable/disable font caching. If it is true, parsed fonts 
will be stored in local IndexedDB to improve performance. Default value is true.
- `defaultFont`: Default font to use when a requested font is not found
- `events`: Event managers for font-related events
  - `fontNotFound`: Triggered when a font cannot be found
  - `fontLoaded`: Triggered when a font is successfully loaded

**Public Methods:**
- `getAvaiableFonts()`: Retrieve metadata of available fonts from the configured loader
- `loadFontsByNames(names)`: Loads fonts by logical names (e.g., 'simsun', 'arial')
- `getCharShape(char, fontName, size)`: Gets text shape for a character
- `getFontScaleFactor(fontName)`: Gets scale factor for a font
- `getNotFoundTextShape(size)`: Gets shape for not found indicator
- `getUnsupportedChar()`: Gets record of unsupported characters
- `release()`: Releases all loaded fonts

### FontLoader & DefaultFontLoader

Interface for font loading operations. The default implementation [DefaultFontLoader](./src/font/defaultFontLoader.ts) uses a [CDN-based font repository](https://cdn.jsdelivr.net/gh/mlight-lee/cad-data/fonts/). It loads font metadata from a JSON file and provides access to available fonts.

You do NOT need to create `DefaultFontLoader` yourself anymore. `FontManager` manages a loader instance internally. If you want to customize font loading, implement `FontLoader` and set it via `FontManager.instance.setFontLoader(customLoader)`.

**Public Methods:**
- `load(fontNames)`: Loads specified fonts into the system
- `getAvaiableFonts()`: Retrieves information about available fonts

### BaseFont

Abstract base class for font implementations. Provides common functionality for font handling.

**Public Properties:**
- `type`: Type of font ('shx' or 'mesh')
- `data`: Parsed font data
- `unsupportedChars`: Record of unsupported characters

**Public Methods:**
- `getCharShape(char, size)`: Gets shape for a character
- `getScaleFactor()`: Gets font scale factor
- `getNotFoundTextShape(size)`: Gets shape for not found indicator

### BaseTextShape

Abstract base class for text shape implementations. Provides common functionality for text shape handling.

**Public Properties:**
- `char`: Character this shape represents
- `size`: Size of the text shape

**Public Methods:**
- `getWidth()`: Gets width of text shape
- `getHeight()`: Gets height of text shape
- `toGeometry()`: Converts shape to THREE.BufferGeometry

### FontFactory

Singleton factory class for creating font instances. Handles creation of appropriate font objects based on type and data format.

**Public Methods:**
- `createFont(data)`: Creates font from font data
- `createFontFromBuffer(fileName, buffer)`: Creates font from file data

### FontCacheManager
Manages font data caching using IndexedDB. Provides persistent storage for font data.

**Public Methods:**
- `get(fileName)`: Retrieves font data from cache
- `set(fileName, fontData)`: Stores font data in cache
- `getAll()`: Retrieves all cached font data
- `clear()`: Clears all cached font data

## Worker-Based Rendering System

The package provides a sophisticated worker-based rendering system that allows MText rendering to be performed in Web Workers, preventing blocking of the main UI thread. This is particularly beneficial for rendering large amounts of text or complex MText content.

### MTextBaseRenderer Interface

Defines the common rendering contract for producing Three.js objects from MText content. All renderer implementations must conform to this interface.

**Public Methods:**
- `asyncRenderMText(mtextContent, textStyle, colorSettings?)`: Asynchronously render MText into a Three.js object hierarchy
- `syncRenderMText(mtextContent, textStyle, colorSettings?)`: Synchronously render MText (not supported in worker mode)
- `destroy()`: Release any resources owned by the renderer

### MTextObject Interface

Represents a rendered MText object that extends THREE.Object3D with additional MText-specific properties.

**Public Properties:**
- `box`: The bounding box of the MText object in local coordinates

### MainThreadRenderer

Renders MText content directly in the main thread. This is the simplest renderer implementation that provides the same interface as worker-based renderers but runs synchronously in the main thread.

**Public Methods:**
- `asyncRenderMText(mtextContent, textStyle, colorSettings?)`: Render asynchronously in the main thread (loads fonts on demand)
- `syncRenderMText(mtextContent, textStyle, colorSettings?)`: Render synchronously in the main thread (fonts must already be loaded)
- `destroy()`: Cleanup resources

### WebWorkerRenderer (MTextWorkerManager)

Manages communication with MText Web Workers for parallel text rendering. This renderer uses a pool of Web Workers to distribute rendering tasks, improving performance for large text content.

**Public Properties:**
- `poolSize`: Number of workers in the pool (defaults to optimal size based on hardware concurrency)

**Public Methods:**
- `asyncRenderMText(mtextContent, textStyle, colorSettings?)`: Render MText using worker pool asynchronously
- `terminate()`: Terminate all workers
- `destroy()`: Cleanup all resources

**Features:**
- Automatic worker pool management
- Load balancing across workers
- Efficient serialization/deserialization of Three.js objects
- Transferable object support for optimal performance
- Error handling and timeout management

### UnifiedRenderer

A flexible renderer that can switch between main thread and Web Worker rendering modes at runtime. This allows applications to dynamically choose the best rendering strategy based on current conditions.

**Public Properties:**
- `defaultMode`: Default rendering mode ('main' or 'worker') used when no per-call override is provided

**Public Methods:**
- `setDefaultMode(mode)`: Set the default rendering mode
- `getDefaultMode()`: Get the default rendering mode
- `asyncRenderMText(mtextContent, textStyle, colorSettings?, mode?)`: Render asynchronously; pass `mode` to override the default for this call
- `syncRenderMText(mtextContent, textStyle, colorSettings?)`: Render synchronously; always uses the main thread internally
- `destroy()`: Clean up all resources

### MTextWorker

The actual Web Worker implementation that handles MText rendering tasks. This worker contains its own FontManager, StyleManager, and FontLoader instances, allowing it to work independently from the main thread.

**Features:**
- Independent font and style management
- Can preload fonts on demand via a `loadFonts` message to avoid redundant concurrent loads
- Efficient object serialization for transfer to main thread
- Support for transferable objects to minimize memory copying
- Error handling and response management

### MText
Main class for rendering AutoCAD MText content. Extends THREE.Object3D to integrate with Three.js scene graph.

**Public Properties:**
- `fontManager`: Reference to FontManager instance for font operations
- `styleManager`: Reference to StyleManager instance for style operations

**Public Methods:**
- `asyncDraw()`: Asynchronously builds geometry and loads required fonts on demand
- `syncDraw()`: Synchronously builds geometry (assumes required fonts are already loaded)

## Class Diagram

```mermaid
classDiagram
    class MText {
        +content: MTextContent
        +style: MTextStyle
        +fontManager: FontManager
        +styleManager: StyleManager
        +update()
        +setContent(content)
        +setStyle(style)
        +dispose()
    }

    class FontManager {
        -_instance: FontManager
        +unsupportedChars: Record
        +missedFonts: Record
        +enableFontCache: boolean
        +defaultFont: string
        +events: EventManagers
        +loadFonts(urls)
        +getCharShape(char, fontName, size)
        +getFontScaleFactor(fontName)
        +getNotFoundTextShape(size)
        +getUnsupportedChar()
        +release()
    }

    class FontLoader {
        <<interface>>
        +load(fontNames)
        +getAvaiableFonts()
    }

    class DefaultFontLoader {
        -_avaiableFonts: FontInfo[]
        +load(fontNames)
        +getAvaiableFonts()
    }

    class BaseFont {
        <<abstract>>
        +type: FontType
        +data: unknown
        +unsupportedChars: Record
        +getCharShape(char, size)
        +getScaleFactor()
        +getNotFoundTextShape(size)
    }

    class BaseTextShape {
        <<abstract>>
        +char: string
        +size: number
        +getWidth()
        +getHeight()
        +toGeometry()
    }

    class FontFactory {
        -_instance: FontFactory
        +createFont(data)
        +createFontFromBuffer(fileName, buffer)
    }

    class FontCacheManager {
        -_instance: FontCacheManager
        +get(fileName)
        +set(fileName, fontData)
        +getAll()
        +clear()
    }

    class MTextBaseRenderer {
        <<interface>>
        +asyncRenderMText(mtextContent, textStyle, colorSettings?)
        +syncRenderMText(mtextContent, textStyle, colorSettings?)
        +loadFonts(fonts)
        +getAvailableFonts()
        +destroy()
    }

    class MTextObject {
        <<interface>>
        +box: Box3
    }

    class MainThreadRenderer {
        -fontManager: FontManager
        -styleManager: StyleManager
        -fontLoader: DefaultFontLoader
        +asyncRenderMText(mtextContent, textStyle, colorSettings?)
        +syncRenderMText(mtextContent, textStyle, colorSettings?)
        +loadFonts(fonts)
        +getAvailableFonts()
        +destroy()
    }

    class WebWorkerRenderer {
        -workers: Worker[]
        -inFlightPerWorker: number[]
        -pendingRequests: Map
        -poolSize: number
        +asyncRenderMText(mtextContent, textStyle, colorSettings?)
        +loadFonts(fonts)
        +getAvailableFonts()
        +terminate()
        +destroy()
    }

    class UnifiedRenderer {
        -webWorkerRenderer: WebWorkerRenderer
        -mainThreadRenderer: MainThreadRenderer
        -renderer: MTextBaseRenderer
        -defaultMode: RenderMode
        +setDefaultMode(mode)
        +getDefaultMode()
        +asyncRenderMText(mtextContent, textStyle, colorSettings?, mode?)
        +syncRenderMText(mtextContent, textStyle, colorSettings?)
        +loadFonts(fonts)
        +getAvailableFonts()
        +destroy()
    }

    class MTextWorker {
        +fontManager: FontManager
        +styleManager: StyleManager
        +fontLoader: DefaultFontLoader
        +serializeMText(mtext)
        +serializeChildren(mtext)
    }

    MText --> FontManager
    MText --> StyleManager
    FontManager --> FontFactory
    FontManager --> FontCacheManager
    FontManager --> BaseFont
    DefaultFontLoader ..|> FontLoader
    BaseFont <|-- MeshFont
    BaseFont <|-- ShxFont
    BaseTextShape <|-- MeshTextShape
    BaseTextShape <|-- ShxTextShape
    MainThreadRenderer ..|> MTextBaseRenderer
    WebWorkerRenderer ..|> MTextBaseRenderer
    UnifiedRenderer --> WebWorkerRenderer
    UnifiedRenderer --> MainThreadRenderer
    UnifiedRenderer ..|> MTextBaseRenderer
    MTextWorker --> FontManager
    MTextWorker --> StyleManager
    MTextWorker --> DefaultFontLoader
    WebWorkerRenderer --> MTextWorker
    MTextBaseRenderer --> MTextObject
```

## Usage

```typescript
import * as THREE from 'three';
import { FontManager, MText, StyleManager } from '@mlightcad/mtext-renderer';

// Initialize core components
const fontManager = FontManager.instance;
const styleManager = new StyleManager();

// Optionally preload a font (otherwise MText will load on demand in asyncDraw())
await fontManager.loadFontsByNames(['simsun']);

// Create MText content
const mtextContent = {
  text: '{\\fArial|b0|i0|c0|p34;Hello World}',
  height: 0.1,
  width: 0,
  position: new THREE.Vector3(0, 0, 0),
};

// Create MText instance with style
const mtext = new MText(
  mtextContent,
  {
    name: 'Standard',
    standardFlag: 0,
    fixedTextHeight: 0.1,
    widthFactor: 1,
    obliqueAngle: 0,
    textGenerationFlag: 0,
    lastHeight: 0.1,
    font: 'Standard',
    bigFont: '',
    color: 0xffffff,
  },
  styleManager,
  fontManager
);

// Build geometry and load fonts on demand
await mtext.asyncDraw();

// Add to Three.js scene
scene.add(mtext);
```

### Synchronous usage (fonts must be preloaded)

```typescript
// Ensure required fonts are loaded beforehand
await fontManager.loadFontsByNames(['simsun']);

const mtext = new MText(mtextContent, textStyle, styleManager, fontManager);

// Build geometry synchronously (no awaits here)
mtext.syncDraw();
scene.add(mtext);
```

## Worker-Based Rendering Usage

### Using MainThreadRenderer

```typescript
import { MainThreadRenderer } from '@mlightcad/mtext-renderer';

// Create main thread renderer
const renderer = new MainThreadRenderer();

// Render MText content asynchronously (fonts are loaded on demand)
const mtextObject = await renderer.asyncRenderMText(
  mtextContent,
  textStyle,
  { byLayerColor: 0xffffff, byBlockColor: 0xffffff }
);

// Add to scene
scene.add(mtextObject);

// Or render synchronously (fonts must be preloaded)
// await renderer.loadFonts(['simsun']);
const syncObject = renderer.syncRenderMText(
  mtextContent,
  textStyle,
  { byLayerColor: 0xffffff, byBlockColor: 0xffffff }
);
scene.add(syncObject);
```

### Using WebWorkerRenderer

```typescript
import { WebWorkerRenderer } from '@mlightcad/mtext-renderer';

// Create worker renderer with custom pool size
const workerRenderer = new WebWorkerRenderer({ poolSize: 4 }); // 4 workers

// Optionally preload fonts once via a coordinator to avoid duplicate concurrent loads
// await workerRenderer.loadFonts(['simsun', 'arial']);

// Render MText content using workers asynchronously (fonts loaded on demand)
const mtextObject = await workerRenderer.asyncRenderMText(
  mtextContent,
  textStyle,
  { byLayerColor: 0xffffff, byBlockColor: 0xffffff }
);

// Add to scene
scene.add(mtextObject);

// Clean up when done
workerRenderer.destroy();
```

Note: Synchronous rendering is not supported in worker mode.

### Using UnifiedRenderer

```typescript
import { UnifiedRenderer } from '@mlightcad/mtext-renderer';

// Create unified renderer with default mode 'main' (optional worker config as second param)
const unifiedRenderer = new UnifiedRenderer('main');

// Render using default mode (main) asynchronously (fonts loaded on demand)
let mtextObject = await unifiedRenderer.asyncRenderMText(
  mtextContent,
  textStyle,
  { byLayerColor: 0xffffff, byBlockColor: 0xffffff }
);

scene.add(mtextObject);

// Change default mode to worker for subsequent calls
unifiedRenderer.setDefaultMode('worker');

// Or override mode per call without changing the default
// e.g., render this heavy content in worker, regardless of default
mtextObject = await unifiedRenderer.asyncRenderMText(
  heavyMtextContent,
  textStyle,
  { byLayerColor: 0xffffff, byBlockColor: 0xffffff },
  'worker'
);

scene.add(mtextObject);

// Clean up
unifiedRenderer.destroy();
```

`syncRenderMText` always renders on the main thread (fonts must be preloaded). This method is not available in the worker renderer, so the unified renderer routes it to the main-thread implementation regardless of the current default mode.

### Performance Considerations

**When to use MainThreadRenderer:**
- Simple MText content with few characters
- When you need immediate synchronous results (use `syncRenderMText`)
- When worker overhead would be greater than rendering time

**When to use WebWorkerRenderer:**
- Large amounts of MText content
- Complex text with many formatting codes
- When you want to keep the main thread responsive
- Batch processing of multiple MText objects
 - Note: Only asynchronous rendering is supported in workers

**When to use UnifiedRenderer:**
- Applications that need to switch rendering strategies dynamically
- When rendering requirements vary based on content complexity
- Development environments where you want to test both approaches

If all of fonts or certain fonts are not needed any more after rendering, you can call method `release` of class `FontManager` to free memory occupied by them. Based on testing, one Chinese mesh font file may take 40M memory.

```typescript
// ---
// FontManager: Releasing Fonts
// ---
// To release all loaded fonts and free memory:
fontManager.release();

// To release a specific font by name (e.g., 'simsun'):
fontManager.release('simsun');
// Returns true if the font was found and released, false otherwise.
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines for details. 