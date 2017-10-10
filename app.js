const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const port = 8088;  // default port
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/scripts', express.static(__dirname + '/node_modules/jquery/dist'));
app.use('/scripts', express.static(__dirname + '/node_modules/socket.io-client/dist'));

// entry page
app.get('/', function(req, res) {
  res.render('home');
});

// socket
var totalCount = 0;
io.on('connection', function(socket) {
  totalCount++;
  io.emit('players', { count: totalCount });

  socket.on('disconnect', function() {
    totalCount--;
    io.emit('players', { count: totalCount });
  });
});

// api
app.get('/activate', function(req, res) {
  // activate new round of cup shuffling game
});

app.get('/commit-guess', function(req, res) {
  // client send (encrypted commit, guess) pair
});

app.get('/reveal-secret', function(req, res) {
  // client send secret to decrypt previously sent commit
});

http.listen(port, function(server) {
    console.log('Listening on port %d', port);
  });