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

exports.objectsEqual = function(object1, object2) {
  if (!(object1 && object2)) { return false; }

  var object1Keys = Ember.keys(object1);
  var object2Keys = Ember.keys(object2);

  var haveSameKeys = this.arraysEqual(object1Keys, object2Keys);

  if(haveSameKeys) {
    var haveSameValues = object1Keys.every(function(key) {
      return object1[key] === object2[key];
    });
    return haveSameValues;
  } else {
    return false;
  }
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
    return Ember.get(toMatch, primaryStorageKey) === Ember.get(datum, primaryStorageKey);
  });
};

exports.findIn = function(arrayA, arrayB, klass) {
  return arrayA.reduce(function(inItems, item) {
    var itemExists = this.findMatching(item, klass, arrayB);

    if (itemExists) {
      inItems.push(item);
    }

    return inItems;
  }.bind(this), []);
};

exports.findNotIn = function(arrayA, arrayB, klass) {
  return arrayA.reduce(function(notIn, item) {
    var itemExists = this.findMatching(item, klass, arrayB);

    if (!itemExists) {
      notIn.push(item);
    }

    return notIn;
  }.bind(this), []);
};
