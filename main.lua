-- Initialize database
local sqlite3 = require("lsqlite3")
local dbAdmin = require("@rakis/DbAdmin")

-- Open an in-memory database
db = sqlite3.open_memory()
admin = dbAdmin.new(db)

-- Players table
admin:exec([[
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    is_alive BOOLEAN DEFAULT TRUE,
    is_creator BOOLEAN DEFAULT FALSE,
    votes INTEGER DEFAULT 0
  );
]])

-- Game state table
admin:exec([[
  CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY,
    phase TEXT DEFAULT 'lobby',
    round INTEGER DEFAULT 0,
    timestamp INTEGER DEFAULT 0,
    night_actions_werewolf BOOLEAN DEFAULT FALSE,
    night_actions_doctor BOOLEAN DEFAULT FALSE,
    night_actions_seer BOOLEAN DEFAULT FALSE
  );
]])

admin:exec([[
    CREATE TABLE IF NOT EXISTS votes (
    voter TEXT PRIMARY KEY,
    voted_for TEXT,
    FOREIGN KEY(voter) REFERENCES players(id),
    FOREIGN KEY(voted_for) REFERENCES players(id)
);
]])

-- Add a new table for night actions
admin:exec([[
  CREATE TABLE IF NOT EXISTS night_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round INTEGER,
    actor_id TEXT,
    action_type TEXT,
    target_id TEXT,
    timestamp INTEGER,
    FOREIGN KEY(actor_id) REFERENCES players(id),
    FOREIGN KEY(target_id) REFERENCES players(id)
  );
]])

-- Add events table
admin:exec([[
  CREATE TABLE IF NOT EXISTS game_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    data TEXT NOT NULL,
    timestamp INTEGER DEFAULT (strftime('%s','now')),
    processed BOOLEAN DEFAULT FALSE
  );
]])

-- Game state variables
GameState = {
    phase = "lobby",
    round = 0,
    timestamp = 0,
    minPlayers = 4,
    maxPlayers = 8,
    nightActionsComplete = {
        werewolf = false,
        doctor = false,
        seer = false
    }
}

-- Required roles that must be assigned
RequiredRoles = {
    "werewolf",
    "villager", 
    "seer",
    "doctor"
}

-- Additional roles based on player count
ExtraRoles = {
    "villager",
    "villager",
    "villager",
    "werewolf"
}

-- Register new player
Handlers.add(
    "Register-Player",
    "Register-Player",
    function(msg)
        -- Check if game is full
        local playerCount = admin:exec("SELECT COUNT(*) as count FROM players")[1].count
        if playerCount >= GameState.maxPlayers then
            msg.reply({ Data = "Game is full" })
            return
        end

        -- Check if player already exists
        local exists = admin:select('SELECT id FROM players WHERE id = ?;', { msg.From })
        if #exists > 0 then
            msg.reply({ Data = "Already registered" })
            return
        end

        -- First player becomes creator
        local isCreator = playerCount == 0

        -- Insert player
        admin:apply(
            'INSERT INTO players (id, name, is_creator) VALUES (?, ?, ?);',
            { msg.From, msg.Tags.DisplayName, isCreator }
        )
        
        msg.reply({ Data = "Successfully registered" })
    end
)

-- Leave game
Handlers.add(
    "Leave-Game",
    "Leave-Game",
    function(msg)
        admin:apply('DELETE FROM players WHERE id = ?;', { msg.From })
        
        -- If creator leaves, assign new creator
        local creator = admin:select('SELECT id FROM players WHERE is_creator = TRUE;', {})
        if #creator == 0 then
            local newCreator = admin:exec('SELECT id FROM players LIMIT 1;')
            if #newCreator > 0 then
                admin:apply(
                    'UPDATE players SET is_creator = TRUE WHERE id = ?;',
                    { newCreator[1].id }
                )
            end
        end
        
        msg.reply({ Data = "Left game" })
    end
)

-- Get all players
Handlers.add(
    "Get-Players",
    "Get-Players",
    function(msg)
        local players = admin:exec("SELECT * FROM players")
        msg.reply({ Data = players })
    end
)

-- Start game
Handlers.add(
    "Start-Game",
    "Start-Game",
    function(msg)
        -- Check if sender is creator
        local creator = admin:select('SELECT id FROM players WHERE is_creator = TRUE;', {})
        if not creator or #creator == 0 or creator[1].id ~= msg.From then
            msg.reply({ Data = "Only creator can start game" })
            return
        end

        -- Check minimum players
        local playerCount = admin:exec("SELECT COUNT(*) as count FROM players")[1].count
        if playerCount < GameState.minPlayers then
            msg.reply({ Data = "Not enough players" })
            return
        end

        -- Initialize game state
        InitializeGameState()

        -- Get all players
        local players = admin:exec("SELECT id FROM players")
        local roles = {}

        -- First add all required roles
        for _, role in ipairs(RequiredRoles) do
            table.insert(roles, role)
        end

        -- Fill remaining slots with extra roles
        local remainingSlots = #players - #roles
        for i = 1, remainingSlots do
            if i <= #ExtraRoles then
                table.insert(roles, ExtraRoles[i])
            end
        end

        -- Shuffle roles
        for i = #roles, 2, -1 do
            local j = math.random(i)
            roles[i], roles[j] = roles[j], roles[i]
        end

        -- Assign roles to players
        for i = 1, #players do
            admin:apply(
                'UPDATE players SET role = ? WHERE id = ?;',
                { roles[i], players[i].id }
            )
            -- Send private message with role
            ao.send({
                Target = players[i].id,
                Action = "Role-Assignment",
                Data = roles[i]
            })
        end

        -- Update game state
        GameState.phase = "night"
        GameState.round = 1
        GameState.timestamp = msg.Timestamp
        
        admin:apply(
            'INSERT INTO game_state (phase, round, timestamp) VALUES (?, ?, ?);',
            { GameState.phase, GameState.round, GameState.timestamp }
        )

        msg.reply({ Data = "Game started" })
    end
)

-- Get game state
Handlers.add(
    "Get-Game-State",
    "Get-Game-State",
    function(msg)
        msg.reply({ Data = GameState })
    end
)

-- Handle votes
Handlers.add(
    "Vote",
    "Vote",
    function(msg)
        if GameState.phase ~= "day" then
            msg.reply({ Data = "Can only vote during day phase" })
            return
        end

        local voter = msg.From
        local votedId = msg.Tags.votedId

        if not voter or not votedId then
            msg.reply({ Data = "Invalid vote parameters" })
            return
        end

        -- Check if voter is alive
        local voterAlive = admin:select('SELECT is_alive FROM players WHERE id = ?;', { voter })
        if #voterAlive == 0 or not voterAlive[1].is_alive then
            -- Send a broadcast message about dead player attempting to vote
            ao.send({
                Target = ao.id,
                Action = "Vote-Error",
                Data = {
                    message = "Dead players cannot vote",
                    playerId = voter
                }
            })
            msg.reply({ Data = "Dead players cannot vote" })
            return
        end

        -- Check if voted player exists and is alive
        local votedAlive = admin:select('SELECT is_alive FROM players WHERE id = ?;', { votedId })
        if #votedAlive == 0 or not votedAlive[1].is_alive then
            msg.reply({ Data = "Cannot vote for dead or non-existent players" })
            return
        end

        -- Record vote with proper parameter array
        local success = pcall(function()
            admin:apply(
                'INSERT OR REPLACE INTO votes (voter, voted_for) VALUES (?, ?);',
                { voter, votedId }
            )
        end)

        if not success then
            msg.reply({ Data = "Failed to record vote" })
            return
        end

        -- Get vote counts with proper SQL queries
        local voteCount = admin:select('SELECT COUNT(*) as count FROM votes;', {})
        local totalVoters = admin:select('SELECT COUNT(*) as count FROM players WHERE is_alive = TRUE;', {})

        -- Ensure we have valid results
        if #voteCount == 0 or #totalVoters == 0 then
            msg.reply({ Data = "Error counting votes" })
            return
        end

        -- Broadcast vote count
        ao.send({
            Target = ao.id,
            Action = "Vote-Cast",
            Data = {
                votersCount = voteCount[1].count,
                totalVoters = totalVoters[1].count
            }
        })

        msg.reply({ Data = "Vote recorded successfully" })

        -- Check if all alive players have voted
        if voteCount[1].count >= totalVoters[1].count then
            ResolveDayPhase()
        end
    end
)

-- Add function to resolve day phase
function ResolveDayPhase()
    -- Get vote counts with proper SQL query
    local voteResults = admin:select([[
        SELECT 
            voted_for,
            COUNT(*) as vote_count
        FROM votes 
        GROUP BY voted_for 
        ORDER BY vote_count DESC;
    ]], {})

    if #voteResults == 0 then
        BroadcastGameEvent({
            Action = "Vote-Error",
            Data = "No votes recorded"
        })
        return
    end

    -- Check for ties
    local maxVotes = voteResults[1].vote_count
    local tiedPlayers = {}
    
    for _, result in ipairs(voteResults) do
        if result.vote_count == maxVotes then
            table.insert(tiedPlayers, result.voted_for)
        end
    end

    -- If there's a tie, skip elimination
    if #tiedPlayers > 1 then
        BroadcastGameEvent({
            Action = "Vote-Result",
            Data = {
                result = "tie",
                message = "Vote resulted in a tie. No one was eliminated.",
                tiedPlayers = tiedPlayers,
                voteCount = maxVotes
            }
        })
    else
        -- Single player with highest votes
        local eliminatedPlayer = tiedPlayers[1]
        local playerData = admin:select('SELECT name, role FROM players WHERE id = ?;', { eliminatedPlayer })
        
        if #playerData == 0 then
            BroadcastGameEvent({
                Action = "Vote-Error",
                Data = "Failed to find eliminated player"
            })
            return
        end

        -- Kill the selected player
        admin:apply(
            'UPDATE players SET is_alive = FALSE WHERE id = ?;',
            { eliminatedPlayer }
        )
        
        -- Announce elimination with role reveal
        BroadcastGameEvent({
            Action = "Player-Eliminated",
            Data = {
                playerId = eliminatedPlayer,
                playerName = playerData[1].name,
                playerRole = playerData[1].role,
                voteCount = maxVotes
            }
        })
    end

    -- Clear votes
    admin:exec('DELETE FROM votes;')

    -- Check win conditions before transitioning to night phase
    if CheckWinConditions() then
        return  -- Don't transition to night phase if game is over
    end

    -- Only transition to night phase if game isn't over
    GameState.phase = "night"
    GameState.round = GameState.round + 1
    
    -- Update game state
    admin:apply(
        'UPDATE game_state SET phase = ?, round = ? WHERE id = 1;',
        { "night", GameState.round }
    )

    -- Reset night actions
    GameState.nightActionsComplete = {
        werewolf = false,
        doctor = false,
        seer = false
    }

    -- Announce phase change
    BroadcastGameEvent({
        Action = "Phase-Change",
        Data = "night"
    })
end

-- Initialize night actions tracking
NightActions = {
    kills = {},
    protections = {},
    revelations = {},
    actedPlayers = {} -- Track which players have acted
}

-- Reset night actions function
function ResetNightActions()
    NightActions = {
        kills = {},
        protections = {},
        revelations = {},
        actedPlayers = {}
    }
end

-- Modify Night action handler
Handlers.add(
    "Night-Action",
    function(msg)
        if GameState.phase ~= "night" then
            msg.reply({ Data = "Can only perform night actions during night phase" })
            return
        end

        local actor = msg.From
        local target = msg.Tags.Target
        local action = msg.Tags.ActionType

        -- Check if actor has already acted
        if NightActions.actedPlayers[actor] then
            msg.reply({ Data = "You have already performed your night action" })
            return
        end

        -- Check if actor is alive
        local actorData = admin:select('SELECT is_alive, role FROM players WHERE id = ?', { actor })
        if #actorData == 0 or not actorData[1].is_alive then
            msg.reply({ Data = "Dead players cannot perform actions" })
            return
        end

        local actionRecorded = false

        -- Handle different actions and mark them as complete
        if action == "kill" and actorData[1].role == "werewolf" then
            RecordNightAction(actor, "kill", target)
            UpdateNightActionStatus("werewolf", true)
            GameState.nightActionsComplete.werewolf = true
            actionRecorded = true
            msg.reply({ Data = "Kill action recorded" })
        elseif action == "protect" and actorData[1].role == "doctor" then
            RecordNightAction(actor, "protect", target)
            UpdateNightActionStatus("doctor", true)
            GameState.nightActionsComplete.doctor = true
            actionRecorded = true
            msg.reply({ Data = "Protection recorded" })
        elseif action == "see" and actorData[1].role == "seer" then
            local targetRole = admin:select('SELECT role FROM players WHERE id = ?', { target })[1].role
            RecordNightAction(actor, "see", target)
            UpdateNightActionStatus("seer", true)
            GameState.nightActionsComplete.seer = true
            actionRecorded = true
            msg.reply({ Data = targetRole })
        else
            msg.reply({ Data = "Invalid action for your role" })
            return
        end

        -- If action was recorded, check for phase transition
        if actionRecorded then
            -- Get count of alive players for each required role in one query
            local aliveRoles = admin:exec([[
                SELECT role, COUNT(*) as count 
                FROM players 
                WHERE role IN ('werewolf', 'doctor', 'seer') 
                AND is_alive = TRUE 
                GROUP BY role
            ]])

            -- Create lookup table of alive role counts
            local aliveCounts = {}
            for _, row in ipairs(aliveRoles) do
                aliveCounts[row.role] = row.count > 0
            end

            -- Check if all required night actions are complete for alive players
            local shouldTransition = true
            
            if aliveCounts.werewolf and not GameState.nightActionsComplete.werewolf then
                shouldTransition = false
            end
            if aliveCounts.doctor and not GameState.nightActionsComplete.doctor then
                shouldTransition = false
            end
            if aliveCounts.seer and not GameState.nightActionsComplete.seer then
                shouldTransition = false
            end

            if shouldTransition then
                -- Process night actions and transition to day phase
                TransitionToDay()
            end
        end
    end
)

-- Add new function to handle transition to day phase
function TransitionToDay()
    -- Check win conditions before transitioning to day phase
    if CheckWinConditions() then
        return  -- Don't transition to day phase if game is over
    end

    -- Process night actions first
    ResolveNightActions()

    -- Check win conditions again after night actions
    if CheckWinConditions() then
        return
    end

    -- Only transition to day phase if game isn't over
    GameState.phase = "day"
    GameState.timestamp = os.time()
    
    -- Reset night actions tracking
    GameState.nightActionsComplete = {
        werewolf = false,
        doctor = false,
        seer = false
    }
    
    -- Update game state in database
    admin:apply([[
        UPDATE game_state 
        SET phase = ?, timestamp = ?
        WHERE id = 1
    ]], { "day", GameState.timestamp })

    -- Clear votes table for new day
    admin:exec('DELETE FROM votes')

    -- Broadcast phase change
    BroadcastGameEvent({
        Action = "Phase-Change",
        Data = "day"
    })
end

-- Add a handler to check game phase
Handlers.add(
    "Get-Phase",
    function(msg)
        msg.reply({ 
            Data = {
                phase = GameState.phase,
                round = GameState.round,
                nightActions = GameState.nightActionsComplete
            }
        })
    end
)

-- Function to resolve night actions
function ResolveNightActions()
    -- Get all night actions for the current round, ordered by timestamp
    local nightActions = admin:select([[
        SELECT na.*, p.is_alive, p.name as actor_name, t.name as target_name
        FROM night_actions na
        JOIN players p ON na.actor_id = p.id
        JOIN players t ON na.target_id = t.id
        WHERE na.round = ? 
        ORDER BY na.timestamp ASC
    ]], { GameState.round })

    local kills = {}
    local protections = {}

    -- First pass: Process only protection actions from alive players
    for _, action in ipairs(nightActions) do
        if action.action_type == "protect" and action.is_alive then
            table.insert(protections, action.target_id)
            BroadcastGameEvent({
                Action = "Player-Protected",
                Data = {
                    targetName = action.target_name
                }
            })
        end
    end

    -- Second pass: Process kills from alive players and apply protections
    for _, action in ipairs(nightActions) do
        if action.action_type == "kill" and action.is_alive then
            local targetId = action.target_id
            local isProtected = false

            -- Check if target is protected
            for _, protectedId in ipairs(protections) do
                if targetId == protectedId then
                    isProtected = true
                    break
                end
            end

            if not isProtected then
                -- Kill the player
                admin:apply(
                    'UPDATE players SET is_alive = FALSE WHERE id = ?',
                    { targetId }
                )

                BroadcastGameEvent({
                    Action = "Player-Death",
                    Data = {
                        playerId = targetId,
                        playerName = action.target_name,
                        killerRole = "werewolf"
                    }
                })
            end
        end
    end

    -- Clear night actions for the round
    admin:apply(
        'DELETE FROM night_actions WHERE round = ?',
        { GameState.round }
    )
end

-- Get role handler
Handlers.add(
    "Get-Role",
    function(msg)
        local player = admin:select('SELECT role FROM players WHERE id = ?', { msg.From })
        if #player == 0 then
            msg.reply({ Data = "Not in game" })
            return
        end
        msg.reply({ Data = player[1].role })
    end
)

-- Get alive players
Handlers.add(
    "Get-Alive-Players",
    "Get-Alive-Players",
    function(msg)
        local players = admin:exec("SELECT id, name FROM players WHERE is_alive = TRUE")
        msg.reply({ Data = players })
    end
)

-- Reset game
Handlers.add(
    "Reset-Game",
    "Reset-Game",
    function(msg)
        -- Check if sender is creator
        local creator = admin:select('SELECT id FROM players WHERE is_creator = TRUE;', {})
        if #creator == 0 or creator[1].id ~= msg.From then
            msg.reply({ Data = "Only creator can reset game" })
            return
        end

        -- Reset game state
        admin:exec([[
            DELETE FROM game_state;
            UPDATE players SET 
                role = NULL,
                is_alive = TRUE,
                votes = 0;
        ]])

        GameState.phase = "lobby"
        GameState.round = 0
        GameState.timestamp = msg.Timestamp

        msg.reply({ Data = "Game reset" })
    end
)

-- Check if player is alive
Handlers.add(
    "Check-Alive",
    "Check-Alive",
    function(msg)
        local player = admin:select('SELECT is_alive FROM players WHERE id = ?;', { msg.From })
        
        if #player == 0 then
            msg.reply({ Data = false })
            return
        end

        -- SQLite stores booleans as 1 or 0
        local isAlive = player[1].is_alive == 1

        msg.reply({ Data = isAlive })
    end
)

-- Get seer visions handler
Handlers.add(
    "Get-Visions",
    function(msg)
        -- Verify seer
        local player = admin:select('SELECT role FROM players WHERE id = ?', { msg.From })
        if #player == 0 or player[1].role ~= "seer" then
            msg.reply({ Data = "Not authorized" })
            return
        end

        -- Get seer's visions
        local seerVisions = {}
        for _, vision in ipairs(NightActions.revelations) do
            if vision.seer == msg.From then
                table.insert(seerVisions, {
                    target = vision.target,
                    role = vision.role
                })
            end
        end
        msg.reply({ Data = seerVisions })
    end
)

-- Function to check win conditions
function CheckWinConditions()
    local alivePlayers = admin:exec([[
        SELECT role, COUNT(*) as count 
        FROM players 
        WHERE is_alive = TRUE 
        GROUP BY role
    ]])

    local werewolfCount = 0
    local villagerCount = 0  -- This will include all non-werewolf roles

    for _, roleCount in ipairs(alivePlayers) do
        if roleCount.role == "werewolf" then
            werewolfCount = roleCount.count
        else
            villagerCount = villagerCount + roleCount.count
        end
    end

    -- Debug logging
    admin:apply([[
        INSERT INTO game_events (action, data)
        VALUES (?, ?);
    ]], {
        "Debug-Win-Check",
        json.encode({
            werewolfCount = werewolfCount,
            villagerCount = villagerCount
        })
    })

    -- Check win conditions
    if werewolfCount == 0 then
        -- Villagers win
        BroadcastGameEvent({
            Action = "Game-Over",
            Data = "villagers"
        })
        -- Set game phase to "ended"
        GameState.phase = "ended"
        admin:apply(
            'UPDATE game_state SET phase = ? WHERE id = 1;',
            { "ended" }
        )
        return true
    elseif werewolfCount >= villagerCount then
        -- Werewolves win
        BroadcastGameEvent({
            Action = "Game-Over",
            Data = "werewolves"
        })
        -- Set game phase to "ended"
        GameState.phase = "ended"
        admin:apply(
            'UPDATE game_state SET phase = ? WHERE id = 1;',
            { "ended" }
        )
        return true
    end

    return false
end

-- Function to update night action status in database
function UpdateNightActionStatus(role, status)
    local column = "night_actions_" .. role
    admin:apply(
        string.format("UPDATE game_state SET %s = ? WHERE id = 1", column),
        { status }
    )
end

-- Function to get night actions status from database
function GetNightActionsStatus()
    local status = admin:exec([[
        SELECT 
            night_actions_werewolf,
            night_actions_doctor,
            night_actions_seer
        FROM game_state
        WHERE id = 1
    ]])[1]
    
    return {
        werewolf = status.night_actions_werewolf,
        doctor = status.night_actions_doctor,
        seer = status.night_actions_seer
    }
end

-- Function to record night action in database
function RecordNightAction(actorId, actionType, targetId)
    admin:apply([[
        INSERT INTO night_actions (
            round, actor_id, action_type, target_id, timestamp
        ) VALUES (?, ?, ?, ?, ?)
    ]], {
        GameState.round,
        actorId,
        actionType,
        targetId,
        os.time()
    })
end

-- Function to clear night actions
function ClearNightActions()
    admin:exec([[
        UPDATE game_state SET
            night_actions_werewolf = FALSE,
            night_actions_doctor = FALSE,
            night_actions_seer = FALSE
        WHERE id = 1
    ]])
    
    -- Clear the night_actions table for the current round
    admin:apply([[
        DELETE FROM night_actions
        WHERE round = ?
    ]], { GameState.round })
end

-- Function to initialize game state
function InitializeGameState()
    admin:exec([[
        INSERT OR REPLACE INTO game_state (
            id, phase, round, timestamp,
            night_actions_werewolf,
            night_actions_doctor,
            night_actions_seer
        ) VALUES (
            1, 'lobby', 0, ?,
            FALSE, FALSE, FALSE
        )
    ]], { os.time() })
end

-- Add error handling wrapper
function SafeDBOperation(operation, params)
    local success, result = pcall(operation, params)
    if not success then
        return nil, "Database operation failed"
    end
    return result
end

-- Function to add event to the queue
function AddGameEvent(event)
    -- Convert event data to JSON string
    local jsonData = json.encode(event.Data)
    
    -- Insert event into database with processed flag
    admin:apply([[
        INSERT INTO game_events (action, data, timestamp, processed)
        VALUES (?, ?, strftime('%s','now'), FALSE);
    ]], { 
        event.Action,
        jsonData
    })
    
    -- Clean up old processed events (keep last hour)
    admin:exec([[
        DELETE FROM game_events 
        WHERE timestamp < strftime('%s','now') - 3600
        AND processed = TRUE;
    ]])
end

-- Function to get and mark events as processed
Handlers.add(
    "Get-Game-Events",
    function(msg)
        -- Get unprocessed events
        local events = admin:select([[
            SELECT id, action, data, timestamp 
            FROM game_events 
            WHERE processed = FALSE
            ORDER BY timestamp ASC;
        ]], {})

        -- Mark these events as processed
        if #events > 0 then
            local eventIds = {}
            for _, event in ipairs(events) do
                table.insert(eventIds, event.id)
            end
            
            -- Convert to proper format for frontend
            local formattedEvents = {}
            for _, event in ipairs(events) do
                table.insert(formattedEvents, {
                    Action = event.action,
                    Data = json.decode(event.data)
                })
            end

            -- Mark events as processed
            admin:exec([[
                UPDATE game_events 
                SET processed = TRUE 
                WHERE id IN (]] .. table.concat(eventIds, ",") .. [[);
            ]])

            msg.reply({ Data = formattedEvents })
        else
            msg.reply({ Data = {} })
        end
    end
)

-- Function to broadcast and store game event
function BroadcastGameEvent(event)
    -- Send to all players
    ao.send({
        Target = ao.id,
        Action = event.Action,
        Data = event.Data
    })
    
    -- Store in database using AddGameEvent
    AddGameEvent(event)
end

-- Add function to check if game should end
function CheckGameEnd()
    local alivePlayers = admin:exec([[
        SELECT COUNT(*) as count 
        FROM players 
        WHERE is_alive = TRUE
    ]])[1].count

    if alivePlayers == 0 then
        BroadcastGameEvent({
            Action = "Game-Over",
            Data = "No players remaining"
        })
        return true
    end
    
    return false
end

-- Store chat messages in a table
admin:exec([[
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(player_id) REFERENCES players(id)
  );
]])

-- Send chat message handler
Handlers.add(
  "Send-Chat-Message",
  "Send-Chat-Message",
  function(msg)
    -- Check if player is alive
    local player = admin:select('SELECT name, is_alive FROM players WHERE id = ?;', { msg.From })
    if #player == 0 or not player[1].is_alive then
      msg.reply({ Data = "Dead players cannot send messages" })
      return
    end

    -- Insert message
    admin:apply(
      'INSERT INTO chat_messages (player_id, player_name, message, timestamp) VALUES (?, ?, ?, ?);',
      { msg.From, player[1].name, msg.Tags.Message, msg.Timestamp }
    )
    
    msg.reply({ Data = "Message sent" })
  end
)

-- Get chat messages handler
Handlers.add(
  "Get-Chat-Messages",
  "Get-Chat-Messages",
  function(msg)
    -- Get recent messages (last 50)
    local messages = admin:exec([[
      SELECT player_id, player_name, message, timestamp 
      FROM chat_messages 
      ORDER BY timestamp DESC 
      LIMIT 50
    ]])
    
    msg.reply({ Data = json.encode(messages) })
  end
)