'use strict';

var cache = require('./lib/cache-v2').create();
var utils = require('./lib/utils');

/**
 * Provides a suite of functionality around interacting with a resource on the
 * web using AJAX requests.
 *
 * @class RestModel.V2
 * @extends Ember.Object
 * @constructor
 * @param {Object} attributes the attributes to initialize the instance with
 */
module.exports = Ember.Object.extend({
  /**
   * Initialize a new instance of this class. Does so by first setting the
   * initial properties to the `originalProperties` value and by defining the
   * `isDirty` property.
   *
   * @method init
   * @private
   */
  init: function() {
    this.setOriginalProperties();

    var dirtyProperties = Ember.computed.apply(Ember, this.get('attrNames')
      .concat(['originalProperties']).concat(function() {
        var attrNames          = this.get('attrNames');
        var originalProperties = this.get('originalProperties');

        return attrNames.reduce(function(changedProperties, key) {
          var value         = this.get(key);
          var originalValue = originalProperties.get(key);

          if (Ember.isArray(value)) {
            if (!utils.arraysEqual(value, originalValue)) {
              changedProperties.push(key);
            }
          } else if (!Ember.isEqual(value, originalValue)) {
            changedProperties.push(key);
          }

          return changedProperties;
        }.bind(this), []);
      })
    );

    /**
     * A list of the dirty properties on this instance.
     *
     * @property dirtyProperties
     * @type {Array}
     */
    Ember.defineProperty(this, 'dirtyProperties', dirtyProperties);
  },

  /**
   * A declared array of attributes of this class. These are the attributes that
   * are relied upon for the `isDirty` property, as well as other functionality.
   * Objects are not supported, but flat arrays are.
   *
   * For attributes that are arrays, indicate them as `property.[]`.
   *
   * @property attrs
   * @type {Array}
   */
  attrs: function() {
    return [];
  }.property(),

  /**
   * Whether or not the instance is "in flight", meaning that it has AJAX
   * requests in process.
   *
   * @property inFlight
   * @type {Boolean}
   */
  inFlight: Ember.computed.bool('requestPool'),

  /**
   * If the declared properties (`attrs`) of the instance are the same as their
   * original values. The opposite of `isDirty`.
   *
   * @property isClean
   * @type {Boolean}
   */
  isClean: Ember.computed.empty('dirtyProperties'),

  /**
   * If any of the declared properties (`attrs`) of the instance are different
   * from their original values. The opposite of `isClean`.
   *
   * @property isDirty
   * @type {Boolean}
   */
  isDirty: Ember.computed.notEmpty('dirtyProperties'),

  /**
   * Whether or not the record is new (has not been persisted). This property
   * should almost certainly be overriden.
   *
   * @property isNew
   * @type {Boolean}
   */
  isNew: Ember.computed.none('primaryKey'),

  /**
   * Whether or not the record has been persisted. The opposite of `isNew`.
   *
   * @property isPersisted
   * @type {Boolean}
   */
  isPersisted: Ember.computed.not('isNew'),

  /**
   * The names of the declared `attributes` without their observable modifiers
   * (e.g. will return `['tags']`, not `['tags.[]']`).
   *
   * @property attrNames
   * @private
   * @type {Array}
   */
  attrNames: function() {
    return this.get('attrs').map(function(attr) {
      if (/\.\[\]$/.test(attr)) {
        return attr.split('.')[0];
      } else {
        return attr;
      }
    });
  }.property('attrs'),

  /**
   * The parents of this instance.
   *
   * TODO: This must either be volatile or created in `init` as a computed
   *       property based on the values in `parentKeyNames`.
   *
   * @property parents
   * @private
   * @type {Object}
   */
  parents: function() {
    var parentKeyNames = this.constructor.getParentKeyNames();

    return parentKeyNames.reduce(function(parents, key) {
      parents[key] = this.get(key);
      return parents;
    }.bind(this), {});
  }.property().volatile(),

  /**
   * A path pointing to this instance, typically the class's base path joined
   * with the `primaryKey` of this instance. Will throw an error if a parent
   * necessary for building the path is lacking a primary key.
   *
   * TODO: If `primaryKey` is not volatile, but properly observes the values in
   *       the class's `primarykeys`, as well as `parents`, this does not have
   *       to be volatile.
   *
   * @property path
   * @type {String}
   */
  path: function() {
    var primaryKey = this.get('isPersisted') ? this.get('primaryKey') : null;
    var parents    = this.get('parents');

    return this.constructor.buildPath(parents, primaryKey);
  }.property().volatile(),

  /**
   * The value of this instance's primary key. Found by iterating over the
   * class's `primaryKeys` property until this instance has a value for a
   * primary key.
   *
   * TODO: This doesn't have to be volatile if it's created in `init` to observe
   *       the values in the class's `primaryKeys`.
   *
   * @property primaryKey
   * @private
   * @type {String,Number}
   */
  primaryKey: function() {
    var keyNames = this.constructor.primaryKeys;
    var key, value;

    for (var i = 0; i < keyNames.length; i++) {
      key   = keyNames[i];
      value = this.get(key);

      if (!Ember.isNone(value)) {
        return value;
      }
    }
  }.property().volatile(),

  /**
   * Delete this instance. Will throw an error if there is no `primaryKey` for
   * this instance.
   *
   * @method delete
   * @async
   * @param {Object} [options] options to pass through to the AJAX request
   * @return {Ember.RSVP.Promise} a promise resolved when this instance has been
   *   deleted
   * @example
   * ```javascript
   * post.delete();
   * ```
   */
  delete: function(options) {
    if (Ember.isNone(this.get('primaryKey'))) {
      throw new Error('Can not delete a record with no primary key.');
    }

    return this.request('deleting', function() {
      options = utils.extend({
        url : this.get('path'),
        type: 'DELETE'
      }, options);

      return this.constructor.ajax(options).then(function() {
        return cache.removeRecord(this);
      }.bind(this));
    }.bind(this));
  },

  /**
   * Fetch this instance. Will throw an error if there is no `primaryKey` for
   * this instance.
   *
   * @method fetch
   * @async
   * @param {Object} [options] options to pass through to the AJAX request
   * @return {Ember.RSVP.Promise} a promise resolved with this instance once it
   *   has been fetched
   * @example
   * ```javascript
   * post.fetch();
   * ```
   */
  fetch: function(options) {
    if (Ember.isNone(this.get('primaryKey'))) {
      throw new Error('Can not fetch a record with no primary key.');
    }

    return this.request('fetching', function() {
      options = utils.extend({
        url : this.get('path'),
        type: 'GET'
      }, options);

      return this.constructor.ajax(options).then(function(data) {
        this.setProperties(data);
        return this;
      }.bind(this));
    }.bind(this));
  },

  /**
   * Persist the given data for this item to the cache.
   *
   * @method persistToCache
   * @async
   * @private
   * @param {Object} data the data to be written to the cache
   * @return {Ember.RSVP.Promise} a promise resolved with the written data
   */
  persistToCache: function(data) {
    return cache.updateRecord(this, data);
  },

  /**
   * Set the given parameter as `is#{parameter.capitalize()}` as well as
   * `inFlight` to `true` while the given function is in flight. When it is
   * resolved or rejected, set those properties to `false`.
   *
   * TODO: Need to handle the case where the same model performs the same
   *       operation at the same time, multiple times (e.g. #save and #save
   *       simultaneously).
   *
   * @method request
   * @private
   * @param {String} type the type of request the instance is entering
   * @param {Function} doRequest a function returning a promise whose finished
   *   state removes an item from the request pool
   */
  request: function(type, doRequest) {
    type = 'is%@'.fmt(type.capitalize());

    this.set(type, true);
    this.incrementProperty('requestPool');

    return doRequest().finally(function() {
      this.set(type, false);
      this.decrementProperty('requestPool');
    }.bind(this));
  },

  /**
   * Revert this instance's properties back to their original values.
   *
   * @method revert
   */
  revert: function() {
    var attrs = this.get('attrs');

    this.get('attrNames').forEach(function(key, i) {
      var value = Ember.copy(this.get('originalProperties.%@'.fmt(key)));

      if (/\.\[\]$/.test(attrs[i])) {
        this.get(key).setObjects(value);
      } else {
        this.set(key, value);
      }
    }.bind(this));
  },

  /**
   * Save this instance. If the instance is new, do a 'POST' request to the
   * class's base path, otherwise, use 'PATCH' to this instance's path.
   *
   * @method save
   * @async
   * @param {Object} [options] options to pass through to the AJAX request
   * @return {Ember.RSVP.Promise} a promise resolved with this instnace once it
   *   has been saved
   * @example
   * ```javascript
   * post.save();
   * ```
   */
  save: function(options) {
    var type = this.get('isNew') ? 'POST' : 'PATCH';

    return this.request('saving', function() {
      options = utils.extend({
        url : this.get('path'),
        type: type,
        data: this.serialize()
      }, options);

      return this.constructor.ajax(options).then(function(data) {
        return this.persistToCache(data);
      }.bind(this)).then(function(data) {
        this.setProperties(data);
        this.setOriginalProperties();
        return this;
      }.bind(this));
    }.bind(this));
  },

  /**
   * Set an object containing the original values of the instance's properties.
   *
   * @method setOriginalProperties
   * @private
   */
  setOriginalProperties: function() {
    var attrNames = this.get('attrNames');

    this.set('originalProperties', attrNames.reduce(function(properties, key) {
      var value = this.get(key);
      properties.set(key, Ember.copy(value, true));
      return properties;
    }.bind(this), Ember.Object.create()));
  },

  /**
   * Serialize this object into JSON for sending in AJAX requests and for
   * persistent caching.
   *
   * @method serialize
   * @private
   */
  serialize: function() {
    return JSON.stringify(this.toObject());
  },

  /**
   * Get an object representation of this instance using keys from the `attrs`
   * property.
   *
   * @method toObject
   * @return {Object} the plain object representation of this instance
   */
  toObject: function() {
    return this.get('attrNames').reduce(function(properties, key) {
      var value = this.get(key);
      properties[key] = value;
      return properties;
    }.bind(this), {});
  }
}).reopenClass({
  /**
   * The lowercase string version of the name of this class, used for caching
   * purposes. This must be overridden.
   *
   * @property typeKey
   * @static
   * @type String
   */
  typeKey: '',

  /**
   * An array of properties used to fetch and persist records. An array is used
   * because multiple properties may be used as primary keys in an API, e.g.
   * "id" and "name".
   *
   * @property primaryKeys
   * @static
   * @type Array
   * @default ['id']
   */
  primaryKeys: ['id'],

  /**
   * A namespace under which to nest all AJAX requests for this class. This is
   * commonly something like 'api'.
   *
   * @property namespace
   * @static
   * @type String
   * @default null
   */
  namespace: null,

  /**
   * The base path used to fetch, persist, and destroy records. Must not begin
   * with or end with a forward slash ('/').
   *
   * @property base
   * @static
   * @type String
   * @default ''
   */
  base: '',

  /**
   * Whether or not to cache GET calls when using the `::request` method.
   *
   * @property cache
   * @static
   * @type Boolean
   * @default false
   */
  cache: false,

  /**
   * Perform an AJAX request.
   *
   * @method ajax
   * @async
   * @static
   * @param {Object} options options to define the AJAX request
   * @param {String} options.url the path or URL to make the request to
   * @param {String} [options.type='GET'] the HTTP method used to make the
   *   request
   * @param {String} [options.data] a JSON string of data to send as the
   *   request body
   * @return {Ember.RSVP.Promise} a promise resolved with an instance or array
   *   of instances of this class, as well as the original response data, once
   *   the request has completed
   * ```
   */
  ajax: function(options) {
    var ajaxOptions = {
      type       : 'GET',
      dataType   : 'json',
      contentType: 'application/json'
    };

    utils.extend(ajaxOptions, options);

    return new Ember.RSVP.Promise(function(resolve, reject) {
      Ember.$.ajax(ajaxOptions).then(function(data) {
        if (Ember.isArray(data)) {
          data = this.deserializeArray(data);
        } else {
          data = this.deserialize(data);
        }

        resolve(data);
      }.bind(this), function(jqXHR) {
        delete jqXHR.then;
        reject(jqXHR);
      });
    }.bind(this));
  },

  /**
   * Fetch all records for this class.
   *
   * @method all
   * @static
   * @async
   * @param {Object} [parents] the parents of this resource, with either
   *   instances or primary keys as values
   * @param {Object} [options] options to pass on to the AJAX request
   * @return {Ember.RSVP.Promise} a promise resolved with an array of instances
   *   of this class
   * @example
   * ```javascript
   * Post.all();
   *
   * // With parents
   * Comment.all({ post: 1 });
   * ```
   */
  all: function(parents, options) {
    options = utils.extend({
      url : this.buildPath(parents),
      type: 'GET'
    }, options);

    var processingOptions = { parents: parents };

    return this.request(options, processingOptions).then(function(results) {
      return results;
    });
  },

  /**
   * Add an object of parents to the given path.
   *
   * @method addParentsToPath
   * @static
   * @private
   * @param {Object} parents the parents to add to the given path
   * @param {String} path the path to add the parents to
   * @return {String} the path with parent primary keys interpolated
   */
  addParentsToPath: function(parents, path) {
    Ember.$.each(parents, function(key, parent) {
      var parentKey = parent;

      if (typeof parent !== 'string' && typeof parent !== 'number') {
        parentKey = parent.get('primaryKey');
      }

      path = path.replace('/:%@'.fmt(key), '/%@'.fmt(parentKey));
    });

    return path;
  },

  /**
   * Assert that the given object of parent keys is enough for the base path of
   * this class. Throws an error if there are parent keys missing.
   *
   * @method assertHasParentKeys
   * @static
   * @private
   * @param {Object} parents the parents to validate are sufficient for this
   *   class
   */
  assertHasParentKeys: function(parents) {
    this.getParentKeyNames().forEach(function(key) {
      var parent     = parents[key];
      var primaryKey = parent ? this.getPrimaryKey(parent) : null;

      if (Ember.isNone(primaryKey)) {
        throw new Error('No primary key found for parent "%@".'.fmt(key));
      }
    }.bind(this));
  },

  /**
   * Build a path to this resource, adding parent keys and a primary key (if
   * supplied).
   *
   * @method buildPath
   * @static
   * @private
   * @param {Array} [parents] the parent keys or objects to use in the path
   * @param {Number,String} [primaryKey] a primary to be appended to the path
   * @return {String} the path including any given primary key
   */
  buildPath: function(parents, primaryKey) {
    var path = '/' + this.base;

    if (!Ember.$.isPlainObject(parents)) {
      primaryKey = parents;
      parents    = {};
    }

    this.assertHasParentKeys(parents);
    path = this.addParentsToPath(parents, path);

    if (!Ember.isNone(primaryKey)) {
      path += '/' + primaryKey;
    }

    if (!Ember.isNone(this.namespace)) {
      path = '/' + this.namespace + path;
    }

    return path;
  },

  /**
   * Deserialize data into a desirable format for updating and creating
   * instances of this class. By default, this is a no-op.
   *
   * @method deserialize
   * @static
   * @private
   * @param {Object} data the data to be deserialized
   * @return {Object} (optionally) transformed data object
   */
  deserialize: function(data) {
    return data;
  },

  /**
   * Deserialize an array of objects into an array of objects formatted for
   * updating and creating instances of this class.
   *
   * @method deserializeArray
   * @static
   * @private
   * @param {Array} data an array of objects to be deserialized
   * @return {Array} an array of (optionally) transformed objects
   */
  deserializeArray: function(data) {
    return data.map(this.deserialize.bind(this));
  },

  /**
   * Find a record by primary key.
   *
   * @method find
   * @async
   * @static
   * @param {Number,String} primaryKey the primary key used to find a record
   * @param {Object} [options] options to pass on to the AJAX request
   * @return {Ember.RSVP.Promise} a promise resolved with an instance of this
   *   class
   * ```javascript
   * Post.find(1);
   * ```
   */
  find: function(parents, primaryKey, options) {
    if (!Ember.$.isPlainObject(parents)) {
      options    = primaryKey;
      primaryKey = parents;
      parents    = {};
    }

    options = utils.extend({
      url : this.buildPath(parents, primaryKey),
      type: 'GET'
    }, options);

    return this.request(options)
      .then(this.create.bind(this)).then(function(model) {
        model.setProperties(parents);
        return model;
      });
  },

  /**
   * Get the names of the parent keys for this class.
   *
   * @method getParentKeyNames
   * @static
   * @private
   * @return {Array} the names of the parent keys based on the class's base
   */
  getParentKeyNames: function() {
    var matches = this.base.match(/\/:[^\/]+/g) || [];

    return matches.map(function(segment) {
      return segment.replace('/:', '');
    });
  },

  /**
   * Return either the value (if it is a simple value) or the primary key
   * of the given object.
   *
   * @method getPrimaryKey
   * @static
   * @private
   * @param {RestModel,String,Number} object the object to get the primary key
   *   from
   * @return {String,Number} a primary key
   */
  getPrimaryKey: function(object) {
    if (typeof object === 'number' || typeof object === 'string') {
      return object;
    } else {
      return object.get('primaryKey');
    }
  },

  /**
   * Transform results from an API request into an instance or array of
   * instances of this class.
   *
   * Accepts an object of parent properties to ensure that cached and new
   * records always have a reference to their parent records.
   *
   * @method toResult
   * @static
   * @private
   * @param {Array,Object} response an object or array of objects
   * @param {Object} [parents={}] an object of parent properties to set on the
   *   object or array of objects
   * @return {Array,RestModel} an instance or array of instances of this class
   */
  toResult: function(response, parents) {
    parents = parents || {};

    if (Ember.isArray(response)) {
      return response.map(function(item) {
        return this.create(item).setProperties(parents);
      }.bind(this));
    } else {
      return this.create(response).setProperties(parents);
    }
  },

  /**
   * Request a given resource. Will use caching if the request is a "GET"
   * request.
   *
   * @method request
   * @async
   * @static
   * @param {Object} options options to pass on to the AJAX request
   * @param {Object} [processingOptions] options that control how the
   *   deserialized response is processed
   * @param {Function} [processingOptions.toResult=RestModel.toResult] a
   *   function used to convert the response body into an instance or array of
   *   instances of RestModel
   * @return {Ember.RSVP.Promise} a promise resolved with an instance or array
   *   of instances from the cache or AJAX request
   * @example
   * ```javascript
   * Post.request({
   *   type: 'POST',
   *   url : '/custom-url',
   *   data: { foo: 'bar' }
   * });
   * ```
   */
  request: function(options, processingOptions) {
    var readFromCache = this.cache && options.type.toLowerCase() === 'get';

    processingOptions = utils.extend({
      toResult   : this.toResult.bind(this)
    }, processingOptions);

    if (readFromCache) {
      return this.requestWithCache(options, processingOptions);
    } else {
      return this.ajax(options).then(function(response) {
        var parents = processingOptions.parents;
        return processingOptions.toResult(response, parents);
      });
    }
  },

  /**
   * Request a given resource. If the resource is in the cache, resolve with the
   * cached version. The cached object returned will be updated when a
   * subsequent AJAX call completes, either by setting properties or by pushing
   * and deleting objects in the case of an array.
   *
   * @method requestWithCache
   * @async
   * @static
   * @private
   * @param {Object} options options to pass on to the AJAX request
   * @param {Object} [processingOptions] options that control how the
   *   deserialized response is processed
   * @return {Ember.RSVP.Promise} a promise resolved with an object or array of
   *   objects from the cache or AJAX request
   */
  requestWithCache: function(options, processingOptions) {
    var cachedValue;

    return cache.getResponse(this, options.url).then(function(_cachedValue) {
      var result;

      cachedValue = _cachedValue;

      if (cachedValue) {
        result = processingOptions.toResult(cachedValue);
        this.ajaxAndUpdateCache(options, processingOptions, result);
        return result;
      } else {
        return this.ajaxAndUpdateCache(options, processingOptions)
          .then(function(response) {
            return processingOptions.toResult(response);
          });
      }
    }.bind(this)).then(function(response) {
      return response;
    });
  },

  /**
   * Perform an AJAX request, update its value in the cache, and if given a
   * `cachedValue`, update it in a KVO-friendly way.
   *
   * @method ajaxAndUpdateCache
   * @async
   * @static
   * @private
   * @param {Object} options options to pass on to the AJAX request
   * @param {Array,Object} result a cached result that will be updated with new
   *   objects or properties from the AJAX request
   * @return {Ember.RSVP.Promise} a promise resolved with the newly updated
   *   cached value
   */
  ajaxAndUpdateCache: function(options, processingOptions, result) {
    var parents = processingOptions.parents;

    return this.ajax(options).then(function(response) {
      return cache.setResponse(this, options.url, response);
    }.bind(this)).then(function(response) {
      response = processingOptions.toResult(response, parents);

      if (result) {
        if (Ember.isArray(response)) {
          return this.updateCachedArray(result, response);
        } else {
          return this.updateCachedObject(result, response);
        }
      } else {
        return response;
      }
    }.bind(this));
  },

  /**
   * Update a cached array of objects. Add new objects, remove deleted objects,
   * and update existing objects.
   *
   * @method updateCachedArray
   * @async
   * @static
   * @private
   * @param {Array} result the array of RestModel instances to be updated
   * @param {Array} newArray the new values to update the cached array with
   * @return {Ember.RSVP.Promise} a promise resolved with the newly updated
   *   cached array
   */
  updateCachedArray: function(result, newArray) {
    var newRecords     = utils.findNotIn(newArray, result, this);
    var removedRecords = utils.findNotIn(result, newArray, this);
    var updatedRecords = utils.findIn(result, newArray, this);

    result.pushObjects(newRecords);
    result.removeObjects(removedRecords);

    updatedRecords.forEach(function(record) {
      if (record.get('isDirty')) { return; }
      var newProperties = utils.findMatching(record, this, newArray);
      newProperties = this.getUpdatableProperties(newProperties);
      record.setProperties(newProperties);
      record.setOriginalProperties();
    }.bind(this));

    return result;
  },

  /**
   * Update a cached object by setting its new properties.
   *
   * @method updateCachedObject
   * @async
   * @static
   * @private
   * @param {Array} cachedObject the object to be updated
   * @param {Array} newProperties the new properties to update the cached object
   *   with
   * @return {Ember.RSVP.Promise} a promise resolved with the newly updated
   *   cached object
   */
  updateCachedObject: function(result, newProperties) {
    if (result.get('isDirty')) { return; }
    newProperties = this.getUpdatableProperties(newProperties);
    result.setProperties(newProperties);
    result.setOriginalProperties();
    return result;
  },

  /**
   * A list of attributes that can be used to update a cached object after an
   * AJAX call has been made. Meant to exclude special properties added by
   * RestModel.
   *
   * @method getUpdatableProperties
   * @static
   * @private
   * @param {RestModel} model the model to pull properties from
   * @return {Array} an array of property names
   */
  getUpdatableProperties: function(model) {
    var keys = Ember.keys(model).filter(function(key) {
      return ['originalProperties', 'dirtyProperties'].indexOf(key) === -1;
    });

    return model.getProperties(keys);
  }
});
