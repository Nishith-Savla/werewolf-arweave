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

  CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY,
    phase TEXT DEFAULT 'lobby',
    round INTEGER DEFAULT 0,
    timestamp INTEGER DEFAULT 0
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

-- Available roles
Roles = {
    "werewolf",
    "werewolf",
    "villager",
    "villager",
    "villager",
    "villager",
    "seer",
    "doctor"
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
        local creator = admin:select('SELECT id FROM players WHERE is_creator = TRUE;')
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
        local creator = admin:select('SELECT id FROM players WHERE is_creator = TRUE;')
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

        -- Assign roles randomly
        local players = admin:exec("SELECT id FROM players")
        local shuffledRoles = {}
        
        -- Initialize shuffledRoles first
        for i = 1, #players do
            if i <= #Roles then
                shuffledRoles[i] = Roles[i]
            else
                break
            end
        end

        -- Then shuffle them
        for i = #shuffledRoles, 2, -1 do
            local j = math.random(i)
            shuffledRoles[i], shuffledRoles[j] = shuffledRoles[j], shuffledRoles[i]
        end

        -- Update players with roles
        for i = 1, #players do
            if shuffledRoles[i] then  -- Make sure we have a role to assign
                admin:apply(
                    'UPDATE players SET role = ? WHERE id = ?;',
                    { shuffledRoles[i], players[i].id }
                )
                -- Send private message with role
                ao.send({
                    Target = players[i].id,
                    Action = "Role-Assignment",
                    Data = shuffledRoles[i]
                })
            end
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
        local votee = msg.Data.votedId

        -- Check if voter is alive
        local voterAlive = admin:select('SELECT is_alive FROM players WHERE id = ?;', { voter })
        if not voterAlive[1].is_alive then
            msg.reply({ Data = "Dead players cannot vote" })
            return
        end

        -- Record vote
        admin:apply(
            'UPDATE players SET votes = votes + 1 WHERE id = ?;',
            { votee }
        )

        msg.reply({ Data = "Vote recorded" })

        -- Check if all alive players have voted
        local alivePlayers = admin:exec("SELECT COUNT(*) as count FROM players WHERE is_alive = TRUE")[1].count
        local totalVotes = admin:exec("SELECT SUM(votes) as total FROM players")[1].total

        if totalVotes >= alivePlayers then
            -- Find player with most votes
            local mostVoted = admin:exec("SELECT id FROM players ORDER BY votes DESC LIMIT 1")
            
            -- Kill player
            admin:apply(
                'UPDATE players SET is_alive = FALSE WHERE id = ?;',
                { mostVoted[1].id }
            )

            -- Reset votes
            admin:apply('UPDATE players SET votes = 0;')

            -- Move to night phase
            GameState.phase = "night"
            GameState.timestamp = msg.Timestamp
            
            -- Check win condition
            CheckWinCondition()
        end
    end
)

-- Night action handler
Handlers.add(
    "Night-Action",
    "Night-Action",
    function(msg)
        if GameState.phase ~= "night" then
            msg.reply({ Data = "Can only act during night phase" })
            return
        end

        local actor = msg.From
        local target = msg.Data.targetId
        local action = msg.Data.action

        -- Get actor's role
        local actorRole = admin:select('SELECT role FROM players WHERE id = ?;', { actor })[1].role

        if action == "kill" and actorRole == "werewolf" then
            -- Handle werewolf kill
            admin:apply(
                'UPDATE players SET is_alive = FALSE WHERE id = ?;',
                { target }
            )
        elseif action == "protect" and actorRole == "doctor" then
            -- Handle doctor protection
            -- Add protection logic
        elseif action == "see" and actorRole == "seer" then
            -- Handle seer ability
            local targetRole = admin:select('SELECT role FROM players WHERE id = ?;', { target })[1].role
            ao.send({
                Target = actor,
                Action = "Seer-Result",
                Data = targetRole
            })
        end

        -- Move to day phase after all night actions
        -- This is simplified; you might want to track who has acted
        GameState.phase = "day"
        GameState.timestamp = msg.Timestamp
        GameState.round = GameState.round + 1

        CheckWinCondition()
    end
)

-- Helper function to check win condition
function CheckWinCondition()
    local werewolves = admin:exec("SELECT COUNT(*) as count FROM players WHERE role = 'werewolf' AND is_alive = TRUE")[1].count
    local villagers = admin:exec("SELECT COUNT(*) as count FROM players WHERE role != 'werewolf' AND is_alive = TRUE")[1].count

    if werewolves == 0 then
        GameState.phase = "finished"
        ao.send({ Target = ao.id, Action = "Game-Over", Data = "Villagers win!" })
    elseif werewolves >= villagers then
        GameState.phase = "finished"
        ao.send({ Target = ao.id, Action = "Game-Over", Data = "Werewolves win!" })
    end
end

-- Get player role
Handlers.add(
    "Get-Role",
    "Get-Role",
    function(msg)
        local player = admin:select('SELECT role FROM players WHERE id = ?;', { msg.From })
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
        local creator = admin:select('SELECT id FROM players WHERE is_creator = TRUE;')
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
