// Ignore unused variables (they're useful for the no-op functions in here).
// jshint -W098

'use strict';

var cache = require('./lib/cache');
var utils = require('./lib/utils');

/**
 * RestModel provides a way to intereact with an API in an Ember app.
 *
 *     var App = RestModel.extend().reopenClass({
 *       url: '/apps'
 *     });
 *
 *     App.all().then(function(apps) { // GET "/apps"
 *       // `apps` is an array of App
 *     }):
 *
 *     App.find(1).then(function(app) { // GET "/apps/1"
 *       // `app` is the App with ID "1"
 *     });
 *
 * @class RestModel
 * @extends Ember.Object
 * @constructor
 * @param {Object} attribtues the attributes set as the original properties on
 *   this instance
 */
var RestModel = module.exports = Ember.Object.extend({
  /**
   * Called when an API request returns with a non-successful status code. This
   * no-op function can be used to set errors on the record.
   *
   * @method assignErrors
   * @param {jQuery XMLHttpRequest} jqXHR the jQuery XMLHttpRequest option that
   *   represents the request and respone
   */
  assignErrors: function(jqXHR) {
    // no-op
  },

  /**
   * The attributes that are returned via the API for this model. This is
   * necessary to distinguish between things like `created_at` and non-API
   * attributes like `isSaving`.
   *
   * @property attrs
   * @type Array
   */
  attrs: function() {
    return [];
  }.property(),

  /**
   * Compare the contents of two arrays.
   *
   * @method arraysAreEqual
   * @param {Array} arrayA the first array to compare
   * @param {Array} arrayB the second array to compare
   * @return {Boolean} true if the arrays are equal, otherwise false
   * @private
   */
  arraysAreEqual: function(arrayA, arrayB) {
    var iteratedArray = arrayA.length >= arrayB.length ? arrayA : arrayB;
    var comparedArray = arrayA.length >= arrayB.length ? arrayB : arrayA;
    var i, iteratedItem, comparedItem;

    for (i = 0; i < iteratedArray.length + 1; i++) {
      iteratedItem = iteratedArray[i];
      comparedItem = comparedArray[i];

      if (Ember.isArray(iteratedItem) && Ember.isArray(comparedItem)) {
        if (!this.arraysAreEqual(iteratedItem, comparedItem)) {
          return false;
        }
      } else if (!Ember.isEqual(iteratedItem, comparedItem)) {
        return false;
      }
    }

    return true;
  },

  /**
   * Called when the record is initialized, setting its `originalProperties` to
   * a copy of its original properties.
   *
   * @method init
   * @private
   */
  init: function() {
    var self = this;

    this.setOriginalProperties();

    /**
     * Tracks whether or not any attributes on the model differ from their values
     * as of when the model was created, fetched, or last saved (whichever is
     * most recent).
     *
     * @property isDirty
     * @type Boolean
     */
    var isDirty = Ember.computed.apply(Ember, this.get('observableAttrs').concat(function(key, value) {
      var attrs              = self.get('attrs');
      var originalProperties = self.get('originalProperties');
      var i;

      for (i = 0; i < attrs.length; i++) {
        key   = attrs[i];
        value = self.get(key);

        var originalValue = originalProperties.get(key);

        if (Ember.isArray(value) && Ember.isArray(originalValue)) {
          if (!this.arraysAreEqual(value, originalValue)) {
            return true;
          }
        } else if (!Ember.isEqual(value, originalValue)) {
          return true;
        }
      }

      return false;
    }));

    Ember.defineProperty(this, 'isDirty', isDirty);
  },

  /**
   * Delete this record.
   *
   * @method delete
   * @async
   * @return {Ember.RSVP.Promise} a promise resolved with `this`, a
   *   {{#crossLink "RestModel"}}RestModel{{/crossLink}}
   */
  delete: function(options) {
    return this.submit('delete', options);
  },

  /**
   * The errors present on this model.
   *
   * @property errors
   * @type Array
   */
  errors: function() {
    return [];
  }.property(),

  /**
   * Fetch the current model
   *
   * @method fetch
   * @param {Object} [options] options that will be passed to `ajax`
   * @async
   * @return {Ember.RSVP.Promise} a promise resolved with `this`, a
   *   {{#crossLink "RestModel"}}RestModel{{/crossLink}}
   */
  fetch: function(findKey, opts) {
    var parentKeys = this.get('parentKeys');
    var key        = this.getPrimaryKey();

    return this.constructor.find(parentKeys, key, opts).then(function(record) {
      this.setProperties(record);
      return this;
    }.bind(this));
  },

  /**
   * Get the parent keys for this object, useful for saving and updating the
   * object. These values are fetched from `this.parents`.
   *
   * @method getParentKeys
   * @private
   * @return Array an array of parent keys
   */
  getParentKeys: function() {
    if (!this.parents) return [];

    return this.parents.map(function(parent) {
      if (typeof parent === 'number' || typeof parent === 'string') {
        return parent;
      } else {
        return parent.getPrimaryKey();
      }
    });
  },

  /**
   * From a list of possible primary keys, (e.g. ['id', 'name']), return the
   * first value of the first one that currently has a value.
   *
   * @method getPrimaryKey
   * @private
   * @return {String,Number} the value of the primary key
   */
  getPrimaryKey: function() {
    var keyNames = this.constructor.primaryKeys;
    var key, value;

    for (var i = 0; i < keyNames.length; i++) {
      key   = keyNames[i];
      value = this.get(key);

      if (typeof value !== 'undefined' && value !== null) {
        return value;
      }
    }
  },

  /**
   * If the model is persisted, return true. Otherwise, return false. Default
   * behavior is to check the presence of `created_at`.
   *
   * @property isPersisted
   * @type Boolean
   */
  isPersisted: function() {
    var createdAt = this.get('created_at');
    return (typeof createdAt !== 'undefined' && createdAt !== null);
  }.property('created_at'),

  /**
   * The list of observable attribute names for this model. For a non array
   * "key", will return "key". For an array "key", will return "key.[]".
   *
   * @property observableAttrs
   * @type Array
   */
  observableAttrs: function() {
    return this.get('attrs').map(function(attr) {
      var value = this.get(attr);

      if (Ember.isArray(value)) {
        return attr + '.[]';
      } else {
        return attr;
      }
    }.bind(this));
  }.property('attrs.[]'),

  /**
   * Pick specific attributes from a model.
   *
   * @method pick
   * @param {Array} attributes the attributes to pick
   * @return {Object} the values of the attributes, as an object
   */
  pick: function(attributes) {
    var self = this;

    return attributes.reduce(function(object, attribute) {
      object[attribute] = self.get(attribute);
      return object;
    }, {});
  },

  /**
   * Reverts an object to its original properties. Copyies values from the
   * original properties so that array references are not passed around.
   *
   * @method revert
   */
  revert: function() {
    var originalProperties = this.get('originalProperties');

    return this.setProperties(Object.keys(originalProperties).reduce(function(object, key) {
      object[key] = Ember.copy(originalProperties[key], true);
      return object;
    }.bind(this), {}));
  },

  /**
   * Save this model, either via PATCH or POST. If the model has a non-blank
   * primary key, PATCH. Otherwise, POST.
   *
   * @method save
   * @async
   * @param {Object} [options] options that will be passed to `ajax`
   * @param {String} options.withURL a url template (e.g. `/foo/:bar`) to
   *   make the request with
   * @return {Ember.RSVP.Promise} a promise resolved with `this`, a
   *   {{#crossLink "RestModel"}}RestModel{{/crossLink}}
   * @example
   *     Foo.create({ name: 'bar' }).save().then(function() {
   *       // (succeeded)
   *     }, function() {
   *       // (failed)
   *     });
   */
  save: function(options) {
    var self = this;
    var method;

    if (this.get('isPersisted')) {
      method = 'patch';
    } else {
      method = 'post';
    }

    if (this.constructor.saveViaPut) {
      method = 'put';
    }

    return this.submit(method, options).then(function() {
      return self.setOriginalProperties();
    });
  },

  /**
   * Sets the `originalProperties` to the current properties on the object.
   *
   * @method setOriginalProperties
   * @private
   */
  setOriginalProperties: function() {
    var self  = this;
    var attrs = this.get('attrs');

    this.set('originalProperties', Ember.keys(this).reduce(function(obj, key) {
      if (attrs.indexOf(key) === -1) {
        return obj;
      } else {
        return obj.set(key, Ember.copy(self[key], true));
      }
    }, Ember.Object.create()));
  },

  /**
   * Serialize this model for sending to the API.
   *
   * @method serialize
   * @private
   */
  serialize: function() {
    if (this.get('serializedProperties') !== undefined && this.get('serializedProperties') !== null) {
      var attributes = this.pick(this.get('serializedProperties'));
      return JSON.stringify(attributes);
    } else {
      return JSON.stringify(this);
    }
  },

  /**
   * Perform a generic API request for this model, and set the appropriate
   * `isSaving` or `isDeleting` attribute.
   *
   * @method submit
   * @async
   * @private
   * @param {String} method the method to be used (e.g. `delete`, `patch`)
   * @param {Object} [options] options that will be passed to `ajax`
   * @param {String} options.withURL a url template (e.g. `/foo/:bar`) to
   *   make the request with
   * @return {Ember.RSVP.Promise} a promise resolved with `this`, a
   *   {{#crossLink "RestModel"}}RestModel{{/crossLink}}
   */
  submit: function(method, options) {
    var parentKeys = this.getParentKeys();
    var self       = this;

    if (method === 'delete') {
      this.set('isDeleting', true);
    } else {
      this.set('isSaving', true);
    }

    return new Ember.RSVP.Promise(function(resolve, reject) {
      self.constructor[method](parentKeys, self, options).then(function(data) {
        self.get('errors').setObjects([]);
        self.setProperties(data);
        resolve(self);
      }, function(jqXHR) {
        self.assignErrors(jqXHR);
        reject(jqXHR);
      }).finally(function() {
        if (method === 'delete') {
          self.set('isDeleting', false);
        } else {
          self.set('isSaving', false);
        }
      });
    });
  }
}).reopenClass({
  /**
   * Make an AJAX request with the given options.
   *
   * @method ajax
   * @async
   * @static
   * @private
   * @param {Object} options options defining the request
   * @param {String} options.url the url to make the request to
   * @param {String} options.method the HTTP verb to use
   * @param {String} options.data the JSON-string request data to send
   * @param {Boolean} options.cache perform caching with this request
   * @param {Boolean} options.rawResponse resolve with the response data rather
   *   than an instance of RestModel (only for non-GET)
   * @return {Ember.RSVP.Promise} a promise resolved with an instance or
   *   array of {{#crossLink}}RestModel{{/crossLink}}s
   */
  ajax: function(options) {
    var self     = this;
    var method   = options.method || 'GET';
    var cacheKey = this.getCacheKey(options);
    var cachedValue;

    if (!options.hasOwnProperty('cache')) {
      options.cache = this.cache;
    }

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var processedCache;

      if (options.cache && (cachedValue = cache.getModels(self, cacheKey))) {
        processedCache = self.processResponse(cachedValue, options);
        resolve(processedCache);
      }

      $.ajax({
        url        : options.url,
        type       : method,
        data       : options.data,
        headers    : options.headers || {},
        beforeSend : self.getBeforeSend(options),
        dataType   : 'json',
        contentType: 'application/json'
      }).then(function(data, responseText, jqXHR) {
        var processedResponse = self.processResponse(data, options);

        if (options.cache && method === 'GET' && data) {
          cache.update(self, cacheKey, data);
        }

        if (processedCache) {
          self.updateCachedResponse(processedCache, processedResponse);
        } else {
          if (options.rawResponse) {
            resolve(data);
          } else {
            resolve(processedResponse);
          }
        }
      }, function(jqXHR) {
        delete jqXHR.then;
        reject(jqXHR);
      });
    });
  },

  /**
   * Fetch all records from the base URL for this class.
   *
   * @method all
   * @async
   * @static
   * @param {Array} [parents] the parent IDs or objects to build the path with
   * @param {Object} [options] options that will be passed to `ajax`
   * @param {String} options.withURL a url template (e.g. `/foo/:bar`) to
   *   construct the URL for this request from, instead of the default URL.
   * @return {Ember.RSVP.Promise} a promise resolved with an array of
   *   {{#crossLink}}RestModel{{/crossLink}}s
   * @example
   *     // With no parent
   *     Post.all();
   *
   *     // With parent (given comments at /posts/:post_id/comments/):
   *     var post = Post.create({ id: 1 });
   *     Comment.all(post);
   */
  all: function(parents, options) {
    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params, null, options);
    options    = $.extend({ url: url, parents: parents }, options);
    return this.ajax(options);
  },

  /**
   * Return a URL with all parameters filled in with values.
   *
   * @method buildURL
   * @static
   * @private
   * @param {Array,Number,String} [params] the param(s) to be interpolated into the URL
   * @param {Number,String} [primaryKey] the primary key to be appended to the URL
   * @return {String} the fully-constructed path
   * @example
   *    var Bar = RestModel.extend().reopenClass({ url: '/foo/:foo_id/bars' });
   *    Bar.buildURL([1], 2); // '/foo/1/bars/2'
   */
  buildURL: function(params, primaryKey, options) {
    var url;

    options = options || {};

    if (options.withURL) {
      url = options.withURL;
    } else {
      url = this.url;
    }

    var path      = Ember.String.fmt(url.replace(/\/:[^\/]+/g, '/%@'), params);
    var namespace = this.namespace || RestModel.namespace;
    namespace     = namespace ? '/' + namespace : '';

    if (!Ember.isBlank(primaryKey)) {
      path = [path, primaryKey].join('/');
    }

    return namespace + path;
  },

  /**
   * Delete a model
   *
   * @method delete
   * @async
   * @static
   * @private
   * @param {Array} parents the parents of this record
   * @param {RestModel} model the model to delete
   * @return {Ember.RSVP.Promise} a promise resolved with an instance of
   *   {{#crossLink}}RestModel{{/crossLink}}
   */
  delete: function(parents, model, options) {
    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params, model.getPrimaryKey(), options);
    return this.ajax({ url: url, method: 'DELETE', rawResponse: true });
  },

  /**
   * Turn an array of objects into an array of instances of this class.
   *
   * @method deserializeArray
   * @static
   * @private
   * @param {Array} records the records to be deserialized
   * @return {Array} the deserialized records
   */
  deserializeArray: function(records) {
    var self = this;

    return $.map(records, function(record) {
      return self.deserialize(record);
    });
  },

  /**
   * Turn an object into an instance of this class.
   *
   * @method deserialize
   * @static
   * @private
   * @param {Object} record the record to be deserialized into an instance
   * @return {RestModel} an instance of this class
   */
  deserialize: function(record) {
    return this.create(record);
  },

  /**
   * Given an array of models or primary keys, return an array of primary key
   * values.
   *
   * @method extractPrimaryKeys
   * @static
   * @private
   * @param {Number,String,RestModel,Array} models the keys or models to get keys from
   * @return {Array} an array of primary keys
   */
  extractPrimaryKeys: function(models) {
    return Ember.makeArray(models).map(function(model) {
      if (typeof model === 'number' || typeof model === 'string') {
        return model;
      } else {
        return model.getPrimaryKey();
      }
    });
  },

  /**
   * Find a record by primary key. If there are no parents, the `primaryKey`
   * argument can be in the first position for convenience.
   *
   * @method find
   * @async
   * @static
   * @param {Array} parents the parents of this record
   * @param {Number,String} primaryKey the primary key to find
   * @param {Object} [options] options that will be passed to `ajax`
   * @return {Ember.RSVP.Promise} a promise resolved with an instance of
   *   {{#crossLink}}RestModel{{/crossLink}}
   * @example
   *     // With no parent
   *     Post.find(1);
   *
   *     // With parent (given comments at /posts/:post_id/comments/):
   *     var post = Post.create({ id: 1 });
   *     Comment.find(post, 2); // GETs /posts/1/comments/2
   */
  find: function(parents, primaryKey, opts) {
    if (typeof parents === 'number' || typeof parents === 'string') {
      primaryKey = parents;
      parents    = undefined;
    }

    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params, primaryKey, opts);
    return this.ajax({ url: url, parents: parents });
  },

  /**
   * Return a function that will be called before this AJAX request. We use a
   * higher-level function so that per-request options can be used in forming
   * request headers. The returned function will have a jQuery XHR object
   * passed to it, so one can call things like
   * `jqXHR.setRequestHeader('foo', 'bar');`.
   *
   * @method getBeforeSend
   * @static
   * @private
   * @param {Object} options the options used to make this AJAX request
   * @return {Function} the function to be called before the request is made
   */
  getBeforeSend: function(options) {
    return function(jqXHR) {
      // no-op
    };
  },

  /**
   * Return a cache key for a given set of request options.
   *
   * @method getCacheKey
   * @static
   * @private
   * @param {Object} options the options used to generate the cache key.
   * @return {String} a cache key
   */
  getCacheKey: function(options) {
    var method = options.method || 'GET';
    return '%@: %@ - %@'.fmt(this.toString(0), method, options.url);
  },

  /**
   * Namespace to nest API calls under. If set to 'api', calls to '/apps' will
   * go to '/api/apps'.
   *
   * @property namespace
   * @type String
   * @default null
   * @static
   */
  namespace: null,

  /**
   * Convert an object response to an array of key/value objects
   *
   * @method objectToArray
   * @private
   * @param {Object} data an object to be converted to an array
   * @return {Array} the converted object
   */
  objectToArray: function(object) {
    var array = [];

    Object.keys(object).forEach(function(key) {
      array.push({ key: key, value: object[key] });
    });

    return array;
  },

  /**
   * Update a model via PATCH.
   *
   * @method patch
   * @async
   * @static
   * @private
   * @param {Array} parents the parents of this record
   * @param {RestModel} model the model to update
   * @param {Object} [options] options that will be passed to `ajax`
   * @param {String} options.withURL a url template (e.g. `/foo/:bar`) to
   *   make the request with
   * @return {Ember.RSVP.Promise} a promise resolved with an instance of
   *   {{#crossLink}}RestModel{{/crossLink}}
   */
  patch: function(parents, model, options) {
    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params, model.getPrimaryKey(), options);
    var data   = model.serialize('patch');
    options = options || {};
    return this.ajax({ url: url, method: 'PATCH', data: data, rawResponse: true, headers: options.headers });
  },

  /**
   * Create a model via POST.
   *
   * @method post
   * @async
   * @static
   * @private
   * @param {Array} parents the parents of this record
   * @param {RestModel} model the model to create
   * @param {Object} [options] options that will be passed to `ajax`
   * @param {String} options.withURL a url template (e.g. `/foo/:bar`) to
   *   make the request with
   * @return {Ember.RSVP.Promise} a promise resolved with an instance of
   *   {{#crossLink}}RestModel{{/crossLink}}
   */
  post: function(parents, model, options) {
    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params, null, options);
    var data   = model.serialize('post');
    options = options || {};
    return this.ajax({ url: url, method: 'POST', data: data, rawResponse: true, headers: options.headers });
  },

  /**
   * Create or update a modal via PUT.
   *
   * @method put
   * @async
   * @static
   * @private
   * @param {Array} parents the parents of this record
   * @param {RestModel} model the model to create
   * @param {Object} [options] options that will be passed to `ajax`
   * @param {String} options.withURL a url template (e.g. `/foo/:bar`) to
   *   make the request with
   * @return {Ember.RSVP.Promise} a promise resolved with an instance of
   *   {{#crossLink}}RestModel{{/crossLink}}
   */
  put: function(parents, model, options) {
    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params, null, options);
    var data   = model.serialize('put');
    options = options || {};
    return this.ajax({ url: url, method: 'PUT', data: data, rawResponse: true, headers: options.headers });
  },

  /**
   * The primary keys to use to find records of this class. These will be cycled
   * through in order until one is found to use for a primary key.
   *
   * @property primaryKeys
   * @type Array
   * @default ['id']
   * @static
   */
  primaryKeys: ['id'],

  /**
   * Process an API response and turn it into a model or array of models.
   *
   * @method processResponse
   * @static
   * @private
   * @param {Array,Object} data the JSON response data
   * @param {Object} options the request options
   * @return {Array,RestModel} a instance or array of
   *   {{#crossLink "RestModel"}}RestModel{{/crossLink}}s
   */
  processResponse: function(data, options) {
    if (this.forceArray) {
      data = this.objectToArray(data);
    }

    if ($.isArray(data)) {
      data = this.deserializeArray(data);
    } else {
      data = this.deserialize(data);
    }

    if (options.parents) {
      Ember.makeArray(data).forEach(function(model) {
        model.set('parents', Ember.makeArray(options.parents));
      });
    }

    return data;
  },

  /**
   * If true, calling `save` on any record will always hit a URL without a
   * primary key, (e.g. "/posts", not "/posts/1"), and the PUT HTTP verb will
   * be used in place of POST or PATCH.
   *
   * @property saveViaPut
   * @static
   * @type Boolean
   * @default false
   */
  saveViaPut: false,

  /**
   * Update a cached response, adding new models to the cached response and
   * removing them where appropriate.
   *
   * @method updateCachedResponse
   * @static
   * @param {Array,Object} cachedResponse an instance or array of cached mdoels
   * @param {Array,Object} newResponse the instance or array of new response
   *   models
   */
  updateCachedResponse: function(cachedResponse, newResponse) {
    var self = this;

    if ($.isArray(cachedResponse)) {
      cachedResponse.forEach(function(cachedModel) {
        if (!utils.findMatching(cachedModel, self, newResponse)) {
          return cachedResponse.removeObject(cachedModel);
        }
      });

      newResponse.forEach(function(newModel) {
        var cachedModel = utils.findMatching(newModel, self, cachedResponse);

        if (cachedModel) {
          return cachedModel.setProperties(newModel);
        } else {
          return cachedResponse.pushObject(newModel);
        }
      });
    } else {
      cachedResponse.setProperties(newResponse);
    }
  }
});

RestModel.V2 = require('./index-v2');
