const game = {
    sRound: 15, w: 1024, h: 896, tilew: 16, tileh: 14, mapw: 86, maph: 77,
    currentInputHandler: null, target: null, language: "en-dm",
    sheetsToLoad: ["sheet", "title", "end", "how", "down", "spectate"],
    canvasLayers: ["background", "characters", "foreground", "menuA", "menuB", "menuC", "menucursorA", "menucursorB", "menutext"], 
    fullInit: function() {
        let canvasObj = {};
        for(let i = 0; i < game.canvasLayers.length; i++) {
            const name = game.canvasLayers[i];
            canvasObj[name] = document.getElementById(name);
        }
        let contextObj = {};
        for(const key in canvasObj) {
            contextObj[key] = canvasObj[key].getContext("2d");
        }
        contextObj["menuC"].globalAlpha = 0.5;        
        game.init(canvasObj, contextObj, game.w, game.h, 16, 14);
    },
    init: function(canvasObj, ctxObj, width, height, tilewidth, tileheight) {
        gfx.canvas = canvasObj;
        gfx.ctx = ctxObj;
        gfx.canvasWidth = width;
        gfx.canvasHeight = height;
        gfx.tileWidth = tilewidth;
        gfx.tileHeight = tileheight;
        gfx.loadSpriteSheets(this.sheetsToLoad, this.sheetsLoaded);
    },
    Transition: function(from, to, arg) {
        game.currentInputHandler = to;
        from.clean();
        input.clearAllKeys();
        to.setup(arg);
    },
    initListeners: function() {
        gfx.canvas["menutext"].addEventListener("mousemove", input.moveMouse);
        gfx.canvas["menutext"].addEventListener("click", input.click);
        document.addEventListener("keypress", input.keyPress);
        document.addEventListener("keydown", input.keyDown);
        document.addEventListener("keyup", input.keyUp);
        window.addEventListener("gamepadconnected", input.gamepadConnected);
        window.addEventListener("gamepaddisconnected", input.gamepadDisconnected);
    },
    sheetsLoaded: function() {
        game.initListeners();
        game.currentInputHandler = title;
        title.setup();
    }
};