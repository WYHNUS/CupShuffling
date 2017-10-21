// socket
const socketIo = require('socket.io');

module.exports.listen = function(app) {
  io = socketIo.listen(app);

  var totalCount = 0;
  var playerId = 1; // customized client id

  io.on('connection', function(socket) {
    totalCount++;
    var currentPlayerId = (socket.handshake.query.playerId && socket.handshake.query.playerId != '') 
        ? socket.handshake.query.playerId 
        : playerId++;

    // send connected socket its player id
    io.to(socket.id).emit('enter', {
      id: currentPlayerId
    });

    // tell all connected sockets player count has increased
    io.emit('players', { 
      count: totalCount
    });

    socket.on('disconnect', function() {
      totalCount--;
      io.emit('players', { count: totalCount });
    });

    // api
    socket.on('activate', function(socket) {
      // activate new round of cup shuffling game
    });

    socket.on('commit-guess', function(socket) {
      // client send (encrypted commit, guess) pair
    });

    socket.on('reveal-secret', function(socket) {
      // client send secret to decrypt previously sent commit
    });
  }); 

  return io;
}
