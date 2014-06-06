'use strict';

require('./test-helper');

var should = require('should');
var Post;

describe('caching behavior', function() {
  before(function() {
    Post = require('./models').Post;
    Post.cache = true;
  });

  after(function() {
    Post.cache = false;
  });

  describe('when caching an array of objects', function() {
    beforeEach(function(done) {
      this.resolve = [{ id: 1 }];
      Post.all().then(function() {
        done();
      });
    });

    describe('and a record is added', function() {
      var res;

      beforeEach(function(done) {
        this.resolve = [{ id: 1 }, { id: 2 }];
        Post.all().then(function(posts) {
          res = posts;
          done();
        });
      });

      it('initially returns the cached records', function() {
        res.map(function(post) {
          return post.get('id');
        }).should.eql([1]);
      });

      it('updates the results with the new records', function(done) {
        this.afterRequest = function() {
          res.map(function(post) {
            return post.get('id');
          }).should.eql([1, 2]);

          done();
        };
      });
    });

    describe('and a record is removed', function() {
      var res;

      beforeEach(function(done) {
        this.resolve = [];
        Post.all().then(function(posts) {
          res = posts;
          done();
        });
      });

      it('initially returns the cached records', function() {
        res.map(function(post) {
          return post.get('id');
        }).should.eql([1]);
      });

      it('removes the removed records', function(done) {
        this.afterRequest = function() {
          res.toArray().should.eql([]);
          done();
        };
      });
    });

    describe('and a record is updated', function() {
      var res;

      beforeEach(function(done) {
        this.resolve = [{ id: 1, content: 'foo' }];
        Post.all().then(function(posts) {
          res = posts;
          done();
        });
      });

      it('initially returns the cached records', function() {
        should(res[0].get('content')).eql(undefined);
      });

      it('updates the updated records', function(done) {
        this.afterRequest = function() {
          res[0].get('content').should.eql('foo');
          done();
        };
      });
    });
  });

  describe('when caching a single object', function() {
    beforeEach(function(done) {
      this.resolve = { id: 1 };
      Post.all().then(function() {
        done();
      });
    });

    describe('and the record is updated', function() {
      var res;

      beforeEach(function(done) {
        this.resolve = { id: 1, content: 'foo' };
        Post.all().then(function(posts) {
          res = posts;
          done();
        });
      });

      it('initially returns the cached record', function() {
        should(res.get('content')).eql(undefined);
      });

      it('updates the record', function(done) {
        this.afterRequest = function() {
          res.get('content').should.eql('foo');
          done();
        };
      });
    });
  });
});
