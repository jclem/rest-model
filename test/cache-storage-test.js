'use strict';

require('./test-helper');

var should = require('should');
var shared = require('./shared');
var CacheStorage = require('../lib/cache-storage');
var cacheStorage;

describe('RestModel.CacheStorage', function() {
  describe('with localStorage support', function() {
    beforeEach(function(){
      cacheStorage = CacheStorage.get();
    });

    it('sets item', function() {
      cacheStorage.setItem('message', 'Hello');
      cacheStorage.getItem('message').should.eql('Hello');
    });

    it('removes item', function() {
      cacheStorage.setItem('message', 'Hello');
      cacheStorage.removeItem('message');
      should(cacheStorage.getItem('message')).be.undefined;
    });
  });

  describe('without localStorage support', function(){
    beforeEach(function(){
      global.localStorage = undefined;
      cacheStorage = CacheStorage.get();
    });

    afterEach(function(){
      global.localStorage = global._localStorage;
    });

    it('does not fail when reading values', function(){
      should.doesNotThrow(function(){
        cacheStorage.getItem('message');
      });
    });

    it('sets storage to nullStorage', function(){
      cacheStorage.constructor.should.be.eql(CacheStorage.NullStorage);
    });

    it('does not fail when writing values', function(){
      should.doesNotThrow(function(){
        cacheStorage.setItem('message');
      });
    });

    it('does not fail when removing values', function(){
      should.doesNotThrow(function(){
        cacheStorage.removeItem('message');
      });
    });
  });
});
