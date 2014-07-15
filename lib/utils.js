'use strict';

exports.arraysEqual = function(array1, array2) {
  if (array1.length !== array2.length) {
    return false;
  }

  var value1, value2;

  for (var i; i < array1.length; i++) {
    value1 = array1[i];
    value2 = array2[i];

    if (!Ember.isEqual(value1, value2)) {
      return false;
    }
  }

  return true;
};

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
