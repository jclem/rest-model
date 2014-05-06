exports.behavesLikeAJSONRequest = function() {
  it('sends JSON dataType', function() {
    this.request();
    jQuery.ajax.args[0][0].dataType.should.eql('json');
  });

  it('sends JSON content type', function() {
    this.request();
    jQuery.ajax.args[0][0].contentType.should.eql('application/json');
  });
};

exports.behavesLikeAnArrayRequest = function() {
  it('resolves with an array of models', function(done) {
    var self = this;
    this.resolve = [{ content: 'post content' }];

    this.request().then(function(models) {
      models[0].constructor.should.eql(self.klass);
      models[0].get('content').should.eql('post content');
      done();
    });
  });
};

exports.behavesLikeAParentsRequest = function() {
  it('adds the parents to each model', function(done) {
    var self = this;
    this.resolve || (this.resolve = [{ content: 'post content' }]);

    this.request().then(function(models) {
      if ($.isArray(models)) {
        models[0].get('parents').should.eql(self.parents);
      } else {
        models.get('parents').should.eql(self.parents);
      }

      done();
    });
  });
};

exports.behavesLikeAnObjectRequest = function() {
  it('resolves with a single model', function(done) {
    var self = this;
    this.resolve = { content: 'post content' };

    this.request().then(function(model) {
      model.constructor.should.eql(self.klass);
      model.get('content').should.eql('post content');
      done();
    });
  });
};

exports.behavesLikeAFailableRequest = function() {
  it('rejects with the jqXHR object', function(done) {
    var self = this;
    this.resolve = null;
    this.reject  = { responseJSON: { message: 'failed jqXHR' } };

    this.request().then(null, function(jqXHR) {
      jqXHR.should.eql(self.reject);
      done();
    });
  });
};

exports.behavesLikeAGETRequest = function() {
  it('does a GET request', function() {
    this.request();
    jQuery.ajax.args[0][0].type.should.eql('GET');
  });
};

exports.behavesLikeASaveRequest = function() {
  it('updates the model attributes', function(done) {
    var self = this;
    var newContent;

    if (this.model.get('content')) {
      newContent = this.model.get('content') + ' new';
    } else {
      newContent = 'new content';
    }

    this.resolve = { content: newContent };

    this.model.save().then(function() {
      self.model.get('content').should.eql(newContent);
      done();
    })
  });
};
