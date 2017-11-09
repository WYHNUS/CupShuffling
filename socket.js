// socket
const socketIo = require('socket.io');
// encryption
const sha256 = require('sha256');

// game status
// deadlines in seconds
const MIN_AMOUNT = 1;
const JOIN_DEADLINE = 10; 
const COMMIT_DEADLINE = 10;
const REVEAL_DEADLINE = 10;
const GAME_STATE_ENUM = {
  UNACTIVATED: 1,
  WAIT_FOR_JOIN: 2,
  STARTED: 3,
  COMMITTED: 4
};
const PLAYER_INITIAL_AMT = 10;

module.exports.listen = function(app) {
  io = socketIo.listen(app);

  // global variables
  var connectionCount = 0;
  var playerId = 1; // customized client id
  var countdown = 0;
  var gameState = 1;
  var gamePlayers = new Set();
  var playerBank = new Map();
  var playerCommit = new Map();
  var playerGuess = new Map();
  var validPlayer = new Set();
  var treasureLocation = 0;

  io.on('connection', function(socket) {
    connectionCount++;
    let currentPlayerId = (socket.handshake.query.playerId && socket.handshake.query.playerId != '') 
        ? socket.handshake.query.playerId 
        : playerId++;

    // set initial money player process
    let amount = PLAYER_INITIAL_AMT;
    if (playerBank.has(currentPlayerId)) {
      amount = playerBank.get(currentPlayerId);
    } else {
      playerBank.set(currentPlayerId, PLAYER_INITIAL_AMT);
    }

    // send connected socket its player id
    io.to(socket.id).emit('enter', {
      id: currentPlayerId,
      status: gameState,
      amt: amount
    });

    // tell all connected sockets player count has increased
    io.emit('players', { 
      count: connectionCount
    });

    socket.on('disconnect', function() {
      connectionCount--;
      io.emit('players', { count: connectionCount });
    });

    /**
     * API
     */

    // activate new round of cup shuffling game
    socket.on('activate', function(req) {
      if (!req.playerId) {
        // deny request
        io.to(socket.id).emit('activate-failure', {
          msg: 'Please specify your id'
        });
      } else if (gameState == GAME_STATE_ENUM.UNACTIVATED) {
        // only able to activate if unactivated
        console.log('Game activated by player ' + req.playerId + '.');
        let date = new Date();

        // update game state
        gameState = GAME_STATE_ENUM.WAIT_FOR_JOIN;

        // automatically make the player join the game he activated
        gamePlayers.add(req.playerId);

        // broadcast to everyone
        io.emit('waiting-for-join', {
          msg: 'New game activated by player: ' + req.playerId,
          time: date
        });
        io.emit('status-update', {
          msg: 'Player: ' + req.playerId + ' has joined the game.',
          time: date
        });
        io.to(socket.id).emit('join-success');

        // update counter 
        countdown = JOIN_DEADLINE;
        let joinTimer = setInterval(() => {
          if (countdown > 0) {
            io.emit('timer-update', { 
              msg: 'Game will start in ' + (countdown--) + ' seconds.'
            });
          } else {
            // change game status from WAIT_FOR_JOIN to STARTED
            console.log('Game started.');
            gameState = GAME_STATE_ENUM.STARTED;
            clearInterval(joinTimer);
            io.emit('game-start', { 
              msg: 'Game has started.',
              time: new Date()
            });

            // update counter
            countdown = COMMIT_DEADLINE;
            let commitTimer = setInterval(() => {
              if (countdown > 0) {
                io.emit('timer-update', { 
                  msg: 'You have ' + (countdown--) + ' seconds to send your guess.'
                });
              } else {
                // change game status from STARTED to COMMITTED
                console.log('Commit started.');
                gameState = GAME_STATE_ENUM.COMMITTED;
                clearInterval(commitTimer);

                // todo: implement reveal-secret in client side
                io.emit('reveal-secret', {
                  msg: 'Game in reveal secret stage.',
                  time: new Date()
                });

                // update counter
                countdown = REVEAL_DEADLINE;
                let revealTimer = setInterval(() => {
                  if (countdown > 0) {
                    io.emit('timer-update', { 
                      msg: 'You have ' + (countdown--) + ' seconds to reveal your secret.'
                    });
                  } else {
                    // convert 0 based location to 1 based index
                    treasureLocation++;
                    let msg = 'Game finishes with correct location: ' + treasureLocation;
                    console.log(msg);
                    io.emit('status-update', {
                      msg: msg,
                      time: new Date
                    });

                    // count number of players who have made correct guess
                    let correctPlayer = new Set();
                    for (let id of validPlayer) {
                      if (playerGuess.get(id) == treasureLocation) {
                        correctPlayer.add(id);
                      }
                    }

                    if (correctPlayer.size === 0) {
                      msg = 'No player has made the correct guess.';
                    } else {
                      msg = 'Player ' + Array.from(correctPlayer).toString() + ' has made correct guess.';
                    }
                    io.emit('status-update', {
                      msg: msg,
                      time: new Date
                    });

                    // todo: award user who has made correct guess

                    // end game by changing all game variables to default value
                    gameState = GAME_STATE_ENUM.UNACTIVATED;
                    gamePlayers = new Set();
                    playerCommit = new Map();
                    playerGuess = new Map();
                    validPlayer = new Set();
                    treasureLocation = 0;
                    
                    clearInterval(revealTimer);
                    io.emit('game-end', {
                      msg: 'Game has not been activated.'
                    });
                  }
                }, 1000);
              }
            }, 1000);
          }
        }, 1000);
      } else {
        // deny request
        io.to(socket.id).emit('activate-failure', {
          msg: 'Game already in progress'
        });
      }
    });

    // join an activated game
    socket.on('join', function(req) {
      if (!req.playerId) {
        // deny request
        io.to(socket.id).emit('join-failure', {
          msg: 'Please specify your id.'
        });
      } else if (gameState == GAME_STATE_ENUM.WAIT_FOR_JOIN) {
        if (gamePlayers.has(req.playerId)) {
          // deny request
          io.to(socket.id).emit('join-failure', {
            msg: 'You already in the game!'
          });
        }

        console.log('Player ' + req.playerId + ' has joined current game.');
        gamePlayers.add(req.playerId);
        // broadcast to everyone
        io.emit('status-update', {
          msg: 'Player: ' + req.playerId + ' has joined the game.',
          time: new Date()
        });
        io.to(socket.id).emit('join-success');
      } else {
        // deny request
        let errorMsg = GAME_STATE_ENUM.UNACTIVATED 
            ? 'Please activate the game first.'
            : 'Game already in progress, please join the next game.'
        io.to(socket.id).emit('join-failure', {
          msg: errorMsg
        });
      }
    });

    // client send (encrypted commit, guess) pair
    socket.on('commit-guess', function(req) {
      let id = req.playerId;
      // encrypt for the user for simplicity
      let commit = sha256(req.commit);
      let guess = req.guess;

      // check if player has enough credit in the bank account
      if (gamePlayers.has(id) && playerBank.has(id)) {
        if (playerBank.get(id) >= MIN_AMOUNT) {
          // store commit and guess
          playerCommit.set(id, commit);
          playerGuess.set(id, guess);
          // deduct subscription fee for guess

          // update everyone
          let commitMessage = 'Player ' + id + ' has made a guess ' + guess 
            + ' with committed message: ' + commit;
          io.emit('status-update', {
            msg: commitMessage,
            time: new Date()
          });
        } else {
          // not enough credit

        }
      } else {
        // player not present

      }
    });

    // client send secret to decrypt previously sent commit
    socket.on('reveal-secret', function(req) {
      let id = req.playerId;
      let secret = req.secret;

      // check if encrypted secret matches with the one stored previously
      if (sha256(secret) === playerCommit.get(id)) {
        // add secret to determine the location of the cup
        treasureLocation = (treasureLocation + secret) % gamePlayers.size;
        io.emit('status-update', {
          msg: 'Player ' + id + ' has revealed valid secret: ' + secret,
          time: new Date()
        });

        validPlayer.add(id);

        // todo: return user the subscription fee

      } else {
        // reject

      }
    });
  }); 

  return io;
}
