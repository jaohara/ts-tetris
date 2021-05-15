// TETRIS.TS - THE SOVIET MIND GAME

/**
 * Tetromino - A class used to represent a game piece.
 *
 * Generally only instantiated twice, stored as "Tetris.activeGamepiece" and "Tetris.ghostPiece".
 * Contains instance methods for movement, rotation, hard drops.
 *
 * Contains static members for data about piece types, initial piece locations,
 * and rotation transform instructions.
 */
class Tetromino {
    static readonly pieceTypes = ['I', 'J', 'L', 'O', 'S', 'T', 'Z']

    static readonly startPositions = {
        'I': ['0:3','0:4','0:5','0:6'],
        'J': ['0:3','1:3','1:4','1:5'],
        'L': ['0:5','1:3','1:4','1:5'],
        'O': ['0:4','0:5','1:4','1:5'],
        'S': ['0:4','0:5','1:3','1:4'],
        'T': ['0:4','1:3','1:4','1:5'],
        'Z': ['0:3','0:4','1:4','1:5'],
    }

    // this is madness - don't think about it too much!
    // state transitions:
    // 1 -> 2, 2 -> 3, 3 -> 4, 4 -> 1
    private static readonly rotationTransforms = {
        'I': [
            ['2:-1', '1:0', '0:1', '-1:2'],    //  a
            ['1:2', '0:1', '-1:0', '-2:-1'],   //  b
            ['-2:1', '-1:0', '0:-1', '1:-2'],  // -a
            ['-1:-2', '0:-1', '1:0', '2:1'],   // -b
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
        'O': [  // I guess these are arbitrary
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
    }

    private readonly ghost: Tetromino;
    private readonly game: Tetris;
    private readonly well: Well;

    readonly isGhost: boolean;
    readonly pieceType;

    private floorKicked: boolean = false;
    gravity: ReturnType<typeof setTimeout> = null;
    private lockDelay: ReturnType<typeof setTimeout> = null;
    private lockPercentage: number;
    moveQueue: MoveQueue;
    moveLock: boolean;
    private pos: string[];
    private rotation = [0, 1, 2, 3];

    constructor(pieceType: string, game: Tetris, well: Well, isGhost: boolean = false, pos: string[] = null) {
        if (Tetromino.pieceTypes.includes(pieceType)){
            this.game = game;
            this.isGhost = isGhost;
            this.lockPercentage = 0;
            this.moveLock = false;
            this.moveQueue = new MoveQueue();
            this.pieceType = pieceType;
            this.pos  = isGhost ? pos : Tetromino.startPositions[pieceType];
            this.well = well;

            let validSpawn = true;
            for (let position of this.pos){
                validSpawn = this.checkValidMove(position.split(":").map(x => parseInt(x)));
            }

            if (!validSpawn){
                this.game.endGame();
            }

            if (!isGhost) {
                this.ghost = new Tetromino(this.pieceType, this.game, this.well, true, this.pos);
            } else {
                this.hardDrop();
            }
        }
    }

    private static lockDelayTimer(piece: Tetromino) {
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
            piece.lockPercentage += 100/30;
        }
    }

    removeLockDelay(): void {
        //console.log("Removing lock delay...");
        clearInterval(this.lockDelay);
        this.lockDelay = null;
        this.lockPercentage = 0;
        //console.log(`Removed delay on ${this}`);
    }

    getGhost(): Tetromino {
        return this.ghost;
    }

    getLockPercentage(): number {
        return this.lockPercentage;
    }

    hardDrop() {
        if (this.lockPercentage == 0) {
            let keepDroppin = true;
            let dropScore = 0;

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
    }

    rotate(direction: string): boolean{
        let transform: string[]
        let validMove = true;
        let newPos = [];

        if (direction === "right") {
            transform = Tetromino.rotationTransforms[this.pieceType][this.rotation[0]];
            this.rotation.push(this.rotation.shift());
        } else {
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
        let rotationsAttempted = !this.floorKicked ? 4 : 3;
        let kicksAttempted = this.pieceType === "I" ? 4 : 3;
        let rotationFound = false;
        console.log(`Starting rotations: rotationsAttempted = ${rotationsAttempted}, kicksAttempted = ${kicksAttempted}`);

        for (let rotation = 0; rotation < rotationsAttempted && !rotationFound; rotation++) {
            let xKick = rotation === 1 ? 1 : 0;
            let yKick = rotation === 3 ? -1 : 0;
            xKick = rotation === 2 ? -1 : xKick;

            console.log(`\trotation: ${rotation} - xKick, yKick = ${xKick}, ${yKick}`)

            for (let kick = 1; kick < kicksAttempted && !rotationFound; kick++) {
                // is this it?
                newPos = [];
                validMove = true;
                console.log(`\t\tkick attempt ${kick}...`);

                for (let i = 0; i < transform.length && validMove; i++) {
                    console.log(`\t\ttransform ${i}...`);

                    // for rotation transforms, [0] is x, [1] is y (column, row)
                    let blockRotation = transform[i].split(":").map(x => parseInt(x));
                    // remember - here [0] is y, [1] is x (row, column)
                    let currentPos = this.pos[i].split(":").map(x => parseInt(x));

                    currentPos[1] += xKick * kick;
                    currentPos[0] += yKick * kick;


                    currentPos[1] += direction === "right" ? blockRotation[0] : blockRotation[0] * -1;
                    currentPos[0] += direction === "right" ? blockRotation[1] : blockRotation[1] * -1;

                    newPos[i] = currentPos.join(":");

                    validMove = this.checkValidMove(currentPos);

                    console.log(`\t\t\tvalidMove = ${validMove}`);
                }

                rotationFound = validMove;
                this.floorKicked = this.floorKicked || rotation === 3 && validMove;
            }
        }

        if (validMove === true) {
            this.pos = newPos;

            // reset lock delay
            if (this.lockPercentage > 0){
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
            } else {
                this.rotation.push(this.rotation.shift());
            }
        }

        this.moveLock = false;

        this.nextMove();
        return validMove;
    }

    move(direction: string): boolean {
        if (this.lockPercentage > 0 && direction === "down"){
            this.lockPercentage = 100;
            return false;
        }

        // check to see if valid move
        let validMove = true;

        if (direction === "gravity"){
            //console.log("Moving by gravity...");
        }

        // check direction and make sure it can move in a certain way
        let xDirection = direction == "down" || direction == "gravity" ? 0 : 1;
        xDirection *= direction == "left" ? -1 : 1;
        let yDirection = direction == "down" || direction == "gravity" ? 1 : 0;

        let newPos = [];

        for (let i = 0; i < this.pos.length && validMove; i++) {
            let currentPos = this.pos[i].split(":").map(x => parseInt(x));
            currentPos[0] += yDirection;
            currentPos[1] += xDirection;
            newPos[i] = currentPos.join(":");

            validMove = this.checkValidMove(currentPos)
        }

        if (validMove) {
            this.pos = newPos;

            if (!this.isGhost) {
                if (direction === "down") {
                    this.game.addScore(1);
                }

                if (direction !== "down" && this.lockPercentage > 0){
                    // reset lock delay
                    if (direction === "gravity"){
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
        else if (direction === "gravity" && !this.isGhost && this.lockPercentage == 0){
            //console.log("Non valid move on a real piece due to gravity");

            if (this.lockPercentage == 0 && this.lockDelay == null){
                this.lockDelay = setInterval(() => {Tetromino.lockDelayTimer(this)},
                    this.game.updateFrequency);
            }
        }

        this.moveLock = false;

        this.nextMove();
        return validMove;
    }

    getPos(): string[]{
        return this.pos;
    }

    setPos(pos: string[]) {
        // this should probably only be used for ghosts, resets position before casting downward
        if (this.isGhost){
            this.pos = pos;
        }
    }

    private nextMove(): void {
        if (this.moveQueue.size() > 0){
            let nextMove = this.moveQueue.dequeue().split(":");

            console.log(`Dequeued move: ${nextMove.join(":")}`);

            if (nextMove[0] == "move"){
                this.move(nextMove[1]);
            } else if (nextMove[0] == "rotate"){
                this.rotate(nextMove[1]);
            }
        }
    }

    private checkValidMove(position: number[]): boolean {
        // first one changed from 0, I think this will allow the rotation over the top...
        return  !(position[0] < -3 || position[0] >= this.well.getHeight() ||
            position[1] < 0 || position[1] >= this.well.getWidth() ||
            position[0] > 0 && this.well.getGrid()[position[0]][position[1]] != 0);
    }

    toString(): string {
        return `[Tetromino: ${this.pieceType}${this.isGhost? " - GHOST" : ""}]`;
    }
}

/**
 * MoveQueue - a simple queue implementation that Tetromino uses to store moves that
 * are requested while it is already performing a move.
 *
 * I don't really know if this is needed, at all. Originally I thought this was a
 * solution to the rotation bug - not only was it not that, but the methods never
 * even get called, implying that there's never a situation where multiple moves are
 * happening at the same time, meaning that this class doesn't really serve a purpose.
 */
class MoveQueue {
    private queue: string[] = [];

    enqueue(move: string): void {
        this.queue.push(move);
    }

    // I kinda don't like allowing it to return undefined, but I guess it makes sense
    dequeue(): string | undefined {
        return this.queue.shift();
    }

    size(): number {
        return this.queue.length;
    }
}

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
class Well {
    private game: Tetris;
    private grid: number[][] = [];
    private readonly height = 20;
    private readonly width = 10;

    private clearAlpha: number = 0;
    private clearAnimationInterval: ReturnType<typeof setInterval> = null;
    private clearAnimationCompleting: boolean = false;
    private readonly clearDelay = 30; // in ms
    private rowsClearing: number[] = [];
    private rowsCleared: number[] = [];

    constructor(game: Tetris){
        this.game = game;
        this.resetWell();
    }

    resetWell(): void {
        for (let row = 0; row < this.height; row++){
            this.grid[row] = [];

            for (let col = 0; col < this.width; col++){
                this.grid[row].push(0);
            }
        }
    }

    getGrid(): number[][] {
        return this.grid;
    }

    getRowsClearing(): number[] {
        return this.rowsClearing;
    }

    getClearAlpha(): number {
        return this.clearAlpha;
    }

    getHeight(): number {
        return this.grid.length;
    }

    getWidth(): number {
        return this.grid[0].length;
    }

    clearLines() {
        this.game.setSpawnLock(true);
        // todo: set

        if (this.clearAnimationInterval === null) {
            //console.log("clearLines has been called");
            //console.log("\tNo animation, checking rows....")
            //for (let row = this.getHeight() - 1; row > 0; row--) {
            for (let row = 0; row < this.getHeight(); row++) {
                if (!this.grid[row].includes(0)) {
                    console.log(`\t\tFound a row to clear! - row ${row}`)
                    this.rowsClearing.push(row);
                }
            }
        }

        if (this.rowsClearing.length > 0) {
            if (this.clearAnimationInterval === null) {
                console.log("\tRows found with no existing animation...")
                console.log(`\t\tRows clearing: ${this.rowsClearing}`);
                console.log(`\t\tRows cleared: ${this.rowsCleared}`);
                this.clearAnimationInterval = setInterval(() => {
                    //console.log("\tclearAnimationInterval is running...");
                    if (this.clearAlpha < 1.0) {
                        // ten frames to white? twenty?
                        this.clearAlpha += .1;
                    } else {
                        // probably going to need another "else if" for the next animation step if I want one
                        if (!this.clearAnimationCompleting) {
                            console.log("\tFINAL STATE - clearAnimationInterval");
                            this.clearAnimationCompleting = true;
                            clearInterval(this.clearAnimationInterval);
                            this.clearAnimationInterval = null;

                            //this.rowsClearing.sort((a, b) => a - b);


                            for (let row of this.rowsClearing) {
                                if (!this.rowsCleared.includes(row)) {
                                    console.log(`Clearing Row ${row}...`);
                                    this.rowsCleared.push(row);
                                    this.game.lineClear();
                                    this.grid.splice(row, 1);
                                    let replacementRow = [];

                                    for (let col = 0; col < this.width; col++) {
                                        replacementRow.push(0);
                                    }

                                    this.grid.unshift(replacementRow);
                                }
                            }

                            // handle scoring
                            let lineScore = (200 * this.rowsClearing.length);
                            lineScore -= this.rowsClearing.length < 4 ? 100 : 0;
                            lineScore *= this.game.getLevel();

                            let scoreMessage: string;

                            // todo: This can be more terse, right?
                            if (this.rowsClearing.length < 4 && this.rowsClearing.length > 0) {
                                scoreMessage = `LINE CLEAR x${this.rowsClearing.length}`;
                            }
                            else {
                                scoreMessage = "TETRIS! ";
                            }

                            scoreMessage += ` +${lineScore}`;

                            this.game.addMessage(scoreMessage, this.rowsClearing.length === 4);

                            console.log(`linesCleared: ${this.rowsClearing.length} - lineScore: ${lineScore}`);

                            // reset the row clear animation
                            this.clearAnimationCompleting = false;
                            this.rowsClearing = [];
                            this.rowsCleared = [];
                            this.clearAlpha = 0;

                            this.game.addScore(lineScore);

                            this.game.setSpawnLock(false);
                        }
                    }
                }, this.game.updateFrequency);
            }
        }
        else {
            this.game.setSpawnLock(false);
        }
    }

    lockPiece(piece: Tetromino):void {
        let positions = piece.getPos();
        let colorNumber = Tetromino.pieceTypes.indexOf(piece.pieceType) + 1;

        for (let pos of positions){
            let blockRowCol = pos.split(":").map((x) => parseInt(x));

            this.grid[blockRowCol[0]][blockRowCol[1]] = colorNumber;
        }

        this.game.lockActivePiece();
    }
}

interface ScoreMessage {
    ascentFrames: number;
    borderColors?: number[];
    fadeFrames: number;
    flashFrames: number;
    message: string;
    opacity: number;
    prettyBorder: boolean;
}

/**
 * ScoreMessenger - a class used to represent an object that handles the lifecycle of dynamic
 * score messages.
 */
class ScoreMessenger {
    private readonly canvasCenter: number;
    private readonly colorArray: string[];
    private readonly ctx: CanvasRenderingContext2D;
    private readonly font: string;
    private messageColor: string;
    private messages: ScoreMessage[] = [];
    private targetLocation: number;

    constructor(ctx: CanvasRenderingContext2D, targetLocation: number, canvasCenter: number,
                colorArray: string[], font: string = "Righteous", messageColor: string = "#bbb") {
        this.canvasCenter   = canvasCenter;
        this.colorArray     = colorArray;
        this.ctx            = ctx;
        this.font           = font;
        this.targetLocation = targetLocation;
        this.messageColor   = messageColor;
    }

    addMessage(message: string, prettyBorder: boolean = false) {
        // should I have these be more customizable?
        let newMessage: ScoreMessage = {
            ascentFrames: 40,
            borderColors: [1,2,3,4,5,6,7],
            fadeFrames: 30,
            flashFrames: 30,
            message: message.toUpperCase(),
            opacity: 0,
            prettyBorder: prettyBorder
        }

        this.messages.push(newMessage);
    }

    drawMessages() {
        if (this.messages.length > 0) {
            //let previousFont = this.ctx.font;
            //this.ctx.font = `${.6 * window.devicePixelRatio}em bold "${this.font}"`;
            this.ctx.font = `${1.2 * window.devicePixelRatio}em "${this.font}"`;
            console.log(this.ctx.font);
            let finishedMessages: number[] = [];

            for (let messageIndex in this.messages) {
                let message = this.messages[messageIndex];
                let evenFrame = (message.flashFrames + message.ascentFrames) % 2 === 0;


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
                        this.ctx.fillText(message.message, this.canvasCenter + 1,
                            this.targetLocation + (message.ascentFrames * 3) + 1);
                    }

                    if (evenFrame) {
                        message.borderColors.push(message.borderColors.shift());
                    }
                }

                if (message.ascentFrames > 0 || evenFrame) {
                    this.ctx.fillStyle = this.messageColor;
                    this.ctx.fillText(message.message, this.canvasCenter,
                        this.targetLocation + (message.ascentFrames * 3));
                    this.ctx.globalAlpha = 1;
                }

                message.ascentFrames -= message.ascentFrames > 0 ? 1 : 0;
                message.flashFrames  -= message.flashFrames > 0 && message.ascentFrames === 0 ? 1 : 0;

                if (message.ascentFrames + message.flashFrames === 0) {
                    finishedMessages.push(parseInt(messageIndex));
                }
            }

            if (finishedMessages.length > 0) {
                this.pruneMessages(finishedMessages);
            }

            //this.ctx.font = previousFont;
        }
    }

    clearMessages() {
        this.messages = [];
    }

    private pruneMessages(messageIndices: number[] = []) {
        if (messageIndices.length > 0) {
            for (let index of messageIndices) {
                this.messages.splice(index, 1);
            }
        }
    }
}

/**
 * CanvasDimensions - an interface to define an object to store commonly needed fractions
 *  of a canvas size
 */
interface CanvasDimensions {
    c1?: number;
    c2?: number;
    c3?: number;
    c4?: number;
    c6?: number;
    c8?: number;
    c12?: number;
    c24?: number;
}

/**
 * Tetris - A class used to represent the game state and pieces that comprise it.
 */
class Tetris {
    // canvas and rendering ctx
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private gamepad: Gamepad = null;
    private gamepadLastFrame: Gamepad = null;
    private readonly messenger: ScoreMessenger;
    private readonly well: Well;

    // Object to store commonly needed pixel locations and dimensions
    readonly cvLocations = [1,2,3,4,6,8,12,24];
    readonly cvHeights: CanvasDimensions;
    readonly cvWidths: CanvasDimensions;

    // Objects to store individual pre-rendered minos (blocks) and full pre-rendered pieces
    private readonly renderedBackground: HTMLCanvasElement;
    private renderedBGX: number;
    private renderedBGY: number;
    private renderedBGTimer: ReturnType<typeof setTimeout> = null;
    private renderedMinos: Object = {
        "I": HTMLCanvasElement,
        "J": HTMLCanvasElement,
        "L": HTMLCanvasElement,
        "O": HTMLCanvasElement,
        "S": HTMLCanvasElement,
        "T": HTMLCanvasElement,
        "Z": HTMLCanvasElement
    };
    private renderedPieces: Object = {
        "I": HTMLCanvasElement,
        "J": HTMLCanvasElement,
        "L": HTMLCanvasElement,
        "O": HTMLCanvasElement,
        "S": HTMLCanvasElement,
        "T": HTMLCanvasElement,
        "Z": HTMLCanvasElement
    };

    // game settings
    // private readonly blockSize = 24;
    private readonly blockSize: number;
    private readonly frameRate = 60;
    private readonly gameSpeed = [
        0, 0.01667, 0.021217, 0.026977, 0.035256, 0.04693, 0.06361, 0.0879,
        (0.1312-.0076), 0.1775, 0.2598, 0.388, 0.59, 0.92, 1.46, 2.36
    ]; // all cops means all cops
    private readonly ghostPieceOpacity = 48;    // 0-255
    private readonly gridSize = 1;
    readonly updateFrequency = 1000 / this.frameRate;

    private readonly controls = [
        "ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "f", "Escape", "p", "Tab",
        "e", "n", "Enter"
    ];

    private readonly debugControls = ["0", "9", "8", "7", "6", "5", "PageUp", "PageDown"];

    // GAMEPAD STUFF ONLY WRITTEN FOR CHROME AT THE MOMENT
    //  there's probably a better way to map these
    private static readonly gamepadMap = {
        0: "ArrowUp",
        1: "e",
        4: "f",
        5: "f",
        8: "Enter", // temporary
        9: "Escape", // but also enter?
        12: " ",
        13: "ArrowDown",
        14: "ArrowLeft",
        15: "ArrowRight",
    };

    // game state
    private activePiece: Tetromino = null;
    autorepeatFrameLock: number = 0;
    private elapsedTime: number;
    private gameLoop: ReturnType<typeof setTimeout>;
    private gameOver: boolean = true;
    private gamepadConnected: boolean = false;
    private gamepadIndex: number = null;
    private gameLevel: number;
    private ghostPiece: Tetromino = null;
    private heldPiece: Tetromino = null;
    private highScore: number;
    private holdLock: boolean = false;
    private lastFrameAction: string;
    private linesCleared: number;
    private paused: boolean;
    private pieceBag: string[] = [];
    private pieceBagBackup: string[] = [];
    private upcomingPieces: string[];
    private previousLoopTime: number;
    private running: boolean;
    private score: number;
    private spawnLock: boolean = false;
    private titleScreen: boolean = true;

    // menu stuff
    private optionOptions       = [];
    private optionSelectedOption: number = 0;
    private pauseScreenOptions  = ["Resume", "Restart", "Options", "Quit"];
    private pauseScreenSelectedOption: number = 0;
    private startOptions        = ["Classic", "Endless", "Sprint"];
    private titleScreenEnterPressed = false;
    private titleScreenOptions  = ["Start", "Options"]
    private titleScreenPromptOpacity: number;
    private titleScreenSelectedOption: number = 0;
    private titleScreenTransitionTimer: ReturnType<typeof setTimeout> = null;

    // graphics stuff
    /*
        COLOR ARRAY ORDER:        I, J, L, O, S, T, Z

        First is a reference to the bgColor so it's at index 0
        lt blue, darkblue, orange, yellow, green, purple, red
     */
    private readonly bgColor        = '#1b1d24';
    // private bgGradientColor1        = {'h': 240, 's': 69, 'l': 13};
    private bgGradientColor1        = {'h': 201, 's': 77, 'l': 32};
    private bgGradientColor2        = {'h': 177, 's': 84, 'l': 36};
    private bgGradientColorString1  = 'hsl(201,77%,32%)';
    private bgGradientColorString2  = 'hsl(177, 84%, 36%)';
    private bgGradientTarget1       = 201;
    private bgGradientTarget2       = 177;
    private bgGradientTimer: ReturnType<typeof setInterval> = null;
    private readonly bezierColor1   = '#3498db';
    private readonly bezierColor2   = '#68e4b6';
    private readonly borderColor    = '#bbb';
    private readonly pauseColor     = '#000';
    // private readonly gameFont       = 'Poppins';
    private readonly gameFont       = 'Righteous';
    private loadOverlayOpacityTimer: ReturnType<typeof setInterval> = null;
    private loadOverlayFadeUp: boolean;
    private loadOverlayLock         = false;
    private loadOverlayOpacity      = 0;
    private overlayBehindTheScenesComplete: boolean = false;
    private overlayFinalOpacity     = .6; // 0-1.0
    private overlayOpacity          = 0;
    private overlayOpacityTimer: ReturnType<typeof setInterval> = null;
    private pauseOverlay: boolean;
    private readonly fontColor      = '#bbb';
    private readonly gridColor      = '#9b9ba9';
    private readonly colorArray     = [
        '#1b1d24', '#3498db', '#273ac5', '#e97e03',
        '#edcc30', '#13be3d', '#b84cd8', '#ec334d'];

    // graphics/debug options
    private noGravity: boolean = false;
    private noBackground: boolean = false;
    private pieceGlow: boolean = false;     // todo: make this more performant so it can be on by default
    private simpleBackground: boolean = true;
    private testRenderMinos: boolean = false;

    constructor() {
        // setup canvas with proper scaling
        this.canvas                 = document.getElementById("main-canvas") as HTMLCanvasElement;
        let width                   = this.canvas.width;
        let height                  = this.canvas.height;
        this.canvas.style.width     = width + "px";
        this.canvas.style.height    = height + "px";
        this.canvas.width           *= window.devicePixelRatio;
        this.canvas.height          *= window.devicePixelRatio;

        // setup common canvas locations
        this.cvHeights = {};
        this.cvWidths = {};

        for (let divisor of this.cvLocations){
            this.cvHeights[`c${divisor}`] = Math.floor(this.canvas.height / divisor);
            this.cvWidths[`c${divisor}`] = Math.floor(this.canvas.width / divisor);
        }

        // get and scale canvas
        this.ctx                        = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled  = false;
        this.ctx.textAlign              = "center";
        //this.ctx.scale(window.devicePixelRatio, devicePixelRatio);

        this.blockSize  = Math.floor(this.canvas.height / 25);
        this.well       = new Well(this);

        // pre-render minos and pieces
        for (let pieceType of Tetromino.pieceTypes){
            this.renderedMinos[pieceType] = document.createElement("canvas");
            this.renderedMinos[pieceType].height = this.blockSize;
            this.renderedMinos[pieceType].width = this.blockSize;

            Tetris.renderMinos(pieceType, this.renderedMinos[pieceType], this.blockSize,
                this.colorArray[Tetromino.pieceTypes.indexOf(pieceType) + 1]);

            this.renderedPieces[pieceType] = document.createElement("canvas");

            if (pieceType === "I"){
                this.renderedPieces[pieceType].width = (4 * (this.blockSize+this.gridSize));
                this.renderedPieces[pieceType].height = this.blockSize + this.gridSize;
            }
            else if (pieceType === "O"){
                this.renderedPieces[pieceType].width = (4 * (this.blockSize+this.gridSize));
                this.renderedPieces[pieceType].height = (2 * (this.blockSize+this.gridSize));
            }
            else {
                this.renderedPieces[pieceType].width = (3 * (this.blockSize+this.gridSize));
                this.renderedPieces[pieceType].height = (2 * (this.blockSize+this.gridSize));
            }

            Tetris.renderCosmeticPiece(pieceType, this.renderedPieces[pieceType],
                this.renderedMinos[pieceType], this.blockSize, this.gridSize);
        }

        // render background texture?
        this.renderedBackground = document.createElement("canvas");
        this.renderedBackground.width = this.canvas.width * 3;
        this.renderedBackground.height = this.canvas.height * 3;
        let bgCtx = this.renderedBackground.getContext('2d');
        bgCtx.rotate(Math.PI/8);
        let pieceArray = ['I', 'J', 'L', 'O', 'S', 'T', 'Z']

        for (let row = 0; row < Math.floor(this.renderedBackground.height/(this.blockSize*4)); row++) {
            console.log(`Row number ${row}`);

            for (let col = 0; col < Math.floor(this.renderedBackground.width/(this.blockSize*4)); col++) {
                console.log(`\tCol number ${col}`);
                let currentPiece = pieceArray.shift();
                pieceArray.push(currentPiece);

                bgCtx.drawImage(this.renderedPieces[currentPiece], col * (this.blockSize * 5),
                    row * (this.blockSize * 5));
            }
        }

        //bgCtx.restore();

        // configure title screen animation
        this.renderedBGX = this.canvas.width * -2;
        this.renderedBGY = this.canvas.height * -2;

        // todo: get high score from wherever it has been saved?
        let localHighScore = localStorage.getItem("highScore");

        this.highScore = localHighScore !== null ? parseInt(localHighScore) : 16000;

        // setup ScoreMessenger
        this.messenger = new ScoreMessenger(this.ctx, this.cvHeights.c3, this.cvWidths.c2, this.colorArray);

        this.start();
    }

    start(): void {
        if (!this.running) {
            this.running = true;

            // add controls
            document.addEventListener("keydown", Tetris.pollInput);
            document.addEventListener("keyup", Tetris.clearLastFrameAction);
            window.addEventListener("gamepadconnected", (e) => Tetris.setupGamepad(e,true));
            window.addEventListener("gamepaddisconnected", (e) => Tetris.setupGamepad(e, false));

            //this.newGame();

            // MAIN GAME LOOP
            this.gameLoop = setInterval(() => {

                if (this.titleScreen){
                    // title screen state
                    this.drawTitle();
                }
                else if (this.gameOver) {
                    // game over state
                    //this.updateHighScore(true);
                    this.drawGameOver();
                }
                else {
                    // in-game state

                    // update loop timer
                    if (!this.paused) {
                        this.previousLoopTime = isNaN(this.previousLoopTime) ? Date.now() : this.previousLoopTime;
                        this.elapsedTime += Date.now() - this.previousLoopTime;
                    }
                    this.previousLoopTime = Date.now();

                    // check for gamepad input
                    if (this.gamepadConnected) {
                        Tetris.pollGamepad();
                    }

                    // DEBUG: report state current locking piece if it exists
                    if (this.activePiece !== null && this.activePiece.getLockPercentage() > 0) {
                        console.log(`activePiece locking: ${this.activePiece.getLockPercentage()}%`);
                    }

                    if (!this.titleScreen && !this.paused && !this.gameOver) {
                        // check for levelup
                        if (Math.floor(this.linesCleared / 10) + 1 > this.gameLevel && this.gameLevel < 15) {
                            this.gameLevel++;

                            // stagger message so it isn't simultaneous with line clear
                            setTimeout(() => {
                                this.addMessage(`Level Up! ${this.gameLevel}`);
                            }, 300)

                            if (this.activePiece !== null) {
                                clearInterval(this.activePiece.gravity);
                                this.activePiece.gravity = null;
                            }
                        }

                        // check if backup piece bag is exhausted
                        if (this.pieceBagBackup.length <= 0) {
                            this.pieceBagBackup = Tetris.newPieceBag();
                        }

                        // check if piece bag is exhausted, swap in backup if it is
                        if (this.pieceBag.length <= 0) {
                            this.pieceBag = this.pieceBagBackup;
                            this.pieceBagBackup = [];
                        }

                        // clear lines that need to be cleared
                        if (this.activePiece == null) {
                            this.well.clearLines();
                        }

                        // create new piece if one doesn't exist
                        if (this.activePiece == null && !this.spawnLock) {
                            this.newPiece();
                        }

                        // give the active piece gravity if it doesn't have it
                        if (this.activePiece !== null && this.activePiece.gravity === null) {
                            this.activePiece.gravity = setInterval(() => {
                                if (!this.paused && !this.noGravity) {
                                    if (!this.activePiece.moveLock) {
                                        let falling = this.activePiece.move("gravity");

                                        if (!falling) {
                                            //this.well.lockPiece(this.activePiece);
                                        }
                                    } else {
                                        this.activePiece.moveQueue.enqueue(`move:gravity`);
                                    }
                                }
                            }, (this.updateFrequency / this.gameSpeed[this.gameLevel]));
                        }

                        this.updateHighScore();
                    }
                }
                // render board
                this.draw();
            }, this.updateFrequency);
        }
        else {
            console.log("Game is already running.");
        }
    }

    endGame(quitToTitle: boolean = false, restart: boolean = false): void {
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
        } else {
            console.log("Game isn't running.");
        }
    }

    // todo: have a pause menu controllable by arrow keys
    pause(skipFade: boolean = false): void {
        this.paused = !this.paused;
        this.pauseOverlay = !skipFade;
        console.log(`game ${this.paused ? "paused" : "unpaused"}`);

        clearInterval(this.overlayOpacityTimer);
        this.overlayOpacityTimer = null;

        if (!skipFade) {
            this.overlayOpacityTimer = setInterval(() => {
                let direction = this.paused ? 1 : -1;
                this.overlayOpacity += direction * (this.overlayFinalOpacity / 8);

                if (this.overlayOpacity > this.overlayFinalOpacity || this.overlayOpacity < 0) {
                    clearInterval(this.overlayOpacityTimer);
                    this.overlayOpacityTimer = null;

                    if (this.overlayOpacity < 0) {
                        this.overlayOpacity = 0;
                        this.pauseOverlay = false;
                        this.pauseScreenSelectedOption = 0;
                    }
                }
            }, this.updateFrequency);
        }
    }

    isPaused(): boolean {
        return this.paused;
    }

    private static pollInput(event: KeyboardEvent = null, input: string = null, gamepadSource: boolean = false): void {
        //console.log(`event: ${event}, input: ${input}`);

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
                            game.activePiece.moveQueue.enqueue(`move:${input}`);
                        } else {
                            game.activePiece.move(input);
                        }
                    } else if (input === "up" || input === "e") {
                        let direction = input == "up" ? "right" : "left";

                        if (game.activePiece.moveLock) {
                            game.activePiece.moveQueue.enqueue(`rotate:${direction}`);
                        } else {
                            game.activePiece.rotate(direction);
                        }
                    } else if (input === " ") {
                        game.activePiece.hardDrop();
                    } else if (input === "f") {
                        game.holdPiece();
                    }
                }
                // Pause Controls
                else if (game.paused) {
                    // navigate pause menu
                    // game.lastFrameAction is a very rudimentary way of halving repeat speed
                    // ....and it's not working.
                    /*
                    if (input === "up") {
                        if (game.lastFrameAction !== "up") {
                            game.pauseScreenSelectedOption = Tetris.changeOption(game.pauseScreenSelectedOption,
                                game.pauseScreenOptions.length, "up");
                        }

                        game.lastFrameAction = game.lastFrameAction === "up" ? null : "up";
                    }
                    else if (input === "down") {
                        if (game.lastFrameAction !== "down") {
                            game.pauseScreenSelectedOption = Tetris.changeOption(game.pauseScreenSelectedOption,
                                    game.pauseScreenOptions.length, "down");
                        }

                        game.lastFrameAction = game.lastFrameAction === "down" ? null : "down";
                    }*/
                    // todo: I think this condensed all of that, remove when sure
                    if (input === "up" || input === "down") {
                        if (game.lastFrameAction !== input) {
                            game.pauseScreenSelectedOption = Tetris.changeOption(game.pauseScreenSelectedOption,
                                game.pauseScreenOptions.length, input);
                        }

                        game.lastFrameAction = game.lastFrameAction === input ? null : input;
                    }
                    // confirm pause menu option
                    else if (input === "Enter") {
                        let option = game.pauseScreenOptions[game.pauseScreenSelectedOption];

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
            // title screen and game over controls
            else {
                if (input === "Enter" || input === "n" || gamepadSource && (input === "Escape" || input === "ArrowUp")){
                    if (!game.titleScreenEnterPressed) {
                        game.titleScreenEnterPressed = true;
                    }
                    else if (game.titleScreenSelectedOption === 0){
                        game.newGame();
                    }
                }
                else if (input === "Escape") {
                    game.titleScreenEnterPressed = false;
                }
                else if (game.titleScreenEnterPressed && input === "up" || input === "down"){
                    /*
                    if (input === "up") {
                        if (game.lastFrameAction !== "up") {
                            game.titleScreenSelectedOption--;
                            game.titleScreenSelectedOption = game.titleScreenSelectedOption < 0 ?
                                game.pauseScreenOptions.length - 1 : game.titleScreenSelectedOption;
                        }

                        game.lastFrameAction = game.lastFrameAction === "up" ? null : "up";
                    }
                    else if (input === "down") {
                        if (game.lastFrameAction !== "down") {
                            game.pauseScreenSelectedOption++;
                            game.pauseScreenSelectedOption =
                                game.pauseScreenSelectedOption > game.pauseScreenOptions.length - 1 ? 0 :
                                    game.pauseScreenSelectedOption;
                        }

                        game.lastFrameAction = game.lastFrameAction === "down" ? null : "down";
                    }*/
                    if (game.lastFrameAction !== input) {
                        game.titleScreenSelectedOption = Tetris.changeOption(game.titleScreenSelectedOption,
                            game.titleScreenOptions.length, input);
                    }

                    game.lastFrameAction = game.lastFrameAction === input ? null : input;
                }
            }
        } else if (game.debugControls.includes(input)){
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
                if (game.linesCleared >= 10 && game.gameLevel > 1){
                    game.linesCleared -= 10;
                    game.gameLevel--;
                }
            }
        }
    }

    private static changeOption(option: number, bounds: number, direction: "up" | "down") : number {
        option += direction === "up" ? -1 : 1;

        if (direction === "down") {
            option = option > bounds - 1 ? 0 : option;
        }
        else {
            option = option < 0 ? bounds - 1 : option;
        }

        return option;
    }

    private static clearLastFrameAction() {
        game.lastFrameAction = null;
    }

    private static pollGamepad(){
        if (game.gamepadConnected && game.gamepad !== null) {
            game.gamepad = navigator.getGamepads()[game.gamepadIndex];
            let repeatableActions = ["ArrowLeft", "ArrowRight", "ArrowDown"];

            for (let i = 0; i < game.gamepad.buttons.length; i++){
                if (game.gamepad.buttons[i].pressed && Tetris.gamepadMap.hasOwnProperty(i)){
                    if (repeatableActions.includes(Tetris.gamepadMap[i])){
                        // probably shouldn't allow any motion if the hard drop was pressed last frame
                        // todo: I don't think this should be hardcoded
                        if (!game.gamepadLastFrame.buttons[12].pressed) {
                            if (game.autorepeatFrameLock <= 0 ||
                                game.gamepad.buttons[i].pressed !== game.gamepadLastFrame.buttons[i].pressed) {
                                Tetris.pollInput(null, Tetris.gamepadMap[i], true);
                                game.autorepeatFrameLock = Tetris.gamepadMap[i] === "ArrowDown" ? 0 : 6;
                            } else {
                                game.autorepeatFrameLock--;
                            }
                        }
                    }
                    else if (game.gamepadLastFrame === null ||
                        game.gamepad.buttons[i].pressed !== game.gamepadLastFrame.buttons[i].pressed){
                        // maybe restrict hard drop immediately after motion?
                        Tetris.pollInput(null, Tetris.gamepadMap[i], true);
                    }
                }
            }

            game.gamepadLastFrame = game.gamepad;
        }
    }

    private static setupGamepad(event: GamepadEvent, connected: boolean){
        game.gamepadConnected = connected;
        game.gamepad = connected ? event.gamepad : null;
        game.gamepadIndex = game.gamepad.index;
        console.log(`Gamepad[${game.gamepadIndex}] ${connected? "" : "dis"}connected`);
    }

    // what's up with this vs the state reset in endGame? should I keep part of this?
    private newGame(gameType: string = "endless"): void{
        this.elapsedTime = 0;
        // todo: allow for starting at a higher level?
        this.gameLevel = 1;
        this.gameOver = false;
        this.linesCleared = 0;
        this.overlayOpacity = 0;
        this.score = 0;
        this.titleScreen = false;
        this.titleScreenEnterPressed = false;
        this.well.resetWell();
    }

    private newPiece(): void {
        let newPieceType = this.pieceBag.pop();
        console.log(`Generating new piece: ${newPieceType} - Remaining in pieceBag: ${this.pieceBag}`);
        //this.activePiece.removeLockDelay();
        this.activePiece = new Tetromino(newPieceType, game, this.well);
        this.ghostPiece  = this.activePiece.getGhost();

        let pieceBagContents = [...this.pieceBag].reverse();
        let pieceBagBackupContents = [...this.pieceBagBackup].reverse();
        this.upcomingPieces = pieceBagContents.concat(pieceBagBackupContents).slice(0,5);
    }

    lineClear(): void {
        this.linesCleared++;

        this.bgGradientTarget1 += 2;
        this.bgGradientTarget2 += 2;
        this.bgGradientTarget1 = this.bgGradientTarget1 > 360 ?
            this.bgGradientTarget1 - 360 : this.bgGradientTarget1;
        this.bgGradientTarget2 = this.bgGradientTarget2 > 360 ?
            this.bgGradientTarget2 - 360 : this.bgGradientTarget2;


        // shift bg gradient pattern with additional cleared lines
        if (this.bgGradientTimer === null) {
            this.bgGradientTimer = setInterval(() => {
                this.bgGradientColor1.h++;
                this.bgGradientColor2.h++;

                this.bgGradientColor1.h = this.bgGradientColor1.h > 360 ?
                    this.bgGradientColor1.h - 360 : this.bgGradientColor1.h;
                this.bgGradientColor2.h = this.bgGradientColor2.h > 360 ?
                    this.bgGradientColor2.h - 360 : this.bgGradientColor2.h;

                if (this.bgGradientColor1.h >= this.bgGradientTarget1 &&
                    this.bgGradientColor2.h >= this.bgGradientTarget2){
                    clearInterval(this.bgGradientTimer);
                    this.bgGradientTimer = null;
                }

                this.bgGradientColorString1 =
                    `hsl(${this.bgGradientColor1.h}, ${this.bgGradientColor1.s}%, ${this.bgGradientColor1.l}%)`;
                this.bgGradientColorString2 =
                    `hsl(${this.bgGradientColor2.h}, ${this.bgGradientColor2.s}%, ${this.bgGradientColor2.l}%)`;

            }, this.updateFrequency * 6);
        }
    }

    lockActivePiece() {
        console.log(`Locking active piece: ${this.activePiece}`);
        clearInterval(this.activePiece.gravity);
        this.activePiece = null;
        this.ghostPiece = null;
        this.holdLock = false;
    }

    holdPiece() {
        if (!this.holdLock) {
            this.spawnLock = true;
            clearInterval(this.activePiece.gravity);
            this.activePiece.gravity = null;


            console.log(`Holding ${this.activePiece}, swapping for ${this.heldPiece}`);
            // did reordering these steps change the lockdelay bug?
            this.activePiece.removeLockDelay();
            let tempPiece = this.activePiece;

            this.activePiece = this.heldPiece !== null ?
                new Tetromino(this.heldPiece.pieceType, game, this.well) : null;
            this.ghostPiece = this.activePiece !== null ?
                this.activePiece.getGhost() : null;

            this.heldPiece = tempPiece;
            this.holdLock = true;
            this.spawnLock = false;
        }
    }

    setSpawnLock(state: boolean) {
        this.spawnLock = state;
    }

    addScore(score: number): void {
        this.score += score;
        this.highScore = this.score > this.highScore ? this.score : this.highScore;
    }

    addMessage(message: string, prettyBorder: boolean = false): void {
        this.messenger.addMessage(message, prettyBorder);
    }

    getLevel(): number{
        return this.gameLevel;
    }

    private updateHighScore(writeScore: boolean = false): void {
        this.highScore = this.score > this.highScore ? this.score : this.highScore;

        if (writeScore) {
            localStorage.setItem("highScore", this.highScore.toString());
        }
    }

    // DRAW METHODS

    private draw(): void {
        // dynamic numbers used for ambient animations
        //let sinOffset = 500*Math.sin(Date.now()/50000);
        //let cosOffset = 500*Math.cos(Date.now()/50000);
        let sinOffset = 500*Math.sin(this.previousLoopTime/50000);
        let cosOffset = 500*Math.cos(this.previousLoopTime/50000);

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
    }

    private drawBackground(sinOffset: number, cosOffset: number) {
        if (!this.noBackground) {
            if (this.simpleBackground) {
                let bgGradient = this.ctx.createLinearGradient(0,0,0,this.canvas.height);

                bgGradient.addColorStop(1, this.bgGradientColorString1);
                bgGradient.addColorStop(0, this.bgGradientColorString2);

                this.ctx.fillStyle = bgGradient;

                this.ctx.fillRect(0,0, this.canvas.width, this.canvas.height);
            }
            else {

                // I don't usually like getting this gross with my variable names but this was becoming nuts
                let w = this.canvas.width;
                let h = this.canvas.height;

                // draw base color
                this.ctx.fillStyle = this.bgColor;
                this.ctx.fillRect(0, 0, w, h);

                // draw bg gradient
                let bgGradient = this.ctx.createLinearGradient(w + 200 - w / 8 + sinOffset / 10, 0,
                    200 + w / 8 + cosOffset / 10, h);
                //bgGradient.addColorStop(1, '#111112');
                bgGradient.addColorStop(1,
                    `hsl(${this.bgGradientColor1.h}, ${this.bgGradientColor1.s}%, ${this.bgGradientColor1.l}%)`);
                bgGradient.addColorStop(0,
                    `hsl(${this.bgGradientColor2.h}, ${this.bgGradientColor2.s}%, ${this.bgGradientColor2.l}%)`);
                this.ctx.fillStyle = bgGradient;
                this.ctx.fillRect(0, 0, w, h);

                // create bezier gradient
                let bezierGradient = this.ctx.createLinearGradient(0, 0, w, h);
                bezierGradient.addColorStop(0, this.bezierColor1);
                bezierGradient.addColorStop(1, this.bezierColor2);
                this.ctx.strokeStyle = bezierGradient;
                this.ctx.globalCompositeOperation = "overlay";

                // create bezier curves
                for (let x = 0; x < 60; x++) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(-300 + cosOffset / 30, w / 3 + sinOffset);
                    this.ctx.bezierCurveTo(w / 4 - (x * 10), h / 3,
                        h * 2 / 3 + (x * 40), (x * 40) + (cosOffset / 500),
                        w + 50, h / 2 + cosOffset);
                    this.ctx.stroke();
                }

                this.ctx.globalCompositeOperation = "source-over";
            }
        }
        else {
            this.ctx.fillStyle = "#000";
            this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
        }
    }

    private drawGrid(){
        let grid            = [...this.well.getGrid()];
        let gridWidth       = grid[0].length;
        let gridHeight      = grid.length;
        let gridPixWidth    = ((this.blockSize+this.gridSize) * gridWidth) + this.gridSize;
        let gridPixHeight   = ((this.blockSize+this.gridSize) * gridHeight) + this.gridSize;

        // center grid
        let gridX = Math.floor(this.canvas.width/2 - gridPixWidth/2);
        let gridY = Math.floor(this.canvas.height/2 - gridPixHeight/2);

        this.ctx.fillStyle = this.gridColor;
        this.ctx.globalCompositeOperation = "multiply";
        this.ctx.filter = 'blur(2px)';


        // draw grid bg
        this.ctx.fillRect(gridX, gridY, gridPixWidth, gridPixHeight);

        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.filter = 'none';

        // get positions of active piece and that freaky ghost piece
        let piecePos = this.activePiece === null ? null : this.activePiece.getPos();
        let ghostPos = this.ghostPiece === null ? null : this.ghostPiece.getPos();

        // fill the blocks, rendering the active piece/that creepy ghost piece
        for (let gridPasses = 0; gridPasses < 2; gridPasses++) {
            for (let row = 0; row < gridHeight; row++) {
                for (let col = 0; col < gridWidth; col++) {
                    let blockX = gridX + this.gridSize + (col * (this.blockSize + this.gridSize));
                    let blockY = gridY + this.gridSize + (row * (this.blockSize + this.gridSize));

                    let colorOpacity = 1;
                    let mino: HTMLCanvasElement = null;
                    let pieceLocking = false;

                    // only draw pieces on second pass
                    if (gridPasses > 0 &&
                        piecePos !== null && piecePos.includes(`${row}:${col}`) ||
                        ghostPos !== null && ghostPos.includes(`${row}:${col}`)) {
                        if (piecePos.includes(`${row}:${col}`)) {
                            if (this.pieceGlow) {
                                this.ctx.fillStyle = this.colorArray[Tetris.getPieceColorIndex(this.activePiece)]
                                this.ctx.filter = 'blur(5px)';
                                //this.ctx.globalCompositeOperation = "lighten";
                                this.ctx.globalAlpha = 1;
                                this.ctx.fillRect(blockX, blockY, this.blockSize, this.blockSize);

                                this.ctx.filter = 'none';
                                this.ctx.globalCompositeOperation = "source-over";
                                this.ctx.globalAlpha = 1;
                            }

                            pieceLocking = piecePos.includes(`${row}:${col}`) ? this.activePiece.getLockPercentage() > 0 : false;
                            mino = this.renderedMinos[this.activePiece.pieceType];
                        } else if (ghostPos.includes(`${row}:${col}`)) {
                            this.ctx.fillStyle = this.colorArray[0];
                            this.ctx.fillRect(blockX, blockY, this.blockSize, this.blockSize);
                            colorOpacity = this.ghostPieceOpacity / 255;
                            mino = this.renderedMinos[this.ghostPiece.pieceType];
                        }
                    } else {
                        if (grid[row][col] === 0) {
                            colorOpacity = .8;
                        } else {
                            mino = this.renderedMinos[Tetromino.pieceTypes[grid[row][col] - 1]];
                        }
                    }

                    this.ctx.globalAlpha = colorOpacity;

                    // render the piece or background
                    if (mino !== null) {
                        this.ctx.drawImage(mino, blockX, blockY);
                    } else if (gridPasses === 0) {
                        // I suppose I don't grab the colors anymore - grid value could now be state rather than color?
                        this.ctx.fillStyle = this.colorArray[0];
                        this.ctx.fillRect(blockX, blockY, this.blockSize, this.blockSize);
                    }

                    this.ctx.globalAlpha = 1;

                    // piece lock animation
                    if (pieceLocking || this.well.getRowsClearing().includes(row)) {
                        let overlayOpacity = pieceLocking ? this.activePiece.getLockPercentage() / 100
                            : this.well.getClearAlpha();

                        // this.ctx.fillStyle = `rgba(255,255,255,${this.activePiece.getLockPercentage() / 100})`;
                        this.ctx.fillStyle = `rgba(255,255,255,${overlayOpacity})`;
                        this.ctx.fillRect(blockX, blockY, this.blockSize, this.blockSize);
                    }
                }
            }
        }

            this.ctx.globalAlpha = .8;
            this.ctx.strokeStyle = this.borderColor;
            this.ctx.strokeRect(gridX - 1, gridY - 1, gridPixWidth + 1, gridPixHeight + 1);

            this.ctx.globalAlpha = 1;
    }

    private drawUI(sinOffset: number, cosOffset: number) {
        if (!this.gameOver) {
            let cvw = this.cvWidths;
            let cvh = this.cvHeights;

            this.ctx.fillStyle = this.fontColor;
            this.ctx.font = `${window.devicePixelRatio}em "${this.gameFont}"`;

            let yOffset = Math.floor(3 * Math.cos(Date.now()/600));

            // UI boxes

            // right box
            let rBoxWidth    = cvw.c6;
            let rBoxHeight   = Math.floor(((this.blockSize+this.gridSize) * this.well.getGrid().length) + this.gridSize);
            let rBoxX        = Math.floor(cvw.c1 - 1.85 * (cvw.c4 - cvw.c12));
            let rBoxY        = (cvh.c2 - (Math.floor(rBoxHeight/2)));

            // upper-left box - ulBoxX is still a little too strange for my liking but whatever
            let ulBoxWidth    = rBoxWidth;
            let ulBoxHeight   = Math.floor((rBoxHeight - this.blockSize)/3);
            let ulBoxX        = (this.canvas.width / 4.5 - (ulBoxWidth/2));
            let ulBoxY        = (cvh.c2 - (rBoxHeight/2));

            // bottom-left
            let blBoxWidth    = rBoxWidth;
            let blBoxHeight   = ulBoxHeight * 2;
            let blBoxX        = ulBoxX;
            let blBoxY        = ulBoxY + ulBoxHeight + this.blockSize;

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
            this.ctx.font   = `${1.4 * window.devicePixelRatio}em "${this.gameFont}"`;
            let lBoxTextX   = ulBoxX + (ulBoxWidth/2);
            let ulBoxTextY   = ulBoxY + (rBoxHeight / 12);
            let blTextOffset = Math.floor(rBoxHeight / 24);
            let blBoxTextY   = blBoxY + (blTextOffset * 2);
            let mins = Math.floor((this.elapsedTime/1000)/60).toString().padStart(2, '0');
            let secs = Math.floor((this.elapsedTime/1000)%60).toString().padStart(2, '0');


            // render twice, once with background
            // TODO: Remove double render code? Seems to give bad performance for minimal gain
            for(let i = 1; i < 2; i++) {
                if (i == 0){
                    this.ctx.fillStyle = this.bgColor;
                    this.ctx.filter = 'blur(2px)';
                    this.ctx.globalCompositeOperation = "overlay";
                }
                else {
                    this.ctx.fillStyle =
                        `hsl(${this.bgGradientColor2.h}, ${this.bgGradientColor2.s}%, ${this.bgGradientColor2.l+30}%)`;
                    this.ctx.filter = 'none';
                    this.ctx.globalCompositeOperation = "source-over";
                }

                this.ctx.fillText("Next:", rBoxX + (rBoxWidth / 2),
                    rBoxY + (rBoxHeight / 12));
                this.ctx.fillText("Hold:", lBoxTextX - i, ulBoxTextY-i, ulBoxWidth);

                this.ctx.fillText("Score:", lBoxTextX, blBoxTextY, blBoxWidth);
                this.ctx.fillText("Lines:", lBoxTextX, blBoxTextY + (blTextOffset * 3), blBoxWidth);
                this.ctx.fillText("Level:", lBoxTextX, blBoxTextY + (blTextOffset * 7), blBoxWidth);
                this.ctx.fillText("Time:", lBoxTextX, blBoxTextY + (blTextOffset * 11), blBoxWidth);

                this.ctx.fillStyle = i == 1 ? this.borderColor : this.ctx.fillStyle;

                // these .25s don't seem like the solution
                this.ctx.fillText(`${this.score}`, lBoxTextX,
                    blBoxTextY + Math.floor((blTextOffset * 1.25)), blBoxWidth);
                this.ctx.fillText(`${this.linesCleared}`, lBoxTextX,
                    blBoxTextY + Math.floor((blTextOffset * 4.25)), blBoxWidth);
                this.ctx.fillText(`${this.gameLevel}`, lBoxTextX,
                    blBoxTextY + Math.floor((blTextOffset * 8.25)), blBoxWidth);
                this.ctx.fillText(`${mins}:${secs}`, lBoxTextX,
                    blBoxTextY + Math.floor((blTextOffset * 12.25)), blBoxWidth);

                // draw high score
                this.ctx.fillStyle = this.bgGradientColorString1;
                this.ctx.fillText(`High: ${this.highScore}`, cvw.c2 + 1, (cvh.c12 + cvh.c24)/2 + 1);
                this.ctx.fillStyle = this.borderColor;
                this.ctx.fillText(`High: ${this.highScore}`, cvw.c2, (cvh.c12 + cvh.c24)/2);
            }

            // render held piece
            if (this.heldPiece !== null){
                let xOffset = 2 * Math.sin(Date.now()/400);
                let yOffset = 2 * Math.cos(Date.now()/400);
                let heldPieceCanvas = this.renderedPieces[this.heldPiece.pieceType];
                let heldPieceX = ulBoxX + (ulBoxWidth/2 - heldPieceCanvas.width/2);
                let heldPieceY = Math.floor(((3 * rBoxHeight)/12) + yOffset);
                this.ctx.drawImage(heldPieceCanvas, heldPieceX, heldPieceY);
            }

            // render upcoming pieces
            let upcomingPieceY = (rBoxHeight / 6) + (rBoxHeight / 12);

            for (let piece of this.upcomingPieces) {
                let upcomingPieceCanvas = this.renderedPieces[piece];
                let upcomingPieceX = rBoxX + (rBoxWidth/2 - upcomingPieceCanvas.width/2);

                this.ctx.drawImage(upcomingPieceCanvas, upcomingPieceX,
                    upcomingPieceY + yOffset);
                upcomingPieceY += rBoxHeight / 6;
            }

            // DEBUG
            // test render the minos
            if (this.renderedMinos !== null && this.testRenderMinos) {
                let yPos = 0;
                for (let type of Tetromino.pieceTypes) {
                    let mino = this.renderedMinos[type];
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
    }

    private drawPause() {
        if (this.pauseOverlay){
            this.drawOverlay();

            let cvw = this.cvWidths;
            let cvh = this.cvHeights;

            //this.toggleTextShadow();
            this.ctx.fillStyle = this.fontColor;
            this.ctx.font = `${3.0 * window.devicePixelRatio}em "${this.gameFont}"`;
            this.ctx.globalAlpha = this.overlayOpacity / this.overlayFinalOpacity;
            this.ctx.fillText("Pause", cvw.c2, cvh.c3);

            // draw pause menu options
            this.ctx.font = `${1.2 * window.devicePixelRatio}em "${this.gameFont}"`;

            for (let option = 0; option < this.pauseScreenOptions.length; option++) {
                this.ctx.fillStyle =
                    option === this.pauseScreenSelectedOption ? this.bgGradientColorString2 : this.fontColor;
                this.ctx.fillText(this.pauseScreenOptions[option], cvw.c2, cvh.c2 + (option * cvh.c12));
            }

            this.ctx.globalAlpha = 1;
            //this.toggleTextShadow();
        }
    }

    private drawGameOver(){
        this.drawOverlay()

        this.toggleTextShadow();
        this.ctx.fillStyle = this.fontColor
        this.ctx.font = `${3.0 * window.devicePixelRatio}em "${this.gameFont}"`;
        this.ctx.fillText("Game Over", this.cvWidths.c2, this.cvHeights.c3);
        this.toggleTextShadow();
    }

    private drawTitle() {
        this.previousLoopTime = Date.now();

        // right now this is all unused
        // todo: Fix background animation - what's up with that stuttered jump?
        if (this.renderedBGTimer === null) {
            this.renderedBGTimer = setInterval(() => {
                this.titleScreenPromptOpacity = (Math.cos(this.previousLoopTime/250) + 2)/3;
                /*
                this.renderedBGX -= this.renderedBGX >= this.canvas.width * -1 + (this.blockSize/3) ?
                    this.canvas.width - this.blockSize : 0;
                //this.renderedBGX += 1;
                //this.renderedBGY += 1;
                this.renderedBGY = this.renderedBGY >= this.canvas.height * -1 ?
                    this.canvas.height * -2 : this.renderedBGY;

                */
            }, this.updateFrequency/3);
        }

        this.ctx.globalAlpha = .2;
        this.ctx.drawImage(this.renderedBackground, this.renderedBGX, this.renderedBGY);
        this.ctx.globalAlpha = 1;

        let cvw = this.cvWidths;
        let cvh = this.cvHeights;

        this.toggleTextShadow();

        this.ctx.fillStyle = this.fontColor;
        // this.ctx.font = `${10.0 * window.devicePixelRatio}em "${this.gameFont}"`;
        this.ctx.font = `${10.0 * window.devicePixelRatio}em "Monoton"`;
        this.ctx.fillText("TETRIS", cvw.c2, cvh.c3);

        this.ctx.font = `${window.devicePixelRatio}em "${this.gameFont}"`;

        if (!this.titleScreenEnterPressed) {
            this.ctx.globalAlpha = this.titleScreenPromptOpacity;
            this.ctx.fillText("Press Enter to Start", cvw.c2, cvh.c3 * 2);
            this.ctx.globalAlpha = 1;
        }
        else {
            this.ctx.font = `${1.4 * window.devicePixelRatio}em ${this.gameFont}`;

            for (let optionIndex = 0; optionIndex < this.titleScreenOptions.length; optionIndex++) {
                /*
                this.ctx.fillStyle = optionIndex === this.titleScreenSelectedOption ?
                    this.bgGradientColorString2 : this.fontColor;

                 */

                let option = this.titleScreenOptions[optionIndex];
                this.ctx.fillText(option, cvw.c2, cvh.c2 + cvh.c12 * optionIndex);

                if (optionIndex === this.titleScreenSelectedOption) {
                    // todo: make a select color that is complimentary or contrasts more
                    this.ctx.fillStyle = this.bgGradientColorString2;
                    this.ctx.globalAlpha = this.titleScreenPromptOpacity;
                    this.ctx.fillText(option, cvw.c2, cvh.c2 + cvh.c12 * optionIndex);
                    this.ctx.fillStyle = this.fontColor;
                    this.ctx.globalAlpha = 1;
                }
            }
        }

        this.ctx.fillStyle = this.fontColor;
        this.ctx.font = `${.8 * window.devicePixelRatio}em "${this.gameFont}"`;
        this.ctx.fillText("Programmed by John O'Hara in 2021", cvw.c2, cvh.c1 - cvh.c24);

        this.toggleTextShadow();
    }

    private toggleTextShadow() {
        this.ctx.shadowColor = this.bgGradientColorString1;
        this.ctx.shadowBlur = this.ctx.shadowBlur === 5 ? 0 : 5;
        this.ctx.shadowOffsetY = this.ctx.shadowOffsetY === 2 ? 0 : 2;
    }

    private drawOverlay() {
        this.ctx.globalAlpha = this.overlayOpacity;
        this.ctx.fillStyle = this.pauseColor;
        this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
        this.ctx.globalAlpha = 1;
    }

    // todo: use this for all state transitions, making use of this.loadOverlayLock
    //  also - what does overlayBehindTheScenesComplete mean now?
    private drawLoadOverlay() {
        if (this.loadOverlayOpacityTimer !== null) {
            console.log(`loadOverlayOpacity: ${this.loadOverlayOpacity}`);
        }

        // This seems to fix the stutter bug - it was a very small negative opacity
        // that was causing it.
        if (this.loadOverlayOpacity >= 0) {
            this.ctx.globalAlpha = this.loadOverlayOpacity;
            this.ctx.globalAlpha = this.ctx.globalAlpha <= 0 ? 0 : this.ctx.globalAlpha;
            this.ctx.globalAlpha = this.ctx.globalAlpha >= 1 ? 1 : this.ctx.globalAlpha;
            this.ctx.fillStyle = this.pauseColor;   // maybe customize this further?
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalAlpha = 1;
        }
    }

    private fadeOverlayToBlack() {
        if (this.loadOverlayOpacityTimer === null) {
            this.loadOverlayFadeUp = true;
            this.loadOverlayLock = true;
            this.overlayBehindTheScenesComplete = false;

            this.loadOverlayOpacityTimer = setInterval((transition) => {
                this.loadOverlayFadeUp = this.loadOverlayOpacity >= 1 ? false : this.loadOverlayFadeUp;

                if (this.loadOverlayFadeUp) {
                    this.loadOverlayOpacity += .05;
                }
                else if (this.overlayBehindTheScenesComplete) {
                    if (this.loadOverlayOpacity <= 0) {
                        clearInterval(this.loadOverlayOpacityTimer);
                        this.loadOverlayOpacityTimer = null;
                        this.loadOverlayOpacity = 0;
                    }
                    else {
                        this.loadOverlayOpacity -= .05;
                    }
                }
            }, this.updateFrequency);
        }
    }

    private quitToTitle(quickRestart: boolean = false) {
        if (!quickRestart) {
            this.pause();
        }

        this.fadeOverlayToBlack();

        if (this.titleScreenTransitionTimer === null) {
            this.titleScreenTransitionTimer = setInterval(() => {
                if (!this.loadOverlayFadeUp) {
                    console.log("Reached final quitToTitle state");
                    // transition to title
                    //this.endGame(true);
                    this.endGame(!quickRestart, quickRestart);


                    this.overlayBehindTheScenesComplete = true;
                    clearInterval(this.titleScreenTransitionTimer);
                    this.titleScreenTransitionTimer = null;
                }
            }, this.updateFrequency);
        }
    }

    private restartGame() {
        //this.pause();
        //this.endGame(false, true);
        this.quitToTitle(true);
    }

    private static renderMinos(pieceType: string, canvas: HTMLCanvasElement,
                               blockSize: number, color: string): void {
        if (!Tetromino.pieceTypes.includes(pieceType)){
            throw new Error("renderMinos was not given a valid piece type!");
        }

        let ctx = canvas.getContext('2d');

        ctx.fillStyle = color;
        ctx.fillRect(0, 0, blockSize, blockSize);

        let blockCenter = Math.floor(blockSize / 2);

        let colorGradient = ctx.createRadialGradient(blockCenter, blockCenter, 1,
            blockCenter, blockCenter, blockSize);

        colorGradient.addColorStop(0, 'rgba(200,200,200,.75)');
        colorGradient.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = colorGradient;
        ctx.globalCompositeOperation = "multiply";
        ctx.fillRect(0, 0, blockSize, blockSize);
        ctx.globalCompositeOperation = "source-over";


        let shineGradient = ctx.createLinearGradient(2, 2,blockSize - 4,blockSize - 4);

        shineGradient.addColorStop(0,'rgba(255,255,255,0.4)');
        shineGradient.addColorStop(0.5,'rgba(255,255,255,0.15)');
        shineGradient.addColorStop(.5, `rgba(64,64,64,0)`);

        ctx.fillStyle = shineGradient;
        ctx.fillRect(2, 2, blockSize - 4, blockSize - 4);

        ctx.strokeStyle = "#fff";
        ctx.globalCompositeOperation = "lighten";
        ctx.strokeRect(0, 0, blockSize, blockSize);
        ctx.globalCompositeOperation = "source-over";
    }

    // used to render a piece for display only (next piece queue, held piece)
    private static renderCosmeticPiece(pieceType: string, canvas: HTMLCanvasElement, mino: HTMLCanvasElement,
                                       blockSize: number, gridSize: number):void {
        if (!Tetromino.pieceTypes.includes(pieceType)){
            throw new Error("renderCosmeticPiece was not given a valid piece type!");
        }

        let ctx = canvas.getContext('2d');

        for (let i = 0; i < 4; i++){
            let blockCoords = (Tetromino.startPositions[pieceType] as string[])[i].split(":")
                .map(x => parseInt(x));

            let xPos = gridSize + ((blockCoords[1] - 3) * (blockSize + gridSize));
            let yPos = gridSize + (blockCoords[0] * (blockSize + gridSize));

            ctx.drawImage(mino, xPos, yPos);
        }
    }

    private static getPieceColorIndex(piece: Tetromino): number {
        if (piece == null) {
            return 0;
        }

        return Tetromino.pieceTypes.indexOf(piece.pieceType) + 1;
    }

    private static newPieceBag(): string[]{
        let pieceBag = [...Tetromino.pieceTypes];

        for (let i = 0; i < 7; i++){
            let randIndex = Math.floor(Math.random() * (7-i));

            if (randIndex != i) {
                let temp = pieceBag[i];
                pieceBag[i] = pieceBag[randIndex];
                pieceBag[randIndex] = temp;
            }
        }

        return pieceBag;
    }
}

let game: Tetris;

window.addEventListener('load', (event) => {
    game = new Tetris();
    document.getElementById("build-timestamp").innerText = document.lastModified;
});
