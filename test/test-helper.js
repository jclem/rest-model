'use strict';

var benv  = require('benv');
var sinon = require('sinon');
var cache = {};

global.context = describe;

before(function(done) {
  benv.setup(function() {
    global.jQuery       = require('../bower_components/jquery/dist/jquery.min.js');
    global.$            = jQuery;
    global.Handlebars   = benv.require('../bower_components/handlebars/handlebars.min.js', 'Handlebars');
    global.Ember        = benv.require('../bower_components/ember/ember.min.js', 'Ember');
    global.localStorage = {
      getItem: function(key) {
        return cache[key];
      },

      setItem: function(key, value) {
        cache[key] = value;
        return value;
      }
    };

    done();
  });
});

beforeEach(function() {
  var self = this;

  this.resolve = null;
  this.reject  = null;
  this.afterRequest = function() {};

  jQuery.ajax = sinon.stub().returns({
    then: function(resolve, reject) {
      if (self.resolve) {
        Ember.run.later(function() {
          resolve(self.resolve);
          self.afterRequest();
        });
      } else if (self.reject) {
        Ember.run.later(function() {
          reject(self.reject);
          self.afterRequest();
        });
      } else {
        resolve(null);
      }
    }
  });
});

afterEach(function() {
  cache = {};
});
