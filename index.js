/**
 * @class RestModel
 */
var RestModel = Ember.Object.extend({
  /**
   * Save this model, either via PATCH or POST. If the model has a non-blank
   * primary key, PATCH. Otherwise, POST.
   *
   * @method save
   * @return {Ember.RSVP.Promise} a promise to be resolved with the saved model
   * @example
   *     Foo.create({ name: 'bar' }).save().then(function() {
   *       // (succeeded)
   *     }, function() {
   *       // (failed)
   *     });
   */
  save: function() {
    var parentKeys = this.get('parentKeys');
    var self       = this;
    var method;

    if (!Ember.isBlank(this.get(this.constructor.primaryKey))) {
      method = 'patch';
    } else {
      method = 'post';
    }

    return this.constructor[method](parentKeys, this).then(function(properties) {
      self.setProperties(properties);
    });
  },

  /**
   * Retrieve the parent keys for this object, useful for saving and updating
   * the object. Assumes that for path /posts/:post_id/comments, there is an
   * attribute `post_id` on the model.
   *
   * @method parentKeys
   * @private
   * @return {Array} an array of parent keys
   */
  parentKeys: function() {
    var self = this;

    return this.constructor.url.split('/').reduce(function(keys, segment) {
      if (segment.match(/^:/)) {
        var key = segment.slice(1);
        keys.push(self.get(key));
      }

      return keys;
    }, []);
  }.property()
}).reopenClass({
  /**
   * Make an AJAX request with the given options.
   *
   * @method ajax
   * @static
   * @private
   * @param {Object} options a hash of options defining the request
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
        dataType   : 'json',
        contentType: 'application/json'
      }).then(function(data, responseText, jqXHR) {
        if ($.isArray(data)) {
          data = self.deserializeArray(data);
        } else {
          data = self.deserialize(data);
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
   * @return {Ember.RSVP.Promise} a promise to be resolved with the models
   * @example
   *     // With no parent
   *     Post.all();
   *
   *     // With parent (given comments at /posts/:post_id/comments/):
   *     var post = Post.create({ id: 1 });
   *     Comment.all(post);
   */
  all: function(parents) {
    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params);
    return this.ajax({ url: url });
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
  buildURL: function(params, primaryKey) {
    var path = Ember.String.fmt(this.url.replace(/:[^\/]+/, '%@'), params);

    if (!Ember.isBlank(primaryKey)) {
      path = [path, primaryKey].join('/');
    }

    return path;
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
   * Given an array of models or primary keys, return an array of primary keys.
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
        return model.get(model.constructor.primaryKey);
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
    return this.ajax({ url: url });
  },

  /**
   * Update a model via PATCH.
   *
   * @method patch
   * @static
   * @private
   * @param {Array} parents the parents of this record
   * @param {RestModel} model the model to update
   * @return {Ember.RSVP.Promise} a promise to be resolved with the model
   */
  patch: function(parents, model) {
    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params, model.get(this.primaryKey));
    var data   = JSON.stringify(model);
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
   * @return {Ember.RSVP.Promise} a promise to be resolved with the model
   */
  post: function(parents, model) {
    var params = this.extractPrimaryKeys(parents);
    var url    = this.buildURL(params);
    var data   = JSON.stringify(model);
    return this.ajax({ url: url, method: 'POST', data: data });
  },

  /**
   * The primary key to use to find records of this class.
   *
   * @property primaryKey
   * @type String
   * @default 'id'
   * @static
   */
  primaryKey: 'id'
});

if (typeof require === 'function' && module) {
  module.exports = RestModel;
}
