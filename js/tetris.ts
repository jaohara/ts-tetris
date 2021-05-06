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

    gravity: ReturnType<typeof setTimeout> = null;
    moveLock: boolean;
    moveQueue: MoveQueue;

    readonly isGhost: boolean;
    readonly pieceType;

    private readonly ghost: Tetromino;
    private readonly game: Tetris;
    private readonly well: Well;

    private lockDelay: ReturnType<typeof setTimeout> = null;
    private lockPercentage: number;

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
                this.game.stop();
            }

            if (!isGhost) {
                this.ghost = new Tetromino(this.pieceType, this.game, this.well, true, this.pos);
            } else {
                this.hardDrop();
            }
        }
    }

    private static lockDelayTimer(piece: Tetromino) {
        if (piece.lockPercentage > 99){ // we seem to get 99.99999... instead of 100 at the end
            console.log(`Resolving lock delay on ${piece} - lockPercentage: ${piece.lockPercentage}`);
            piece.lockPercentage = 0;

            // I guess here we'll just lock the piece, right?
            //clearInterval(piece.lockDelay);
            //piece.lockDelay = null;
            piece.removeLockDelay();
            piece.well.lockPiece(piece);
        } else {
            piece.lockPercentage += 100/30;
        }
    }

    removeLockDelay(): void {
        console.log("Removing lock delay...");
        clearInterval(this.lockDelay);
        this.lockDelay = null;
        this.lockPercentage = 0;
        console.log(`Removed delay on ${this}`);
    }

    getGhost(): Tetromino {
        return this.ghost;
    }

    getLockPercentage(): number {
        return this.lockPercentage;
    }

    hardDrop() {
        let keepDroppin = true;
        let dropScore = 0;

        do {
            keepDroppin = this.move("down", true);
            dropScore += 1; // move("down") adds one already, so add another to make it 2 per row
        } while (keepDroppin);

        if (!this.isGhost){
            this.game.addScore(dropScore);
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


        for (let i = 0; i < transform.length && validMove; i++) {
            let blockRotation = transform[i].split(":").map(x => parseInt(x));
            // remember - [0] is y, [1] is x here (row, column)
            let currentPos = this.pos[i].split(":").map(x => parseInt(x));

            currentPos[1] += direction === "right"? blockRotation[0] : blockRotation[0] * -1;
            currentPos[0] += direction === "right"? blockRotation[1] : blockRotation[1] * -1;

            newPos[i] = currentPos.join(":");

            validMove = this.checkValidMove(currentPos);
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

    move(direction: string, hardDrop: boolean = false): boolean {
        // check to see if valid move
        let validMove = true;

        if (direction === "gravity"){
            console.log("Moving by gravity...");
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
                        console.log("Attempting to reset lock delay...");
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
            console.log("Non valid move on a real piece due to gravity");

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
    private grid: number[][] = [];
    private readonly height = 20;
    private readonly width = 10;
    private readonly clearDelay = 30; // in ms

    private game: Tetris;

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

    getHeight(): number {
        return this.grid.length;
    }

    getWidth(): number {
        return this.grid[0].length;
    }

    clearLines() {
        this.game.setSpawnLock(true);
        let linesCleared = 0;

        // how would I do something with a pause or animation on line clear?
        for (let row = this.getHeight() - 1; row > 0; row--){
            if (!this.grid[row].includes(0)){
                // clear that line
                this.grid.splice(row, 1);

                let replacementRow = [];

                for (let col = 0; col < this.width; col++){
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
        if (linesCleared > 0){
            let lineScore = (200 * linesCleared);
            lineScore -= linesCleared < 4 ? 100 : 0;
            lineScore *= this.game.getLevel();

            console.log(`linesCleared: ${linesCleared} - lineScore: ${lineScore}`);
            this.game.addScore(lineScore);
        }

        this.game.setSpawnLock(false);
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

/**
 * Tetris - A class used to represent the game state and pieces that comprise it.
 */
class Tetris {
    // canvas and rendering context
    private readonly canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private gamepad: Gamepad = null;
    private gamepadLastFrame: Gamepad = null;
    private readonly well: Well;

    // Objects to store individual pre-rendered minos (blocks) and full pre-rendered pieces
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

    private readonly debugControls = ["0"];

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
    private highScore: number = 32000;
    private holdLock: boolean = false;
    private linesCleared: number;
    private paused: boolean;
    private pieceBag: string[] = [];
    private pieceBagBackup: string[] = [];
    private upcomingPieces: string[];
    private previousLoopTime: number;
    private running: boolean;
    private score: number;
    private spawnLock: boolean;
    private titleScreen: boolean = true;

    // graphics stuff
    /*
        COLOR ARRAY ORDER:        I, J, L, O, S, T, Z

        First is a reference to the bgColor so it's at index 0
        lt blue, darkblue, orange, yellow, green, purple, red
     */
    private readonly bgColor        = '#1b1d24';
    private bgGradientColor1        = {'h': 240, 's': 69, 'l': 13};
    private bgGradientColor2        = {'h': 216, 's': 84, 'l': 36};
    private bgGradientColorString1  = 'hsl(240, 69%, 13%)';
    private bgGradientColorString2  = 'hsl(216, 84%, 36%)';
    private bgGradientTarget1       = 240;
    private bgGradientTarget2       = 216;
    private bgGradientTimer: ReturnType<typeof setInterval> = null;
    private readonly bezierColor1   = '#3498db';
    private readonly bezierColor2   = '#68e4b6';
    private readonly borderColor    = '#bbb';
    private readonly pauseColor     = '#000';
    private readonly gameFont       = 'Poppins';
    private overlayFinalOpacity     = .4; // 0-1.0
    private overlayOpacity          = 0;
    private overlayOpacityTimer: ReturnType<typeof setInterval> = null;
    private pauseOverlay: boolean;
    private readonly fontColor      = '#bbb';
    private readonly gridColor      = '#9b9ba9';
    private readonly colorArray     = [
        '#1b1d24', '#3498db', '#273ac5', '#e97e03',
        '#edcc30', '#13be3d', '#b84cd8', '#ec334d'];

    // graphics options
    private noBackground: boolean = false;

    constructor() {
        this.canvas     = document.getElementById("main-canvas") as HTMLCanvasElement;
        this.context    = this.canvas.getContext('2d');
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

        // todo: get high score from wherever it has been saved?

        this.start();
    }

    start(): void {
        if (!this.running) {
            this.running = true;

            // add controls
            document.addEventListener("keydown", Tetris.pollInput);
            window.addEventListener("gamepadconnected", (e) => Tetris.setupGamepad(e,true));
            window.addEventListener("gamepaddisconnected", (e) => Tetris.setupGamepad(e, false));

            //this.newGame();

            // MAIN GAME LOOP
            this.gameLoop = setInterval(() => {
                // update loop timer
                if (!this.paused){
                    this.elapsedTime += Date.now() - this.previousLoopTime;
                }
                this.previousLoopTime = Date.now();

                // check for gamepad input
                if (this.gamepadConnected){
                    Tetris.pollGamepad();
                }

                // DEBUG: report state current locking piece if it exists
                if (this.activePiece !== null && this.activePiece.getLockPercentage() > 0){
                    console.log(`activePiece locking: ${this.activePiece.getLockPercentage()}%`);
                }

                if (!this.titleScreen && !this.paused && !this.gameOver) {
                    // check for levelup
                    if (Math.floor(this.linesCleared / 10) + 1 > this.gameLevel && this.gameLevel < 15){
                        this.gameLevel++;
                        clearInterval(this.activePiece.gravity);
                        this.activePiece.gravity = null;
                    }

                    // check if backup piece bag is exhausted
                    if (this.pieceBagBackup.length <= 0){
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
                        console.log(`this.activePiece: ${this.activePiece}, this.spawnLock: ${this.spawnLock}`);
                        this.newPiece();
                    }

                    // give the active piece gravity if it doesn't have it
                    if (this.activePiece.gravity === null){
                        this.activePiece.gravity = setInterval(() => {
                            if (!this.paused) {
                                if (!this.activePiece.moveLock) {
                                    let falling = this.activePiece.move("gravity");

                                    if (!falling) {
                                        //this.well.lockPiece(this.activePiece);
                                    }
                                }
                                else {
                                    this.activePiece.moveQueue.enqueue(`move:gravity`);
                                }
                            }
                        }, (this.updateFrequency / this.gameSpeed[this.gameLevel]));
                    }
                }
                else if (this.gameOver){
                    // todo: GAME OVER STATE
                    this.drawGameOver();
                }
                else if (this.titleScreen) {
                    this.drawTitle();
                }

                // render board
                this.draw();
            }, this.updateFrequency);
        }
        else {
            console.log("Game is already running.");
        }
    }

    // todo: Make this more of a game-over state
    stop(): void {
        if (this.running) {
            this.gameOver = true;
            //this.running = false;
            //clearInterval(this.gameLoop);
            //document.removeEventListener("keydown", Tetris.pollInput);
        } else {
            console.log("Game isn't running.");
        }
    }

    // todo: have a pause menu controllable by arrow keys
    pause(): void {
        this.paused = !this.paused;
        this.pauseOverlay = true;
        console.log(`game ${this.paused ? "paused" : "unpaused"}`);

        clearInterval(this.overlayOpacityTimer);
        this.overlayOpacityTimer = null;

        this.overlayOpacityTimer = setInterval(() => {
            let direction = this.paused ? 1 : -1;
            this.overlayOpacity += direction * (this.overlayFinalOpacity / 8);

            if (this.overlayOpacity > this.overlayFinalOpacity ||this.overlayOpacity < 0){
                clearInterval(this.overlayOpacityTimer);
                this.overlayOpacityTimer = null;

                if (this.overlayOpacity < 0){
                    this.overlayOpacity = 0;
                    this.pauseOverlay = false;
                }
            }
        }, this.updateFrequency);
    }

    private static pollInput(event: KeyboardEvent = null, input: string = null, gamepadSource: boolean = false): void {
        console.log(`event: ${event}, input: ${input}`);

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
                if (input === "Escape" || input === "p") {
                    game.pause();
                } else if (game.activePiece !== null && !game.paused) {
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
            } else {
                // should only be on game over and title screen states
                if (input === "Enter" || input === "n" || gamepadSource && (input === "Escape" || input === "ArrowUp")){
                    game.newGame();
                }
            }
        } else if (game.debugControls.includes(input)){
            if (input === "0") {
                game.noBackground = !game.noBackground;
            }
        }
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

    private newGame(): void{
        this.elapsedTime = 0;
        // todo: allow for starting at a higher level?
        this.gameLevel = 1;
        this.gameOver = false;
        this.linesCleared = 0;
        this.score = 0;
        this.titleScreen = false;
        this.well.resetWell();
    }

    private newPiece(): void {
        console.log("Generating new piece...");
        //this.activePiece.removeLockDelay();
        this.activePiece = new Tetromino(this.pieceBag.pop(), game, this.well);
        this.ghostPiece  = this.activePiece.getGhost();

        let pieceBagContents = [...this.pieceBag].reverse();
        let pieceBagBackupContents = [...this.pieceBagBackup].reverse();
        this.upcomingPieces = pieceBagContents.concat(pieceBagBackupContents).slice(0,5);
    }

    lineClear(): void {
        this.linesCleared++;

        this.bgGradientTarget1 += 3;
        this.bgGradientTarget2 += 3;
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

            }, this.updateFrequency * 4);
        }
    }

    lockActivePiece() {
        clearInterval(this.activePiece.gravity);
        this.activePiece = null;
        this.ghostPiece = null;
        this.holdLock = false;
    }

    holdPiece() {
        if (!this.holdLock) {
            this.spawnLock = true;
            clearInterval(this.activePiece.gravity);

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

    setSpawnLock(state: boolean){
        this.spawnLock = state;
    }

    addScore(score: number): void{
        this.score += score;
        this.highScore = this.score > this.highScore ? this.score : this.highScore;
    }

    getLevel(): number{
        return this.gameLevel;
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

        // finally, draw pause overlay if necessary
        this.drawPause();
    }

    private drawBackground(sinOffset: number, cosOffset: number) {
        if (!this.noBackground) {

            // I don't usually like getting this gross with my variable names but this was becoming nuts
            let w = this.canvas.width;
            let h = this.canvas.height;

            // draw base color
            this.context.fillStyle = this.bgColor;
            this.context.fillRect(0, 0, w, h);

            // draw bg gradient
            let bgGradient = this.context.createLinearGradient(w + 200 - w / 8 + sinOffset / 10, 0,
                200 + w / 8 + cosOffset / 10, h);
            //bgGradient.addColorStop(1, '#111112');
            bgGradient.addColorStop(1,
                `hsl(${this.bgGradientColor1.h}, ${this.bgGradientColor1.s}%, ${this.bgGradientColor1.l}%)`);
            bgGradient.addColorStop(0,
                `hsl(${this.bgGradientColor2.h}, ${this.bgGradientColor2.s}%, ${this.bgGradientColor2.l}%)`);
            this.context.fillStyle = bgGradient;
            this.context.fillRect(0, 0, w, h);

            // create bezier gradient
            let bezierGradient = this.context.createLinearGradient(0, 0, w, h);
            bezierGradient.addColorStop(0, this.bezierColor1);
            bezierGradient.addColorStop(1, this.bezierColor2);
            this.context.strokeStyle = bezierGradient;
            this.context.globalCompositeOperation = "overlay";

            // create bezier curves
            for (let x = 0; x < 60; x++) {
                this.context.beginPath();
                this.context.moveTo(-300 + cosOffset / 30, w / 3 + sinOffset);
                this.context.bezierCurveTo(w / 4 - (x * 10), h / 3,
                    h * 2 / 3 + (x * 40), (x * 40) + (cosOffset / 500),
                    w + 50, h / 2 + cosOffset);
                this.context.stroke();
            }

            this.context.globalCompositeOperation = "source-over";
        }
        else {
            this.context.fillStyle = "#000";
            this.context.fillRect(0,0,this.canvas.width, this.canvas.height);
        }
    }

    private drawGrid(){
        let grid            = [...this.well.getGrid()];
        let gridWidth       = grid[0].length;
        let gridHeight      = grid.length;
        let gridPixWidth    = ((this.blockSize+this.gridSize) * gridWidth) + this.gridSize;
        let gridPixHeight   = ((this.blockSize+this.gridSize) * gridHeight) + this.gridSize;

        // center grid
        let gridX = this.canvas.width/2 - gridPixWidth/2;
        let gridY = this.canvas.height/2 - gridPixHeight/2;

        this.context.fillStyle = this.gridColor;
        this.context.globalCompositeOperation = "multiply";
        this.context.filter = 'blur(2px)';


        // draw grid bg
        this.context.fillRect(gridX, gridY, gridPixWidth, gridPixHeight);

        this.context.globalCompositeOperation = "source-over";
        this.context.filter = 'none';

        // get positions of active piece and that freaky ghost piece
        let piecePos = this.activePiece === null ? null : this.activePiece.getPos();
        let ghostPos = this.ghostPiece === null ? null : this.ghostPiece.getPos();

        // fill the blocks, rendering the active piece/that creepy ghost piece
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                let blockX = gridX + this.gridSize + (col * (this.blockSize + this.gridSize));
                let blockY = gridY + this.gridSize + (row * (this.blockSize + this.gridSize));

                let colorOpacity = 1;
                let mino: HTMLCanvasElement = null;
                let pieceLocking = false;

                if (piecePos !== null && piecePos.includes(`${row}:${col}`) ||
                    ghostPos !== null && ghostPos.includes(`${row}:${col}`)) {
                    if (ghostPos.includes(`${row}:${col}`)) {
                        this.context.fillStyle = this.colorArray[0];
                        this.context.fillRect(blockX, blockY, this.blockSize, this.blockSize);
                        colorOpacity = this.ghostPieceOpacity / 255;
                        mino = this.renderedMinos[this.ghostPiece.pieceType];
                    }
                    else if (piecePos.includes(`${row}:${col}`)) {
                        pieceLocking = piecePos.includes(`${row}:${col}`) ? this.activePiece.getLockPercentage() > 0 : false;
                        mino = this.renderedMinos[this.activePiece.pieceType];
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

                this.context.globalAlpha = colorOpacity;

                // render the piece or background
                if (mino !== null) {
                    this.context.drawImage(mino, blockX-1, blockY);
                }
                else {
                    // I suppose I don't grab the colors anymore - grid value could now be state rather than color?
                    this.context.fillStyle = this.colorArray[0];
                    this.context.fillRect(blockX, blockY, this.blockSize, this.blockSize);
                }

                this.context.globalAlpha = 1;

                // piece lock animation
                if (pieceLocking) {
                    this.context.fillStyle = `rgba(255,255,255,${this.activePiece.getLockPercentage()/100})`;
                    this.context.fillRect(blockX, blockY, this.blockSize, this.blockSize);
                }
            }
        }

        this.context.globalAlpha = .8;
        this.context.strokeStyle = this.borderColor;
        this.context.strokeRect(gridX, gridY, gridPixWidth, gridPixHeight);

        this.context.globalAlpha = 1;
    }

    private drawUI(sinOffset: number, cosOffset: number) {
        if (!this.gameOver) {
            this.context.fillStyle = this.fontColor;
            this.context.font = `1.0em "${this.gameFont}"`;

            let yOffset = Math.floor(3 * Math.cos(Date.now()/600));

            // UI boxes

            // This box positioning is a little wonky

            // right box
            let rBoxWidth    = this.canvas.width/6;
            let rBoxHeight   = ((this.blockSize+this.gridSize) * this.well.getGrid().length) + this.gridSize;
            let rBoxX        = this.canvas.width - 1.85 * (this.canvas.width / 4 - (rBoxWidth/2));
            let rBoxY        = (this.canvas.height / 2 - (rBoxHeight/2));

            // upper-left box
            let ulBoxWidth    = rBoxWidth;
            let ulBoxHeight   = (rBoxHeight - this.blockSize)/3;
            let ulBoxX        = (this.canvas.width / 4.5 - (ulBoxWidth/2));
            let ulBoxY        = (this.canvas.height / 2 - (rBoxHeight/2));

            // bottom-left
            let blBoxWidth    = rBoxWidth;
            let blBoxHeight   = ulBoxHeight * 2;
            let blBoxX        = ulBoxX;
            let blBoxY        = ulBoxY + ulBoxHeight + this.blockSize;

            // fill box backgrounds
            this.context.fillStyle = this.gridColor;
            this.context.filter = 'blur(5px)';
            this.context.globalCompositeOperation = 'multiply';

            this.context.fillRect(rBoxX, rBoxY, rBoxWidth, rBoxHeight);
            this.context.fillRect(ulBoxX, ulBoxY, ulBoxWidth, ulBoxHeight);
            this.context.fillRect(blBoxX, blBoxY, blBoxWidth, blBoxHeight);

            // fill box main layers
            this.context.fillStyle = this.bgColor;
            this.context.filter = 'none';
            this.context.globalAlpha = .6;
            this.context.globalCompositeOperation = 'source-over';

            this.context.fillRect(rBoxX, rBoxY, rBoxWidth, rBoxHeight);
            this.context.fillRect(ulBoxX, ulBoxY, ulBoxWidth, ulBoxHeight);
            this.context.fillRect(blBoxX, blBoxY, blBoxWidth, blBoxHeight);

            // stroke box borders
            this.context.strokeStyle = this.borderColor;
            this.context.strokeRect(rBoxX, rBoxY, rBoxWidth, rBoxHeight);
            this.context.strokeRect(ulBoxX, ulBoxY, ulBoxWidth, ulBoxHeight);
            this.context.strokeRect(blBoxX, blBoxY, blBoxWidth, blBoxHeight);

            this.context.globalAlpha = 1;

            // render text
            this.context.fillStyle = this.borderColor;
            this.context.font = `bold 1.4em "${this.gameFont}"`;
            let lBoxTextX = ulBoxX + (ulBoxWidth/2 - 32);
            let lBoxTextY = ulBoxY + (rBoxHeight / 12);
            let mins = Math.floor((this.elapsedTime/1000)/60).toString().padStart(2, '0');
            let secs = Math.floor((this.elapsedTime/1000)%60).toString().padStart(2, '0');


            // render twice, once with background
            // TODO: Remove double render code? Seems to give bad performance for minimal gain
            for(let i = 1; i < 2; i++) {
                if (i == 0){
                    this.context.fillStyle = this.bgColor;
                    this.context.filter = 'blur(2px)';
                    this.context.globalCompositeOperation = "overlay";
                }
                else {
                    // this.context.fillStyle = this.bezierColor1;
                    this.context.fillStyle =
                        `hsl(${this.bgGradientColor2.h}, ${this.bgGradientColor2.s}%, ${this.bgGradientColor2.l+30}%)`;
                    this.context.filter = 'none';
                    this.context.globalCompositeOperation = "source-over";
                }

                this.context.fillText("Next:", rBoxX + (rBoxWidth / 2 - 32),
                    rBoxY + (rBoxHeight / 12), 64);
                this.context.fillText("Hold:", lBoxTextX - i, lBoxTextY-i, 64);

                this.context.fillText("Score:", lBoxTextX, lBoxTextY * 3, 64);
                this.context.fillText("Lines:", lBoxTextX, lBoxTextY * 3.75, 64);
                this.context.fillText("Level:", lBoxTextX, lBoxTextY * 4.5, 64);
                this.context.fillText("Time:", lBoxTextX, lBoxTextY * 5.25, 64);

                this.context.fillStyle = i == 1 ? this.borderColor : this.context.fillStyle;

                this.context.fillText(`${this.score}`, lBoxTextX, lBoxTextY * 3 + 32, 64);
                this.context.fillText(`${this.linesCleared}`, lBoxTextX, lBoxTextY * 3.75 + 32, 64);
                this.context.fillText(`${this.gameLevel}`, lBoxTextX, lBoxTextY * 4.5 + 32, 64);
                this.context.fillText(`${mins}:${secs}`, lBoxTextX, lBoxTextY * 5.25 + 32, 64);
            }

            // get rotate ready

            // render held piece
            if (this.heldPiece !== null){
                let xOffset = 2 * Math.sin(Date.now()/400);
                let yOffset = 2 * Math.cos(Date.now()/400);
                let heldPieceCanvas = this.renderedPieces[this.heldPiece.pieceType];
                let heldPieceX = ulBoxX + (ulBoxWidth/2 - heldPieceCanvas.width/2);
                let heldPieceY = Math.floor(((3 * rBoxHeight)/12) + yOffset);
                this.context.drawImage(heldPieceCanvas, heldPieceX, heldPieceY);

                //this.context.restore();
            }


            // render upcoming pieces
            let upcomingPieceY = (rBoxHeight / 6) + (rBoxHeight / 12);

            for (let piece of this.upcomingPieces) {
                let upcomingPieceCanvas = this.renderedPieces[piece];
                let upcomingPieceX = rBoxX + (rBoxWidth/2 - upcomingPieceCanvas.width/2);

                this.context.drawImage(upcomingPieceCanvas, upcomingPieceX,
                    upcomingPieceY + yOffset);
                upcomingPieceY += rBoxHeight / 6;
            }


            // DEBUG
            // test render the minos
            if (this.renderedMinos !== null) {
                let yPos = 0;
                for (let type of Tetromino.pieceTypes) {
                    let mino = this.renderedMinos[type];
                    this.context.drawImage(mino, 0, yPos);
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

            this.context.fillStyle = this.fontColor;
            this.context.font = `3.0em "${this.gameFont}"`;
            this.context.globalAlpha = this.overlayOpacity / this.overlayFinalOpacity;
            this.context.fillText("Pause", this.canvas.width/3+64,
                this.canvas.height/2, this.canvas.height/2);
            this.context.globalAlpha = 1;
        }
    }

    private drawGameOver(){
        this.drawOverlay()

        this.context.fillStyle = this.fontColor
        this.context.font = `3.0em "${this.gameFont}"`;
        this.context.fillText("Game Over", this.canvas.width/3+50,
            this.canvas.height/2, this.canvas.width);
    }

    private drawTitle() {
        this.context.fillStyle = this.fontColor;
        this.context.font = `5.0em "${this.gameFont}"`;
        this.context.fillText("Tetris", 20,
            80, this.canvas.width);

        this.context.font = `1.0em "${this.gameFont}"`;

        this.context.fillText("Programmed by John O'Hara in 2021",
            40, 120, this.canvas.width/2);

        this.context.fillText("Press Enter to Start",
            this.canvas.width/3+50, 300, this.canvas.width/2);

    }

    // I think I could make this better, I'm not satisfied as it is
    // todo: implement fade in with this.pauseOpacity and this.overlayOpacityTimer
    private drawOverlay(){
        this.context.globalAlpha = this.overlayOpacity;
        this.context.fillStyle = this.pauseColor;
        this.context.fillRect(0,0,this.canvas.width, this.canvas.height);
        this.context.globalAlpha = 1;
    }

    private static renderMinos(pieceType: string, canvas: HTMLCanvasElement,
                               blockSize: number, color: string): void {
        if (!Tetromino.pieceTypes.includes(pieceType)){
            throw new Error("renderMinos was not given a valid piece type!");
        }

        let context = canvas.getContext('2d');

        context.fillStyle = color;
        context.fillRect(0, 0, blockSize, blockSize);

        let colorGradient = context.createLinearGradient(2, 2,blockSize - 4,blockSize - 4);

        colorGradient.addColorStop(0,'rgba(255,255,255,0.45)');
        colorGradient.addColorStop(0.4,'rgba(255,255,255,0.15)');
        colorGradient.addColorStop(.65, `rgba(64,64,64,0)`);

        context.fillStyle = colorGradient;
        context.fillRect(1, 1, blockSize - 2, blockSize - 2);
    }

    // used to render a piece for display only (next piece queue, held piece)
    private static renderCosmeticPiece(pieceType: string, canvas: HTMLCanvasElement, mino: HTMLCanvasElement,
                                       blockSize: number, gridSize: number):void {
        if (!Tetromino.pieceTypes.includes(pieceType)){
            throw new Error("renderCosmeticPiece was not given a valid piece type!");
        }

        let context = canvas.getContext('2d');

        for (let i = 0; i < 4; i++){
            let blockCoords = (Tetromino.startPositions[pieceType] as string[])[i].split(":")
                .map(x => parseInt(x));

            let xPos = gridSize + ((blockCoords[1] - 3) * (blockSize + gridSize));
            let yPos = gridSize + (blockCoords[0] * (blockSize + gridSize));

            context.drawImage(mino, xPos, yPos);

            // old way
            /*
            context.fillStyle = color;
            context.fillRect(xPos, yPos, blockSize, blockSize);

            let colorGradient = context.createLinearGradient(xPos + 4, yPos + 4,
                xPos + blockSize - 4, yPos + blockSize - 4);

            colorGradient.addColorStop(0,'rgba(255,255,255,0.45)');
            colorGradient.addColorStop(0.4,'rgba(255,255,255,0.15)');
            colorGradient.addColorStop(.65, `rgba(64,64,64,0)`);

            context.fillStyle = colorGradient;
            context.fillRect(xPos + 1, yPos + 1, blockSize - 2, blockSize - 2);
             */
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
    document.getElementById("start-button").addEventListener("click",() => game.start());
    document.getElementById("stop-button").addEventListener("click",() => game.stop());
    document.getElementById("build-timestamp").innerText = document.lastModified;
});
