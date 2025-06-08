# MText Renderer for Three.js

A flexible and extensible AutoCAD MText renderer implementation using Three.js. This package provides a modular architecture to render AutoCAD MText content with different rendering engines, with a primary focus on Three.js rendering.

## Features

- Render AutoCAD MText content using Three.js
- Modular font loading system
- Font management and dynamic font loading

## Core Components

### 1. FontManager

Singleton class managing font resources:

```typescript
class FontManager {
    static instance: FontManager;
    defaultFont: string;
}
```

### 2. StyleManager

Manages text styling and formatting:

```typescript
class StyleManager {
    constructor();
}
```

### 3. DefaultFontLoader

Handles font loading and management:

```typescript
class DefaultFontLoader {
    load(fonts: string[]): Promise<void>;
    getAvaiableFonts(): Promise<Font[]>;
}
```

## Usage

```typescript
import * as THREE from 'three';
import { DefaultFontLoader, FontManager, MText, StyleManager } from '@mlightcad/mtext-renderer';

// Initialize core components
const fontManager = FontManager.instance;
const styleManager = new StyleManager();
const fontLoader = new DefaultFontLoader();

// Load fonts needed
await fontLoader.load(['simsun']);

// Create MText content
const mtextContent = {
    text: '{\\fArial|b0|i0|c0|p34;Hello World}',
    height: 0.1,
    width: 0,
    position: new THREE.Vector3(0, 0, 0)
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
        color: 0xffffff
    },
    styleManager,
    fontManager
);

// Add to Three.js scene
scene.add(mtext);
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines for details. 