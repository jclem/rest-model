!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.RestModel=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// Ignore unused variables (they're useful for the no-op functions in here).
// jshint -W098

'use strict';

var cache = _dereq_('./lib/cache');
var utils = _dereq_('./lib/utils');

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
   * @async
   * @return {Ember.RSVP.Promise} a promise resolved with `this`, a
   *   {{#crossLink "RestModel"}}RestModel{{/crossLink}}
   */
  fetch: function(findKey) {
    var parentKeys = this.get('parentKeys');
    var key        = this.getPrimaryKey();

    return this.constructor.find(parentKeys, key).then(function(record) {
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
  find: function(parents, primaryKey) {
    if (typeof parents === 'number' || typeof parents === 'string') {
      primaryKey = parents;
      parents    = undefined;
    }

    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params, primaryKey);
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
    return this.ajax({ url: url, method: 'PATCH', data: data, rawResponse: true });
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
    return this.ajax({ url: url, method: 'POST', data: data, rawResponse: true });
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
    return this.ajax({ url: url, method: 'PUT', data: data, rawResponse: true });
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

RestModel.V2 = _dereq_('./index-v2');

},{"./index-v2":2,"./lib/cache":4,"./lib/utils":5}],2:[function(_dereq_,module,exports){
'use strict';

var cache = _dereq_('./lib/cache-v2').create();
var utils = _dereq_('./lib/utils');

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

},{"./lib/cache-v2":3,"./lib/utils":5}],3:[function(_dereq_,module,exports){
'use strict';

/**
 * A set of functions responsible for managing RestModel's localStorage cache.
 *
 * @class Cache
 */
module.exports = Ember.Object.extend({
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
    }.bind(this))).then(function(response) {
      return response.compact();
    });
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
        return this.putItem(cacheKey, item);
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
      this.putItem(cacheKey, response),
      this.setItem(path, key)
    ]).then(function() {
      return response;
    });
  },

  /**
   * Remove the given record from the cache.
   *
   * @method removeRecord
   * @async
   * @param {RestModel} record the record to be removed from the cache
   * @return {Ember.RSVP.Promise} a promise resolved when the record is removed
   */
  removeRecord: function(record) {
    var typeKey    = record.constructor.typeKey;
    var primaryKey = record.get(record.constructor.primaryKeys[0]);
    var key        = this.getCacheKey(typeKey, primaryKey);

    return this.removeItem(key);
  },

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

    return this.putItem(cacheKey, data);
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
      var value = localStorage.getItem(key) || null;
      resolve(JSON.parse(value));
    });
  },

  /**
   * Update or set a JSON value in the cache.
   *
   * @method putItem
   * @async
   * @private
   * @param {String} key the key to set the value for in the cache
   * @param {Object,Array.String,Array.Object} value the value to put in the cache
   * @return {Ember.RSVP.Promise} a promise resolved when the value has been set
   *   in the cache
   */
  putItem: function(key, value) {
    return this.getItem(key).then(function(existingValue) {
      if (existingValue) {
        for (var prop in value) {
          existingValue[prop] = value[prop];
        }

        return this.setItem(key, existingValue);
      } else {
        return this.setItem(key, value);
      }
    }.bind(this));
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
      var stringValue = JSON.stringify(value);
      localStorage.setItem(key, stringValue);
      resolve(value);
    });
  },

  /**
   * Remove an item from the cache.
   *
   * @method removeItem
   * @async
   * @private
   * @param {String} key the key to be removed from the cache
   * @return {Ember.RSVP.Promise} a promise resolved when the key has been
   *   removed
   */
  removeItem: function(key) {
    return new Ember.RSVP.Promise(function(resolve) {
      localStorage.removeItem(key);
      resolve();
    });
  }
});

},{}],4:[function(_dereq_,module,exports){
'use strict';

var utils = _dereq_('./utils');

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
      updateCachedModel(datum, klass, allCachedModels);
    });
  } else {
    updateCachedModel(data, klass, allCachedModels);
  }

  this.set(klass.toString(), allCachedModels);

  return allCachedModels;
};

function updateCachedModel(item, klass, array) {
  var cachedItem = utils.findMatching(item, klass, array);
  var index      = array.indexOf(cachedItem);

  if (cachedItem) {
    array[index] = item;
  } else {
    array.push(item);
  }
}

},{"./utils":5}],5:[function(_dereq_,module,exports){
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

},{}]},{},[1])
(1)
});
