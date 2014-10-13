'use strict';

module.exports = Ember.ArrayProxy.extend(
  Ember.MutableArray, {

  filters: function() {
    return [];
  }.property(),

  addFilter: function(filter) {
    this.get('filters').pushObject(filter);
    var filtered = this.filter(filter);
    this.set('content', filtered);
    return this;
  },

  replaceContent: function(idx, amt, objects) {
    var filters = this.get('filters');

    filters.forEach(function applyFilter(filter) {
      objects = objects.filter(filter);
    });

    return this._super(idx, amt, objects);
  }
});
