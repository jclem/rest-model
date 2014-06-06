'use strict';

var benv  = require('benv');
var cache = {};

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

afterEach(function() {
  cache = {};
});
