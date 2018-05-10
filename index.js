var tilebelt = require('@mapbox/tilebelt');
var pkg = require('./package.json');
var getPixels = require('get-pixels');

// TODO interpolate between adjacent pixels
// TODO take path (list of points, encoded polyline, optional "samples" parameter)
// infer zoom level from path detail
// TODO include location in response

module.exports = function (cacheSize) {
  // poor man's LRU cache
  cacheSize = cacheSize || 100;
  var cache = {};
  function getPixelPromise(url) {
    var now = Date.now();
    cache[url] = cache[url] || {
      value: new Promise(function (res, rej) {
        getPixels(url, function (err, pixels) {
          if (err) rej(err);
          else res(pixels);
        });
      }),
      time: now
    };
    var result = cache[url].value;
    cache[url].time = now;
    var keys = Object.keys(cache);
    if (keys.length > cacheSize) {
      var minTime = Infinity;
      var minKey = null;
      keys.forEach(function (key) {
        if (key.time < minTime) {
          minTime = key.time;
          minKey = key;
        }
      })
      delete cache[minKey];
    }
    return result;
  }

  return function(p, zoom) {
    var tf = tilebelt.pointToTileFraction(p[0], p[1], zoom);
    var tile = tf.map(Math.floor);
    var url = `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${tile[2]}/${tile[0]}/${tile[1]}.png`;
    return getPixels(url, function(err, pixels) {
      if (err) return cb(err);
      var xp = tf[0] - tile[0];
      var yp = tf[1] - tile[1];
      var x = Math.floor(xp*pixels.shape[0]);
      var y = Math.floor(yp*pixels.shape[1]);

      var R = pixels.get(x, y, 0);
      var G = pixels.get(x, y, 1);
      var B = pixels.get(x, y, 2);

      var height = (R * 256 + G + B / 256) - 32768;

      return cb(null, height);
    });
  }
};