const url = "erzcr.php/";
const optsGet = { method: "GET", headers: { "Accept-Encoding": "gzip" } };
let lastGetMapCalled = 0;
const ajax = {
    IsGameActive: function(success) {
        fetch(url + "Active/", optsGet).then(r => r.json()).then(function (body) {
            success(body.active === 1);
        });
    },
    GetMap: function() {
        if(lastGetMapCalled !== 0) {
            const now = new Date();
            const dt = now - lastGetMapCalled;
            if(dt < 1000) {
                clearInterval(client.clockInterval);
                client.clockInterval = setInterval(worldmap.DrawTimer, 100);    
                return;
            }
        }
        lastGetMapCalled = new Date();
        if(game.currentInputHandler.isTitle) { return; }
        fetch(url + "GetMap/", optsGet).then(r => r.json()).then(function (body) {
            if(body.success) {
                if(body.endState > 0 && title.endState === 0) {
                    title.GameEnded(body.endState);
                } else {
                    worldmap.MaybeUpdateRound(body.round, body.you, body.yourShit, body.time);
                    worldmap.RepopulateMap(body.data);
                }
            } else {
                game.Transition(worldmap, title);
                title.inHelp = true;
                gfx.clearSome(["menuA", "menutext"]);
                gfx.DrawFullImage("down", "menuB");
            }
        });
    },
    CreatePlayer: function() {
        fetch(url + "CreatePlayer/", optsGet).then(r => r.json()).then(function (body) {
            if(body.success) {
                if(body.endState > 0 && title.endState === 0) {
                    title.GameEnded(body.endState);
                    return;
                }
                worldmap.SetPlayer(body.you);
                worldmap.MaybeUpdateRound(body.round, body.you, body.yourShit, body.time);
                worldmap.RepopulateMap(body.data);
            } else {
                game.Transition(worldmap, title);
                title.inHelp = true;
                gfx.clearSome(["menuA", "menutext"]);
                if(body.full) { // server is full
                    gfx.DrawFullImage("spectate", "menuB");
                } else { // regular error
                    gfx.DrawFullImage("down", "menuB");
                }
            }
        });
    },
    TryAction: function(action, x, y, success, error, addtl) {
        const body = { round: player.round, action: action, x: x, y: y };
        if(addtl) { body.addtl = addtl; }
        const optsPost = {
            method: "POST",
            headers: { "Accept-Encoding": "gzip" },
            body: JSON.stringify(body)
        };
        fetch(url + "TryAction/", optsPost).then(r => r.json()).then(function (body) {
            if(body.success) { success(); }
            else { error(); }
        });
    }
}