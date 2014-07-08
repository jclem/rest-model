'use strict';

var utils = require('./lib/utils');

/**
 * Provides a suite of functionality around interacting with a resource on the
 * web using AJAX requests.
 *
 * @class RestModelV2
 * @extends Ember.Object
 * @constructor
 * @param {Object} attributes the attributes to initialize the instance with
 */
module.exports = Ember.Object.extend({
  /**
   * Whether or not the record is new (has not been persisted). This property
   * should almost certainly be overriden.
   *
   * @property isNew
   * @type {Boolean}
   */
  isNew: Ember.computed.none('primaryKey'),

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
    var primaryKey = this.get('primaryKey');
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

    options = utils.extend({
      url : this.get('path'),
      type: 'DELETE'
    }, options);

    return this.constructor.ajax(options);
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

    options = utils.extend({
      url : this.get('path'),
      type: 'GET'
    }, options);

    return this.constructor.ajax(options).then(function(data) {
      this.setProperties(data);
      return this;
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

    options = utils.extend({
      url : this.get('path'),
      type: type,
      data: this.serialize()
    }, options);

    return this.constructor.ajax(options).then(function(data) {
      this.setProperties(data);
      return this;
    }.bind(this));
  },

  /**
   * Serialize this object into JSON for sending in AJAX requests and for
   * persistent caching.
   *
   * @method serialize
   * @private
   */
  serialize: function() {
    return JSON.stringify(this);
  }
}).reopenClass({
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
   * @example
   * ```javascript
   * Post.ajax({
   *   type: 'POST',
   *   url : '/custom-url',
   *   data: { foo: 'bar' }
   * });
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

    return this.ajax(options).then(function(data) {
      return data.map(function(datum) {
        return this.create(datum);
      }.bind(this));
    }.bind(this));
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

    return this.ajax(options).then(this.create.bind(this));
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
  }
});
