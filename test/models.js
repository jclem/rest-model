'use strict';

var RestModel = require('..');

exports.Post = RestModel.extend({
  attrs: ['id', 'created_at', 'content', 'foo', 'name'],
  serializedProperties: ['id', 'created_at', 'content', 'foo', 'name'],
  assignErrors: function(jqXHR) {
    if (jqXHR.responseJSON.errors) {
      this.get('errors').setObjects(jqXHR.responseJSON.errors);
    }
  }
}).reopenClass({
  url: '/posts',

  toString: function() {
    return 'Post';
  }
});

exports.Comment = RestModel.extend().reopenClass({
  url: '/posts/:post_id/comments',

  toString: function() {
    return 'Comment';
  }
});
