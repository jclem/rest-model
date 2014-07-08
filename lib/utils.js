'use strict';

exports.extend = function(target, source) {
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = source[key];
    }
  }

  return target;
};

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
