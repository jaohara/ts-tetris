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

    private static readonly startPositions = {
        'I': ['0:3','0:4','0:5','0:6'],
        'J': ['0:3','1:3','1:4','1:5'],
        'L': ['0:5','1:3','1:4','1:5'],
        'O': ['0:4','0:5','1:4','1:5'],
        'S': ['0:4','0:5','1:3','1:4'],
        'T': ['0:4','1:3','1:4','1:5'],
        'Z': ['0:3','0:4','1:4','1:5'],
    }

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
    private static readonly rotationTransforms = {
        'I': [
            ['2:-1', '1:0', '0:1', '-1:2'],    // a
            ['1:2', '0:1', '-1:0', '-2:-1'],   // b
            ['-2:1', '-1:0', '0:-1', '1:-2'],   // -a
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

    gravity: NodeJS.Timeout;

    readonly isGhost: boolean;
    readonly pieceType;

    private ghost: Tetromino;
    private pos: string[];
    private rotation = [0, 1, 2, 3];
    private readonly well: Well;

    constructor(pieceType: string, well: Well, isGhost: boolean = false, pos: string[] = null) {
        if (Tetromino.pieceTypes.includes(pieceType)){
            this.isGhost = isGhost;
            this.pieceType = pieceType;
            this.pos  = isGhost ? pos : Tetromino.startPositions[pieceType];
            this.well = well;

            if (!isGhost) {
                console.log("Making ghost piece...");
                this.ghost = new Tetromino(this.pieceType, this.well, true, this.pos);
            } else {
                this.hardDrop();
            }
        }
    }

    getGhost(): Tetromino {
        return this.ghost;
    }

    hardDrop() {
        let keepDroppin = true;

        do {
            keepDroppin = this.updatePos("down");
        } while (keepDroppin);
    }

    rotate(direction: string): boolean{
        /*
            Todo: I-piece rotation problem

            There's a problem with rotating a newly spawned I - since it would rotate out
            of the top bounds of the well, it doesn't let you rotate the piece until it is
            already 3 cells down. What probably should happen is that the top of the well
            should "push" the piece down - that is, if you rotate it, it allows it to rotate
            outside of the bounds before pushing it back down so the topmost block is still
            in row 0.

            Ya know, I kind of get the wisdom of having those extra four dead rows off-screen
            now.
         */

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

        console.log(`transform: ${transform}`);

        for (let i = 0; i < transform.length && validMove; i++) {
            let blockRotation = transform[i].split(":").map(x => parseInt(x));
            // remember - [0] is y, [1] is x here (row, column)
            let currentPos = this.pos[i].split(":").map(x => parseInt(x));

            console.log(`blockRotation: ${blockRotation}`);
            console.log(`currentPos: ${currentPos}`);

            currentPos[1] += blockRotation[0];
            currentPos[0] += blockRotation[1];

            newPos[i] = currentPos.join(":");

            validMove = this.checkValidMove(currentPos);
        }

        if (validMove) {
            this.pos = newPos;

            if (!this.isGhost) {
                this.ghost.setPos(this.pos);
                this.ghost.hardDrop();
            }
        }

        return validMove;
    }

    updatePos(direction: string): boolean {
        // check to see if valid move
        let validMove = true;

        // check direction and make sure it can move in a certain way
        let xDirection = direction == "down" ? 0 : 1;
        xDirection *= direction == "left" ? -1 : 1;
        let yDirection = direction == "down" ? 1 : 0;

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
                //this.ghost.updatePos(direction);
                this.ghost.setPos(this.pos);
                this.ghost.hardDrop();
            }
        } else if (direction === "down" && !this.isGhost) {
            this.well.lockPiece(this);
        }

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

    private checkValidMove(position: number[]): boolean {
        return  !(position[0] < 0 || position[0] >= this.well.getHeight() ||
            position[1] < 0 || position[1] >= this.well.getWidth() ||
            this.well.getGrid()[position[0]][position[1]] != 0);
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

    // game settings
    private readonly blockSize = 24;
    private readonly DEBUG = true;
    private readonly frameRate = 60;
    // were I a smarter man I'd use the formula, but I'm not, so this works
    private readonly gameSpeed = [
        0, 0.01667, 0.021217, 0.026977, 0.035256, 0.04693, 0.06361, 0.0899,
        0.1312, 0.1775, 0.2598, 0.388, 0.59, 0.92, 1.46, 2.36
    ];
    private readonly ghostPieceOpacity = 48;    // 0-255
    private readonly gridSize = 3;
    private readonly updateFrequency = 1000 / this.frameRate;

    private readonly controls = [
        "ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "f", "Escape", "p", "Tab"
    ];

    // game state
    private activePiece: Tetromino = null;
    private gameTimer: NodeJS.Timeout;
    private gameLevel: number;
    private ghostPiece: Tetromino = null;
    private heldPiece: Tetromino = null;
    private holdLock: boolean = false;
    private paused: boolean;
    private pieceBag: string[] = [];
    private running: boolean;
    private spawnLock: boolean;


    // graphics stuff
    /*
        COLOR ARRAY ORDER:        I, J, L, O, S, T, Z

        First is a reference to the bgColor so it's at index 0
        lt blue, darkblue, orange, yellow, green, purple, red
     */
    private readonly bgColor    = '#1b1d24';
    private readonly pauseColor = '#1b1d24aa';
    private readonly fontColor  = '#68e4b6';
    private readonly gridColor  = '#282c34';
    private readonly colorArray = [
        this.bgColor, '#3498db', '#273ac5', '#e97e03',
        '#edcc30', '#13be3d', '#b84cd8', '#ec334d'];

    constructor() {
        this.canvas     = document.getElementById("main-canvas") as HTMLCanvasElement;
        this.context    = this.canvas.getContext('2d');
        this.well       = new Well(this);

        // todo: don't autostart eventually
        this.start();
    }

    start(): void {
        if (!this.running) {
            this.running = true;
            // todo: only set this to 1 on gamestart
            this.gameLevel = 1;

            // add controls
            document.addEventListener("keydown", Tetris.pollInput);

            // MAIN GAME LOOP
            this.gameTimer = setInterval(() => {
                if (!this.paused) {
                    if (this.pieceBag.length <= 0) {
                        this.newPieceBag();
                    }

                    // clear lines that need to be cleared
                    if (this.activePiece == null) {
                        this.well.clearLines();
                    }

                    // create new piece if one doesn't exist
                    if (this.activePiece == null && !this.spawnLock) {
                        this.activePiece = new Tetromino(this.pieceBag.pop(), this.well);
                        this.ghostPiece  = this.activePiece.getGhost();

                        this.activePiece.gravity = setInterval(() => {
                            if (!this.paused) {
                                let falling = this.activePiece.updatePos("down");

                                if (!falling) {
                                    this.well.lockPiece(this.activePiece);
                                }
                            }
                        }, (this.updateFrequency / this.gameSpeed[this.gameLevel]));
                    }
                }

                this.draw();
            }, this.updateFrequency);
        } else {
            console.log("Game is already running.");
        }
    }

    stop(): void {
        if (this.running) {
            console.log("Stopping game loop...");
            this.running = false;
            clearInterval(this.gameTimer);
            console.log("Removing keydown listener...");
            document.removeEventListener("keydown", Tetris.pollInput);
        } else {
            console.log("Game isn't running.");
        }
    }

    pause(): void {
        this.paused = !this.paused;
    }

    private static pollInput(event: KeyboardEvent): void {
        if (game.controls.includes(event.key)){
            event.preventDefault();
            console.log(`Recorded keypress: ${event.key}`);

            let key = event.key.includes("Arrow") ?
                event.key.slice(5).toLowerCase() : event.key;

            if (key === "Escape" || key === "p"){
                game.pause();
            }
            else if (game.activePiece !== null && !game.paused) {
                if (["left", "right", "down"].includes(key)){
                    game.activePiece.updatePos(key);
                }
                else if (key === "up") {
                    game.activePiece.rotate("right");
                }
                else if (key === " ") {
                    game.activePiece.hardDrop();
                } else if (key === "f"){
                    game.holdPiece();
                }
            }
        }
    }

    private draw(): void {
        // draw BG
        this.context.fillStyle = this.bgColor;
        this.context.fillRect(0,0,this.canvas.width, this.canvas.height);

        // draw Grid
        this.drawGrid();
        this.drawPause();

        // draw diagnostics
        this.drawDiag();
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

        // draw grid bg
        this.context.fillRect(gridX, gridY, gridPixWidth, gridPixHeight);

        // get positions of active piece and that freaky ghost piece
        let piecePos = this.activePiece === null ? null : this.activePiece.getPos();
        let ghostPos = this.ghostPiece === null ? null : this.ghostPiece.getPos();

        // fill the blocks, rendering the active piece/that creepy ghost piece
        for (let row = 0; row < gridHeight; row++){
            for (let col = 0; col < gridWidth; col++) {
                let blockX = gridX + this.gridSize + (col * (this.blockSize + this.gridSize));
                let blockY = gridY + this.gridSize + (row * (this.blockSize + this.gridSize));

                // render the active piece or that spooky ghost piece
                if (piecePos.includes(`${row}:${col}`)){
                    this.context.fillStyle = this.colorArray[Tetris.getPieceColorIndex(this.activePiece)];
                } else if (ghostPos.includes(`${row}:${col}`)) {
                    this.context.fillStyle = this.colorArray[Tetris.getPieceColorIndex(this.ghostPiece)]
                        + this.ghostPieceOpacity.toString(16);
                } else {
                    this.context.fillStyle = this.colorArray[grid[row][col]];
                }

                // goodnight, sweet ternary operator
                /*
                this.context.fillStyle = this.colorArray[piecePos.includes(`${row}:${col}`) ?
                    Tetris.getPieceColorIndex(this.activePiece) :
                    ghostPos.includes(`${row}:${col}`) ?
                        Tetris.getPieceColorIndex(this.ghostPiece) : grid[row][col]];
                 */

                this.context.fillRect(blockX, blockY, this.blockSize, this.blockSize);
            }
        }
    }

    private drawDiag() {
        if (this.DEBUG) {
            // maybe make this universal?
            this.context.fillStyle = '#bbb';
            this.context.font = '1.0em "JetBrains Mono"';

            this.context.fillText(
                `activePiece: ${this.activePiece === null ? null : this.activePiece.pieceType}`,
                20, 20, 200);
            this.context.fillText(`activePiece.pos:`, 20, 60, 200);
            this.context.fillText(`${this.activePiece === null ? null : this.activePiece.getPos()}`,
                40, 80, 200);

            this.context.fillText(`ghostPiece.pos:`, 20, 120, 200);
            this.context.fillText(`${this.ghostPiece === null ? null : this.ghostPiece.getPos()}`,
                40, 140, 200);

            this.context.fillText(
                `nextPiece: ${this.pieceBag !== null ? this.pieceBag[this.pieceBag.length-1] : null}`,
                20, 180, 200);

            this.context.fillText(
                `heldPiece: ${this.heldPiece !== null ? this.heldPiece.pieceType : null}`,
                20, 220, 200);
        }
    }

    private drawPause() {
        if (this.paused){
            this.context.fillStyle = this.pauseColor;
            this.context.fillRect(0,0,this.canvas.width, this.canvas.height);

            this.context.fillStyle = this.fontColor;

            this.context.font = "3.0em JetBrains Mono";
            this.context.fillText("Pause", this.canvas.width/3+64,
                this.canvas.height/2, this.canvas.height/2);
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
            clearInterval(this.activePiece.gravity);

            let tempPiece = this.activePiece;

            this.activePiece = this.heldPiece !== null ?
                new Tetromino(this.heldPiece.pieceType, this.well) : null;
            this.ghostPiece = this.activePiece !== null ?
                this.activePiece.getGhost() : null;

            this.heldPiece = tempPiece;
            this.holdLock = true;
        }
    }

    setSpawnLock(state: boolean){
        this.spawnLock = state;
    }

    private static getPieceColorIndex(piece: Tetromino): number {
        if (piece == null) {
            return 0;
        }

        return Tetromino.pieceTypes.indexOf(piece.pieceType) + 1;
    }

    private newPieceBag(){
        this.pieceBag = [...Tetromino.pieceTypes];

        for (let i = 0; i < 7; i++){
            let randIndex = Math.floor(Math.random() * (7-i));

            if (randIndex != i) {
                let temp = this.pieceBag[i];
                this.pieceBag[i] = this.pieceBag[randIndex];
                this.pieceBag[randIndex] = temp;
            }
        }
    }
}

let game = new Tetris();

document.getElementById("start-button").addEventListener("click",() => game.start());

document.getElementById("stop-button").addEventListener("click",() => game.stop());

document.getElementById("build-timestamp").innerText = document.lastModified;

console.log(game);
