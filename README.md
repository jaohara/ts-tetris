# Tetris.ts
![ts](https://badgen.net/badge/-/TypeScript?icon=typescript&label&labelColor=blue&color=555555)

Written by John O'Hara

A browser-based tetris clone made in TypeScript.

[Live version.](https://jaohara.com/tetris)

## Structure

The project structure is a little jumbled right now - all the relevant classes for the game are contained in the same file, `tetris.ts`. From top to bottom you've got classes for `Tetromino`, `Well`, and `Tetris`.

To compile, just run `tsc tetris.ts`. `index.html` looks for the resulting `tetris.js`.

### `Tetromino`

The class that represents a game piece. Instantiated once as the active piece (`Tetris.activePiece`) and once as a ghost piece (`Tetris.ghostPiece`), which is a cosmetic piece that only interacts with the game board to draw itself. A non-ghost piece contains as reference to its own ghost piece as `this.ghost`. This class also contains static, readonly properties for the initial positioning of all the piece types as well as their rotation transforms.

### `Well`

The class that represents the current game board. `Well.grid` is the state of the board, stored as a 2D array of arrays that store numbers. A value of `0` indicates that a cell is empty, and a value of `1`-`7` indicates that it contains a block that came from the corresponding tetromino piece type. These numbers refer to an index in `Tetris.colorArray` that determines which color the cell should be filled.

**Important to note** - the grid is represented as Rows/Columns, so it reads like "y, x" if you're looking at it as coordinates. Y Values also ascend downward - `(0,0)` is the top-left cell and `(height-1, width-1)` is the bottom-right cell.

### `Tetris`

This class represents the game state, and the pieces that comprise it. An instance of this is instantiated as `game` when the script is loaded, and the main game loop is set into motion by calling `Tetris.start()`.

Contains both readonly settings fields that are modified before compiling and fields containing the game state that are modified at runtime. The main game loop is handled via `setInterval`, and a reference to this interval is stored at `this.gameTimer`. 

Because JS and TS are super weird about how `this` works, some methods relating to intervals internally refer to the global `game` instance to prevent `this` from actually referring to `window`, which owns `setInterval`. I don't like this, and I don't want it to work this way, but it does, and it is my great shame. 

## Todo / Bugs:

- Implement more robust high score logging
  - different high score lists per gametype; different criteria (sprint should be time, not score)
- Make gametype-dependent victory screens
- Make non-gameover game clear screen more positive/animated
  - Figure out pretty text idea for the "gameType Clear!" banner
- Save configuration - volume level, background, etc
- make options menu available
- Implement non-Chrome gamepad support
- Improve gamepad controls - should pieces be allowed to immediately harddrop after horizontal movement, or should that have a delay to
- Random minor woes with intervals not properly clearing
prevent that from happening accidentally?
- Level up animation

