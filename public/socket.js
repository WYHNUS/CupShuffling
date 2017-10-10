var socket = io();

socket.on('enter', function(data) {
  console.log(data);
});

socket.on('players', function(data) {
  console.log(data);
  $('#player-count').text(data.count);
});