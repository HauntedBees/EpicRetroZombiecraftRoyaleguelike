const player = {
    x: 25, y: 25, id: 0, moveRange: 2, dx: 0, dy: 0, choiceDir: -1, selPos: -1,
    actionState: 0, // 0 = selecting, 1 = move, 2 = attack, 3 = grab, 4 = farm
    selIdx: 0, actions: [], obj: null, inventory: [],
    round: -1, timeInRound: 20, roundStartTime: 0
};
const client = {
    controltype: 1, isSpectator: true, clockInterval: -1, notPlayer: false, numTries: 999,
    controls: { up: "w", left: "a", down: "s", right: "d", confirm: " ", cancel: "q",  pause: "Enter" },
    keyboardcontrols: { up: "w", left: "a", down: "s", right: "d", confirm: " ", cancel: "q",  pause: "Enter" },
    gamepadcontrols: { up: "Gamepad12", left: "Gamepad14", down: "Gamepad13", right: "Gamepad15", confirm: "Gamepad0", cancel: "Gamepad1",  pause: "Gamepad9" }
};
const equips = [34, 35, 36];
const plants = [37, 38, 39, 40];
const placeables = [41];
const eatables = [50, 51, 52, 53];
const worldmap = {
    objs: [], 
    setup: function() {
        worldmap.DrawClock();
        if(client.notPlayer) {
            worldmap.SetSpectator();
        } else {
            ajax.CreatePlayer();
        }
        //worldmap.ShowAvailableActions();
    },

    ShowAvailableActions: function() {
        gfx.clearSome(["menuA", "menutext"]);
        if(client.notPlayer) { return; }

        const actions = ["Move", "Attack"];
        if(player.health <= 0) {
            return;
        } else {
            let hasCorpsesNearby = false;
            const hasObjsNearby = worldmap.objs.some(e => {
                if(e.type >= 100) {
                    if(e.type != 100 || e.health > 0) { return false; } // you can loot corpses!
                    if(e.state === 0) { hasCorpsesNearby = true; }
                } else if(e.type < 10) {
                    if(e.type >= 1 && e.type <= 4) {
                        let valid = false;
                        switch(e.type) {
                            case 1: valid = e.state >= 10; break;
                            case 2: valid = e.state >= 5; break;
                            case 3: valid = e.state >= 10; break;
                            case 4: valid = e.state >= 10; break;
                        }
                        if(!valid) { return false; }
                    } else {
                        return false;
                    }
                }
                let dx = Math.abs(e.x - player.x);
                let dy = Math.abs(e.y - player.y);
                return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
            });
            if(hasObjsNearby) { actions.push("Grab"); }
            if(player.zombie === 1 && hasCorpsesNearby) { actions.push("Zombify"); }
            if(player.inventory.length > 0) {
                if(player.inventory.some(e => eatables.indexOf(e.item) >= 0)) {
                    actions.push("Eat");
                }
                if(player.inventory.some(e => equips.indexOf(e.item) >= 0)) {
                    actions.push("Equip");
                }
                if(player.inventory.some(e => plants.indexOf(e.item) >= 0)) {
                    actions.push("Plant");
                }
                if(player.inventory.some(e => placeables.indexOf(e.item) >= 0)) {
                    actions.push("Place");
                }
                actions.push("Toss");
                if(player.inventory.some(e => e.item === 20) && player.inventory.some(e => e.item === 21)) {
                    actions.push("Lootbox");
                }
            }
        }

        player.actions = actions;
        const startY = 7.5 - (actions.length / 2);
        for(let i = 0; i < actions.length; i++) {
            worldmap.DrawAction(actions[i], 9.5, startY + i, i === player.selIdx);
        }
    },
    DrawAction: function(text, x, y, selected, long) {
        const prefix = selected ? "Ssel" : "sel";
        gfx.DrawTileToGrid(prefix + "L", x, y, "menuA");
        gfx.DrawTileToGrid(prefix + "M", x + 1, y, "menuA");
        gfx.DrawTileToGrid(prefix + "M", x + 2, y, "menuA");
        if(long) {
            gfx.DrawTileToGrid(prefix + "M", x + 3, y, "menuA");
            gfx.DrawTileToGrid(prefix + "M", x + 4, y, "menuA");
            gfx.DrawTileToGrid(prefix + "R", x + 4.5, y, "menuA");
        } else {
            gfx.DrawTileToGrid(prefix + "R", x + 3, y, "menuA");
        }
        gfx.WriteText(text, x * 16, y * 16);
    },

    ShowAttackRange: function() {
        if(player.choiceDir === -1) { return false; }
        let dx = 0, dy = 0;
        switch(player.choiceDir) {
            case 0: dy = -1; break;
            case 1: dx = -1; break;
            case 2: dy = 1; break;
            case 3: dx = 1; break;
        }
        if(player.equipment === 0 || player.equipment === 34) {
            gfx.DrawTileToGrid("availableSpace", 8 + dx, 7 + dy, "menuA");
        } else if(player.equipment === 36) { // sword
            if(dx === 0) { // attacking up or down
                gfx.DrawTileToGrid("availableSpace", 7, 7 + dy, "menuA");
                gfx.DrawTileToGrid("availableSpace", 8, 7 + dy, "menuA");
                gfx.DrawTileToGrid("availableSpace", 9, 7 + dy, "menuA");
            } else if(dy === 0) { // attacking left or right
                gfx.DrawTileToGrid("availableSpace", 8 + dx, 6, "menuA");
                gfx.DrawTileToGrid("availableSpace", 8 + dx, 7, "menuA");
                gfx.DrawTileToGrid("availableSpace", 8 + dx, 8, "menuA");
            }
        } else if(player.equipment === 35) { // bow
            for(let i = 1; i < 7; i++) {
                gfx.DrawTileToGrid("availableSpace", 8 + dx * i, 7 + dy * i, "menuA");
            }
        }
    },
    ShowDirections: function() {
        gfx.clearSome(["menuA", "menutext"]);
        worldmap.DrawAction("E: Confirm", 5.75, 11.5, true, true);
        worldmap.DrawAction("Q: Go Back", 5.75, 12.5, true, true);
        gfx.DrawTileToGrid((player.choiceDir === 0 ? "Sdir0": "dir0"), 8, 6, "menuA");
        gfx.DrawTileToGrid((player.choiceDir === 1 ? "Sdir1": "dir1"), 7, 7, "menuA");
        gfx.DrawTileToGrid((player.choiceDir === 2 ? "Sdir2": "dir2"), 8, 8, "menuA");
        gfx.DrawTileToGrid((player.choiceDir === 3 ? "Sdir3": "dir3"), 9, 7, "menuA");
    },
    ShowMoveLocations: function() {
        gfx.clearSome(["menuA", "menutext"]);
        worldmap.DrawAction("E: Confirm", 5.75, 11.5, true, true);
        worldmap.DrawAction("Q: Go Back", 5.75, 12.5, true, true);
        if(player.moveRange >= 1) { // center = 8, 7
            if(worldmap.IsValidLocation(player.x - 1, player.y)) { gfx.DrawTileToGrid("availableSpace", 7, 7, "menuA"); }
            if(worldmap.IsValidLocation(player.x + 1, player.y)) { gfx.DrawTileToGrid("availableSpace", 9, 7, "menuA"); }
            if(worldmap.IsValidLocation(player.x, player.y - 1)) { gfx.DrawTileToGrid("availableSpace", 8, 6, "menuA"); }
            if(worldmap.IsValidLocation(player.x, player.y + 1)) { gfx.DrawTileToGrid("availableSpace", 8, 8, "menuA"); }
        }
        if(player.moveRange >= 2) {
            if(worldmap.IsValidLocation(player.x - 2, player.y)) { gfx.DrawTileToGrid("availableSpace", 6, 7, "menuA"); }
            if(worldmap.IsValidLocation(player.x + 2, player.y)) { gfx.DrawTileToGrid("availableSpace", 10, 7, "menuA"); }
            if(worldmap.IsValidLocation(player.x, player.y - 2)) { gfx.DrawTileToGrid("availableSpace", 8, 5, "menuA"); }
            if(worldmap.IsValidLocation(player.x, player.y + 2)) { gfx.DrawTileToGrid("availableSpace", 8, 9, "menuA"); }
            if(worldmap.IsValidLocation(player.x + 1, player.y + 1)) { gfx.DrawTileToGrid("availableSpace", 9, 8, "menuA"); }
            if(worldmap.IsValidLocation(player.x - 1, player.y + 1)) { gfx.DrawTileToGrid("availableSpace", 7, 8, "menuA"); }
            if(worldmap.IsValidLocation(player.x + 1, player.y - 1)) { gfx.DrawTileToGrid("availableSpace", 9, 6, "menuA"); }
            if(worldmap.IsValidLocation(player.x - 1, player.y - 1)) { gfx.DrawTileToGrid("availableSpace", 7, 6, "menuA"); }
        }
    },
    IsValidLocation: function(x, y) {
        const mapDetail = collisions[y][x];
        if(mapDetail === 0) { return false; }
        if(mapDetail === 5 && !player.canWater) {
            return worldmap.objs.some(e => e.x === x && e.y === y && e.type === -1);
        }
        return !worldmap.objs.some(e => e.x === x && e.y === y && e.id !== player.id);
    },

    DrawClock: function() {
        gfx.DrawTileToGrid("clockUL", 0, 0, "menucursorA");
        gfx.DrawTileToGrid("clockUR", 1, 0, "menucursorA");
        gfx.DrawTileToGrid("clockLL", 0, 1, "menucursorA");
        gfx.DrawTileToGrid("clockLR", 1, 1, "menucursorA");
        //this.DrawTimer();
    },
    DrawTimer: function() {
        player.timeInRound = worldmap.GetRemainingTime();
        if(player.timeInRound <= -0.15) {
            clearInterval(client.clockInterval);
            client.numTries = 2;
            ajax.GetMap();
            return;
        }
        gfx.clearLayer("menucursorB");
        const ctx = gfx.ctx["menucursorB"];
        const theta = (1 - player.timeInRound / game.sRound) * Math.PI * 2 - Math.PI/2;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(64, 64);
        ctx.lineTo(64 + 42 * Math.cos(theta), 64 + 42 * Math.sin(theta));
        ctx.stroke();
    },

    SetPlayer: function(p) {
        client.isSpectator = false;
        player.id = p.id;
        player.x = p.x;
        player.y = p.y;
        player.timeInRound = -1;
        player.round = -1;
    },
    SetSpectator: function() {
        client.isSpectator = true;
        ajax.GetMap();
    },
    RepopulateMap: function(objs) {
        worldmap.objs = objs;
        worldmap.DrawMap();
    },
    DrawMap: function() {
        gfx.clearSome(["background", "characters", "foreground", "menuB"]);
        const offset = gfx.DrawMap(player.x, player.y);
        worldmap.objs.forEach(e => {
            const x = e.x - offset.x, y = e.y - offset.y;
            if(x < 0 || y < 0 || x >= game.tilew || y >= game.tileh) { return; }
            if(e.type === 0 || e.type === -1) { // Standard Objects
                const type = collisions[e.y][e.x];
                gfx.DrawTileToGrid("obj" + type, x, y, "characters");
            } else if(e.type === 100) { // Players
                const isZombie = e.state === 1;
                const skin = (isZombie ? "pz" : "p") + e.skin;
                if(e.id === player.id) {
                    const px = x + player.dx, py = y + player.dy;
                    player.obj = e;
                    if(e.health <= 0) {
                        client.isSpectator = true;
                        if(isZombie) { gfx.DrawTileToGrid("corpseZombie", px, py, "characters"); }
                        else { gfx.DrawTileToGrid("corpseHuman", px, py, "characters"); }
                    } else {
                        gfx.DrawTileToGrid(skin, px, py, "menuB");
                        if(e.hat >= 0) { gfx.DrawTileToGrid("hat" + e.hat, px, py, "menuB"); }
                        if(e.shirt >= 0) { gfx.DrawTileToGrid("shirt" + e.shirt, px, py, "menuB"); }
                        if(e.pants >= 0) { gfx.DrawTileToGrid("pants" + e.pants, px, py, "menuB"); }
                    }
                } else {
                    if(e.health <= 0) {
                        if(isZombie) { gfx.DrawTileToGrid("corpseZombie", x, y, "characters"); }
                        else { gfx.DrawTileToGrid("corpseHuman", x, y, "characters"); }
                    } else {
                        gfx.DrawTileToGrid(skin, x, y, "characters");
                        if(e.hat >= 0) { gfx.DrawTileToGrid("hat" + e.hat, x, y, "characters"); }
                        if(e.shirt >= 0) { gfx.DrawTileToGrid("shirt" + e.shirt, x, y, "characters"); }
                        if(e.pants >= 0) { gfx.DrawTileToGrid("pants" + e.pants, x, y, "characters"); }
                    }
                }
            } else if(e.type <= 10) {
                if(e.type === 5) {
                    gfx.DrawTileToGrid("bricks" + e.state, x, y, "characters");
                } else if(e.type === 1) {
                    if(e.state < 5) { gfx.DrawTileToGrid("leek0", x, y, "characters"); }
                    else if(e.state < 10) { gfx.DrawTileToGrid("leek1", x, y, "characters"); }
                    else { gfx.DrawTileToGrid("item50", x, y, "characters"); }
                } else if(e.type === 2) {
                    if(e.state <= 2) { gfx.DrawTileToGrid("carrot0", x, y, "characters"); }
                    else if(e.state <= 4) { gfx.DrawTileToGrid("carrot1", x, y, "characters"); }
                    else { gfx.DrawTileToGrid("item51", x, y, "characters"); }
                } else if(e.type === 3 || e.type === 4) {
                    const dispType = e.type === 3 ? "apple" : "banana";
                    if(e.state <= 5) { gfx.DrawTileToGrid(dispType + "0", x, y, "characters"); }
                    else if(e.state < 10) { gfx.DrawTileToGrid(dispType + "1", x, y, "characters"); }
                    else { gfx.DrawTileToGrid(dispType + "2", x, y, "characters"); }
                }
            } else {
                gfx.DrawTileToGrid("item" + e.type, x, y, "characters");
            }
        });
        worldmap.DrawInventory();
        worldmap.DrawDangerRadius(offset);
    },
    DrawDangerRadius: function(offset) {
        const roundPrefix = 60;
        if(player.round < roundPrefix) { return; }
        const range = Math.floor((player.round - roundPrefix) / 4);
        const left = range, right = game.mapw - range;
        const top = range, bottom = game.maph - range;
        for(let x = 0; x < game.mapw; x++) {
            for(let y = 0; y < game.maph; y++) {
                if(x > left && x < right && y > top && y < bottom) { continue; }
                const rx = x - offset.x, ry = y - offset.y;
                if(rx < 0 || ry < 0 || rx >= game.tilew || ry >= game.tileh) { continue; }
                gfx.DrawTileToGrid("badZone", rx, ry, "foreground");
            }
        }
    },
    DrawGhost: function() {
        gfx.clearLayer("menuC");
        const px = 8 + player.dx, py = 7 + player.dy;
        const isZombie = player.obj.state === 1;
        const skin = (isZombie ? "pz" : "p") + player.obj.skin;
        gfx.DrawTileToGrid(skin, px, py, "menuC");
        if(player.obj.hat >= 0) { gfx.DrawTileToGrid("hat" + player.obj.hat, px, py, "menuC"); }
        if(player.obj.shirt >= 0) { gfx.DrawTileToGrid("shirt" + player.obj.shirt, px, py, "menuC"); }
        if(player.obj.pants >= 0) { gfx.DrawTileToGrid("pants" + player.obj.pants, px, py, "menuC"); }
    },
    RedrawPlayer: function() {
        if(player.obj === null) { return; }
        gfx.clearLayer("menuB");
        const px = 8 + player.dx, py = 7 + player.dy;
        const isZombie = player.obj.state === 1;
        const skin = (isZombie ? "pz" : "p") + player.obj.skin;
        gfx.DrawTileToGrid(skin, px, py, "menuB");
        if(player.obj.hat >= 0) { gfx.DrawTileToGrid("hat" + player.obj.hat, px, py, "menuB"); }
        if(player.obj.shirt >= 0) { gfx.DrawTileToGrid("shirt" + player.obj.shirt, px, py, "menuB"); }
        if(player.obj.pants >= 0) { gfx.DrawTileToGrid("pants" + player.obj.pants, px, py, "menuB"); }
        worldmap.DrawInventory();
    },
    clean: function() { clearInterval(client.clockInterval); client.numTries = -999; gfx.clearAll(); },
    mouseMove: function(pos) {
        return true;
    },
    click: function(pos) {
        return true;
    },
    Cancel: function() {
        if(player.actionState === 51) {
            gfx.clearSome(["menuA", "menutext"]);
            player.actionState = 5;
            player.choiceDir = -1;
            worldmap.DrawInventory();
        } else if(player.actionState === 61) {
            gfx.clearSome(["menuA", "menutext"]);
            player.actionState = 6;
            player.choiceDir = -1;
            worldmap.DrawInventory();
        } else if(player.actionState >= 1 && player.actionState <= 7) {
            player.actionState = 0;
            player.dx = 0; player.dy = 0; player.choiceDir = -1; player.selPos = -1;
            worldmap.RedrawPlayer();
            worldmap.ShowAvailableActions();
        }
        return true;
    },
    GetRemainingTime: function() {
        const now = new Date();
        const dt = (now - player.roundStartTime);
        return game.sRound - dt / 1000;
    },
    DrawInventory: function() {
        if(client.notPlayer) { return; }
        for(let x = 0; x < game.tilew; x++) {
            gfx.DrawTileToGrid("ibg0", x, 0, "menuB");
            gfx.DrawTileToGrid("ibg0", x, 1, "menuB");
            gfx.DrawTileToGrid("ibg1", x, 2, "menuB");
        }
        for(let i = 0; i < player.inventory.length; i++) {
            const e = player.inventory[i];
            const x = (i % 13), y = Math.floor(i / 13);
            gfx.DrawTileToGrid("item" + e.item, 2 + x, y, "menuB");
            gfx.DrawItemNumber(e.amount, 2 + x, y, "menuB");
            if(player.selPos === i) {
                gfx.DrawTileToGrid("select", 2 + x, y, "menuB");
            }
        }
        gfx.DrawTileToGrid("select", 0, 2, "menuB");
        if(player.equipment === 0) {
            if(player.zombie) {
                gfx.DrawTileToGrid("bite", 0, 2, "menuB");
            } else {
                gfx.DrawTileToGrid("fist", 0, 2, "menuB");
            }
        } else { gfx.DrawTileToGrid("item" + player.equipment, 0, 2, "menuB"); }
        gfx.DrawItemNumber(0, 0, 2.125, "menuB");
        for(let i = 0; i < 10; i++) {
            const sprite = (Math.round(player.health / 10) > i) ? "HP1" : "HP0";
            gfx.DrawTileToGrid(sprite, 1 + i * 0.5, 2, "menuB");
        }
    },
    MaybeUpdateRound: function(newRound, newYou, newItems, time) {
        //if(player.round === newRound && client.numTries-- > 0) {
            //if(title.endState === 0) { setTimeout(ajax.GetMap, 2000); }
            //return;
        //} else if(client.numTries <= 0) {
        if(client.numTries <= 0) {
            if(client.numTries <= -999) { return; }
            game.Transition(worldmap, title);
            title.inHelp = true;
            gfx.clearSome(["menuA", "menutext"]);
            gfx.DrawFullImage("down", "menuB");
            return;
        }
        client.numTries = 0;
        gfx.clearLayer("menuC");
        player.roundStartTime = new Date(time * 1000);
        player.selIdx = 0;
        player.timeInRound = worldmap.GetRemainingTime();
        player.inventory = newItems;
        player.round = newRound;
        player.actionState = 0;
        if(!client.notPlayer) {
            if(client.isSpectator) {
                const curx = player.x, cury = player.y;
                Object.assign(player, newYou);
                if(player.health <= 0) { // stil dead
                    player.x = curx; player.y = cury;
                } else { // revived
                    client.isSpectator = false;
                }
            } else {
                Object.assign(player, newYou);
            }
            player.moveRange = ((player.status & 1) === 1 ? 2 : 1);
            player.canWater = (player.status & 2);
            worldmap.ShowAvailableActions();
            player.dx = 0; player.dy = 0; player.choiceDir = -1; player.selPos = -1;
            worldmap.RedrawPlayer();
            worldmap.ShowAvailableActions();
        }
        client.clockInterval = setInterval(worldmap.DrawTimer, 100);
    },
    MakeSelection: function() {
        const sel = player.actions[player.selIdx];
        switch(sel) {
            case "Move":
                player.actionState = 1;
                worldmap.ShowMoveLocations();
                return true;
            case "Attack":
                player.actionState = 2;
                worldmap.ShowDirections();
                return true;
            case "Grab":
                player.actionState = 3;
                worldmap.ShowDirections();
                return true;
            case "Toss":
                player.actionState = 4;
                player.selPos = 0;
                worldmap.DrawInventory();
                return true;
            case "Plant":
                player.actionState = 5;
                player.selPos = 0;
                worldmap.DrawInventory();
                return true;
            case "Place":
                player.actionState = 6;
                player.selPos = 0;
                worldmap.DrawInventory();
                return true;
            case "Equip":
                player.actionState = 7;
                player.selPos = 0;
                worldmap.DrawInventory();
                return true;
            case "Eat":
                player.actionState = 8;
                player.selPos = 0;
                worldmap.DrawInventory();
                return true;
            case "Zombify":
                player.actionState = 9;
                worldmap.ShowDirections();
                return true;
            case "Lootbox":
                worldmap.TrySubmitLootbox();
                return true;
        }
        return false;
    },
    ChangeSelection: function(dy) {
        const newPos = player.selIdx + dy;
        if(newPos < 0 || newPos >= player.actions.length) { return false; }
        player.selIdx = newPos;
        worldmap.ShowAvailableActions();
    },
    TryMove: function(pos) {
        const dx = pos.x - player.x, dy = pos.y - player.y;
        if((Math.abs(player.dx + dx) + Math.abs(player.dy + dy)) > player.moveRange) { return false; }
        if(!worldmap.IsValidLocation(player.x + player.dx + dx, player.y + player.dy + dy)) { return false; }
        player.dx += dx; player.dy += dy;
        worldmap.RedrawPlayer();
        return true;
    },
    TrySubmitMove: function() {
        if(player.dx === 0 && player.dy === 0) { return false; }
        ajax.TryAction("Move", player.dx, player.dy, worldmap.FinishMovement, worldmap.ErrorAction);
    },
    TryAim: function(pos, clearTilesOnly) {
        const dx = pos.x - player.x, dy = pos.y - player.y;
        if(dx != 0 && dy != 0) { return false; }
        if(clearTilesOnly) {
            if(!worldmap.IsValidLocation(player.x + player.dx + dx, player.y + player.dy + dy)) { return false; }
        }
        if(dy < 0) { player.choiceDir = 0; }
        else if(dx < 0) { player.choiceDir = 1; }
        else if(dy > 0) { player.choiceDir = 2; }
        else if(dx > 0) { player.choiceDir = 3; }
        worldmap.ShowDirections();
        return true;
    },
    TrySubmitLootbox: function() {
        if(!player.inventory.some(e=>e.item === 20) || !player.inventory.some(e=>e.item === 21)) { return false; }
        ajax.TryAction("Lootbox", 0, 0, worldmap.FinishLootbox, worldmap.ErrorAction);
    },
    FinishLootbox: function() {
        for(let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i].item;
            if(item !== 20 && item !== 21) { continue; }
            const x = (i % 13), y = Math.floor(i / 13);
            gfx.DrawTileToGrid("target", 2 + x, y, "menuC");
        }
        worldmap.FinishAction();
    },
    TrySubmitGrab: function() {
        if(player.choiceDir === -1) { return false; }
        let dx = 0, dy = 0;
        switch(player.choiceDir) {
            case 0: dy = -1; break;
            case 1: dx = -1; break;
            case 2: dy = 1; break;
            case 3: dx = 1; break;
        }
        ajax.TryAction("Grab", dx, dy, worldmap.FinishGrab, worldmap.ErrorAction);
    },
    TrySubmitZombify: function() {
        if(player.choiceDir === -1) { return false; }
        let dx = 0, dy = 0;
        switch(player.choiceDir) {
            case 0: dy = -1; break;
            case 1: dx = -1; break;
            case 2: dy = 1; break;
            case 3: dx = 1; break;
        }
        ajax.TryAction("Zombify", dx, dy, worldmap.FinishGrab, worldmap.ErrorAction);
    },
    TrySubmitAttack: function() {
        if(player.choiceDir === -1) { return false; }
        if(player.equipment === 35 && !player.inventory.some(e=> e.item === 32)) { return false; }
        let dx = 0, dy = 0;
        switch(player.choiceDir) {
            case 0: dy = -1; break;
            case 1: dx = -1; break;
            case 2: dy = 1; break;
            case 3: dx = 1; break;
        }
        ajax.TryAction("Attack", dx, dy, worldmap.FinishGrab, worldmap.ErrorAction);
    },
    TryMoveItemCursor: function(pos) {
        const dx = pos.x - player.x, dy = pos.y - player.y;
        if(dx == 0 && dy == 0) { return false; }
        const newPos = player.selPos + dx + 13 * dy;
        if(newPos >= player.inventory.length || newPos < 0) { return; }
        player.selPos = newPos;
        worldmap.DrawInventory();
    },
    TrySubmitToss: function() {
        if(player.selPos >= player.inventory.length || player.selPos < 0) { return false; }
        ajax.TryAction("Toss", player.inventory[player.selPos].item, 0, worldmap.FinishToss, worldmap.ErrorAction);
    },
    TrySubmitEat: function() {
        if(player.selPos >= player.inventory.length || player.selPos < 0) { return false; }
        if(eatables.indexOf(player.inventory[player.selPos].item) < 0) { return false; }
        ajax.TryAction("Eat", player.inventory[player.selPos].item, 0, worldmap.FinishToss, worldmap.ErrorAction);
    },
    TrySubmitEquip: function() {
        if(player.selPos >= player.inventory.length || player.selPos < 0) { return false; }
        if(equips.indexOf(player.inventory[player.selPos].item) < 0) { return false; }
        ajax.TryAction("Equip", player.inventory[player.selPos].item, 0, worldmap.FinishToss, worldmap.ErrorAction);
    },
    TrySubmitPlace: function() {
        if(player.selPos >= player.inventory.length || player.selPos < 0) { return false; }
        if(player.choiceDir === -1) { return false; }
        let dx = 0, dy = 0;
        switch(player.choiceDir) {
            case 0: dy = -1; break;
            case 1: dx = -1; break;
            case 2: dy = 1; break;
            case 3: dx = 1; break;
        }
        ajax.TryAction("Place", dx, dy, worldmap.FinishPlace, worldmap.ErrorAction, player.inventory[player.selPos].item);
    },
    FinishMovement: function() {
        worldmap.DrawGhost();
        worldmap.FinishAction();
    },
    FinishToss: function() {
        const x = (player.selPos % 13), y = Math.floor(player.selPos / 13);
        gfx.DrawTileToGrid("target", 2 + x, y, "menuC");
        worldmap.FinishAction();
    },
    FinishPlace: function() {
        const x = (player.selPos % 13), y = Math.floor(player.selPos / 13);
        gfx.DrawTileToGrid("target", 2 + x, y, "menuC");
        worldmap.FinishGrab();
    },
    FinishGrab: function() {
        let dx = 0, dy = 0;
        switch(player.choiceDir) {
            case 0: dy = -1; break;
            case 1: dx = -1; break;
            case 2: dy = 1; break;
            case 3: dx = 1; break;
        }
        gfx.DrawTileToGrid("target", 8 + dx, 7 + dy, "menuC");
        worldmap.FinishAction();
    },
    FinishAction: function() {
        gfx.clearSome(["menuA", "menutext"]);
        player.dx = 0; player.dy = 0;
        worldmap.RedrawPlayer();
        player.actionState = -1;
        player.selPos = -1;
    },
    ErrorAction: function() {
        console.log("oops");
    },
    keyPress: function(key) {
        let isEnter = false;
        const pos = { x: player.x, y: player.y };
        switch(key) {
            case client.controls.up: pos.y--; break;
            case client.controls.left: pos.x--; break;
            case client.controls.down: pos.y++; break;
            case client.controls.right: pos.x++; break;
            case client.controls.confirm:
            case client.controls.pause: isEnter = true; break;
            case client.controls.cancel: return this.Cancel();
        }
        if(pos.x < 0 || pos.x >= game.mapw || pos.y < 0 || pos.y >= game.maph) { return false; }
        if(isEnter && player.health <= 0) { return; }
        if(client.isSpectator) {
            player.x = pos.x; player.y = pos.y;
            worldmap.DrawMap();
        } else if(player.actionState === 0) {
            if(isEnter) { return worldmap.MakeSelection(); }
            else { return worldmap.ChangeSelection(pos.y - player.y); }
        } else if(player.actionState === 1) { // move
            if(isEnter) { worldmap.TrySubmitMove(); }
            else { return worldmap.TryMove(pos); }
        } else if(player.actionState === 2) { // attack
            if(isEnter) {
                worldmap.TrySubmitAttack();
            } else if(worldmap.TryAim(pos)) {
                worldmap.ShowAttackRange();
            }
        } else if(player.actionState === 3) { // grab
            if(isEnter) { worldmap.TrySubmitGrab(); }
            else { return worldmap.TryAim(pos); }
        } else if(player.actionState === 4) { // toss
            if(isEnter) { worldmap.TrySubmitToss(); }
            else { return worldmap.TryMoveItemCursor(pos); }
        } else if(player.actionState === 5) { // plant A
            if(isEnter) {
                if(plants.indexOf(player.inventory[player.selPos].item) < 0) { return false; }
                player.actionState = 51;
                worldmap.ShowDirections();
             } else { return worldmap.TryMoveItemCursor(pos); }
        } else if(player.actionState === 6) { // place A
            if(isEnter) {
                if(placeables.indexOf(player.inventory[player.selPos].item) < 0) { return false; }
                player.actionState = 61;
                worldmap.ShowDirections();
            } else { return worldmap.TryMoveItemCursor(pos); }
        } else if(player.actionState === 51 || player.actionState === 61) { // plant/place B
            if(isEnter) { worldmap.TrySubmitPlace(); }
            else { return worldmap.TryAim(pos, true); }
        } else if(player.actionState === 7) { // equip
            if(isEnter) { worldmap.TrySubmitEquip(); }
            else { return worldmap.TryMoveItemCursor(pos); }
        } else if(player.actionState === 8) { // eat
            if(isEnter) { worldmap.TrySubmitEat(); }
            else { return worldmap.TryMoveItemCursor(pos); }
        } else if(player.actionState === 9) { // zombify
            if(isEnter) { worldmap.TrySubmitZombify(); }
            else { return worldmap.TryAim(pos); }
        }
        return true;
    }
};