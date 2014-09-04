// Allow wrapping IIFEs in parens for testing thrown errors.
// jshint -W068

// Allow expressions in place of function calls (for be.true, etc)
// jshint -W030

'use strict';

require('./test-helper');

var should = require('should');
var sinon  = require('sinon');

describe('RestModel.V2', function() {
  var Comment, Post, RestModel, cache, post;

  before(function() {
    RestModel = require('../index').V2;
    cache     = require('../lib/cache-v2').create();

    Post = RestModel.extend({
      attrs: function() {
        return ['name', 'tags.[]'];
      }.property(),

      tags: function() {
        return [];
      }.property()
    }).reopenClass({
      primaryKeys: ['id'],
      typeKey    : 'post',
      base       : 'posts',
      cache      : true
    });

    Comment = RestModel.extend().reopenClass({
      typeKey: 'comment',
      base   : 'posts/:post/comments'
    });
  });

  beforeEach(function() {
    post = Post.create();
  });

  describe('.dirtyProperties', function() {
    context('when no attributes have changed', function() {
      it('is empty', function() {
        post.get('dirtyProperties').should.eql([]);
      });
    });

    context('when a simple attribute has changed', function() {
      it('includes that property', function() {
        post.set('name', 'new-name');
        post.get('dirtyProperties').should.eql(['name']);
      });
    });

    context('when an array attribute has changed', function() {
      it('includes that property', function() {
        post.get('tags').pushObject('draft');
        post.get('dirtyProperties').should.eql(['tags']);
      });
    });
  });

  describe('.isClean', function() {
    context('when no attributes have changed', function() {
      it('is true', function() {
        post.get('isClean').should.be.true;
      });
    });

    context('when a simple attribute has changed', function() {
      it('is false', function() {
        post.set('name', 'new-name');
        post.get('isClean').should.be.false;
      });
    });
  });

  describe('.isDirty', function() {
    context('when no attributes have changed', function() {
      it('is false', function() {
        post.get('isDirty').should.be.false;
      });
    });

    context('when a simple attribute has changed', function() {
      it('is true', function() {
        post.set('name', 'new-name');
        post.get('isDirty').should.be.true;
      });
    });

    context('when an array attribute has changed', function() {
      it('is true', function() {
        post.get('tags').pushObject('draft');
        post.get('isDirty').should.be.true;
      });
    });
  });

  describe('.isNew', function() {
    context('when there is no primary key', function() {
      it('is true', function() {
        post.get('isNew').should.be.true;
      });
    });

    context('when there is a primary key', function() {
      it('is false', function() {
        post.set('id', 1);
        post.get('isNew').should.be.false;
      });
    });
  });

  describe('path', function() {
    context('when a namespace is specified', function() {
      it('respects the namespace', function() {
        RestModel
          .extend()
          .reopenClass({ namespace: 'foo', base: 'bar' })
          .create()
          .get('path')
          .should.eql('/foo/bar');
      });
    });

    context('when there is a primary key', function() {
      it('is the base class path with a primary key', function() {
        post.set('id', 1);
        post.get('path').should.eql('/posts/1');
      });
    });

    context('when the record has parents', function() {
      it('includes the parents in the path', function() {
        var comment = Comment.create({ post: post, id: 2 });
        post.set('id', 1);
        comment.get('path').should.eql('/posts/1/comments/2');
      });

      context('and a parent is missing a primary key', function() {
        it('throws an error', function() {
          var comment = Comment.create({ post: post, id: 2 });

          (function() {
            comment.get('path');
          }).should.throw('No primary key found for parent "post".');
        });
      });
    });
  });

  describe('#delete', function() {
    context('when there is no primary key', function() {
      it('throws an error', function() {
        (function() {
          post.delete();
        }).should.throw('Can not delete a record with no primary key.');
      });
    });

    context('when there is a primary key', function() {
      var args;

      beforeEach(function() {
        post.set('id', 1);
        post.delete();
        args = jQuery.ajax.lastCall.args;
      });

      it('removes the record from the cache', function() {
        this.resolve = { id: 1, name: 'post' };

        return Post.find(1).then(function() {
          return post.delete();
        }).then(function() {
          return cache.getItem('post: 1');
        }).then(function(cached) {
          should(cached).be.null;
        });
      });

      it('temporarily sets the isDeleting and inFlight properties', function(done) {
        this.resolve = {};

        post.delete().then(function() {
          post.get('isDeleting').should.be.false;
          post.get('inFlight').should.be.false;
          done();
        });

        post.get('isDeleting').should.be.true;
      });

      it('deletes the record with the instance path', function() {
        args[0].url.should.eql(post.get('path'));
      });

      it('deletes the record with the a DELETE', function() {
        args[0].type.should.eql('DELETE');
      });

      it('accepts custom options', function() {
        post.delete({ url: '/posts/custom-path' });
        jQuery.ajax.lastCall.args[0].url.should.eql('/posts/custom-path');
      });
    });
  });

  describe('#fetch', function() {
    context('when there is no primary key', function() {
      it('throws an error', function() {
        (function() {
          post.fetch();
        }).should.throw('Can not fetch a record with no primary key.');
      });
    });

    context('when there is a primary key', function() {
      var args;

      beforeEach(function() {
        post.set('id', 1);
        post.fetch();
        args = jQuery.ajax.lastCall.args;
      });

      it('temporarily sets the isFetching and inFlight properties', function(done) {
        this.resolve = {};

        post.fetch().then(function() {
          post.get('isFetching').should.be.false;
          post.get('inFlight').should.be.false;
          done();
        });

        post.get('isFetching').should.be.true;
      });


      it('fetches the record with the instance path', function() {
        args[0].url.should.eql(post.get('path'));
      });

      it('fetches the record with the a GET', function() {
        args[0].type.should.eql('GET');
      });

      it('accepts custom options', function() {
        post.fetch({ url: '/posts/custom-path' });
        jQuery.ajax.lastCall.args[0].url.should.eql('/posts/custom-path');
      });

      it('updates the record attributes with the response', function() {
        this.resolve = { name: 'Test Post' };
        return post.fetch().then(function() {
          post.get('name').should.eql('Test Post');
        });
      });
    });
  });

  describe('#revert', function() {
    beforeEach(function() {
      post = Post.create({ name: 'foo' });
      post.set('name', 'bar');
      post.get('tags').pushObject('draft');
      post.revert();
    });

    it('reverts back to the original properties', function() {
      post.get('name').should.eql('foo');
    });

    it('reverts array properties', function() {
      post.get('tags').toArray().should.eql([]);
    });

    it('reverts array properties in a KVO-friendly way', function() {
      var changed;

      Post.reopen({
        change: function() {
          changed = true;
        }.observes('tags.[]')
      });

      post = Post.create();
      post.get('tags').pushObject('foo');
      changed = false;
      post.revert();
      changed.should.be.true;
    });
  });

  describe('#save', function() {
    var args;

    beforeEach(function() {
      this.resolve = { id: 1, name: 'Test Post' };
    });

    it('temporarily sets the isSaving and inFlight properties', function(done) {
      this.resolve = { id: 1 };

      post.save().then(function() {
        post.get('isSaving').should.be.false;
        post.get('inFlight').should.be.false;
      }).then(done);

      post.get('isSaving').should.be.true;
    });

    it('updates the record attributes with the response', function() {
      this.resolve = { name: 'Test Post' };

      return post.save().then(function() {
        post.get('name').should.eql('Test Post');
      });
    });

    it('updates the cached representation of the record', function() {
      this.resolve = { id: 1, name: 'Test Post' };

      return post.save().then(function() {
        return cache.getItem('post: 1').then(function(item) {
          item.should.eql({ id: 1, name: 'Test Post' });
        });
      });
    });

    it('accepts custom options', function() {
      return post.save({ url: '/posts/custom-path' }).then(function() {
        jQuery.ajax.lastCall.args[0].url.should.eql('/posts/custom-path');
      });
    });

    it('is not dirty afterwards', function() {
      this.resolve = { id: 1, name: 'Test Post' };

      post.set('name', 'Test Post');
      post.get('isDirty').should.eql(true);

      return post.save().then(function() {
        post.get('isDirty').should.eql(false);
      });
    });

    it('saves with a serialized form of the record', function() {
      post.set('name', 'bar');

      return post.save().then(function() {
        jQuery.ajax.lastCall.args[0].data.should.eql('{"name":"bar","tags":[]}');
      });
    });

    context('when there is no primary key', function() {
      beforeEach(function() {
        return post.save().then(function() {
          args = jQuery.ajax.lastCall.args;
        });
      });

      it('saves with a POST', function() {
        args[0].type.should.eql('POST');
      });

      it('saves with the class base path', function() {
        args[0].url.should.eql('/' + Post.base);
      });
    });

    context('when there is a primary key', function() {
      beforeEach(function() {
        post.set('id', 1);

        return post.save().then(function() {
          args = jQuery.ajax.lastCall.args;
        });
      });

      it('saves the record with the instance path', function() {
        args[0].url.should.eql(post.get('path'));
      });

      it('saves the record with the a PATCH', function() {
        args[0].type.should.eql('PATCH');
      });
    });
  });

  describe('::ajax', function() {
    it('defaults to GET', function() {
      return Post.ajax().then(function() {
        jQuery.ajax.lastCall.args[0].type.should.eql('GET');
      });
    });

    it('defaults to json dataType', function() {
      return Post.ajax().then(function() {
        jQuery.ajax.lastCall.args[0].dataType.should.eql('json');
      });
    });

    it('defaults to application/json contentType', function() {
      return Post.ajax().then(function() {
        jQuery.ajax.lastCall.args[0].contentType.should.eql('application/json');
      });
    });

    it('accepts custom options', function() {
      return Post.ajax({ type: 'POST' }).then(function() {
        jQuery.ajax.lastCall.args[0].type.should.eql('POST');
      });
    });

    it('returns a promise that resolves with the response data', function() {
      this.resolve = { foo: 'bar' };

      return Post.ajax().then(function(data) {
        data.should.eql({ foo: 'bar' });
      });
    });

    it('returns a promise that depromisifies its reject value', function() {
      this.reject = { then: 'looks-like-a-promise' };

      return Post.ajax().then(null, function(jqXHR) {
        should(jqXHR.then).eql(undefined);
      });
    });

    describe('deserialization', function() {
      var Model;

      before(function() {
        Model = RestModel.extend().reopenClass({
          deserialize: function(data) {
            data.foo = 'transformed';
            return data;
          }
        });
      });

      it('deserializes objects', function() {
        this.resolve = { foo: 'bar' };

        return Model.ajax().then(function(data) {
          data.should.eql({ foo: 'transformed' });
        });
      });

      it('deserializes arrays', function() {
        this.resolve = [{ foo: 'bar' }];

        return Model.ajax().then(function(data) {
          data.should.eql([{ foo: 'transformed' }]);
        });
      });
    });
  });

  describe('::all', function() {
    beforeEach(function() {
      this.resolve = [];
    });

    it('does a GET request', function() {
      return Post.all().then(function() {
        jQuery.ajax.lastCall.args[0].type.should.eql('GET');
      });
    });

    it('does a request to the base path', function() {
      return Post.all().then(function() {
        jQuery.ajax.lastCall.args[0].url.should.eql('/' + Post.base);
      });
    });

    it('accepts custom options', function() {
      return Post.all(null, { url: '/posts/all' }).then(function() {
        jQuery.ajax.lastCall.args[0].url.should.eql('/posts/all');
      });
    });

    it('resolves with a deserialized array of instances', function() {
      this.resolve = [{ name: 'foo' }];
      return Post.all().then(function(instances) {
        instances[0].get('name').should.eql('foo');
      });
    });

    context('when the model requires parents', function() {
      context('when given parents', function() {
        it('uses the parents to build the path', function() {
          return Comment.all({ post: 1 }).then(function() {
            jQuery.ajax.lastCall.args[0].url.should.eql('/posts/1/comments');
          });
        });

        it('adds the parents to the results', function() {
          this.resolve = [{ id: 1 }];

          return Comment.all({ post: 5 }).then(function(comments) {
            comments[0].get('post').should.eql(5);
          });
        });

        context('and the request is cached', function() {
          var originalResponse;

          beforeEach(function() {
            originalResponse = [{ id: 1, name: 'name-1' }];
            this.resolve = originalResponse;

            return Comment.all({ post: 1 }).then(function() {
              this.resolve =
                [{ id: 1, name: 'name-1' }, { id: 2, name: 'name-2' }];
            }.bind(this));
          });

          it('adds the parents to the previously cached records', function(done) {
            return Comment.all({ post: 1 }).then(function(comments) {
              setTimeout(function() {
                comments.mapBy('parents.post').should.eql([1, 1]);
                done();
              }, 10);
            });
          });
        });
      });

      context('when not given parents', function() {
        it('throws an error', function() {
          (function() {
            Comment.all();
          }).should.throw('No primary key found for parent "post".');
        });
      });
    });
  });

  describe('::find', function() {
    beforeEach(function() {
      this.resolve = [];
    });

    it('does a GET request', function() {
      return Post.find(1).then(function() {
        jQuery.ajax.lastCall.args[0].type.should.eql('GET');
      });
    });

    it('does a request to the base path with primary key', function() {
      return Post.find(1).then(function() {
        jQuery.ajax.lastCall.args[0].url.should.eql('/' + Post.base + '/1');
      });
    });

    it('accepts custom options', function() {
      return Post.find(1, { url: '/posts/all' }).then(function() {
        jQuery.ajax.lastCall.args[0].url.should.eql('/posts/all');
      });
    });

    it('resolves with a deserialized instance', function() {
      this.resolve = { name: 'foo' };
      return Post.find(1).then(function(instance) {
        instance.get('name').should.eql('foo');
      });
    });

    it('writes the model to the cache', function() {
      var attrs    = { id: 1, name: 'name' };
      this.resolve = attrs;

      return Post.find(1).then(function() {
        return cache.getResponse(Post, '/posts/1').then(function(response) {
          response.should.eql(attrs);
        });
      });
    });

    context('when the model requires parents', function() {
      context('when given parents', function() {
        it('uses the parents to build the path', function() {
          return Comment.find({ post: 1 }, 2).then(function() {
            jQuery.ajax.lastCall.args[0].url.should.eql('/posts/1/comments/2');
          });
        });

        it('adds the parents to the result', function() {
          this.resolve = [{ id: 1 }];

          return Comment.find({ post: 5 }, 1).then(function(comment) {
            comment.get('post').should.eql(5);
          });
        });
      });

      context('when not given parents', function() {
        it('throws an error', function() {
          (function() {
            Comment.find(1);
          }).should.throw('No primary key found for parent "post".');
        });
      });
    });
  });

  describe('::request', function() {
    context('when it is not a GET request', function() {
      var ajaxSpy, cacheSpy;

      beforeEach(function() {
        ajaxSpy  = sinon.spy(RestModel, 'ajax');
        cacheSpy = sinon.spy(RestModel, 'requestWithCache');

        return RestModel.request({
          type: 'POST'
        });
      });

      afterEach(function() {
        ajaxSpy.restore();
        cacheSpy.restore();
      });

      it('does not perform caching', function() {
        cacheSpy.callCount.should.eql(0);
      });

      it('performs an AJAX request with the options', function() {
        ajaxSpy.lastCall.args[0].should.eql({ type: 'POST' });
      });
    });

    context('when it is a GET request', function() {
      context('and caching is not enabled', function() {
        var cacheSpy;

        beforeEach(function() {
          this.resolve = [{ id: 1 }];
          cacheSpy = sinon.spy(RestModel, 'requestWithCache');

          return RestModel.request({
            type: 'GET'
          });
        });

        afterEach(function() {
          cacheSpy.restore();
        });

        it('does not perform caching', function() {
          cacheSpy.callCount.should.eql(0);
        });
      });

      context('and the request is not cached', function() {
        var cacheSpy;

        beforeEach(function() {
          cacheSpy = sinon.spy(cache.constructor.prototype, 'setResponse');
        });

        afterEach(function() {
          cacheSpy.reset();
        });

        it('writes the response to the cache', function() {
          this.resolve = { id: 1, name: 'name' };

          return Post.request({
            type: 'GET',
            url : '/posts/1'
          }).then(function() {
            cacheSpy.lastCall.args.should.eql([
              Post,
              '/posts/1',
              { id: 1, name: 'name' }
            ]);
          });
        });
      });

      context('and the request is cached', function() {
        var originalResponse;

        context('and the response is an array', function() {
          beforeEach(function() {
            originalResponse = [{ id: 1, name: 'name-1' }, { id: 2, name: 'name-2' }];
            this.resolve = originalResponse;

            return Post.request({
              type: 'GET',
              url : '/posts'
            }).then(function() {
              this.resolve = [{ id: 1, name: 'new-name-1' }, { id: 3, name: 'name-3' }];
            }.bind(this));
          });

          it('initially returns the cached array', function(done) {
            return Post.request({
              type: 'GET',
              url : '/posts'
            }).then(function(result) {
              result.mapBy('name').should.eql(['name-1', 'name-2']);
              setTimeout(done, 10);
            });
          });

          it('updates the array after the request', function(done) {
            return Post.request({
              type: 'GET',
              url : '/posts'
            }).then(function(result) {
              setTimeout(function() {
                result.mapBy('name').should.eql(['new-name-1', 'name-3']);
                done();
              }, 10);
            });
          });

          it('updates the array with instances, not objects', function(done) {
            return Post.request({
              type: 'GET',
              url : '/posts'
            }).then(function(result) {
              setTimeout(function() {
                result.mapBy('constructor.typeKey').should.eql(['post', 'post']);
                done();
              }, 10);
            });
          });
        });

        context('and the response is an object', function() {
          var originalResponse;

          beforeEach(function() {
            originalResponse = { id: 1, name: 'name' };
            this.resolve = originalResponse;

            return Post.request({
              type: 'GET',
              url : '/posts/1'
            }).then(function() {
              this.resolve = { id: 1, name: 'new-name' };
            }.bind(this));
          });

          it('initially returns the cached object', function(done) {
            return Post.request({
              type: 'GET',
              url : '/posts/1'
            }).then(function(result) {
              result.get('name').should.eql(originalResponse.name);
              setTimeout(done, 10);
            });
          });

          it('updates the cached object', function(done) {
            return Post.request({
              type: 'GET',
              url : '/posts/1'
            }).then(function(result) {
              setTimeout(function() {
                result.get('name').should.eql('new-name');
                done();
              }, 10);
            });
          });
        });
      });
    });
  });
});
