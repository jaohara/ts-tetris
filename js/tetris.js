// TETRIS.JS
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
/**
 * Tetromino - A class used to represent a game piece.
 *
 * Generally only instantiated once, stored as "Tetris.activeGamepiece". Contains instsance
 * methods for movement, rotation, hard drops.
 *
 * Contains static members for data about piece types, initial piece locations,
 * and rotation transform instructions.
 */
var Tetromino = /** @class */ (function () {
    function Tetromino(pieceType, game, well, isGhost, pos) {
        if (isGhost === void 0) { isGhost = false; }
        if (pos === void 0) { pos = null; }
        this.gravity = null;
        // DEBUG
        this.moveCount = 0;
        this.rotation = [0, 1, 2, 3];
        if (Tetromino.pieceTypes.includes(pieceType)) {
            this.game = game;
            this.isGhost = isGhost;
            this.moveLock = false;
            this.moveQueue = new MoveQueue();
            this.pieceType = pieceType;
            this.pos = isGhost ? pos : Tetromino.startPositions[pieceType];
            this.well = well;
            var validSpawn = true;
            for (var _i = 0, _a = this.pos; _i < _a.length; _i++) {
                var position = _a[_i];
                validSpawn = this.checkValidMove(position.split(":").map(function (x) { return parseInt(x); }));
            }
            if (!validSpawn) {
                this.game.stop();
            }
            if (!isGhost) {
                this.ghost = new Tetromino(this.pieceType, this.game, this.well, true, this.pos);
            }
            else {
                this.hardDrop();
            }
        }
    }
    Tetromino.prototype.getGhost = function () {
        return this.ghost;
    };
    Tetromino.prototype.hardDrop = function () {
        var keepDroppin = true;
        var dropScore = 0;
        do {
            keepDroppin = this.move("down");
            dropScore += 1; // move("down") adds one already, so add another to make it 2 per row
        } while (keepDroppin);
        if (!this.isGhost) {
            this.game.addScore(dropScore);
        }
    };
    Tetromino.prototype.rotate = function (direction) {
        var transform;
        var validMove = true;
        var newPos = [];
        if (direction === "right") {
            transform = Tetromino.rotationTransforms[this.pieceType][this.rotation[0]];
            this.rotation.push(this.rotation.shift());
        }
        else {
            this.rotation.unshift(this.rotation.pop());
            transform = Tetromino.rotationTransforms[this.pieceType][this.rotation[0]];
        }
        // todo: remove debug lines
        //console.log(`R this.pos: ${this.pos}`);
        //console.log(`R transform: ${transform}`);
        for (var i = 0; i < transform.length && validMove; i++) {
            var blockRotation = transform[i].split(":").map(function (x) { return parseInt(x); });
            // remember - [0] is y, [1] is x here (row, column)
            var currentPos = this.pos[i].split(":").map(function (x) { return parseInt(x); });
            currentPos[1] += direction === "right" ? blockRotation[0] : blockRotation[0] * -1;
            currentPos[0] += direction === "right" ? blockRotation[1] : blockRotation[1] * -1;
            newPos[i] = currentPos.join(":");
            validMove = this.checkValidMove(currentPos);
        }
        if (validMove === true) {
            this.pos = newPos;
            if (!this.isGhost) {
                this.ghost.setPos(this.pos);
                this.ghost.hardDrop();
            }
        }
        else {
            // FUCK YOU BUG, RESET THAT GODDAMN ARRAY
            if (direction === "right") {
                this.rotation.unshift(this.rotation.pop());
            }
            else {
                this.rotation.push(this.rotation.shift());
            }
        }
        this.moveLock = false;
        this.nextMove();
        return validMove;
    };
    Tetromino.prototype.move = function (direction) {
        // check to see if valid move
        var validMove = true;
        // check direction and make sure it can move in a certain way
        var xDirection = direction == "down" || direction == "gravity" ? 0 : 1;
        xDirection *= direction == "left" ? -1 : 1;
        var yDirection = direction == "down" || direction == "gravity" ? 1 : 0;
        var newPos = [];
        for (var i = 0; i < this.pos.length && validMove; i++) {
            var currentPos = this.pos[i].split(":").map(function (x) { return parseInt(x); });
            currentPos[0] += yDirection;
            currentPos[1] += xDirection;
            newPos[i] = currentPos.join(":");
            validMove = this.checkValidMove(currentPos);
        }
        if (validMove) {
            this.pos = newPos;
            if (!this.isGhost) {
                if (direction === "down") {
                    this.game.addScore(1);
                }
                this.ghost.setPos(this.pos);
                this.ghost.hardDrop();
            }
        }
        else if (direction === "down" && !this.isGhost) {
            // I was also checking '|| direction === "gravity"', but that was causing a bug, and
            // it seems to be working without it? I should keep an eye on this
            this.well.lockPiece(this);
        }
        this.moveLock = false;
        this.nextMove();
        return validMove;
    };
    Tetromino.prototype.getPos = function () {
        return this.pos;
    };
    Tetromino.prototype.setPos = function (pos) {
        // this should probably only be used for ghosts, resets position before casting downward
        if (this.isGhost) {
            this.pos = pos;
        }
    };
    Tetromino.prototype.nextMove = function () {
        if (this.moveQueue.size() > 0) {
            var nextMove = this.moveQueue.dequeue().split(":");
            console.log("Dequeued move: " + nextMove.join(":"));
            if (nextMove[0] == "move") {
                this.move(nextMove[1]);
            }
            else if (nextMove[0] == "rotate") {
                this.rotate(nextMove[1]);
            }
        }
    };
    Tetromino.prototype.checkValidMove = function (position) {
        // first one changed from 0, I think this will allow the rotation over the top...
        return !(position[0] < -3 || position[0] >= this.well.getHeight() ||
            position[1] < 0 || position[1] >= this.well.getWidth() ||
            position[0] > 0 && this.well.getGrid()[position[0]][position[1]] != 0);
    };
    Tetromino.pieceTypes = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    Tetromino.startPositions = {
        'I': ['0:3', '0:4', '0:5', '0:6'],
        'J': ['0:3', '1:3', '1:4', '1:5'],
        'L': ['0:5', '1:3', '1:4', '1:5'],
        'O': ['0:4', '0:5', '1:4', '1:5'],
        'S': ['0:4', '0:5', '1:3', '1:4'],
        'T': ['0:4', '1:3', '1:4', '1:5'],
        'Z': ['0:3', '0:4', '1:4', '1:5']
    };
    /*
        TODO: Some rotations are still going completely bonkers, where parts of
            the piece rotate away from the rest of the piece - kind of looks like
            the Game of Life. This happens frequently when a rotation is obstructed
            in some way - most noticeably when rotating a vertical J-block in the
            first position that is one block away from the left side of the well. I think
            I've noticed it with either S/Z or T as well, and sometimes I.
     */
    // this is madness - don't think about it too much!
    // state transitions:
    // 1->2, 2->3, 3->4, 4->1
    Tetromino.rotationTransforms = {
        'I': [
            ['2:-1', '1:0', '0:1', '-1:2'],
            ['1:2', '0:1', '-1:0', '-2:-1'],
            ['-2:1', '-1:0', '0:-1', '1:-2'],
            ['-1:-2', '0:-1', '1:0', '2:1'], // -b
        ],
        'J': [
            ['2:0', '1:-1', '0:0', '-1:1'],
            ['0:2', '1:1', '0:0', '-1:-1'],
            ['-2:0', '-1:1', '0:0', '1:-1'],
            ['0:-2', '-1:-1', '0:0', '1:1'],
        ],
        'L': [
            ['0:2', '1:-1', '0:0', '-1:1'],
            ['-2:0', '1:1', '0:0', '-1:-1'],
            ['0:-2', '-1:1', '0:0', '1:-1'],
            ['2:0', '-1:-1', '0:0', '1:1'],
        ],
        'O': [
            ['0:0', '0:0', '0:0', '0:0'],
            ['0:0', '0:0', '0:0', '0:0'],
            ['0:0', '0:0', '0:0', '0:0'],
            ['0:0', '0:0', '0:0', '0:0'],
        ],
        'S': [
            ['1:1', '0:2', '1:-1', '0:0'],
            ['-1:1', '-2:0', '1:1', '0:0'],
            ['-1:-1', '0:-2', '-1:1', '0:0'],
            ['1:-1', '2:0', '-1:-1', '0:0'],
        ],
        'T': [
            ['1:1', '1:-1', '0:0', '-1:1'],
            ['-1:1', '1:1', '0:0', '-1:-1'],
            ['-1:-1', '-1:1', '0:0', '1:-1'],
            ['1:-1', '-1:-1', '0:0', '1:1'],
        ],
        'Z': [
            ['2:0', '1:1', '0:0', '-1:1'],
            ['0:2', '-1:1', '0:0', '-1:-1'],
            ['-2:0', '-1:-1', '0:0', '1:-1'],
            ['0:-2', '1:-1', '0:0', '1:1'],
        ]
    };
    return Tetromino;
}());
/**
 * MoveQueue - a simple queue implementation that Tetromino uses to store moves that
 * are requested while it is already performing a move.
 *
 * I don't really know if this is needed, at all. Originally I thought this was a
 * solution to the rotation bug - not only was it not that, but the methods never
 * even get called, implying that there's never a situation where multiple moves are
 * happening at the same time, meaning that this class doesn't really serve a purpose.
 */
var MoveQueue = /** @class */ (function () {
    function MoveQueue() {
        this.queue = [];
    }
    MoveQueue.prototype.enqueue = function (move) {
        this.queue.push(move);
    };
    // I kinda don't like allowing it to return undefined, but I guess it makes sense
    MoveQueue.prototype.dequeue = function () {
        return this.queue.shift();
    };
    MoveQueue.prototype.size = function () {
        return this.queue.length;
    };
    return MoveQueue;
}());
/**
 * Well - A class used to represent the current game board.
 *
 * The "grid" is the state of the board, stored as a 2D array of arrays that store numbers.
 * A value of 0 indicates that a cell is empty, and a value of 1-7 indicates that it contains
 * a block from one of the 7 tetrominos. This number corresponds to an index in the color
 * array.
 *
 * Important to note - this is Rows/Columns, so it reads like "y,x" if you're looking
 * at is as coordinates. Y values also ascend downward.
 */
var Well = /** @class */ (function () {
    function Well(game) {
        this.grid = [];
        this.height = 20;
        this.width = 10;
        this.clearDelay = 30; // in ms
        this.game = game;
        this.resetWell();
    }
    Well.prototype.resetWell = function () {
        for (var row = 0; row < this.height; row++) {
            this.grid[row] = [];
            for (var col = 0; col < this.width; col++) {
                this.grid[row].push(0);
            }
        }
    };
    Well.prototype.getGrid = function () {
        return this.grid;
    };
    Well.prototype.getHeight = function () {
        return this.grid.length;
    };
    Well.prototype.getWidth = function () {
        return this.grid[0].length;
    };
    Well.prototype.clearLines = function () {
        this.game.setSpawnLock(true);
        var linesCleared = 0;
        // how would I do something with a pause or animation on line clear?
        for (var row = this.getHeight() - 1; row > 0; row--) {
            if (!this.grid[row].includes(0)) {
                // clear that line
                this.grid.splice(row, 1);
                var replacementRow = [];
                for (var col = 0; col < this.width; col++) {
                    replacementRow.push(0);
                }
                this.grid.unshift(replacementRow);
                this.game.lineClear();
                linesCleared++;
                // continue checking from this spot
                row++;
            }
            /*
                Here's an idea - I don't think a piece could be floating, so we could
                probably stop this loop from checking the first time we hit a row of
                all 0s - meaning you're now looking at the blank space above the current
                structure of blocks in the well.

                I could add another condition to the for loop, and then have an else-if
                right above that checks if (!this.grid[row].includes(1,2,3,4,5,6,7)) or
                whatever the syntax would be, then it sets a boolean to true and breaks
                the loop
             */
        }
        // handle scoring
        if (linesCleared > 0) {
            var lineScore = (200 * linesCleared);
            lineScore -= linesCleared < 4 ? 100 : 0;
            lineScore *= this.game.getLevel();
            console.log("linesCleared: " + linesCleared + " - lineScore: " + lineScore);
            var lineString = linesCleared == 1 ? linesCleared + " line," : linesCleared == 4 ?
                "TETRIS!" : linesCleared + " lines,";
            this.game.log(lineString + " scored " + lineScore);
            this.game.addScore(lineScore);
        }
        this.game.setSpawnLock(false);
    };
    Well.prototype.lockPiece = function (piece) {
        var positions = piece.getPos();
        var colorNumber = Tetromino.pieceTypes.indexOf(piece.pieceType) + 1;
        for (var _i = 0, positions_1 = positions; _i < positions_1.length; _i++) {
            var pos = positions_1[_i];
            var blockRowCol = pos.split(":").map(function (x) { return parseInt(x); });
            this.grid[blockRowCol[0]][blockRowCol[1]] = colorNumber;
        }
        this.game.lockActivePiece();
    };
    return Well;
}());
/**
 * Tetris - A class used to represent the game state and pieces that comprise it.
 */
var Tetris = /** @class */ (function () {
    function Tetris() {
        // game settings
        this.blockSize = 24;
        this.DEBUG = true;
        this.frameRate = 60;
        // private readonly frameRate = 10;
        // were I a smarter man I'd use the formula, but I'm not, so this works
        this.gameSpeed = [
            0, 0.01667, 0.021217, 0.026977, 0.035256, 0.04693, 0.06361, 0.0899,
            0.1312, 0.1775, 0.2598, 0.388, 0.59, 0.92, 1.46, 2.36
        ];
        this.ghostPieceOpacity = 48; // 0-255
        this.gridSize = 3;
        this.updateFrequency = 1000 / this.frameRate;
        this.controls = [
            "ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "f", "Escape", "p", "Tab",
            "e", "n", "Enter"
        ];
        // game state
        this.activePiece = null;
        this.gameOver = true;
        this.ghostPiece = null;
        this.heldPiece = null;
        this.holdLock = false;
        this.pieceBag = [];
        this.titleScreen = true;
        this.logLength = 24;
        // graphics stuff
        /*
            COLOR ARRAY ORDER:        I, J, L, O, S, T, Z
    
            First is a reference to the bgColor so it's at index 0
            lt blue, darkblue, orange, yellow, green, purple, red
         */
        this.bgColor = '#1b1d24';
        this.pauseColor = '#1b1d24aa';
        this.fontColor = '#68e4b6';
        this.gridColor = '#282c34';
        this.colorArray = [
            this.bgColor, '#3498db', '#273ac5', '#e97e03',
            '#edcc30', '#13be3d', '#b84cd8', '#ec334d'
        ];
        this.canvas = document.getElementById("main-canvas");
        this.context = this.canvas.getContext('2d');
        this.well = new Well(this);
        // todo: don't autostart eventually
        this.start();
    }
    Tetris.prototype.start = function () {
        var _this = this;
        if (!this.running) {
            this.running = true;
            // add controls
            document.addEventListener("keydown", Tetris.pollInput);
            //this.newGame();
            // MAIN GAME LOOP
            this.gameLoop = setInterval(function () {
                if (!_this.titleScreen && !_this.paused && !_this.gameOver) {
                    // check for levelup
                    if (Math.floor(_this.linesCleared / 10) + 1 > _this.gameLevel && _this.gameLevel < 15) {
                        _this.gameLevel++;
                        _this.log("level up!");
                        clearInterval(_this.activePiece.gravity);
                        _this.activePiece.gravity = null;
                    }
                    // check if piece bag is exhausted
                    // todo: store two piece bags so you can have a long prediction of pieces?
                    if (_this.pieceBag.length <= 0) {
                        _this.newPieceBag();
                    }
                    // clear lines that need to be cleared
                    if (_this.activePiece == null) {
                        _this.well.clearLines();
                    }
                    // create new piece if one doesn't exist
                    if (_this.activePiece == null && !_this.spawnLock) {
                        _this.activePiece = new Tetromino(_this.pieceBag.pop(), game, _this.well);
                        _this.ghostPiece = _this.activePiece.getGhost();
                    }
                    if (_this.activePiece.gravity === null) {
                        _this.activePiece.gravity = setInterval(function () {
                            if (!_this.paused) {
                                if (!_this.activePiece.moveLock) {
                                    var falling = _this.activePiece.move("gravity");
                                    if (!falling) {
                                        _this.well.lockPiece(_this.activePiece);
                                    }
                                }
                                else {
                                    _this.activePiece.moveQueue.enqueue("move:gravity");
                                }
                            }
                        }, (_this.updateFrequency / _this.gameSpeed[_this.gameLevel]));
                    }
                }
                else if (_this.gameOver) {
                    // todo: GAME OVER STATE
                    //console.log("Game over, man!");
                    _this.drawGameOver();
                }
                else if (_this.titleScreen) {
                    _this.drawTitle();
                }
                // render board
                _this.draw();
            }, this.updateFrequency);
        }
        else {
            console.log("Game is already running.");
        }
    };
    // todo: Make this more of a game-over state
    Tetris.prototype.stop = function () {
        if (this.running) {
            this.gameOver = true;
            //this.running = false;
            //clearInterval(this.gameLoop);
            //document.removeEventListener("keydown", Tetris.pollInput);
        }
        else {
            console.log("Game isn't running.");
        }
    };
    // todo: have a pause menu controllable by arrow keys
    Tetris.prototype.pause = function () {
        this.paused = !this.paused;
        console.log("game " + (this.paused ? "paused" : "unpaused"));
    };
    Tetris.pollInput = function (event) {
        if (game.controls.includes(event.key)) {
            event.preventDefault();
            //console.log(`Recorded keypress: ${event.key}`);
            var key = event.key.includes("Arrow") ?
                event.key.slice(5).toLowerCase() : event.key;
            if (!game.titleScreen && !game.gameOver) {
                if (key === "Escape" || key === "p") {
                    game.pause();
                }
                else if (game.activePiece !== null && !game.paused) {
                    if (["left", "right", "down"].includes(key)) {
                        if (game.activePiece.moveLock) {
                            game.activePiece.moveQueue.enqueue("move:" + key);
                        }
                        else {
                            game.activePiece.move(key);
                        }
                    }
                    else if (key === "up" || key === "e") {
                        var direction = key == "up" ? "right" : "left";
                        if (game.activePiece.moveLock) {
                            game.activePiece.moveQueue.enqueue("rotate:" + direction);
                        }
                        else {
                            game.activePiece.rotate(direction);
                        }
                    }
                    else if (key === " ") {
                        game.activePiece.hardDrop();
                    }
                    else if (key === "f") {
                        game.holdPiece();
                    }
                }
            }
            else {
                if (key === "Enter" || key === "n") {
                    game.newGame();
                }
            }
        }
    };
    Tetris.prototype.newGame = function () {
        // reset game state
        this.diagMessage = [];
        // todo: allow for starting at a higher level?
        this.gameLevel = 1;
        this.gameOver = false;
        this.linesCleared = 0;
        this.score = 0;
        this.titleScreen = false;
        this.well.resetWell();
        //this.gameTimer
        this.log("new game started");
    };
    Tetris.prototype.lineClear = function () {
        this.linesCleared++;
    };
    Tetris.prototype.addScore = function (score) {
        this.score += score;
    };
    Tetris.prototype.getLevel = function () {
        return this.gameLevel;
    };
    Tetris.prototype.draw = function () {
        // draw BG
        this.context.fillStyle = this.bgColor;
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // draw Grid
        if (!this.gameOver) {
            this.drawGrid();
        }
        this.drawPause();
        // draw diagnostics
        this.drawDiag();
    };
    Tetris.prototype.drawGrid = function () {
        var grid = __spreadArray([], this.well.getGrid());
        var gridWidth = grid[0].length;
        var gridHeight = grid.length;
        var gridPixWidth = ((this.blockSize + this.gridSize) * gridWidth) + this.gridSize;
        var gridPixHeight = ((this.blockSize + this.gridSize) * gridHeight) + this.gridSize;
        // center grid
        var gridX = this.canvas.width / 2 - gridPixWidth / 2;
        var gridY = this.canvas.height / 2 - gridPixHeight / 2;
        this.context.fillStyle = this.gridColor;
        // draw grid bg
        this.context.fillRect(gridX, gridY, gridPixWidth, gridPixHeight);
        // get positions of active piece and that freaky ghost piece
        var piecePos = this.activePiece === null ? null : this.activePiece.getPos();
        var ghostPos = this.ghostPiece === null ? null : this.ghostPiece.getPos();
        // fill the blocks, rendering the active piece/that creepy ghost piece
        for (var row = 0; row < gridHeight; row++) {
            for (var col = 0; col < gridWidth; col++) {
                var blockX = gridX + this.gridSize + (col * (this.blockSize + this.gridSize));
                var blockY = gridY + this.gridSize + (row * (this.blockSize + this.gridSize));
                // render the active piece or that spooky ghost piece
                if (piecePos.includes(row + ":" + col)) {
                    this.context.fillStyle = this.colorArray[Tetris.getPieceColorIndex(this.activePiece)];
                }
                else if (ghostPos.includes(row + ":" + col)) {
                    this.context.fillStyle = this.colorArray[Tetris.getPieceColorIndex(this.ghostPiece)]
                        + this.ghostPieceOpacity.toString(16);
                }
                else {
                    this.context.fillStyle = this.colorArray[grid[row][col]];
                }
                this.context.fillRect(blockX, blockY, this.blockSize, this.blockSize);
            }
        }
    };
    // I should probably make this not only on debug and rename it to "drawUI" or something
    Tetris.prototype.drawDiag = function () {
        if (this.DEBUG) {
            if (!this.gameOver) {
                // maybe make this universal?
                this.context.fillStyle = '#bbb';
                this.context.font = '1.0em "JetBrains Mono"';
                // left side
                // active piece location
                /*
                this.context.fillText(
                    `activePiece: ${this.activePiece === null ? null : this.activePiece.pieceType}`,
                    20, 20, 200);
                this.context.fillText(`activePiece.pos:`, 20, 60, 200);
                this.context.fillText(`${this.activePiece === null ? null : this.activePiece.getPos()}`,
                    40, 80, 200);

                // ghost piece location
                this.context.fillText(`ghostPiece.pos:`, 20, 120, 200);
                this.context.fillText(`${this.ghostPiece === null ? null : this.ghostPiece.getPos()}`,
                    40, 140, 200);
                */
                // next piece
                this.context.fillText("nextPiece: " + (this.pieceBag !== null ? this.pieceBag[this.pieceBag.length - 1] : null), 20, 20, 200);
                // held piece
                this.context.fillText("heldPiece: " + (this.heldPiece !== null ? this.heldPiece.pieceType : null), 20, 60, 200);
                //right side
                // level
                this.context.fillText("gameLevel: " + this.gameLevel, 580, 20, 200);
                // lines cleared
                this.context.fillText("linesCleared: " + this.linesCleared, 580, 60, 200);
                // score
                this.context.fillText("score: " + this.score, 580, 100, 200);
                // gametime
                this.context.fillText("gameTime: " + null, 580, 140, 200);
                // draw that diag message
                this.context.fillStyle = this.fontColor;
                this.context.font = "0.8em JetBrains Mono";
                for (var i = 0; i < this.diagMessage.length; i++) {
                    this.context.fillStyle = this.fontColor + (255 - (i * Math.floor(255 / this.logLength))).toString(16);
                    this.context.fillText("" + this.diagMessage[i], 20, (i * 20) + 100, 200);
                }
            }
            else if (this.titleScreen) {
                this.drawTitle();
            }
            else {
                this.drawGameOver();
            }
        }
    };
    Tetris.prototype.drawPause = function () {
        if (this.paused) {
            this.drawOverlay();
            this.context.fillStyle = this.fontColor;
            this.context.font = "3.0em JetBrains Mono";
            this.context.fillText("Pause", this.canvas.width / 3 + 64, this.canvas.height / 2, this.canvas.height / 2);
        }
    };
    Tetris.prototype.drawGameOver = function () {
        this.drawOverlay();
        this.context.fillStyle = this.fontColor;
        this.context.font = "3.0em JetBrains Mono";
        this.context.fillText("Game Over", this.canvas.width / 3 + 50, this.canvas.height / 2, this.canvas.width);
    };
    Tetris.prototype.drawTitle = function () {
        this.drawOverlay();
        this.context.fillStyle = this.fontColor;
        this.context.font = "5.0em JetBrains Mono";
        this.context.fillText("Tetris", 20, 80, this.canvas.width);
        this.context.font = "1.0em JetBrains Mono";
        this.context.fillText("Programmed by John O'Hara in 2021", 40, 120, this.canvas.width / 2);
        this.context.fillText("Press Enter to Start", this.canvas.width / 3 + 50, 300, this.canvas.width / 2);
    };
    // I think I could make this better, I'm not satisfied as it is
    Tetris.prototype.drawOverlay = function () {
        this.context.fillStyle = this.pauseColor;
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        /*
        this.context.fillStyle = this.fontColor;

        this.context.font = "3.0em JetBrains Mono";

        this.context.fillText(message, this.canvas.width/3+64,
            this.canvas.height/2, this.canvas.width/2);

         */
    };
    Tetris.prototype.lockActivePiece = function () {
        clearInterval(this.activePiece.gravity);
        this.activePiece = null;
        this.ghostPiece = null;
        this.holdLock = false;
    };
    Tetris.prototype.holdPiece = function () {
        if (!this.holdLock) {
            clearInterval(this.activePiece.gravity);
            var tempPiece = this.activePiece;
            this.activePiece = this.heldPiece !== null ?
                new Tetromino(this.heldPiece.pieceType, game, this.well) : null;
            this.ghostPiece = this.activePiece !== null ?
                this.activePiece.getGhost() : null;
            this.heldPiece = tempPiece;
            this.holdLock = true;
        }
    };
    Tetris.prototype.setSpawnLock = function (state) {
        this.spawnLock = state;
    };
    Tetris.prototype.log = function (message) {
        if (this.diagMessage.length >= this.logLength) {
            this.diagMessage.pop();
        }
        this.diagMessage.unshift(message);
    };
    Tetris.getPieceColorIndex = function (piece) {
        if (piece == null) {
            return 0;
        }
        return Tetromino.pieceTypes.indexOf(piece.pieceType) + 1;
    };
    Tetris.prototype.newPieceBag = function () {
        this.pieceBag = __spreadArray([], Tetromino.pieceTypes);
        for (var i = 0; i < 7; i++) {
            var randIndex = Math.floor(Math.random() * (7 - i));
            if (randIndex != i) {
                var temp = this.pieceBag[i];
                this.pieceBag[i] = this.pieceBag[randIndex];
                this.pieceBag[randIndex] = temp;
            }
        }
    };
    return Tetris;
}());
var game = new Tetris();
document.getElementById("start-button").addEventListener("click", function () { return game.start(); });
document.getElementById("stop-button").addEventListener("click", function () { return game.stop(); });
document.getElementById("build-timestamp").innerText = document.lastModified;
console.log(game);
