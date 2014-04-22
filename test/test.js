'use strict';

var benv     = require('benv');
var should   = require('should');
var sinon    = require('sinon');
var shared   = require('./shared');
var Comment, Post;

describe('RestModel', function() {
  before(function(done) {
    benv.setup(function() {
      global.jQuery     = require('../bower_components/jquery/dist/jquery.min.js');
      global.$          = jQuery;
      global.Handlebars = benv.require('../bower_components/handlebars/handlebars.min.js', 'Handlebars')
      global.Ember      = benv.require('../bower_components/ember/ember.min.js', 'Ember');

      Post    = require('./models').Post;
      Comment = require('./models').Comment;

      done();
    });

    beforeEach(function() {
      var self = this;

      this.resolve = null;
      this.reject  = null;

      jQuery.ajax = sinon.stub().returns({
        then: function(resolve, reject) {
          if (self.resolve) {
            return resolve(self.resolve);
          } else if (self.reject) {
            return reject(self.reject);
          }
        }
      });
    });
  });

  describe('#save', function() {
    describe('when there are no parents', function() {
      describe('when the model has a primary key', function() {
        beforeEach(function() {
          this.model   = Post.create({ id: 1 });
          this.request = this.model.save.bind(this.model);
        });

        it('requests the proper URL', function() {
          this.model.save();
          jQuery.ajax.args[0][0].url.should.eql('/posts/1');
        });

        it('does a PATCH request', function() {
          this.model.save();
          jQuery.ajax.args[0][0].type.should.eql('PATCH');
        });

        shared.behavesLikeASaveRequest();
        shared.behavesLikeAFailableRequest();
      });

      describe('when the model has no primary key', function() {
        beforeEach(function() {
          this.model   = Post.create();
          this.request = this.model.save.bind(this.model);
        });

        it('requests the proper URL', function() {
          this.model.save();
          jQuery.ajax.args[0][0].url.should.eql('/posts');
        });

        it('does a POST request', function() {
          this.model.save();
          jQuery.ajax.args[0][0].type.should.eql('POST');
        });

        shared.behavesLikeASaveRequest();
        shared.behavesLikeAFailableRequest();
      });
    });

    describe('when there are parents', function() {
      describe('when the model has a primary key', function() {
        beforeEach(function() {
          this.model   = Comment.create({ post_id: 2, id: 1 });
          this.request = this.model.save.bind(this.model);
        });

        it('requests the proper URL', function() {
          this.model.save();
          jQuery.ajax.args[0][0].url.should.eql('/posts/2/comments/1');
        });

        it('does a PATCH request', function() {
          this.model.save();
          jQuery.ajax.args[0][0].type.should.eql('PATCH');
        });

        shared.behavesLikeASaveRequest();
        shared.behavesLikeAFailableRequest();
      });

      describe('when the model has no primary key', function() {
        beforeEach(function() {
          this.model   = Comment.create({ post_id: 2 });
          this.request = this.model.save.bind(this.model);
        });

        it('requests the proper URL', function() {
          this.model.save();
          jQuery.ajax.args[0][0].url.should.eql('/posts/2/comments');
        });

        it('does a POST request', function() {
          this.model.save();
          jQuery.ajax.args[0][0].type.should.eql('POST');
        });

        shared.behavesLikeASaveRequest();
        shared.behavesLikeAFailableRequest();
      });
    });
  });

  describe('::all', function() {
    describe('when there are no parents', function() {
      beforeEach(function() {
        this.request = Post.all.bind(Post);
        this.klass   = Post;
      });

      it('requests the proper URL', function() {
        this.request();
        jQuery.ajax.args[0][0].url.should.eql('/posts');
      });

      shared.behavesLikeAGETRequest();
      shared.behavesLikeAJSONRequest();
      shared.behavesLikeAnArrayRequest();
      shared.behavesLikeAFailableRequest();
    });

    describe('when there are parents', function() {
      beforeEach(function() {
        this.request = function() {
          var post = Post.create({ id: 12345 });
          return Comment.all(post);
        }

        this.klass = Comment;
      });

      it('requests the proper URl', function() {
        this.request();
        jQuery.ajax.args[0][0].url.should.eql('/posts/12345/comments');
      });

      shared.behavesLikeAGETRequest();
      shared.behavesLikeAJSONRequest();
      shared.behavesLikeAnArrayRequest();
      shared.behavesLikeAFailableRequest();
    });
  });

  describe('::find', function() {
    describe('when there are no parents', function() {
      beforeEach(function() {
        this.request = function() {
          return Post.find(1);
        }

        this.klass = Post;
      });

      it('requests the proper URL', function() {
        this.request();
        jQuery.ajax.args[0][0].url.should.eql('/posts/1');
      });

      shared.behavesLikeAGETRequest();
      shared.behavesLikeAJSONRequest();
      shared.behavesLikeAnObjectRequest();
      shared.behavesLikeAFailableRequest();
    });

    describe('when there are parents', function() {
      beforeEach(function() {
        this.request = function() {
          var post = Post.create({ id: 12345 });
          return Comment.find(post, 2);
        }

        this.klass = Comment;
      });

      it('requests the proper URL', function() {
        this.request();
        jQuery.ajax.args[0][0].url.should.eql('/posts/12345/comments/2');
      });

      shared.behavesLikeAGETRequest();
      shared.behavesLikeAJSONRequest();
      shared.behavesLikeAnObjectRequest();
      shared.behavesLikeAFailableRequest();
    });
  });
});
