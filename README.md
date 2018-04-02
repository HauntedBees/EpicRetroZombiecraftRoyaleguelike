# Epic Retro Zombiecraft Royaleguelike - but also there's farming

A bad April Fool's Day 2018 joke. AGPLv3. Read index.html or somefink.
G
# How it works

## Schema

* **BaseMap** doesn't change unless you change the actual map itself. It contains data about the map itself.
* **AdditionalMap** is cleared and repopulated with each game and contains dynamic objects and such.
* **GameInfo** contains data about the current active game and previous sessions.
* **Player** contains all players in the current game.
* **Inventory** maps players to inventory items (represented as numbers).
* **AttemptedActions** is where player actions go until the end of the round. At the end of each round, all actions in here are processed, then the table is cleared.

## Game Logic

* **host.html** and **erzcrHost.php** are for the server host to control - you should probably put these in a password-protected part of your server or something. This exists because my website host doesn't let me schedule cron jobs. *NewGame* starts up a new active game, and every 20 seconds (this number can be configured), *AdvanceRound* is called to move on to the next round after processing all actions in the  **AttemptedActions** table. All actions in this table are validated when inserted (i.e. preventing a player from using an item they do not have). Each action is then executed in order based on the action type then by time the action was pushed to the database (for example - "move" actions occur before "attack" actions, so players can dodge, and older actions are executed first). Additional validation is done here to prevent invalid actions (i.e. if two people grab the same item in their turn, only one of them will get it).
* **epic.html** and **erzcr.php** are what players use and interact with. *CreatePlayer* is called when a new player tries to join the game. *GetMap* is called at the start of every round. When the user tries to perform any action, it is validated with a call to *TryAction*. There are client-side checks, but, y'know. Can't trust those.
* **index.html** is a fake crowdfunding page for April Foolery reasons.
* the **js folder** contains all the client-side source files.
  * **ajax.js** holds all calls to **errcr.php**.
  * **collisions.js** is just a 2D array containing info about the static map data.
  * **gfx.js** handles all drawing and writing to the HTML5 canvas.
  * **input.js** handles keyboard and gamepad input.
  * **main.js** is what handles transitions between screens as well as performing initial setup.
  * **titleScreen.js** holds the title screen and all error messages.
  * **worldmap.js** contains all the actual game stuff.

## License

All JavaScript, SQL, and PHP code is AGPLv3 licensed. *sheet.png* is CC-BY-SA 4.0. The rest all use a public domain image for the background and then there's text on it. Those are CC0. That probably covers everything.
