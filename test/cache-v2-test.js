// Allow expressions in place of function calls (for be.true, etc)
// jshint -W030

'use strict';

require('./test-helper');

var should = require('should');

describe('CacheV2', function() {
  var Post, cache;

  beforeEach(function() {
    var RestModel = require('../index-v2');
    cache = require('../lib/cache-v2').create();

    Post = RestModel.extend().reopenClass({
      typeKey: 'post',
      base   : 'posts'
    });
  });

  describe('#getResponse', function() {
    var attrs;

    beforeEach(function() {
      attrs = { id: 1, name: 'post' };
    });

    context('when no value is cached', function() {
      it('resolves with `null`', function() {
        return cache.getResponse(Post, '/posts').then(function(res) {
          should(res).be.null;
        });
      });
    });

    context('when the response is an array', function() {
      it('resolves with the array', function() {
        setLocalStorage('/posts', [attrs]);

        return cache.getResponse(Post, '/posts').then(function(res) {
          res.should.eql([attrs]);
        });
      });
    });

    context('when the response is an item', function() {
      it('fetches the item', function() {
        setLocalStorage('/posts/1', attrs);

        return cache.getResponse(Post, '/posts/1').then(function(res) {
          res.should.eql(attrs);
        });
      });
    });
  });

  describe('#setResponse', function() {
    context('when the response is an array', function() {
      var items;

      beforeEach(function() {
        items = [
          { id: 1, name: 'new-name' },
          { id: 2, name: 'other-name' }
        ];
      });

      it('resolves with the value', function() {
        return cache.setResponse(Post, '/posts', items).then(function(response) {
          response.should.eql(items);
        });
      });

      context('and a value already exists', function() {
        it('updates the response', function() {
          setLocalStorage('/posts', [{ id: 1, name: 'name' }]);

          return cache.setResponse(Post, '/posts', items).then(function() {
            return cache.getResponse(Post, '/posts');
          }).then(function(response) {
            response.should.eql(items);
          });
        });
      });

      context('and a value does not already exist', function() {
        it('sets the response', function() {
          return cache.setResponse(Post, '/posts', items).then(function() {
            return cache.getResponse(Post, '/posts');
          }).then(function(response) {
            response.should.eql(items);
          });
        });
      });
    });

    context('when the response is an item', function() {
      var item;

      beforeEach(function() {
        item = { id: 1, name: 'new-name' };
      });

      it('resolves with the value', function() {
        return cache.setResponse(Post, '/posts/1', item).then(function(response) {
          response.should.eql(item);
        });
      });

      context('and the value already exists', function() {
        it('updates the response', function() {
          setLocalStorage('/posts/1', { id: 1, name: 'name' });

          return cache.setResponse(Post, '/posts/1', item).then(function() {
            return cache.getResponse(Post, '/posts/1');
          }).then(function(response) {
            response.should.eql(item);
          });
        });
      });

      context('and the value does not already exist', function() {
        it('sets the response', function() {
          return cache.setResponse(Post, '/posts/1', item).then(function() {
            return cache.getResponse(Post, '/posts/1');
          }).then(function(response) {
            response.should.eql(item);
          });
        });
      });
    });
  });

  function setLocalStorage(path, attrs) {
    if (Ember.isArray(attrs)) {
      localStorage.setItem(path, JSON.stringify(attrs.mapBy('id')));

      attrs.forEach(function(object) {
        localStorage.setItem('post: ' + object.id, JSON.stringify(object));
      });
    } else {
      localStorage.setItem(path, JSON.stringify(attrs.id));
      localStorage.setItem('post: ' + attrs.id, JSON.stringify(attrs));
    }
  }
});
