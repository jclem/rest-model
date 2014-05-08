'use strict';

var RestModel = require('..');

exports.Post = RestModel.extend({
  attrs: ['id', 'created_at', 'content', 'foo', 'name']
}).reopenClass({
  url: '/posts'
});

exports.Comment = RestModel.extend().reopenClass({
  url: '/posts/:post_id/comments'
});
