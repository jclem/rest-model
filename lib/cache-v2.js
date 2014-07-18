'use strict';

/**
 * A set of functions responsible for managint RestModel's localStorage cache.
 *
 * @class Cache
 */
module.exports = Ember.Object.extend({
  /**
   * Replace the the given record's cached data with the given data.
   *
   * @method updateRecord
   * @async
   * @param {RestModel} record the record to be updated in the cache
   * @param {Object} data the data to be written to the cache
   * @return {Ember.RSVP.Promise} a promise resolved with the data written
   */
  updateRecord: function(record, data) {
    var primaryKeyName = record.constructor.primaryKeys[0];
    var primaryKey     = record.get(primaryKeyName) || data[primaryKeyName];
    var cacheKey       = this.getCacheKey(record.constructor.typeKey, primaryKey);

    return this.setItem(cacheKey, data);
  },

  /**
   * Find the cached value of a response.
   *
   * @method getResponse
   * @async
   * @param {String} klass the class associated with the response
   * @param {String} path the path to get the cached response for
   * @return {Ember.RSVP.Promise} a promise resolved with the cached value of
   *   the response from the given path if found, otherwise `null`
   */
  getResponse: function(klass, path) {
    return this.getItem(path).then(function(value) {
      if (Ember.isArray(value)) {
        return this.getArrayResponse(klass, value);
      } else {
        return this.getItemResponse(klass, value);
      }
    }.bind(this));
  },

  /**
   * Fetch the cached attributes of the given array of keys.
   *
   * @method getArrayResponse
   * @async
   * @private
   * @param {String} klass the class associated with the objects being found
   * @param {Array} keys an array of keys to fetch the properties for
   * @return {Ember.RSVP.Promise} a promise resolved with an array of objects
   */
  getArrayResponse: function(klass, keys) {
    return Ember.RSVP.all(keys.map(function(key) {
      var cacheKey = this.getCacheKey(klass.typeKey, key);
      return this.getItem(cacheKey);
    }.bind(this)));
  },

  /**
   * Fetch the cached attributes of the given key.
   *
   * @method getItemResponse
   * @async
   * @private
   * @param {String} klass the class associated with the objects being found
   * @param {String,Number} key a key to fetch the properties for
   * @return {Ember.RSVP.Promise} a promise resolved with an object
   */
  getItemResponse: function(klass, key) {
    var cacheKey = this.getCacheKey(klass.typeKey, key);
    return this.getItem(cacheKey);
  },

  /**
   * Set the cached value of a response.
   *
   * @method setResponse
   * @async
   * @param {String} klass the class associated with the response
   * @param {String} path the path to set the cached response for
   * @param {Array,Object} response the response to write to the cache
   * @return {Ember.RSVP.Promise} a promise resolved with the set value once it
   *   has been written to the cache
   */
  setResponse: function(klass, path, response) {
    if (Ember.isArray(response)) {
      return this.setArrayResponse(klass, path, response);
    } else {
      return this.setItemResponse(klass, path, response);
    }
  },

  /**
   * Set the cached value of an array response.
   *
   * @method setArrayResponse
   * @async
   * @private
   * @param {String} klass the class associated with the response
   * @param {String} path the path to set the cached response for
   * @param {Array} response the response to write to the cache
   * @return {Ember.RSVP.Promise} a promise resolved with the set value once it
   *   has been written to the cache
   */
  setArrayResponse: function(klass, path, response) {
    var primaryKey = klass.primaryKeys[0];
    var keys       = response.mapBy(primaryKey);

    return Ember.RSVP.all([
      this.setItem(path, keys),

      response.map(function(item) {
        var cacheKey = this.getCacheKey(klass.typeKey, item[primaryKey]);
        return this.setItem(cacheKey, item);
      }.bind(this))
    ]).then(function() {
      return response;
    });
  },

  /**
   * Set the cached value of a single item response.
   *
   * @method setItemResponse
   * @async
   * @private
   * @param {String} klass the class associated with the response
   * @param {String} path the path to set the cached response for
   * @param {Array} response the response to write to the cache
   * @return {Ember.RSVP.Promise} a promise resolved with the set value once it
   *   has been written to the cache
   */
  setItemResponse: function(klass, path, response) {
    var primaryKey = klass.primaryKeys[0];
    var key        = response[primaryKey];
    var cacheKey   = this.getCacheKey(klass.typeKey, key);

    return Ember.RSVP.all([
      this.setItem(cacheKey, response),
      this.setItem(path, key)
    ]).then(function() {
      return response;
    });
  },

  /**
   * Get a cache key for a given class and key.
   *
   * @method getCacheKey
   * @private
   * @param {String} className the lowercase, string name of the class to build
   *   a cache key for
   * @param {String,Number} key the primary key to build the cache key for
   * @return {String} a cache key
   */
  getCacheKey: function(klass, key) {
    return '%@: %@'.fmt(klass, key);
  },

  /**
   * Fetch a string value from the cache and return it, JSON-parsed.
   *
   * @method getItem
   * @async
   * @private
   * @param {String} key the key to fetch the value from the cache for
   * @return {Ember.RSVP.Promise} a promise resolved with the cached value
   */
  getItem: function(key) {
    return new Ember.RSVP.Promise(function(resolve) {
      Ember.run.scheduleOnce('afterRender', function() {
        var value = localStorage.getItem(key) || null;
        resolve(JSON.parse(value));
      });
    });
  },

  /**
   * Set a JSON value in the cache.
   *
   * @method setItem
   * @async
   * @private
   * @param {String} key the key to set the value for in the cache
   * @param {Object,Array.String,Array.Object} value the value to put in the cache
   * @return {Ember.RSVP.Promise} a promise resolved when the value has been set
   *   in the cache
   */
  setItem: function(key, value) {
    return new Ember.RSVP.Promise(function(resolve) {
      Ember.run.scheduleOnce('afterRender', function() {
        var stringValue = JSON.stringify(value);
        localStorage.setItem(key, stringValue);
        resolve(value);
      });
    });
  }
});
