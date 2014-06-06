'use strict';

exports.findMatching = function(toMatch, klass, data) {
  return data.find(function(datum) {
    var i, primaryKey;

    for (i = 0; i < klass.primaryKeys.length; i++) {
      primaryKey = klass.primaryKeys[i];

      if (get(toMatch, primaryKey) === get(datum, primaryKey)) {
        return true;
      }
    }
  });
};

function get(object, key) {
  if (typeof object.get === 'function') {
    return object.get(key);
  } else {
    return object[key];
  }
}
