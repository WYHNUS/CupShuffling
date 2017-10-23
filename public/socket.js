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
});

// update player count
socket.on('players', function(data) {
  console.log('number of players updated!');
  $('#player-count').text(data.count);
});

/**
 * Game Status Update
 */
socket.on('status-update', function(data) {
  updatePanel(data.time, data.msg);
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
  // todo: change join button to un-join (is it necessary to implement this feature?)
});

socket.on('join-failure', function(data) {
  $('#game-status').text(data.msg);
});

// timer used when waiting to join the game
socket.on('timer-update', function(data) {
  $('#game-timer').text(data.msg);
});

socket.on('game-start', function(data) {
  $('#game-timer').text('');
  $('#game-status').text(data.msg);
  updatePanel(data.time, data.msg);
});


/**
 * Action users have in each round of the game.
 */


/**
 * Update game dashboard.
 */
function updatePanel(timestamp, description) {
  $('#game-panel').find('tbody')
    .append($('<tr>')
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
