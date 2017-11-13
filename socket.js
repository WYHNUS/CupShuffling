// socket
const socketIo = require('socket.io');
// encryption
const sha256 = require('sha256');

// game status
const MIN_AMOUNT = 1;
const SUBSCRIPTION_FEE = 0.1;
const SCHOLARSHIP = 0.05;
// deadlines in seconds
const JOIN_DEADLINE = 10; 
const COMMIT_DEADLINE = 10;
const CHECK_BALANCE_DEADLINE = 10;
const REVEAL_DEADLINE = 10;
const DISTRIBUTE_DEADLINE = 10;
const GAME_STATE_ENUM = {
  UNACTIVATED: 1,
  WAIT_FOR_JOIN: 2,
  STARTED: 3,
  CHECK_BALANCE: 4, 
  COMMITTED: 5,
  DISTRIBUTE: 6
};
const PLAYER_INITIAL_AMT = 10.0;

module.exports.listen = function(app) {
  io = socketIo.listen(app);

  // global variables
  var connectionCount = 0;
  var playerId = 1; // customized client id
  var playerSocketMap = new Map(); 
  var countdown = 0;
  var gameState = 1;
  var gamePlayers = new Set();
  var playerBank = new Map();
  var playerCommit = new Map();
  var playerGuess = new Map();
  var validPlayer = new Set();
  var treasureLocation = 0;
  var treasurePool = 0.0;

  io.on('connection', function(socket) {
    connectionCount++;
    let currentPlayerId = (socket.handshake.query.playerId && socket.handshake.query.playerId != '') 
        ? socket.handshake.query.playerId 
        : playerId++;

    playerSocketMap.set(currentPlayerId, socket.id);

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
      amount: amount
    });

    // tell all connected sockets player count has increased
    io.emit('players', { 
      count: connectionCount
    });

    socket.on('disconnect', function() {
      connectionCount--;
      playerSocketMap.delete(currentPlayerId);
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
          msg: 'Please specify your id.'
        });
      } else if (gameState == GAME_STATE_ENUM.UNACTIVATED) {
        if (playerBank.get(req.playerId) < MIN_AMOUNT) {
          io.to(socket.id).emit('activate-failure', {
            msg: 'Not enough credit to enter the game, you need at least: ' + MIN_AMOUNT
          });
        } else {
          // only able to activate if unactivated
          console.log('Game activated by player ' + req.playerId + '.');
          gameState = GAME_STATE_ENUM.WAIT_FOR_JOIN;

          // automatically make the player join the game he activated
          gamePlayers.add(req.playerId);

          let date = new Date();
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
              // todo: if only one player in the game -> halt


              console.log('Game has started.');
              clearInterval(joinTimer);
              gameState = GAME_STATE_ENUM.STARTED;

              io.emit('game-start', { 
                msg: 'Game has started, in commit stage.',
                time: new Date()
              });

              // update counter
              countdown = COMMIT_DEADLINE;
              let commitTimer = setInterval(() => {
                if (countdown > 0) {
                  io.emit('timer-update', { 
                    msg: 'Check balance will end in ' + (countdown--) + ' seconds.'
                  });
                } else {
                  console.log('Check balance has started.');
                  clearInterval(commitTimer);
                  gameState = GAME_STATE_ENUM.CHECK_BALANCE;

                  io.emit('status-update', {
                    msg: 'Game in check balance stage.',
                    time: new Date()
                  });

                  countdown = CHECK_BALANCE_DEADLINE;
                  let checkBalanceTimer = setInterval(() => {
                    // todo: kick out user if he doesn't have enough credit, and halt the game if only one user present 
                    // add one more cycle

                    if (countdown > 0) {
                      io.emit('timer-update', { 
                        msg: 'You have ' + (countdown--) + ' seconds to send your guess.'
                      });
                    } else {
                      console.log('Commit has started.');
                      clearInterval(checkBalanceTimer);
                      gameState = GAME_STATE_ENUM.COMMITTED;

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
                          console.log('Distribution has started.')
                          clearInterval(revealTimer);
                          gameState = GAME_STATE_ENUM.DISTRIBUTE;

                          io.emit('status-update', {
                            msg: 'Game in distribution stage.',
                            time: new Date()
                          });

                          // convert 0 based location to 1 based index
                          treasureLocation++;
                          let msg = 'Game finishes with correct location: ' + treasureLocation;
                          console.log(msg);
                          io.emit('status-update', {
                            msg: msg,
                            time: new Date
                          });

                          // reward players who reveal correct secret (calculated using the full price pool)
                          let totalScholarship = treasurePool * SCHOLARSHIP;
                          let individualScholarship = Math.floor(totalScholarship * 100.0 / validPlayer.size) / 100.0;
                          for (let id of validPlayer) {
                            playerBank.set(id, playerBank.get(id) + individualScholarship);

                            io.to(playerSocketMap.get(id)).emit('bank-update', {
                              amount: playerBank.get(id)
                            });
                          }
                          treasurePool -= totalScholarship;

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

                          // award user who has made correct guess
                          if (correctPlayer.size != 0) {
                            let individualPrice = Math.floor(treasurePool * 100.0 / correctPlayer.size) / 100.0;
                            for (let id of correctPlayer) {
                              playerBank.set(id, playerBank.get(id) + individualPrice);

                              io.to(playerSocketMap.get(id)).emit('bank-update', {
                                amount: playerBank.get(id)
                              });
                            }
                            treasurePool = 0.0;
                          }

                          // distribution cycle
                          countdown = DISTRIBUTE_DEADLINE
                          let distributeTimer = setInterval(() => {
                            if (countdown > 0) {
                              io.emit('timer-update', { 
                                msg: 'Distribution will end in ' + (countdown--) + ' seconds.'
                              });
                            } else {
                              console.log('Game is ended.');
                              clearInterval(distributeTimer);
                              gameState = GAME_STATE_ENUM.UNACTIVATED;

                              // change game variables to default value
                              gamePlayers = new Set();
                              playerCommit = new Map();
                              playerGuess = new Map();
                              validPlayer = new Set();
                              treasureLocation = 0;
                              
                              io.emit('game-end', {
                                msg: 'Game has not been activated.'
                              });
                            }
                          }, 1000);
                        }
                      }, 1000);
                    }
                  }, 1000);
                }
              }, 1000);
            }
          }, 1000);
        }
      } else {
        // deny request
        io.to(socket.id).emit('activate-failure', {
          msg: 'Game already in progress.'
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
        let id = req.playerId;
        if (gamePlayers.has(id)) {
          // deny request
          io.to(socket.id).emit('join-failure', {
            msg: 'You already in the game!'
          });
        } else if (playerBank.get(id) >= MIN_AMOUNT) {
          console.log('Player ' + id + ' has joined current game.');
          gamePlayers.add(id);

          // broadcast to everyone
          io.emit('status-update', {
            msg: 'Player: ' + id + ' has joined the game.',
            time: new Date()
          });

          io.to(socket.id).emit('join-success');
        } else {
          // deny request: not enough credit
          io.to(socket.id).emit('join-failure', {
            msg: 'Not enough credit to enter the game, you need at least: ' + MIN_AMOUNT
          });
        }
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
      console.log(gameState);
      if (!req.playerId || !req.guess || !req.commit) {
        // deny request
        io.to(socket.id).emit('commit-failure', {
          msg: 'Invalid request: must specify id, guess and commitment.'
        });
      } else if (gameState == GAME_STATE_ENUM.STARTED) {
        let id = req.playerId;
        let guess = req.guess;
        // encrypt for the user for simplicity
        let commit = sha256(req.commit);

        console.log('Player ' + id + ' send guess: ' + guess + ' with commit: ' + commit);

        // check if player has enough credit in the bank account
        if (gamePlayers.has(id) && playerBank.has(id)) {
          // store commit and guess
          playerCommit.set(id, commit);
          playerGuess.set(id, guess);

          // deduct value for guess, and add that into treasure pool
          playerBank.set(id, playerBank.get(id) - MIN_AMOUNT);
          treasurePool += (MIN_AMOUNT - SUBSCRIPTION_FEE);
          io.to(socket.id).emit('bank-update', {
            amount: playerBank.get(id)
          });

          // update everyone
          let commitMessage = 'Player ' + id + ' has made a guess ' + guess 
            + ' with committed message: ' + commit;
          io.emit('status-update', {
            msg: commitMessage,
            time: new Date()
          });
        } else {
          // player not present (not suppose to happen in test senario)
          io.to(socket.id).emit('commit-failure', {
            msg: 'Invalid player id.'
          });
        }
      } else {
        // deny request
        let errorMsg = GAME_STATE_ENUM.UNACTIVATED 
            ? 'Please activate the game first.'
            : 'You can only commit in commit guess phase.'
        io.to(socket.id).emit('commit-failure', {
          msg: errorMsg
        });
      }
    });

    // client send secret to decrypt previously sent commit
    socket.on('reveal-secret', function(req) {
      let id = req.playerId;
      let secret = req.secret;

      if (!id || !secret) {
        // deny request
        io.to(socket.id).emit('reveal-failure', {
          msg: 'Invalid request: must specify id and previous commitment\'s secret.'
        });
      } else if (gameState == GAME_STATE_ENUM.COMMITTED) {
        // check if encrypted secret matches with the one stored previously
        if (sha256(secret) === playerCommit.get(id)) {
          // add secret to determine the location of the cup
          treasureLocation = (treasureLocation + secret) % gamePlayers.size;
          io.emit('status-update', {
            msg: 'Player ' + id + ' has revealed valid secret: ' + secret,
            time: new Date()
          });

          validPlayer.add(id);
        } else {
          io.to(socket.id).emit('reveal-failure', {
            msg: 'Incorrect secret: it is not able to open up previous commit.'
          });
        }
      } else {
        // deny request
        let errorMsg = GAME_STATE_ENUM.UNACTIVATED 
            ? 'Please activate the game first.'
            : 'You can only reveal secret in reveal secret phase.'
        io.to(socket.id).emit('reveal-failure', {
          msg: errorMsg
        });
      }
    });
  }); 

  return io;
}
