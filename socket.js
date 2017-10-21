// socket
const socketIo = require('socket.io');

// game status
const GAME_STATE_ENUM = {
  UNACTIVATED: 1,
  WAIT_FOR_JOIN: 2,
  STARTED: 3
};

module.exports.listen = function(app) {
  io = socketIo.listen(app);

  // global variables
  var connectionCount = 0;
  var playerId = 1; // customized client id
  var gameState = 1;
  var gamePlayers = new Set();

  io.on('connection', function(socket) {
    connectionCount++;
    let currentPlayerId = (socket.handshake.query.playerId && socket.handshake.query.playerId != '') 
        ? socket.handshake.query.playerId 
        : playerId++;

    // send connected socket its player id
    io.to(socket.id).emit('enter', {
      id: currentPlayerId,
      status: gameState
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
        console.log('activated by: ' + req.playerId);

        // update game state
        gameState = GAME_STATE_ENUM.WAIT_FOR_JOIN;

        // automatically make the player join the game he activated
        gamePlayers.add(req.playerId);

        // broadcast to everyone
        io.emit('waiting-for-join', {
          msg: 'New game activated by player: ' + req.playerId
        });
        io.emit('status-update', {
          msg: 'Player: ' + req.playerId + ' has joined the game.'
        });
        io.to(socket.id).emit('join-success');

        // todo: set a counter to change game status from WAIT_FOR_JOIN to STARTED

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
          msg: 'Player: ' + req.playerId + ' has joined the game.'
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
