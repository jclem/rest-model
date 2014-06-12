'use strict';

exports.findMatching = function(toMatch, klass, data) {
  var primaryStorageKey = klass.primaryKeys[0];

  return data.find(function(datum) {
    return get(toMatch, primaryStorageKey) === get(datum, primaryStorageKey);
  });
};

function get(object, key) {
  if (typeof object.get === 'function') {
    return object.get(key);
  } else {
    return object[key];
  }
}
