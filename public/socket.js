// get playerId field from url if present
const ID_PARAM = 'playerId';
const socket = io('http://127.0.0.1:8088', {
  query: {
    playerId: getParameterByName(ID_PARAM)
  }
});

socket.on('enter', function(data) {
  console.log('socket connection established!');
  console.log(data);
  // Set url to reflect player id
  // Note: 
  // this way of assigning player id is for the ease of testing via simulating
  // multiple client (player) by opening multiple windows on one single machine.
  // But it is a bad practice and should be discouraged in general.
  if (!getParameterByName(ID_PARAM)) {
    var url = window.location.href;
    if (url.indexOf('?') < 0) {
      url += '?';
    } else {
      url += '&';
    }
    url += (ID_PARAM + '=' + data.id);
    window.location.href = url;
  }
});

socket.on('players', function(data) {
  console.log('number of players updated!');
  console.log(data);
  $('#player-count').text(data.count);
});

/**
 * May not be the best solution, but suit for the needs of this project.
 * Code taken from: 
 * https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
 */
function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
  if (!results) return '';
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
