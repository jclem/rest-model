'use strict';

var utils = require('./utils');

/**
 * A set of functions responsible for managing RestModel's localStorage cache.
 *
 * @class RestModel.Cache
 */

/**
 * Fetch a string value from the cache, and return it, JSON-parsed.
 *
 * @method get
 * @private
 * @param {String} key the key to fetch the value from the cache for
 * @return {Object,Array.String,Array.Object} a cached object or array
 */
exports.get = function(key) {
  var value = localStorage.getItem(key) || null;
  return JSON.parse(value);
};

/**
 * Set a JSON value as a string in the cache.
 *
 * @method set
 * @private
 * @param {String} key the key to set the value for in the cache
 * @param {Object,Array.String,Array.Object} value the value to put in the cache
 */
exports.set = function(key, value) {
  var stringValue = JSON.stringify(value);
  return localStorage.setItem(key, stringValue);
};

/**
 * Given that `cache.get(klass)` returns an array of models as JSON, and
 * `cache.get(cacheKey)` returns an array of IDs for that cache key, return
 * an array (or single instance of) the models for a given cache key.
 *
 * @method getModels
 * @param {Function} klass a {{#crossLink "RestModel"}}RestModel{{/crossLink}}
 *   to fetch records for
 * @param {String} cacheKey the cache key for an ID or array of IDs for the
 *   given class
 * @return {Object,Array.Object} an object or array of objects
 * @example
 *     cache.set('Widget', [{ id: 1, name: 'foo-widget' }, { id: 2, name: 'bar-widget' }]);
 *     cache.set('/widgets', [1]);
 *     var models = cache.getModels(Widget, '/widgets');
 *     assert(models === [{ id: 1, name: 'foo-widget' }]);
 */
exports.getModels = function(klass, cacheKey) {
  var allCachedModels   = this.get(klass);
  var primaryStorageKey = klass.primaryKeys[0];
  var ids               = this.get(cacheKey);

  if (!allCachedModels) {
    return null;
  }

  if ($.isArray(ids)) {
    return allCachedModels.filter(function(model) {
      return ids.contains(model[primaryStorageKey]);
    });
  } else {
    return allCachedModels.find(function(model) {
      return model[primaryStorageKey] === ids;
    });
  }
};

/**
 * Given a class, a cache key, and an object or array of objects representing
 * records:
 *
 *   1. Add the records' primary keys to the given `cacheKey`.
 *   2. Add any new records to the class's primary cache store.
 *
 * @method update
 * @param {Function} klass a {{#crossLink "RestModel"}}RestModel{{/crossLink}}
 *   to update cached records for
 * @param {String} cacheKey the cache key to place the given records' primary
 *   keys in
 * @param {Object,Array.Object} data an object or array of objects to put into
 *   the cache
 */
exports.update = function(klass, cacheKey, data) {
  var primaryStorageKey = klass.primaryKeys[0];
  var keys;

  this.updateClassStore(klass, data);

  if ($.isArray(data)) {
    keys = data.map(function(datum) {
      return datum[primaryStorageKey];
    });
  } else {
    keys = data[primaryStorageKey];
  }

  this.set(cacheKey, keys);
};

/**
 * Given a class and an object or array of objects, add any objects that are not
 * already in the class's primary cache store to the cache store.
 *
 * *The `klass` must respond properly to `#toString` in order for this method to
 * work properly. (e.g. `Widget.toString() === 'Widget'`)*
 *
 * @method updateClassStore
 * @private
 * @param {Function} klass a {{#crossLink "RestModel"}}RestModel{{/crossLink}}
 *   to add cached records for
 * @param {Object,Array.Object} data an object or array of objects to add to
 *   the class's primary cache store
 * @return {Array.Object} the array of cached objects for the given class
 */
exports.updateClassStore = function(klass, data) {
  var allCachedModels = this.get(klass.toString()) || [];

  if ($.isArray(data)) {
    data.forEach(function(datum) {
      addOnlyUnique(datum, klass, allCachedModels);
    });
  } else {
    addOnlyUnique(data, klass, allCachedModels);
  }

  this.set(klass.toString(), allCachedModels);

  return allCachedModels;
};

function addOnlyUnique(item, klass, array) {
  if (!utils.findMatching(item, klass, array)) {
    array.push(item);
  }
}
