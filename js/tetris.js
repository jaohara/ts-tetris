// TETRIS.TS - THE SOVIET MIND GAME
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
/**
 * Tetromino - A class used to represent a game piece.
 *
 * Generally only instantiated twice, stored as "Tetris.activeGamepiece" and "Tetris.ghostPiece".
 * Contains instance methods for movement, rotation, hard drops.
 *
 * Contains static members for data about piece types, initial piece locations,
 * and rotation transform instructions.
 */
var Tetromino = /** @class */ (function () {
    function Tetromino(pieceType, game, well, isGhost, pos) {
        if (isGhost === void 0) { isGhost = false; }
        if (pos === void 0) { pos = null; }
        this.floorKicked = false;
        this.gravity = null;
        this.lockDelay = null;
        this.rotation = [0, 1, 2, 3];
        if (Tetromino.pieceTypes.includes(pieceType)) {
            this.game = game;
            this.isGhost = isGhost;
            this.lockPercentage = 0;
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
                this.game.endGame();
            }
            if (!isGhost) {
                this.ghost = new Tetromino(this.pieceType, this.game, this.well, true, this.pos);
            }
            else {
                this.hardDrop();
            }
        }
    }
    Tetromino.lockDelayTimer = function (piece) {
        if (piece.lockPercentage > 99) { // we seem to get 99.99999... instead of 100 at the end
            //console.log(`Resolving lock delay on ${piece} - lockPercentage: ${piece.lockPercentage}`);
            piece.lockPercentage = 0;
            // I guess here we'll just lock the piece, right?
            //clearInterval(piece.lockDelay);
            //piece.lockDelay = null;
            piece.removeLockDelay();
            piece.well.lockPiece(piece);
        }
        else if (!game.isPaused()) {
            piece.lockPercentage += 100 / 30;
        }
    };
    Tetromino.prototype.removeLockDelay = function () {
        //console.log("Removing lock delay...");
        clearInterval(this.lockDelay);
        this.lockDelay = null;
        this.lockPercentage = 0;
        //console.log(`Removed delay on ${this}`);
    };
    Tetromino.prototype.getGhost = function () {
        return this.ghost;
    };
    Tetromino.prototype.getLockPercentage = function () {
        return this.lockPercentage;
    };
    Tetromino.prototype.hardDrop = function () {
        if (this.lockPercentage == 0) {
            var keepDroppin = true;
            var dropScore = 0;
            do {
                keepDroppin = this.move("down");
                dropScore += 1; // move("down") adds one already, so add another to make it 2 per row
            } while (keepDroppin);
            if (!this.isGhost) {
                this.game.addScore(dropScore);
            }
        }
        else { // This might solve the lock/hold bug?
            this.lockPercentage = 100;
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
        // wall kick logic:
        // Try normal, project right, then left, then up
        // Attempt #:
        // 0 - as is
        // 1 - try right shift
        // 2 - try left shift
        // 3 - try up shift - ONLY IF !this.floorKicked
        var rotationsAttempted = !this.floorKicked ? 4 : 3;
        var kicksAttempted = this.pieceType === "I" ? 4 : 3;
        var rotationFound = false;
        console.log("Starting rotations: rotationsAttempted = " + rotationsAttempted + ", kicksAttempted = " + kicksAttempted);
        for (var rotation = 0; rotation < rotationsAttempted && !rotationFound; rotation++) {
            var xKick = rotation === 1 ? 1 : 0;
            var yKick = rotation === 3 ? -1 : 0;
            xKick = rotation === 2 ? -1 : xKick;
            console.log("\trotation: " + rotation + " - xKick, yKick = " + xKick + ", " + yKick);
            for (var kick = 1; kick < kicksAttempted && !rotationFound; kick++) {
                // is this it?
                newPos = [];
                validMove = true;
                console.log("\t\tkick attempt " + kick + "...");
                for (var i = 0; i < transform.length && validMove; i++) {
                    console.log("\t\ttransform " + i + "...");
                    // for rotation transforms, [0] is x, [1] is y (column, row)
                    var blockRotation = transform[i].split(":").map(function (x) { return parseInt(x); });
                    // remember - here [0] is y, [1] is x (row, column)
                    var currentPos = this.pos[i].split(":").map(function (x) { return parseInt(x); });
                    currentPos[1] += xKick * kick;
                    currentPos[0] += yKick * kick;
                    currentPos[1] += direction === "right" ? blockRotation[0] : blockRotation[0] * -1;
                    currentPos[0] += direction === "right" ? blockRotation[1] : blockRotation[1] * -1;
                    newPos[i] = currentPos.join(":");
                    validMove = this.checkValidMove(currentPos);
                    console.log("\t\t\tvalidMove = " + validMove);
                }
                rotationFound = validMove;
                this.floorKicked = this.floorKicked || rotation === 3 && validMove;
            }
        }
        if (validMove === true) {
            this.pos = newPos;
            // reset lock delay
            if (this.lockPercentage > 0) {
                //console.log("Attempting to reset lock delay...");
                //this.lockPercentage = 0;
                this.removeLockDelay();
            }
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
        var _this = this;
        if (this.lockPercentage > 0 && direction === "down") {
            this.lockPercentage = 100;
            return false;
        }
        // check to see if valid move
        var validMove = true;
        if (direction === "gravity") {
            //console.log("Moving by gravity...");
        }
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
                if (direction !== "down" && this.lockPercentage > 0) {
                    // reset lock delay
                    if (direction === "gravity") {
                        this.removeLockDelay();
                    }
                    else {
                        //console.log("Attempting to reset lock delay...");
                        //this.lockPercentage = 0;
                        this.removeLockDelay();
                    }
                }
                this.ghost.setPos(this.pos);
                this.ghost.hardDrop();
            }
        }
        else if (direction === "down" && !this.isGhost) {
            // I was also checking '|| direction === "gravity"', but that was causing a bug, and
            // it seems to be working without it? I should keep an eye on this
            //if (hardDrop || this.lockPercentage > 0){
            this.well.lockPiece(this);
        }
        else if (direction === "gravity" && !this.isGhost && this.lockPercentage == 0) {
            //console.log("Non valid move on a real piece due to gravity");
            if (this.lockPercentage == 0 && this.lockDelay == null) {
                this.lockDelay = setInterval(function () { Tetromino.lockDelayTimer(_this); }, this.game.updateFrequency);
            }
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
    Tetromino.prototype.toString = function () {
        return "[Tetromino: " + this.pieceType + (this.isGhost ? " - GHOST" : "") + "]";
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
    // this is madness - don't think about it too much!
    // state transitions:
    // 1 -> 2, 2 -> 3, 3 -> 4, 4 -> 1
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
        this.clearAlpha = 0;
        this.clearAnimationInterval = null;
        this.clearAnimationCompleting = false;
        this.clearDelay = 30; // in ms
        this.rowsClearing = [];
        this.rowsCleared = [];
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
    Well.prototype.getRowsClearing = function () {
        return this.rowsClearing;
    };
    Well.prototype.getClearAlpha = function () {
        return this.clearAlpha;
    };
    Well.prototype.getHeight = function () {
        return this.grid.length;
    };
    Well.prototype.getWidth = function () {
        return this.grid[0].length;
    };
    Well.prototype.clearLines = function () {
        var _this = this;
        this.game.setSpawnLock(true);
        // todo: set
        if (this.clearAnimationInterval === null) {
            //console.log("clearLines has been called");
            //console.log("\tNo animation, checking rows....")
            //for (let row = this.getHeight() - 1; row > 0; row--) {
            for (var row = 0; row < this.getHeight(); row++) {
                if (!this.grid[row].includes(0)) {
                    console.log("\t\tFound a row to clear! - row " + row);
                    this.rowsClearing.push(row);
                }
            }
        }
        if (this.rowsClearing.length > 0) {
            if (this.clearAnimationInterval === null) {
                console.log("\tRows found with no existing animation...");
                console.log("\t\tRows clearing: " + this.rowsClearing);
                console.log("\t\tRows cleared: " + this.rowsCleared);
                this.clearAnimationInterval = setInterval(function () {
                    //console.log("\tclearAnimationInterval is running...");
                    if (_this.clearAlpha < 1.0) {
                        // ten frames to white? twenty?
                        _this.clearAlpha += .1;
                    }
                    else {
                        // probably going to need another "else if" for the next animation step if I want one
                        if (!_this.clearAnimationCompleting) {
                            console.log("\tFINAL STATE - clearAnimationInterval");
                            _this.clearAnimationCompleting = true;
                            clearInterval(_this.clearAnimationInterval);
                            _this.clearAnimationInterval = null;
                            //this.rowsClearing.sort((a, b) => a - b);
                            for (var _i = 0, _a = _this.rowsClearing; _i < _a.length; _i++) {
                                var row = _a[_i];
                                if (!_this.rowsCleared.includes(row)) {
                                    console.log("Clearing Row " + row + "...");
                                    _this.rowsCleared.push(row);
                                    _this.game.lineClear();
                                    _this.grid.splice(row, 1);
                                    var replacementRow = [];
                                    for (var col = 0; col < _this.width; col++) {
                                        replacementRow.push(0);
                                    }
                                    _this.grid.unshift(replacementRow);
                                }
                            }
                            // handle scoring
                            var lineScore = (200 * _this.rowsClearing.length);
                            lineScore -= _this.rowsClearing.length < 4 ? 100 : 0;
                            lineScore *= _this.game.getLevel();
                            var scoreMessage = void 0;
                            // todo: This can be more terse, right?
                            if (_this.rowsClearing.length < 4 && _this.rowsClearing.length > 0) {
                                scoreMessage = "LINE CLEAR x" + _this.rowsClearing.length;
                            }
                            else {
                                scoreMessage = "TETRIS! ";
                            }
                            scoreMessage += " +" + lineScore;
                            _this.game.addMessage(scoreMessage, _this.rowsClearing.length === 4);
                            console.log("linesCleared: " + _this.rowsClearing.length + " - lineScore: " + lineScore);
                            // reset the row clear animation
                            _this.clearAnimationCompleting = false;
                            _this.rowsClearing = [];
                            _this.rowsCleared = [];
                            _this.clearAlpha = 0;
                            _this.game.addScore(lineScore);
                            _this.game.setSpawnLock(false);
                        }
                    }
                }, this.game.updateFrequency);
            }
        }
        else {
            this.game.setSpawnLock(false);
        }
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
 * ScoreMessenger - a class used to represent an object that handles the lifecycle of dynamic
 * score messages.
 */
var ScoreMessenger = /** @class */ (function () {
    function ScoreMessenger(ctx, targetLocation, canvasCenter, colorArray, font, messageColor) {
        if (font === void 0) { font = "Poppins"; }
        if (messageColor === void 0) { messageColor = "#bbb"; }
        this.messages = [];
        this.canvasCenter = canvasCenter;
        this.colorArray = colorArray;
        this.ctx = ctx;
        this.font = font;
        this.targetLocation = targetLocation;
        this.messageColor = messageColor;
    }
    ScoreMessenger.prototype.addMessage = function (message, prettyBorder) {
        if (prettyBorder === void 0) { prettyBorder = false; }
        // should I have these be more customizable?
        var newMessage = {
            ascentFrames: 20,
            borderColors: [1, 2, 3, 4, 5, 6, 7],
            fadeFrames: 30,
            flashFrames: 30,
            message: message.toUpperCase(),
            opacity: 0,
            prettyBorder: prettyBorder
        };
        this.messages.push(newMessage);
    };
    ScoreMessenger.prototype.drawMessages = function () {
        if (this.messages.length > 0) {
            //let previousFont = this.ctx.font;
            //this.ctx.font = `${.6 * window.devicePixelRatio}em bold "${this.font}"`;
            this.ctx.font = .6 * window.devicePixelRatio + "em bold \"" + this.font + "\"";
            console.log(this.ctx.font);
            var finishedMessages = [];
            for (var messageIndex in this.messages) {
                var message = this.messages[messageIndex];
                var evenFrame = (message.flashFrames + message.ascentFrames) % 2 === 0;
                // fade up
                if (message.opacity < 1) {
                    message.opacity += 1 / message.fadeFrames;
                    message.opacity = message.opacity > 1 ? 1 : message.opacity;
                }
                this.ctx.globalAlpha = message.opacity;
                if (message.prettyBorder) {
                    this.ctx.fillStyle = this.colorArray[message.borderColors[0]];
                    // now draw the text, offset by (+1, +1)
                    if (message.ascentFrames > 0 || evenFrame) {
                        this.ctx.fillText(message.message, this.canvasCenter + 1, this.targetLocation + (message.ascentFrames * 3) + 1);
                    }
                    if (evenFrame) {
                        message.borderColors.push(message.borderColors.shift());
                    }
                }
                if (message.ascentFrames > 0 || evenFrame) {
                    this.ctx.fillStyle = this.messageColor;
                    this.ctx.fillText(message.message, this.canvasCenter, this.targetLocation + (message.ascentFrames * 3));
                    this.ctx.globalAlpha = 1;
                }
                message.ascentFrames -= message.ascentFrames > 0 ? 1 : 0;
                message.flashFrames -= message.flashFrames > 0 && message.ascentFrames === 0 ? 1 : 0;
                if (message.ascentFrames + message.flashFrames === 0) {
                    finishedMessages.push(parseInt(messageIndex));
                }
            }
            if (finishedMessages.length > 0) {
                this.pruneMessages(finishedMessages);
            }
            //this.ctx.font = previousFont;
        }
    };
    ScoreMessenger.prototype.clearMessages = function () {
        this.messages = [];
    };
    ScoreMessenger.prototype.pruneMessages = function (messageIndices) {
        if (messageIndices === void 0) { messageIndices = []; }
        if (messageIndices.length > 0) {
            for (var _i = 0, messageIndices_1 = messageIndices; _i < messageIndices_1.length; _i++) {
                var index = messageIndices_1[_i];
                this.messages.splice(index, 1);
            }
        }
    };
    return ScoreMessenger;
}());
/**
 * Tetris - A class used to represent the game state and pieces that comprise it.
 */
var Tetris = /** @class */ (function () {
    function Tetris() {
        this.gamepad = null;
        this.gamepadLastFrame = null;
        // Object to store commonly needed pixel locations and dimensions
        this.cvLocations = [1, 2, 3, 4, 6, 8, 12, 24];
        this.renderedBGTimer = null;
        this.renderedMinos = {
            "I": HTMLCanvasElement,
            "J": HTMLCanvasElement,
            "L": HTMLCanvasElement,
            "O": HTMLCanvasElement,
            "S": HTMLCanvasElement,
            "T": HTMLCanvasElement,
            "Z": HTMLCanvasElement
        };
        this.renderedPieces = {
            "I": HTMLCanvasElement,
            "J": HTMLCanvasElement,
            "L": HTMLCanvasElement,
            "O": HTMLCanvasElement,
            "S": HTMLCanvasElement,
            "T": HTMLCanvasElement,
            "Z": HTMLCanvasElement
        };
        this.frameRate = 60;
        this.gameSpeed = [
            0, 0.01667, 0.021217, 0.026977, 0.035256, 0.04693, 0.06361, 0.0879,
            (0.1312 - .0076), 0.1775, 0.2598, 0.388, 0.59, 0.92, 1.46, 2.36
        ]; // all cops means all cops
        this.ghostPieceOpacity = 48; // 0-255
        this.gridSize = 1;
        this.updateFrequency = 1000 / this.frameRate;
        this.controls = [
            "ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "f", "Escape", "p", "Tab",
            "e", "n", "Enter"
        ];
        this.debugControls = ["0", "9", "8", "7", "6", "5", "PageUp", "PageDown"];
        // game state
        this.activePiece = null;
        this.autorepeatFrameLock = 0;
        this.gameOver = true;
        this.gamepadConnected = false;
        this.gamepadIndex = null;
        this.ghostPiece = null;
        this.heldPiece = null;
        this.holdLock = false;
        this.pieceBag = [];
        this.pieceBagBackup = [];
        this.spawnLock = false;
        this.titleScreen = true;
        // menu stuff
        this.pauseScreenOptions = ["Resume", "Restart", "Options", "Quit"];
        this.titleScreenOptions = ["Start", "Options"];
        this.startOptions = ["Classic", "Endless", "Sprint"];
        this.pauseScreenSelectedOption = 0;
        this.titleScreenSelectedOption = 0;
        this.titleScreenTransitionTimer = null;
        // graphics stuff
        /*
            COLOR ARRAY ORDER:        I, J, L, O, S, T, Z
    
            First is a reference to the bgColor so it's at index 0
            lt blue, darkblue, orange, yellow, green, purple, red
         */
        this.bgColor = '#1b1d24';
        // private bgGradientColor1        = {'h': 240, 's': 69, 'l': 13};
        this.bgGradientColor1 = { 'h': 201, 's': 77, 'l': 32 };
        this.bgGradientColor2 = { 'h': 177, 's': 84, 'l': 36 };
        this.bgGradientColorString1 = 'hsl(201,77%,32%)';
        this.bgGradientColorString2 = 'hsl(177, 84%, 36%)';
        this.bgGradientTarget1 = 201;
        this.bgGradientTarget2 = 177;
        this.bgGradientTimer = null;
        this.bezierColor1 = '#3498db';
        this.bezierColor2 = '#68e4b6';
        this.borderColor = '#bbb';
        this.pauseColor = '#000';
        this.gameFont = 'Poppins';
        this.loadOverlayOpacityTimer = null;
        this.loadOverlayLock = false;
        this.loadOverlayOpacity = 0;
        this.overlayBehindTheScenesComplete = false;
        this.overlayFinalOpacity = .6; // 0-1.0
        this.overlayOpacity = 0;
        this.overlayOpacityTimer = null;
        this.fontColor = '#bbb';
        this.gridColor = '#9b9ba9';
        this.colorArray = [
            '#1b1d24', '#3498db', '#273ac5', '#e97e03',
            '#edcc30', '#13be3d', '#b84cd8', '#ec334d'
        ];
        // graphics/debug options
        this.noGravity = false;
        this.noBackground = false;
        this.pieceGlow = false; // todo: make this more performant so it can be on by default
        this.simpleBackground = true;
        this.testRenderMinos = false;
        // setup canvas with proper scaling
        this.canvas = document.getElementById("main-canvas");
        var width = this.canvas.width;
        var height = this.canvas.height;
        this.canvas.style.width = width + "px";
        this.canvas.style.height = height + "px";
        this.canvas.width *= window.devicePixelRatio;
        this.canvas.height *= window.devicePixelRatio;
        // setup common canvas locations
        this.cvHeights = {};
        this.cvWidths = {};
        for (var _i = 0, _a = this.cvLocations; _i < _a.length; _i++) {
            var divisor = _a[_i];
            this.cvHeights["c" + divisor] = Math.floor(this.canvas.height / divisor);
            this.cvWidths["c" + divisor] = Math.floor(this.canvas.width / divisor);
        }
        // get and scale canvas
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.textAlign = "center";
        //this.ctx.scale(window.devicePixelRatio, devicePixelRatio);
        this.blockSize = Math.floor(this.canvas.height / 25);
        this.well = new Well(this);
        // pre-render minos and pieces
        for (var _b = 0, _c = Tetromino.pieceTypes; _b < _c.length; _b++) {
            var pieceType = _c[_b];
            this.renderedMinos[pieceType] = document.createElement("canvas");
            this.renderedMinos[pieceType].height = this.blockSize;
            this.renderedMinos[pieceType].width = this.blockSize;
            Tetris.renderMinos(pieceType, this.renderedMinos[pieceType], this.blockSize, this.colorArray[Tetromino.pieceTypes.indexOf(pieceType) + 1]);
            this.renderedPieces[pieceType] = document.createElement("canvas");
            if (pieceType === "I") {
                this.renderedPieces[pieceType].width = (4 * (this.blockSize + this.gridSize));
                this.renderedPieces[pieceType].height = this.blockSize + this.gridSize;
            }
            else if (pieceType === "O") {
                this.renderedPieces[pieceType].width = (4 * (this.blockSize + this.gridSize));
                this.renderedPieces[pieceType].height = (2 * (this.blockSize + this.gridSize));
            }
            else {
                this.renderedPieces[pieceType].width = (3 * (this.blockSize + this.gridSize));
                this.renderedPieces[pieceType].height = (2 * (this.blockSize + this.gridSize));
            }
            Tetris.renderCosmeticPiece(pieceType, this.renderedPieces[pieceType], this.renderedMinos[pieceType], this.blockSize, this.gridSize);
        }
        // render background texture?
        this.renderedBackground = document.createElement("canvas");
        this.renderedBackground.width = this.canvas.width * 3;
        this.renderedBackground.height = this.canvas.height * 3;
        var bgCtx = this.renderedBackground.getContext('2d');
        //bgCtx.rotate(Math.PI/8);
        var pieceArray = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
        for (var row = 0; row < Math.floor(this.renderedBackground.height / (this.blockSize * 4)); row++) {
            console.log("Row number " + row);
            for (var col = 0; col < Math.floor(this.renderedBackground.width / (this.blockSize * 4)); col++) {
                console.log("\tCol number " + col);
                var currentPiece = pieceArray.shift();
                pieceArray.push(currentPiece);
                bgCtx.drawImage(this.renderedPieces[currentPiece], col * (this.blockSize * 5), row * (this.blockSize * 5));
            }
        }
        //bgCtx.restore();
        // configure title screen animation
        this.renderedBGX = this.canvas.width * -2;
        this.renderedBGY = this.canvas.height * -2;
        // todo: get high score from wherever it has been saved?
        var localHighScore = localStorage.getItem("highScore");
        this.highScore = localHighScore !== null ? parseInt(localHighScore) : 16000;
        // setup ScoreMessenger
        this.messenger = new ScoreMessenger(this.ctx, this.cvHeights.c3, this.cvWidths.c2, this.colorArray);
        this.start();
    }
    Tetris.prototype.start = function () {
        var _this = this;
        if (!this.running) {
            this.running = true;
            // add controls
            document.addEventListener("keydown", Tetris.pollInput);
            document.addEventListener("keyup", Tetris.clearLastFrameAction);
            window.addEventListener("gamepadconnected", function (e) { return Tetris.setupGamepad(e, true); });
            window.addEventListener("gamepaddisconnected", function (e) { return Tetris.setupGamepad(e, false); });
            //this.newGame();
            // MAIN GAME LOOP
            this.gameLoop = setInterval(function () {
                if (_this.titleScreen) {
                    // title screen state
                    _this.drawTitle();
                }
                else if (_this.gameOver) {
                    // game over state
                    //this.updateHighScore(true);
                    _this.drawGameOver();
                }
                else {
                    // in-game state
                    // update loop timer
                    if (!_this.paused) {
                        _this.previousLoopTime = isNaN(_this.previousLoopTime) ? Date.now() : _this.previousLoopTime;
                        _this.elapsedTime += Date.now() - _this.previousLoopTime;
                    }
                    _this.previousLoopTime = Date.now();
                    // check for gamepad input
                    if (_this.gamepadConnected) {
                        Tetris.pollGamepad();
                    }
                    // DEBUG: report state current locking piece if it exists
                    if (_this.activePiece !== null && _this.activePiece.getLockPercentage() > 0) {
                        console.log("activePiece locking: " + _this.activePiece.getLockPercentage() + "%");
                    }
                    if (!_this.titleScreen && !_this.paused && !_this.gameOver) {
                        // check for levelup
                        if (Math.floor(_this.linesCleared / 10) + 1 > _this.gameLevel && _this.gameLevel < 15) {
                            _this.gameLevel++;
                            // stagger message so it isn't simultaneous with line clear
                            setTimeout(function () {
                                _this.addMessage("Level Up! " + _this.gameLevel);
                            }, 300);
                            if (_this.activePiece !== null) {
                                clearInterval(_this.activePiece.gravity);
                                _this.activePiece.gravity = null;
                            }
                        }
                        // check if backup piece bag is exhausted
                        if (_this.pieceBagBackup.length <= 0) {
                            _this.pieceBagBackup = Tetris.newPieceBag();
                        }
                        // check if piece bag is exhausted, swap in backup if it is
                        if (_this.pieceBag.length <= 0) {
                            _this.pieceBag = _this.pieceBagBackup;
                            _this.pieceBagBackup = [];
                        }
                        // clear lines that need to be cleared
                        if (_this.activePiece == null) {
                            _this.well.clearLines();
                        }
                        // create new piece if one doesn't exist
                        if (_this.activePiece == null && !_this.spawnLock) {
                            _this.newPiece();
                        }
                        // give the active piece gravity if it doesn't have it
                        if (_this.activePiece !== null && _this.activePiece.gravity === null) {
                            _this.activePiece.gravity = setInterval(function () {
                                if (!_this.paused && !_this.noGravity) {
                                    if (!_this.activePiece.moveLock) {
                                        var falling = _this.activePiece.move("gravity");
                                        if (!falling) {
                                            //this.well.lockPiece(this.activePiece);
                                        }
                                    }
                                    else {
                                        _this.activePiece.moveQueue.enqueue("move:gravity");
                                    }
                                }
                            }, (_this.updateFrequency / _this.gameSpeed[_this.gameLevel]));
                        }
                        _this.updateHighScore();
                    }
                }
                // render board
                _this.draw();
            }, this.updateFrequency);
        }
        else {
            console.log("Game is already running.");
        }
    };
    Tetris.prototype.endGame = function (quitToTitle, restart) {
        if (quitToTitle === void 0) { quitToTitle = false; }
        if (restart === void 0) { restart = false; }
        if (this.running) {
            // set proper state
            this.gameOver = true;
            this.titleScreen = quitToTitle;
            this.updateHighScore(true);
            // reset game pieces
            clearInterval(this.activePiece.gravity);
            this.activePiece.gravity = null;
            this.activePiece = null;
            this.elapsedTime = 0;
            this.linesCleared = 0;
            this.gameLevel = 0;
            this.ghostPiece = null;
            this.heldPiece = null;
            this.pieceBag = [];
            this.pieceBagBackup = [];
            this.score = 0;
            this.well.resetWell();
            if (restart) {
                // so is this how I'm restarting the game?
                this.newGame();
                this.pause();
            }
        }
        else {
            console.log("Game isn't running.");
        }
    };
    // todo: have a pause menu controllable by arrow keys
    Tetris.prototype.pause = function (skipFade) {
        var _this = this;
        if (skipFade === void 0) { skipFade = false; }
        this.paused = !this.paused;
        this.pauseOverlay = !skipFade;
        console.log("game " + (this.paused ? "paused" : "unpaused"));
        clearInterval(this.overlayOpacityTimer);
        this.overlayOpacityTimer = null;
        if (!skipFade) {
            this.overlayOpacityTimer = setInterval(function () {
                var direction = _this.paused ? 1 : -1;
                _this.overlayOpacity += direction * (_this.overlayFinalOpacity / 8);
                if (_this.overlayOpacity > _this.overlayFinalOpacity || _this.overlayOpacity < 0) {
                    clearInterval(_this.overlayOpacityTimer);
                    _this.overlayOpacityTimer = null;
                    if (_this.overlayOpacity < 0) {
                        _this.overlayOpacity = 0;
                        _this.pauseOverlay = false;
                        _this.pauseScreenSelectedOption = 0;
                    }
                }
            }, this.updateFrequency);
        }
    };
    Tetris.prototype.isPaused = function () {
        return this.paused;
    };
    Tetris.pollInput = function (event, input, gamepadSource) {
        //console.log(`event: ${event}, input: ${input}`);
        if (event === void 0) { event = null; }
        if (input === void 0) { input = null; }
        if (gamepadSource === void 0) { gamepadSource = false; }
        // my logic seems redundant here but I dunno
        if (event !== null) {
            input = event.key;
        }
        if (game.controls.includes(input)) {
            if (event !== null) {
                event.preventDefault();
            }
            input = input.includes("Arrow") ? input.slice(5).toLowerCase() : input;
            if (!game.titleScreen && !game.gameOver) {
                // Toggle Pause Keys
                if (input === "Escape" || input === "p") {
                    game.pause();
                }
                // Gameplay Controls
                else if (game.activePiece !== null && !game.paused) {
                    if (["left", "right", "down"].includes(input)) {
                        if (game.activePiece.moveLock) {
                            game.activePiece.moveQueue.enqueue("move:" + input);
                        }
                        else {
                            game.activePiece.move(input);
                        }
                    }
                    else if (input === "up" || input === "e") {
                        var direction = input == "up" ? "right" : "left";
                        if (game.activePiece.moveLock) {
                            game.activePiece.moveQueue.enqueue("rotate:" + direction);
                        }
                        else {
                            game.activePiece.rotate(direction);
                        }
                    }
                    else if (input === " ") {
                        game.activePiece.hardDrop();
                    }
                    else if (input === "f") {
                        game.holdPiece();
                    }
                }
                // Pause Controls
                else if (game.paused) {
                    // navigate pause menu
                    // game.lastFrameAction is a very rudimentary way of halving repeat speed
                    // ....and it's not working.
                    if (input === "up") {
                        console.log("Up While paused");
                        if (game.lastFrameAction !== "up") {
                            game.pauseScreenSelectedOption--;
                            game.pauseScreenSelectedOption = game.pauseScreenSelectedOption < 0 ?
                                game.pauseScreenOptions.length - 1 : game.pauseScreenSelectedOption;
                        }
                        game.lastFrameAction = game.lastFrameAction === "up" ? null : "up";
                    }
                    else if (input === "down") {
                        console.log("Down While paused");
                        if (game.lastFrameAction !== "down") {
                            game.pauseScreenSelectedOption++;
                            game.pauseScreenSelectedOption =
                                game.pauseScreenSelectedOption > game.pauseScreenOptions.length - 1 ? 0 :
                                    game.pauseScreenSelectedOption;
                        }
                        game.lastFrameAction = game.lastFrameAction === "down" ? null : "down";
                    }
                    // confirm pause menu option
                    else if (input === "Enter") {
                        var option = game.pauseScreenOptions[game.pauseScreenSelectedOption];
                        if (option === "Resume") {
                            game.pause();
                        }
                        else if (option === "Restart") {
                            game.pauseScreenSelectedOption = 0;
                            game.restartGame();
                        }
                        else if (option === "Quit") {
                            game.pauseScreenSelectedOption = 0;
                            game.quitToTitle();
                        }
                    }
                }
            }
            else {
                // should only be on game over and title screen states
                if (input === "Enter" || input === "n" || gamepadSource && (input === "Escape" || input === "ArrowUp")) {
                    game.newGame();
                }
            }
        }
        else if (game.debugControls.includes(input)) {
            event.preventDefault();
            if (input === "0") {
                game.noBackground = !game.noBackground;
            }
            else if (input === "9") {
                game.simpleBackground = !game.simpleBackground;
            }
            else if (input === "8") {
                game.testRenderMinos = !game.testRenderMinos;
            }
            else if (input === "7") {
                game.noGravity = !game.noGravity;
            }
            else if (input === "6") {
                game.pieceGlow = !game.pieceGlow;
            }
            else if (input === "5") {
                game.messenger.addMessage("Test message!", true);
            }
            else if (input === "PageUp") {
                game.linesCleared += 10;
            }
            else if (input === "PageDown") {
                if (game.linesCleared >= 10 && game.gameLevel > 1) {
                    game.linesCleared -= 10;
                    game.gameLevel--;
                }
            }
        }
    };
    Tetris.clearLastFrameAction = function () {
        game.lastFrameAction = null;
    };
    Tetris.pollGamepad = function () {
        if (game.gamepadConnected && game.gamepad !== null) {
            game.gamepad = navigator.getGamepads()[game.gamepadIndex];
            var repeatableActions = ["ArrowLeft", "ArrowRight", "ArrowDown"];
            for (var i = 0; i < game.gamepad.buttons.length; i++) {
                if (game.gamepad.buttons[i].pressed && Tetris.gamepadMap.hasOwnProperty(i)) {
                    if (repeatableActions.includes(Tetris.gamepadMap[i])) {
                        // probably shouldn't allow any motion if the hard drop was pressed last frame
                        // todo: I don't think this should be hardcoded
                        if (!game.gamepadLastFrame.buttons[12].pressed) {
                            if (game.autorepeatFrameLock <= 0 ||
                                game.gamepad.buttons[i].pressed !== game.gamepadLastFrame.buttons[i].pressed) {
                                Tetris.pollInput(null, Tetris.gamepadMap[i], true);
                                game.autorepeatFrameLock = Tetris.gamepadMap[i] === "ArrowDown" ? 0 : 6;
                            }
                            else {
                                game.autorepeatFrameLock--;
                            }
                        }
                    }
                    else if (game.gamepadLastFrame === null ||
                        game.gamepad.buttons[i].pressed !== game.gamepadLastFrame.buttons[i].pressed) {
                        // maybe restrict hard drop immediately after motion?
                        Tetris.pollInput(null, Tetris.gamepadMap[i], true);
                    }
                }
            }
            game.gamepadLastFrame = game.gamepad;
        }
    };
    Tetris.setupGamepad = function (event, connected) {
        game.gamepadConnected = connected;
        game.gamepad = connected ? event.gamepad : null;
        game.gamepadIndex = game.gamepad.index;
        console.log("Gamepad[" + game.gamepadIndex + "] " + (connected ? "" : "dis") + "connected");
    };
    // what's up with this vs the state reset in endGame? should I keep part of this?
    Tetris.prototype.newGame = function () {
        this.elapsedTime = 0;
        // todo: allow for starting at a higher level?
        this.gameLevel = 1;
        this.gameOver = false;
        this.linesCleared = 0;
        this.overlayOpacity = 0;
        this.score = 0;
        this.titleScreen = false;
        this.well.resetWell();
    };
    Tetris.prototype.newPiece = function () {
        var newPieceType = this.pieceBag.pop();
        console.log("Generating new piece: " + newPieceType + " - Remaining in pieceBag: " + this.pieceBag);
        //this.activePiece.removeLockDelay();
        this.activePiece = new Tetromino(newPieceType, game, this.well);
        this.ghostPiece = this.activePiece.getGhost();
        var pieceBagContents = __spreadArray([], this.pieceBag).reverse();
        var pieceBagBackupContents = __spreadArray([], this.pieceBagBackup).reverse();
        this.upcomingPieces = pieceBagContents.concat(pieceBagBackupContents).slice(0, 5);
    };
    Tetris.prototype.lineClear = function () {
        var _this = this;
        this.linesCleared++;
        this.bgGradientTarget1 += 2;
        this.bgGradientTarget2 += 2;
        this.bgGradientTarget1 = this.bgGradientTarget1 > 360 ?
            this.bgGradientTarget1 - 360 : this.bgGradientTarget1;
        this.bgGradientTarget2 = this.bgGradientTarget2 > 360 ?
            this.bgGradientTarget2 - 360 : this.bgGradientTarget2;
        // shift bg gradient pattern with additional cleared lines
        if (this.bgGradientTimer === null) {
            this.bgGradientTimer = setInterval(function () {
                _this.bgGradientColor1.h++;
                _this.bgGradientColor2.h++;
                _this.bgGradientColor1.h = _this.bgGradientColor1.h > 360 ?
                    _this.bgGradientColor1.h - 360 : _this.bgGradientColor1.h;
                _this.bgGradientColor2.h = _this.bgGradientColor2.h > 360 ?
                    _this.bgGradientColor2.h - 360 : _this.bgGradientColor2.h;
                if (_this.bgGradientColor1.h >= _this.bgGradientTarget1 &&
                    _this.bgGradientColor2.h >= _this.bgGradientTarget2) {
                    clearInterval(_this.bgGradientTimer);
                    _this.bgGradientTimer = null;
                }
                _this.bgGradientColorString1 =
                    "hsl(" + _this.bgGradientColor1.h + ", " + _this.bgGradientColor1.s + "%, " + _this.bgGradientColor1.l + "%)";
                _this.bgGradientColorString2 =
                    "hsl(" + _this.bgGradientColor2.h + ", " + _this.bgGradientColor2.s + "%, " + _this.bgGradientColor2.l + "%)";
            }, this.updateFrequency * 6);
        }
    };
    Tetris.prototype.lockActivePiece = function () {
        console.log("Locking active piece: " + this.activePiece);
        clearInterval(this.activePiece.gravity);
        this.activePiece = null;
        this.ghostPiece = null;
        this.holdLock = false;
    };
    Tetris.prototype.holdPiece = function () {
        if (!this.holdLock) {
            this.spawnLock = true;
            clearInterval(this.activePiece.gravity);
            this.activePiece.gravity = null;
            console.log("Holding " + this.activePiece + ", swapping for " + this.heldPiece);
            // did reordering these steps change the lockdelay bug?
            this.activePiece.removeLockDelay();
            var tempPiece = this.activePiece;
            this.activePiece = this.heldPiece !== null ?
                new Tetromino(this.heldPiece.pieceType, game, this.well) : null;
            this.ghostPiece = this.activePiece !== null ?
                this.activePiece.getGhost() : null;
            this.heldPiece = tempPiece;
            this.holdLock = true;
            this.spawnLock = false;
        }
    };
    Tetris.prototype.setSpawnLock = function (state) {
        this.spawnLock = state;
    };
    Tetris.prototype.addScore = function (score) {
        this.score += score;
        this.highScore = this.score > this.highScore ? this.score : this.highScore;
    };
    Tetris.prototype.addMessage = function (message, prettyBorder) {
        if (prettyBorder === void 0) { prettyBorder = false; }
        this.messenger.addMessage(message, prettyBorder);
    };
    Tetris.prototype.getLevel = function () {
        return this.gameLevel;
    };
    Tetris.prototype.updateHighScore = function (writeScore) {
        if (writeScore === void 0) { writeScore = false; }
        this.highScore = this.score > this.highScore ? this.score : this.highScore;
        if (writeScore) {
            localStorage.setItem("highScore", this.highScore.toString());
        }
    };
    // DRAW METHODS
    Tetris.prototype.draw = function () {
        // dynamic numbers used for ambient animations
        //let sinOffset = 500*Math.sin(Date.now()/50000);
        //let cosOffset = 500*Math.cos(Date.now()/50000);
        var sinOffset = 500 * Math.sin(this.previousLoopTime / 50000);
        var cosOffset = 500 * Math.cos(this.previousLoopTime / 50000);
        // draw BG
        this.drawBackground(sinOffset, cosOffset);
        // draw Grid
        if (!this.gameOver) {
            this.drawGrid();
        }
        // draw UI
        this.drawUI(sinOffset, cosOffset);
        // draw messages
        this.messenger.drawMessages();
        // draw pause overlay if necessary
        this.drawPause();
        // finally, draw loading overlay if necessary
        this.drawLoadOverlay();
    };
    Tetris.prototype.drawBackground = function (sinOffset, cosOffset) {
        if (!this.noBackground) {
            if (this.simpleBackground) {
                var bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
                bgGradient.addColorStop(1, this.bgGradientColorString1);
                bgGradient.addColorStop(0, this.bgGradientColorString2);
                this.ctx.fillStyle = bgGradient;
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
            else {
                // I don't usually like getting this gross with my variable names but this was becoming nuts
                var w = this.canvas.width;
                var h = this.canvas.height;
                // draw base color
                this.ctx.fillStyle = this.bgColor;
                this.ctx.fillRect(0, 0, w, h);
                // draw bg gradient
                var bgGradient = this.ctx.createLinearGradient(w + 200 - w / 8 + sinOffset / 10, 0, 200 + w / 8 + cosOffset / 10, h);
                //bgGradient.addColorStop(1, '#111112');
                bgGradient.addColorStop(1, "hsl(" + this.bgGradientColor1.h + ", " + this.bgGradientColor1.s + "%, " + this.bgGradientColor1.l + "%)");
                bgGradient.addColorStop(0, "hsl(" + this.bgGradientColor2.h + ", " + this.bgGradientColor2.s + "%, " + this.bgGradientColor2.l + "%)");
                this.ctx.fillStyle = bgGradient;
                this.ctx.fillRect(0, 0, w, h);
                // create bezier gradient
                var bezierGradient = this.ctx.createLinearGradient(0, 0, w, h);
                bezierGradient.addColorStop(0, this.bezierColor1);
                bezierGradient.addColorStop(1, this.bezierColor2);
                this.ctx.strokeStyle = bezierGradient;
                this.ctx.globalCompositeOperation = "overlay";
                // create bezier curves
                for (var x = 0; x < 60; x++) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(-300 + cosOffset / 30, w / 3 + sinOffset);
                    this.ctx.bezierCurveTo(w / 4 - (x * 10), h / 3, h * 2 / 3 + (x * 40), (x * 40) + (cosOffset / 500), w + 50, h / 2 + cosOffset);
                    this.ctx.stroke();
                }
                this.ctx.globalCompositeOperation = "source-over";
            }
        }
        else {
            this.ctx.fillStyle = "#000";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    };
    Tetris.prototype.drawGrid = function () {
        var grid = __spreadArray([], this.well.getGrid());
        var gridWidth = grid[0].length;
        var gridHeight = grid.length;
        var gridPixWidth = ((this.blockSize + this.gridSize) * gridWidth) + this.gridSize;
        var gridPixHeight = ((this.blockSize + this.gridSize) * gridHeight) + this.gridSize;
        // center grid
        var gridX = Math.floor(this.canvas.width / 2 - gridPixWidth / 2);
        var gridY = Math.floor(this.canvas.height / 2 - gridPixHeight / 2);
        this.ctx.fillStyle = this.gridColor;
        this.ctx.globalCompositeOperation = "multiply";
        this.ctx.filter = 'blur(2px)';
        // draw grid bg
        this.ctx.fillRect(gridX, gridY, gridPixWidth, gridPixHeight);
        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.filter = 'none';
        // get positions of active piece and that freaky ghost piece
        var piecePos = this.activePiece === null ? null : this.activePiece.getPos();
        var ghostPos = this.ghostPiece === null ? null : this.ghostPiece.getPos();
        // fill the blocks, rendering the active piece/that creepy ghost piece
        for (var gridPasses = 0; gridPasses < 2; gridPasses++) {
            for (var row = 0; row < gridHeight; row++) {
                for (var col = 0; col < gridWidth; col++) {
                    var blockX = gridX + this.gridSize + (col * (this.blockSize + this.gridSize));
                    var blockY = gridY + this.gridSize + (row * (this.blockSize + this.gridSize));
                    var colorOpacity = 1;
                    var mino = null;
                    var pieceLocking = false;
                    // only draw pieces on second pass
                    if (gridPasses > 0 &&
                        piecePos !== null && piecePos.includes(row + ":" + col) ||
                        ghostPos !== null && ghostPos.includes(row + ":" + col)) {
                        if (piecePos.includes(row + ":" + col)) {
                            if (this.pieceGlow) {
                                this.ctx.fillStyle = this.colorArray[Tetris.getPieceColorIndex(this.activePiece)];
                                this.ctx.filter = 'blur(5px)';
                                //this.ctx.globalCompositeOperation = "lighten";
                                this.ctx.globalAlpha = 1;
                                this.ctx.fillRect(blockX, blockY, this.blockSize, this.blockSize);
                                this.ctx.filter = 'none';
                                this.ctx.globalCompositeOperation = "source-over";
                                this.ctx.globalAlpha = 1;
                            }
                            pieceLocking = piecePos.includes(row + ":" + col) ? this.activePiece.getLockPercentage() > 0 : false;
                            mino = this.renderedMinos[this.activePiece.pieceType];
                        }
                        else if (ghostPos.includes(row + ":" + col)) {
                            this.ctx.fillStyle = this.colorArray[0];
                            this.ctx.fillRect(blockX, blockY, this.blockSize, this.blockSize);
                            colorOpacity = this.ghostPieceOpacity / 255;
                            mino = this.renderedMinos[this.ghostPiece.pieceType];
                        }
                    }
                    else {
                        if (grid[row][col] === 0) {
                            colorOpacity = .8;
                        }
                        else {
                            mino = this.renderedMinos[Tetromino.pieceTypes[grid[row][col] - 1]];
                        }
                    }
                    this.ctx.globalAlpha = colorOpacity;
                    // render the piece or background
                    if (mino !== null) {
                        this.ctx.drawImage(mino, blockX, blockY);
                    }
                    else if (gridPasses === 0) {
                        // I suppose I don't grab the colors anymore - grid value could now be state rather than color?
                        this.ctx.fillStyle = this.colorArray[0];
                        this.ctx.fillRect(blockX, blockY, this.blockSize, this.blockSize);
                    }
                    this.ctx.globalAlpha = 1;
                    // piece lock animation
                    if (pieceLocking || this.well.getRowsClearing().includes(row)) {
                        var overlayOpacity = pieceLocking ? this.activePiece.getLockPercentage() / 100
                            : this.well.getClearAlpha();
                        // this.ctx.fillStyle = `rgba(255,255,255,${this.activePiece.getLockPercentage() / 100})`;
                        this.ctx.fillStyle = "rgba(255,255,255," + overlayOpacity + ")";
                        this.ctx.fillRect(blockX, blockY, this.blockSize, this.blockSize);
                    }
                }
            }
        }
        this.ctx.globalAlpha = .8;
        this.ctx.strokeStyle = this.borderColor;
        this.ctx.strokeRect(gridX - 1, gridY - 1, gridPixWidth + 1, gridPixHeight + 1);
        this.ctx.globalAlpha = 1;
    };
    Tetris.prototype.drawUI = function (sinOffset, cosOffset) {
        if (!this.gameOver) {
            var cvw = this.cvWidths;
            var cvh = this.cvHeights;
            this.ctx.fillStyle = this.fontColor;
            this.ctx.font = window.devicePixelRatio + "em \"" + this.gameFont + "\"";
            var yOffset = Math.floor(3 * Math.cos(Date.now() / 600));
            // UI boxes
            // right box
            var rBoxWidth = cvw.c6;
            var rBoxHeight = Math.floor(((this.blockSize + this.gridSize) * this.well.getGrid().length) + this.gridSize);
            var rBoxX = Math.floor(cvw.c1 - 1.85 * (cvw.c4 - cvw.c12));
            var rBoxY = (cvh.c2 - (Math.floor(rBoxHeight / 2)));
            // upper-left box - ulBoxX is still a little too strange for my liking but whatever
            var ulBoxWidth = rBoxWidth;
            var ulBoxHeight = Math.floor((rBoxHeight - this.blockSize) / 3);
            var ulBoxX = (this.canvas.width / 4.5 - (ulBoxWidth / 2));
            var ulBoxY = (cvh.c2 - (rBoxHeight / 2));
            // bottom-left
            var blBoxWidth = rBoxWidth;
            var blBoxHeight = ulBoxHeight * 2;
            var blBoxX = ulBoxX;
            var blBoxY = ulBoxY + ulBoxHeight + this.blockSize;
            // fill box backgrounds
            this.ctx.fillStyle = this.gridColor;
            this.ctx.filter = 'blur(5px)';
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.fillRect(rBoxX, rBoxY, rBoxWidth, rBoxHeight);
            this.ctx.fillRect(ulBoxX, ulBoxY, ulBoxWidth, ulBoxHeight);
            this.ctx.fillRect(blBoxX, blBoxY, blBoxWidth, blBoxHeight);
            // fill box main layers
            this.ctx.fillStyle = this.bgColor;
            this.ctx.filter = 'none';
            this.ctx.globalAlpha = .6;
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.fillRect(rBoxX, rBoxY, rBoxWidth, rBoxHeight);
            this.ctx.fillRect(ulBoxX, ulBoxY, ulBoxWidth, ulBoxHeight);
            this.ctx.fillRect(blBoxX, blBoxY, blBoxWidth, blBoxHeight);
            // stroke box borders
            this.ctx.strokeStyle = this.borderColor;
            this.ctx.strokeRect(rBoxX, rBoxY, rBoxWidth, rBoxHeight);
            this.ctx.strokeRect(ulBoxX, ulBoxY, ulBoxWidth, ulBoxHeight);
            this.ctx.strokeRect(blBoxX, blBoxY, blBoxWidth, blBoxHeight);
            this.ctx.globalAlpha = 1;
            // render text
            this.ctx.fillStyle = this.borderColor;
            this.ctx.font = 1.4 * window.devicePixelRatio + "em \"" + this.gameFont + "\"";
            var lBoxTextX = ulBoxX + (ulBoxWidth / 2);
            var ulBoxTextY = ulBoxY + (rBoxHeight / 12);
            var blTextOffset = Math.floor(rBoxHeight / 24);
            var blBoxTextY = blBoxY + (blTextOffset * 2);
            var mins = Math.floor((this.elapsedTime / 1000) / 60).toString().padStart(2, '0');
            var secs = Math.floor((this.elapsedTime / 1000) % 60).toString().padStart(2, '0');
            // render twice, once with background
            // TODO: Remove double render code? Seems to give bad performance for minimal gain
            for (var i = 1; i < 2; i++) {
                if (i == 0) {
                    this.ctx.fillStyle = this.bgColor;
                    this.ctx.filter = 'blur(2px)';
                    this.ctx.globalCompositeOperation = "overlay";
                }
                else {
                    this.ctx.fillStyle =
                        "hsl(" + this.bgGradientColor2.h + ", " + this.bgGradientColor2.s + "%, " + (this.bgGradientColor2.l + 30) + "%)";
                    this.ctx.filter = 'none';
                    this.ctx.globalCompositeOperation = "source-over";
                }
                this.ctx.fillText("Next:", rBoxX + (rBoxWidth / 2), rBoxY + (rBoxHeight / 12));
                this.ctx.fillText("Hold:", lBoxTextX - i, ulBoxTextY - i, ulBoxWidth);
                this.ctx.fillText("Score:", lBoxTextX, blBoxTextY, blBoxWidth);
                this.ctx.fillText("Lines:", lBoxTextX, blBoxTextY + (blTextOffset * 3), blBoxWidth);
                this.ctx.fillText("Level:", lBoxTextX, blBoxTextY + (blTextOffset * 7), blBoxWidth);
                this.ctx.fillText("Time:", lBoxTextX, blBoxTextY + (blTextOffset * 11), blBoxWidth);
                this.ctx.fillStyle = i == 1 ? this.borderColor : this.ctx.fillStyle;
                // these .25s don't seem like the solution
                this.ctx.fillText("" + this.score, lBoxTextX, blBoxTextY + Math.floor((blTextOffset * 1.25)), blBoxWidth);
                this.ctx.fillText("" + this.linesCleared, lBoxTextX, blBoxTextY + Math.floor((blTextOffset * 4.25)), blBoxWidth);
                this.ctx.fillText("" + this.gameLevel, lBoxTextX, blBoxTextY + Math.floor((blTextOffset * 8.25)), blBoxWidth);
                this.ctx.fillText(mins + ":" + secs, lBoxTextX, blBoxTextY + Math.floor((blTextOffset * 12.25)), blBoxWidth);
                // draw high score
                this.ctx.fillStyle = this.bgGradientColorString1;
                this.ctx.fillText("High: " + this.highScore, cvw.c2 + 1, (cvh.c12 + cvh.c24) / 2 + 1);
                this.ctx.fillStyle = this.borderColor;
                this.ctx.fillText("High: " + this.highScore, cvw.c2, (cvh.c12 + cvh.c24) / 2);
            }
            // render held piece
            if (this.heldPiece !== null) {
                var xOffset = 2 * Math.sin(Date.now() / 400);
                var yOffset_1 = 2 * Math.cos(Date.now() / 400);
                var heldPieceCanvas = this.renderedPieces[this.heldPiece.pieceType];
                var heldPieceX = ulBoxX + (ulBoxWidth / 2 - heldPieceCanvas.width / 2);
                var heldPieceY = Math.floor(((3 * rBoxHeight) / 12) + yOffset_1);
                this.ctx.drawImage(heldPieceCanvas, heldPieceX, heldPieceY);
            }
            // render upcoming pieces
            var upcomingPieceY = (rBoxHeight / 6) + (rBoxHeight / 12);
            for (var _i = 0, _a = this.upcomingPieces; _i < _a.length; _i++) {
                var piece = _a[_i];
                var upcomingPieceCanvas = this.renderedPieces[piece];
                var upcomingPieceX = rBoxX + (rBoxWidth / 2 - upcomingPieceCanvas.width / 2);
                this.ctx.drawImage(upcomingPieceCanvas, upcomingPieceX, upcomingPieceY + yOffset);
                upcomingPieceY += rBoxHeight / 6;
            }
            // DEBUG
            // test render the minos
            if (this.renderedMinos !== null && this.testRenderMinos) {
                var yPos = 0;
                for (var _b = 0, _c = Tetromino.pieceTypes; _b < _c.length; _b++) {
                    var type = _c[_b];
                    var mino = this.renderedMinos[type];
                    this.ctx.drawImage(mino, 0, yPos);
                    yPos += mino.height;
                }
            }
        }
        else if (this.titleScreen) {
            this.drawTitle();
        }
        else {
            this.drawGameOver();
        }
    };
    Tetris.prototype.drawPause = function () {
        if (this.pauseOverlay) {
            this.drawOverlay();
            var cvw = this.cvWidths;
            var cvh = this.cvHeights;
            //this.toggleTextShadow();
            this.ctx.fillStyle = this.fontColor;
            this.ctx.font = 3.0 * window.devicePixelRatio + "em \"" + this.gameFont + "\"";
            this.ctx.globalAlpha = this.overlayOpacity / this.overlayFinalOpacity;
            this.ctx.fillText("Pause", cvw.c2, cvh.c3);
            // draw pause menu options
            this.ctx.font = 1.2 * window.devicePixelRatio + "em \"" + this.gameFont + "\"";
            for (var option = 0; option < this.pauseScreenOptions.length; option++) {
                this.ctx.fillStyle =
                    option === this.pauseScreenSelectedOption ? this.bgGradientColorString2 : this.fontColor;
                this.ctx.fillText(this.pauseScreenOptions[option], cvw.c2, cvh.c2 + (option * cvh.c12));
            }
            this.ctx.globalAlpha = 1;
            //this.toggleTextShadow();
        }
    };
    Tetris.prototype.drawGameOver = function () {
        this.drawOverlay();
        this.toggleTextShadow();
        this.ctx.fillStyle = this.fontColor;
        this.ctx.font = 3.0 * window.devicePixelRatio + "em \"" + this.gameFont + "\"";
        this.ctx.fillText("Game Over", this.cvWidths.c2, this.cvHeights.c3);
        this.toggleTextShadow();
    };
    Tetris.prototype.drawTitle = function () {
        var _this = this;
        // todo: Fix background animation - what's up with that stuttered jump?
        if (this.renderedBGTimer === null) {
            this.renderedBGTimer = setInterval(function () {
                _this.titleScreenPromptOpacity = (Math.cos(Date.now() / 250) + 2) / 3;
                _this.renderedBGX -= _this.renderedBGX >= _this.canvas.width * -1 + (_this.blockSize / 3) ?
                    _this.canvas.width - _this.blockSize : 0;
                //this.renderedBGX += 1;
                //this.renderedBGY += 1;
                _this.renderedBGY = _this.renderedBGY >= _this.canvas.height * -1 ?
                    _this.canvas.height * -2 : _this.renderedBGY;
            }, this.updateFrequency / 3);
        }
        this.ctx.globalAlpha = .2;
        this.ctx.drawImage(this.renderedBackground, this.renderedBGX, this.renderedBGY);
        this.ctx.globalAlpha = 1;
        var cvw = this.cvWidths;
        var cvh = this.cvHeights;
        this.toggleTextShadow();
        this.ctx.fillStyle = this.fontColor;
        this.ctx.font = 10.0 * window.devicePixelRatio + "em \"" + this.gameFont + "\"";
        this.ctx.fillText("TETRIS", cvw.c2, cvh.c3);
        this.ctx.font = window.devicePixelRatio + "em \"" + this.gameFont + "\"";
        this.ctx.globalAlpha = this.titleScreenPromptOpacity;
        this.ctx.fillText("Press Enter to Start", cvw.c2, cvh.c3 * 2);
        this.ctx.globalAlpha = 1;
        this.ctx.font = .8 * window.devicePixelRatio + "em \"" + this.gameFont + "\"";
        this.ctx.fillText("Programmed by John O'Hara in 2021", cvw.c2, cvh.c1 - cvh.c24);
        this.toggleTextShadow();
    };
    Tetris.prototype.toggleTextShadow = function () {
        this.ctx.shadowColor = this.bgGradientColorString1;
        this.ctx.shadowBlur = this.ctx.shadowBlur === 5 ? 0 : 5;
        this.ctx.shadowOffsetY = this.ctx.shadowOffsetY === 2 ? 0 : 2;
    };
    Tetris.prototype.drawOverlay = function () {
        this.ctx.globalAlpha = this.overlayOpacity;
        this.ctx.fillStyle = this.pauseColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalAlpha = 1;
    };
    // todo: use this for all state transitions, making use of this.loadOverlayLock
    //  also - what does overlayBehindTheScenesComplete mean now?
    Tetris.prototype.drawLoadOverlay = function () {
        if (this.loadOverlayOpacityTimer !== null) {
            console.log("loadOverlayOpacity: " + this.loadOverlayOpacity);
        }
        // This seems to fix the stutter bug - it was a very small negative opacity
        // that was causing it.
        if (this.loadOverlayOpacity >= 0) {
            this.ctx.globalAlpha = this.loadOverlayOpacity;
            this.ctx.globalAlpha = this.ctx.globalAlpha <= 0 ? 0 : this.ctx.globalAlpha;
            this.ctx.globalAlpha = this.ctx.globalAlpha >= 1 ? 1 : this.ctx.globalAlpha;
            this.ctx.fillStyle = this.pauseColor; // maybe customize this further?
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalAlpha = 1;
        }
    };
    Tetris.prototype.fadeOverlayToBlack = function () {
        var _this = this;
        if (this.loadOverlayOpacityTimer === null) {
            this.loadOverlayFadeUp = true;
            this.loadOverlayLock = true;
            this.overlayBehindTheScenesComplete = false;
            this.loadOverlayOpacityTimer = setInterval(function (transition) {
                _this.loadOverlayFadeUp = _this.loadOverlayOpacity >= 1 ? false : _this.loadOverlayFadeUp;
                if (_this.loadOverlayFadeUp) {
                    _this.loadOverlayOpacity += .05;
                }
                else if (_this.overlayBehindTheScenesComplete) {
                    if (_this.loadOverlayOpacity <= 0) {
                        clearInterval(_this.loadOverlayOpacityTimer);
                        _this.loadOverlayOpacityTimer = null;
                        _this.loadOverlayOpacity = 0;
                    }
                    else {
                        _this.loadOverlayOpacity -= .05;
                    }
                }
            }, this.updateFrequency);
        }
    };
    Tetris.prototype.quitToTitle = function (quickRestart) {
        var _this = this;
        if (quickRestart === void 0) { quickRestart = false; }
        if (!quickRestart) {
            this.pause();
        }
        this.fadeOverlayToBlack();
        if (this.titleScreenTransitionTimer === null) {
            this.titleScreenTransitionTimer = setInterval(function () {
                if (!_this.loadOverlayFadeUp) {
                    console.log("Reached final quitToTitle state");
                    // transition to title
                    //this.endGame(true);
                    _this.endGame(!quickRestart, quickRestart);
                    _this.overlayBehindTheScenesComplete = true;
                    clearInterval(_this.titleScreenTransitionTimer);
                    _this.titleScreenTransitionTimer = null;
                }
            }, this.updateFrequency);
        }
    };
    Tetris.prototype.restartGame = function () {
        //this.pause();
        //this.endGame(false, true);
        this.quitToTitle(true);
    };
    Tetris.renderMinos = function (pieceType, canvas, blockSize, color) {
        if (!Tetromino.pieceTypes.includes(pieceType)) {
            throw new Error("renderMinos was not given a valid piece type!");
        }
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, blockSize, blockSize);
        var blockCenter = Math.floor(blockSize / 2);
        var colorGradient = ctx.createRadialGradient(blockCenter, blockCenter, 1, blockCenter, blockCenter, blockSize);
        colorGradient.addColorStop(0, 'rgba(200,200,200,.75)');
        colorGradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = colorGradient;
        ctx.globalCompositeOperation = "multiply";
        ctx.fillRect(0, 0, blockSize, blockSize);
        ctx.globalCompositeOperation = "source-over";
        var shineGradient = ctx.createLinearGradient(2, 2, blockSize - 4, blockSize - 4);
        shineGradient.addColorStop(0, 'rgba(255,255,255,0.4)');
        shineGradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
        shineGradient.addColorStop(.5, "rgba(64,64,64,0)");
        ctx.fillStyle = shineGradient;
        ctx.fillRect(2, 2, blockSize - 4, blockSize - 4);
        ctx.strokeStyle = "#fff";
        ctx.globalCompositeOperation = "lighten";
        ctx.strokeRect(0, 0, blockSize, blockSize);
        ctx.globalCompositeOperation = "source-over";
    };
    // used to render a piece for display only (next piece queue, held piece)
    Tetris.renderCosmeticPiece = function (pieceType, canvas, mino, blockSize, gridSize) {
        if (!Tetromino.pieceTypes.includes(pieceType)) {
            throw new Error("renderCosmeticPiece was not given a valid piece type!");
        }
        var ctx = canvas.getContext('2d');
        for (var i = 0; i < 4; i++) {
            var blockCoords = Tetromino.startPositions[pieceType][i].split(":")
                .map(function (x) { return parseInt(x); });
            var xPos = gridSize + ((blockCoords[1] - 3) * (blockSize + gridSize));
            var yPos = gridSize + (blockCoords[0] * (blockSize + gridSize));
            ctx.drawImage(mino, xPos, yPos);
        }
    };
    Tetris.getPieceColorIndex = function (piece) {
        if (piece == null) {
            return 0;
        }
        return Tetromino.pieceTypes.indexOf(piece.pieceType) + 1;
    };
    Tetris.newPieceBag = function () {
        var pieceBag = __spreadArray([], Tetromino.pieceTypes);
        for (var i = 0; i < 7; i++) {
            var randIndex = Math.floor(Math.random() * (7 - i));
            if (randIndex != i) {
                var temp = pieceBag[i];
                pieceBag[i] = pieceBag[randIndex];
                pieceBag[randIndex] = temp;
            }
        }
        return pieceBag;
    };
    // GAMEPAD STUFF ONLY WRITTEN FOR CHROME AT THE MOMENT
    //  there's probably a better way to map these
    Tetris.gamepadMap = {
        0: "ArrowUp",
        1: "e",
        4: "f",
        5: "f",
        8: "Enter",
        9: "Escape",
        12: " ",
        13: "ArrowDown",
        14: "ArrowLeft",
        15: "ArrowRight"
    };
    return Tetris;
}());
var game;
window.addEventListener('load', function (event) {
    game = new Tetris();
    document.getElementById("build-timestamp").innerText = document.lastModified;
});
