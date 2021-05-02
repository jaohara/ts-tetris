// TETRIS.JS

/**
 * Tetromino - A class used to represent a game piece.
 *
 * Generally only instantiated once, stored as "Tetris.activeGamepiece". Contains instsance
 * methods for movement, rotation, hard drops.
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

    // DEBUG
    private moveCount = 0;

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
            let lineString = linesCleared == 1 ? `${linesCleared} line,` : linesCleared == 4 ?
                "TETRIS!" : `${linesCleared} lines,`;
            this.game.log(`${lineString} scored ${lineScore}`);
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
    private readonly well: Well;
    private renderedPieces: Object = {
        "I": HTMLCanvasElement,
        "J": HTMLCanvasElement,
        "L": HTMLCanvasElement,
        "O": HTMLCanvasElement,
        "S": HTMLCanvasElement,
        "T": HTMLCanvasElement,
        "Z": HTMLCanvasElement
    }

    // game settings
    private readonly blockSize = 24;
    private readonly DEBUG = true;
    private readonly frameRate = 60;
    // private readonly frameRate = 10;
    // were I a smarter man I'd use the formula, but I'm not, so this works
    private readonly gameSpeed = [
        0, 0.01667, 0.021217, 0.026977, 0.035256, 0.04693, 0.06361, 0.0899,
        0.1312, 0.1775, 0.2598, 0.388, 0.59, 0.92, 1.46, 2.36
    ];
    private readonly ghostPieceOpacity = 48;    // 0-255
    // private readonly gridSize = 3;
    private readonly gridSize = 1;
    readonly updateFrequency = 1000 / this.frameRate;

    private readonly controls = [
        "ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "f", "Escape", "p", "Tab",
        "e", "n", "Enter"
    ];

    // timers from NodeJS.Timeout
    
    // game state
    private activePiece: Tetromino = null;
    private elapsedTime: number;
    private gameLoop: ReturnType<typeof setTimeout>;
    private gameOver: boolean = true;
    private gameTimer: ReturnType<typeof setTimeout>;   // todo: do I actually need this?
    private gameLevel: number;
    private ghostPiece: Tetromino = null;
    private heldPiece: Tetromino = null;
    private highScore: number = 32000;
    private holdLock: boolean = false;
    private linesCleared: number;
    private lockDelay: ReturnType<typeof setTimeout> = null;
    private paused: boolean;
    private pieceBag: string[] = [];
    private pieceBagBackup: string[] = [];
    private upcomingPieces: string[];
    private previousLoopTime: number;
    private running: boolean;
    private score: number;
    private spawnLock: boolean;
    private titleScreen: boolean = true;


    // TODO: REMOVE AFTER DEBUG... maybe?
    diagMessage: string[];
    private readonly logLength: number = 24;


    // graphics stuff
    /*
        COLOR ARRAY ORDER:        I, J, L, O, S, T, Z

        First is a reference to the bgColor so it's at index 0
        lt blue, darkblue, orange, yellow, green, purple, red
     */
    private readonly bgColor        = '#1b1d24';
    private readonly bgColor1       = '#3498db';    // TODO: these need better names
    private readonly bgColor2       = '#68e4b6'     //  <-
    private readonly borderColor    = '#bbb';
    private readonly pauseColor     = '#1b1d24aa'   // todo: use pauseOpacity for alpha
    private pauseFinalOpacity       = 85; // out of 255
    private pauseOpacity            = 0;
    private pauseOpacityTimer: ReturnType<typeof setInterval> = null;
    private readonly fontColor      = '#68e4b6';
    // private readonly gridColor  = '#282c34';
    private readonly gridColor      = '#9b9ba9';
    private readonly colorArray     = [
        '#1b1d24', '#3498db', '#273ac5', '#e97e03',
        '#edcc30', '#13be3d', '#b84cd8', '#ec334d'];

    constructor() {
        this.canvas     = document.getElementById("main-canvas") as HTMLCanvasElement;
        this.context    = this.canvas.getContext('2d');
        this.well       = new Well(this);

        for (let pieceType of Tetromino.pieceTypes){
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
                this.blockSize, this.gridSize, this.colorArray[Tetromino.pieceTypes.indexOf(pieceType)+1]);
        }

        // get high score from wherever it has been saved?

        this.start();
    }

    start(): void {
        if (!this.running) {
            this.running = true;

            // add controls
            document.addEventListener("keydown", Tetris.pollInput);

            //this.newGame();

            // MAIN GAME LOOP
            this.gameLoop = setInterval(() => {
                // update loop timer
                if (!this.paused){
                    this.elapsedTime += Date.now() - this.previousLoopTime;
                }

                if (this.activePiece !== null && this.activePiece.getLockPercentage() > 0){
                    console.log(`activePiece locking: ${this.activePiece.getLockPercentage()}%`);
                }

                this.previousLoopTime = Date.now();

                if (!this.titleScreen && !this.paused && !this.gameOver) {
                    // check for levelup
                    if (Math.floor(this.linesCleared / 10) + 1 > this.gameLevel && this.gameLevel < 15){
                        this.gameLevel++;
                        this.log("level up!");
                        clearInterval(this.activePiece.gravity);
                        this.activePiece.gravity = null;
                    }

                    // check if piece bag is exhausted
                    // todo: store two piece bags so you can have a long prediction of pieces?
                    if (this.pieceBagBackup.length <= 0){
                        this.pieceBagBackup = Tetris.newPieceBag();
                    }

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
        console.log(`game ${this.paused ? "paused" : "unpaused"}`);
    }

    private static pollInput(event: KeyboardEvent): void {
        if (game.controls.includes(event.key)){
            event.preventDefault();

            let key = event.key.includes("Arrow") ?
                event.key.slice(5).toLowerCase() : event.key;

            if (!game.titleScreen && !game.gameOver) {
                if (key === "Escape" || key === "p") {
                    game.pause();
                } else if (game.activePiece !== null && !game.paused) {
                    if (["left", "right", "down"].includes(key)) {
                        if (game.activePiece.moveLock) {
                            game.activePiece.moveQueue.enqueue(`move:${key}`);
                        } else {
                            game.activePiece.move(key);
                        }
                    } else if (key === "up" || key === "e") {
                        let direction = key == "up" ? "right" : "left";

                        if (game.activePiece.moveLock) {
                            game.activePiece.moveQueue.enqueue(`rotate:${direction}`);
                        } else {
                            game.activePiece.rotate(direction);
                        }
                    } else if (key === " ") {
                        game.activePiece.hardDrop();
                    } else if (key === "f") {
                        game.holdPiece();
                    }
                }
            }
            else {
                // should only be on game over and title screen states
                if (key === "Enter" || key === "n"){
                    game.newGame();
                }
            }
        }
    }

    private newGame(): void{
        // reset game state

        this.diagMessage = [];
        this.elapsedTime = 0;
        // todo: allow for starting at a higher level?
        this.gameLevel = 1;
        this.gameOver = false;
        this.linesCleared = 0;
        this.score = 0;
        this.titleScreen = false;
        this.well.resetWell();

        this.log("new game started");
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
    }

    lockActivePiece() {
        clearInterval(this.activePiece.gravity);
        this.activePiece = null;
        this.ghostPiece = null;
        this.holdLock = false;
    }

    holdPiece() {
        if (!this.holdLock) {
            clearInterval(this.activePiece.gravity);

            let tempPiece = this.activePiece;

            this.activePiece.removeLockDelay();

            this.activePiece = this.heldPiece !== null ?
                new Tetromino(this.heldPiece.pieceType, game, this.well) : null;
            this.ghostPiece = this.activePiece !== null ?
                this.activePiece.getGhost() : null;

            this.heldPiece = tempPiece;
            this.holdLock = true;
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
        let sinOffset = 500*Math.sin(Date.now()/50000);
        let cosOffset = 500*Math.cos(Date.now()/50000);

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

        // I don't usually like getting this gross with my variable names but this was becoming nuts
        let w = this.canvas.width;
        let h = this.canvas.height;

        // draw base color
        this.context.fillStyle = this.bgColor;
        this.context.fillRect(0,0, w, h);

        // draw bg gradient
        let bgGradient = this.context.createLinearGradient(w+200 - w/8 + sinOffset/10,0,
            200 + w/8 + cosOffset/10,h);
        //bgGradient.addColorStop(1, '#111112');
        bgGradient.addColorStop(1, '#0a0a37');
        bgGradient.addColorStop(0, '#0f4ba7');
        this.context.fillStyle = bgGradient;
        this.context.fillRect(0, 0, w, h);

        // create bezier gradient
        let bezierGradient = this.context.createLinearGradient(0,0, w, h);
        bezierGradient.addColorStop(0,this.bgColor1);
        bezierGradient.addColorStop(1,this.bgColor2);
        this.context.strokeStyle = bezierGradient;
        this.context.globalCompositeOperation = "overlay";

        // create bezier curves
        for (let x = 0; x < 60; x++){
            this.context.beginPath();
            this.context.moveTo(-300 + cosOffset/30, w/3 + sinOffset);
            this.context.bezierCurveTo(w/4 - (x*10), h/3,
                h * 2/3 + (x*40), (x*40)+(cosOffset/500),
                w+50, h/2 + cosOffset);
            this.context.stroke();
        }

        this.context.globalCompositeOperation = "source-over";
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
        for (let row = 0; row < gridHeight; row++){
            for (let col = 0; col < gridWidth; col++) {
                let blockX = gridX + this.gridSize + (col * (this.blockSize + this.gridSize));
                let blockY = gridY + this.gridSize + (row * (this.blockSize + this.gridSize));

                let pieceLocking = false;

                // piece rendering - should this be another draw method?
                let baseColor: string;
                let colorOpacity = 1;
                let drawGradient = true;

                if (piecePos.includes(`${row}:${col}`)){        // color from piece
                    baseColor = this.colorArray[Tetris.getPieceColorIndex(this.activePiece)];
                    pieceLocking = this.activePiece.getLockPercentage() > 0;
                }
                else if (ghostPos.includes(`${row}:${col}`)){   // color from ghost piece
                    // first draw empty cell for proper transparency
                    this.context.fillStyle = this.colorArray[0];
                    this.context.fillRect(blockX, blockY, this.blockSize, this.blockSize);

                    //
                    baseColor = this.colorArray[Tetris.getPieceColorIndex(this.ghostPiece)];
                    colorOpacity = this.ghostPieceOpacity / 255;
                } else {                                        // color from grid
                    baseColor = this.colorArray[grid[row][col]];
                    drawGradient = grid[row][col] !== 0;

                    if (grid[row][col] === 0){
                        colorOpacity = .8;
                    }
                }

                this.context.globalAlpha = colorOpacity;
                this.context.fillStyle = baseColor;
                this.context.fillRect(blockX, blockY, this.blockSize, this.blockSize);

                if (drawGradient) {
                    let colorGradient =
                        this.context.createLinearGradient(blockX+4, blockY+4,
                            blockX+this.blockSize-4, blockY+this.blockSize-4);


                    // this is the same in renderCosmeticPiece() and I don't like it, but I don't
                    // know how I'd make it universal
                    colorGradient.addColorStop(0,'rgba(255,255,255,0.45)');
                    colorGradient.addColorStop(0.4,'rgba(255,255,255,0.15)');
                    colorGradient.addColorStop(.65, `rgba(64,64,64,0)`);

                    this.context.fillStyle = colorGradient;
                    this.context.fillRect(blockX + 1, blockY + 1, this.blockSize - 2, this.blockSize - 2);
                }

                this.context.globalAlpha = 1;

                // piece lock animation
                if (pieceLocking){
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
            // maybe make this universal?
            this.context.fillStyle = '#bbb';
            this.context.font = '1.0em "JetBrains Mono"';

            // left side
            
            // held piece
            this.context.fillText(
                `heldPiece: ${this.heldPiece !== null ? this.heldPiece.pieceType : null}`,
                20, 20, 200);

            // level
            this.context.fillText(`gameLevel: ${this.gameLevel}`, 20, 60, 200);

            // lines cleared
            this.context.fillText(`linesCleared: ${this.linesCleared}`, 20, 100, 200);

            // score
            this.context.fillText(`score: ${this.score}`, 20, 140, 200);

            let mins = Math.floor((this.elapsedTime/1000)/60).toString().padStart(2, '0');
            let secs = Math.floor((this.elapsedTime/1000)%60).toString().padStart(2, '0');

            // gametime
            this.context.fillText(`gameTime: ${mins}:${secs}`, 20, 180, 200);


            //right side
            this.context.fillStyle = this.gridColor;
            this.context.filter = 'blur(5px)';
            this.context.globalCompositeOperation = 'multiply';

            let boxWidth    = this.canvas.width/6;
            let boxHeight   = ((this.blockSize+this.gridSize) * this.well.getGrid().length) + this.gridSize;
            let boxX        = this.canvas.width - 1.5 * (this.canvas.width / 4 - (boxWidth/2));
            let boxY        = (this.canvas.height / 2 - (boxHeight/2));

            this.context.fillRect(boxX, boxY, boxWidth, boxHeight);

            this.context.fillStyle = this.bgColor;
            this.context.filter = 'none';
            this.context.globalAlpha = .8;
            this.context.globalCompositeOperation = 'source-over';

            this.context.fillRect(boxX, boxY, boxWidth, boxHeight);

            this.context.strokeStyle = this.borderColor;
            this.context.strokeRect(boxX, boxY, boxWidth, boxHeight);

            this.context.globalAlpha = 1;

            this.context.fillStyle = this.borderColor;
            this.context.font = 'bold 1.4em "JetBrains Mono"';
            this.context.fillText("Next:", boxX + (boxWidth/2 - 32),
                boxY + (boxHeight / 12), 64);

            let upcomingPieceY = (boxHeight / 6) + (boxHeight / 12);
            for (let piece of this.upcomingPieces) {
                let upcomingPieceCanvas = this.renderedPieces[piece];
                let upcomingPieceX = boxX + (boxWidth/2 - upcomingPieceCanvas.width/2);
                let upcomingPieceWidth = upcomingPieceCanvas.width;
                let upcomingPieceHeight = upcomingPieceCanvas.height;
                // this.context.drawImage(upcomingPieceCanvas, upcomingPieceX, upcomingPieceY,
                //     upcomingPieceWidth * (1 + (Math.sin(Date.now())/5)),
                //     upcomingPieceHeight * (1 + (Math.sin(Date.now)/5)));

                this.context.drawImage(upcomingPieceCanvas, upcomingPieceX, upcomingPieceY);
                upcomingPieceY += boxHeight / 6;
            }

            /*
            // level
            this.context.fillText(`gameLevel: ${this.gameLevel}`, 580, 20, 200);

            // lines cleared
            this.context.fillText(`linesCleared: ${this.linesCleared}`, 580, 60, 200);

            // score
            this.context.fillText(`score: ${this.score}`, 580, 100, 200);

            let mins = Math.floor((this.elapsedTime/1000)/60).toString().padStart(2, '0');
            let secs = Math.floor((this.elapsedTime/1000)%60).toString().padStart(2, '0');

            // gametime
            this.context.fillText(`gameTime: ${mins}:${secs}`, 580, 140, 200);

            // draw that diag message
            this.context.fillStyle = this.fontColor;
            this.context.font = "0.8em JetBrains Mono";

            for (let i = 0; i < this.diagMessage.length; i++) {
                this.context.fillStyle = this.fontColor + (255 - (i * Math.floor(255 / this.logLength))).toString(16);
                this.context.fillText(`${this.diagMessage[i]}`,
                    20, (i * 20) + 100, 200);
            }

             */
        }
        else if (this.titleScreen) {
            this.drawTitle();
        }
        else {
            this.drawGameOver();
        }
    }

    private drawPause() {
        if (this.paused){
            this.drawOverlay();

            this.context.fillStyle = this.fontColor;
            this.context.font = "3.0em JetBrains Mono";
            this.context.fillText("Pause", this.canvas.width/3+64,
                this.canvas.height/2, this.canvas.height/2);
        }
    }

    private drawGameOver(){
        this.drawOverlay()

        this.context.fillStyle = this.fontColor
        this.context.font = "3.0em JetBrains Mono"
        this.context.fillText("Game Over", this.canvas.width/3+50,
            this.canvas.height/2, this.canvas.width);
    }

    private drawTitle() {
        this.drawOverlay();

        this.context.fillStyle = this.fontColor;
        this.context.font = "5.0em JetBrains Mono";
        this.context.fillText("Tetris", 20,
            80, this.canvas.width);

        this.context.font = "1.0em JetBrains Mono";

        this.context.fillText("Programmed by John O'Hara in 2021",
            40, 120, this.canvas.width/2);

        this.context.fillText("Press Enter to Start",
            this.canvas.width/3+50, 300, this.canvas.width/2);

    }

    // I think I could make this better, I'm not satisfied as it is
    // todo: implement fade in with this.pauseOpacity and this.pauseOpacityTimer
    private drawOverlay(){
        this.context.fillStyle = this.pauseColor;
        this.context.fillRect(0,0,this.canvas.width, this.canvas.height);
    }

    // used to render a piece for display only (next piece queue, held piece)
    private static renderCosmeticPiece(pieceType: string, canvas: HTMLCanvasElement,
                                blockSize: number, gridSize: number, color: string):void {
        if (!Tetromino.pieceTypes.includes(pieceType)){
            throw new Error("renderCosmeticPiece was not given a valid piece type!");
        }

        let context = canvas.getContext('2d');

        for (let i = 0; i < 4; i++){
            let blockCoords = (Tetromino.startPositions[pieceType] as string[])[i].split(":")
                .map(x => parseInt(x));

            let xPos = gridSize + ((blockCoords[1] - 3) * (blockSize + gridSize));
            let yPos = gridSize + (blockCoords[0] * (blockSize + gridSize));

            context.fillStyle = color;
            context.fillRect(xPos, yPos, blockSize, blockSize);

            // let colorGradient = context.createLinearGradient(xPos + 4, xPos + 4,
            //         xPos + blockSize - 4, yPos + blockSize - 4);

            //TODO: Figure out the buggy gradient positioning

            let colorGradient = context.createLinearGradient(xPos + 4, xPos + 4,
                xPos + blockSize - 4, yPos + blockSize - 4);




            // this is the same in renderCosmeticPiece() and I don't like it, but I don't
            // know how I'd make it universal
            colorGradient.addColorStop(0,'rgba(255,255,255,0.45)');
            colorGradient.addColorStop(0.4,'rgba(255,255,255,0.15)');
            colorGradient.addColorStop(.65, `rgba(64,64,64,0)`);

            context.fillStyle = colorGradient;
            context.fillRect(xPos + 1, yPos + 1, blockSize - 2, blockSize - 2);
        }
    }

    log(message: string){
        if (this.diagMessage.length >= this.logLength){
            this.diagMessage.pop();
        }

        this.diagMessage.unshift(message);
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

let game = new Tetris();

document.getElementById("start-button").addEventListener("click",() => game.start());

document.getElementById("stop-button").addEventListener("click",() => game.stop());

document.getElementById("build-timestamp").innerText = document.lastModified;

console.log(game);
