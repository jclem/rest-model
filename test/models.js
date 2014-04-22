'use strict';

var RestModel = require('..');

exports.Post = RestModel.extend().reopenClass({
  url: '/posts'
});

exports.Comment = RestModel.extend().reopenClass({
  url: '/posts/:post_id/comments'
});
