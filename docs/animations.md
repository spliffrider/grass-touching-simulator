

Python  
content \= """\# Grass Touching Simulator: Animation Implementation Guide

This guide details exactly how to implement the 6 core animation concepts discussed for \*\*Grass Touching Simulator\*\*, adhering strictly to the architecture laid out in \`PROJECT\_MANUAL.md\`.

\#\# Core Philosophy  
1\. \*\*Decouple Logic from Visuals:\*\* Animations should never mutate \`GameState\`. They are strictly visual feedback triggered by state changes.  
2\. \*\*Centralize Effect Logic:\*\* To avoid bloating \`GameScene.ts\`, we will place all these visual helpers into a new dedicated directory: \`src/game/effects/\`.  
3\. \*\*Trigger via Callbacks:\*\* Systems will trigger these effects via their \`feedback\` interface (e.g., \`MySystemFeedback.popAtTile\`).

\---

\#\# Setup: Creating the Effects Helper

Create a new file at \`src/game/effects/AnimationHelper.ts\`. We will populate this file with reusable Phaser 3 visual helpers.

\`\`\`typescript  
import Phaser from 'phaser';

// Helper to ensure we don't animate objects that are already destroyed  
const isSafeToAnimate \= (target: Phaser.GameObjects.GameObject) \=\> {  
    return target && target.scene && \!target.destroy; // basic safety check  
};

## **1\. The Subtle Wind Sway (Baseline Idle)**

**Goal:** Make the field feel alive by subtly skewing the top of the grass tiles back and forth.  
**Where it lives:** src/game/effects/AnimationHelper.ts

### **Implementation**

TypeScript  
export function applyWindSway(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, intensity: 'calm' | 'windy' \= 'calm') {  
    // 1\. Root the sprite at the bottom center so only the top sways  
    sprite.setOrigin(0.5, 1);  
      
    // Adjust position since changing origin shifts the sprite visually  
    // If your tiles were originally origin(0,0), you might need to offset Y by sprite.height

    const isWindy \= intensity \=== 'windy';  
    const skewAmount \= isWindy ? 0.15 : 0.05;  
    const swayDuration \= isWindy ? 1200 : 3000;

    // 2\. Apply the continuous tween  
    scene.tweens.add({  
        targets: sprite,  
        skewX: skewAmount,  
        duration: swayDuration,  
        yoyo: true,  
        repeat: \-1,  
        ease: 'Sine.easeInOut',  
        delay: Math.random() \* 2000 // Randomize start so they don't move in uniform blocks  
    });  
}

**Wiring it to GameScene.ts:**  
When initializing the board or refreshing a tile texture to a "grown" state:

TypeScript  
import { applyWindSway } from '../effects/AnimationHelper';

// Inside GameScene's tile rendering logic  
const tileSprite \= this.add.sprite(x, y, textureKey);  
applyWindSway(this, tileSprite, this.state.activeWeatherId \=== 'windstorm' ? 'windy' : 'calm');

## **2\. The Satisfying "Squish" (Touch Feedback)**

**Goal:** Give immediate, tactile feedback when the player clicks a grass tile.  
**Where it lives:** src/game/effects/AnimationHelper.ts

### **Implementation**

TypeScript  
export function playSquishAnimation(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite) {  
    // Stop any existing squish tweens to prevent weird scaling bugs on spam-clicks  
    scene.tweens.killTweensOf(sprite, 'scaleY');  
    scene.tweens.killTweensOf(sprite, 'scaleX');

    // Assumes origin is already (0.5, 1\) from the Wind Sway setup\!  
    scene.tweens.add({  
        targets: sprite,  
        scaleY: 0.6, // Squish down  
        scaleX: 1.2, // Bulge out slightly  
        duration: 80,  
        yoyo: true,  
        ease: 'Quad.easeOut',  
        onComplete: () \=\> {  
            // Reset to exact 1 just in case of floating point weirdness  
            sprite.setScale(1, 1);   
        }  
    });  
}

**Wiring it to GameScene.ts:**  
Trigger this inside the refreshTile feedback callback when the FieldSystem processes a manual touch.

## **3\. The Loot Arc (Rewarding Drops)**

**Goal:** Animate gold and seeds flying from the tile into the UI HUD.  
**Where it lives:** src/game/effects/AnimationHelper.ts

### **Implementation**

TypeScript  
export function spawnLootArc(  
    scene: Phaser.Scene,   
    startX: number,   
    startY: number,   
    targetX: number,   
    targetY: number,   
    textureKey: string  
) {  
    const lootSprite \= scene.add.sprite(startX, startY, textureKey);  
    lootSprite.setScale(0.8);  
    lootSprite.setDepth(100); // Ensure it renders above UI and tiles

    // We use two tweens: one for the horizontal movement, one for the vertical arc  
      
    // X Movement (Linear to the target)  
    scene.tweens.add({  
        targets: lootSprite,  
        x: targetX,  
        duration: 800,  
        ease: 'Linear'  
    });

    // Y Movement (Upward burst, then plunge to target)  
    scene.tweens.add({  
        targets: lootSprite,  
        y: targetY,  
        duration: 800,  
        ease: 'Back.easeIn', // Plunges inward smoothly  
        onComplete: () \=\> {  
            lootSprite.destroy(); // Remove sprite when it hits the UI  
            // Optional: trigger a tiny UI bump on the HUD here\!  
        }  
    });  
}

**Wiring it to GameScene.ts:**  
In the feedback object passed to DropSystem.update(), implement dropLoot(x, y, type) that calls spawnLootArc targeting the HUD element's coordinates.

## **4\. The Sprinkler Pressure Burst (Automation)**

**Goal:** Build anticipation and visually show the automation firing.  
**Where it lives:** src/game/effects/AnimationHelper.ts

### **Implementation**

TypeScript  
export function playSprinklerBurst(scene: Phaser.Scene, sprinklerSprite: Phaser.GameObjects.Sprite) {  
    // 1\. The Buildup (Shake and expand)  
    scene.tweens.add({  
        targets: sprinklerSprite,  
        scaleX: 1.2,  
        scaleY: 1.2,  
        angle: { from: \-5, to: 5 },  
        duration: 50,  
        yoyo: true,  
        repeat: 5, // Shakes back and forth 5 times quickly  
        onComplete: () \=\> {  
            sprinklerSprite.setScale(1);  
            sprinklerSprite.setAngle(0);  
              
            // 2\. The Burst (Particles)  
            const emitter \= scene.add.particles(sprinklerSprite.x, sprinklerSprite.y, 'dew-fleck', {  
                speed: { min: 100, max: 200 },  
                angle: { min: 0, max: 360 }, // Burst in all directions  
                scale: { start: 1, end: 0 },  
                lifespan: 600,  
                gravityY: 300, // Water falls back down  
                quantity: 15,  
                emitting: false // Manual emit  
            });  
              
            emitter.explode(15);  
              
            // Clean up emitter after particles finish  
            scene.time.delayedCall(1000, () \=\> emitter.destroy());  
        }  
    });  
}

## **5\. Companion "Breathing" and Buzzing (Idle Life)**

**Goal:** Give idle animals passive life.  
**Where it lives:** src/game/effects/AnimationHelper.ts

### **Implementation**

TypeScript  
// For Chicken / Sheep  
export function applyBreathing(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite) {  
    sprite.setOrigin(0.5, 1); // Anchor feet  
    scene.tweens.add({  
        targets: sprite,  
        scaleY: 1.05,  
        scaleX: 0.98,  
        duration: 1500,  
        yoyo: true,  
        repeat: \-1,  
        ease: 'Sine.easeInOut'  
    });  
}

// For Bee Hive  
export function spawnBeeSwarm(scene: Phaser.Scene, hiveSprite: Phaser.GameObjects.Sprite) {  
    // Assuming you create a tiny 2x2 yellow pixel image called 'bee-pixel'  
    const emitter \= scene.add.particles(hiveSprite.x, hiveSprite.y \- 10, 'bee-pixel', {  
        x: { min: \-15, max: 15 },  
        y: { min: \-15, max: 15 },  
        speed: 20,  
        angle: { min: 0, max: 360 },  
        lifespan: 2000,  
        alpha: { start: 1, end: 0 },  
        quantity: 1,  
        frequency: 300 // Spawn a new bee every 300ms  
    });  
      
    // Add a circular motion modifier to make them "buzz" around  
    emitter.addVelocityModifier({  
        x: 'Math.sin(t \* 5\) \* 20',  
        y: 'Math.cos(t \* 5\) \* 20'  
    });  
      
    return emitter; // Return so you can destroy it if the hive is removed  
}

## **6\. The Expansion Cascade (Milestone Celebrations)**

**Goal:** Turn field expansion into a cinematic event, dropping tiles in sequentially.  
**Where it lives:** src/game/effects/AnimationHelper.ts

### **Implementation**

TypeScript  
export function playTileDropCascade(scene: Phaser.Scene, newTileSprites: Phaser.GameObjects.Sprite\[\]) {  
    // 1\. Mild screen shake  
    scene.cameras.main.shake(500, 0.01);

    // 2\. Staggered drop-in  
    newTileSprites.forEach((sprite, index) \=\> {  
        // Start them off-screen (high up)  
        const finalY \= sprite.y;  
        sprite.y \= finalY \- 400;  
        sprite.alpha \= 0;

        scene.tweens.add({  
            targets: sprite,  
            y: finalY,  
            alpha: 1,  
            duration: 600,  
            delay: index \* 100, // Stagger them\!  
            ease: 'Bounce.easeOut' // Heavy thud easing  
        });  
    });  
}

**Wiring it to GameScene.ts:**  
When checkMilestones expands the field, track which tileKey values are new. Create those sprites, throw them into an array, and pass them to playTileDropCascade.

## **Suggested Antigravity Prompt To Execute This Guide:**

When you are ready to feed this into Antigravity, use this prompt:  
*"Read ANIMATION\_IMPLEMENTATION\_GUIDE.md and PROJECT\_MANUAL.md. Create the src/game/effects/AnimationHelper.ts file with the methods outlined in the guide. Then, update GameScene.ts to implement the applyWindSway on newly rendered tiles, and wire the playSquishAnimation into the manual touch feedback callback. Ensure no game state logic is moved into the animation helper."*  
"""  
with open("ANIMATION\_IMPLEMENTATION\_GUIDE.md", "w") as f:  
f.write(content)

Your Markdown file is ready  
\[file-tag: code-generated-file-0-1780872331476563701\]

I have put together a highly detailed implementation guide as a \`.md\` file. It adheres strictly to the architecture defined in your project manual, keeping the state-mutating logic completely decoupled from the new visual feedback loop.

The guide starts by establishing the new \`src/game/effects/AnimationHelper.ts\` file, and then provides the exact Phaser 3 TypeScript code and wiring instructions for:  
1\. \*\*The Wind Sway:\*\* using continuous looping tweens with slight randomization.  
2\. \*\*The Satisfying "Squish":\*\* using scale tweens with a bounce easing.  
3\. \*\*The Loot Arc:\*\* using a combination of linear and Back.easeIn tweens to simulate physics.  
4\. \*\*The Sprinkler Pressure Burst:\*\* combining rapid rotation/scale tweens with a manual particle explosion.  
5\. \*\*Companion Breathing/Buzzing:\*\* setting up continuous scaling and velocity-modified particles.  
6\. \*\*The Expansion Cascade:\*\* using delayed, staggered tweens and a camera shake.

You can drop this directly into your system tomorrow to have your IDE scaffold everything out automatically\! Let me know if you need any adjustments or if you'd like to start generating sprite assets next.  
