const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const port = 8088;  // default port
const app = express();
const http = require('http').Server(app);
const io = require('./socket').listen(http);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/scripts', express.static(__dirname + '/node_modules/jquery/dist'));
app.use('/scripts', express.static(__dirname + '/node_modules/bootstrap/dist'));
app.use('/scripts', express.static(__dirname + '/node_modules/socket.io-client/dist'));

// entry page
app.get('/', function(req, res) {
  res.render('home');
});

http.listen(port, function(server) {
  console.log('Listening on port %d', port);
});
