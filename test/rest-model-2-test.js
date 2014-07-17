// Allow wrapping IIFEs in parens for testing thrown errors.
// jshint -W068

// Allow expressions in place of function calls (for be.true, etc)
// jshint -W030

'use strict';

require('./test-helper');

var should = require('should');

describe('RestModelV2', function() {
  var Comment, Post, RestModel, post;

  before(function() {
    RestModel = require('../index-v2');

    Post = RestModel.extend({
      attrs: function() {
        return ['name', 'tags.[]'];
      }.property(),

      tags: function() {
        return [];
      }.property()
    }).reopenClass({
      base: 'posts'
    });

    Comment = RestModel.extend().reopenClass({
      base: 'posts/:post/comments'
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

    it('temporarily sets the isSaving and inFlight properties', function(done) {
      this.resolve = {};

      post.save().then(function() {
        post.get('isSaving').should.be.false;
        post.get('inFlight').should.be.false;
        done();
      });

      post.get('isSaving').should.be.true;
    });

    it('updates the record attributes with the response', function() {
      this.resolve = { name: 'Test Post' };
      return post.save().then(function() {
        post.get('name').should.eql('Test Post');
      });
    });

    it('accepts custom options', function() {
      post.save({ url: '/posts/custom-path' });
      jQuery.ajax.lastCall.args[0].url.should.eql('/posts/custom-path');
    });

    it('saves with a serialized form of the record', function() {
      post.set('name', 'bar');
      post.save();
      jQuery.ajax.lastCall.args[0].data.should.eql('{"name":"bar","tags":[]}');
    });

    context('when there is no primary key', function() {
      beforeEach(function() {
        post.save();
        args = jQuery.ajax.lastCall.args;
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
        post.save();
        args = jQuery.ajax.lastCall.args;
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
      before(function() {
        Post = RestModel.extend().reopenClass({
          base: 'posts',
          deserialize: function(data) {
            data.foo = 'transformed';
            return data;
          }
        });
      });

      it('deserializes objects', function() {
        this.resolve = { foo: 'bar' };
        return Post.ajax().then(function(data) {
          data.should.eql({ foo: 'transformed' });
        });
      });

      it('deserializes arrays', function() {
        this.resolve = [{ foo: 'bar' }];
        return Post.ajax().then(function(data) {
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

    context('when the model requires parents', function() {
      context('when given parents', function() {
        it('uses the parents to build the path', function() {
          return Comment.find({ post: 1 }, 2).then(function() {
            jQuery.ajax.lastCall.args[0].url.should.eql('/posts/1/comments/2');
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
});
