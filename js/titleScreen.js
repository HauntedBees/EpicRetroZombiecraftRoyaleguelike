const title = {
    idx = 0, inHelp: false, timer: -1, secs: 0, endState: 0, isTitle: true, 
    setup: function() {
        gfx.DrawFullImage("title");
        this.idx = 0; this.inHelp = false; this.timer = -1;
        this.DrawOptions();
    },
    DrawOptions: function() {
        gfx.clearSome(["menuA", "menutext"]);
        title.DrawAction("Play", 0.5, 11, title.idx === 0, 2);
        title.DrawAction("Spectate", 3.5, 11, title.idx === 1, 4);
        title.DrawAction("What the fuck", 8.5, 11, title.idx === 2, 7, true);
    },
    DrawAction: function(text, x, y, selected, len, eh) {
        const prefix = selected ? "Ssel" : "sel";
        gfx.DrawTileToGrid(prefix + "L", x, y, "menuA");
        const actLen = len;
        while(len-- > 1) {
            gfx.DrawTileToGrid(prefix + "M", x + len, y, "menuA");
        }
        gfx.DrawTileToGrid(prefix + "R", x + actLen - (eh ? 0.75 : 0.5), y, "menuA");
        gfx.WriteText(text, x * 16, y * 16);
    },
    clean: function() { gfx.clearAll(); clearInterval(title.timer); },
    mouseMove: function(pos) { return true; },
    click: function(pos) { return true; },
    Cancel: function() {
        if(!title.inHelp) { return false; }
        clearInterval(title.timer);
        gfx.clearLayer("menuB");
        title.DrawOptions();
        title.inHelp = false;
        title.endState = 0;
        return true;
    },
    ShowNo: function() {
        title.inHelp = true;
        gfx.clearSome(["menuA", "menutext"]);
        gfx.DrawFullImage("down", "menuB");
    },
    GameEnded: function(endState) {
        if(game.endState > 0) { return; }
        game.Transition(worldmap, title);
        title.setup();
        title.inHelp = true;
        gfx.clearSome(["menuA", "menutext"]);
        title.secs = 30; title.endState = endState;
        title.timer = setInterval(title.GameEndTimer, 1000);
        title.GameEndTimer();
    },
    GameEndTimer: function() {
        gfx.clearSome(["menuA", "menutext"]);
        gfx.DrawFullImage("end", "menuB");
        title.secs -= 1;
        if(title.secs <= 0) {
            gfx.WriteText("A new game has started.", 1, 180, "#FFFFFF");
        } else {
            gfx.WriteText("New game starts in ~" + title.secs + "s.", 1, 180, "#FFFFFF");
        }
        switch(title.endState) {
            case 1: 
                gfx.WriteText("Y'all are stupid.", 2, 120, "#FFFFFF");
                gfx.WriteText("Everybody died. Nobody won.", 2, 160, "#FFFFFF");
                break;
            case 2: 
                gfx.WriteText("HUMANS WON!", 2, 120, "#FFFFFF");
                gfx.WriteText("All the zombies are dead.", 2, 160, "#FFFFFF");
                break;
            case 3: 
                gfx.WriteText("ZOMBIES WON!", 2, 120, "#FFFFFF");
                gfx.WriteText("All the humans have been zombified.", 2, 160, "#FFFFFF");
                break;
        }
    },
    TryJoinGame: function(active) {
        if(!active) { title.ShowNo(); return; }
        client.notPlayer = false;
        client.isSpectator = false;
        game.Transition(title, worldmap);
    },
    TrySpectate: function(active) {
        if(!active) { title.ShowNo(); return; }
        client.notPlayer = true;
        client.isSpectator = true;
        player.x = Math.floor(Math.random() * game.mapw);
        player.y = Math.floor(Math.random() * game.maph);
        game.Transition(title, worldmap);
    },
    keyPress: function(key) {
        let isEnter = false;
        let pos = title.idx;
        switch(key) {
            case client.controls.left: pos--; break;
            case client.controls.right: pos++; break;
            case client.controls.confirm:
            case client.controls.pause: isEnter = true; break;
            case client.controls.cancel: return this.Cancel();
        }
        if(pos < 0 || pos > 2) { return false; }
        if(!title.inHelp) {
            title.idx = pos;
            title.DrawOptions();
        }
        if(isEnter) {
            if(title.inHelp) {
                title.Cancel();
            } else if(title.idx === 2) {
                title.inHelp = true;
                gfx.clearSome(["menuA", "menutext"]);
                gfx.DrawFullImage("how", "menuB");
            } else if(title.idx === 1) { // spectate
                ajax.IsGameActive(title.TrySpectate);
            } else if(title.idx === 0) { // play
                ajax.IsGameActive(title.TryJoinGame);
            }
        }
    }
};