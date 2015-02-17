function NullStorage() {
  var noop = function(){};

  this.getItem = noop;
  this.setItem = noop;
  this.removeItem = noop;
  this.clear = noop;
  this.key = noop;
  this.length = 0;
};

module.exports.NullStorage = NullStorage;

module.exports.get = function() {
  try {
    localStorage.setItem('_rest-model', true);
    localStorage.removeItem('_rest-model', true);
    return localStorage;
  } catch (error) {
    return new NullStorage();
  }
};
