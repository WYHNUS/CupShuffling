// socket
const socketIo = require('socket.io');

// game status
const JOIN_DEADLINE = 10; // in seconds
const GAME_STATE_ENUM = {
  UNACTIVATED: 1,
  WAIT_FOR_JOIN: 2,
  STARTED: 3
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
        let timer = setInterval(() => {
          if (countdown > 0) {
            io.emit('timer-update', { 
              msg: 'Game will start in ' + (countdown--) + ' seconds.'
            });
          } else {
            // change game status from WAIT_FOR_JOIN to STARTED
            console.log('Game started.');
            gameState = GAME_STATE_ENUM.STARTED;
            clearInterval(timer);
            io.emit('game-start', { 
              msg: 'Game has started.',
              time: new Date()
            });
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

    });

    // client send secret to decrypt previously sent commit
    socket.on('reveal-secret', function(req) {

    });
  }); 

  return io;
}
