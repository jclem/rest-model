/**
 * @class RestModel
 */
var RestModel = Ember.Object.extend({
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
    var isDirty = Ember.computed.apply(Ember, this.get('attrs').concat(function(key, value) {
      var attrs              = self.get('attrs');
      var originalProperties = self.get('originalProperties');
      var i;

      for (i = 0; i < attrs.length; i++) {
        key   = attrs[i];
        value = self.get(key);

        if (value !== originalProperties.get(key)) {
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
   * @return {Ember.RSVP.Promise} the promise resolved with the deleted record
   */
  delete: function() {
    return this.submit('delete');
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
   * @return {RestModel}
   */
  fetch: function(findKey) {
    var parentKeys = this.get('parentKeys');
    var key        = this.getPrimaryKey();

    return this.constructor.find(parentKeys, key);
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
    var self = this;

    if (!this.parents) return [];

    return this.parents.map(function(parent) {
      return parent.getPrimaryKey();
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
   * Reverts an object to its original properties.
   *
   * @method revert
   */
  revert: function() {
    return this.setProperties(this.get('originalProperties'));
  },

  /**
   * Save this model, either via PATCH or POST. If the model has a non-blank
   * primary key, PATCH. Otherwise, POST.
   *
   * @method save
   * @param {Object} [options] options that will be passed to `ajax`
   * @param {String} options.withURL a url template (e.g. `/foo/:bar`) to
   *   make the request with
   * @return {Ember.RSVP.Promise} a promise to be resolved with the saved model
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

    return this.submit(method, options).then(function(n) {
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
   * @private
   * @param {String} method the method to be used (e.g. `delete`, `patch`)
   * @param {Object} [options] options that will be passed to `ajax`
   * @param {String} options.withURL a url template (e.g. `/foo/:bar`) to
   *   make the request with
   * @return {Ember.RSVP.Promise} a promise to be resolved with the model
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
        var responseError = jqXHR.responseJSON;
        self.get('errors').setObjects([responseError.message]);
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
   * @static
   * @private
   * @param {Object} options options defining the request
   * @param {String} options.url the url to make the request to
   * @param {String} options.method the HTTP verb to use
   * @param {String} options.data the JSON-string request data to send
   * @return {Ember.RSVP.Promise} a promise to be resolved with a model or models
   */
  ajax: function(options) {
    var self = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      $.ajax({
        url        : options.url,
        type       : options.method || 'GET',
        data       : options.data,
        beforeSend : self.getBeforeSend(options),
        dataType   : 'json',
        contentType: 'application/json'
      }).then(function(data, responseText, jqXHR) {
        if (self.forceArray) {
          data = self.objectToArray(data);
        }

        if ($.isArray(data)) {
          data = self.deserializeArray(data);
        } else {
          data = self.deserialize(data);
        }

        if (options.parents) {
          Ember.makeArray(data).forEach(function(model) {
            model.set('parents', Ember.makeArray(options.parents));
          });
        }

        Ember.run(null, resolve, data);
      }, function(jqXHR) {
        delete jqXHR.then;
        Ember.run(null, reject, jqXHR);
      });
    });
  },

  /**
   * Fetch all records from the base URL for this class.
   *
   * @method all
   * @static
   * @param {Array} [parents] the parent IDs or objects to build the path with
   * @param {Object} [options] options that will be passed to `ajax`
   * @param {String} options.withURL a url template (e.g. `/foo/:bar`) to
   *   construct the URL for this request from, instead of the default URL.
   * @return {Ember.RSVP.Promise} a promise to be resolved with the models
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

    var path      = Ember.String.fmt(url.replace(/:[^\/]+/, '%@'), params);
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
   * @static
   * @private
   * @param {Array} parents the parents of this record
   * @param {RestModel} model the model to delete
   * @return {Ember.RSVP.Promise} a promise to be resolved with the deleted model
   */
  delete: function(parents, model) {
    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params, model.getPrimaryKey());
    return this.ajax({ url: url, method: 'DELETE' });
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
   * @static
   * @param {Array} parents the parents of this record
   * @param {Number,String} primaryKey the primary key to find
   * @return {Ember.RSVP.Promise} a promise to be resolved with the model
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
   * @static
   * @private
   * @param {Array} parents the parents of this record
   * @param {RestModel} model the model to update
   * @param {Object} [options] options that will be passed to `ajax`
   * @param {String} options.withURL a url template (e.g. `/foo/:bar`) to
   *   make the request with
   * @return {Ember.RSVP.Promise} a promise to be resolved with the model
   */
  patch: function(parents, model, options) {
    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params, model.getPrimaryKey(), options);
    var data   = model.serialize('patch');
    return this.ajax({ url: url, method: 'PATCH', data: data });
  },

  /**
   * Create a model via POST.
   *
   * @method post
   * @static
   * @private
   * @param {Array} parents the parents of this record
   * @param {RestModel} model the model to create
   * @param {Object} [options] options that will be passed to `ajax`
   * @param {String} options.withURL a url template (e.g. `/foo/:bar`) to
   *   make the request with
   * @return {Ember.RSVP.Promise} a promise to be resolved with the model
   */
  post: function(parents, model, options) {
    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params, null, options);
    var data   = model.serialize('post');
    return this.ajax({ url: url, method: 'POST', data: data });
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
  primaryKeys: ['id']
});

if (typeof require === 'function' && module) {
  module.exports = RestModel;
}
