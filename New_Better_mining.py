# Open World Mining Script for Razor Enhanced
# Based on lumberjacking script by AbelGoodwin and Matsamilla
# Adapted for mining by Cascade
# Last updated: 9/25/25 (integrated auto_smelter spill + beetle weight triggers)

if Player.GetRealSkillValue('Mining') < 40:
    Misc.SendMessage('Mining skill too low, stopping', 33)
    Stop

#********************
# CONFIGURATION - Edit these settings
#********************

# Serial of your beetle/pack animal, ore goes here when full
beetle = 0x002340B0  # User's beetle serial

# Attack nearest grey script name (must be exact)
autoFightMacroName = 'pvm_AttackGrey.py'

# Ore spots where there is no longer enough ore will not be revisited until this much time has passed
oreCooldown = 1200000  # 1,200,000 ms is 20 minutes

# Want this script to alert you for humanoids?
alert = False

# Auto-smelt integration (requires auto_smelter.py in Scripts/)
SMELT_ON_TRIGGERS = True

# Runebooks (set to 0 if not using)
runebookBank = 0x40DEBDDF  # Runebook for bank
runebookMining = 0x43AAC7A3  # Runebook for mining spots

#********************
# PARAMETERS - Don't change unless you know what you're doing
#********************

# Scan radius for ore spots
scanRadius = 30

# Ore spot static IDs (mountains and rocks that can be mined)
oreStaticIDs = [
    0x053E, 0x053B, 0x0540, 0x0541, 0x0542, 0x0543, 0x0544, 0x0545, 0x0546, 0x0547, 0x0548, 0x0549,  # Small rocks
    0x0459, 0x045A, 0x045B, 0x045C,  # Mountain tiles
    0x1771, 0x1772, 0x1773, 0x1774, 0x1775, 0x1776, 0x1777, 0x1778,  # Cave walls
    0x1779, 0x177A, 0x177B, 0x177C, 0x177D, 0x177E, 0x177F, 0x1780,  # Cave walls
]

# Timing configuration - Aggressively optimized for maximum speed
miningPauseMS = 300
dragDelay = 300
recallPause = 3000
timeoutOnWaitAction = 2000

fastDelay = 100
medDelay = 200

# Resource IDs
oreID = 0x19B9  # Raw ore (note: smelter scans broadly for variants)
ingotIDs = [0x1BF2, 0x1BEF]
otherResourceIDs = [0x3192, 0x3193, 0x3194, 0x3195, 0x3196, 0x3197, 0x3198]

# Prospector's tool ID
PROSPECT_TOOL_ID = 0x0FB4

# Weight limits
weightLimit = Player.MaxWeight - 400

# Mining tool configuration
miningToolIDs = [0x0E85, 0x0F39, 0x0E86, 0x0F43, 0x0F44, 0x0F45]

# System Variables
from System.Collections.Generic import List
from System import Byte, Int32
from math import sqrt
import clr
clr.AddReference('System.Speech')
from System.Speech.Synthesis import SpeechSynthesizer
tileinfo = List[Statics.TileInfo]
oreSpots = []
oreSpotCoords = None
blockCount = 0
lastRune = 5
onLoop = True

# ==== Auto-smelter integration (import + beetle serial wiring) ====
maybe_run_smelter_when_spilling_or_overweight = None

def _to_int32_list(values):
    typed = List[Int32]()
    for value in values:
        typed.Add(Int32(value))
    return typed

def _normalize_smelter_lists():
    if 'smelter' not in globals():
        return
    normalized = []
    for attr in dir(smelter):
        if not attr.isupper() or '_ID' not in attr:
            continue
        current = getattr(smelter, attr)
        if isinstance(current, list) and current and isinstance(current[0], int):
            setattr(smelter, attr, _to_int32_list(current))
            normalized.append(attr)
    if normalized:
        Misc.SendMessage('Auto-smelter lists normalized: ' + ', '.join(normalized), 66)

if SMELT_ON_TRIGGERS:
    try:
        import auto_smelter as smelter
        from auto_smelter import maybe_run_smelter_when_spilling_or_overweight as _smelter_run
        # Wire miner's beetle into smelter
        smelter.BEETLE_SERIAL = beetle

        # Optional tuning while testing:
        smelter.DEBUG_MODE = False
        smelter.ORE_SPILL_RADIUS = 4
        smelter.ORE_SPILL_MIN_COUNT = 1
        smelter.SMELTER_COOLDOWN_MS = 8000
        smelter.BEETLE_WEIGHT_TRIGGER = 0.92    # 92% full
        smelter.SMELT_BEETLE_MAX_WEIGHT = 400   # fallback if shard doesn't expose a max

        _normalize_smelter_lists()

        def _wrapped_smelter():
            beetle_mobile = Mobiles.FindBySerial(beetle) if beetle else None
            if beetle_mobile and Player.DistanceTo(beetle_mobile) > 18:
                return
            try:
                _smelter_run()
            except TypeError as exc:
                if 'List[Int32]' in str(exc):
                    _normalize_smelter_lists()
                    _smelter_run()
                else:
                    Misc.SendMessage(f'Auto-smelter error: {exc}', 33)
            except Exception as exc:
                Misc.SendMessage(f'Auto-smelter error: {exc}', 33)

        maybe_run_smelter_when_spilling_or_overweight = _wrapped_smelter
        Misc.SendMessage('Auto-smelter linked. Spill + beetle weight triggers active.', 66)
    except Exception as _e:
        maybe_run_smelter_when_spilling_or_overweight = None
        Misc.SendMessage('auto_smelter.py not found or failed to import; auto-smelt disabled.', 33)
# =================================================================

class OreSpot:
    x = None
    y = None
    z = None
    id = None
    def __init__(self, x, y, z, id):
        self.x = x
        self.y = y
        self.z = z
        self.id = id

def RecallNextSpot():
    global lastRune
    if 'runebookMining' not in globals():
        Misc.SendMessage('No runebook defined, skipping recall', 33)
        return
    Gumps.ResetGump()
    Misc.SendMessage('--> Recall to Mining Spot', 77)
    Items.UseItem(runebookMining)
    Gumps.WaitForGump(1431013363, timeoutOnWaitAction)
    Gumps.SendAction(1431013363, lastRune)
    Misc.Pause(recallPause)
    Misc.Pause(2000)
    lastRune = lastRune + 6
    if lastRune > 95:
        lastRune = 5
    Misc.Pause(1000)
    EquipPickaxe()

def RecallBack():
    global lastRune
    if 'runebookMining' not in globals():
        Misc.SendMessage('No runebook defined, skipping recall', 33)
        return
    Items.UseItem(runebookMining)
    Gumps.WaitForGump(1431013363, timeoutOnWaitAction)
    Gumps.SendAction(1431013363, lastRune)
    Misc.Pause(recallPause)
    EquipPickaxe()

def DepositInBank():
    if 'runebookBank' not in globals():
        Misc.SendMessage('No bank runebook defined, skipping bank deposit', 33)
        return
    while Player.Weight >= weightLimit:
        Gumps.ResetGump()
        Items.UseItem(runebookBank)
        Gumps.WaitForGump(1431013363, 10000)
        Gumps.SendAction(1431013363, 71)
        Misc.Pause(recallPause)
        Player.ChatSay(77, 'bank')
        Misc.Pause(300)

def ScanStatic():
    global oreSpots
    Misc.SendMessage('--> Scan for Ore Spots Started', 77)
    minX = Player.Position.X - scanRadius
    maxX = Player.Position.X + scanRadius
    minY = Player.Position.Y - scanRadius
    maxY = Player.Position.Y + scanRadius
    x = minX
    y = minY
    while x <= maxX:
        while y <= maxY:
            staticsTileInfo = Statics.GetStaticsTileInfo(x, y, Player.Map)
            if staticsTileInfo.Count > 0:
                for tile in staticsTileInfo:
                    for staticid in oreStaticIDs:
                        if staticid == tile.StaticID and not Timer.Check('%i,%i' % (x, y)):
                            oreSpots.Add(OreSpot(x, y, tile.StaticZ, tile.StaticID))
            y = y + 1
        y = minY
        x = x + 1
    oreSpots = sorted(oreSpots, key=lambda spot: sqrt((spot.x - Player.Position.X)**2 + (spot.y - Player.Position.Y)**2))
    Misc.SendMessage('--> Total Ore Spots: %i' % (oreSpots.Count), 77)

def RangeOreSpot():
    playerX = Player.Position.X
    playerY = Player.Position.Y
    spotX = oreSpots[0].x
    spotY = oreSpots[0].y
    return ((spotX >= playerX - 1 and spotX <= playerX + 1) and (spotY >= playerY - 1 and spotY <= playerY + 1))

def MoveToOreSpot():
    global oreSpots, oreSpotCoords
    pathlock = 0
    Misc.SendMessage('--> Moving to Ore Spot: %i, %i' % (oreSpots[0].x, oreSpots[0].y), 77)
    Misc.Resync()
    oreSpotCoords = PathFinding.Route()
    oreSpotCoords.MaxRetry = 5
    oreSpotCoords.StopIfStuck = False
    oreSpotCoords.X = oreSpots[0].x
    oreSpotCoords.Y = oreSpots[0].y + 1
    if PathFinding.Go(oreSpotCoords):
        Misc.Pause(800)
    else:
        Misc.Resync()
        oreSpotCoords.X = oreSpots[0].x + 1
        oreSpotCoords.Y = oreSpots[0].y
        if PathFinding.Go(oreSpotCoords):
            Misc.SendMessage('Second Try')
        else:
            oreSpotCoords.X = oreSpots[0].x - 1
            oreSpotCoords.Y = oreSpots[0].y
            if PathFinding.Go(oreSpotCoords):
                Misc.SendMessage('Third Try')
            else:
                oreSpotCoords.X = oreSpots[0].x
                oreSpotCoords.Y = oreSpots[0].y - 1
                Misc.SendMessage('Final Try')
                if PathFinding.Go(oreSpotCoords):
                    Misc.NoOperation()
                else:
                    return

    Misc.Resync()

    while not RangeOreSpot():
        CheckEnemy()
        # Trigger while pathing
        if SMELT_ON_TRIGGERS and maybe_run_smelter_when_spilling_or_overweight:
            maybe_run_smelter_when_spilling_or_overweight()
        Misc.Pause(100)
        pathlock += 1
        if pathlock > 350:
            Misc.Resync()
            oreSpotCoords = PathFinding.Route()
            oreSpotCoords.MaxRetry = 5
            oreSpotCoords.StopIfStuck = False
            oreSpotCoords.X = oreSpots[0].x
            oreSpotCoords.Y = oreSpots[0].y + 1
            if PathFinding.Go(oreSpotCoords):
                Misc.Pause(800)
            else:
                oreSpotCoords.X = oreSpots[0].x + 1
                oreSpotCoords.Y = oreSpots[0].y
                if PathFinding.Go(oreSpotCoords):
                    Misc.SendMessage('Second Try')
                else:
                    oreSpotCoords.X = oreSpots[0].x - 1
                    oreSpotCoords.Y = oreSpots[0].y
                    if PathFinding.Go(oreSpotCoords):
                        Misc.SendMessage('Third Try')
                    else:
                        oreSpotCoords.X = oreSpots[0].x
                        oreSpotCoords.Y = oreSpots[0].y - 1
                        Misc.SendMessage('Final Try')
                        PathFinding.Go(oreSpotCoords)
            pathlock = 0
            return

    Misc.SendMessage('--> Reached Ore Spot: %i, %i' % (oreSpots[0].x, oreSpots[0].y), 77)

def FindPickaxe():
    # Already equipped?
    if Player.GetItemOnLayer('LeftHand'):
        lh = Player.GetItemOnLayer('LeftHand')
        if lh.ItemID in miningToolIDs:
            Misc.SendMessage(f'--> Found equipped mining tool: {lh.Name}', 66)
            return lh.Serial
    if Player.GetItemOnLayer('RightHand'):
        rh = Player.GetItemOnLayer('RightHand')
        if rh.ItemID in miningToolIDs:
            Misc.SendMessage(f'--> Found equipped mining tool: {rh.Name}', 66)
            return rh.Serial
    # Backpack
    for item in Player.Backpack.Contains:
        if item.ItemID in miningToolIDs:
            Misc.SendMessage(f'--> Found mining tool in backpack: {item.Name}', 66)
            return item.Serial
    # Specific pickaxe in backpack
    pickaxe = Items.FindByID(0x0E85, -1, Player.Backpack.Serial, 1)
    if pickaxe:
        Misc.SendMessage('Equipping pickaxe...', 66)
        Player.EquipItem(pickaxe)
        Misc.Pause(600)
        return pickaxe.Serial
    Misc.SendMessage('ERROR: No pickaxe found in backpack!', 33)
    return None

def EquipPickaxe():
    serial = FindPickaxe()
    if not serial:
        Player.HeadMessage(35, 'You must have a pickaxe to mine!')
        Misc.Pause(800)
        return None
    if (Player.GetItemOnLayer('LeftHand') and Player.GetItemOnLayer('LeftHand').Serial == serial) or \
       (Player.GetItemOnLayer('RightHand') and Player.GetItemOnLayer('RightHand').Serial == serial):
        return serial
    Player.EquipItem(serial)
    Misc.Pause(600)
    if (Player.GetItemOnLayer('LeftHand') and Player.GetItemOnLayer('LeftHand').Serial == serial) or \
       (Player.GetItemOnLayer('RightHand') and Player.GetItemOnLayer('RightHand').Serial == serial):
        Misc.SendMessage('--> Pickaxe equipped successfully', 66)
        return serial
    Misc.SendMessage('--> Failed to equip pickaxe', 33)
    return None

def UseProspectorTool():
    prospector = Items.FindByID(PROSPECT_TOOL_ID, -1, Player.Backpack.Serial)
    if not prospector:
        Misc.SendMessage('--> No prospector\'s tool found!', 33)
        return False
    Items.UseItem(prospector)
    Target.WaitForTarget(500, False)
    Target.TargetExecute(Player.Position.X, Player.Position.Y, Player.Position.Z, 0)
    Misc.Pause(500)
    if Journal.SearchByType('You find traces of', 'Regular'):
        Misc.SendMessage('--> ' + Journal.GetLastText(), 66)
    return True

def MineSpotUntilDepleted():
    Misc.SendMessage('--> Mining spot until depleted...', 77)
    if Player.Mount:
        Mobiles.UseMobile(Player.Serial)
        Misc.Pause(300)
    Misc.SendMessage('--> Prospecting the area...', 66)
    UseProspectorTool()
    Misc.Pause(300)

    attempts = 0
    maxAttempts = 20
    miningSuccess = True

    while miningSuccess and attempts < maxAttempts:
        # Trigger checks every loop
        if SMELT_ON_TRIGGERS and maybe_run_smelter_when_spilling_or_overweight:
            maybe_run_smelter_when_spilling_or_overweight()

        if attempts == 1:
            Misc.Pause(100)
        if Player.Weight >= weightLimit - 40 or (attempts > 0 and attempts % 8 == 0):
            if not MoveToBeetle():
                Misc.SendMessage('--> Failed to transfer items to beetle, trying to continue mining', 33)
                if Player.Weight >= Player.MaxWeight - 10:
                    Misc.SendMessage('--> CRITICAL: Too heavy to move!', 33)
                    for item in Player.Backpack.Contains:
                        if item.ItemID in [oreID] + ingotIDs + otherResourceIDs:
                            Items.MoveOnGround(item, 1, Player.Position.X, Player.Position.Y, Player.Position.Z)
                            Misc.SendMessage('--> Dropped items on ground!', 33)
                            Misc.Pause(50)
                            break
                    # after forced drop, also try smelt
                    if SMELT_ON_TRIGGERS and maybe_run_smelter_when_spilling_or_overweight:
                        maybe_run_smelter_when_spilling_or_overweight()
                    break
            if Player.Weight < Player.MaxWeight - 20:
                MoveToOreSpot()
            else:
                Misc.SendMessage('--> Still too heavy to return to mining spot', 33)
                if SMELT_ON_TRIGGERS and maybe_run_smelter_when_spilling_or_overweight:
                    maybe_run_smelter_when_spilling_or_overweight()
                break

        miningSuccess = MineOnce()
        attempts += 1
        if miningSuccess:
            attempts = 0
            Misc.Pause(miningPauseMS)
        else:
            Misc.SendMessage('--> Spot depleted or mining failed', 77)
            Misc.Pause(100)

    if attempts >= maxAttempts:
        Misc.SendMessage('--> Maximum mining attempts reached, moving to next spot', 33)

def MineOnce():
    global blockCount, oreSpots
    if Player.Mount:
        Misc.SendMessage('--> Dismounting to mine', 66)
        Mobiles.UseMobile(Player.Serial)
        Misc.Pause(800)
    if Target.HasTarget():
        Misc.SendMessage('--> Detected block, canceling target!', 77)
        Target.Cancel()
        Misc.Pause(300)

    CheckEnemy()

    # Trigger right before swing
    if SMELT_ON_TRIGGERS and maybe_run_smelter_when_spilling_or_overweight:
        maybe_run_smelter_when_spilling_or_overweight()

    Journal.Clear()
    pickaxe = EquipPickaxe()
    if not pickaxe:
        Misc.SendMessage('--> No mining tool available! Stopping script.', 33)
        Stop
        return False

    Target.Cancel()
    Target.WaitForTarget(300, False)
    Items.UseItem(pickaxe)
    Target.WaitForTarget(300, False)
    Target.TargetExecute(oreSpots[0].x, oreSpots[0].y, oreSpots[0].z, oreSpots[0].id)
    Misc.Pause(200)

    Timer.Create('mineTimer', 5000)
    while not (Journal.SearchByType('There is no metal here to mine.', 'System') or 
               Journal.SearchByType('You loosen', 'System') or
               Journal.SearchByType('You have worn out your tool!', 'System') or
               Journal.SearchByType('You can not mine there.', 'System') or
               Journal.SearchByType('You have no line of sight', 'System') or
               Journal.SearchByType('You dig some', 'System') or
               Journal.SearchByType('You receive', 'System') or
               Journal.Search('You have received') or
               Journal.SearchByType("You can't dig while riding or flying.", 'System') or
               Timer.Check('mineTimer') == False):
        if SMELT_ON_TRIGGERS and maybe_run_smelter_when_spilling_or_overweight:
            maybe_run_smelter_when_spilling_or_overweight()
        Misc.Pause(100)

    if Journal.SearchByType("You can't dig while riding or flying.", 'System'):
        Misc.SendMessage('--> Cannot mine while mounted, dismounting...', 33)
        if Player.Mount:
            Mobiles.UseMobile(Player.Serial)
            Misc.Pause(300)
        return True
    elif Journal.SearchByType('There is no metal here to mine.', 'System'):
        Misc.SendMessage('--> Ore spot depleted', 77)
        Timer.Create('%i,%i' % (oreSpots[0].x, oreSpots[0].y), oreCooldown)
        return False
    elif Journal.SearchByType('You have worn out your tool!', 'System'):
        Misc.SendMessage('--> Tool worn out, finding new pickaxe', 33)
        EquipPickaxe()
        return True
    elif Journal.SearchByType('You can not mine there.', 'System') or Journal.SearchByType('You have no line of sight', 'System'):
        blockCount += 1
        if blockCount > 3:
            blockCount = 0
            Misc.SendMessage('--> Possible block detected, marking spot as depleted', 77)
            Timer.Create('%i,%i' % (oreSpots[0].x, oreSpots[0].y), oreCooldown)
            return False
        else:
            return True
    elif (Journal.SearchByType('You dig some', 'System') or 
          Journal.SearchByType('You receive', 'System') or 
          Journal.SearchByType('You loosen', 'System') or 
          Journal.Search('You have received')):
        Misc.SendMessage('--> Mining successful!', 63)
        Journal.Clear()
        Misc.Pause(miningPauseMS)
        return True
    elif Timer.Check('mineTimer') == False:
        Misc.SendMessage('--> Mining timed out, marking spot as depleted', 77)
        Timer.Create('%i,%i' % (oreSpots[0].x, oreSpots[0].y), oreCooldown)
        return False
    else:
        return False

def CheckEnemy():
    enemy = Target.GetTargetFromList('enemywar')
    if enemy != None:
        Misc.ScriptRun(autoFightMacroName)
        while enemy != None:
            Timer.Create('Fight', 2500)
            Misc.Pause(1000)
            enemy = Mobiles.FindBySerial(enemy.Serial)
            if enemy:
                if Player.DistanceTo(enemy) > 1:
                    enemyPosition = enemy.Position
                    enemyCoords = PathFinding.Route()
                    enemyCoords.MaxRetry = 5
                    enemyCoords.StopIfStuck = False
                    enemyCoords.X = enemyPosition.X
                    enemyCoords.Y = enemyPosition.Y - 1
                    PathFinding.Go(enemyCoords)
                    Misc.ScriptRun(autoFightMacroName)
                elif Timer.Check('Fight') == False:
                    Misc.ScriptRun(autoFightMacroName)
                    Timer.Create('Fight', 2500)
            enemy = Target.GetTargetFromList('enemywar')

        corpseFilter = Items.Filter()
        corpseFilter.Movable = False
        corpseFilter.RangeMax = 2
        corpseFilter.Graphics = List[int]([0x2006])
        corpses = Items.ApplyFilter(corpseFilter)
        Misc.Pause(dragDelay)
        for corpse in corpses:
            for item in corpse.Contains:
                if item.ItemID == oreID or item.ItemID in ingotIDs or item.ItemID in otherResourceIDs:
                    Items.Move(item.Serial, Player.Backpack.Serial, 0)
                    Misc.Pause(dragDelay)
        PathFinding.Go(oreSpotCoords)

def GetBeetle():
    global beetle
    if beetle != 0:
        Misc.SendMessage(f'Looking for beetle with serial: 0x{beetle:X}', 66)
        beetle_mobile = Mobiles.FindBySerial(beetle)
        if beetle_mobile:
            distance = Player.DistanceTo(beetle_mobile)
            if distance < 15:
                Misc.SendMessage(f'Found beetle by serial at distance: {distance} tiles', 66)
                return beetle_mobile
            else:
                Misc.SendMessage(f'Beetle found but too far away: {distance} tiles', 33)
    Misc.SendMessage('Searching for any nearby pack animal...', 66)
    mobiles = Mobiles.ApplyFilter(Mobiles.Filter())
    for mobile in mobiles:
        distance = Player.DistanceTo(mobile)
        is_pack_animal = (
            mobile.Body in [0x317, 0x318, 0x319, 0x31F, 0x320, 0x321, 0x322, 0x323, 0xE2, 0xCC, 0xE4] or
            'pack' in (str(mobile.Name) or '').lower() or 
            'beetle' in (str(mobile.Name) or '').lower()
        )
        if is_pack_animal and distance < 15:
            old_serial = beetle
            beetle = mobile.Serial
            Misc.SendMessage(f'Found pack animal: {str(mobile.Name) or "Unknown"} (0x{beetle:X}) at {distance} tiles', 66)
            if old_serial != beetle:
                Misc.SendMessage(f'Updated beetle serial to: 0x{beetle:X}', 66)
            return mobile
    Misc.SendMessage('ERROR: No pack animal found within 15 tiles!', 33)
    return None

def BeetleHasCapacity(beetle_mobile, required_capacity=10):
    try:
        beetle_pack = None
        if hasattr(beetle_mobile, 'Backpack') and beetle_mobile.Backpack:
            beetle_pack = beetle_mobile.Backpack
        if not beetle_pack and hasattr(beetle_mobile, 'Contains'):
            for item in beetle_mobile.Contains:
                if getattr(item, 'Layer', -1) == 21:
                    beetle_pack = item
                    break
        if not beetle_pack:
            beetle_item = Items.FindBySerial(beetle_mobile.Serial)
            if beetle_item and hasattr(beetle_item, 'Contains'):
                for item in beetle_item.Contains:
                    if getattr(item, 'Layer', -1) == 21:
                        beetle_pack = item
                        break
        if not beetle_pack:
            Misc.SendMessage('Could not find beetle pack!', 33)
            return False

        if hasattr(beetle_pack, 'Weight'):
            total_weight = beetle_pack.Weight
        else:
            total_weight = 0
            if hasattr(beetle_pack, 'Contains'):
                for it in beetle_pack.Contains:
                    try:
                        amt = getattr(it, 'Amount', 1) or 1
                        wt  = getattr(it, 'Weight', 1) or 1
                        w = float(amt) * float(wt)
                        if 0 <= w <= 200:
                            total_weight += w
                    except:
                        pass
        if total_weight > 10000:
            total_weight = 1000
        max_beetle_weight = 400
        remaining_capacity = max_beetle_weight - total_weight
        Misc.SendMessage(f'Beetle pack weight: {total_weight}/{max_beetle_weight} stones (Remaining: {remaining_capacity} stones)', 66)
        if remaining_capacity < 0 and remaining_capacity > -100:
            Misc.SendMessage('Beetle nearly full, allowing small items', 66)
            return required_capacity <= 10
        return remaining_capacity >= required_capacity
    except Exception as e:
        Misc.SendMessage(f'Error checking beetle capacity: {str(e)}', 33)
        return False

def MoveToBeetle():
    Misc.SendMessage('Attempting to find beetle...', 66)
    beetle_mobile = GetBeetle()
    if not beetle_mobile:
        Misc.SendMessage('ERROR: Could not find beetle nearby!', 33)
        return False
    Misc.SendMessage(f'Found beetle at distance: {Player.DistanceTo(beetle_mobile)} tiles', 66)
    distance = Player.DistanceTo(beetle_mobile)
    if distance <= 2:
        Misc.SendMessage('Already next to beetle, transferring items...', 66)
        return TransferItemsToBeetle(beetle_mobile)
    if not CanMove():
        Misc.SendMessage('--> Overweight, trying to get beetle to come to us...', 33)
        Player.HeadTarget(beetle_mobile)
        Player.HeadTarget(Player.Serial)
        Misc.Pause(1000)
        wait_time = 0
        while wait_time < 5:
            current_dist = Player.DistanceTo(beetle_mobile)
            if current_dist <= 2:
                break
            Misc.Pause(1000)
            wait_time += 1
            Misc.SendMessage(f'Waiting for beetle to come to us... {wait_time}/5 seconds (Distance: {current_dist} tiles)', 66)
        if Player.DistanceTo(beetle_mobile) <= 2:
            Misc.SendMessage('Beetle is close, transferring items...', 66)
            return TransferItemsToBeetle(beetle_mobile)
        Misc.SendMessage('--> Could not get beetle to come to us, trying to move...', 33)
    current_distance = Player.DistanceTo(beetle_mobile)
    if current_distance > 2:
        if Player.Mount:
            Misc.SendMessage('--> Dismounting to move', 66)
            Mobiles.UseMobile(Player.Serial)
            Misc.Pause(1200)
        target_x = beetle_mobile.Position.X
        target_y = beetle_mobile.Position.Y
        path = PathFinding.Route()
        path.MaxRetry = 2
        path.StopIfStuck = True
        path.X = target_x
        path.Y = target_y
        Misc.SendMessage('Attempting direct path to beetle...', 66)
        if PathFinding.Go(path):
            Misc.SendMessage('Successfully moved to beetle!', 66)
        else:
            Misc.SendMessage('Direct path failed, trying alternate approaches...', 33)
            for dx, dy in [(0,1), (1,0), (0,-1), (-1,0), (1,1), (1,-1), (-1,1), (-1,-1)]:
                path.X = target_x + dx
                path.Y = target_y + dy
                Misc.SendMessage(f'Trying coordinates: ({path.X}, {path.Y})', 66)
                if PathFinding.Go(path):
                    Misc.SendMessage(f'Successfully moved to position near beetle!', 66)
                    break
            else:
                Misc.SendMessage('ERROR: Could not find path to beetle!', 33)
                return False
        Misc.Pause(800)
    final_distance = Player.DistanceTo(beetle_mobile)
    if final_distance <= 2:
        Misc.SendMessage(f'In range ({final_distance} tiles), transferring items...', 66)
        return TransferItemsToBeetle(beetle_mobile)
    else:
        Misc.SendMessage(f'ERROR: Still too far from beetle! Distance: {final_distance} tiles', 33)
        return False

def TransferItemsToBeetle(beetle_mobile):
    if not beetle_mobile:
        Misc.SendMessage('ERROR: Invalid beetle mobile!', 33)
        return False
    beetle_pack = None
    try:
        if hasattr(beetle_mobile, 'Backpack') and beetle_mobile.Backpack:
            beetle_pack = beetle_mobile.Backpack
        if not beetle_pack and hasattr(beetle_mobile, 'Contains'):
            for item in beetle_mobile.Contains:
                if getattr(item, 'Layer', -1) == 21:
                    beetle_pack = item
                    break
        if not beetle_pack:
            beetle_item = Items.FindBySerial(beetle_mobile.Serial)
            if beetle_item and hasattr(beetle_item, 'Contains'):
                for item in beetle_item.Contains:
                    if getattr(item, 'Layer', -1) == 21:
                        beetle_pack = item
                        break
    except Exception as e:
        Misc.SendMessage(f'Error finding beetle pack: {str(e)}', 33)
    if not beetle_pack:
        Misc.SendMessage('--> Beetle pack not found! Cannot transfer items.', 33)
        return False
    Misc.SendMessage('--> Transferring items to beetle (unlimited capacity)', 66)
    moveCount = 0
    ore_items = []
    for item in Player.Backpack.Contains:
        if item.ItemID == oreID or item.ItemID in ingotIDs or item.ItemID in otherResourceIDs:
            ore_items.append(item)
    if not ore_items:
        Misc.SendMessage('--> No items to transfer', 77)
        return True
    for item in ore_items:
        try:
            item_ref = Items.FindBySerial(item.Serial)
            if not item_ref:
                continue
            Items.Move(item, beetle_pack.Serial, 0)
            Misc.Pause(100)
            if Items.FindBySerial(item.Serial) is None:
                moveCount += 1
            else:
                Misc.SendMessage(f'Failed to move {item.Name}', 33)
        except Exception as e:
            Misc.SendMessage(f'Error moving item: {str(e)}', 33)
    if moveCount > 0:
        Misc.SendMessage(f'--> Successfully moved {moveCount} items to beetle', 66)
        Misc.Pause(400)
        return True
    else:
        Misc.SendMessage('--> No items were moved to the beetle', 77)
        return False

def filterItem(id, range=2, movable=True):
    fil = Items.Filter()
    fil.Movable = movable
    fil.RangeMax = range
    fil.Graphics = List[int](id)
    return Items.ApplyFilter(fil)

toonFilter = Mobiles.Filter(); toonFilter.Enabled = True; toonFilter.RangeMin = -1; toonFilter.RangeMax = -1
toonFilter.IsHuman = True; toonFilter.Friend = False
toonFilter.Notorieties = List[Byte](bytes([1,2,3,4,5,6,7]))

invulFilter = Mobiles.Filter(); invulFilter.Enabled = True; invulFilter.RangeMin = -1; invulFilter.RangeMax = -1
invulFilter.Friend = False
invulFilter.Notorieties = List[Byte](bytes([7]))

def say(text):
    spk = SpeechSynthesizer()
    spk.Speak(text)

def CanMove():
    return Player.Weight < Player.MaxWeight

def safetyNet():
    if alert:
        toon = Mobiles.ApplyFilter(toonFilter)
        invul = Mobiles.ApplyFilter(invulFilter)
        if toon:
            Misc.FocusUOWindow()
            say("Hey, someone is here. You should tab over and take a look")
            toonName = Mobiles.Select(toon, 'Nearest')
            if toonName:
                Misc.SendMessage('Toon Near: ' + toonName.Name, 33)
        elif invul:
            say("Hey, something invulnerable here. You should tab over and take a look")
            invulName = Mobiles.Select(invul, 'Nearest')
            if invulName:
                Misc.SendMessage('Uh Oh: Invul! Who is ' + invulName.Name, 33)
        else:
            Misc.NoOperation()

# Main script execution
Friend.ChangeList('mining')
Misc.SendMessage('--> Starting Open World Mining', 77)
EquipPickaxe()

while onLoop:
    # Trigger check each travel cycle
    if SMELT_ON_TRIGGERS and maybe_run_smelter_when_spilling_or_overweight:
        maybe_run_smelter_when_spilling_or_overweight()

    RecallNextSpot()
    ScanStatic()
    i = 0
    while oreSpots and i < len(oreSpots):
        safetyNet()

        if SMELT_ON_TRIGGERS and maybe_run_smelter_when_spilling_or_overweight:
            maybe_run_smelter_when_spilling_or_overweight()

        MoveToOreSpot()
        MineSpotUntilDepleted()

        if SMELT_ON_TRIGGERS and maybe_run_smelter_when_spilling_or_overweight:
            maybe_run_smelter_when_spilling_or_overweight()

        oreSpots.pop(0)
        oreSpots = sorted(oreSpots, key=lambda spot: sqrt((spot.x - Player.Position.X)**2 + (spot.y - Player.Position.Y)**2))
    oreSpots = []
    Misc.Pause(100)
