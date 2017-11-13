// get playerId field from url if present
const ID_PARAM = 'playerId';
const socket = io('http://127.0.0.1:8088', {
  query: {
    playerId: getParameterByName(ID_PARAM)
  }
});


/**
 * Connect to Backend
 */
socket.on('enter', function(data) {
  console.log('socket connection established!');
  // Set url to reflect player id
  // Note: 
  // this way of assigning player id is for the ease of testing via simulating
  // multiple client (player) by opening multiple windows on one single machine.
  // But it is a bad practice and should be discouraged in general.
  if (!getParameterByName(ID_PARAM)) {
    let url = window.location.href;
    if (url.indexOf('?') < 0) {
      url += '?';
    } else {
      url += '&';
    }
    url += (ID_PARAM + '=' + data.id);
    window.location.href = url;
  }

  // update game status
  if (data.status == 1 /* UNACTIVATED */) {
    $('#game-status').text('Game has not been activated.');
    $('#start-button').removeAttr('disabled');
  } else if (data.status == 2 /* WAIT_FOR_JOIN */) {
    $('#game-status').text('Game is waiting for join.');
    $('#join-button').removeAttr('disabled');
  } else /* STARTED */ {
    $('#game-status').text('Game already started, wait for next game to participate.');
  }

  // display current bank value
  $('#bank-amount').text(data.amount);
});

// update player count
socket.on('players', function(data) {
  console.log('number of players updated!');
  $('#player-count').text(data.count);
});


/**
 * Game Status, Bank Amount and Timer Update
 */
socket.on('status-update', function(data) {
  updatePanel(data.time, data.msg);
});

socket.on('bank-update', function(data) {
  $('#bank-amount').text(data.amount);
});

// timer used for updating the game status clock
socket.on('timer-update', function(data) {
  $('#game-timer').text(data.msg);
});


/**
 * Activate Game
 */
function activate() {
  socket.emit('activate', {
    playerId: getParameterByName(ID_PARAM)
  });
}

// activate status
socket.on('waiting-for-join', function(data) {
  $('#game-status').text(data.msg);
  $('#start-button').attr('disabled', 'disabled');
  $('#join-button').removeAttr('disabled');
  updatePanel(data.time, data.msg);
});

socket.on('activate-failure', function(data) {
  $('#game-status').text(data.msg);
});


/**
 * Join Game
 */
function join() {
  socket.emit('join', {
    playerId: getParameterByName(ID_PARAM)
  });
}

// join status
socket.on('join-success', function(data) {
  $('#game-status').text('Successfully join current game.');
  $('#join-button').attr('disabled', 'disabled');
});

socket.on('join-failure', function(data) {
  $('#game-status').text(data.msg);
});

// game starts -> players can send commit and guess
socket.on('game-start', function(data) {
  $('#game-timer').text('');
  $('#game-status').text(data.msg);
  $('#send-guess').removeAttr('disabled');
  updatePanel(data.time, data.msg);
});


/**
 * Commit Guess
 */
function sendGuess() {
  // todo: validate if guess is valid (within range)


  // prevent secret change and submit multiple times
  $('#generate-secret').attr('disabled', 'disabled');
  $('#send-guess').attr('disabled', 'disabled');

  let secret = $('#secret-display').text();
  let guess = $('#guess-input').val();

  // user should encode his secret locally, but for simplicity, 
  // he will send the secret to the server and let server to encrypt
  // using external libraries
  socket.emit('commit-guess', {
    playerId: getParameterByName(ID_PARAM),
    commit: secret,
    guess: guess
  });
}

socket.on('reveal-secret', function(data) {
  $('#game-timer').text('');
  $('#game-status').text(data.msg);
  $('#reveal-secret').removeAttr('disabled');
  updatePanel(data.time, data.msg);
});

socket.on('commit-failure', function(data) {
  $('#game-status').text(data.msg);
});

function getSecret() {
  $('#secret-display').text(generateSecret());
}

function generateSecret() {
  // might need to be replaced later
  return Math.floor(Math.random() * 10000000000000000);
} 


/**
 * Reveal Secret
 */
function sendSecret() {
  let secret = $('#secret-display').text();

  socket.emit('reveal-secret', {
    playerId: getParameterByName(ID_PARAM),
    secret: secret
  });
}

socket.on('reveal-failure', function(data) {
  $('#game-status').text(data.msg);
});


/**
 * Game End -> reset
 */
socket.on('game-end', (data) => {
  $('#start-button').removeAttr('disabled');
  $('#game-status').text(data.msg);
  $('#game-timer').text('');
  $('#reveal-secret').attr('disabled', 'disabled');
});


/**
 * Update game dashboard.
 */
function updatePanel(timestamp, description) {
  $('#game-panel').find('tbody')
    .prepend($('<tr>')
      .append($('<td>').append($('<p>').text(timestamp)))
      .append($('<td>').append($('<p>').text(description))));
}

/**
 * May not be the best solution, but suit for the needs of this project.
 * Code taken from: 
 * https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
 */
function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  let regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
  if (!results) return '';
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
