<?php
	header("Access-Control-Allow-Origin: *");
	header("Content-Type: application/json");
	if(!isset($_GET["function"])) { echo "{\"success\": false}"; exit; }
	function GetID() { return substr($_SERVER["HTTP_USER_AGENT"], 99, 1)."-".$_SERVER["REMOTE_ADDR"]; }
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
		private $pdo, $w, $h, $id;
		private function GetValue($sql, $args = null) {
			$q = $this->pdo->prepare($sql);
			if($args != null) { $q->execute($args); }
			else { $q->execute(); }
			return $q->fetchColumn();
		}
		private function Execute($sql, $args = null) {
			$q = $this->pdo->prepare($sql);
			if($args != null) { return $q->execute($args); }
			else { return $q->execute(); }
		}
		private function GetRow($sql, $args = null) {
			$q = $this->pdo->prepare($sql);
			if($args != null) { $q->execute($args); }
			else { $q->execute(); }
			return $q->fetch(PDO::FETCH_ASSOC);
		}
		private function GetTable($sql, $args = null) {
			$q = $this->pdo->prepare($sql);
			if($args != null) { $q->execute($args); }
			else { $q->execute(); }
			return $q->fetchAll(PDO::FETCH_ASSOC);
		}
		private function GetAllObjects($includeOcean = false) {
			$sql = "SELECT x, y, 100 AS type, zombie AS state, health, skin, hat, shirt, pants, id FROM Player";
			$sql .= " UNION SELECT x, y, type, state, 0, 0, 0, 0, 0, 0 FROM AdditionalMap";
			if($includeOcean) {
				$sql .= " UNION SELECT x, y, 0 AS type, 0, 0, 0, 0, 0, 0, 0 FROM BaseMap WHERE type IN (0, 5)";
			}
			$q = $this->pdo->prepare($sql);
			$q->execute();
			return $q->fetchAll(PDO::FETCH_ASSOC);
		}
		private function IsCorrectRound($round) {
			return $this->GetValue("SELECT round FROM GameInfo WHERE active = 1") === $round;
		}
		private function GetPlayerInfo() {
			return $this->GetRow("SELECT id, x, y, health, status FROM Player WHERE ip = :ip", ["ip" => $this->id]);
		}
		public function __construct() { $this->pdo = Db::factory(); $this->w = 85; $this->h = 76; $this->id = GetID(); }
		public function Fail() { echo "{\"success\": false}"; exit; }
		public function Test() { echo json_encode(["success" => true, "args" => func_get_args()]); }
		public function Active() { echo json_encode(["success" => true, "active" => $this->GetValue("SELECT COUNT(*) FROM GameInfo WHERE active = 1") ]); }
		public function GetMap() {
			$roundInfo = $this->GetRow("SELECT round, UNIX_TIMESTAMP(roundStart) AS dtRound, endState FROM GameInfo WHERE active = 1");
			echo json_encode([
				"success" => true,
				"round" => $roundInfo["round"],
				"you" => $this->GetRow("SELECT id, x, y, health, zombie, skin, hat, shirt, pants, status, equipment FROM Player WHERE ip = :ip", ["ip" => $this->id]),
				"yourShit" => $this->GetTable("SELECT item, amount FROM Inventory WHERE player = (SELECT id FROM Player WHERE ip = :ip)", ["ip" => $this->id]),
				"data" => $this->GetAllObjects(),
				"time" => $roundInfo["dtRound"],
				"endState" => $roundInfo["endState"]
			]);
		}
		public function CreatePlayer() {
			if($this->id === false) {
				echo json_encode(["success" => false, "message" => "An error occurred."]);
				return;
			}
			$userCount = $this->GetValue("SELECT COUNT(*) FROM Player");
			if($userCount >= 100) {
				echo json_encode(["success" => false, "full" => true]);
				return;
			}
			$user = $this->GetRow("SELECT id FROM Player WHERE ip = :ip", ["ip" => $this->id]);
			if($user !== false) {
				$this->GetMap();
				return;
			}
			$allObjs = $this->GetAllObjects(true);
			$allUsedPositions = [];
			foreach($allObjs as $val) {
				$allUsedPositions[] = $val["x"] * 1000 + $val["y"];
			}
			$validX = -1; $validY = -1;
			$numAttempts = 100;
			while($numAttempts-- > 0) {
				$x = rand(0, $this->w); $y = rand(0, $this->h);
				$idx = $x * 1000 + $y;
				if(array_search($idx, $allUsedPositions) === false) {
					$validX = $x; $validY = $y;
					break;
				}
			}
			if($validX < 0) {
				echo json_encode(["success" => false, "message" => "No room for a new user exists on the map!"]);
				return;
			}
			$isZombie = rand(0, 99) < 20;
			$skin = ($isZombie ? rand(0, 1) : rand(0, 3));
			$hat = rand(-1, 3); $shirt = rand(-1, 5); $pants = rand(-1, 5);
			$isZombieNum = ($isZombie ? 1 : 0);
			
			$sql = "INSERT INTO Player (x, y, health, zombie, skin, hat, shirt, pants, ip, status) VALUES ($validX, $validY, 100, $isZombieNum, $skin, $hat, $shirt, $pants, :ip, 0)";
			$q = $this->pdo->prepare($sql);
			$res = $q->execute(["ip" => $this->id]);
			if(!$res) {
				echo json_encode(["success" => false, "message" => "An error occurred trying to create your character. Please try again!"]);
				return;
			}
			$this->GetMap();
		}
		public function TryAction() {
			$player = $this->GetPlayerInfo();
			if($player === false) {
				echo json_encode(["success" => false, "message" => "Invalid user."]);
				return;
			}
			if($player["health"] <= 0) {
				echo json_encode(["success" => false, "message" => "You are already dead."]);
				return;
			}
			$content = trim(file_get_contents("php://input"));
			$params = json_decode($content, true);
			if (!is_array($params)) {
				echo json_encode(["success" => false, "message" => "Malformed JSON."]);
				return;
			}
			$round = (int)$params["round"]; $action = $params["action"];
			$x = (int)$params["x"]; $y = (int)$params["y"];
			if(!$this->IsCorrectRound($round)) {
				echo json_encode(["success" => false, "message" => "You're too late!"]);
				return;
			}
			$this->Execute("DELETE FROM AttemptedActions WHERE userId = :id AND round = :round", ["id" => $player["id"], "round" => $round]);
			if($action === "Move") {
				if($this->IsValidMove($player, $x, $y)) { // Move Action = 1
					$this->SaveAction($round, $player, 1, $player["x"] + $x, $player["y"] + $y);
					return;
				}
			} else if($action === "Grab") {
				if($this->IsValidGrab($player, $x, $y)) { // Grab Action = 2
					$this->SaveAction($round, $player, 2, $player["x"] + $x, $player["y"] + $y);
					return;
				}
			} else if($action === "Toss") {
				$this->SaveAction($round, $player, 5, $x, 0); // Toss Action = 5
				return;
			} else if($action === "Place") {
				$addtl = (int)$params["addtl"];
				if($this->IsValidPlace($player, $x, $y, $addtl)) { // Place Action = 0
					$this->SaveAddtlAction($round, $player, 0, $player["x"] + $x, $player["y"] + $y, $addtl);
					return;
				}
			} else if($action === "Attack") {
				if($this->IsValidAttack($player, $x, $y)) { // Attack Action = 4
					$this->SaveAction($round, $player, 4, $player["x"] + $x, $player["y"] + $y);
					return;
				}
			} else if($action === "Equip") {
				if($this->IsValidEquip($player, $x)) { // Equip Action = 6
					$this->SaveAction($round, $player, 6, $x, 0);
					return;
				}
			} else if($action === "Eat") {
				if($this->IsValidEat($player, $x)) { // Eat Action = 3
					$this->SaveAction($round, $player, 3, $x, 0);
					return;
				}
			} else if($action === "Zombify") {
				if($this->IsValidZombify($player, $x, $y)) { // Zombify Action = 7
					$this->SaveAction($round, $player, 7, $player["x"] + $x, $player["y"] + $y);
					return;
				}
			} else if($action === "Lootbox") {
				if($this->IsValidLootbox($player)) { // Lootbox Action = 8
					$this->SaveAction($round, $player, 8, 0, 0);
					return;
				}
			}
			echo json_encode(["success" => false]);
		}
		public function IsValidAttack($playerInfo, $x, $y) {
			$steps = abs($x) + abs($y);
			if($steps != 1) { return false; }
			$equipment = $this->GetValue("SELECT equipment FROM Player WHERE id = :p", ["p" => $playerInfo["id"]]);
			if($equipment !== 35) { return true; }
			$playerItemCount = $this->GetValue("SELECT amount FROM Inventory WHERE player = :p AND item = 32", ["p" => $playerInfo["id"]]);
			if($playerItemCount === false) { return false; }
			return $playerItemCount > 0;
		}
		public function IsValidEquip($playerInfo, $obj) {
			$playerItemCount = $this->GetValue("SELECT amount FROM Inventory WHERE player = :p AND item = :i", [
				"p" => $playerInfo["id"],
				"i" => $obj
			]);
			return $playerItemCount > 0 && $obj >= 34 && $obj <= 36;
		}
		public function IsValidEat($playerInfo, $obj) {
			$playerItemCount = $this->GetValue("SELECT amount FROM Inventory WHERE player = :p AND item = :i", [
				"p" => $playerInfo["id"],
				"i" => $obj
			]);
			return $playerItemCount > 0 && $obj >= 50 && $obj <= 53;
		}
		public function IsValidLootbox($playerInfo) {
			$playerItemCount = $this->GetValue("SELECT COUNT(*) FROM Inventory WHERE player = :p AND item IN (20, 21)", ["p" => $playerInfo["id"]]);
            if($playerItemCount === false || $playerItemCount <= 1) { // imposter!
                return false;
            }
			return true;
		}
		public function IsValidGrab($playerInfo, $x, $y) {
			$steps = abs($x) + abs($y);
			if($steps != 1) { return false; }
			$newx = $playerInfo["x"] + $x;
			$newy = $playerInfo["y"] + $y;
			$cropQuery = " OR (type = 1 AND state >= 10)";
			$cropQuery .= " OR (type = 2 AND state >= 5)";
			$cropQuery .= " OR (type = 3 AND state >= 10)";
			$cropQuery .= " OR (type = 4 AND state >= 10)";
			$objExists = $this->GetValue("SELECT COUNT(*) FROM AdditionalMap WHERE (type BETWEEN 10 AND 100 $cropQuery) AND x = :x AND y = :y", ["x" => $newx, "y" => $newy]);
			if($objExists === 1) { return true; }
			$corpseExists = $this->GetValue("SELECT COUNT(*) FROM Player WHERE health <= 0 AND x = :x AND y = :y", ["x" => $newx, "y" => $newy]);
			return ($corpseExists === 1);
		}
		public function IsValidZombify($playerInfo, $x, $y) {
			$steps = abs($x) + abs($y);
			if($steps != 1) { return false; }
			$newx = $playerInfo["x"] + $x;
			$newy = $playerInfo["y"] + $y;
			$corpseExists = $this->GetValue("SELECT COUNT(*) FROM Player WHERE health <= 0 AND zombie = 0 AND x = :x AND y = :y", ["x" => $newx, "y" => $newy]);
			return ($corpseExists === 1);
		}
		public function IsValidMove($playerInfo, $x, $y) {
			$steps = abs($x) + abs($y);
			if($steps > 2) { return false; }
			if(($playerInfo["status"] & 1) !== 1 && $steps > 1) { return false; }
			$newx = $playerInfo["x"] + $x;
			$newy = $playerInfo["y"] + $y;
			$safeRock = false;
			if(($playerInfo["status"] & 2) !== 2) { // Can't walk on water
				$invalidWater = $this->GetValue("SELECT COUNT(*) FROM BaseMap WHERE x = :x AND y = :y AND type IN (0, 5)", ["x" => $newx, "y" => $newy]);
				if($invalidWater > 0) { // but is a pebble there?
					$hasSavingRock = $this->GetValue("SELECT COUNT(*) FROM AdditionalMap WHERE x = :x AND y = :y AND type = -1", ["x" => $newx, "y" => $newy]);
					if($hasSavingRock === 0) { return false; }
					$safeRock = true;
				}
			} else { // Can walk on water
				$invalidWalls = $this->GetValue("SELECT COUNT(*) FROM BaseMap WHERE x = :x AND y = :y AND type = 0", ["x" => $newx, "y" => $newy]);
				if($invalidWalls > 0) { return false; }
			}
			if(!$safeRock) {
				$invalidObjs = $this->GetValue("SELECT COUNT(*) FROM AdditionalMap WHERE x = :x AND y = :y AND type >= 0", ["x" => $newx, "y" => $newy]);
				if($invalidObjs > 0) { return false; }
			}
			$invalidPlayers = $this->GetValue("SELECT COUNT(*) FROM Player WHERE x = :x AND y = :y AND id <> :id", ["x" => $newx, "y" => $newy, "id" => $playerInfo["id"]]);
			if($invalidPlayers > 0) { return false; }
			return true;
		}
		public function IsValidPlace($playerInfo, $x, $y, $itemType) {
			$steps = abs($x) + abs($y);
			if($steps != 1) { return false; }
			if($itemType < 37 || $itemType > 41) { return false; }
			$newx = $playerInfo["x"] + $x;
			$newy = $playerInfo["y"] + $y;
			
			$invalidWalls = $this->GetValue("SELECT COUNT(*) FROM BaseMap WHERE x = :x AND y = :y AND type = 0", ["x" => $newx, "y" => $newy]);
			if($invalidWalls > 0) { return false; }
			$invalidObjs = $this->GetValue("SELECT COUNT(*) FROM AdditionalMap WHERE x = :x AND y = :y AND type >= 0", ["x" => $newx, "y" => $newy]);
			if($invalidObjs > 0) { return false; }
			$invalidPlayers = $this->GetValue("SELECT COUNT(*) FROM Player WHERE x = :x AND y = :y AND id <> :id", ["x" => $newx, "y" => $newy, "id" => $playerInfo["id"]]);
			if($invalidPlayers > 0) { return false; }
			return true;
		}
		private function SaveAction($round, $playerInfo, $actionType, $x, $y) {
			$res = $this->Execute("INSERT INTO AttemptedActions (userId, round, action, actiontime, x, y, beforex, beforey) VALUES (:player, :round, :action, NOW(), :x, :y, :bx, :by)", [
				"round" => $round,
				"player" => $playerInfo["id"],
				"action" => $actionType, 
				"x" => $x, "y" => $y,
				"bx" => $playerInfo["x"], "by" => $playerInfo["y"]
			]);
			echo json_encode(["success" => true]);
		}
		private function SaveAddtlAction($round, $playerInfo, $actionType, $x, $y, $addtl) {
			$this->Execute("INSERT INTO AttemptedActions (userId, round, action, actiontime, x, y, beforex, beforey, addtl) VALUES (:player, :round, :action, NOW(), :x, :y, :bx, :by, :a)", [
				"round" => $round,
				"player" => $playerInfo["id"],
				"action" => $actionType, 
				"x" => $x, "y" => $y,
				"bx" => $playerInfo["x"], "by" => $playerInfo["y"],
				"a" => $addtl
			]);
			echo json_encode(["success" => true]);
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