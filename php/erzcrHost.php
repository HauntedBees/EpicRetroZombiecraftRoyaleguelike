<?php
	header("Access-Control-Allow-Origin: *");
	header("Content-Type: application/json");
	if(!isset($_GET["function"])) { echo "{\"success\": false}"; exit; }
	function GetIP() { return $_SERVER["REMOTE_ADDR"]; }
	final class Db {
		protected static $dbInstance;
		public static function factory(){
			if(!self::$dbInstance){
				$c = parse_ini_file("config.ini", true);
				self::$dbInstance = new PDO($c["database"]["db"], $c["database"]["un"], $c["database"]["pwd"], [ 
					PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_STRINGIFY_FETCHES => false
				]);
			}
			return self::$dbInstance;
		}
	}
	class WebServiceMethods {
		private $pdo, $w, $h, $msg;
		private function GetValue($sql, $args = null) {
			$q = $this->pdo->prepare($sql);
			if($args != null) { $q->execute($args); }
			else { $q->execute(); }
			return $q->fetchColumn();
		}
		private function Execute($sql, $args = null) {
			$q = $this->pdo->prepare($sql);
			if($args != null) { $q->execute($args); }
			else { $q->execute(); }
		}
		private function GetRow($sql, $args = null) {
			$q = $this->pdo->prepare($sql);
			if($args != null) { $q->execute($args); }
			else { $q->execute(); }
			return $q->fetch();
		}
		private function IsCorrectRound($round) {
			return true;
		}
		private function GetPlayerInfo() {
			return $this->GetRow("SELECT id, x, y, status FROM Player WHERE ip = :ip", ["ip" => GetIP()]);
		}
		public function __construct() { $this->pdo = Db::factory(); $this->w = 85; $this->h = 76; $this->msg = []; }
		public function Fail() { echo "{\"success\": false}"; exit; }
        public function Test() { echo json_encode(["success" => true, "args" => func_get_args()]); }
        public function NewGame() {
            $key = func_get_args()[0];
            if($key !== "halfAssedSecurityKey") { $this->Fail(); }
            try {
                $this->Execute("UPDATE GameInfo SET active = 0 WHERE active = 1");
                $this->Execute("DELETE FROM Player");
                $this->Execute("DELETE FROM AdditionalMap");
                $this->Execute("DELETE FROM AttemptedActions");
                $this->Execute("DELETE FROM Inventory");

                $allWater = []; $allDeepWater = [];
                $q = $this->pdo->prepare("SELECT type, x, y FROM BaseMap WHERE type IN (0, 5)");
                $q->execute();
                while ($row = $q->fetch(PDO::FETCH_ASSOC)) {
                    $idx = $row["x"] * 1000 + $row["y"];
                    if($row["type"] === 5) {
                        $allWater[$idx] = true;
                    } else {
                        $allDeepWater[$idx] = true;
                    }
                }

				$maxObjs = rand(80, 300);
				$query = "INSERT INTO AdditionalMap(x, y, type, state) VALUES ";
				$allInserts = [];
				$usedCoords = [];
				for($i = $maxObjs; $i >= 0; $i--) {
					$x = rand(0, $this->w); $y = rand(0, $this->h);
					$idx = $x * 1000 + $y;
					if(!array_key_exists($idx, $usedCoords)) {
                        $usedCoords[$idx] = true;
                        if(array_key_exists($idx, $allWater)) {
                            $allInserts[] = "($x, $y, -1, 0)";
                        } else {
                            $allInserts[] = "($x, $y, 0, 0)";
                        }
					}
                }
                $itemsToDrop = [21, 21, 21, 20, 30, 30, 31, 31, 32, 32, 32, 34, 34, 35, 35, 36, 36, 37, 37, 38, 38, 39, 39, 40, 40, 41, 41, 41, 41, 5, 50, 51, 52, 53, 1, 2, 3, 4, 5];
                $initialItems = rand(90, 240);
                for($i = $initialItems; $i >= 0; $i--) {
					$x = rand(0, $this->w); $y = rand(0, $this->h);
					$idx = $x * 1000 + $y;
					if(!array_key_exists($idx, $usedCoords) && !array_key_exists($idx, $allDeepWater)) {
                        $usedCoords[$idx] = true;
                        $itemType = $itemsToDrop[array_rand($itemsToDrop)];
                        if(rand(1, 100) >= 90) {
                            $itemType = (rand(0, 10) >= 7 ? 20 : 21);
                        }
                        $allInserts[] = "($x, $y, $itemType, 0)";
					}
				}
				$query .= implode(", ", $allInserts);
				$q = $this->pdo->prepare($query);
                $q->execute();
                $this->Execute("INSERT INTO GameInfo (round, active, start, roundStart) VALUES (0, 1, NOW(), NOW())");
                $now = $this->GetValue("SELECT UNIX_TIMESTAMP(roundStart) AS roundStartTime FROM GameInfo WHERE active = 1");
                echo json_encode(["success" => true, "newTime" => $now]);
			} catch(Exception $e) {
				echo json_encode(["success" => false, "message" => $e->getMessage()]);
			}
        }
        private function EndGame($endState) {
            $this->Execute("UPDATE GameInfo SET endState = $endState, finish = NOW() WHERE active = 1");
            echo json_encode(["success" => true, "endGame" => true]);
            exit;
        }
        public function AdvanceRound() {
            $key = func_get_args()[0];
            if($key !== "halfAssedSecurityKey") { $this->Fail(); }
            $currentRound = $this->GetValue("SELECT round FROM GameInfo WHERE active = 1");
            if($currentRound > 100) { // let's see if the game is over
                $q = $this->pdo->prepare("SELECT CASE WHEN health <= 0 THEN 0 ELSE 1 END AS liveState, COUNT(*) AS amount FROM Player GROUP BY CASE WHEN health <= 0 THEN 0 ELSE 1 END");
                $q->execute();
                $livingPlayers = 0; $deadPlayers = 0;
                while ($row = $q->fetch(PDO::FETCH_ASSOC)) {
                    if($row["liveState"] === 0) {
                        $deadPlayers = $row["amount"];
                    } else {
                        $livingPlayers = $row["amount"];
                    }
                }
                $totalPlayers = $livingPlayers + $deadPlayers;
                if($totalPlayers === $deadPlayers) { $this->EndGame(1); } // everyone is dead
                else if($totalPlayers > 1) {
                    $livingZombies = $this->GetValue("SELECT COUNT(*) FROM Player WHERE health > 0 AND zombie = 1");
                    $livingHumans = $this->GetValue("SELECT COUNT(*) FROM Player WHERE health > 0 AND zombie = 0");
                    if($livingHumans === 0 & $livingZombies === 0) {
                        $this->EndGame(1); // everyone is dead but the previous condition didn't catch it for some reason?
                    } else if($livingHumans === 0) {
                        $this->EndGame(3); // zombies won
                    } else if($livingZombies === 0) {
                        $this->EndGame(2); // humans won
                    }
                }
            }

            $allThings = [];
			$sql = "SELECT x, y, 100 AS type, zombie AS state, id, health FROM Player";
			$sql .= " UNION SELECT x, y, type, state, 0, 0 FROM AdditionalMap WHERE type >= 0";
            $q = $this->pdo->prepare($sql);
			$q->execute();
            while ($row = $q->fetch(PDO::FETCH_ASSOC)) {
                $idx = $row["x"] * 1000 + $row["y"];
                $allThings[$idx] = [
                    "x" => $row["x"],
                    "y" => $row["y"],
                    "type" => $row["type"],
                    "id" => $row["id"],
                    "state" => $row["state"],
                    "health" => $row["health"]
                ];
            }

			$q = $this->pdo->prepare("SELECT a.userId, a.action, a.beforex, a.beforey, a.x, a.y, a.addtl, p.equipment, p.zombie FROM AttemptedActions a INNER JOIN Player p ON a.userId = p.id WHERE a.round = :round ORDER BY a.action ASC, a.actiontime ASC");
			$q->execute(["round" => $currentRound]);
            while ($row = $q->fetch(PDO::FETCH_ASSOC)) {
                switch($row["action"]) {
                    case 0: // plant
                        $this->ProcessPlacement($row, $allThings);
                        break;
                    case 1: // move
                        $this->ProcessMovement($row, $allThings);
                        break;
                    case 2: // grab
                        $this->ProcessGrab($row, $allThings);
                        break;
                    case 3: // eat
                        $this->ProcessEat($row);
                        break;
                    case 4: // attack
                        $this->ProcessAttack($row, $allThings);
                        break;
                    case 5: // toss
                        $this->ProcessToss($row);
                        break;
                    case 6: // equip
                        $this->ProcessEquip($row);
                        break;
                    case 7: // zombify
                        $this->ProcessZombify($row, $allThings);
                        break;
                    case 8: // lootbox
                        $this->ProcessLootbox($row);
                        break;
                }
            }

            $farmSQL = "UPDATE AdditionalMap a JOIN BaseMap m ON a.x = m.x AND a.y = m.y";
            $farmSQL .= " SET a.state = a.state + (CASE";
            $farmSQL .= "   WHEN m.type = 3 THEN 1";
            $farmSQL .= "   WHEN m.type = 4 THEN CASE WHEN a.type = 1 THEN 3 ELSE 1 END";
            $farmSQL .= "   WHEN m.type = 1 THEN CASE WHEN a.type = 4 THEN 3 ELSE 1 END";
            $farmSQL .= "   ELSE 2 END";
            $farmSQL .= ") WHERE a.type BETWEEN 1 AND 4";
            $this->Execute($farmSQL);

            $roundPrefix = 60;
            if($currentRound >= $roundPrefix) {
                $r = floor(($currentRound - $roundPrefix) / 4);
                $rw = $this->w - $r;
                $rh = $this->h - $r;
                $res = $this->Execute("UPDATE Player SET health = GREATEST(-10, health - 10) WHERE (x < $r) OR (x > $rw) OR (y < $r) OR (y > $rh)");
            }

            $this->Execute("UPDATE Player SET status = 0");
            $this->Execute("UPDATE Player p JOIN Inventory i ON p.id = i.player SET p.status = CASE WHEN i.item = 31 THEN p.status | 2 ELSE p.status END WHERE i.item = 31");
            $this->Execute("UPDATE Player p JOIN Inventory i ON p.id = i.player SET p.status = CASE WHEN i.item = 30 THEN p.status | 1 ELSE p.status END WHERE i.item = 30");

            $this->Execute("DELETE FROM AttemptedActions WHERE round = :round", ["round" => $currentRound]);
            $this->Execute("UPDATE GameInfo SET round = round + 1, roundStart = NOW() WHERE active = 1");
            $now = $this->GetValue("SELECT UNIX_TIMESTAMP(roundStart) AS roundStartTime FROM GameInfo WHERE active = 1");
            echo json_encode(["success" => true, "newTime" => $now, "results" => $this->msg]);
        }
        private function ProcessAttack($row, &$entities) {
            $weapon = $row["equipment"];
            $isZombie = $row["zombie"];
            $x = $row["x"]; $y = $row["y"];
            if($weapon === 0 || $weapon === 34) { // range = 1
                $this->TryDamage($isZombie, $x, $y, $weapon, $entities);
            } else if($weapon === 36) { // range = horizontal
                $dx = $x - $row["beforex"]; $dy = $y - $row["beforey"];
                if($dx != 0) {
                    $this->TryDamage(false, $x, $y - 1, $weapon, $entities);
                    $this->TryDamage(false, $x, $y, $weapon, $entities);
                    $this->TryDamage(false, $x, $y + 1, $weapon, $entities);
                } else if($dy != 0) {
                    $this->TryDamage(false, $x - 1, $y, $weapon, $entities);
                    $this->TryDamage(false, $x, $y, $weapon, $entities);
                    $this->TryDamage(false, $x + 1, $y, $weapon, $entities);
                }
            } else if($weapon === 35) { // range = 6 tiles forward
                // 32 = arrows
                $playerItemCount = $this->GetValue("SELECT amount FROM Inventory WHERE player = :p AND item = 32", ["p" => $row["userId"] ]);
                if($playerItemCount === false || $playerItemCount <= 0) { // imposter!
                    $this->msg[] = "Player doesn't even have this item!";
                    return;
                }
                $dx = $x - $row["beforex"]; $dy = $y - $row["beforey"];
                $lastX = $x; $lastY = $y;
                for($i = 0; $i < 6; $i++) {
                    $lastX = $x + $dx * $i;
                    $lastY = $y + $dy * $i;
                    $this->TryDamage(false, $lastX, $lastY, $weapon, $entities);
                }
                if($playerItemCount > 1) {
                    $this->Execute("UPDATE Inventory SET amount = amount - 1 WHERE player = :p AND item = 32", ["p" => $row["userId"]]);
                } else {
                    $this->Execute("DELETE FROM Inventory WHERE player = :p AND item = 32", ["p" => $row["userId"]]);
                }
                $newPosIdx = $lastX * 1000 + $lastY;
                if(rand(1, 10) >= 5 && !array_key_exists($newPosIdx, $entities)) { // drop arrows here
                    $this->Execute("INSERT INTO AdditionalMap (x, y, type, state) VALUES (:x, :y, 32, 0)", ["x" => $lastX, "y" => $lastY]);
                    $entities[$newPosIdx] = [
                        "x" => $lastX, "y" => $lastY,
                        "type" => 32, "id" => 0, "state" => 0
                    ];
                }
            }
        }
        private function TryDamage($isAttackerZombie, $x, $y, $weapon, &$entities) {
            $newPosIdx = $x * 1000 + $y;
            if(!array_key_exists($newPosIdx, $entities)) { return; } // Nothing Here!
            $type = $entities[$newPosIdx]["type"];
            if($type === 100) { // player
                $player = $entities[$newPosIdx];
                $hp = $player["health"];
                if($hp <= 0) { return; } // this friend is already dead
                $id = $player["id"];
                $isTargetZombie = ($player["state"] === 1);
                $damage = 0;
                if($weapon === 0) {
                    if($isAttackerZombie) { $damage = rand(12, 36); }
                    else { $damage = rand(10, 30); }
                } else if($weapon === 34) { $damage = rand(30, 40); } // dagger
                else if($weapon === 35 || $weapon === 36) { $damage = rand(12, 36); } // bow & sword
                $this->msg[] = "Did $damage damage.";
                $newHealth = $hp - $damage;
                if($newHealth <= 0) {
                    $newHealth = 0;
                    if($isAttackerZombie && $weapon === 0 && !$isTargetZombie) { // if you killed them with a bite, automatically infect them (unless they're already a zombie)
                        $this->Execute("UPDATE Player SET health = 50, zombie = 1 WHERE id = :p", ["p" => $id]);
                    } else { // otherwise they just dead
                        $this->Execute("UPDATE Player SET health = 0 WHERE id = :p", ["p" => $id]);
                    }
                } else {
                    $this->Execute("UPDATE Player SET health = :h WHERE id = :p", ["p" => $id, "h" => $newHealth]);
                }
            } else if($type === 5) { // brick wall
                if($entities[$newPosIdx]["state"] === 2 || $weapon === 34) { // destroy it!
                    $this->Execute("DELETE FROM AdditionalMap WHERE x = :x AND y = :y", ["x" => $x, "y" => $y]);
                    if(rand(1, 10) >= 7) { // drop a brick here
                        $this->Execute("INSERT INTO AdditionalMap (x, y, type, state) VALUES (:x, :y, 41, 0)", ["x" => $x, "y" => $y]);
                        $entities[$newPosIdx]["type"] = 41;
                        $entities[$newPosIdx]["state"] = 0;
                    } else {
                        unset($entities[$newPosIdx]);
                    }
                } else {
                    $this->Execute("UPDATE AdditionalMap SET state = state + 1 WHERE x = :x AND y = :y", ["x" => $x, "y" => $y]);
                }
            } else if($type >= 0 && $type <= 4) {
                if(($type > 0 && $type <= 2) || $weapon === 34 || $weapon === 36) { // any attack can destroy leeks and carrots, but sword/dagger needed for trees
                    if($type === 0) { // special logic for generics that might be trees
                        $below = $this->GetValue("SELECT type FROM BaseMap WHERE x = :x AND y = :y", ["x" => $x, "y" => $y]);
                        if($below < 1 || $below > 3) { return; } // 1 = palm tree, 2 = tree, 3 = cactus
                    }
                    $this->Execute("DELETE FROM AdditionalMap WHERE x = :x AND y = :y", ["x" => $x, "y" => $y]);
                    unset($entities[$newPosIdx]);
                }
            }
        }
        private function ProcessGrab($row, &$entities) {
            $newPosIdx = $row["x"] * 1000 + $row["y"];
            if(array_key_exists($newPosIdx, $entities)) { // if false, someone has already grabbed this
                $obj = $entities[$newPosIdx];
                $objType = $obj["type"];
                if($objType > 100) { return; } // that ain't an object you can acquire!
                if($objType === 100) {
                    $this->ProcessLooting($newPosIdx, $row, $entities);
                    return;
                }
                $isTree = false;
                if($objType < 10) {
                    if($objType >= 1 && $objType <= 4) {
                        $objState = $obj["state"];
                        $isValid = false;
                        switch($objType) {
                            case 1: $isValid = ($objState >= 10); break;
                            case 2: $isValid = ($objState >= 5); break;
                            case 3: $isValid = ($objState >= 10); $isTree = true; break;
                            case 4: $isValid = ($objState >= 10); $isTree = true; break;
                        }
                        if(!$isValid) { return; }
                        $objType += 49;
                    } else { return; }
                }
                $newAmount = rand(2, 10);
                if($objType === 32) { $newAmount = rand(5, 10); }
                else if(($objType >= 30 && $objType <= 36) || $objType === 20) { $newAmount = 1; }
                $alreadyHas = $this->GetValue("SELECT COUNT(*) FROM Inventory WHERE player = :p AND item = :t", ["p" => $row["userId"], "t" => $objType]);
                if($alreadyHas === 1) {
                    $this->Execute("UPDATE Inventory SET amount = amount + $newAmount WHERE player = :p AND item = :t", ["p" => $row["userId"], "t" => $objType]);
                } else {
                    $this->Execute("INSERT INTO Inventory (player, item, amount) VALUES (:p, :t, $newAmount)", ["p" => $row["userId"], "t" => $objType]);
                }
                if($isTree) {
                    $this->Execute("UPDATE AdditionalMap SET state = 7 WHERE x = :x AND y = :y", ["x" => $obj["x"], "y" => $obj["y"]]);
                } else {
                    $this->Execute("DELETE FROM AdditionalMap WHERE x = :x AND y = :y", ["x" => $obj["x"], "y" => $obj["y"]]);
                }
                unset($entities[$newPosIdx]);
            }
        }
        private function ProcessZombify($row, &$entities) {
            $newPosIdx = $row["x"] * 1000 + $row["y"];
            if(array_key_exists($newPosIdx, $entities)) { // if false, someone has already grabbed this
                $obj = $entities[$newPosIdx];
                $objType = $obj["type"];
                if($objType !== 100) { return; } // that ain't a corpse!
                if($obj["health"] > 0) { return; } // IT'S STILL ALIVE!
                $this->Execute("UPDATE Player SET health = 50, zombie = 1 WHERE id = :p", ["p" => $obj["id"]]);
            }
        }
        private function ProcessLooting($newPosIdx, $row, &$entities) {
            $obj = $entities[$newPosIdx];
            if($obj["health"] > 0) { return false; }
            $victim = $obj["id"]; $looter = (int)$row["userId"];
            $sql = "UPDATE Inventory i JOIN Inventory j ON j.item = i.item AND j.player = :victim AND i.player = :looter";
            $sql .= " SET i.amount = i.amount + j.amount, j.amount = 0";
            $this->Execute($sql, ["victim" => $victim, "looter" => $looter]);
            $sql = "INSERT INTO Inventory (player, item, amount)";
            $sql .= " SELECT $looter, item, amount FROM Inventory WHERE amount > 0 AND player = :victim";
            $this->Execute($sql, ["victim" => $victim]);
            $this->Execute("DELETE FROM Inventory WHERE player = :victim", ["victim" => $victim]);
        }
        private function ProcessMovement($row, &$entities) {
            $newPosIdx = $row["x"] * 1000 + $row["y"];
            if(!array_key_exists($newPosIdx, $entities)) { // if false, someone has already moved here
                $oldPosIdx = $row["beforex"] * 1000 + $row["beforey"];
                $entities[$newPosIdx] = $entities[$oldPosIdx];
                unset($entities[$oldPosIdx]);
                $this->Execute("UPDATE Player SET x = :x, y = :y WHERE id = :id", ["x" => $row["x"], "y" => $row["y"], "id" => $row["userId"]]);
            }
        }
        private function ProcessLootbox($row) {
            $q = $this->pdo->prepare("SELECT amount, item FROM Inventory WHERE item IN (20, 21) AND player = :p ORDER BY item ASC");   
            $q->execute(["p" => $row["userId"]]);
            $numKeys = 0; $numCrates = 0;
            while ($innerrow = $q->fetch(PDO::FETCH_ASSOC)) {
                if($innerrow["item"] === 20) { $numKeys = $innerrow["amount"]; }
                else if($innerrow["item"] === 21) { $numCrates = $innerrow["amount"]; }
            }
            if($numKeys === 0 || $numCrates === 0) { return; }
            $cratesToOpen = 0; $keysToToss = 0;
            if($numKeys >= $numCrates) {
                $cratesToOpen = $numCrates;
                $keysToToss = $numCrates;
            } else {
                $cratesToOpen = $numKeys;
                $keysToToss = $numKeys;
            }
            $loot = [];
            $itemsToDrop = [21, 21, 21, 21, 21, 21, 21, 32, 32, 34, 34, 35, 35, 36, 36, 37, 37, 38, 38, 39, 39, 40, 40, 41, 41, 41, 41, 50, 51, 52, 53];
            for($i = 0; $i < $cratesToOpen; $i++) {
                $itemType = $itemsToDrop[array_rand($itemsToDrop)];
                if(array_key_exists($itemType, $loot)) {
                    $loot[$itemType] += 1;
                } else {
                    $loot[$itemType] = 1;
                }
            }
            $q = $this->pdo->prepare("SELECT item FROM Inventory WHERE player = :p ORDER BY item ASC");   
            $q->execute(["p" => $row["userId"]]);
            while ($innerrow = $q->fetch(PDO::FETCH_ASSOC)) {
                $item = $innerrow["item"];
                if(array_key_exists($item, $loot)) {
                    $amt = $loot[$item];
                    $this->Execute("UPDATE Inventory SET amount = amount = $amt WHERE player = :p AND item = :i", ["p" => $row["userId"], "i" => $item]);
                    unset($loot[$item]);
                }
            }
            $sql = "INSERT INTO Inventory (player, item, amount) VALUES ";
            $res = [];
            foreach($loot as $key => $value) {
                $res[] = "(:p, $key, $value)";
            }
            $sql .= implode(", ", $res);
            $this->Execute($sql, ["p" => $row["userId"]]);
            if($cratesToOpen === $numCrates) {
                $this->Execute("DELETE FROM Inventory WHERE item = 21 AND player = :p", ["p" => $row["userId"]]);
            } else {
                $this->Execute("UPDATE Inventory SET amount = amount - $cratesToOpen WHERE item = 21 AND player = :p", ["p" => $row["userId"]]);
            }
            if($keysToToss === $numKeys) {
                $this->Execute("DELETE FROM Inventory WHERE item = 20 AND player = :p", ["p" => $row["userId"]]);
            } else {
                $this->Execute("UPDATE Inventory SET amount = amount - $keysToToss WHERE item = 20 AND player = :p", ["p" => $row["userId"]]);
            }
        }
        private function ProcessEat($row) {
            $itemType = (int)$row["x"]; $user = $row["userId"];
            $playerItemCount = $this->GetValue("SELECT amount FROM Inventory WHERE player = :p AND item = :i", ["p" => $row["userId"], "i" => $itemType]);
            if($playerItemCount === false || $playerItemCount <= 0) { // imposter!
                $this->msg[] = "Player doesn't even have this item!";
                return;
            }
            $amt = 0;
            switch($itemType) {
                case 50: $amt = 25; break;
                case 51: $amt = 5; break;
                case 52: $amt = 10; break;
                case 53: $amt = 15; break;
            }
            $this->Execute("UPDATE Player SET health = LEAST(100, health + $amt) WHERE id = :p", ["p" => $row["userId"]]);
            if($playerItemCount > 1) {
                $this->Execute("UPDATE Inventory SET amount = amount - 1 WHERE player = :p AND item = :i", ["p" => $row["userId"], "i" => $itemType]);
            } else {
                $this->Execute("DELETE FROM Inventory WHERE player = :p AND item = :i", ["p" => $row["userId"], "i" => $itemType]);
            }
            return true;
        }
        private function ProcessEquip($row) {
            $itemType = (int)$row["x"]; $user = $row["userId"];
            $this->Execute("UPDATE Player SET equipment = CASE equipment WHEN $itemType THEN 0 ELSE $itemType END WHERE id = :p", ["p" => $user]);
            return true;
        }
        private function ProcessToss($row) {
            $itemType = $row["x"]; $user = $row["userId"];
            $this->Execute("DELETE FROM Inventory WHERE player = :p AND item = :i", ["p" => $user, "i" => $itemType]);
            return true;
        }
        private function ProcessPlacement($row, &$entities) {
            $newPosIdx = $row["x"] * 1000 + $row["y"];
            if(!array_key_exists($newPosIdx, $entities)) { // if false, something has already been moved here
                $this->msg[] = "SELECT amount FROM Inventory WHERE player = ".$row["userId"]." AND item = ".$row["addtl"];
                $playerItemCount = $this->GetValue("SELECT amount FROM Inventory WHERE player = :p AND item = :i", [
                    "p" => $row["userId"],
                    "i" => $row["addtl"]
                ]);
                if($playerItemCount === false || $playerItemCount <= 0) { // imposter!
                    $this->msg[] = "Player doesn't even have this item!";
                    return;
                }
                $newType = $row["addtl"] - 36; // 1 = leek, 5 = bricks
                $entities[$newPosIdx] = [
                    "x" => $row["x"], "y" => $row["y"],
                    "type" => $newType, "id" => 0, "state" => 0
                ];
                $this->Execute("INSERT INTO AdditionalMap (x, y, type, state) VALUES (:x, :y, :t, 0)", [":x" => $row["x"], ":y" => $row["y"], ":t" => $newType]);
                if($playerItemCount > 1) {
                    $this->Execute("UPDATE Inventory SET amount = amount - 1 WHERE player = :p AND item = :i", [
                        "p" => $row["userId"],
                        "i" => $row["addtl"]
                    ]);
                } else {
                    $this->Execute("DELETE FROM Inventory WHERE player = :p AND item = :i", [
                        "p" => $row["userId"],
                        "i" => $row["addtl"]
                    ]);
                }
            } else {
                $this->msg[] = "Object already exists at this position: ".json_encode($entities[$newPosIdx]);
            }
        }
	}
	$ws = new WebServiceMethods();
	$m = [$ws, $_GET["function"]];
	$callable_name = "";
	if(is_callable($m, false, $callable_name)) {
		$len = strlen("WebServiceMethods::");
		if(substr($callable_name, 0, $len) === "WebServiceMethods::") {
			if($_SERVER["REQUEST_METHOD"] === "POST") {
				call_user_func($m);
			} else {
				$params = [];
				$pos = strpos($_SERVER["QUERY_STRING"], "&");
				if($pos !== false) { $params = explode("/", substr($_SERVER["QUERY_STRING"], $pos + 1)); }
				call_user_func_array($m, $params);
			}
			return;
		}
	}
	echo "{\"success\": false}";
?>