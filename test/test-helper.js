'use strict';

require('should');

var benv  = require('benv');
var sinon = require('sinon');

global.context = describe;

before(function(done) {
  benv.setup(function() {
    global.jQuery       = require('../bower_components/jquery/dist/jquery.min.js');
    global.$            = jQuery;
    global.Handlebars   = benv.require('../bower_components/handlebars/handlebars.min.js', 'Handlebars');
    global.Ember        = benv.require('../bower_components/ember/ember.js', 'Ember');

    benv.require('../bower_components/mutating-array/index.js');

    global.localStorage = {
      _cache: {},

      getItem: function(key) {
        return this._cache[key];
      },

      setItem: function(key, value) {
        this._cache[key] = value;
        return value;
      },

      removeItem: function(key) {
        delete this._cache[key];
      },

      clear: function() {
        this._cache = {};
      }
    };

    done();
  });
});

beforeEach(function() {
  localStorage.clear();

  var self = this;

  this.resolve = null;
  this.reject  = null;
  this.afterRequest = function() {};

  jQuery.ajax = sinon.stub().returns({
    then: function(resolve, reject) {
      if (self.resolve) {
        setTimeout(function() {
          resolve(self.resolve);
          self.afterRequest();
        }, 5);
      } else if (self.reject) {
        setTimeout(function() {
          reject(self.reject);
          self.afterRequest();
        }, 5);
      } else {
        resolve(null);
      }
    }
  });
});
