const sprites = {
    "map0": [0, 0], "map1": [1, 0], "map2": [2, 0], "map3": [3, 0], "map4": [4, 0], "map5": [5, 0],
    "obj0": [0, 1], "obj1": [1, 1], "obj2": [2, 1], "obj3": [3, 1], "obj4": [4, 1], "obj5": [5, 1],
    "p0": [0, 6], "p1": [1, 6], "p2": [2, 6], "p3": [3, 6], "pz0": [4, 6], "pz1": [5, 6],
    "SselL": [0, 4], "SselM": [1, 4], "SselR": [2, 4], "selL": [0, 5], "selM": [1, 5], "selR": [2, 5], 
    "availableSpace": [7, 0], "target": [5, 4],
    "dir0": [6, 1], "dir1": [7, 1], "dir2": [8, 1], "dir3": [9, 1], 
    "Sdir0": [6, 2], "Sdir1": [7, 2], "Sdir2": [8, 2], "Sdir3": [9, 2], 
    "clockUL": [3, 4], "clockUR": [4, 4], "clockLL": [3, 5], "clockLR": [4, 5],
    "item20": [1, 3], "item21": [0, 3], "item30": [2, 3], "item31": [3, 3], "item32": [4, 3], "item33": [5, 3],
    "item34": [2, 2], "item35": [3, 2], "item36": [4, 2], "item41": [5, 2],
    "item37": [6, 3], "item38": [7, 3], "item39": [8, 3], "item40": [9, 3],
    "numStart": [8, 0], "ibg0": [7, 4], "ibg1": [8, 4], "select": [6, 4],
    "bricks0": [6, 7], "bricks1": [7, 7], "bricks2": [8, 7],
    "carrot0": [6, 8], "carrot1": [7, 8], "item51": [8, 8],
    "leek0": [6, 9], "leek1": [7, 9], "item50": [8, 9],
    "apple0": [8, 5], "apple1": [9, 5], "apple2": [10, 5], "item52": [9, 7],
    "banana0": [8, 6], "banana1": [9, 6], "banana2": [10, 6], "item53": [10, 7],
    "fist": [1, 2], "bite": [0, 2], "HP0": [6, 5], "HP1": [5, 5],
    "corpseHuman": [7, 5], "corpseZombie": [7, 6], "badZone": [6, 0]
};
for(let i = 0; i < 6; i++) {
    sprites["hat" + i] = [i, 7];
    sprites["shirt" + i] = [i, 8];
    sprites["pants" + i] = [i, 9];
}
const gfx = {
    canvas: [],  ctx: [],
    canvasHeight: 0, canvasWidth: 0,
    tileWidth: 0, tileHeight: 0, scale: 4,
    spritesheets: [],
    loadSpriteSheets: function(paths, callback) {
        count = 0;
        paths.forEach(function(path) {
            const f = function(path, len) {
                const img = new Image();
                img.onload = function() {
                    gfx.spritesheets[path] = this;
                    count += 1;
                    if(count === len) { callback(); }
                };
                img.src = "img/" + path + ".png";
            };
            f(path, paths.length);
        });
    },

    clearLayer: key => gfx.ctx[key].clearRect(0, 0, gfx.canvasWidth, gfx.canvasWidth),
    clearSome: keys => keys.forEach(e => gfx.clearLayer(e)),
    clearAll: () => { for(const key in gfx.ctx) { gfx.clearLayer(key); } },
    // Full Drawsies
    DrawItemNumber: function(number, x, y, layer, top) {
        const digits = ("" + number).split("");
        const sheet = gfx.spritesheets["sheet"];
        const startCoords = sprites["numStart"];
        const startX = startCoords[0] * 16 + startCoords[0] * 2 + 1;
        const startY = startCoords[1] * 16 + startCoords[1] * 2 + 1;
        const ctx = gfx.ctx[layer];
        const ix = x * 16 + 7 - (digits.length - 1) * 4;
        const ay = y * 16 + (top ? 0 : 9);
        if(number === "x") {
            gfx.drawImage(ctx, sheet, startX, startY, 5, 7, ix + 4, ay - 2, 5, 7);
            return;
        } else if(number === 0) {
            gfx.drawImage(ctx, sheet, startX, startY + 9, 5, 7, ix + 4, ay - 2, 5, 7);
            return;
        }
        if(!top) { gfx.drawImage(ctx, sheet, startX, startY, 5, 7, ix, ay, 5, 7); }
        for(let i = 0; i < digits.length; i++) {
            const d = gfx.numberDeltas[digits[i]];
            gfx.drawImage(ctx, sheet, startX + d[0] * 6, startY + d[1] * 9, 5, 7, ix + (i + 1) * 4, ay, 5, 7);
        }
    },
    WriteText: function(text, x, y, color, size, layer) {
        layer = layer || "menutext";
        gfx.ctx[layer].font = (size || 32) + "px PressStart2P";
        gfx.ctx[layer].fillStyle = (color || "#000000");
        gfx.ctx[layer].fillText(text, (x + 4) * gfx.scale, (y + 12) * gfx.scale);
    },
    DrawTileToGrid: (spritename, x, y, layer, isHalfTile) => gfx.DrawTile(spritename, x * 16, y * 16, layer, isHalfTile),
    DrawTile: function(spritename, x, y, layer, isHalfTile) {
        const data = sprites[spritename];
        try {
            const isBig = data.length == 3;
            gfx.DrawSprite(isBig ? "sheetBig" : "sheet", data[0], data[1], x, y, layer, isBig, isHalfTile);
        } catch(e) {
            console.log("couldn't find " + spritename);
        }
    },
    DrawSprite: function(sheetpath, sx, sy, x, y, layer, big, isHalfTile) {
        const sheet = gfx.spritesheets[sheetpath];
        const size = big ? 32 : 16;
        const startX = sx * size + sx * 2 + 1;
        const startY = sy * size + sy * 2 + 1;
        const xmult = (isHalfTile === true ? 0.5 : 1);
        gfx.drawImage(gfx.ctx[layer], sheet, startX, startY, size * xmult, size, x, y, size * xmult, size);
    },
    DrawMap: function(centerx, centery) {
        const mapImg = gfx.spritesheets["map"];
        const w = collisions[0].length;
        const h = collisions.length;
        const offset = {
            x: centerx - (gfx.tileWidth / 2), //Math.min(w - gfx.tileWidth, Math.max(centerx - (gfx.tileWidth / 2), 0)),
            y: centery - (gfx.tileHeight / 2), //Math.min(h - gfx.tileHeight, Math.max(centery - (gfx.tileHeight / 2), 0))
        };
        for(let y = 0; y < gfx.tileHeight; y++) {
            for(let x = 0; x < gfx.tileWidth; x++) {
                const ix = offset.x + x, iy = offset.y + y;
                if(ix < 0 || iy < 0 || ix >= collisions[0].length || iy >= collisions.length) {
                    gfx.DrawTileToGrid("map0", x, y, "background");
                } else {
                    gfx.DrawTileToGrid("map" + collisions[iy][ix], x, y, "background");
                }
            }
        }
        return offset;
    },
    DrawFullImage: function(store, layer) {
        layer = layer || "background";
        const storeImg = gfx.spritesheets[store];
        gfx.drawImage(gfx.ctx[layer], storeImg, 0, 0, gfx.canvasWidth, gfx.canvasHeight, 0, 0, gfx.canvasWidth, gfx.canvasHeight);
        return true;
    },
    drawImage: function(ctx, image, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH) {
        ctx.drawImage(image, srcX * gfx.scale, srcY * gfx.scale, srcW * gfx.scale, srcH * gfx.scale, dstX * gfx.scale, dstY * gfx.scale, dstW * gfx.scale, dstH * gfx.scale);  
    },
    numberDeltas: { "1": [1, 0], "2": [2, 0], "3": [3, 0], "4": [4, 0], "5": [5, 0], "6": [1, 1], "7": [2, 1], "8": [3, 1], "9": [4, 1], "0": [5, 1] }
};