-- Initialize database
local sqlite3 = require("lsqlite3")
local dbAdmin = require("@rakis/DbAdmin")

-- Open an in-memory database
db = sqlite3.open_memory()
admin = dbAdmin.new(db)

-- Create tables
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

admin:exec([[
  CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY,
    phase TEXT DEFAULT 'lobby',
    round INTEGER DEFAULT 0,
    timestamp INTEGER DEFAULT 0
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

-- Game state variables
GameState = {
    phase = "lobby",
    round = 0,
    timestamp = 0,
    minPlayers = 4,
    maxPlayers = 8
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
    "werewolf",
    "villager",
    "villager",
    "villager"
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

        -- Check if voter is alive
        local voterAlive = admin:select('SELECT is_alive FROM players WHERE id = ?', { voter })
        if not voterAlive or not voterAlive[1].is_alive then
            msg.reply({ Data = "Dead players cannot vote" })
            return
        end

        -- Record vote
        admin:apply('INSERT OR REPLACE INTO votes (voter, voted_for) VALUES (?, ?)', { voter, votedId })
        msg.reply({ Data = "Vote recorded" })

        -- Check if all alive players have voted
        local alivePlayers = admin:select('SELECT COUNT(*) as count FROM players WHERE is_alive = TRUE')[1].count
        local votesCast = admin:select('SELECT COUNT(*) as count FROM votes')[1].count

        if votesCast >= alivePlayers then
            -- Resolve votes
            ResolveDayPhase()
        end
    end
)

-- Add function to resolve day phase
function ResolveDayPhase()
    -- Get vote counts
    local voteResults = admin:exec([[
        SELECT voted_for, COUNT(*) as votes
        FROM votes
        GROUP BY voted_for
        ORDER BY votes DESC
        LIMIT 1
    ]])

    if #voteResults > 0 then
        local mostVoted = voteResults[1].voted_for
        
        -- Kill the most voted player
        admin:apply('UPDATE players SET is_alive = FALSE WHERE id = ?', { mostVoted })
        
        -- Announce death
        ao.send({
            Target = ao.id,
            Action = "Player-Death",
            Data = mostVoted
        })

        -- Clear votes
        admin:apply('DELETE FROM votes')

        -- Move to night phase
        GameState.phase = "night"
        GameState.round = GameState.round + 1
        
        admin:apply([[
            UPDATE game_state 
            SET phase = ?, round = ?
            WHERE id = 1
        ]], { GameState.phase, GameState.round })

        -- Broadcast phase change
        ao.send({
            Target = ao.id,
            Action = "Phase-Change",
            Data = "night"
        })

        -- Check win conditions
        CheckWinConditions()
    end
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

-- Night action handler
Handlers.add(
    "Night-Action",
    function(msg)
        if GameState.phase ~= "night" then
            msg.reply({ Data = "Can only act during night phase" })
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

        -- Handle different actions
        if action == "kill" and actorData[1].role == "werewolf" then
            table.insert(NightActions.kills, { target = target, killer = actor })
            NightActions.actedPlayers[actor] = true
            msg.reply({ Data = "Kill action recorded" })
        elseif action == "protect" and actorData[1].role == "doctor" then
            NightActions.protections[actor] = target
            NightActions.actedPlayers[actor] = true
            msg.reply({ Data = "Protection recorded" })
        elseif action == "see" and actorData[1].role == "seer" then
            local targetRole = admin:select('SELECT role FROM players WHERE id = ?', { target })[1].role
            table.insert(NightActions.revelations, {
                seer = actor,
                target = target,
                role = targetRole
            })
            NightActions.actedPlayers[actor] = true
            msg.reply({ Data = targetRole })
        else
            msg.reply({ Data = "Invalid action for your role" })
            return
        end

        -- Check if all night actions are complete
        local allActionsComplete = true
        local alivePlayers = admin:exec([[
            SELECT id, role 
            FROM players 
            WHERE is_alive = TRUE 
            AND role IN ('werewolf', 'doctor', 'seer')
        ]])

        for _, player in ipairs(alivePlayers) do
            if not NightActions.actedPlayers[player.id] then
                allActionsComplete = false
                break
            end
        end

        if allActionsComplete then
            -- Move to day phase
            GameState.phase = "day"
            GameState.timestamp = os.time()
            
            -- Update game state in database
            admin:apply([[
                UPDATE game_state 
                SET phase = 'day', 
                    timestamp = ? 
                WHERE id = 1
            ]], { GameState.timestamp })

            -- Reset acted players for next night
            NightActions.actedPlayers = {}

            -- Broadcast phase change
            ao.send({
                Target = ao.id,
                Action = "Phase-Change",
                Data = "day"
            })
        end
    end
)

-- Function to resolve night actions
function ResolveNightActions()
    -- Process kills and protections
    for _, kill in ipairs(NightActions.kills) do
        local targetProtected = false
        
        -- Check if target was protected
        for _, protectedId in pairs(NightActions.protections) do
            if protectedId == kill.target then
                targetProtected = true
                break
            end
        end

        -- Kill unprotected targets
        if not targetProtected then
            admin:apply(
                'UPDATE players SET is_alive = FALSE WHERE id = ?',
                { kill.target }
            )
            
            -- Announce death
            ao.send({
                Target = ao.id,
                Action = "Player-Death",
                Data = kill.target
            })
        end
    end

    -- Reset night actions
    ResetNightActions()

    -- Check win conditions
    CheckWinConditions()
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
        local targetId = msg.Data.playerId or msg.From
        local player = admin:select('SELECT is_alive FROM players WHERE id = ?;', { targetId })
        if #player == 0 then
            msg.reply({ Data = false })
            return
        end
        msg.reply({ Data = player[1].is_alive })
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
    local villagerCount = 0

    for _, roleCount in ipairs(alivePlayers) do
        if roleCount.role == "werewolf" then
            werewolfCount = roleCount.count
        else
            villagerCount = villagerCount + roleCount.count
        end
    end

    -- Check win conditions
    if werewolfCount == 0 then
        -- Villagers win
        ao.send({
            Target = ao.id,
            Action = "Game-Over",
            Data = "villagers"
        })
    elseif werewolfCount >= villagerCount then
        -- Werewolves win
        ao.send({
            Target = ao.id,
            Action = "Game-Over",
            Data = "werewolves"
        })
    end
end

