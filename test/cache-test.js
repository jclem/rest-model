'use strict';

require('./test-helper');

var should = require('should');
var cache  = require('../lib/cache');
var Post;

describe('RestModel.Cache', function() {
  beforeEach(function() {
    Post = require('./models').Post;
  });

  describe('#getModels', function() {
    var record      = { id: 1, content: 'foo' };
    var extraRecord = { id: 2, content: 'bar' };

    describe('when fetching an array', function() {
      beforeEach(function() {
        cache.update(Post, '/posts/2', extraRecord);
        cache.update(Post, '/posts', [record]);
      });

      it('fetches the cached array of records', function() {
        cache.getModels(Post, '/posts').should.eql([record]);
      });
    });

    describe('when fetching a single record', function() {
      beforeEach(function() {
        cache.update(Post, '/posts/1', record);
      });

      it('fetches the cached record', function() {
        cache.getModels(Post, '/posts/1').should.eql(record);
      });
    });

    describe('when there are no existing cached records', function() {
      it('returns an empty array', function() {
        should(cache.getModels(Post, '/posts')).eql(null);
      });
    });
  });

  describe('#update', function() {
    describe('when given an array', function() {
      var cacheContent;

      beforeEach(function() {
        cacheContent = [{ id: 1, content: 'content' }, { id: 2, content: 'content-2' }];
        cache.update(Post, '/posts', cacheContent);
        cacheContent = [{ id: 1, content: 'new-content' }, { id: 2, content: 'content-2' }];
        cache.update(Post, '/posts', cacheContent);
      });

      it('adds the primary keys to the cache', function() {
        localStorage.getItem('/posts').should.eql('[1,2]')
      });

      it('adds the records to the class store', function() {
        var expected = JSON.stringify(cacheContent);
        localStorage.getItem('Post').should.eql(expected);
      });

      it('updates existing records in the class store', function() {
        JSON.parse(localStorage.getItem('Post'))[0].content.should.eql('new-content');
      });

      it('does not duplicate records', function() {
        var expected = JSON.stringify(cacheContent);
        cache.update(Post, '/posts', cacheContent);
        localStorage.getItem('Post').should.eql(expected);
      });
    });

    describe('when given an object', function() {
      var cacheContent;

      beforeEach(function() {
        cacheContent = { id: 1, content: 'content' };
        cache.update(Post, '/post/1', cacheContent);
      });

      it('adds the primary key to the cache', function() {
        localStorage.getItem('/post/1').should.eql('1')
      });

      it('adds the record to the class store', function() {
        var expected = JSON.stringify([cacheContent]);
        localStorage.getItem('Post').should.eql(expected);
      });
    });
  });
});
