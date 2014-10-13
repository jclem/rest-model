'use strict';

require('./test-helper');

describe('MutatingArray', function() {
  describe('#addFilter', function() {
    var arr, ret;

    beforeEach(function() {
      arr = require('../lib/mutating-array').create({ content: [1,2,3] });
      arr._id = 'same-array';

      ret = arr.addFilter(function(item) {
        return item === 1;
      });
    });

    it('returns the same array', function() {
      arr._id.should.eql(ret._id);
    });

    it('immediately filters the array', function() {
      arr.toArray().should.eql([1]);
    });

    it('filters the array in the future', function() {
      arr.pushObjects([1, 2]).toArray().should.eql([1, 1]);
    });
  });
});

